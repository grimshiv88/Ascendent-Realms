// Marriage between players: one asks, the other answers (see public/js/data/family.mjs).
// Marrying a townsperson, and children, are kept with the character (see characters.saveProgress).
const db = require('./db');
const characters = require('./characters');
const { canMarry } = require('../public/js/data/life.mjs');

db.exec('CREATE TABLE IF NOT EXISTS world_state (key TEXT PRIMARY KEY, data TEXT NOT NULL)');
const load = () => { const r = db.prepare("SELECT data FROM world_state WHERE key = 'proposals'").get(); return r ? JSON.parse(r.data) : []; };
const save = (list) => db.prepare("INSERT INTO world_state (key, data) VALUES ('proposals', ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data").run(JSON.stringify(list));
const byName = (name) => db.prepare('SELECT id, username FROM accounts WHERE username = ? COLLATE NOCASE').get(String(name || '').trim());
const nameOf = (id) => db.prepare('SELECT username FROM accounts WHERE id = ?').get(id)?.username;
const WEEK = 7 * 24 * 3600 * 1000;

// Your spouse (as the server has it) and the proposals waiting for you
function list(me) {
  const c = characters.load(me);
  const mine = nameOf(me);
  const all = load().filter((p) => Date.now() - p.at < WEEK);
  return { spouse: c?.spouse || null, proposals: all.filter((p) => p.to === me).map((p) => p.fromName), sent: all.filter((p) => p.from === me).map((p) => p.toName), me: mine };
}

function act(me, body) {
  const c = characters.load(me);
  if (!c) return { error: 'No character yet.' };
  if (body.act === 'propose') {
    if (!canMarry(c)) return { error: 'You must be 25 to marry.' };
    if (c.spouse) return { error: 'You are already married.' };
    const to = byName(body.to);
    if (!to || to.id === me) return { error: 'There is no other player with that name.' };
    const them = characters.load(to.id);
    if (!them) return { error: 'They have no living character.' };
    if (them.spouse) return { error: 'They are already married.' };
    if (!canMarry(them)) return { error: 'They are not yet 25.' };
    const all = load().filter((p) => Date.now() - p.at < WEEK && !(p.from === me && p.to === to.id));
    all.push({ from: me, fromName: nameOf(me), to: to.id, toName: to.username, at: Date.now() });
    save(all);
    return { ok: true, ...list(me) };
  }
  if (body.act === 'answer') {
    const all = load();
    const i = all.findIndex((p) => p.to === me && p.fromName.toLowerCase() === String(body.from || '').toLowerCase());
    if (i < 0) return { error: 'That proposal is gone.' };
    const [p] = all.splice(i, 1);
    save(all);
    if (!body.yes) return { ok: true, ...list(me) };
    const them = characters.load(p.from);
    if (!them || them.spouse || c.spouse) return { error: 'One of you is already married.' };
    const since = Date.now();
    c.spouse = { name: them.name, race: them.race, cls: them.cls, npc: false, since };
    them.spouse = { name: c.name, race: c.race, cls: c.cls, npc: false, since };
    characters.store(me, c);
    characters.store(p.from, them);
    return { ok: true, married: c.spouse, ...list(me) };
  }
  return { error: 'Unknown request.' };
}

module.exports = { list, act };
