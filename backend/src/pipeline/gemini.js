import { config } from '../config.js';

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Minimal Gemini REST client. The API key only ever lives in backend env vars.
// One retry on rate-limit / server errors, inside the same overall time budget.
export async function geminiGenerate({ system, user, schema, timeoutMs = 15000, temperature = 0.2 }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent`;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { temperature, ...(schema ? { responseMimeType: 'application/json', responseSchema: schema } : {}) },
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    for (let attempt = 0; ; attempt++) {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': config.geminiKey },
        body,
        signal: ctrl.signal,
      });
      if (!r.ok) {
        if (attempt === 0 && RETRYABLE.has(r.status)) { await sleep(400); continue; }
        throw new Error(`Gemini HTTP ${r.status}${r.status === 404 ? ` (is GEMINI_MODEL "${config.geminiModel}" available to your key?)` : ''}`);
      }
      const j = await r.json();
      const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
      if (!text) throw new Error('Empty Gemini response (possibly safety-filtered)');
      return text;
    }
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? `Gemini timeout after ${timeoutMs}ms` : e.message);
  } finally {
    clearTimeout(timer);
  }
}
