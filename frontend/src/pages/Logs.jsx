import React, { useCallback, useEffect, useState } from 'react';
import { api, download } from '../api.js';
import { Badge, Btn, Icon, PageHeader, Risk, Tokens, catLabel } from '../ui.jsx';

const FILTERS = ['ALL', 'BLOCKED', 'REDACTED', 'ALLOWED', 'UNGUARDED'];
const fLabel = (f) => (f === 'ALL' ? 'All' : f === 'UNGUARDED' ? 'Unprotected' : f[0] + f.slice(1).toLowerCase());

const Field = ({ label, children }) => (
  <div>
    <dt className="mb-1.5 text-[13px] font-medium text-mute">{label}</dt>
    <dd>{children}</dd>
  </div>
);

export default function Logs() {
  const [filter, setFilter] = useState('ALL');
  const [data, setData] = useState({ total: 0, events: [] });
  const [open, setOpen] = useState(null);
  const [page, setPage] = useState(0);
  const per = 15;

  const load = useCallback(() => {
    api.get('/api/events', { params: { limit: per, offset: page * per, action: filter === 'ALL' ? undefined : filter } }).then((r) => setData(r.data));
  }, [filter, page]);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  const from = data.total === 0 ? 0 : page * per + 1;
  const to = Math.min(data.total, (page + 1) * per);

  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" description="Every decision with its reason. Raw prompts are never stored, only the version with personal data replaced by tokens."
        actions={<>
          <Btn kind="secondary" icon="download" onClick={() => download('/api/events/export?format=csv', 'promptshield-audit.csv')}>Export CSV</Btn>
          <Btn kind="secondary" icon="download" onClick={() => download('/api/events/export?format=json', 'promptshield-audit.json')}>Export JSON</Btn>
        </>} />

      <section className="overflow-hidden rounded-xl border border-line bg-black/40 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 px-5 py-3 bg-white/5">
          <div className="inline-flex overflow-hidden rounded-lg border border-line shadow-sm">
            {FILTERS.map((f, i) => (
              <button key={f} onClick={() => { setFilter(f); setPage(0); }}
                className={`px-3.5 py-1.5 text-[13px] font-medium transition-all ${i > 0 ? 'border-l border-line' : ''} ${filter === f ? 'bg-brand/20 text-brand font-bold' : 'bg-transparent text-body hover:bg-white/5 hover:text-ink'}`}>
                {fLabel(f)}
              </button>
            ))}
          </div>
          <span className="text-[13px] text-mute">{data.total.toLocaleString()} events</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-black/60 text-xs font-medium text-mute uppercase tracking-wider">
              <tr>{['Time (UTC)', 'Decision', 'Category', 'Risk', 'Stored prompt'].map((h) => <th key={h} className="whitespace-nowrap px-5 py-3.5 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.events.map((e) => (
                <tr key={e.id} onClick={() => setOpen(e)} className="cursor-pointer transition-colors hover:bg-white/5">
                  <td className="whitespace-nowrap px-5 py-4 text-[13px] tabular-nums text-body">
                    {e.created_at}
                    {e.seeded && <span className="ml-2 rounded border border-line bg-white/5 px-1.5 py-px text-[11px] font-medium text-mute">Sample</span>}
                  </td>
                  <td className="px-5 py-4"><Badge action={e.action} /></td>
                  <td className="whitespace-nowrap px-5 py-4 text-ink font-medium">{catLabel(e.category)}</td>
                  <td className="px-5 py-4"><Risk value={e.risk} /></td>
                  <td className="max-w-xs truncate px-5 py-4 text-[13px] text-mute">{e.sanitized}</td>
                </tr>
              ))}
              {data.events.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-mute">No events match this filter.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-line px-5 py-4 bg-black/20">
          <span className="text-[13px] text-mute">Showing {from}–{to} of {data.total.toLocaleString()}</span>
          <div className="flex gap-2">
            <Btn kind="secondary" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Btn>
            <Btn kind="secondary" size="sm" disabled={(page + 1) * per >= data.total} onClick={() => setPage(page + 1)}>Next</Btn>
          </div>
        </div>
      </section>

      {open && (
        <div className="fixed inset-0 z-30 flex justify-end bg-black/60 backdrop-blur-sm" onClick={() => setOpen(null)}>
          <aside role="dialog" aria-label="Event details" className="flex h-full w-full max-w-lg flex-col bg-[#050505] border-l border-line shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-line px-6 py-5 bg-white/5">
              <div>
                <h2 className="text-lg font-semibold text-ink">Event details</h2>
                <p className="mt-0.5 text-[13px] text-mute">ID {open.id} · {open.created_at} UTC</p>
              </div>
              <button onClick={() => setOpen(null)} aria-label="Close" className="rounded-md p-1.5 text-mute hover:bg-white/10 hover:text-ink transition-colors"><Icon name="x" size={18} /></button>
            </div>
            <dl className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <div className="grid grid-cols-3 gap-4">
                <Field label="Decision"><Badge action={open.action} /></Field>
                <Field label="Risk"><Risk value={open.risk} /></Field>
                <Field label="Decided by"><span className="text-sm text-ink">{open.source || 'n/a'}</span></Field>
              </div>
              <Field label="Category"><span className="text-sm font-medium text-ink">{catLabel(open.category)}</span></Field>
              <Field label="Reason"><p className="text-sm leading-relaxed text-body">{open.reason}</p></Field>
              {open.rules.length > 0 && (
                <Field label="Matched rules">
                  <ul className="divide-y divide-line rounded-lg border border-line bg-white/5">{open.rules.map((r) => (
                    <li key={r.id} className="px-3.5 py-3">
                      <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-ink">{r.label}</span><span className="text-xs text-mute">Weight {r.w}</span></div>
                      <div className="mt-1 text-[13px] text-mute">{r.explain}</div>
                    </li>
                  ))}</ul>
                </Field>
              )}
              {open.pii.length > 0 && (
                <Field label="Personal data masked">
                  <div className="flex flex-wrap gap-1.5">{open.pii.map((p) => <span key={p} className="rounded-md border border-line bg-white/5 px-2 py-0.5 text-xs font-medium text-body">{p}</span>)}</div>
                </Field>
              )}
              <Field label="Stored prompt"><div className="rounded-lg border border-line bg-black/40 px-3.5 py-3 shadow-inner"><Tokens text={open.sanitized || ''} /></div></Field>
              <Field label="Latency">
                <div className="grid grid-cols-4 divide-x divide-line rounded-lg border border-line bg-white/5">
                  {[['Guardrail', open.latency.guard], ['Regex', open.latency.regex], ['Gemini', open.latency.ai], ['Model', open.latency.llm]].map(([k, v]) => (
                    <div key={k} className="px-3 py-2.5"><div className="text-xs text-mute">{k}</div><div className="mt-0.5 text-sm font-medium tabular-nums text-ink">{v ?? 0} ms</div></div>
                  ))}
                </div>
              </Field>
            </dl>
          </aside>
        </div>
      )}
    </div>
  );
}
