// The Monster Kings' courts: who sits on each throne, the Overlords around them, and when the
// throne was last emptied. One court per monster race.
const db = require('./db');
const characters = require('./characters');
const K = require('../public/js/data/kings.mjs');
const { RACES } = require('../public/js/data/game-data.mjs');

const store = (c) => db.run('INSERT INTO courts (race, data) VALUES (?, ?) ON CONFLICT(race) DO UPDATE SET data = excluded.data', c.race, JSON.stringify(c));
async function court(race) {
  const row = await db.get('SELECT data FROM courts WHERE race = ?', race);
  const c = row ? JSON.parse(row.data) : K.startingCourt(race);
  // a King who left a challenge unanswered for two days loses the crown
  const settled = K.settleChallenge(c);
  if (settled !== c) await store(settled);
  return settled;
}

async function list() {
  return { courts: await Promise.all(Object.keys(K.CASTLES).map(court)) };
}

// The King of `race` was struck down by this account's character
async function slain(accountId, body) {
  const race = String(body.race || '');
  if (!K.CASTLES[race]) return { error: 'There is no such King.' };
  const c = await characters.load(accountId);
  if (!c) return { error: 'No character yet.' };
  const now = Date.now();
  const before = await court(race);
  if (now - (before.slainAt || 0) < K.KING_RETURNS_MS) return { error: 'The throne is already empty.' };
  const by = { name: c.name, race: c.race, level: c.level || 1, monster: RACES[c.race]?.side === 'monster' };
  const { court: after, crowned } = K.afterKingSlain(before, by, now);
  await store(after);
  return { ok: true, crowned, ...(await list()) };
}

// A monster player as strong as the King challenges a player King of their race
async function challenge(accountId, body) {
  const race = String(body.race || '');
  if (!K.CASTLES[race]) return { error: 'There is no such King.' };
  const c = await characters.load(accountId);
  if (!c) return { error: 'No character yet.' };
  const before = await court(race);
  const bar = K.challengeBar(before, { ...c, side: RACES[c.race]?.side });
  if (bar) return { error: bar };
  await store(K.challenge(before, c));
  return { ok: true, ...(await list()) };
}
// The King answers the challenge (only the King can)
async function answer(accountId, body) {
  const race = String(body.race || '');
  if (!K.CASTLES[race]) return { error: 'There is no such King.' };
  const c = await characters.load(accountId);
  const before = await court(race);
  if (!c || before.king.npc || before.king.name !== c.name) return { error: 'Only the King can answer.' };
  if (!before.challenge || before.challenge.settled) return { error: 'There is no challenge waiting.' };
  await store(K.answerChallenge(before));
  return { ok: true, ...(await list()) };
}

module.exports = { list, slain, challenge, answer };
