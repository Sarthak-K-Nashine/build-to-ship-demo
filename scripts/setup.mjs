// One-time setup: `npm run setup`. Safe to re-run; it never overwrites an existing .env.
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`\nNode ${process.versions.node} is too old. Install Node 22.13+ (the LTS version) from https://nodejs.org and run this again.\n`);
  process.exit(1);
}

const env = 'backend/.env';
if (existsSync(env)) {
  console.log(`- ${env} already exists, leaving it alone`);
} else {
  copyFileSync('backend/.env.example', env);
  const secret = randomBytes(32).toString('hex');
  writeFileSync(env, readFileSync(env, 'utf8').replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`));
  console.log(`- created ${env} with a random JWT_SECRET`);
}

for (const dir of ['backend', 'frontend']) {
  console.log(`- installing ${dir} dependencies...`);
  execSync('npm install --no-fund --no-audit', { cwd: dir, stdio: 'inherit' });
}

console.log(`
Done. Next:
  npm run dev        start the API (:8080) and the UI (:5173) together
  open http://localhost:5173 and click "Use the demo account"

Optional: add GEMINI_API_KEY to backend/.env for the AI inspector (free key: https://aistudio.google.com/apikey)
`);
