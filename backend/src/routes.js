import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { auth, validate } from './auth.js';
import { db, getPolicy, setPolicy, saveEvent, parseEvent, verifyChain, DEFAULT_POLICY } from './db.js';
import { runPipeline } from './pipeline/index.js';
import { runBenchmark } from './benchmark.js';
import { config } from './config.js';
import { createRedactor, detectPII } from './pipeline/detectors.js';
import { guardOutput } from './pipeline/outputGuard.js';

const r = Router();
const limiter = rateLimit({ windowMs: 60_000, limit: 90, standardHeaders: true, legacyHeaders: false });

r.get(['/health', '/api/health'], (_q, s) => s.json({ ok: true, ai: config.geminiKey ? `gemini:${config.geminiModel}` : 'regex-only (no GEMINI_API_KEY)' }));

/* ---- guarded chat ---- */
const chatSchema = z.object({ prompt: z.string().min(1).max(8000), context: z.string().max(2000).optional(), guardrails: z.boolean().default(true), targetModel: z.string().optional() });
const publicOut = (o, eventId) => ({
  eventId, action: o.action, category: o.category, risk: o.risk, source: o.source, reason: o.reason,
  rules: o.rules.map(({ id, label, explain, w }) => ({ id, label, explain, w })),
  spans: o.spans, llmInput: o.llmInput, response: o.response, llmMode: o.llmMode, leaked: o.leaked,
  stages: o.stages, latency: o.latency,
});

r.post('/api/chat', auth, limiter, validate(chatSchema), async (req, res) => {
  const DAILY_LIMIT = Number(process.env.DOWNSTREAM_DAILY_LIMIT) || 25;
  const quotaRow = db.prepare(`SELECT COUNT(*) as c FROM events WHERE user_id=? AND date(created_at) = date('now') AND (action='ALLOWED' OR action='REDACTED' OR action='UNGUARDED')`).get(req.user.id);
  const quotaExceeded = quotaRow && quotaRow.c >= DAILY_LIMIT;

  const targetModel = quotaExceeded ? 'Quota exceeded' : req.body.targetModel;
  const out = await runPipeline({ prompt: req.body.prompt, context: req.body.context, policy: getPolicy(req.user.id), guardrails: req.body.guardrails, targetModel });
  const id = saveEvent(req.user.id, out);
  res.status(out.action === 'BLOCKED' ? 403 : 200).json(publicOut(out, id));
});

