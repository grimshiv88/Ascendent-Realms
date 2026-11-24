// The admin board: the game owner can see every account and character, set a new password for a
// player who forgot theirs, sign an account out everywhere, or delete it.
// Admins are the accounts whose emails are listed in the ADMIN_EMAILS setting (comma-separated).
// Passwords are stored hashed, so nobody (admins included) can read them; they can only be replaced.
const db = require('./db');
const mail = require('./mail');
const { checkBirthdate, ageOf } = require('../public/js/data/birthdate.mjs');
const { hashPassword, shownEmail } = require('./auth');

const adminEmails = () => (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
// (once emails can be sent, only after the admin has confirmed the email, so nobody else can sign up with it)
const isAdmin = (account) => !!account && adminEmails().includes(String(account.email).toLowerCase()) && (!!account.email_verified || !mail.ready());

async function accounts() {
  const rows = await db.all(`
    SELECT a.id, a.email, a.username, a.created_at, a.birthdate, c.data, c.updated_at,
      (SELECT COUNT(*)::int FROM sessions s WHERE s.account_id = a.id) AS sessions,
      (SELECT COUNT(*)::int FROM lands l WHERE l.account_id = a.id) AS plots
    FROM accounts a LEFT JOIN characters c ON c.account_id = a.id
    ORDER BY a.id DESC`);
  return {
    accounts: rows.map((r) => {
      const c = r.data ? JSON.parse(r.data) : null;
      return {
        id: r.id, email: shownEmail(r.email), username: r.username, birthdate: r.birthdate || null, age: ageOf(r.birthdate), createdAt: r.created_at, lastPlayed: r.updated_at,
        signedIn: r.sessions > 0, plots: r.plots, admin: adminEmails().includes(r.email.toLowerCase()),
        character: c && { name: c.name, race: c.race, cls: c.cls, form: c.form, level: c.level, coins: c.coins, exp: c.exp },
      };
    }),
  };
}

async function setPassword({ id, password }, me) {
  password = String(password || '');
  if (password.length < 8) return { error: 'The new password needs at least 8 characters.' };
  const row = await db.get('SELECT id, username FROM accounts WHERE id = ?', Number(id) || 0);
  if (!row) return { error: 'No such account.' };
  await db.run('UPDATE accounts SET password_hash = ? WHERE id = ?', hashPassword(password), row.id);
  await db.run('DELETE FROM sessions WHERE account_id = ?', row.id); // sign them out everywhere
  await log(me, 'new password', row.username);
  return { ok: true, target: row.id };
}

// a player's birth date was typed wrong: the admin can set it (players can't change it themselves)
async function setBirthdate({ id, birthdate }) {
  const born = checkBirthdate(birthdate);
  if (born.error) return born;
  const { changes } = await db.run('UPDATE accounts SET birthdate = ? WHERE id = ?', born.date, Number(id) || 0);
  return changes ? { ok: true } : { error: 'No such account.' };
}

async function signOutEverywhere({ id }) {
  await db.run('DELETE FROM sessions WHERE account_id = ?', Number(id) || 0);
  return { ok: true };
}

async function remove({ id }, me) {
  const row = await db.get('SELECT id, email, username FROM accounts WHERE id = ?', Number(id) || 0);
  if (!row) return { error: 'No such account.' };
  if (row.id === me.id) return { error: 'You can\'t delete your own admin account from here.' };
  // the account's sessions, character and land go with it
  // everything that belongs to the account is removed with it (ON DELETE CASCADE)
  await db.run('DELETE FROM accounts WHERE id = ?', row.id);
  await log(me, 'delete account', row.username || row.email);
  return { ok: true };
}


// ---------- the bigger admin board ----------
const characters = require('./characters');
const K = require('../public/js/data/kings.mjs');
const S = require('../public/js/data/social.mjs');
const B = require('../public/js/data/birth.mjs');
const { ITEMS } = require('../public/js/data/items.mjs');
const { PLACES, toWorld } = require('../public/js/data/world-layout.mjs');

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const int = (v, min, max) => { const n = num(v); return n !== null && Number.isInteger(n) && n >= min && n <= max ? n : null; };
const short = (v, n) => String(v ?? '').trim().slice(0, n);

// Every change made here is written down, so the owner can always see what was done and when
async function log(me, action, target, detail) {
  await db.run('INSERT INTO admin_log (at, admin, action, target, detail) VALUES (?, ?, ?, ?, ?)', Date.now(), me?.username || '?', action, target || null, detail || null);
}
const accountById = (id) => db.get('SELECT id, username, email FROM accounts WHERE id = ?', int(id, 1, 2e9) || 0);

// The numbers at the top of the board
async function stats() {
  const now = Date.now();
  const r = await db.get(`SELECT
      (SELECT COUNT(*)::int FROM accounts) AS accounts,
      (SELECT COUNT(*)::int FROM characters) AS characters,
      (SELECT COUNT(*)::int FROM accounts WHERE last_seen > ?) AS online,
      (SELECT COUNT(*)::int FROM characters WHERE updated_at > now() - interval '24 hours') AS today,
      (SELECT COUNT(*)::int FROM accounts WHERE banned_until = -1 OR banned_until > ?) AS banned,
      (SELECT COUNT(*)::int FROM reports WHERE NOT done) AS reports`, now - S.ONLINE_MS, now);
  return { stats: r };
}

// One player's full card: the account and everything about the character
async function player({ id }) {
  const a = await db.get(`SELECT a.id, a.username, a.email, a.created_at, a.last_seen, a.banned_until, a.ban_reason, a.muted_until, a.country, a.birthdate,
      c.data, c.updated_at,
      (SELECT COUNT(*)::int FROM lands l WHERE l.account_id = a.id) AS plots,
      (SELECT COUNT(*)::int FROM cave_owners v WHERE v.account_id = a.id) AS caves,
      (SELECT COUNT(*)::int FROM city_homes h WHERE h.account_id = a.id) AS homes
    FROM accounts a LEFT JOIN characters c ON c.account_id = a.id WHERE a.id = ?`, int(id, 1, 2e9) || 0);
  if (!a) return { error: 'No such account.' };
  const c = a.data ? JSON.parse(a.data) : null;
  const now = Date.now();
  return {
    player: {
      id: a.id, username: a.username, email: shownEmail(a.email), createdAt: a.created_at, lastPlayed: a.updated_at, country: a.country || null,
      online: now - (a.last_seen || 0) < S.ONLINE_MS,
      banned: a.banned_until === -1 || a.banned_until > now ? { until: a.banned_until, reason: a.ban_reason || '' } : null,
      muted: a.muted_until > now ? { until: a.muted_until } : null,
      owns: { plots: a.plots, caves: a.caves, homes: a.homes },
      character: c && {
        name: c.name, race: c.race, cls: c.cls, form: c.form, level: c.level, exp: c.exp, coins: c.coins, hp: c.hp, sp: c.sp,
        stats: c.stats, unspentPoints: c.unspentPoints, livesLeft: c.livesLeft, injury: c.injury || null, location: c.location || null,
        inventory: (c.inventory || []).map((s) => ({ ...s, name: ITEMS[s.id]?.name || s.id, icon: ITEMS[s.id]?.icon || '' })),
        equipped: c.equipped || {}, uniqueSkill: c.uniqueSkill || null, child: B.isChild(c) ? { age: Math.floor(B.ageOf(c) * 10) / 10 } : null,
      },
    },
  };
}

// What the board can give: every item, and every named place to send someone to
function catalogue() {
  return {
    items: Object.entries(ITEMS).map(([id, it]) => ({ id, name: it.name, icon: it.icon || '', kind: it.kind })).sort((x, y) => x.name.localeCompare(y.name)),
    places: PLACES.map((p) => ({ id: p.id, name: p.name, city: !!p.city })),
    races: Object.keys(K.CASTLES),
  };
}

// Change a character. The change is marked (adminRev), so a game that is open with the old copy
// reloads instead of saving over it.
async function editCharacter(id, fn) {
  const acc = await accountById(id);
  if (!acc) return { error: 'No such account.' };
  const c = await characters.load(acc.id);
  if (!c) return { error: 'This account has no character.' };
  const r = fn(c);
  if (r?.error) return r;
  c.adminRev = (c.adminRev || 0) + 1;
  await characters.store(acc.id, c);
  return { ok: true, acc, said: r?.said || '' };
}

// body: { id, coins, addCoins, level, exp, stat: {key, value}, points, addItem: {id, n}, removeItem: {index, n}, heal, lives }
async function edit(body, me) {
  const said = [];
  const r = await editCharacter(body.id, (c) => {
    if (body.coins != null) { const v = int(body.coins, 0, 1e12); if (v === null) return { error: 'Coins must be a whole number, 0 or more.' }; said.push(`coins ${c.coins} → ${v}`); c.coins = v; }
    if (body.addCoins != null) { const v = int(body.addCoins, -1e12, 1e12); if (v === null) return { error: 'Bad number of coins.' }; const to = Math.max(0, (c.coins || 0) + v); said.push(`coins ${c.coins} → ${to}`); c.coins = to; }
    if (body.level != null) { const v = int(body.level, 1, 10000); if (v === null) return { error: 'Level is 1 to 10000.' }; said.push(`level ${c.level} → ${v}`); c.level = v; c.exp = 0; }
    if (body.exp != null) { const v = int(body.exp, 0, 1e12); if (v === null) return { error: 'Bad EXP.' }; said.push(`EXP ${c.exp} → ${v}`); c.exp = v; }
    if (body.points != null) { const v = int(body.points, 0, 1e6); if (v === null) return { error: 'Bad Stat Points.' }; said.push(`unspent points ${c.unspentPoints || 0} → ${v}`); c.unspentPoints = v; }
    if (body.stat) {
      const k = String(body.stat.key || ''), v = int(body.stat.value, 0, 1e6);
      if (!c.stats || !(k in c.stats) || v === null) return { error: 'Choose a stat and a number.' };
      said.push(`${k} ${c.stats[k]} → ${v}`); c.stats[k] = v;
    }
    if (body.lives != null) { const v = int(body.lives, 1, 3); if (v === null) return { error: 'Lives are 1 to 3.' }; said.push(`lives ${c.livesLeft} → ${v}`); c.livesLeft = v; }
    if (body.heal) { c.injury = null; c.hp = Math.max(c.hp || 0, 1e6); c.fatigue = 0; said.push('healed (HP full, bones mended, rested)'); }
    if (body.addItem) {
      const n = int(body.addItem.n ?? 1, 1, 1e6);
      const it = ITEMS[body.addItem.id];
      if (!it || n === null) return { error: 'Choose an item and how many.' };
      c.inventory ||= [];
      const gear = it.kind === 'weapon' || it.kind === 'armour';
      if (gear) {
        if (c.inventory.length + n > 60) return { error: 'The bag would be over 60 slots.' };
        for (let i = 0; i < n; i++) c.inventory.push({ id: body.addItem.id, n: 1, uid: `g${Date.now().toString(36)}${i.toString(36)}${Math.random().toString(36).slice(2, 6)}` });
      } else {
        const stack = c.inventory.find((s) => s.id === body.addItem.id && !s.uid);
        if (stack) stack.n += n; else { if (c.inventory.length >= 60) return { error: 'The bag is full (60 slots).' }; c.inventory.push({ id: body.addItem.id, n }); }
      }
      said.push(`gave ${n} × ${it.name}`);
    }
    if (body.removeItem) {
      const i = int(body.removeItem.index, 0, 59);
      const s = i !== null && c.inventory?.[i];
      if (!s) return { error: 'That bag slot is empty.' };
      const n = Math.min(s.n, int(body.removeItem.n ?? s.n, 1, 1e6) || s.n);
      s.n -= n;
      if (s.n <= 0) {
        c.inventory.splice(i, 1);
        for (const [slot, uid] of Object.entries(c.equipped || {})) if (uid && uid === s.uid) c.equipped[slot] = null;
      }
      said.push(`took ${n} × ${ITEMS[s.id]?.name || s.id}`);
    }
    if (!said.length) return { error: 'Nothing to change.' };
    return { said: said.join(', ') };
  });
  if (r.error) return r;
  await log(me, 'edit', r.acc.username, r.said);
  return { ok: true, ...(await player({ id: r.acc.id })) };
}

// Send a character to a named place, or to exact map coordinates (metres)
async function move(body, me) {
  let to;
  if (body.place) {
    const p = PLACES.find((x) => x.id === body.place);
    if (!p) return { error: 'No such place.' };
    to = { area: p.name, ...toWorld(p.px, p.py) };
  } else {
    const x = num(body.x), z = num(body.z);
    if (x === null || z === null || Math.abs(x) > 1e6 || Math.abs(z) > 1e6) return { error: 'Type the X and Z where they should go.' };
    to = { area: short(body.area, 40) || 'Moved by an admin', x, z };
  }
  const r = await editCharacter(body.id, (c) => {
    c.location = { ...(c.location || {}), area: to.area, x: Math.round(to.x * 100) / 100, y: 0, z: Math.round(to.z * 100) / 100 };
    return { said: `to ${to.area} (${Math.round(to.x)}, ${Math.round(to.z)})` };
  });
  if (r.error) return r;
  await log(me, 'move', r.acc.username, r.said);
  return { ok: true, ...(await player({ id: r.acc.id })) };
}

// Ban for some days (or forever), with a reason the player is shown; signs them out everywhere
async function ban(body, me) {
  const acc = await accountById(body.id);
  if (!acc) return { error: 'No such account.' };
  if (acc.id === me.id) return { error: 'You can\'t ban yourself.' };
  if (body.lift) {
    await db.run('UPDATE accounts SET banned_until = 0, ban_reason = NULL WHERE id = ?', acc.id);
    await log(me, 'unban', acc.username);
    return { ok: true, ...(await player({ id: acc.id })) };
  }
  const days = body.forever ? -1 : int(body.days, 1, 3650);
  if (days === null) return { error: 'Choose how many days, or forever.' };
  const reason = short(body.reason, 200);
  if (!reason) return { error: 'Write the reason. The player will see it.' };
  const until = days === -1 ? -1 : Date.now() + days * 86400000;
  await db.run('UPDATE accounts SET banned_until = ?, ban_reason = ? WHERE id = ?', until, reason, acc.id);
  await db.run('DELETE FROM sessions WHERE account_id = ?', acc.id);
  await log(me, 'ban', acc.username, `${days === -1 ? 'forever' : `${days} day(s)`}: ${reason}`);
  return { ok: true, ...(await player({ id: acc.id })) };
}

async function mute(body, me) {
  const acc = await accountById(body.id);
  if (!acc) return { error: 'No such account.' };
  const minutes = body.lift ? 0 : int(body.minutes, 1, 525600);
  if (minutes === null) return { error: 'Choose for how long.' };
  await db.run('UPDATE accounts SET muted_until = ? WHERE id = ?', minutes ? Date.now() + minutes * 60000 : 0, acc.id);
  await log(me, minutes ? 'mute' : 'unmute', acc.username, minutes ? `${minutes} minute(s)` : '');
  return { ok: true, ...(await player({ id: acc.id })) };
}

// The general chat (and meeting-room chats), newest last. Private messages between friends stay private.
async function chat() {
  const rows = await db.all("SELECT id, channel, from_id, from_name, text, at FROM (SELECT * FROM chat WHERE channel NOT LIKE 'dm:%' ORDER BY id DESC LIMIT 150) AS recent ORDER BY id");
  return { messages: rows.map((r) => ({ id: r.id, channel: r.channel, fromId: r.from_id, from: r.from_name, text: r.text, at: r.at })) };
}
async function deleteMessage({ id }, me) {
  const m = await db.get('SELECT id, from_name, text FROM chat WHERE id = ?', int(id, 1, 2e9) || 0);
  if (!m) return { error: 'That message is gone already.' };
  await db.run('DELETE FROM chat WHERE id = ?', m.id);
  await log(me, 'delete message', m.from_name, m.text.slice(0, 120));
  return { ok: true, ...(await chat()) };
}

async function reports() {
  const rows = await db.all('SELECT r.*, a.id AS target_id FROM reports r LEFT JOIN accounts a ON lower(a.username) = lower(r.target) ORDER BY r.done, r.id DESC LIMIT 200');
  return { reports: rows.map((r) => ({ id: r.id, at: r.at, by: r.by_name, target: r.target, targetId: r.target_id, reason: r.reason, text: r.text, done: r.done })) };
}
async function closeReport({ id }, me) {
  const r = await db.get('SELECT id, target FROM reports WHERE id = ?', int(id, 1, 2e9) || 0);
  if (!r) return { error: 'No such report.' };
  await db.run('UPDATE reports SET done = true WHERE id = ?', r.id);
  await log(me, 'close report', r.target);
  return { ok: true, ...(await reports()) };
}

// A message shown across the top of everyone's screen for a while
async function announce(body, me) {
  if (body.clear) {
    await db.run("DELETE FROM world_state WHERE key = 'announcement'");
    await log(me, 'clear announcement');
    return { ok: true, announcement: null };
  }
  const text = short(body.text, 240);
  const minutes = int(body.minutes ?? 60, 1, 10080);
  if (!text || minutes === null) return { error: 'Write the message and for how long it shows.' };
  const a = { text, at: Date.now(), until: Date.now() + minutes * 60000 };
  await db.run("INSERT INTO world_state (key, data) VALUES ('announcement', ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data", JSON.stringify(a));
  await log(me, 'announce', null, `${text} (${minutes} min)`);
  return { ok: true, announcement: a };
}
async function announcement() {
  const r = await db.get("SELECT data FROM world_state WHERE key = 'announcement'");
  const a = r ? JSON.parse(r.data) : null;
  return a && a.until > Date.now() ? a : null;
}

// Who owns what: land plots (by owner), caves, city houses, and the Kings' thrones
async function world() {
  const plots = await db.all('SELECT l.account_id, a.username, l.owner, COUNT(*)::int AS n, MIN(l.ix) AS ix, MIN(l.iz) AS iz FROM lands l JOIN accounts a ON a.id = l.account_id GROUP BY l.account_id, a.username, l.owner ORDER BY n DESC');
  const caves = await db.all('SELECT v.cave, v.owner, a.username FROM cave_owners v JOIN accounts a ON a.id = v.account_id ORDER BY v.cave');
  const homes = await db.all('SELECT h.city, h.house, h.owner, a.username FROM city_homes h JOIN accounts a ON a.id = h.account_id ORDER BY h.city, h.house');
  const courts = [];
  for (const race of Object.keys(K.CASTLES)) {
    const row = await db.get('SELECT data FROM courts WHERE race = ?', race);
    const c = row ? JSON.parse(row.data) : K.startingCourt(race);
    courts.push({ race, king: c.king, slainAt: c.slainAt || 0, challenge: c.challenge && !c.challenge.settled ? c.challenge : null });
  }
  return { land: plots.map((p) => ({ username: p.username, owner: p.owner, plots: p.n })), caves, homes, courts, announcement: await announcement() };
}

// Take something back from a player: all their land, a cave, or a house
async function take(body, me) {
  if (body.kind === 'land') {
    const acc = await db.get('SELECT id, username FROM accounts WHERE lower(username) = lower(?)', short(body.username, 40));
    if (!acc) return { error: 'No such player.' };
    const { changes } = await db.run('DELETE FROM lands WHERE account_id = ?', acc.id);
    await log(me, 'take land', acc.username, `${changes} plot(s)`);
  } else if (body.kind === 'cave') {
    const { changes } = await db.run('DELETE FROM cave_owners WHERE cave = ?', short(body.cave, 40));
    if (!changes) return { error: 'Nobody owns that cave.' };
    await log(me, 'take cave', null, short(body.cave, 40));
  } else if (body.kind === 'home') {
    const { changes } = await db.run('DELETE FROM city_homes WHERE city = ? AND house = ?', short(body.city, 40), short(body.house, 40));
    if (!changes) return { error: 'Nobody owns that house.' };
    await log(me, 'take house', null, `${short(body.city, 40)} ${short(body.house, 40)}`);
  } else return { error: 'Take what?' };
  return { ok: true, ...(await world()) };
}

// Put a throne back to its starting King (the NPC)
async function resetKing({ race }, me) {
  if (!K.CASTLES[race]) return { error: 'There is no such King.' };
  await db.run('DELETE FROM courts WHERE race = ?', race);
  await log(me, 'reset throne', race);
  return { ok: true, ...(await world()) };
}

// Skip a child's years (4 to 7): they are made 7 at once, so the Ceremony comes as soon as they play
async function skipChildhood(body, me) {
  const r = await editCharacter(body.id, (c) => {
    if (!B.isChild(c)) return { error: 'This character is grown up already.' };
    c.child.bornPlay = (c.playMs || 0) - (B.CEREMONY_AGE - B.BORN_AGE) * B.YEAR_MS - 1000;
    return { said: 'childhood skipped (Ceremony next)' };
  });
  if (r.error) return r;
  await log(me, 'skip childhood', r.acc.username);
  return { ok: true, ...(await player({ id: r.acc.id })) };
}

// A player reports another player
async function report(acc, body) {
  const target = short(body.name, 40);
  const reason = short(body.reason, 40);
  if (!target || !reason) return { error: 'Choose who and why.' };
  if (target.toLowerCase() === String(acc.username).toLowerCase()) return { error: 'You can\'t report yourself.' };
  const t = await db.get('SELECT username FROM accounts WHERE lower(username) = lower(?)', target);
  if (!t) return { error: 'No such player.' };
  const recent = await db.get('SELECT COUNT(*)::int AS n FROM reports WHERE by_id = ? AND at > ?', acc.id, Date.now() - 3600000);
  if (recent.n >= 10) return { error: 'You have sent a lot of reports. Please wait a while.' };
  await db.run('INSERT INTO reports (at, by_id, by_name, target, reason, text) VALUES (?, ?, ?, ?, ?, ?)', Date.now(), acc.id, acc.username, t.username, reason, short(body.text, 500) || null);
  return { ok: true };
}

async function adminLog() {
  const rows = await db.all('SELECT * FROM admin_log ORDER BY id DESC LIMIT 300');
  return { log: rows.map((r) => ({ at: r.at, admin: r.admin, action: r.action, target: r.target, detail: r.detail })) };
}

module.exports = {
  isAdmin, accounts, setPassword, setBirthdate, signOutEverywhere, remove, log,
  stats, player, catalogue, edit, move, ban, mute, chat, deleteMessage, reports, closeReport, announce, announcement, world, take, resetKing, adminLog, skipChildhood, report,
};
