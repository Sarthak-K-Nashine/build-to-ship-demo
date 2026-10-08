import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ---------- icons (outline, 24px grid) ---------- */
const PATHS = {
  terminal: <><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></>,
  chart: <><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></>,
  sliders: <><path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3" /><path d="M14 2v4M8 10v4M16 18v4" /></>,
  target: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
  code: <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  play: <polygon points="6 3 20 12 6 21 6 3" />,
  key: <><circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6" /><path d="m15.5 7.5 3 3L22 7l-3-3" /></>,
  info: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>,
  alert: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
};
export const Icon = ({ name, size = 16, className = '', strokeWidth = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true">{PATHS[name]}</svg>
);

export function Logo({ size = 28 }) {
  return (
    <motion.svg whileHover={{ rotate: -10, scale: 1.05 }} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--color-brand)" className="opacity-20" />
      <motion.path 
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}
        d="M16 7l7 2.7v5.6c0 4.6-3 7.9-7 9.3-4-1.4-7-4.7-7-9.3V9.7z" 
        fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinejoin="round" 
      />
      <motion.path 
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, ease: "easeInOut", delay: 0.5, repeat: Infinity, repeatType: "reverse" }}
        d="M12.8 16l2.2 2.2 4.2-4.4" 
        fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
      />
    </motion.svg>
  );
}

/* ---------- status ---------- */
export const ACTION = {
  ALLOWED: ['Allowed', 'border-ok-line bg-ok-soft text-ok', 'bg-[#17b26a]'],
  REDACTED: ['Redacted', 'border-warn-line bg-warn-soft text-warn', 'bg-[#f79009]'],
  BLOCKED: ['Blocked', 'border-bad-line bg-bad-soft text-bad', 'bg-[#f04438]'],
  UNGUARDED: ['Unprotected', 'border-line bg-gray-50 text-body', 'bg-gray-400'],
};
export const Badge = ({ action }) => {
  const [label, cls, dot] = ACTION[action] || ACTION.UNGUARDED;
  return (
    <motion.span initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{label}
    </motion.span>
  );
};

