// Talks to the game server. If no server is reachable (for example, a static preview page),
// it falls back to a preview mode that keeps accounts in this browser only.
import { newCharacter, fallenKeep, rebornWith } from './data/game-data.mjs';
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

// Not enough coins for something: the game shows "Insufficient funds" on screen
export const FUNDS_RE = /you need ([\d,]+) coins/i;
function poor(text) {
  const m = FUNDS_RE.exec(text);
  if (m) window.dispatchEvent(new CustomEvent('ar-no-funds', { detail: { need: Number(m[1].replace(/,/g, '')) } }));
  return new Error(text);
}
async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const t = token.get();
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(path, { method, headers, body: body && JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw poor(data.error || 'Something went wrong. Please try again.');
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
    const [accSnap, landSnap, caveSnap, kingSnap] = await Promise.all([db.collection('accounts').get(), db.doc('world/lands').get(), db.doc('world/caves').get(), db.doc('world/kings').get()]);
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
    const remoteCaves = caveSnap.exists ? caveSnap.data().caves || [] : [];
    const caves = [...remoteCaves];
    for (const c of previewCaves.all()) if (!caves.some((q) => q.cave === c.cave)) caves.push(c);
    storage.set('ar.preview.caves', JSON.stringify(caves));
    if (caves.length !== remoteCaves.length) await db.doc('world/caves').set({ caves }).catch(() => {});
    // the Monster Kings' courts: the one with the latest change to its throne wins
    const remoteCourts = kingSnap.exists ? kingSnap.data().courts || [] : [];
    const courts = new Map(previewKings.saved().map((c) => [c.race, c]));
    for (const c of remoteCourts) if (!courts.has(c.race) || (c.slainAt || 0) >= (courts.get(c.race).slainAt || 0)) courts.set(c.race, c);
    storage.set('ar.preview.kings', JSON.stringify([...courts.values()]));
  } catch (e) {
    console.warn('Cloud saves are off for this visit', e?.code || e);
    cloud = null;
  }
}
export const cloudSaves = () => !!cloud;

// Email is optional; an account made without one keeps this stand-in and shows it as blank
const NO_EMAIL = '@no-email.local';
const shownEmail = (email) => (email && email.endsWith(NO_EMAIL) ? '' : email);

// Preview mode: the same rules as the server, stored in localStorage (and the cloud, when there is one).
const preview = {
  accounts() { try { return JSON.parse(storage.get('ar.preview.accounts')) || []; } catch { return []; } },
  save(list, changed) {
    if (changed) changed.updatedAt = Date.now();
    storage.set('ar.preview.accounts', JSON.stringify(list));
    if (changed) cloudPush(`accounts/${cloudKey(changed.email)}`, changed);
  },
  async signUp({ email, password, username, remember }) {
    email = (email || '').trim(); username = username.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address, or leave it blank.');
    if (password.length < 8) throw new Error('Your password needs at least 8 characters.');
    if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) throw new Error('Usernames are 3 to 16 letters, numbers or underscores.');
    const list = this.accounts();
    if (list.some((a) => a.email.toLowerCase() === email.toLowerCase())) throw new Error('An account with this email already exists. Try signing in.');
    if (list.some((a) => a.username.toLowerCase() === username.toLowerCase())) throw new Error('That username is taken. Please choose another.');
    if (!email) email = `${username.toLowerCase()}${NO_EMAIL}`; // the same stand-in the server stores
    const digest = await sha256(password);
    const acc = { email, username, digest, character: null };
    list.push(acc);
    this.save(list, acc);
    token.set(`preview:${email}`, remember);
    return { account: { email: shownEmail(email), username, character: null }, isNew: true };
  },
  async signIn({ login, password, remember }) {
    const digest = await sha256(password);
    login = (login || '').trim().toLowerCase();
    const acc = this.accounts().find((a) => (a.email.toLowerCase() === login || a.username.toLowerCase() === login) && a.digest === digest);
    if (!acc) throw new Error('That username or email and password don\'t match an account.');
    token.set(`preview:${acc.email}`, remember);
    return { account: { email: shownEmail(acc.email), username: acc.username, character: acc.character }, isNew: false };
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
    email: shownEmail(email), username, character: c && { name: c.name, race: c.race, cls: c.cls, level: c.level || 1, coins: c.coins || 0 },
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
    return acc ? { account: { email: shownEmail(acc.email), username: acc.username, character: acc.character } } : null;
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
      if (acc.fallen) { rebornWith(result.character, acc.fallen); delete acc.fallen; }
      acc.character = result.character;
      return result;
    });
  }
  return request('api/character', { method: 'POST', body: choice });
}

