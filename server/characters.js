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

// Saves level, EXP, coins, HP, stats and the bag. The game runs these rules in the browser for now;
// once multiplayer arrives the server will check every change itself.
function saveProgress(accountId, p) {
  const character = load(accountId);
  if (!character) return { error: 'No character yet.' };
  const int = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : null);
  const fields = {
    level: int(p.level, 1, 10000), exp: int(p.exp, 0, 1e12), coins: int(p.coins, 0, 1e12), hp: int(p.hp, 0, 1e9), sp: int(p.sp, 0, 1e9),
    unspentPoints: int(p.unspentPoints, 0, 1e6), uniquePoints: int(p.uniquePoints, 0, 1e6),
  };
  for (const [k, v] of Object.entries(fields)) if (v === null) return { error: `Bad value for ${k}.` };
  const stats = {};
  for (const k of Object.keys(character.stats)) {
    const v = int(p.stats?.[k], 0, 1e6);
    if (v === null) return { error: `Bad value for stat ${k}.` };
    stats[k] = v;
  }
  if (!Array.isArray(p.inventory) || p.inventory.length > 60) return { error: 'Bad inventory.' };
  const inventory = [];
  for (const s of p.inventory) {
    if (typeof s?.id !== 'string' || !/^[a-z_]{1,32}$/.test(s.id) || !int(s.n, 1, 1e6)) return { error: 'Bad inventory item.' };
    const item = { id: s.id, n: s.n };
    if (s.uid !== undefined) {
      if (typeof s.uid !== 'string' || !/^g[a-z0-9]{1,24}$/.test(s.uid)) return { error: 'Bad inventory item.' };
      item.uid = s.uid;
    }
    if (s.plus !== undefined) {
      if (int(s.plus, 0, 10) === null) return { error: 'Bad inventory item.' };
      item.plus = s.plus;
    }
    inventory.push(item);
  }
  const equipped = {};
  for (const slot of ['weapon', 'head', 'body', 'legs', 'feet', 'shield']) {
    const v = p.equipped?.[slot];
    equipped[slot] = typeof v === 'string' && inventory.some((s) => s.uid === v) ? v : null;
  }
  const boosts = Array.isArray(p.boosts)
    ? p.boosts.slice(0, 10).filter((b) => int(b?.sp, 0, 1e6) !== null && int(b?.until, 0, 1e15) !== null).map((b) => ({ sp: b.sp, until: b.until }))
    : [];
  Object.assign(character, fields, { stats, inventory, equipped, boosts });
  db.prepare("UPDATE characters SET data = ?, updated_at = datetime('now') WHERE account_id = ?")
    .run(JSON.stringify(character), accountId);
  return { ok: true };
}

module.exports = { create, load, saveLocation, saveProgress };