export const Risk = ({ value = 0 }) => {
  const v = Math.min(100, Math.max(0, value));
  const c = v >= 60 ? 'bg-[#f04438]' : v >= 30 ? 'bg-[#f79009]' : 'bg-[#17b26a]';
  return (
    <span className="inline-flex items-center gap-2" title={`Risk score ${v} of 100`}>
      <span className="block h-1.5 w-12 overflow-hidden rounded-full bg-gray-100">
        <motion.span initial={{ width: 0 }} animate={{ width: `${Math.max(4, v)}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className={`block h-full rounded-full ${c}`} />
      </span>
      <span className="w-6 text-xs tabular-nums text-body">{v}</span>
    </span>
  );
};

/* ---------- layout ---------- */
export const PageHeader = ({ title, description, actions }) => (
  <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div className="min-w-0">
      <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">{title}</h1>
      {description && <p className="mt-1 max-w-2xl text-sm text-mute">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </motion.div>
);

export const Card = ({ title, description, right, children, className = '', pad = true, delay = 0 }) => (
  <motion.section 
    initial={{ y: 20, opacity: 0, scale: 0.98 }} 
    animate={{ y: 0, opacity: 1, scale: 1 }} 
    transition={{ delay, type: 'spring', stiffness: 200, damping: 20 }}
    whileHover={{ y: -4, boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.1)' }}
    className={`min-w-0 rounded-xl border border-line bg-black/40 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.3)] transition-all duration-300 ${className}`}>
    {(title || right) && (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 bg-white/5 rounded-t-xl">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-mute">{description}</p>}
        </div>
        {right}
      </div>
    )}
    <div className={pad ? 'p-5' : ''}>{children}</div>
  </motion.section>
);

export const Stat = ({ label, value, hint, dot, delay = 0 }) => (
  <motion.div 
    initial={{ scale: 0.9, opacity: 0, y: 10 }} 
    animate={{ scale: 1, opacity: 1, y: 0 }} 
    transition={{ delay, type: 'spring', stiffness: 300, damping: 25 }}
    whileHover={{ y: -4, scale: 1.02, boxShadow: '0 12px 30px -4px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255, 255, 255, 0.1)' }}
    className="rounded-xl border border-line bg-gradient-to-b from-white/5 to-black/40 backdrop-blur-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.3)] relative overflow-hidden group">
    <motion.div initial={false} animate={{ opacity: 0 }} whileHover={{ opacity: 1 }} className="absolute inset-0 bg-gradient-to-tr from-brand/10 to-transparent pointer-events-none transition-opacity duration-300" />
    <div className="relative z-10">
      <div className="flex items-center gap-2 text-[13px] font-medium text-mute">{dot && <span className={`h-2 w-2 rounded-full shadow-sm ${dot}`} />}{label}</div>
      <div className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.02em] tabular-nums text-ink group-hover:text-brand transition-colors">{value ?? '–'}</div>
      {hint && <div className="mt-1 text-xs text-mute/80">{hint}</div>}
    </div>
  </motion.div>
);

export const Btn = ({ kind = 'primary', size = 'md', className = '', busy = false, icon, children, ...p }) => (
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    {...p}
    className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2 text-sm'} ${
      kind === 'primary'
        ? 'bg-brand text-white shadow-[0_0_15px_rgba(37,87,214,0.5)] hover:shadow-[0_0_25px_rgba(37,87,214,0.8)] border border-brand/50 hover:bg-brand-dark'
        : 'border border-line bg-white/5 text-ink shadow-sm hover:bg-white/10 backdrop-blur-md hover:border-line/70'
    } ${className}`}
  >
    {busy ? <span className="spinner" /> : icon && <Icon name={icon} size={15} />}
    {children}
  </motion.button>
);

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6 py-4">
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] text-mute">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="switch mt-0.5" />
    </label>
  );
}

export const Loading = ({ label = 'Loading…' }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center gap-4 py-24 text-sm text-brand">
    <div className="relative flex h-12 w-12 items-center justify-center">
      <motion.span animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }} className="absolute inset-0 rounded-full border border-brand bg-brand/20 blur-sm" />
      <Logo size={36} />
    </div>
    <span className="font-mono text-mute">{label}</span>
  </motion.div>
);

