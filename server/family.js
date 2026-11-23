// Marriage between players: one asks, the other answers (see public/js/data/family.mjs).
// Marrying a townsperson, and children, are kept with the character (see characters.saveProgress).
const db = require('./db');
const characters = require('./characters');
const { canMarry } = require('../public/js/data/life.mjs');

const load = async () => { const r = await db.get("SELECT data FROM world_state WHERE key = 'proposals'"); return r ? JSON.parse(r.data) : []; };
const save = (list) => db.run("INSERT INTO world_state (key, data) VALUES ('proposals', ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data", JSON.stringify(list));
const byName = (name) => db.get('SELECT id, username FROM accounts WHERE lower(username) = lower(?)', String(name || '').trim());
const nameOf = async (id) => (await db.get('SELECT username FROM accounts WHERE id = ?', id))?.username;
const WEEK = 7 * 24 * 3600 * 1000;

// Your spouse (as the server has it) and the proposals waiting for you
async function list(me) {
  const c = await characters.load(me);
  const mine = await nameOf(me);
  const all = (await load()).filter((p) => Date.now() - p.at < WEEK);
  return { spouse: c?.spouse || null, proposals: all.filter((p) => p.to === me).map((p) => p.fromName), sent: all.filter((p) => p.from === me).map((p) => p.toName), me: mine };
}

async function act(me, body) {
  const c = await characters.load(me);
  if (!c) return { error: 'No character yet.' };
  if (body.act === 'propose') {
    if (!canMarry(c)) return { error: 'You must be 25 to marry.' };
    if (c.spouse) return { error: 'You are already married.' };
    const to = await byName(body.to);
    if (!to || to.id === me) return { error: 'There is no other player with that name.' };
    const them = await characters.load(to.id);
    if (!them) return { error: 'They have no living character.' };
    if (them.spouse) return { error: 'They are already married.' };
    if (!canMarry(them)) return { error: 'They are not yet 25.' };
    const all = (await load()).filter((p) => Date.now() - p.at < WEEK && !(p.from === me && p.to === to.id));
    all.push({ from: me, fromName: await nameOf(me), to: to.id, toName: to.username, at: Date.now() });
    await save(all);
    return { ok: true, ...(await list(me)) };
  }
  if (body.act === 'answer') {
    const all = await load();
    const i = all.findIndex((p) => p.to === me && p.fromName.toLowerCase() === String(body.from || '').toLowerCase());
    if (i < 0) return { error: 'That proposal is gone.' };
    const [p] = all.splice(i, 1);
    await save(all);
    if (!body.yes) return { ok: true, ...(await list(me)) };
    const them = await characters.load(p.from);
    if (!them || them.spouse || c.spouse) return { error: 'One of you is already married.' };
    const since = Date.now();
    c.spouse = { name: them.name, race: them.race, cls: them.cls, npc: false, since };
    them.spouse = { name: c.name, race: c.race, cls: c.cls, npc: false, since };
    await characters.store(me, c);
    await characters.store(p.from, them);
    return { ok: true, married: c.spouse, ...(await list(me)) };
  }
  return { error: 'Unknown request.' };
}

module.exports = { list, act };
