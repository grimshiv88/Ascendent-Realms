// Character creation and saving. The rules live in the shared game-data module.
const db = require('./db');
const { newCharacter } = require('../public/js/data/game-data.mjs');

function load(accountId) {
  const row = db.prepare('SELECT data FROM characters WHERE account_id = ?').get(accountId);
  return row ? JSON.parse(row.data) : null;
}

function create(accountId, username, body) {
  if (load(accountId)) return { error: 'This account already has a character.' };
  const result = newCharacter(username, body);
  if (result.error) return result;
  db.prepare('INSERT INTO characters (account_id, data) VALUES (?, ?)').run(accountId, JSON.stringify(result.character));
  return result;
}

function saveLocation(accountId, loc) {
  const character = load(accountId);
  if (!character) return { error: 'No character yet.' };
  const n = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : 0);
  character.location = { ...character.location, x: n(loc.x), y: n(loc.y), z: n(loc.z), heading: n(loc.heading) };
  db.prepare("UPDATE characters SET data = ?, updated_at = datetime('now') WHERE account_id = ?")
    .run(JSON.stringify(character), accountId);
  return { ok: true };
}

module.exports = { create, load, saveLocation };
