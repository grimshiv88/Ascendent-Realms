// Cults and the Order of the Dawn (rules in data/cults.mjs). One small JSON state, like the guilds.
const db = require('./db');
const characters = require('./characters');
const { RACES, becomeMage } = require('../public/js/data/game-data.mjs');
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
  const s = load();
  if (C.touch(s, w)) save(s);
  return C.view(s, w);
}
// body: { action: 'found'|'deed'|'answer'|'ask'|'give'|'done'|'ack', name, deed, choice, id, pick }
function act(me, body = {}) {
  const w = who(me);
  if (!w) return { error: 'No character yet.' };
  const s = load();
  C.touch(s, w);
  let r;
  switch (body.action) {
    case 'found': r = C.found(s, w, body.name); break;
    case 'deed': r = C.deed(s, w, String(body.deed || '')); break;
    case 'answer': r = C.answer(s, w, ['dark', 'light', 'none'].includes(body.choice) ? body.choice : 'none'); break;
    case 'ask': r = C.askMission(s, w); break;
    case 'give': r = C.giveMission(s, w, String(body.name || ''), Number.isInteger(body.pick) ? body.pick : undefined, whoByName(body.name)?.level); break;
    case 'done': r = C.finishMission(s, w, Number(body.id)); break;
    case 'ack': r = C.ackStrip(s, w.name); break;
    case 'mage': {
      if (!C.mayBecomeMage(s, w.name)) return { error: 'Only those who serve the Dark Side may become Mages.' };
      const ch = characters.load(me);
      if (!becomeMage(ch)) return { error: 'You are a Mage already.' };
      characters.store(me, ch);
      r = { ok: true, mage: { cls: ch.cls, stats: ch.stats } };
      break;
    }
    default: return { error: 'Do what?' };
  }
  if (r.error) { if (body.action === 'answer') save(s); return r; }
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
// Those who have had the call can't speak of it: the words are blotted out
function censor(accountId, text) {
  const w = who(accountId);
  return w ? C.censor(load(), w.name, text) : text;
}
const seenBy = (viewer, target) => C.seenBy(load(), viewer, target);
// For Appraisal: which secret side a player serves ({ cult, rank } / { order } / null)
function allegiance(name) {
  const s = load();
  const cult = C.cultOf(s, name);
  if (cult) return { cult: cult.name, rank: C.CULT_RANKS[C.memberOf(cult, name).rank] };
  return C.inOrder(s, name) ? { order: C.ORDER_NAME } : null;
}
// A character has died: their place in a cult or the Order goes with them
function forget(accountId) {
  const w = who(accountId);
  if (!w) return;
  const s = load();
  C.forget(s, w.name);
  save(s);
}

module.exports = { list, act, checkChat, censor, seenBy, forget, allegiance };