// Death is final: the character is gone, and only their Unique Skill passes to the next one
export async function fall() {
  if (await isPreviewMode()) {
    return updatePreviewAccount((acc) => {
      if (!acc.character) return { error: 'No character yet.' };
      acc.fallen = fallenKeep(acc.character);
      acc.character = null;
      return { ok: true, kept: acc.fallen };
    });
  }
  return request('api/character/fall', { method: 'POST' });
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
      const spend = (cost) => { if (acc.character.coins < cost) throw poor(`You need ${cost} coins.`); acc.character.coins -= cost; };
      fn(plots, acc, spend, rules);
      this.save(plots);
      return { ok: true, coins: acc.character.coins, plots: plots.map((p) => ({ ...p, mine: p.owner === acc.character.name })) };
    });
  },
};

// ---------- caves you can buy once their boss is beaten ----------
const previewCaves = {
  all() { try { return JSON.parse(storage.get('ar.preview.caves')) || []; } catch { return []; } },
  save(list) { storage.set('ar.preview.caves', JSON.stringify(list)); cloudPush('world/caves', { caves: list }); },
};
const caveView = (list, name) => list.map((c) => ({ cave: c.cave, owner: c.owner, mine: c.owner === name }));
export async function caveList() {
  if (await isPreviewMode()) return updatePreviewAccount((acc) => ({ ok: true, caves: caveView(previewCaves.all(), acc.character.name) }));
  return request('api/caves');
}
export async function caveBuy(id) {
  if (await isPreviewMode()) {
    const R = await import('./data/depths.mjs');
    return updatePreviewAccount((acc) => {
      const list = previewCaves.all();
      const cave = R.caveById(id);
      if (!cave) throw new Error('There is no such cave.');
      if (list.some((c) => c.cave === id)) throw new Error('Someone already owns this cave.');
      if (!acc.character.caves?.[id]) throw new Error('Beat the boss in its depths first.');
      const price = R.cavePrice(cave);
      if (acc.character.coins < price) throw poor(`You need ${price} coins.`);
      acc.character.coins -= price;
      list.push({ cave: id, owner: acc.character.name });
      previewCaves.save(list);
      return { ok: true, coins: acc.character.coins, caves: caveView(list, acc.character.name) };
    });
  }
  return request('api/caves/buy', { method: 'POST', body: { cave: id } });
}

export async function landList() {
  if (await isPreviewMode()) return previewLand.run(() => {});
  return request('api/land');
}

