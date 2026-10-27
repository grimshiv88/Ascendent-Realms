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

// The sign-in token: kept in this browser only when the player asks to stay signed in;
// otherwise it lasts until the tab is closed.
const token = {
  get() { try { return sessionStorage.getItem(TOKEN_KEY) || storage.get(TOKEN_KEY); } catch { return storage.get(TOKEN_KEY); } },
  set(value, remember) {
    this.remove();
    if (remember) storage.set(TOKEN_KEY, value);
    else { try { sessionStorage.setItem(TOKEN_KEY, value); } catch { storage.set(TOKEN_KEY, value); } }
  },
  remove() { storage.remove(TOKEN_KEY); try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* blocked */ } },
};

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const t = token.get();
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(path, { method, headers, body: body && JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

// ---------- private cloud saves ----------
// Inside the private preview page, accounts, characters and land are also kept in the page's own
// database, so they survive on any device the owner opens the game on. This browser keeps a copy
// and the database is brought up to date a few seconds after each change.
let cloud = null;
const cloudKey = (email) => email.toLowerCase().replace(/[^a-z0-9_.@+~:-]/g, '_');
const pushTimers = new Map();
const pushing = new Map();
const waiting = new Map(); // path -> latest body not yet sent
function cloudPush(path, body) {
  if (!cloud) return;
  waiting.set(path, JSON.parse(JSON.stringify(body)));
  clearTimeout(pushTimers.get(path));
  pushTimers.set(path, setTimeout(() => send(path), 2500));
}
async function send(path) {
  clearTimeout(pushTimers.get(path));
  // one write at a time to each document
  await pushing.get(path);
  const body = waiting.get(path);
  if (!body) return;
  waiting.delete(path);
  const p = cloud.doc(path).set(body).catch((e) => console.warn('Cloud save failed', e?.code || e));
  pushing.set(path, p);
}
// send everything at once when the page is being closed or hidden
const flush = () => { for (const path of [...waiting.keys()]) send(path); };
addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
// the newer copy of an account wins (characters carry savedAt; a new character beats none)
const stamp = (a) => a?.updatedAt || a?.character?.savedAt || 0;
async function cloudStart() {
  try {
    if (!window.claude?.use) return;
    const db = await Promise.race([window.claude.use('db'), new Promise((r) => setTimeout(() => r(null), 8000))]);
    if (!db) return;
    const [accSnap, landSnap] = await Promise.all([db.collection('accounts').get(), db.doc('world/lands').get()]);
    cloud = db;
    const local = preview.accounts();
    const merged = new Map(local.map((a) => [cloudKey(a.email), a]));
    for (const d of accSnap.docs) {
      const remote = d.data();
      const mine = merged.get(d.id);
      if (!mine || stamp(remote) > stamp(mine) || (remote.character && !mine.character)) merged.set(d.id, remote);
    }
    const list = [...merged.values()];
    storage.set('ar.preview.accounts', JSON.stringify(list));
    // accounts only on this device (made before the cloud) are copied up
    const remoteIds = new Set(accSnap.docs.map((d) => d.id));
    for (const a of list) {
      const k = cloudKey(a.email);
      const remote = accSnap.docs.find((d) => d.id === k)?.data();
      if (!remoteIds.has(k) || stamp(a) > stamp(remote)) await db.doc(`accounts/${k}`).set(JSON.parse(JSON.stringify(a))).catch(() => {});
    }
    const remotePlots = landSnap.exists ? landSnap.data().plots || [] : [];
    const plots = [...remotePlots];
    for (const p of previewLand.all()) if (!plots.some((q) => q.ix === p.ix && q.iz === p.iz)) plots.push(p);
    storage.set('ar.preview.lands', JSON.stringify(plots));
    if (plots.length !== remotePlots.length) await db.doc('world/lands').set({ plots }).catch(() => {});
  } catch (e) {
    console.warn('Cloud saves are off for this visit', e?.code || e);
    cloud = null;
  }
}
export const cloudSaves = () => !!cloud;

// Preview mode: the same rules as the server, stored in localStorage (and the cloud, when there is one).
const preview = {
  accounts() { try { return JSON.parse(storage.get('ar.preview.accounts')) || []; } catch { return []; } },
  save(list, changed) {
    if (changed) changed.updatedAt = Date.now();
    storage.set('ar.preview.accounts', JSON.stringify(list));
    if (changed) cloudPush(`accounts/${cloudKey(changed.email)}`, changed);
  },
  async signUp({ email, password, username, remember }) {
    email = email.trim(); username = username.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');
    if (password.length < 8) throw new Error('Your password needs at least 8 characters.');
    if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) throw new Error('Usernames are 3 to 16 letters, numbers or underscores.');
    const list = this.accounts();
    if (list.some((a) => a.email.toLowerCase() === email.toLowerCase())) throw new Error('An account with this email already exists. Try signing in.');
    if (list.some((a) => a.username.toLowerCase() === username.toLowerCase())) throw new Error('That username is taken. Please choose another.');
    const digest = await sha256(password);
    const acc = { email, username, digest, character: null };
    list.push(acc);
    this.save(list, acc);
    token.set(`preview:${email}`, remember);
    return { account: { email, username, character: null }, isNew: true };
  },
  async signIn({ email, password, remember }) {
    const digest = await sha256(password);
    const acc = this.accounts().find((a) => a.email.toLowerCase() === email.trim().toLowerCase() && a.digest === digest);
    if (!acc) throw new Error('That email and password don\'t match an account.');
    token.set(`preview:${acc.email}`, remember);
    return { account: { email: acc.email, username: acc.username, character: acc.character }, isNew: false };
  },
};

// Preview mode: find the signed-in preview account and change it in place
function updatePreviewAccount(change) {
  const email = (token.get() || '').replace(/^preview:/, '');
  const list = preview.accounts();
  const acc = list.find((a) => a.email === email);
  if (!acc) throw new Error('Please sign in again.');
  const result = change(acc);
  preview.save(list, acc);
  return result;
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

let previewMode = null;
let modeCheck = null;
export function isPreviewMode() {
  modeCheck ??= (async () => {
    try {
      const res = await fetch('api/health');
      const data = res.ok ? await res.json() : {};
      previewMode = !data.ok;
      if (data.now) setServerNow(data.now); // share the server's clock for day and night
    } catch {
      previewMode = true;
    }
    if (previewMode) await cloudStart();
    return previewMode;
  })();
  return modeCheck;
}

// Preview mode only: the accounts saved in this browser (without their scrambled passwords)
export function deviceAccounts() {
  if (previewMode !== true) return null;
  return preview.accounts().map(({ email, username, character: c }) => ({
    email, username, character: c && { name: c.name, race: c.race, cls: c.cls, level: c.level || 1, coins: c.coins || 0 },
  }));
}

// `remember` (the "Keep me signed in" box) decides whether this browser keeps the sign-in
export async function signUp({ remember, ...fields }) {
  if (await isPreviewMode()) return preview.signUp({ ...fields, remember });
  const data = await request('api/signup', { method: 'POST', body: fields });
  token.set(data.token, remember);
  return data;
}

export async function signIn({ remember, ...fields }) {
  if (await isPreviewMode()) return preview.signIn({ ...fields, remember });
  const data = await request('api/signin', { method: 'POST', body: fields });
  token.set(data.token, remember);
  return data;
}

// For now no old password is asked for; later this will need it, or a code sent by email
export async function changePassword(password) {
  if (password.length < 8) throw new Error('Your new password needs at least 8 characters.');
  if (await isPreviewMode()) {
    const digest = await sha256(password);
    return updatePreviewAccount((acc) => { acc.digest = digest; return { ok: true }; });
  }
  return request('api/password', { method: 'POST', body: { password } });
}

// The highest-level characters
export async function topPlayers() {
  if (await isPreviewMode()) {
    const list = preview.accounts().filter((a) => a.character).map(({ character: c }) => ({ name: c.name, race: c.race, cls: c.cls, side: c.side, level: c.level || 1, exp: c.exp || 0 }));
    return { players: list.sort((a, b) => b.level - a.level || b.exp - a.exp).slice(0, 10) };
  }
  return request('api/top');
}

// The account this browser is still signed in to, or null
export async function resume() {
  const t = token.get();
  if (!t) return null;
  if (await isPreviewMode()) {
    const acc = preview.accounts().find((a) => `preview:${a.email}` === t);
    return acc ? { account: { email: acc.email, username: acc.username, character: acc.character } } : null;
  }
  try {
    return await request('api/me');
  } catch {
    token.remove(); // the session ended on the server
    return null;
  }
}

export async function signOut() {
  if (!(await isPreviewMode())) await request('api/signout', { method: 'POST' }).catch(() => {});
  token.remove();
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
  save(list) { storage.set('ar.preview.lands', JSON.stringify(list)); cloudPush('world/lands', { plots: list }); },
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
