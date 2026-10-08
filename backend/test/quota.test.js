import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-quota-'));
process.env.DB_PATH = path.join(tmp, 'quota.db');
process.env.JWT_SECRET = 'unit-test-secret';
process.env.DOWNSTREAM_DAILY_LIMIT = '2'; 
process.env.GLOBAL_DAILY_REAL_MODEL_LIMIT = '3';
process.env.GEMINI_API_KEY = 'dummy-key';

let fail = 0;
const ok = (name, cond, extra = '') => { 
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${!cond && extra ? `  -> ${extra}` : ''}`); 
  if (!cond) fail++; 
};

// Mock fetch globally
const originalFetch = globalThis.fetch;
let fetchCount = 0;
globalThis.fetch = async (url, options) => {
  if (url.includes('generativelanguage.googleapis.com')) {
    fetchCount++;
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "hello from gemini" }] } }] })
    };
  }
  return originalFetch(url, options);
};

const { db, saveEvent, setPolicy, DEFAULT_POLICY } = await import('../src/db.js');
const { config } = await import('../src/config.js');
const { runPipeline } = await import('../src/pipeline/index.js');
const { auth } = await import('../src/auth.js');
const app = (await import('../src/routes.js')).default;
import express from 'express';

const PORT = 34569;
const testApp = express();
testApp.use(express.json());
testApp.use(app);
const expressServer = testApp.listen(PORT);

async function proxyRequest(userId, token, body) {
  const req = http.request(`http://localhost:${PORT}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  });
  req.write(JSON.stringify(body));
  req.end();
  return new Promise((resolve) => {
    req.on('response', (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    });
  });
}

const jwt = (await import('jsonwebtoken')).default;
const token1 = jwt.sign({ sub: 1, email: 'u1@test.com' }, process.env.JWT_SECRET);
const token2 = jwt.sign({ sub: 2, email: 'u2@test.com' }, process.env.JWT_SECRET);

async function main() {
  db.exec("INSERT OR IGNORE INTO users(id, email, password_hash) VALUES(1, 'u1@test.com', 'test')");
  db.exec("INSERT OR IGNORE INTO users(id, email, password_hash) VALUES(2, 'u2@test.com', 'test')");
  setPolicy(1, DEFAULT_POLICY);
  setPolicy(2, DEFAULT_POLICY);

  // Seeded demo events do not count
  db.prepare(`INSERT INTO events(user_id, guardrails, action, category, risk, source, reason, rules, pii, sanitized, latency, seeded, real_model) VALUES (1, 0, 'UNGUARDED', 'NONE', 0, 'none', 'test', '[]', '[]', 'test', '{}', 1, 1)`).run();

  // (1) a guardrails:false real call is saved with real_model=1;
  let res = await proxyRequest(1, token1, { prompt: 'test1', guardrails: false, targetModel: 'gemini-2-5-flash' });
  if (res.status !== 200) console.error('Error response:', res.data);
  ok('guardrails:false real call returns 200', res.status === 200);
  ok('response says UNGUARDED', res.data.action === 'UNGUARDED');
  ok('response has realModel true', res.data.llmMode === 'gemini');
  
  const event1 = db.prepare('SELECT * FROM events WHERE id=?').get(res.data.eventId);
  ok('guardrails:false real call is saved with real_model=1', event1 && event1.real_model === 1);

  // User 1 calls a second time
  res = await proxyRequest(1, token1, { prompt: 'test2', guardrails: false, targetModel: 'gemini-2-5-flash' });
  ok('second call succeeds', res.status === 200);

  // (2) after DOWNSTREAM_DAILY_LIMIT (2) such calls the next /api/chat call returns the simulated reply with the notice
  res = await proxyRequest(1, token1, { prompt: 'test3', guardrails: false, targetModel: 'gemini-2-5-flash' });
  ok('third call hits per-user quota and returns simulated model notice', res.data.llmMode === 'simulated' && res.data.response.includes('Daily real-model limit reached, using simulated model'));

  const event3 = db.prepare('SELECT * FROM events WHERE id=?').get(res.data.eventId);
  ok('simulated fallback call has real_model=0', event3 && event3.real_model === 0);

  // (3) the global cap applies across two different users
  // User 1 used 2 real calls. Global cap is 3.
  // User 2 should be able to make exactly 1 real call.
  res = await proxyRequest(2, token2, { prompt: 'u2-test1', guardrails: false, targetModel: 'gemini-2-5-flash' });
  ok('User 2 first call returns real gemini', res.data.llmMode === 'gemini');
  
  res = await proxyRequest(2, token2, { prompt: 'u2-test2', guardrails: false, targetModel: 'gemini-2-5-flash' });
  ok('User 2 second call hits global limit and returns simulated', res.data.llmMode === 'simulated' && res.data.response.includes('Daily real-model limit reached, using simulated model'));

  // Cleanup
  globalThis.fetch = originalFetch;
  expressServer.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