// Buy several plots at once ([{ix, iz}]); `at` is where you stand (the server checks its own copy)
export async function landBuy(list, purpose, at) {
  if (await isPreviewMode()) {
    return previewLand.run((plots, acc, spend, R) => {
      const check = R.checkPurchase(list, {
        owned: new Set(plots.map((p) => `${p.ix},${p.iz}`)),
        mine: new Set(plots.filter((p) => p.owner === acc.character.name).map((p) => `${p.ix},${p.iz}`)),
        at,
      });
      if (check.error) throw new Error(check.error);
      spend(check.total);
      for (const p of list) plots.push({ ix: p.ix, iz: p.iz, owner: acc.character.name, purpose, flat: null });
    });
  }
  return request('api/land/buy', { method: 'POST', body: { plots: list, purpose } });
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

// how: 'clear' (trees, rocks and grass go; the ground keeps its shape) or 'flatten' (also levelled)
export async function landPrepare(ix, iz, how = 'flatten') {
  if (await isPreviewMode()) {
    return previewLand.run((plots, acc, spend, R) => {
      const p = plots.find((q) => q.ix === ix && q.iz === iz && q.owner === acc.character.name);
      if (!p) throw new Error('That is not your plot.');
      if (how === 'clear') {
        if (p.cleared || p.flat != null) throw new Error('This plot is already cleared.');
        spend(R.clearCost(acc.character.cls));
        p.cleared = true;
        return;
      }
      if (p.flat != null) throw new Error('This plot is already cleared and level.');
      spend(R.prepareCost(ix, iz, acc.character.cls));
      p.flat = R.levelHeight(ix, iz);
      p.cleared = true;
    });
  }
  return request('api/land/prepare', { method: 'POST', body: { ix, iz, how } });
}

// Build on your land: { add, remove } pieces, or { building: { type, x, z, r, how } }
export async function landBuild(body) {
  if (await isPreviewMode()) {
    const BM = await import('./data/building.mjs');
    return previewLand.run((plots, acc, spend) => {
      const mine = plots.filter((p) => p.owner === acc.character.name);
      for (const p of mine) p.pieces ||= [];
      const r = BM.applyBuild(mine, body, acc.character.cls, Date.now());
      if (r.error) throw new Error(r.error);
      spend(r.cost);
      for (const [k, pieces] of r.byPlot) mine.find((q) => `${q.ix},${q.iz}` === k).pieces = pieces;
    });
  }
  return request('api/land/build', { method: 'POST', body });
}

// ---------- the Monster Kings' courts ----------
const previewKings = {
  saved() { try { return JSON.parse(storage.get('ar.preview.kings')) || []; } catch { return []; } },
  async all() {
    const K = await import('./data/kings.mjs');
    const saved = this.saved();
    return Object.keys(K.CASTLES).map((race) => saved.find((c) => c.race === race) || K.startingCourt(race));
  },
  save(list) { storage.set('ar.preview.kings', JSON.stringify(list)); cloudPush('world/kings', { courts: list }); },
};
export async function kingsList() {
  if (await isPreviewMode()) {
    const K = await import('./data/kings.mjs');
    const courts = await previewKings.all();
    const settled = courts.map((c) => K.settleChallenge(c));
    if (settled.some((c, i) => c !== courts[i])) previewKings.save(settled);
    return { courts: settled };
  }
  return request('api/kings');
}
// Challenge the King of your race (an Overlord as strong as the King), or, as King, answer
export async function kingChallenge(race, answer = false) {
  if (await isPreviewMode()) {
    const K = await import('./data/kings.mjs');
    const { RACES } = await import('./data/game-data.mjs');
    const { courts } = await kingsList();
    return updatePreviewAccount((acc) => {
      const i = courts.findIndex((c) => c.race === race);
      if (i < 0) throw new Error('There is no such King.');
      const c = acc.character;
      if (answer) {
        if (courts[i].king.npc || courts[i].king.name !== c.name) throw new Error('Only the King can answer.');
        courts[i] = K.answerChallenge(courts[i]);
      } else {
        const bar = K.challengeBar(courts[i], { ...c, side: RACES[c.race]?.side });
        if (bar) throw new Error(bar);
        courts[i] = K.challenge(courts[i], c);
      }
      previewKings.save(courts);
      return { ok: true, courts };
    });
  }
  return request(`api/kings/${answer ? 'answer' : 'challenge'}`, { method: 'POST', body: { race } });
}
// You struck down the King of `race`
export async function kingSlain(race) {
  if (await isPreviewMode()) {
    const K = await import('./data/kings.mjs');
    const { RACES } = await import('./data/game-data.mjs');
    const courts = await previewKings.all();
    return updatePreviewAccount((acc) => {
      const i = courts.findIndex((c) => c.race === race);
      if (i < 0) throw new Error('There is no such King.');
      if (Date.now() - (courts[i].slainAt || 0) < K.KING_RETURNS_MS) throw new Error('The throne is already empty.');
      const c = acc.character;
      const r = K.afterKingSlain(courts[i], { name: c.name, race: c.race, level: c.level || 1, monster: RACES[c.race]?.side === 'monster' });
      courts[i] = r.court;
      previewKings.save(courts);
      return { ok: true, crowned: r.crowned, courts };
    });
  }
  return request('api/kings/slain', { method: 'POST', body: { race } });
}

// ---------- friends, chat and Status privacy ----------
// Preview mode keeps these in this browser (and the cloud, when there is one), between the
// accounts saved here: enough to try it out with two accounts on one device.
const previewSocial = {
  load() { try { return { friends: [], messages: [], ...JSON.parse(storage.get('ar.preview.social')) }; } catch { return { friends: [], messages: [] }; } },
  save(d) {
    d.messages = d.messages.slice(-400);
    storage.set('ar.preview.social', JSON.stringify(d));
    cloudPush('world/social', d);
  },
  // bring in what other devices wrote
  async sync() {
    if (!cloud) return;
    try {
      const snap = await cloud.doc('world/social').get();
      if (!snap.exists) return;
      const remote = snap.data(), d = this.load();
      const ids = new Set(d.messages.map((m) => m.id));
      for (const m of remote.messages || []) if (!ids.has(m.id)) d.messages.push(m);
      d.messages.sort((a, b) => a.at - b.at);
      d.messages.forEach((m, i) => { m.n = i + 1; });
      const links = new Map(d.friends.map((f) => [`${f.a}|${f.b}`, f]));
      for (const f of remote.friends || []) { const k = `${f.a}|${f.b}`; if (!links.has(k) || (f.t || 0) > (links.get(k).t || 0)) links.set(k, f); }
      d.friends = [...links.values()].filter((f) => !f.gone);
      // meeting rooms rented by anyone
      const rentals = new Map((d.rentals || []).map((r) => [r.id, r]));
      for (const r of remote.rentals || []) if (!rentals.has(r.id) || (r.t || 0) > (rentals.get(r.id).t || 0)) rentals.set(r.id, r);
      d.rentals = [...rentals.values()].filter((r) => r.until > Date.now() - 86400000);
      const bounties = new Map((d.bounties || []).map((b) => [b.id, b]));
      for (const b of remote.bounties || []) if (!bounties.has(b.id) || (b.t || 0) > (bounties.get(b.id).t || 0)) bounties.set(b.id, b);
      d.bounties = [...bounties.values()];
      // parties and guilds: the newest copy wins
      if (remote.groups && (remote.groups.t || 0) > (d.groups?.t || 0)) d.groups = remote.groups;
      // the cults and the Order: the newest copy wins
      if (remote.cults && (remote.cults.t || 0) > (d.cults?.t || 0)) d.cults = remote.cults;
      storage.set('ar.preview.social', JSON.stringify(d));
    } catch { /* stay with what this browser has */ }
  },
  me() { const email = (token.get() || '').replace(/^preview:/, ''); return preview.accounts().find((a) => a.email === email); },
  find(name) { return preview.accounts().find((a) => a.username.toLowerCase() === String(name || '').trim().toLowerCase()); },
  key(x, y) { const [a, b] = [x, y].map((n) => n.toLowerCase()).sort(); return { a, b }; },
  link(d, x, y) { const { a, b } = this.key(x, y); return d.friends.find((f) => f.a === a && f.b === b && !f.gone); },
  relation(d, me, other) {
    if (me.toLowerCase() === other.toLowerCase()) return 'self';
    const l = this.link(d, me, other);
    if (!l) return 'none';
    return l.accepted ? 'friend' : l.by === me.toLowerCase() ? 'sent' : 'received';
  },
  lists(d, me) {
    const out = { friends: [], received: [], sent: [] };
    for (const f of d.friends) {
      if (f.gone || (f.a !== me.toLowerCase() && f.b !== me.toLowerCase())) continue;
      const other = this.find(f.a === me.toLowerCase() ? f.b : f.a);
      if (!other) continue;
      const entry = { name: other.username, online: false };
      if (f.accepted) out.friends.push(entry); else (f.by === me.toLowerCase() ? out.sent : out.received).push(entry);
    }
    return out;
  },
};
const socialRules = () => import('./data/social.mjs');
function previewMe() { const me = previewSocial.me(); if (!me) throw new Error('Please sign in again.'); return me; }

export async function playerSearch(q) {
  if (await isPreviewMode()) {
    const me = previewMe(), d = previewSocial.load();
    q = String(q || '').trim().toLowerCase();
    if (q.length < 2) return { players: [] };
    return { players: preview.accounts().filter((a) => a.username.toLowerCase().startsWith(q) && a.username !== me.username).slice(0, 8)
      .map((a) => ({ name: a.username, relation: previewSocial.relation(d, me.username, a.username), online: false })) };
  }
  return request(`api/players?q=${encodeURIComponent(q)}`);
}
export async function playerProfile(name) {
  if (await isPreviewMode()) {
    const S = await socialRules();
    const me = previewMe(), other = previewSocial.find(name), d = previewSocial.load();
    if (!other) throw new Error('There is no player with that username.');
    const rel = previewSocial.relation(d, me.username, other.username);
    const c = other.character;
    const visible = !!c && S.canSeeStatus(c, { self: rel === 'self', friend: rel === 'friend' });
    const C = await import('./data/cults.mjs');
    return { player: { name: other.username, relation: rel, online: false, privacy: S.privacyOf(c), status: visible ? S.statusSummary(c) : null, cult: C.seenBy(d.cults || C.emptyCults(), me.username, other.username) } };
  }
  return request(`api/players/${encodeURIComponent(name)}`);
}
export async function socialPoll(after = 0) {
  if (await isPreviewMode()) {
    await previewSocial.sync();
    const me = previewMe(), d = previewSocial.load(), my = me.username.toLowerCase();
    const extra = new Map((await previewChannels(d, me.username)).map((x) => [x.channel, x.label]));
    const mine = d.messages.filter((m) => (m.channel === 'x' ? extra.has(m.key) : m.channel === 'general' || m.to === my || m.from.toLowerCase() === my));
    const list = after ? mine.filter((m) => m.n > after) : mine.slice(-40);
    return {
      messages: list.map((m) => ({ id: m.n, channel: m.channel === 'x' ? extra.get(m.key) : m.channel === 'general' ? 'general' : (m.from.toLowerCase() === my ? previewSocial.find(m.to)?.username : m.from), from: m.from, mine: m.from.toLowerCase() === my, text: m.text, at: m.at })),
      rooms: [...extra.values()],
      ...previewSocial.lists(d, me.username),
    };
  }
  return request(`api/social?after=${Number(after) || 0}`);
}
async function previewFriend(name, change) {
  const me = previewMe(), other = previewSocial.find(name), d = previewSocial.load();
  if (!other) throw new Error('There is no player with that username.');
  change(d, me.username, other.username, previewSocial.relation(d, me.username, other.username));
  previewSocial.save(d);
  return { ok: true, ...previewSocial.lists(d, me.username) };
}
export async function friendRequest(name) {
  if (await isPreviewMode()) {
    return previewFriend(name, (d, me, other, rel) => {
      if (rel === 'self') throw new Error("You can't add yourself.");
      if (rel === 'friend') throw new Error('You are already friends.');
      if (rel === 'sent') throw new Error('You already asked. Waiting for them to accept.');
      if (rel === 'received') { const l = previewSocial.link(d, me, other); l.accepted = true; l.t = Date.now(); return; }
      d.friends.push({ ...previewSocial.key(me, other), by: me.toLowerCase(), accepted: false, t: Date.now() });
    });
  }
  return request('api/friends/request', { method: 'POST', body: { name } });
}
export async function friendRespond(name, accept) {
  if (await isPreviewMode()) {
    return previewFriend(name, (d, me, other, rel) => {
      if (rel !== 'received') throw new Error('There is no friend request from that player.');
      const l = previewSocial.link(d, me, other);
      if (accept) l.accepted = true; else l.gone = true;
      l.t = Date.now();
    });
  }
  return request('api/friends/respond', { method: 'POST', body: { name, accept } });
}
export async function friendRemove(name) {
  if (await isPreviewMode()) {
    return previewFriend(name, (d, me, other) => { const l = previewSocial.link(d, me, other); if (l) { l.gone = true; l.t = Date.now(); } });
  }
  return request('api/friends/remove', { method: 'POST', body: { name } });
}
// Send to the general chat, or (with `to`) to a friend
export async function chatSend(text, to = null, after = 0) {
  if (await isPreviewMode()) {
    const S = await socialRules();
    const me = previewMe(), d = previewSocial.load();
    const clean = S.cleanText(text);
    if (!clean) throw new Error('Write something first.');
    const room = to && (await previewChannels(d, me.username)).find((x) => x.label === to);
    if (to && !room && previewSocial.relation(d, me.username, to) !== 'friend') throw new Error('You can only send private messages to friends.');
    // a cult member who gives the cult away in chat is stripped of its powers and money
    const C = await import('./data/cults.mjs');
    if (d.cults && C.givesAway(C.cultOf(d.cults, me.username), clean)) { C.strip(d.cults, me.username); d.cults.t = Date.now(); }
    // those who have had the cults' call can't speak of it
    const said = d.cults ? C.censor(d.cults, me.username, clean) : clean;
    const n = (d.messages.at(-1)?.n || 0) + 1;
    d.messages.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, n, channel: room ? 'x' : to ? 'dm' : 'general', key: room ? room.channel : undefined, to: to && !room ? to.toLowerCase() : null, from: me.username, text: said, at: Date.now() });
    previewSocial.save(d);
    return { ok: true, ...(await socialPoll(after)) };
  }
  return request('api/chat', { method: 'POST', body: { text, to, after } });
}
// the private chats besides friends: meeting rooms you may be in, your party and your guild
async function previewChannels(d, name) {
  const [R, G] = await Promise.all([import('./data/interiors.mjs'), import('./data/groups.mjs')]);
  const rooms = (d.rentals || []).filter((r) => r.until > Date.now() && R.mayEnter(r, name)).map((r) => ({ channel: `room:${r.id}`, label: `${R.roomById(r.room)?.name || 'Room'} (private)` }));
  return [...rooms, ...G.groupChannels(d.groups || G.emptyGroups(), name)];
}

