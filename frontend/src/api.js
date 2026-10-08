import axios from 'axios';

const base = import.meta.env.VITE_API_URL || '';
export const apiBase = base || window.location.origin;

/* Sign-in is kept for this browser tab only, unless "Keep me signed in" was ticked. */
const TOKEN = 'ps2_token';
const EMAIL = 'ps2_email';
export const session = {
  token: () => sessionStorage.getItem(TOKEN) || localStorage.getItem(TOKEN),
  email: () => sessionStorage.getItem(EMAIL) || localStorage.getItem(EMAIL) || '',
  save(token, email, remember) {
    const store = remember ? localStorage : sessionStorage;
    store.setItem(TOKEN, token);
    store.setItem(EMAIL, email);
  },
  clear() {
    for (const s of [localStorage, sessionStorage]) { s.removeItem(TOKEN); s.removeItem(EMAIL); }
    localStorage.removeItem('ps_token'); localStorage.removeItem('ps_email'); // keys from older versions
  },
};

export const api = axios.create({ baseURL: base, validateStatus: (s) => s < 500 });
api.interceptors.request.use((c) => {
  const t = session.token();
  if (t) c.headers.Authorization = 'Bearer ' + t;
  return c;
});
api.interceptors.response.use((r) => {
  if (r.status === 401 && !r.config.url.includes('/auth/')) {
    session.clear();
    window.location.href = '/login';
  }
  return r;
});

export async function download(path, filename) {
  const r = await api.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(r.data);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
