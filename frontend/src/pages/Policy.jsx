import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Btn, Card, Icon, Loading, PageHeader, Toggle } from '../ui.jsx';

const Select = ({ label, hint, value, onChange, options }) => (
  <label className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 py-4">
    <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-ink">{label}</span><span className="mt-0.5 block text-[13px] text-mute">{hint}</span></span>
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input w-auto min-w-[220px] cursor-pointer py-2 text-sm">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  </label>
);

export default function Policy() {
  const [p, setP] = useState(null);
  const [ai, setAi] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/api/policy').then((r) => { setP(r.data.policy); setAi(r.data.aiConfigured); }); }, []);
  if (!p) return <Loading label="Loading policy…" />;
  const set = (k) => (v) => { setP({ ...p, [k]: v }); setMsg(''); };
  const save = async () => {
    setBusy(true);
    const r = await api.put('/api/policy', p);
    setMsg(r.status === 200 ? 'ok' : 'error');
    setBusy(false);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Policy" description="Choose what PromptShield checks and how strictly it enforces the rules." />
      <Card title="Detection" description="Checks applied to every prompt and response.">
        <div className="-my-4 divide-y divide-line">
          <Toggle label="Prompt injection and jailbreak detection" hint="Instruction overrides, persona jailbreaks, fake delimiters and attacks on the firewall." checked={p.injectionDetection} onChange={set('injectionDetection')} />
          <Toggle label="Toxicity and harmful requests" hint="Threats, abuse, weapons and malware requests." checked={p.toxicityDetection} onChange={set('toxicityDetection')} />
          <Toggle label="Mask personal data" hint="Emails, phone numbers, SSN, cards, Aadhaar, PAN and API keys are replaced with tokens before reaching the model." checked={p.piiMasking} onChange={set('piiMasking')} />
          <Toggle label="Restore masked values in the reply" hint="The user sees their own data again. The model never does." checked={p.reversibleRedaction} onChange={set('reversibleRedaction')} />
          <Toggle label="Check the model's response" hint="Withhold replies that leak the system prompt or contain raw personal data." checked={p.outputGuard} onChange={set('outputGuard')} />
        </div>
      </Card>
      <Card title="Enforcement" description="How decisions are made."
        right={<span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${ai ? 'border-ok-line bg-ok-soft text-ok' : 'border-warn-line bg-warn-soft text-warn'}`}><span className={`h-1.5 w-1.5 rounded-full ${ai ? 'bg-[#17b26a]' : 'bg-[#f79009]'}`} />{ai ? 'Gemini connected' : 'Gemini not configured'}</span>}>
        <div className="-my-4 divide-y divide-line">
          <Select label="Strictness" hint="Higher blocks on weaker signals, with more false positives." value={p.strictness} onChange={set('strictness')} options={[['low', 'Low (block at 80)'], ['medium', 'Medium (block at 60)'], ['high', 'High (block at 40)']]} />
          <Select label="Gemini inspector" hint={ai ? 'Tiered mode calls Gemini only for ambiguous prompts, so most requests finish in milliseconds.' : 'No GEMINI_API_KEY on the server. Regex-only mode is used.'} value={p.aiMode} onChange={set('aiMode')} options={[['off', 'Off (regex only)'], ['tiered', 'Tiered (ambiguous only)'], ['always', 'Always']]} />
          <Select label="If the inspector fails" hint="Fail closed blocks the request when it needed the AI check and could not get it." value={p.failMode} onChange={set('failMode')} options={[['closed', 'Fail closed (block)'], ['open', 'Fail open (allow)']]} />
        </div>
      </Card>
      <div className="flex items-center justify-end gap-4 border-t border-line pt-5">
        {msg === 'ok' && <span role="status" className="inline-flex items-center gap-1.5 text-sm text-ok"><Icon name="check" size={15} />Policy saved</span>}
        {msg === 'error' && <span role="alert" className="text-sm text-bad">Could not save the policy.</span>}
        <Btn onClick={save} disabled={busy} busy={busy}>Save changes</Btn>
      </div>
    </div>
  );
}
