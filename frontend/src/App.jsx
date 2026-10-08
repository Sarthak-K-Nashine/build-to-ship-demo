import React, { Suspense, createContext, lazy, useContext, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api, session } from './api.js';
import Login from './pages/Login.jsx';
import Sandbox from './pages/Sandbox.jsx';
import { Icon, Loading, Logo } from './ui.jsx';
import Cursor from './Cursor.jsx';
import { motion, AnimatePresence } from 'framer-motion';

// Loaded on first visit, so the charting library (recharts) is not in the initial bundle.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Logs = lazy(() => import('./pages/Logs.jsx'));
const Policy = lazy(() => import('./pages/Policy.jsx'));
const Benchmark = lazy(() => import('./pages/Benchmark.jsx'));
const Integrate = lazy(() => import('./pages/Integrate.jsx'));

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const NAV = [
  ['Testing', [['/', 'Sandbox', 'terminal'], ['/benchmark', 'Benchmark', 'target']]],
  ['Monitoring', [['/dashboard', 'Dashboard', 'chart'], ['/logs', 'Audit log', 'file']]],
  ['Configuration', [['/policy', 'Policy', 'sliders'], ['/integrate', 'Integrate', 'code']]],
];
const ALL = NAV.flatMap(([, items]) => items);

function Shell({ children }) {
  const { email, logout } = useAuth();
  const loc = useLocation();
  const [ai, setAi] = useState(null);
  useEffect(() => {
    api.get('/api/policy').then((r) => r.status === 200 && setAi(!!r.data.aiConfigured)).catch(() => {});
  }, []);
  const current = ALL.find(([to]) => (to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to)));

  const link = ({ isActive }) =>
    `flex items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-gray-100 text-ink' : 'text-body hover:bg-gray-50 hover:text-ink'}`;

  return (
    <div className="min-h-screen md:flex">
      <aside className="shrink-0 border-b border-line bg-white md:sticky md:top-0 md:flex md:h-screen md:w-64 md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-5 py-4 md:h-16">
          <div className="flex items-center gap-2.5">
            <Logo size={28} />
            <span className="text-[15px] font-semibold text-ink">PromptShield</span>
          </div>
          <button onClick={logout} className="text-sm font-medium text-mute hover:text-ink md:hidden">Sign out</button>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:gap-5 md:overflow-y-auto md:pt-2">
          {NAV.map(([group, items]) => (
            <div key={group} className="flex gap-1 md:flex-col">
              <div className="hidden px-2.5 pb-1 text-xs font-medium text-faint md:block">{group}</div>
              {items.map(([to, label, icon]) => (
                <NavLink key={to} to={to} end={to === '/'} className={link}>
                  {({ isActive }) => <><Icon name={icon} size={17} className={isActive ? 'text-brand' : 'text-faint'} />{label}</>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="hidden border-t border-line p-4 md:block">
          <div className="mb-3 rounded-lg border border-line bg-gray-50 px-3 py-2.5">
            <div className="text-xs font-medium text-mute">Gemini inspector</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[13px] font-medium text-ink">
              <span className={`h-2 w-2 rounded-full ${ai === null ? 'bg-gray-300' : ai ? 'bg-[#17b26a]' : 'bg-[#f79009]'}`} />
              {ai === null ? 'Checking…' : ai ? 'Connected' : 'Not configured'}
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-semibold uppercase text-brand">{(email || '?')[0]}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-ink">{email.split('@')[0]}</div>
              <div className="truncate text-xs text-mute">{email}</div>
            </div>
            <button onClick={logout} title="Sign out" aria-label="Sign out" className="rounded-md p-1.5 text-faint hover:bg-gray-100 hover:text-ink"><Icon name="logout" size={16} /></button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 hidden h-16 items-center justify-between border-b border-line bg-white/90 px-8 backdrop-blur md:flex">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
            <span className="text-mute">PromptShield</span>
            <span className="text-faint">/</span>
            <span className="font-medium text-ink">{current?.[1]}</span>
          </nav>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-gray-50 px-2.5 py-1 text-xs font-medium text-body">
            <span className="h-1.5 w-1.5 rounded-full bg-[#17b26a]" />Local environment
          </span>
        </header>
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={loc.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <Suspense fallback={<Loading />}>{children}</Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const nav = useNavigate();
  const [token, setToken] = useState(session.token());
  const [email, setEmail] = useState(session.email());
  const value = {
    token, email,
    login: (t, e, remember) => { session.save(t, e, remember); setToken(t); setEmail(e); },
    logout: () => { session.clear(); setToken(null); setEmail(''); nav('/login'); },
  };
  return (
    <AuthCtx.Provider value={value}>
      <Cursor />
      <Routes>
        <Route path="/login" element={token ? <Navigate to="/" /> : <Login />} />
        <Route path="/*" element={token ? (
          <Shell>
            <Routes>
              <Route index element={<Sandbox />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="logs" element={<Logs />} />
              <Route path="policy" element={<Policy />} />
              <Route path="benchmark" element={<Benchmark />} />
              <Route path="integrate" element={<Integrate />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Shell>
        ) : <Navigate to="/login" />} />
      </Routes>
    </AuthCtx.Provider>
  );
}
