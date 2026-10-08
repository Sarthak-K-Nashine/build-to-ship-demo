// Used by the double-click launchers ("Start PromptShield ...").
// 1. creates backend/.env with a random secret on first run
// 2. starts the server (unless it is already running)
// 3. opens the browser at http://localhost:<PORT>
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = path.join(root, 'backend');
const say = (s = '') => console.log('  ' + s);
const win = process.platform === 'win32';

if (!existsSync(path.join(backend, 'node_modules')) || !existsSync(path.join(root, 'frontend', 'dist', 'index.html'))) {
  say('Some files are missing. Unzip the whole zip file first, then start PromptShield from the unzipped folder.');
  process.exit(1);
}

// 1. first-run config
const env = path.join(backend, '.env');
if (!existsSync(env)) {
  copyFileSync(path.join(backend, '.env.example'), env);
  writeFileSync(env, readFileSync(env, 'utf8').replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${randomBytes(32).toString('hex')}`));
}
process.chdir(backend); // .env and the data folder are relative to backend/

const port = Number((readFileSync(env, 'utf8').match(/^PORT=(\d+)/m) || [])[1]) || 8080;
const url = `http://localhost:${port}`;

const openBrowser = () => {
  const [cmd, args] = win ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  execFile(cmd, args, () => {}); // if it fails, the URL is printed anyway
};

const isRunning = async () => {
  try { const r = await fetch(`${url}/health`); return r.ok && (await r.json()).ok === true; } catch { return false; }
};
const portBusy = () => new Promise((resolve) => {
  const s = net.createServer().once('error', () => resolve(true)).once('listening', () => s.close(() => resolve(false)));
  s.listen(port);
});

if (await isRunning()) {
  say(`PromptShield is already running. Opening ${url}`);
  openBrowser();
  setTimeout(() => process.exit(0), 1500);
} else if (await portBusy()) {
  say(`Another program is already using port ${port}.`);
  say(`Close it, or open the file backend${path.sep}.env in ${win ? 'Notepad' : 'TextEdit'},`);
  say(`change PORT=${port} to PORT=8090, save, and start again.`);
  process.exit(1);
} else {
  // 2. start the server in this process
  await import(new URL('../backend/src/index.js', import.meta.url));
  for (let i = 0; i < 40 && !(await isRunning()); i++) await new Promise((r) => setTimeout(r, 250));
  console.log('');
  say('================================================================');
  say(` PromptShield is running:  ${url}`);
  say(' Log in with the "Use the demo account" button.');
  say(' Keep this window open while you use it. Close it to stop.');
  say('================================================================');
  console.log('');
  openBrowser();
}
