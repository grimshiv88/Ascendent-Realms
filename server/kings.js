// The Monster Kings' courts: who sits on each throne, the Overlords around them, and when the
// throne was last emptied. One court per monster race.
const db = require('./db');
const characters = require('./characters');
const K = require('../public/js/data/kings.mjs');
const { RACES } = require('../public/js/data/game-data.mjs');

db.exec(`
  CREATE TABLE IF NOT EXISTS courts (
    race TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );
`);

function court(race) {
  const row = db.prepare('SELECT data FROM courts WHERE race = ?').get(race);
  return row ? JSON.parse(row.data) : K.startingCourt(race);
}
const store = (c) => db.prepare('INSERT INTO courts (race, data) VALUES (?, ?) ON CONFLICT(race) DO UPDATE SET data = excluded.data').run(c.race, JSON.stringify(c));

function list() {
  return { courts: Object.keys(K.CASTLES).map(court) };
}

// The King of `race` was struck down by this account's character
function slain(accountId, body) {
  const race = String(body.race || '');
  if (!K.CASTLES[race]) return { error: 'There is no such King.' };
  const c = characters.load(accountId);
  if (!c) return { error: 'No character yet.' };
  const now = Date.now();
  const before = court(race);
  if (now - (before.slainAt || 0) < K.KING_RETURNS_MS) return { error: 'The throne is already empty.' };
  const by = { name: c.name, race: c.race, level: c.level || 1, monster: RACES[c.race]?.side === 'monster' };
  const { court: after, crowned } = K.afterKingSlain(before, by, now);
  store(after);
  return { ok: true, crowned, ...list() };
}

module.exports = { list, slain };
