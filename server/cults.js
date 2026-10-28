// Cults and the Order of the Dawn (rules in data/cults.mjs). One small JSON state, like the guilds.
const db = require('./db');
const characters = require('./characters');
const { RACES } = require('../public/js/data/game-data.mjs');
const C = require('../public/js/data/cults.mjs');

const load = () => { const r = db.prepare("SELECT data FROM world_state WHERE key = 'cults'").get(); return r ? JSON.parse(r.data) : C.emptyCults(); };
const save = (s) => db.prepare("INSERT INTO world_state (key, data) VALUES ('cults', ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data").run(JSON.stringify(s));
const byName = (name) => db.prepare('SELECT id, username FROM accounts WHERE username = ? COLLATE NOCASE').get(String(name || '').trim());
function who(accountId) {
  const c = characters.load(accountId);
  return c ? { name: c.name, race: c.race, side: RACES[c.race]?.side, level: c.level || 1 } : null;
}
function whoByName(name) { const a = byName(name); return a ? who(a.id) : null; }

function list(me) {
  const w = who(me);
  if (!w) return { error: 'No character yet.' };
  return C.view(load(), w);
}
// body: { action: 'found'|'invite'|'answer'|'order'|'ask'|'give'|'done'|'ack', name, accept, id, pick }
function act(me, body = {}) {
  const w = who(me);
  if (!w) return { error: 'No character yet.' };
  const s = load();
  let r;
  switch (body.action) {
    case 'found': r = C.found(s, w, body.name); break;
    case 'invite': r = C.invite(s, w.name, whoByName(body.name)); break;
    case 'answer': r = C.answer(s, w, body.accept === true); break;
    case 'order': r = C.joinOrder(s, w); break;
    case 'ask': r = C.askMission(s, w); break;
    case 'give': r = C.giveMission(s, w, String(body.name || ''), Number.isInteger(body.pick) ? body.pick : undefined, whoByName(body.name)?.level); break;
    case 'done': r = C.finishMission(s, w, Number(body.id)); break;
    case 'ack': r = C.ackStrip(s, w.name); break;
    default: return { error: 'Do what?' };
  }
  if (r.error) return r;
  save(s);
  return { ...r, ...C.view(s, w) };
}
// A chat message from a cult member that gives the cult away strips them (called by the chat)
function checkChat(accountId, text) {
  const w = who(accountId);
  if (!w) return;
  const s = load();
  if (!C.givesAway(C.cultOf(s, w.name), text)) return;
  C.strip(s, w.name);
  save(s);
}
const seenBy = (viewer, target) => C.seenBy(load(), viewer, target);

module.exports = { list, act, checkChat, seenBy };