// ---------- cults and the Order of the Dawn (see data/cults.mjs) ----------
async function previewWho(acc) {
  const { RACES } = await import('./data/game-data.mjs');
  const c = acc?.character;
  return c ? { name: acc.username, race: c.race, side: RACES[c.race]?.side, level: c.level || 1 } : null;
}
export async function cultsView() {
  if (await isPreviewMode()) {
    const C = await import('./data/cults.mjs');
    await previewSocial.sync();
    const w = await previewWho(previewMe());
    if (!w) throw new Error('No character yet.');
    const d = previewSocial.load();
    const s = d.cults || C.emptyCults();
    if (C.touch(s, w)) { s.t = Date.now(); d.cults = s; previewSocial.save(d); }
    return C.view(s, w);
  }
  return request('api/cults');
}
// body: { action: 'found'|'deed'|'answer'|'ask'|'give'|'done'|'ack', name, deed, choice, id, pick }
export async function cultAct(body) {
  if (await isPreviewMode()) {
    const C = await import('./data/cults.mjs');
    await previewSocial.sync();
    const d = previewSocial.load();
    const s = d.cults || C.emptyCults();
    const w = await previewWho(previewMe());
    if (!w) throw new Error('No character yet.');
    C.touch(s, w);
    let r;
    switch (body.action) {
      case 'found': r = C.found(s, w, body.name); break;
      case 'deed': r = C.deed(s, w, String(body.deed || '')); break;
      case 'answer': r = C.answer(s, w, ['dark', 'light', 'none'].includes(body.choice) ? body.choice : 'none'); break;
      case 'ask': r = C.askMission(s, w); break;
      case 'give': r = C.giveMission(s, w, String(body.name || ''), body.pick, (await previewWho(previewSocial.find(body.name)))?.level); break;
      case 'done': r = C.finishMission(s, w, Number(body.id)); break;
      case 'ack': r = C.ackStrip(s, w.name); break;
      default: throw new Error('Do what?');
    }
    if (r.error && body.action !== 'answer') throw new Error(r.error);
    s.t = Date.now();
    d.cults = s;
    if (r.error) { previewSocial.save(d); throw new Error(r.error); }
    previewSocial.save(d);
    return { ...r, ...C.view(s, w) };
  }
  return request('api/cults', { method: 'POST', body });
}

