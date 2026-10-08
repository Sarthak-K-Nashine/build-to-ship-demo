import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import authRouter from './auth.js';
import routes from './routes.js';
import { seedDemo } from './seed.js';

const app = express();
app.set('trust proxy', 1);
// CSP allows only this origin plus Google Fonts; recharts needs inline style attributes.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: null, // same-origin assets only; Render already serves HTTPS
    },
  },
}));
app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((s) => s.trim()), exposedHeaders: ['x-promptshield-event'] }));
app.use(express.json({ limit: '64kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60_000, limit: 40, standardHeaders: true, legacyHeaders: false }), authRouter);
app.use(routes);
app.use(['/api', '/v1'], (_q, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built React app from the same service (single-deploy option).
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/(?:api|v1)(?:\/|$)).*/, (_q, s) => s.sendFile(path.join(dist, 'index.html')));
}

// Express 5 forwards errors thrown in async handlers here, so one bad request can't crash the process.
app.use((err, _q, res, _n) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large' });
  console.error(err);
  res.status(500).json({ error: 'Internal error' });
});

await seedDemo();
const server = app.listen(config.port, () => console.log(`PromptShield on http://localhost:${config.port} | AI: ${config.geminiKey ? config.geminiModel : 'regex-only (set GEMINI_API_KEY)'}`));
const stop = () => server.close(() => process.exit(0));
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