/* ---- OpenAI-compatible drop-in proxy: change one base URL ---- */
const oaiSchema = z.object({
  model: z.string().optional(),
  messages: z.array(z.object({ role: z.string(), content: z.union([z.string(), z.array(z.any()), z.null()]).optional() })).min(1),
}).passthrough();
r.post('/v1/chat/completions', auth, limiter, validate(oaiSchema), async (req, res) => {
  if (req.body.stream) {
    return res.status(400).json({ error: { message: 'stream is not supported yet', type: 'invalid_request_error' } });
  }

  const policy = getPolicy(req.user.id);
  const redactor = createRedactor();
  const clonedBody = structuredClone(req.body);

  const scanTexts = [];
  const systemMsg = clonedBody.messages.find((m) => m.role === 'system' || m.role === 'developer');
  const context = systemMsg ? (typeof systemMsg.content === 'string' ? systemMsg.content : Array.isArray(systemMsg.content) ? systemMsg.content.map(p => p.text || '').join(' ') : '') : undefined;

  for (const m of clonedBody.messages) {
    if (m.role === 'system' || m.role === 'developer') continue;
    let contentStr = '';
    if (typeof m.content === 'string') {
      contentStr = m.content;
      if (policy.piiMasking) {
        m.content = redactor.process(contentStr, detectPII(contentStr)).sanitized;
      }
    } else if (Array.isArray(m.content)) {
      m.content.forEach((p) => {
        if (p.type === 'text' && p.text) {
          contentStr += p.text + '\n';
          if (policy.piiMasking) {
            p.text = redactor.process(p.text, detectPII(p.text)).sanitized;
          }
        }
      });
    }
    if (contentStr && m.role !== 'assistant') scanTexts.push(contentStr);
  }

  const scanText = scanTexts.join('\n\n');
  if (!scanText.trim()) return res.status(400).json({ error: { message: 'No content to scan', type: 'invalid_request_error' } });
  if (scanText.length > 16000) return res.status(413).json({ error: { message: 'Request too large: scanned text exceeds 16000 characters', type: 'invalid_request_error' } });
  
  const out = await runPipeline({ prompt: scanText, context, policy, guardrails: true, runDownstream: false });
  
  if (out.action === 'BLOCKED') {
    const id = saveEvent(req.user.id, out);
    res.set('x-promptshield-event', String(id));
    return res.status(403).json({ error: { message: out.response, type: 'guardrail_blocked', code: out.category, risk_score: out.risk, event_id: id } });
  }

  const DAILY_LIMIT = Number(process.env.DOWNSTREAM_DAILY_LIMIT) || 25;
  const quotaRow = db.prepare(`SELECT COUNT(*) as c FROM events WHERE user_id=? AND date(created_at) = date('now') AND (action='ALLOWED' OR action='REDACTED' OR action='UNGUARDED')`).get(req.user.id);
  const quotaExceeded = quotaRow && quotaRow.c >= DAILY_LIMIT;

  let data;
  if (process.env.UPSTREAM_BASE_URL && process.env.UPSTREAM_API_KEY && !quotaExceeded) {
    try {
      const baseUrl = process.env.UPSTREAM_BASE_URL.replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.UPSTREAM_API_KEY}` },
        body: JSON.stringify(clonedBody),
        signal: AbortSignal.timeout(60000)
      });
      data = await response.json();
      if (!response.ok) return res.status(response.status).json(data);
    } catch (e) {
      return res.status(502).json({ error: { message: `Upstream error: ${e.message}`, type: 'upstream_error' } });
    }
  } else {
    const notice = quotaExceeded ? `[Simulated upstream - Daily quota of ${DAILY_LIMIT} exceeded]\n` : `[Simulated ${req.body.model || 'upstream'}]\n`;
    data = {
      id: `chatcmpl-ps-${Date.now()}`, object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: req.body.model || 'promptshield-proxy',
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: `${notice}Thanks for contacting support. Here is a draft reply: "${scanText.slice(0, 300)}"` } }],
    };
  }

  // Guard output
  if (data.choices && Array.isArray(data.choices)) {
    for (const choice of data.choices) {
      if (choice.message && choice.message.content) {
        const og = policy.outputGuard ? guardOutput(choice.message.content) : { action: 'PASS', text: choice.message.content };
        if (og.action === 'BLOCK') {
          out.action = 'BLOCKED';
          out.category = 'OUTPUT_LEAK';
          out.risk = 95;
          out.reason = 'The model\'s response contained protected system data (canary token or internal notes), so it was withheld.';
          const id = saveEvent(req.user.id, out);
          res.set('x-promptshield-event', String(id));
          return res.status(403).json({ error: { message: og.text, type: 'guardrail_blocked', code: 'OUTPUT_LEAK', risk_score: 95, event_id: id } });
        }
        let finalText = og.text;
        if (policy.piiMasking && policy.reversibleRedaction) {
          finalText = redactor.detokenize(finalText);
        }
        choice.message.content = finalText;
      }
    }
  }

  const id = saveEvent(req.user.id, out);
  res.set('x-promptshield-event', String(id));
  
  if (!data.promptshield) {
    data.promptshield = { action: out.action, risk_score: out.risk, category: out.category, guard_ms: out.latency.guard };
  }
  
  res.json(data);
});

/* ---- audit log ---- */
r.get('/api/events', auth, (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 25, 1), 100);
  const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
  const action = ['ALLOWED', 'REDACTED', 'BLOCKED', 'UNGUARDED'].includes(req.query.action) ? req.query.action : null;
  const where = 'user_id=?' + (action ? ' AND action=?' : '');
  const args = action ? [req.user.id, action] : [req.user.id];
  const rows = db.prepare(`SELECT * FROM events WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, limit, offset);
  const total = db.prepare(`SELECT COUNT(*) c FROM events WHERE ${where}`).get(...args).c;
  res.json({ total, events: rows.map(parseEvent) });
});

