// `npm run dev`: runs the backend and the Vite dev server together; Ctrl+C stops both.
// Node is spawned directly (not through npm) so stopping this script reliably stops both servers.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

if (!existsSync('frontend/node_modules/vite/bin/vite.js') || !existsSync('backend/node_modules')) {
  console.error('Dependencies are missing. Run `npm run setup` first.');
  process.exit(1);
}

const procs = [
  ['api', '\x1b[36m', ['--disable-warning=ExperimentalWarning', '--watch', 'src/index.js'], 'backend'],
  ['web', '\x1b[35m', ['node_modules/vite/bin/vite.js'], 'frontend'],
].map(([name, color, args, cwd]) => {
  const p = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  const tag = `${color}[${name}]\x1b[0m `;
  const pipe = (stream, out) => {
    let buf = '';
    stream.on('data', (d) => {
      buf += d;
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const l of lines) out.write(tag + l + '\n');
    });
  };
  pipe(p.stdout, process.stdout);
  pipe(p.stderr, process.stderr);
  p.on('exit', (code) => {
    if (!stopping) { console.log(`${tag}exited with code ${code}, stopping the other one`); stop(code ?? 1); }
  });
  return p;
});

let stopping = false;
function stop(code = 0) {
  stopping = true;
  for (const p of procs) if (p.exitCode === null) p.kill();
  setTimeout(() => process.exit(code), 500);
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
