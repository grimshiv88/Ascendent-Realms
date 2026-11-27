// What the realm's keepers send into a player's game while it is open, without a reload (the game
// hears about it on its chat check every few seconds, GET /api/social):
//   - gifts: a pet, an animal or any item, with a note. A wrapped Gift lands in the bag with a
//     pop-up; the player opens it from the bag. A player who is away gets it when they come back.
//   - orders for a player's pets: call it to them, send it home, or take it away
// and, for everyone, the monster attacks on the towns (see data/raids.mjs) and the great beasts
// brought back to life.
const db = require('./db');
const { ITEMS } = require('../public/js/data/items.mjs');
const { MOUNT_ITEMS } = require('../public/js/data/mounts.mjs');
const { PLACES } = require('../public/js/data/world-layout.mjs');
const { BEASTS } = require('../public/js/data/beasts.mjs');
const R = require('../public/js/data/raids.mjs');

const int = (v, min, max) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : null; };
const short = (v, n) => String(v ?? '').trim().slice(0, n);
const MAX_WAITING = 30; // gifts a player can have waiting at once
const MAX_IN_GIFT = 10;  // different things in one gift
// what is inside a gift: [{ item, n }] (a gift from before several things could go in one has item and n)
const contents = (d) => (Array.isArray(d.items) && d.items.length ? d.items : [{ item: d.item, n: d.n }]);
// items that can't be sent as a gift
const giftable = (id) => !!ITEMS[id] && ITEMS[id].kind !== 'gift';
const PET_ACTIONS = { call: 'call it to them', home: 'send it home', take: 'take it away' };

// ---------- gifts and pet orders (the deliveries table) ----------
// GET /api/social carries these: the gifts not yet opened, and the pet orders not yet carried out
async function waiting(accountId) {
  const rows = await db.all('SELECT id, kind, data, at, seen_at FROM deliveries WHERE account_id = ? AND done_at IS NULL ORDER BY id LIMIT 40', accountId);
  return rows.map((r) => {
    const d = JSON.parse(r.data);
    return r.kind === 'gift'
      ? { id: r.id, kind: 'gift', at: Number(r.at), seen: !!r.seen_at, from: d.from, note: d.note }
      : { id: r.id, kind: 'pet', at: Number(r.at), action: d.action, item: d.item };
  });
}

// POST /api/gifts { id, act: 'seen' | 'open' | 'done' }
//   seen: the pop-up was shown; open: unwrap a gift (gives what is inside); done: a pet order was carried out
async function act(accountId, body = {}) {
  const id = int(body.id, 1, 2e9);
  const row = id && await db.get('SELECT id, kind, data, done_at FROM deliveries WHERE id = ? AND account_id = ?', id, accountId);
  if (!row) return { error: 'No such gift.' };
  const d = JSON.parse(row.data);
  if (body.act === 'seen') {
    await db.run('UPDATE deliveries SET seen_at = COALESCE(seen_at, ?) WHERE id = ?', Date.now(), row.id);
    return { ok: true };
  }
  if (body.act === 'open' && row.kind === 'gift') {
    const items = contents(d);
    if (row.done_at) return { ok: true, already: true, items, item: items[0].item, n: items[0].n, note: d.note, from: d.from };
    const { changes } = await db.run('UPDATE deliveries SET done_at = ?, seen_at = COALESCE(seen_at, ?) WHERE id = ? AND done_at IS NULL', Date.now(), Date.now(), row.id);
    return { ok: true, already: !changes, items, item: items[0].item, n: items[0].n, note: d.note, from: d.from };
  }
  if (body.act === 'done' && row.kind === 'pet') {
    await db.run('UPDATE deliveries SET done_at = COALESCE(done_at, ?) WHERE id = ?', Date.now(), row.id);
    return { ok: true };
  }
  return { error: 'Do what?' };
}

