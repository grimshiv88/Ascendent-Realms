// Talks to the game server. If no server is reachable (for example, a static preview page),
// it falls back to a preview mode that keeps accounts in this browser only.
import { newCharacter } from './data/game-data.mjs';
import { setServerNow } from './data/clock.mjs';

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

// Preview mode: find the signed-in preview account and change it in place
function updatePreviewAccount(change) {
  const email = (storage.get(TOKEN_KEY) || '').replace(/^preview:/, '');
  const list = preview.accounts();
  const acc = list.find((a) => a.email === email);
  if (!acc) throw new Error('Please sign in again.');
  const result = change(acc);
  preview.save(list);
  return result;
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

let previewMode = null;
export async function isPreviewMode() {
  if (previewMode === null) {
    try {
      const res = await fetch('api/health');
      const data = res.ok ? await res.json() : {};
      previewMode = !data.ok;
      if (data.now) setServerNow(data.now); // share the server's clock for day and night
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

// The account this browser is still signed in to, or null
export async function resume() {
  const token = storage.get(TOKEN_KEY);
  if (!token) return null;
  if (await isPreviewMode()) {
    const acc = preview.accounts().find((a) => `preview:${a.email}` === token);
    return acc ? { account: { email: acc.email, username: acc.username, character: acc.character } } : null;
  }
  try {
    return await request('api/me');
  } catch {
    storage.remove(TOKEN_KEY); // the session ended on the server
    return null;
  }
}

export async function signOut() {
  if (!(await isPreviewMode())) await request('api/signout', { method: 'POST' }).catch(() => {});
  storage.remove(TOKEN_KEY);
}

export async function createCharacter(choice) {
  if (await isPreviewMode()) {
    return updatePreviewAccount((acc) => {
      if (acc.character) throw new Error('This account already has a character.');
      const result = newCharacter(acc.username, choice);
      if (result.error) throw new Error(result.error);
      acc.character = result.character;
      return result;
    });
  }
  return request('api/character', { method: 'POST', body: choice });
}

export async function saveLocation(loc) {
  if (await isPreviewMode()) {
    return updatePreviewAccount((acc) => {
      if (acc.character) acc.character.location = { ...acc.character.location, ...loc };
      return { ok: true };
    });
  }
  return request('api/character/location', { method: 'POST', body: loc });
}

export async function saveProgress(progress) {
  if (await isPreviewMode()) {
    return updatePreviewAccount((acc) => {
      if (acc.character) Object.assign(acc.character, progress);
      return { ok: true };
    });
  }
  return request('api/character/progress', { method: 'POST', body: progress });
}

// ---------- land ----------
// In preview mode the plots live in this browser; the rules are the same shared ones as the server's.
const previewLand = {
  all() { try { return JSON.parse(storage.get('ar.preview.lands')) || []; } catch { return []; } },
  save(list) { storage.set('ar.preview.lands', JSON.stringify(list)); },
  async run(fn) {
    const rules = await import('./data/land.mjs');
    return updatePreviewAccount((acc) => {
      const plots = this.all();
      const spend = (cost) => { if (acc.character.coins < cost) throw new Error(`You need ${cost} coins.`); acc.character.coins -= cost; };
      fn(plots, acc, spend, rules);
      this.save(plots);
      return { ok: true, coins: acc.character.coins, plots: plots.map((p) => ({ ...p, mine: p.owner === acc.character.name })) };
    });
  },
};

export async function landList() {
  if (await isPreviewMode()) return previewLand.run(() => {});
  return request('api/land');
}

export async function landBuy(ix, iz, purpose) {
  if (await isPreviewMode()) {
    return previewLand.run((plots, acc, spend, R) => {
      if (plots.some((p) => p.ix === ix && p.iz === iz)) throw new Error('Someone already owns this plot.');
      const why = R.whyNot(ix, iz);
      if (why) throw new Error(why);
      if (plots.filter((p) => p.owner === acc.character.name).length >= R.MAX_PLOTS) throw new Error(`You can own up to ${R.MAX_PLOTS} plots for now.`);
      spend(R.plotPrice(ix, iz));
      plots.push({ ix, iz, owner: acc.character.name, purpose, flat: null });
    });
  }
  return request('api/land/buy', { method: 'POST', body: { ix, iz, purpose } });
}

export async function landPurpose(ix, iz, purpose) {
  if (await isPreviewMode()) {
    return previewLand.run((plots, acc, spend, R) => {
      const p = plots.find((q) => q.ix === ix && q.iz === iz && q.owner === acc.character.name);
      if (!p) throw new Error('That is not your plot.');
      spend(R.PURPOSE_FEE);
      p.purpose = purpose;
    });
  }
  return request('api/land/purpose', { method: 'POST', body: { ix, iz, purpose } });
}

export async function landPrepare(ix, iz) {
  if (await isPreviewMode()) {
    return previewLand.run((plots, acc, spend, R) => {
      const p = plots.find((q) => q.ix === ix && q.iz === iz && q.owner === acc.character.name);
      if (!p) throw new Error('That is not your plot.');
      if (p.flat != null) throw new Error('This plot is already cleared and level.');
      spend(R.prepareCost(ix, iz, acc.character.cls));
      p.flat = R.levelHeight(ix, iz);
    });
  }
  return request('api/land/prepare', { method: 'POST', body: { ix, iz } });
}
