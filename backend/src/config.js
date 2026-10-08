import 'dotenv/config';
import crypto from 'node:crypto';

const isProd = process.env.NODE_ENV === 'production';

export function getLiveEnv(key) {
  const v = process.env[key] || '';
  if (!v || v.startsWith('your_') || v.includes('<')) return '';
  return v;
}

export const config = {
  isProd,
  port: Number(process.env.PORT) || 8080,
  jwtSecret:
    process.env.JWT_SECRET ||
    (() => {
      if (isProd) console.warn('[warn] JWT_SECRET not set: using an ephemeral secret (logins reset on restart).');
      return crypto.randomBytes(32).toString('hex');
    })(),
  geminiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS) || 8000,
  canary: process.env.CANARY_TOKEN || 'CNRY-' + crypto.randomBytes(6).toString('hex'),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  dbPath: process.env.DB_PATH || './data/promptshield.db',
  demoEmail: process.env.DEMO_EMAIL || 'demo@promptshield.dev',
  demoPassword: process.env.DEMO_PASSWORD || 'Demo@1234',
  get upstreamBaseUrl() { return getLiveEnv('UPSTREAM_BASE_URL'); },
  get upstreamApiKey() { return getLiveEnv('UPSTREAM_API_KEY'); },
  get webhookUrl() { return getLiveEnv('WEBHOOK_URL'); },
  get downstreamDailyLimit() { return Number(getLiveEnv('DOWNSTREAM_DAILY_LIMIT')) || 25; },
  get globalDailyRealModelLimit() { return Number(getLiveEnv('GLOBAL_DAILY_REAL_MODEL_LIMIT')) || 200; }
};