// ---------- parties and guilds ----------
async function previewTerritory(name) {
  const B = await import('./data/building.mjs');
  return B.largestTerritory(previewLand.all().filter((p) => p.owner === name));
}
async function previewGroupsView(d, name) {
  const G = await import('./data/groups.mjs');
  const info = (n) => { const c = previewSocial.find(n)?.character; return c ? { level: c.level, cls: c.cls } : null; };
  return { ...G.view(d.groups || G.emptyGroups(), name, info), territory: await previewTerritory(name) };
}
export async function groupsList() {
  if (await isPreviewMode()) {
    await previewSocial.sync();
    return previewGroupsView(previewSocial.load(), previewMe().username);
  }
  return request('api/groups');
}
// body: { action, kind, name, id, accept } (see data/groups.mjs)
export async function groupsAct(body) {
  if (await isPreviewMode()) {
    const G = await import('./data/groups.mjs');
    const me = previewMe(), d = previewSocial.load();
    d.groups ||= G.emptyGroups();
    const kind = body.kind === 'guild' ? 'guild' : 'party';
    let r, coins;
    if (body.action === 'invite') {
      const { RACES } = await import('./data/game-data.mjs');
      const t = previewSocial.find(body.name);
      r = G.invite(d.groups, me.username, kind, t?.username || null, Date.now(), t?.character ? RACES[t.character.race]?.side === 'monster' : null);
    }
    else if (body.action === 'respond') r = G.respond(d.groups, me.username, body.id, body.accept === true);
    else if (body.action === 'leave') r = G.leave(d.groups, me.username, kind);
    else if (['remove', 'lead', 'disband'].includes(body.action)) r = G.manage(d.groups, me.username, kind, body.action, body.name);
    else if (body.action === 'nation') r = G.foundNation(d.groups, me.username, body.name, await previewTerritory(me.username));
    else if (body.action === 'rename-nation') r = G.renameNation(d.groups, me.username, body.name);
    else if (body.action === 'found') {
      const c = me.character;
      if (!c || c.coins < G.GUILD_FEE) throw poor(`You need ${G.GUILD_FEE} coins to found a guild.`);
      const { RACES } = await import('./data/game-data.mjs');
      r = G.found(d.groups, me.username, body.name, c.level || 1, Date.now(), { dark: RACES[c.race]?.side === 'monster' });
      if (r.ok) coins = updatePreviewAccount((acc) => { acc.character.coins -= G.GUILD_FEE; return acc.character.coins; });
    } else r = { error: 'Do what?' };
    if (r.error) throw new Error(r.error);
    d.groups.t = Date.now();
    previewSocial.save(d);
    return { ok: true, ...(coins !== undefined ? { coins } : {}), ...(await previewGroupsView(d, me.username)) };
  }
  return request('api/groups', { method: 'POST', body });
}