// Admin: send a gift to one player ({ id }) or to everyone ({ everyone: true })
// body: { id | everyone, items: [{ item, n }] (or one: item, n), note, from }
async function send(body, me) {
  const asked = Array.isArray(body.items) ? body.items : [{ item: body.item, n: body.n }];
  if (!asked.length) return { error: 'Choose what to send.' };
  if (asked.length > MAX_IN_GIFT) return { error: `A gift holds up to ${MAX_IN_GIFT} different things.` };
  const items = [];
  for (const x of asked) {
    const item = String(x?.item || '');
    if (!giftable(item)) return { error: 'Choose what to send.' };
    const n = int(x.n ?? 1, 1, 1000);
    if (n === null) return { error: 'Send between 1 and 1000 of each thing.' };
    const same = items.find((y) => y.item === item);
    if (same) same.n = Math.min(1000, same.n + n); else items.push({ item, n });
  }
  const note = short(body.note, 400);
  const from = short(body.from, 40) || 'The keepers of the realm';
  const data = JSON.stringify({ items, item: items[0].item, n: items[0].n, note, from, by: me?.username || '?' });
  const now = Date.now();
  let targets;
  if (body.everyone) targets = await db.all('SELECT a.id, a.username FROM accounts a JOIN characters c ON c.account_id = a.id');
  else {
    const a = await db.get('SELECT a.id, a.username FROM accounts a JOIN characters c ON c.account_id = a.id WHERE a.id = ?', int(body.id, 1, 2e9) || 0);
    if (!a) return { error: 'That player has no character yet.' };
    targets = [a];
  }
  let sent = 0;
  for (const a of targets) {
    const w = await db.get("SELECT COUNT(*)::int AS n FROM deliveries WHERE account_id = ? AND kind = 'gift' AND done_at IS NULL", a.id);
    if ((w?.n || 0) >= MAX_WAITING) { if (!body.everyone) return { error: `${a.username} already has ${MAX_WAITING} gifts waiting to be opened.` }; continue; }
    await db.run("INSERT INTO deliveries (account_id, kind, data, at) VALUES (?, 'gift', ?, ?)", a.id, data, now);
    sent++;
  }
  return { ok: true, sent, to: body.everyone ? 'everyone' : targets[0].username, what: items.map((x) => `${x.n} × ${ITEMS[x.item].name}`).join(', ') };
}

// Admin: the gifts sent lately (newest first), and whether each was seen and opened
async function sent() {
  const rows = await db.all(`SELECT d.id, d.data, d.at, d.seen_at, d.done_at, a.username FROM deliveries d JOIN accounts a ON a.id = d.account_id
      WHERE d.kind = 'gift' ORDER BY d.id DESC LIMIT 100`);
  return {
    gifts: rows.map((r) => {
      const d = JSON.parse(r.data);
      const items = contents(d).map((x) => ({ item: x.item, n: x.n, name: ITEMS[x.item]?.name || x.item, icon: ITEMS[x.item]?.icon || '🎁' }));
      return { id: r.id, to: r.username, items, item: items[0].item, name: items[0].name, icon: items[0].icon, n: items[0].n, note: d.note, from: d.from, at: Number(r.at), seen: r.seen_at ? Number(r.seen_at) : null, opened: r.done_at ? Number(r.done_at) : null };
    }),
  };
}
// Admin: take back a gift that hasn't been opened yet
async function unsend(body) {
  const { changes } = await db.run("DELETE FROM deliveries WHERE id = ? AND kind = 'gift' AND done_at IS NULL", int(body.gift, 1, 2e9) || 0);
  return changes ? { ok: true } : { error: 'That gift was opened already (or is gone).' };
}

// Admin: a player's pets (the animals they own: their mount items), and where each one is
async function pets(c) {
  const owned = (c?.inventory || []).filter((s) => ITEMS[s.id]?.kind === 'mount');
  return owned.map((s) => ({ item: s.id, name: ITEMS[s.id].name, icon: ITEMS[s.id].icon, n: s.n, out: c.mount?.item === s.id ? { x: Math.round(c.mount.x), z: Math.round(c.mount.z) } : null }));
}
async function petOrders(accountId) {
  const rows = await db.all("SELECT id, data, at FROM deliveries WHERE account_id = ? AND kind = 'pet' AND done_at IS NULL ORDER BY id", accountId);
  return rows.map((r) => ({ id: r.id, at: Number(r.at), ...JSON.parse(r.data) }));
}
// Admin: an order for one of a player's pets. body: { id, item, action: 'call' | 'home' | 'take' }
async function orderPet(body, accountId) {
  const action = String(body.action || '');
  if (!PET_ACTIONS[action]) return { error: 'Call it, send it home, or take it away?' };
  const item = String(body.item || '');
  if (!MOUNT_ITEMS.includes(item) && ITEMS[item]?.kind !== 'mount') return { error: 'That is not a pet.' };
  // a newer order for the same pet replaces one still waiting
  await db.run("DELETE FROM deliveries WHERE account_id = ? AND kind = 'pet' AND done_at IS NULL AND data LIKE ?", accountId, `%"item":"${item}"%`);
  await db.run("INSERT INTO deliveries (account_id, kind, data, at) VALUES (?, 'pet', ?, ?)", accountId, JSON.stringify({ action, item }), Date.now());
  return { ok: true, said: `${PET_ACTIONS[action]} (${ITEMS[item].name})` };
}

