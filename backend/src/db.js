// Node's built-in SQLite (Node 22.13+): no native add-on to compile, so the same files run on Windows, macOS and Linux.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
export const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  api_key_hash TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS policies(user_id INTEGER PRIMARY KEY, json TEXT NOT NULL);
-- Privacy by design: raw prompts and model responses are NEVER stored, only the PII-tokenized prompt.
CREATE TABLE IF NOT EXISTS events(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  guardrails INTEGER NOT NULL DEFAULT 1,
  action TEXT NOT NULL,
  category TEXT NOT NULL,
  risk INTEGER NOT NULL DEFAULT 0,
  source TEXT,
  reason TEXT,
  rules TEXT,
  pii TEXT,
  sanitized TEXT,
  latency TEXT,
  seeded INTEGER NOT NULL DEFAULT 0,
  prev_hash TEXT,
  hash TEXT,
  real_model INTEGER NOT NULL DEFAULT 0,
  hv INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id, id DESC);
CREATE TABLE IF NOT EXISTS chain_heads(user_id INTEGER PRIMARY KEY, head_hash TEXT, count INTEGER);
CREATE TABLE IF NOT EXISTS benchmarks(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  json TEXT NOT NULL
);
`);

// Alter table to add hash columns for existing setups
try {
  db.exec('ALTER TABLE events ADD COLUMN prev_hash TEXT;');
  db.exec('ALTER TABLE events ADD COLUMN hash TEXT;');
  db.exec('CREATE TABLE IF NOT EXISTS chain_heads(user_id INTEGER PRIMARY KEY, head_hash TEXT, count INTEGER);');
} catch (e) {}

try {
  db.exec('ALTER TABLE events ADD COLUMN real_model INTEGER NOT NULL DEFAULT 0;');
} catch (e) {}

try {
  db.exec('ALTER TABLE events ADD COLUMN hv INTEGER NOT NULL DEFAULT 1;');
} catch (e) {}

export const DEFAULT_POLICY = {
  piiMasking: true,
  reversibleRedaction: true,
  injectionDetection: true,
  toxicityDetection: true,
  outputGuard: true,
  strictness: 'medium', // low | medium | high
  aiMode: 'tiered', // off | tiered | always
  failMode: 'closed', // closed | open
};

export function getPolicy(userId) {
  const row = db.prepare('SELECT json FROM policies WHERE user_id=?').get(userId);
  return { ...DEFAULT_POLICY, ...(row ? JSON.parse(row.json) : {}) };
}
export function setPolicy(userId, policy) {
  db.prepare('INSERT INTO policies(user_id,json) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET json=excluded.json').run(
    userId,
    JSON.stringify(policy)
  );
}

export function saveEvent(userId, out, extra = {}) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const headRow = db.prepare('SELECT head_hash, count FROM chain_heads WHERE user_id=?').get(userId);
    const prevHash = headRow?.head_hash || '0000000000000000000000000000000000000000000000000000000000000000';
    const count = (headRow?.count || 0) + 1;
    
    const rulesJson = JSON.stringify((out.rules || []).map(({ id, label, explain, w }) => ({ id, label, explain, w })));
    const piiJson = JSON.stringify([...new Set((out.spans || []).map((s) => s.type))]);
    const sanitized = (out.storedPrompt || '').slice(0, 2000);
    const latencyJson = JSON.stringify(out.latency || {});
    
    const createdAt = extra.createdAt || new Date().toISOString();
    const guardrails = out.action === 'UNGUARDED' ? 0 : 1;
    const action = out.action;
    const category = out.category;
    const risk = out.risk;
    const source = out.source || null;
    const reason = out.reason || null;
    const seeded = extra.seeded ? 1 : 0;
    const realModel = out.realModel ? 1 : 0;

    const hv = 2;
    const dataToHash = JSON.stringify({ user_id: userId, created_at: createdAt, guardrails, action, category, risk, source, reason, rules: rulesJson, pii: piiJson, sanitized, latency: latencyJson, seeded, real_model: realModel, prev_hash: prevHash });
    const hash = crypto.createHash('sha256').update(dataToHash).digest('hex');

    const info = db.prepare(
      `INSERT INTO events(user_id,guardrails,action,category,risk,source,reason,rules,pii,sanitized,latency,seeded,prev_hash,hash,real_model,hv,created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(userId, guardrails, action, category, risk, source, reason, rulesJson, piiJson, sanitized, latencyJson, seeded, prevHash, hash, realModel, hv, createdAt);

    db.prepare('INSERT INTO chain_heads(user_id,head_hash,count) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET head_hash=excluded.head_hash, count=excluded.count').run(userId, hash, count);
    db.exec('COMMIT');
    return Number(info.lastInsertRowid);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function verifyChain(userId) {
  const rows = db.prepare('SELECT * FROM events WHERE user_id=? ORDER BY id ASC').all(userId);
  const headRow = db.prepare('SELECT head_hash, count FROM chain_heads WHERE user_id=?').get(userId);
  
  if (rows.length === 0) return { ok: true, checked: 0, unchained: 0 };
  
  let expectedPrev = '0000000000000000000000000000000000000000000000000000000000000000';
  let checked = 0;
  let unchained = 0;
  
  for (const r of rows) {
    if (!r.hash) { unchained++; continue; }
    let dataToHash;
    if (r.hv >= 2) {
      dataToHash = JSON.stringify({ user_id: r.user_id, created_at: r.created_at, guardrails: r.guardrails, action: r.action, category: r.category, risk: r.risk, source: r.source, reason: r.reason, rules: r.rules, pii: r.pii, sanitized: r.sanitized, latency: r.latency, seeded: r.seeded, real_model: r.real_model, prev_hash: r.prev_hash });
    } else {
      dataToHash = JSON.stringify({ user_id: r.user_id, created_at: r.created_at, guardrails: r.guardrails, action: r.action, category: r.category, risk: r.risk, source: r.source, reason: r.reason, rules: r.rules, pii: r.pii, sanitized: r.sanitized, latency: r.latency, seeded: r.seeded, prev_hash: r.prev_hash });
    }
    const computed = crypto.createHash('sha256').update(dataToHash).digest('hex');
    
    if (r.prev_hash !== expectedPrev || r.hash !== computed) {
      return { ok: false, checked, brokenAtId: r.id, unchained };
    }
    expectedPrev = r.hash;
    checked++;
  }
  
  if (headRow) {
    if (headRow.head_hash !== expectedPrev) return { ok: false, checked, brokenAtId: 'head_mismatch', unchained };
    if (headRow.count !== checked + unchained) return { ok: false, checked, brokenAtId: 'count_mismatch', unchained };
  } else if (checked > 0) {
     return { ok: false, checked, brokenAtId: 'missing_head', unchained };
  }
  
  return { ok: true, checked, unchained };
}

export const parseEvent = (r) => ({
  ...r,
  rules: JSON.parse(r.rules || '[]'),
  pii: JSON.parse(r.pii || '[]'),
  latency: JSON.parse(r.latency || '{}'),
  guardrails: !!r.guardrails,
  seeded: !!r.seeded,
});