r.get('/api/events/export', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM events WHERE user_id=? ORDER BY id DESC').all(req.user.id).map(parseEvent);
  if (req.query.format === 'csv') {
    const cols = ['id', 'created_at', 'action', 'category', 'risk', 'source', 'reason', 'pii', 'sanitized'];
    const esc = (v) => `"${String(Array.isArray(v) ? v.join('|') : v ?? '').replace(/"/g, '""')}"`;
    res.set({ 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="promptshield-audit.csv"' });
    return res.send([cols.join(','), ...rows.map((e) => cols.map((c) => esc(e[c])).join(','))].join('\n'));
  }
  res.set('content-disposition', 'attachment; filename="promptshield-audit.json"').json(rows);
});

r.get('/api/events/verify', auth, (req, res) => {
  const result = verifyChain(req.user.id);
  res.json(result);
});

r.get('/api/events/:id', auth, (req, res) => {
  const row = db.prepare('SELECT * FROM events WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Event not found' });
  res.json(parseEvent(row));
});

/* ---- analytics ---- */
r.get('/api/stats', auth, (req, res) => {
  const uid = req.user.id;
  const one = (sql, ...a) => db.prepare(sql).all(uid, ...a);
  const byAction = Object.fromEntries(one('SELECT action,COUNT(*) c FROM events WHERE user_id=? AND guardrails=1 GROUP BY action').map((x) => [x.action, x.c]));
  const byCategory = one("SELECT category name,COUNT(*) value FROM events WHERE user_id=? AND guardrails=1 AND category NOT IN ('SAFE','NONE') GROUP BY category ORDER BY value DESC");
  const dayRows = one("SELECT date(created_at) d,action,COUNT(*) c FROM events WHERE user_id=? AND guardrails=1 AND created_at>=datetime('now','-6 days') GROUP BY d,action");
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const row = { day: d.slice(5), ALLOWED: 0, REDACTED: 0, BLOCKED: 0 };
    dayRows.filter((x) => x.d === d).forEach((x) => (row[x.action] = x.c));
    days.push(row);
  }
  const recent = one('SELECT latency,pii,source FROM events WHERE user_id=? AND guardrails=1 ORDER BY id DESC LIMIT 300').map((x) => ({ l: JSON.parse(x.latency || '{}'), pii: JSON.parse(x.pii || '[]') }));
  const avg = (f) => { const v = recent.map((x) => x.l[f]).filter((n) => n > 0); return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null; };
  const piiCount = {};
  recent.forEach((x) => x.pii.forEach((t) => (piiCount[t] = (piiCount[t] || 0) + 1)));
  const total = Object.values(byAction).reduce((a, b) => a + b, 0);
  res.json({
    total, allowed: byAction.ALLOWED || 0, redacted: byAction.REDACTED || 0, blocked: byAction.BLOCKED || 0,
    unguarded: one('SELECT COUNT(*) c FROM events WHERE user_id=? AND guardrails=0')[0].c,
    blockRate: total ? +(((byAction.BLOCKED || 0) / total) * 100).toFixed(1) : 0,
    byCategory, days, avgGuardMs: avg('guard'), avgAiMs: avg('ai'),
    pii: Object.entries(piiCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
  });
});

/* ---- policy ---- */
const policySchema = z.object({
  piiMasking: z.boolean(), reversibleRedaction: z.boolean(), injectionDetection: z.boolean(), toxicityDetection: z.boolean(), outputGuard: z.boolean(),
  strictness: z.enum(['low', 'medium', 'high']), aiMode: z.enum(['off', 'tiered', 'always']), failMode: z.enum(['closed', 'open']),
});
r.get('/api/policy', auth, (req, res) => res.json({ policy: getPolicy(req.user.id), defaults: DEFAULT_POLICY, aiConfigured: !!config.geminiKey }));
r.put('/api/policy', auth, validate(policySchema), (req, res) => { setPolicy(req.user.id, req.body); res.json({ policy: req.body }); });

/* ---- benchmark ---- */
r.post('/api/benchmark', auth, rateLimit({ windowMs: 60_000, limit: 6 }), async (req, res) => {
  const result = await runBenchmark(getPolicy(req.user.id));
  db.prepare('INSERT INTO benchmarks(user_id,json) VALUES(?,?)').run(req.user.id, JSON.stringify(result));
  res.json({ ...result, createdAt: new Date().toISOString() });
});
r.get('/api/benchmark/latest', auth, (req, res) => {
  const row = db.prepare('SELECT * FROM benchmarks WHERE user_id=? ORDER BY id DESC LIMIT 1').get(req.user.id);
  res.json(row ? { ...JSON.parse(row.json), createdAt: row.created_at } : null);
});

export default r;