// ---------- meeting rooms in the Main Guild Hall ----------
function roomView(rentals, name) {
  return import('./data/interiors.mjs').then((R) => ({
    rentals: rentals.filter((r) => r.until > Date.now()).map((r) => ({ id: r.id, room: r.room, renter: r.renter, until: r.until, mine: r.renter === name, allowed: R.mayEnter(r, name), guests: R.mayEnter(r, name) ? r.guests : [] })),
  }));
}
// The Bounty Board in the Guild Hall (see data/guildcard.mjs)
export async function bountiesList() {
  if (await isPreviewMode()) {
    const B = await import('./data/guildcard.mjs');
    await previewSocial.sync();
    return { board: B.boardView(previewSocial.load().bounties || [], Date.now(), previewMe().username) };
  }
  return request('api/bounties');
}
export async function bountyPost(target, prize) {
  if (await isPreviewMode()) {
    const B = await import('./data/guildcard.mjs');
    const me = previewMe(), d = previewSocial.load();
    const check = B.checkBounty({ target, prize }, me.username);
    if (check.error) throw new Error(check.error);
    const who = previewSocial.find(check.target)?.username;
    if (!who) throw new Error(`No player or monster is called ${check.target}.`);
    const cost = check.prize + check.fee;
    const coins = updatePreviewAccount((acc) => {
      if (acc.character.coins < cost) throw poor(`You need ${cost} coins: the ${check.prize} prize and a ${check.fee} fee.`);
      acc.character.coins -= cost;
      return acc.character.coins;
    });
    d.bounties = [...(d.bounties || []), { id: Date.now(), target: who, by: me.username, prize: check.prize, at: Date.now(), state: 'open', t: Date.now() }];
    previewSocial.save(d);
    return { ok: true, coins, board: B.boardView(d.bounties, Date.now(), me.username) };
  }
  return request('api/bounties', { method: 'POST', body: { target, prize } });
}