// ---------- monster attacks on the towns ----------
const raidsState = async () => { const r = await db.get("SELECT data FROM world_state WHERE key = 'raids'"); return r ? JSON.parse(r.data) : { next: 1, list: [] }; };
const saveRaids = (s) => db.run("INSERT INTO world_state (key, data) VALUES ('raids', ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data", JSON.stringify(s));
const place = (id) => PLACES.find((p) => p.id === id && R.raidable(p));

// the attacks going on now and the ones still talked about (old ones are forgotten)
async function raids(now = Date.now()) {
  const s = await raidsState();
  return s.list.filter((r) => R.raidActive(r, now) || now - R.raidOver(r) < R.NEWS_MS);
}
// the cities whose bridges an attack keeps raised
async function raidCities(now = Date.now()) {
  const out = {};
  for (const r of await raids(now)) if (R.raidActive(r, now) && r.city) out[r.place] = true;
  return out;
}
// Admin: start an attack. body: { place, raiders, n, level, minutes }
async function startRaid(body, me) {
  const p = place(String(body.place || ''));
  if (!p) return { error: 'Choose a city or a village.' };
  if (!R.RAIDERS[body.raiders]) return { error: 'Choose who attacks.' };
  const n = int(body.n, ...R.RAID_COUNT), level = int(body.level, ...R.RAID_LEVEL), minutes = int(body.minutes, ...R.RAID_MINUTES);
  if (n === null) return { error: `Between ${R.RAID_COUNT[0]} and ${R.RAID_COUNT[1]} monsters.` };
  if (level === null) return { error: `A level from ${R.RAID_LEVEL[0]} to ${R.RAID_LEVEL[1]}.` };
  if (minutes === null) return { error: `From ${R.RAID_MINUTES[0]} minutes to ${R.RAID_MINUTES[1] / 60} hours.` };
  const now = Date.now();
  const s = await raidsState();
  if (s.list.some((r) => r.place === p.id && R.raidActive(r, now))) return { error: `${p.name} is already under attack.` };
  const raid = { id: s.next++, place: p.id, placeName: p.name, city: !!p.city, raiders: body.raiders, n, level, at: now, until: now + minutes * 60000, by: me?.username || '?' };
  s.list = [...s.list.filter((r) => R.raidActive(r, now) || now - R.raidOver(r) < R.NEWS_MS), raid];
  await saveRaids(s);
  return { ok: true, raid };
}
// Admin: drive the monsters off now
async function endRaid(body) {
  const s = await raidsState();
  const r = s.list.find((x) => x.id === int(body.raid, 1, 2e9));
  if (!r || !R.raidActive(r)) return { error: 'That attack is over already.' };
  r.endedAt = Date.now();
  await saveRaids(s);
  return { ok: true, raid: r };
}

// ---------- the great beasts brought back ----------
// The lairs keep their own beasts in each player's game; when one is slain its lair stays empty for
// a while (10 minutes, a day for the King of the Wild Dragons). Bringing one back fills its empty lair
// at once in every open game. body: { kind } (a beast id, or 'all')
async function revive(body) {
  const kind = String(body.kind || 'all');
  if (kind !== 'all' && !BEASTS[kind]) return { error: 'No such beast.' };
  const r = { at: Date.now(), kind };
  await db.run("INSERT INTO world_state (key, data) VALUES ('beasts_revive', ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data", JSON.stringify(r));
  return { ok: true, revive: r, name: kind === 'all' ? 'every great beast' : BEASTS[kind].name };
}
const lastRevive = async () => { const r = await db.get("SELECT data FROM world_state WHERE key = 'beasts_revive'"); return r ? JSON.parse(r.data) : null; };

// what GET /api/social adds for the game
async function forGame(accountId) {
  const [deliveries, list, rev] = await Promise.all([waiting(accountId), raids(), lastRevive()]);
  return { deliveries, raids: list, revive: rev };
}

module.exports = { waiting, act, send, sent, unsend, pets, petOrders, orderPet, raids, raidCities, startRaid, endRaid, revive, lastRevive, forGame, PET_ACTIONS };
