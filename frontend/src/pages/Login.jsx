import React, { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { Btn, Logo, Notice } from '../ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';

  async function submit(e, creds) {
    e?.preventDefault();
    const body = creds || { email, password };
    setBusy(true); setErr('');
    try {
      const r = await api.post(`/api/auth/${creds ? 'login' : mode}`, body);
      if (r.status >= 400) setErr(r.data?.details?.join(', ') || r.data?.error || 'Something went wrong. Please try again.');
      else login(r.data.token, body.email, remember);
    } catch { setErr('Cannot reach the server. Check that PromptShield is running.'); }
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex flex-col items-center text-center">
            <Logo size={44} />
            <h1 className="mt-5 text-2xl font-semibold tracking-[-0.01em] text-ink">{isLogin ? 'Sign in to PromptShield' : 'Create your account'}</h1>
            <p className="mt-1.5 text-sm text-mute">{isLogin ? 'Enter your details to open the console.' : 'Set up an account to test and monitor your guardrails.'}</p>
          </div>

          <div className="rounded-xl border border-line bg-white p-6 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_1px_2px_rgba(16,24,40,0.04)] sm:p-8">
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-body">Email</label>
                <input id="email" type="email" required autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
              </div>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-body">Password</label>
                <input id="password" type="password" required minLength={8} autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder={isLogin ? 'Enter your password' : 'At least 8 characters'} value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
              </div>
              {isLogin && (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-body">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-gray-300 accent-[#2557d6]" />
                  Keep me signed in
                </label>
              )}
              {err && <Notice tone="bad">{err}</Notice>}
              <Btn id="sign-in" type="submit" disabled={busy} busy={busy} className="w-full py-2.5">{isLogin ? 'Sign in' : 'Create account'}</Btn>
            </form>

            {isLogin && (
              <>
                <div className="my-6 flex items-center gap-3 text-xs text-faint"><span className="h-px flex-1 bg-line" />OR<span className="h-px flex-1 bg-line" /></div>
                <Btn id="demo-login" type="button" kind="secondary" disabled={busy} className="w-full py-2.5" onClick={(e) => submit(e, { email: 'demo@promptshield.dev', password: 'Demo@1234' })}>
                  Sign in with the demo account
                </Btn>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-mute">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button type="button" className="font-semibold text-brand hover:text-brand-dark" onClick={() => { setMode(isLogin ? 'register' : 'login'); setErr(''); }}>
              {isLogin ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </main>
      <footer className="pb-6 text-center text-xs text-faint">PromptShield runs on this computer. Prompts are only sent to Gemini when the AI inspector is enabled.</footer>
    </div>
  );
}