export async function roomsList() {
  if (await isPreviewMode()) {
    await previewSocial.sync();
    return roomView(previewSocial.load().rentals || [], previewMe().username);
  }
  return request('api/rooms');
}
export async function roomRent(room, minutes, guests) {
  if (await isPreviewMode()) {
    const R = await import('./data/interiors.mjs');
    const me = previewMe(), d = previewSocial.load();
    d.rentals = (d.rentals || []).filter((r) => r.until > Date.now() - 86400000);
    const G = await import('./data/groups.mjs');
    const check = R.checkRent({ room, minutes, guests }, d.rentals, Date.now(), { emperor: !!G.emperorTitle(d.groups || G.emptyGroups(), me.username) });
    if (check.error) throw new Error(check.error);
    const missing = check.guests.filter((g) => !previewSocial.find(g));
    if (missing.length) throw new Error(`No player is called ${missing.join(', ')}.`);
    const coins = updatePreviewAccount((acc) => {
      if (acc.character.coins < check.cost) throw poor(`You need ${check.cost} coins.`);
      acc.character.coins -= check.cost;
      return acc.character.coins;
    });
    d.rentals.push({ id: Date.now(), room, renter: me.username, guests: check.guests.filter((g) => g.toLowerCase() !== me.username.toLowerCase()), until: Date.now() + minutes * 60000, t: Date.now() });
    previewSocial.save(d);
    return { ok: true, coins, ...(await roomView(d.rentals, me.username)) };
  }
  return request('api/rooms/rent', { method: 'POST', body: { room, minutes, guests } });
}
export async function roomGuests(id, guests) {
  if (await isPreviewMode()) {
    const R = await import('./data/interiors.mjs');
    const me = previewMe(), d = previewSocial.load();
    const r = (d.rentals || []).find((x) => x.id === id && x.renter === me.username && x.until > Date.now());
    if (!r) throw new Error('You are not renting that room.');
    const clean = R.cleanGuests(guests);
    if (clean.error) throw new Error(clean.error);
    r.guests = clean;
    r.t = Date.now();
    previewSocial.save(d);
    return { ok: true, ...(await roomView(d.rentals, me.username)) };
  }
  return request('api/rooms/guests', { method: 'POST', body: { id, guests } });
}
export async function setPrivacy(privacy) {
  if (await isPreviewMode()) {
    return updatePreviewAccount((acc) => { acc.character.privacy = privacy; return { ok: true, privacy }; });
  }
  return request('api/privacy', { method: 'POST', body: { privacy } });
}
