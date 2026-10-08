// Layer 1: fast, deterministic detection (milliseconds, no network).

const luhn = (s) => {
  const d = s.replace(/\D/g, '');
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0, alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = +d[i];
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
};

// Order matters: earlier detectors win overlapping spans.
// Number patterns refuse to start or end inside a longer digit group ("1234 5678 9012 3456" is not an Aadhaar).
const PII_DETECTORS = [
  { type: 'API_KEY', re: /\b(?:sk-[A-Za-z0-9_-]{8,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|AIza[0-9A-Za-z_-]{30,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g },
  { type: 'EMAIL', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g },
  { type: 'SSN', re: /(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)/g },
  { type: 'CREDIT_CARD', re: /(?<!\d)(?:\d[ -]?){13,19}(?!\d)/g, validate: luhn },
  { type: 'AADHAAR', re: /(?<!\d[ -]?)[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}(?![ -]?\d)/g },
  { type: 'PAN', re: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
  { type: 'PHONE', re: /(?<!\d[ -]?)(?:\+91[ -]?)?[6-9]\d{4}[ -]?\d{5}(?![ -]?\d)/g },
  { type: 'PHONE', re: /(?<!\d[ -]?)(?:\+?1[ -]?)?\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4}(?![ -]?\d)/g },
];

export function detectPII(text) {
  const found = [];
  for (const d of PII_DETECTORS) {
    for (const m of text.matchAll(d.re)) {
      const start = m.index, end = start + m[0].length;
      if (d.validate && !d.validate(m[0])) continue;
      if (found.some((f) => start < f.end && end > f.start)) continue;
      found.push({ type: d.type, start, end, value: m[0] });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

// Reversible redaction: same value -> same token, vault never leaves the request.
export function createRedactor() {
  const counters = {}, vault = {}, byValue = {};
  const process = (text, matches) => {
    const toks = matches.map((m) => {
      const k = m.type + '|' + m.value;
      if (!byValue[k]) {
        counters[m.type] = (counters[m.type] || 0) + 1;
        byValue[k] = `[${m.type}_${counters[m.type]}]`;
        vault[byValue[k]] = m.value;
      }
      return byValue[k];
    });
    let out = '', last = 0;
    matches.forEach((m, i) => { out += text.slice(last, m.start) + toks[i]; last = m.end; });
    out += text.slice(last);
    return { sanitized: out, spans: matches.map((m, i) => ({ type: m.type, start: m.start, end: m.end, token: toks[i] })) };
  };
  return { process, getVault: () => vault, detokenize: (text) => text.replace(/\[([A-Z_]+_\d+)\]/g, (t) => vault[t] ?? t) };
}

export function tokenize(text, matches) {
  const r = createRedactor();
  const res = r.process(text, matches);
  return { sanitized: res.sanitized, vault: r.getVault(), spans: res.spans };
}
export const detokenize = (text, vault) => text.replace(/\[([A-Z_]+_\d+)\]/g, (t) => vault[t] ?? t);

/* ---------- threat rules ----------
 * w      weight 0-100; one rule at or above the policy threshold blocks on its own
 * unless optional regex: if it matches the (normalized) prompt the rule is skipped (how-to questions etc.)
 * raw    match against the original text (case-sensitive) instead of the normalized variants
 * Weak signals (w < 40) never block alone but add 15 each when combined with a stronger hit.
 */
const LIMITS = String.raw`(?:limits|limitations|rules|restrictions|filters|guidelines|guardrails|censorship|content polic(?:y|ies)|polic(?:y|ies)|ethics|morals|safety (?:rules|guidelines|filters))`;
const HOWTO = /^\W*(?:how|what(?:'s| is) the (?:best )?way|is there a way)\b|\bhow (?:do|can|would|should) (?:i|we)\b|\bhow to\b/;
const RULES = [
  { id: 'override_instructions', cat: 'PROMPT_INJECTION', w: 70, label: 'Instruction override',
    explain: 'The prompt tries to make the model ignore or replace its existing instructions.',
    re: /\b(ignore|disregard|forget|override|bypass|drop|stop following|abandon)\b[^.\n]{0,25}\b(your|all|any|the|previous|prior|above|earlier|preceding|initial|original|system|safety|developer)\b[^.\n]{0,20}\b(instructions?|rules?|prompts?|guidelines?|polic(?:y|ies)|directives?|directions?|safeguards?|restrictions?|guardrails?|programming)\b|\b(ignore|disregard|bypass|disable|turn off)\b[^.\n]{0,15}\b(?:your|the|any|all)? ?(?:content|safety|moderation) filters?\b|\b(?:bypass|disable|turn off)\b[^.\n]{0,10}\byour filters?\b/ },
  { id: 'ignore_context', cat: 'PROMPT_INJECTION', w: 70, label: 'Context wipe',
    explain: 'The prompt tells the model to discard everything it was told before this point.',
    re: /\b(ignore|disregard|forget)\s+(?:everything|all|anything)\s+(?:above|before|prior|previous(?:ly)?|so far|(?:you(?:'ve| have) been|you were) told)/ },
  { id: 'system_prompt_exfil', cat: 'PROMPT_INJECTION', w: 75, label: 'System prompt extraction',
    explain: 'The prompt asks the model to reveal its hidden system prompt or internal instructions.',
    re: /\b(reveal|show|print|display|repeat|leak|output|expose|tell me|what is|what's|recite|dump)\b[^.\n]{0,30}\b((?<!\ban )(?<!\ba )system prompt(?!\s+(?:best practices|examples?|templates?|design|engineering|tips|guide|ideas|for (?:a|an|my|our)\b))|hidden (?:prompt|instructions?)|initial (?:prompt|instructions?)|your (?:instructions|prompt|rules|configuration))\b/ },
  { id: 'given_instructions', cat: 'PROMPT_INJECTION', w: 70, label: 'System prompt extraction',
    explain: 'The prompt asks what instructions the model was given before the conversation.',
    re: /\b(instructions?|rules|prompt|guidelines|directives)\b[^.\n]{0,20}\byou (?:were|have been|'ve been|got) (?:given|told|programmed|instructed|configured)\b/ },
  { id: 'prompt_verbatim', cat: 'PROMPT_INJECTION', w: 65, label: 'Verbatim prompt request',
    explain: 'The prompt asks for hidden or internal instructions word for word, often wrapped in a story.',
    re: /\b(?:hidden|secret|internal|original|initial|full|exact)\s+(?:system )?(?:prompt|instructions)\b[^\n]{0,40}\b(?:verbatim|word for word|in full|exactly)\b|\b(?:verbatim|word for word)\b[^\n]{0,40}\b(?:system prompt|hidden instructions)\b/ },
  { id: 'persona_jailbreak', cat: 'JAILBREAK', w: 60, label: 'Jailbreak mode',
    explain: 'The prompt switches on a known jailbreak mode (DAN, developer mode, god mode) to remove safety limits.',
    unless: HOWTO,
    re: /\bdo anything now\b|\b(?:enable|enter|activate|switch (?:on|to|into)|turn on|start|(?:you are|you're) (?:now )?in|now in)\s+(?:the\s+)?(?:developer|dev|god|unfiltered|jailbreak|jailbroken|evil|chaos) mode\b/ },
  { id: 'jailbreak_word', cat: 'JAILBREAK', w: 30, label: 'Jailbreak vocabulary',
    explain: 'The prompt mentions jailbreaking. Weak signal on its own: people also ask about it legitimately.',
    re: /\bjailbr(?:eak|oken|oke)\w*\b|\b(?:developer|dev|god|unfiltered) mode\b/ },
  { id: 'persona_dan', cat: 'JAILBREAK', w: 60, raw: true, label: 'Jailbreak persona (DAN)',
    explain: 'The prompt casts the model as the DAN ("Do Anything Now") jailbreak persona.',
    re: /\b(?:[Yy]ou are|[Yy]ou're|[Aa]ct as|[Bb]ecome|[Pp]retend to be|role of[^.\n]{0,40})\s*DAN\b|\bDAN\b,? (?:an AI|who|that can|mode)/ },
  { id: 'role_override', cat: 'JAILBREAK', w: 55, label: 'Role reassignment',
    explain: 'The prompt tries to reassign the model to a different role mid-conversation.',
    re: /\b(you are now|from now on,? you (?:are|will|must)|act as (?:a |an |the )?(?:super ?admin|admin|root|system|unrestricted|unfiltered))/ },
  { id: 'privilege_claim', cat: 'JAILBREAK', w: 70, label: 'Privilege escalation',
    explain: 'The prompt grants the model admin, root or unrestricted status.',
    re: /\b(?:you are now|you're now|from now on,? you are|act as|pretend (?:to be|you are)|simulate|emulate|become|roleplay as)\b[^.\n]{0,30}\b(?:super ?admin|administrator|root(?: user)?|sudo|god|unrestricted|full (?:access|privileges|permissions))\b/ },
  { id: 'ai_no_limits', cat: 'JAILBREAK', w: 65, label: 'Unrestricted AI persona',
    explain: 'The prompt describes an AI or model that has no rules, filters or limits.',
    re: new RegExp(String.raw`\b(?:ai|model|assistant|chatbot|bot|gpt|llm|version of (?:you|yourself))\b[^.\n]{0,40}\b(?:no|without(?: any)?|zero|free (?:from|of)|broken free (?:from|of)|freed from|released from|liberated from)\s+(?:\w+\s+){0,2}${LIMITS}\b|\b(?:unrestricted|unfiltered|uncensored|unaligned|jailbroken)\s+(?:ai|model|assistant|chatbot|version|llm|gpt)\b`) },
  { id: 'pretend_no_limits', cat: 'JAILBREAK', w: 65, label: 'Hypothetical with no limits',
    explain: 'The prompt uses a hypothetical or roleplay framing in which the model has no rules.',
    re: new RegExp(String.raw`\b(?:pretend|imagine|suppose|hypothetically|roleplay|role-play|let(?:'s| us) play)\b[^.\n]{0,40}\byou\b[^.\n]{0,40}\b(?:no|without(?: any)?|zero)\s+(?:\w+\s+)?${LIMITS}\b`) },
  { id: 'respond_without', cat: 'JAILBREAK', w: 65, label: 'Answer without limits',
    explain: 'The prompt tells the model to answer with its rules or filters switched off.',
    re: new RegExp(String.raw`\b(?:respond|answer|reply|talk|speak|operate|act)\b[^.\n]{0,20}\b(?:without(?: any)?|with no|ignoring)\s+(?:\w+\s+)?${LIMITS}\b`) },
  { id: 'never_refuse', cat: 'JAILBREAK', w: 60, label: 'Never-refuse persona',
    explain: 'The prompt defines a persona that never refuses a request.',
    re: /\b(?:who|that|which|you|you'll|it|and)\s+(?:will\s+|must\s+)?(?:never|won't|doesn't|does not|can't|cannot|must not)\s+(?:ever\s+)?(?:refuses?|say no|decline|turn down)\b/ },
  { id: 'has_no_rules', cat: 'JAILBREAK', w: 35, label: 'No-rules language',
    explain: 'Something in the prompt "has no rules". Weak signal on its own: stories use it too.',
    re: new RegExp(String.raw`\b(?:has|have|with)\s+no\s+(?:\w+\s+)?${LIMITS}\b`) },
  { id: 'grandma_exploit', cat: 'JAILBREAK', w: 70, label: 'Sentimental roleplay exploit',
    explain: 'The prompt uses a "pretend to be my late grandmother who used to tell me ..." framing to extract secrets.',
    re: /\b(?:act as|pretend to be|pretend you(?:'re| are)|roleplay as|play the role of|you are)\s+my\s+(?:late |dead |deceased |dear |sweet |old )?(?:grand(?:ma|mother|pa|father)|granny|nan|nana)\b[^\n]{0,80}\b(?:passwords?|license keys?|product keys?|activation keys?|keys|serial numbers?|credentials|api keys?|secrets?|codes?)\b/ },
  { id: 'context_override', cat: 'PROMPT_INJECTION', w: 70, label: 'Creator override',
    explain: 'The prompt tells the model to disregard what its developers or operators told it.',
    re: /\b(?:ignore|disregard|forget)\s+(?:what(?:ever)?|anything|everything|all)\s+(?:the (?:developers?|company|operators?|admins?)|your (?:creators?|developers?|makers?|owners?|operators?)|they|you(?:'ve| have)? (?:were |been )?(?:told|given|taught))\b/ },
  { id: 'new_instructions', cat: 'PROMPT_INJECTION', w: 60, label: 'Replacement instructions',
    explain: 'The prompt declares new rules or cancels the model\'s existing ones.',
    re: /^\W*(?:new|updated|revised) (?:rules?|instructions?|polic(?:y|ies)|directives?|system prompt)\s*:|\b(?:your )?(?:previous|prior|old|original|existing) (?:instructions|rules|directives|guidelines) (?:are|have been|were) (?:now )?(?:cancell?ed|void|revoked|replaced|overridden|deleted|lifted)\b/ },
  { id: 'comply_all', cat: 'JAILBREAK', w: 60, label: 'Unconditional compliance',
    explain: 'The prompt demands that the model obey every request without exception.',
    re: /\b(?:comply with|obey|follow|answer|fulfil+|do)\s+(?:every|any|all)\s+(?:request|command|order|instruction|question)s?\b[^.\n]{0,30}\b(?:no matter what|without (?:question|exception|refusing|hesitation)|regardless)\b/ },
  { id: 'echo_context', cat: 'PROMPT_INJECTION', w: 60, label: 'Context echo',
    explain: 'The prompt asks the model to repeat the hidden text that came before the user\'s message.',
    re: /\b(?:repeat|print|output|copy|reproduce|recite)\b[^.\n]{0,20}\b(?:the )?(?:text|words|everything|content|messages?|lines?)\s+(?:above|before this|preceding|prior to this)\b/ },
  { id: 'safety_off', cat: 'JAILBREAK', w: 55, label: 'Safety switched off',
    explain: 'The prompt claims safety controls are off or that the user has verified privileged status.',
    re: /\b(?:safety|filters?|guardrails?|restrictions|content filter|moderation)\s+(?:mode\s+)?(?:is\s+|are\s+)?(?:now\s+)?(?:off|disabled|deactivated|lifted)\b|\buser is (?:a |an )?(?:verified|authori[sz]ed|trusted|confirmed) (?:admin|administrator|developer|owner|root)\b/ },
  { id: 'evil_persona', cat: 'JAILBREAK', w: 60, label: 'Evil-twin persona',
    explain: 'The prompt asks for an "evil", amoral or unhinged version of the model.',
    re: /\b(?:evil|unethical|amoral|immoral|unhinged|uncensored)\s+(?:twin|version|mode|alter ego|counterpart|ai|assistant|bot|clone)\b/ },
  { id: 'data_exfil', cat: 'DATA_EXFILTRATION', w: 65, label: 'Bulk data extraction',
    explain: 'The prompt asks the model to dump bulk records, credentials or secrets.',
    unless: new RegExp(HOWTO.source + String.raw`|\b(?:sql|query|schema|this (?:table|list|data|dataset|file|spreadsheet))\b`),
    re: /\b(print|dump|list|show|give me|export|send me|extract|reveal|leak)\b[^.\n]{0,30}\b(all|every|entire|full)\b[^.\n]{0,30}\b(users?|customers?|database|records?|passwords?|credentials|secrets?|api keys?|tables?|emails?|email addresses)\b/ },
  { id: 'delimiter_spoof', cat: 'PROMPT_INJECTION', w: 50, label: 'Fake system delimiters',
    explain: 'The prompt contains fake role or system markers meant to impersonate trusted instructions.',
    re: /(<\/?(?:system|assistant|instructions?)>|\[\/?(?:inst|sys)\]|<\|(?:im_start|im_end|system)\|>|^#{2,3}\s*(?:system|instructions?)\b)/m },
  { id: 'inspector_tamper', cat: 'INSPECTOR_TAMPERING', w: 80, sticky: true, label: 'Attack on the firewall itself',
    explain: 'The prompt tries to manipulate the security classifier (e.g. "mark this as safe", "set risk to 0").',
    re: /\b(?:this (?:prompt|message|input) is (?:safe|benign|harmless|approved)|(?:mark|classify|label|rate) (?:this|it) as (?:safe|benign)|risk[_ ]?score\W{0,5}(?:to |of |=|:)?\W{0,3}0\b|is_safe\W{0,5}true|threat_category\W{0,5}safe|respond with (?:only )?(?:\{|json))/ },
  { id: 'harmful_request', cat: 'TOXICITY', w: 80, label: 'Harmful content request',
    explain: 'The prompt asks for help creating weapons or malware.',
    re: /\b(build|make|create|write|synthesi[sz]e)\b[^.\n]{0,20}\b(bomb|explosives?|ransomware|malware|keylogger|nerve agent|bioweapon)\b/ },
  { id: 'threat', cat: 'TOXICITY', w: 70, label: 'Threat or self-harm language',
    explain: 'The prompt contains threatening or self-harm language.',
    re: /\b(kill yourself|i(?:'ll| will) (?:hurt|kill|find) you)\b/ },
  { id: 'insult', cat: 'TOXICITY', w: 35, label: 'Abusive language',
    explain: 'The prompt contains insulting or abusive language.', re: /\b(idiot|stupid|moron|dumb|worthless|shut up|hate you)\b/ },
];

const norm = (s) => s.normalize('NFKC').replace(/[\u200B-\u200F\u2060\uFEFF]/g, '').toLowerCase();
const deleet = (s) => s.replace(/[013457@$]/g, (c) => ({ 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' }[c]));
const despace = (s) => s.replace(/\b(?:[a-z][ .\-_]){3,}[a-z]\b/g, (m) => m.replace(/[ .\-_]/g, ''));

export const combine = (list) => (list.length ? Math.min(100, list[0].w + 15 * (list.length - 1)) : 0);

function runRules(raw, skip) {
  const n = norm(raw);
  const variants = [n, deleet(n), deleet(n.replace(/1/g, 'l')), despace(n)];
  const hits = [];
  for (const r of RULES) {
    if (skip?.has(r.id)) continue;
    if (r.unless && r.unless.test(n)) continue;
    const targets = r.raw ? [raw] : variants;
    if (targets.some((v) => r.re.test(v))) hits.push({ id: r.id, cat: r.cat, w: r.w, label: r.label, explain: r.explain, sticky: !!r.sticky });
  }
  return hits;
}

export function scanThreats(raw) {
  const hits = runRules(raw);
  // Obfuscation: decode base64-looking blobs and rescan them.
  for (const blob of raw.match(/[A-Za-z0-9+/]{20,}={0,2}/g) || []) {
    let dec = '';
    try { dec = Buffer.from(blob, 'base64').toString('utf8'); } catch { continue; }
    if (dec.length < 10 || /[^\x09\x0a\x0d\x20-\x7e]/.test(dec)) continue;
    const inner = runRules(dec);
    if (inner.length) {
      hits.push({ id: 'encoded_payload', cat: inner[0].cat, w: Math.max(70, inner[0].w), label: 'Obfuscated (base64) attack',
        explain: 'A base64-encoded string decodes to a known attack pattern: someone is hiding the payload.', sticky: false });
      break;
    }
  }
  hits.sort((a, b) => b.w - a.w);
  return { rules: hits, risk: combine(hits) };
}

export const looksSuspicious = (t) =>
  t.length > 600 ||
  /[A-Za-z0-9+/]{30,}={0,2}/.test(t) ||
  /\b(you are|pretend|role-?play|act as|instructions?|system|prompt|rules?|bypass|unrestricted|unfiltered|hypothetical(?:ly)?|persona|jailbreak|secret|confidential|admin|password|credentials?|no limits|without (?:any )?(?:filters|restrictions))\b/i.test(t);
