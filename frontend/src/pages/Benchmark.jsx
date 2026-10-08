import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Badge, Btn, Card, Notice, PageHeader, Stat } from '../ui.jsx';

export default function Benchmark() {
  const [b, setB] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { api.get('/api/benchmark/latest').then((r) => setB(r.data)); }, []);
  async function run() {
    setBusy(true); setErr('');
    const r = await api.post('/api/benchmark');
    if (r.status === 200) setB(r.data); else setErr(r.data?.error || 'Benchmark failed. Wait a minute and retry.');
    setBusy(false);
  }
  const missed = b ? b.results.filter((r) => !r.pass) : [];
  return (
    <div className="space-y-6">
      <PageHeader title="Benchmark"
        description="Runs a built-in set of attacks, normal prompts and prompts containing personal data against your current policy. The set is small, so use it as a regression check rather than a certification."
        actions={<Btn id="run-benchmark" onClick={run} disabled={busy} busy={busy} icon="play">{busy ? 'Running…' : 'Run benchmark'}</Btn>} />
      {err && <Notice tone="bad">{err}</Notice>}
      {!b ? (
        <div className="rounded-xl border border-dashed border-[#d0d5dd] bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-ink">No benchmark run yet</p>
          <p className="mt-1 text-sm text-mute">Click “Run benchmark” to test your policy.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Attacks blocked" value={`${b.detectionRate}%`} dot="bg-[#17b26a]" hint={`${b.counts.attacks} attack prompts`} />
            <Stat label="False positives" value={`${b.falsePositiveRate}%`} dot={b.falsePositiveRate > 0 ? 'bg-[#f04438]' : 'bg-[#17b26a]'} hint={`${b.counts.benign} normal prompts`} />
            <Stat label="PII redacted" value={`${b.piiRedactionRate}%`} dot="bg-[#17b26a]" hint={`${b.counts.pii} prompts with personal data`} />
            <Stat label="Latency p50 / p95" value={`${b.latency.p50} / ${b.latency.p95} ms`} hint={b.aiEnabled ? `Gemini path avg ${b.latency.aiPathAvg} ms (${b.latency.aiCalls} calls)` : 'Regex-only run'} />
          </div>
          {!b.aiEnabled && <Notice tone="warn">This run used regex only. Semantic attacks such as roleplay jailbreaks need the Gemini inspector, so detection will be higher with a key configured.</Notice>}
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <Card title="Results by attack type">
              <ul className="space-y-4">{b.kinds.map((k) => {
                const pct = Math.round((k.passed / k.total) * 100);
                return (
                  <li key={k.kind}>
                    <div className="mb-1.5 flex justify-between text-sm"><span className="text-ink">{k.kind}</span><span className="tabular-nums text-mute">{k.passed} of {k.total}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${pct === 100 ? 'bg-[#17b26a]' : 'bg-[#f79009]'}`} style={{ width: `${pct}%` }} /></div>
                  </li>
                );
              })}</ul>
            </Card>
            <Card title="Missed cases" right={<span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-body">{missed.length}</span>}>
              {missed.length === 0 ? <p className="text-sm text-mute">Every case behaved as expected.</p> : (
                <ul className="divide-y divide-line">{missed.map((r, i) => (
                  <li key={i} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2"><Badge action={r.action} /><span className="text-xs text-mute">Expected {r.expect.toLowerCase()} · risk {r.risk}</span></div>
                    <p className="mt-1.5 break-words font-mono text-[12.5px] text-body">{r.prompt}</p>
                  </li>))}</ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