export const Notice = ({ tone = 'info', children }) => {
  const t = { info: ['border-[#c7d7fe] bg-brand-soft text-[#1d3c8f]', 'info'], warn: ['border-warn-line bg-warn-soft text-warn', 'alert'], bad: ['border-bad-line bg-bad-soft text-bad', 'alert'] }[tone];
  return <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} role={tone === 'bad' ? 'alert' : undefined} className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px] ${t[0]}`}><Icon name={t[1]} size={16} className="mt-px" /><div>{children}</div></motion.div>;
};

export function Code({ children, lang = 'bash' }) {
  const [done, setDone] = useState(false);
  const copy = () => navigator.clipboard?.writeText(String(children)).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); });
  return (
    <motion.div whileHover={{ scale: 1.01 }} className="overflow-hidden rounded-lg border border-[#1e293b] bg-[#0f172a]">
      <div className="flex items-center justify-between border-b border-[#1e293b] px-4 py-2">
        <span className="text-xs font-medium text-slate-400">{lang}</span>
        <button onClick={copy} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white"><Icon name={done ? 'check' : 'copy'} size={13} />{done ? 'Copied' : 'Copy'}</button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-slate-200">{children}</pre>
    </motion.div>
  );
}

/* original prompt with detected PII spans highlighted */
export function Original({ text, spans = [] }) {
  const parts = [];
  let last = 0;
  [...spans].filter((s) => s.start != null).sort((a, b) => a.start - b.start).forEach((s, i) => {
    parts.push(text.slice(last, s.start));
    parts.push(<mark key={i} className="rounded bg-[#fef0c7] px-0.5 text-[#93370d]">{text.slice(s.start, s.end)}</mark>);
    last = s.end;
  });
  parts.push(text.slice(last));
  return <p className="whitespace-pre-wrap break-words font-mono text-[13px] leading-6 text-body">{parts}</p>;
}

/* text with [EMAIL_1]-style tokens highlighted */
export function Tokens({ text }) {
  const bits = text.split(/(\[[A-Z_]+_\d+\]|\[REDACTED_[A-Z_]+\])/g);
  return (
    <p className="whitespace-pre-wrap break-words font-mono text-[13px] leading-6 text-body">
      {bits.map((b, i) => (/^\[[A-Z_]+(_\d+)?\]$|^\[REDACTED/.test(b) ? <mark key={i} className="rounded bg-brand-soft px-1 text-brand">{b}</mark> : b))}
    </p>
  );
}

const DOT = { pass: 'bg-[#17b26a]', redact: 'bg-[#f79009]', flag: 'bg-[#f04438]', error: 'bg-[#f04438]', warn: 'bg-[#f04438]', skipped: 'bg-gray-300' };
/* every layer a request passes through, with its own latency */
export function Stages({ stages = [], latency }) {
  const max = Math.max(1, ...stages.map((s) => s.ms));
  return (
    <div>
      <ol className="divide-y divide-gray-100 rounded-lg border border-line">
        <AnimatePresence>
        {stages.map((s, i) => (
          <motion.li 
            key={i} 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1, duration: 0.3 }}
            className="flex items-start gap-3 px-3.5 py-2.5"
          >
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[s.status] || 'bg-gray-300'}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className={`text-[13px] ${s.status === 'skipped' ? 'text-faint' : 'font-medium text-ink'}`}>{s.name}</span>
                <span className="text-xs tabular-nums text-mute">{s.status === 'skipped' ? 'Skipped' : `${s.ms} ms`}</span>
              </div>
              {s.detail && <div className="text-xs text-mute">{s.detail}</div>}
              {s.status !== 'skipped' && <div className="mt-1.5 h-1 rounded-full bg-gray-100"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(2, (s.ms / max) * 100)}%` }} transition={{ duration: 0.5, delay: i * 0.1 }} className={`h-1 rounded-full ${DOT[s.status]}`} /></div>}
            </div>
          </motion.li>
        ))}
        </AnimatePresence>
      </ol>
      {latency && (
        <p className="mt-2.5 text-xs text-mute">
          Guardrail overhead <b className="font-semibold text-ink">{latency.guard} ms</b> · regex {latency.regex} ms{latency.ai ? ` · Gemini ${latency.ai} ms` : ''} · model {latency.llm} ms
        </p>
      )}
    </div>
  );
}

export const catLabel = (c) => (c || '').replace(/_/g, ' ').toLowerCase().replace(/^./, (x) => x.toUpperCase());
export const CAT_COLOR = { PROMPT_INJECTION: '#f04438', JAILBREAK: '#f79009', DATA_EXFILTRATION: '#7a5af8', TOXICITY: '#ee46bc', INSPECTOR_TAMPERING: '#0ba5ec', OUTPUT_LEAK: '#e62e05', INSPECTOR_ERROR: '#98a2b3', PII_LEAKAGE: '#eaaa08' };

/* shared recharts styling */
export const CHART = {
  tick: { fontSize: 12, fill: '#71717a' },
  grid: 'rgba(255, 255, 255, 0.05)',
  tooltip: {
    contentStyle: { background: 'rgba(5, 5, 5, 0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 12, fontSize: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', color: '#fff' },
    itemStyle: { color: '#e4e4e7' },
    labelStyle: { color: '#fff', fontWeight: 600, marginBottom: 4 },
    cursor: { fill: 'rgba(255, 255, 255, 0.03)' },
  },
  legend: { wrapperStyle: { fontSize: 12, color: '#a1a1aa', paddingTop: 16 }, iconType: 'circle', iconSize: 8 },
};
