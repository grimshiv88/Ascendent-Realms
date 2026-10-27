// Talks to the game server. If no server is reachable (for example, a static preview page),
// it falls back to a preview mode that keeps accounts in this browser only.
const TOKEN_KEY = 'ar.token';

const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage blocked */ } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* storage blocked */ } },
};

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = storage.get(TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { method, headers, body: body && JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

// Preview mode: the same rules as the server, stored in localStorage.
const preview = {
  accounts() { try { return JSON.parse(storage.get('ar.preview.accounts')) || []; } catch { return []; } },
  save(list) { storage.set('ar.preview.accounts', JSON.stringify(list)); },
  async signUp({ email, password, username }) {
    email = email.trim(); username = username.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');
    if (password.length < 8) throw new Error('Your password needs at least 8 characters.');
    if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) throw new Error('Usernames are 3 to 16 letters, numbers or underscores.');
    const list = this.accounts();
    if (list.some((a) => a.email.toLowerCase() === email.toLowerCase())) throw new Error('An account with this email already exists. Try signing in.');
    if (list.some((a) => a.username.toLowerCase() === username.toLowerCase())) throw new Error('That username is taken. Please choose another.');
    const digest = await sha256(password);
    list.push({ email, username, digest, character: null });
    this.save(list);
    storage.set(TOKEN_KEY, `preview:${email}`);
    return { account: { email, username, character: null }, isNew: true };
  },
  async signIn({ email, password }) {
    const digest = await sha256(password);
    const acc = this.accounts().find((a) => a.email.toLowerCase() === email.trim().toLowerCase() && a.digest === digest);
    if (!acc) throw new Error('That email and password don\'t match an account.');
    storage.set(TOKEN_KEY, `preview:${acc.email}`);
    return { account: { email: acc.email, username: acc.username, character: acc.character }, isNew: false };
  },
};

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

let previewMode = null;
export async function isPreviewMode() {
  if (previewMode === null) {
    try {
      const res = await fetch('api/health');
      previewMode = !res.ok || !(await res.json()).ok;
    } catch {
      previewMode = true;
    }
  }
  return previewMode;
}

export async function signUp(fields) {
  if (await isPreviewMode()) return preview.signUp(fields);
  const data = await request('api/signup', { method: 'POST', body: fields });
  storage.set(TOKEN_KEY, data.token);
  return data;
}

export async function signIn(fields) {
  if (await isPreviewMode()) return preview.signIn(fields);
  const data = await request('api/signin', { method: 'POST', body: fields });
  storage.set(TOKEN_KEY, data.token);
  return data;
}

export async function signOut() {
  if (!(await isPreviewMode())) await request('api/signout', { method: 'POST' }).catch(() => {});
  storage.remove(TOKEN_KEY);
}
