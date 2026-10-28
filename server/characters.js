// Character creation and saving. The rules live in the shared game-data module.
const db = require('./db');
const { newCharacter } = require('../public/js/data/game-data.mjs');
const { SKILLS } = require('../public/js/data/skills.mjs');
const { ITEMS, EFFECTS } = require('../public/js/data/items.mjs');

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
    fatigue: int(p.fatigue ?? 0, 0, 100), savedAt: int(p.savedAt ?? 0, 0, 1e15),
  };
  for (const [k, v] of Object.entries(fields)) if (v === null) return { error: `Bad value for ${k}.` };
  const stats = {};
  for (const k of Object.keys(character.stats)) {
    const v = int(p.stats?.[k], 0, 1e6);
    if (v === null) return { error: `Bad value for stat ${k}.` };
    stats[k] = v;
  }
  const trained = {};
  for (const k of ['atk', 'def', 'matk', 'mdef', 'hp']) {
    const v = int(p.trained?.[k] ?? 0, 0, 1e6);
    if (v === null) return { error: `Bad value for ${k}.` };
    trained[k] = v;
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
    // a coating a Blacksmith put on a weapon: its effect and the hits left
    if (s.coat !== undefined) {
      if (!EFFECTS[s.coat?.id] || int(s.coat?.hits, 1, 100) === null) return { error: 'Bad inventory item.' };
      item.coat = { id: s.coat.id, hits: s.coat.hits };
    }
    inventory.push(item);
  }
  const equipped = {};
  for (const slot of ['weapon', 'head', 'body', 'legs', 'feet', 'shield']) {
    const v = p.equipped?.[slot];
    equipped[slot] = typeof v === 'string' && inventory.some((s) => s.uid === v) ? v : null;
  }
  const boosts = Array.isArray(p.boosts)
    ? p.boosts.slice(0, 10).filter((b) => int(b?.until, 0, 1e15) !== null
      && (b.stat === undefined ? int(b?.sp, 0, 1e6) !== null : ['atk', 'def', 'speed'].includes(b.stat) && int(b.pct, 0, 200) !== null))
      .map((b) => (b.stat ? { stat: b.stat, pct: b.pct, until: b.until } : { sp: b.sp, until: b.until }))
    : [];
  // caves whose boss you beat, and when
  const caves = {};
  for (const [id, at] of Object.entries(p.caves && typeof p.caves === 'object' ? p.caves : {}).slice(0, 200)) {
    if (/^cave\d{1,4}$/.test(id) && int(at, 0, 1e15) !== null) caves[id] = at;
  }
  // a Potion-Maker hired by a Businessman, and the potions brewing
  const pm = p.potionMaker;
  const potionMaker = pm && int(pm.until, 0, 1e15) !== null
    ? { until: pm.until, queue: (Array.isArray(pm.queue) ? pm.queue.slice(0, 5) : []).filter((q) => ITEMS[q?.id] && int(q.ready, 0, 1e15) !== null).map((q) => ({ id: q.id, ready: q.ready })) }
    : null;
  // Quests are kept as plain data: only known types, small numbers and short text
  const str = (v, n) => (typeof v === 'string' && v.length <= n ? v : null);
  const cleanQuests = (list, max) => {
    const quests = [];
    for (const q of Array.isArray(list) ? list.slice(0, max) : []) {
      if (!['hunt', 'slay', 'gather', 'explore'].includes(q?.type)) continue;
      const r = q.reward || {};
      const clean = {
        type: q.type, need: int(q.need, 1, 100), have: int(q.have, 0, 100), accepted: q.accepted === true,
        title: str(q.title, 120), text: str(q.text, 300),
        reward: { exp: int(r.exp, 0, 1e9), coins: int(r.coins, 0, 1e9), ...(r.item ? { item: str(r.item, 32) } : {}) },
      };
      if (q.type === 'hunt') clean.kind = str(q.kind, 32);
      if (q.type === 'slay') clean.min = int(q.min, 1, 10000);
      if (q.type === 'gather') clean.item = str(q.item, 32);
      if (q.type === 'explore') clean.place = { x: int(q.place?.x, -1e6, 1e6), z: int(q.place?.z, -1e6, 1e6), r: int(q.place?.r, 1, 1000) };
      const flat = JSON.stringify(clean);
      if (flat.includes('null')) continue;
      if (q.guild === true) clean.guild = true;
      quests.push(clean);
    }
    return quests;
  };
  const quests = cleanQuests(p.quests, 4);
  const guildQuests = cleanQuests(p.guildQuests, 3);
  const guildNext = int(p.guildNext ?? 0, 0, 1e15) ?? 0;
  // the quest board's clock: when the next quest is posted, and how many were taken on today
  const questNext = int(p.questNext ?? 0, 0, 1e15) ?? 0;
  const questDay = p.questDay && int(p.questDay.day, 0, 1e9) !== null && int(p.questDay.n, 0, 100) !== null ? { day: p.questDay.day, n: p.questDay.n } : null;
  const room = p.room && int(p.room.until, 0, 1e15) !== null ? { until: p.room.until } : null;
  const torches = (Array.isArray(p.torches) ? p.torches.slice(0, 10) : [])
    .filter((t) => Number.isFinite(t?.x) && Number.isFinite(t?.z) && Math.abs(t.x) < 1e6 && Math.abs(t.z) < 1e6)
    .map((t) => ({ x: t.x, z: t.z }));
  // Skills: known skill ids, up to 6 on keys
  const skills = (Array.isArray(p.skills) ? p.skills.slice(0, 200) : []).filter((id) => typeof id === 'string' && SKILLS[id]);
  const skillBar = (Array.isArray(p.skillBar) ? p.skillBar.slice(0, 6) : [])
    .filter((b) => skills.includes(b?.id) && (b.key === null || (typeof b.key === 'string' && /^[A-Za-z0-9]{1,20}$/.test(b.key))))
    .map((b) => ({ id: b.id, key: b.key }));
  const skillPicks = int(p.skillPicks ?? 0, 0, 1000) ?? 0;
  const t = p.tent;
  const tent = t && Number.isFinite(t.x) && Number.isFinite(t.z) && Math.abs(t.x) < 1e6 && Math.abs(t.z) < 1e6
    ? { x: t.x, z: t.z, heading: Number.isFinite(t.heading) ? t.heading : 0 } : null;
  Object.assign(character, fields, { stats, inventory, equipped, boosts, quests, questNext, questDay, guildQuests, guildNext, room, torches, skills, skillBar, skillPicks, tent, potionMaker, trained, caves });
  db.prepare("UPDATE characters SET data = ?, updated_at = datetime('now') WHERE account_id = ?")
    .run(JSON.stringify(character), accountId);
  return { ok: true };
}

function store(accountId, character) {
  db.prepare("UPDATE characters SET data = ?, updated_at = datetime('now') WHERE account_id = ?")
    .run(JSON.stringify(character), accountId);
}

// The highest-level characters on the server (EXP breaks ties)
function top(limit = 10) {
  return db.prepare('SELECT data FROM characters').all()
    .map((r) => JSON.parse(r.data))
    .map((c) => ({ name: c.name, race: c.race, cls: c.cls, side: c.side, level: c.level || 1, exp: c.exp || 0 }))
    .sort((a, b) => b.level - a.level || b.exp - a.exp)
    .slice(0, limit);
}

module.exports = { create, load, store, saveLocation, saveProgress, top };
