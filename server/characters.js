// Character creation and saving. The rules live in the shared game-data module.
const db = require('./db');
const { fallenKeep, rebornWith, rebirthAsChild, mayChangeForm, growUp } = require('../public/js/data/game-data.mjs');
const { rollBirthTier, housesOnTier, PASS_ORDER, DAY_PASS_MS } = require('../public/js/data/citypass.mjs');
const { cleanCountry } = require('../public/js/data/countries.mjs');
const { SCHOOLS, BIRTH_CITY, BIRTH_CITIES, KIDS_PER_HOUSE, houseCount, rollBirth, bornCharacter, ceremonyDue, rollClass, CEREMONY_SHOW_MS } = require('../public/js/data/birth.mjs');
const { moveToNewWorld } = require('../public/js/data/world-layout.mjs');
const { pickUnique, uniqueSlot, APPRAISAL_AWAY_MS, rankProofs, climbedRank, rankOf, RANK_CAP, isAppraisal } = require('../public/js/data/unique.mjs');
const { SKILLS } = require('../public/js/data/skills.mjs');
const { ITEMS, EFFECTS } = require('../public/js/data/items.mjs');
const { SPELLS } = require('../public/js/data/spells.mjs');
const { cleanPetName } = require('../public/js/data/voicecmd.mjs');
const { CARD_RANKS } = require('../public/js/data/guildcard.mjs');
const { VILLAGE_RACES } = require('../public/js/data/mobvillages.mjs');
const { LIVES, UNDYING_LEVEL, canMarry } = require('../public/js/data/life.mjs');
const { MAX_CHILDREN } = require('../public/js/data/family.mjs');
const { RACES, CLASSES } = require('../public/js/data/game-data.mjs');
const { BODYGUARDS } = require('../public/js/data/hire.mjs');
const { cleanBeds } = require('../public/js/data/crops.mjs');

// The admins' health and healing numbers (data/game-data.mjs TUNING), sent to the game with the character
const { cleanTuning } = require('../public/js/data/game-data.mjs');
async function tuning() {
  const r = await db.get("SELECT data FROM world_state WHERE key = 'tuning'");
  return cleanTuning(r ? JSON.parse(r.data) : {});
}
const withTuning = async (c) => (c ? { ...c, tuning: await tuning() } : c);

async function load(accountId) {
  const row = await db.get('SELECT data FROM characters WHERE account_id = ?', accountId);
  if (!row) return null;
  const c = JSON.parse(row.data);
  // saved before the world grew: carried to the same spot on the new map
  if (moveToNewWorld(c)) await db.run('UPDATE characters SET data = ? WHERE account_id = ?', JSON.stringify(c), accountId);
  return c;
}

// Unique Skills held by someone (alive, or kept by a fallen one): their names, how many of each top
// rank are held, and whether anyone holds Appraisal
async function uniquesHeld() {
  const rows = await db.all("SELECT (data::jsonb #>> '{uniqueSkill,name}') AS n, (data::jsonb #>> '{uniqueSkill,rank}') AS r FROM characters UNION ALL SELECT (data::jsonb #>> '{uniqueSkill,name}'), (data::jsonb #>> '{uniqueSkill,rank}') FROM fallen");
  const held = {};
  for (const r of rows) if (r.r) held[r.r] = (held[r.r] || 0) + 1;
  const takenUniques = new Set(rows.map((r) => r.n).filter(Boolean));
  return { takenUniques, held, appraisal: ![...takenUniques].some((n) => String(n).toLowerCase() === 'appraisal') };
}
// A house with room for one more child: in the city of the race first, then the others in turn.
// Birth luck picks the ring first (a noble house, the Common Quarter or the Dump: see
// data/citypass.mjs); if that ring's houses are all full, the other rings of the same city.
async function findHome(race) {
  const kids = await db.all("SELECT (data::jsonb #>> '{child,family,city}') AS city, (data::jsonb #>> '{child,family,house}') AS house, COUNT(*)::int AS n FROM characters WHERE jsonb_typeof(data::jsonb -> 'child') = 'object' GROUP BY 1, 2");
  const full = new Map(kids.map((k) => [`${k.city}:${k.house}`, k.n]));
  const first = BIRTH_CITY[race] || 'central';
  const luck = rollBirthTier();
  for (const city of [first, ...BIRTH_CITIES.filter((c) => c !== first)]) {
    for (const tier of [luck, ...PASS_ORDER.filter((t) => t !== luck)]) {
      const open = housesOnTier(city, tier).filter((h) => (full.get(`${city}:${h}`) || 0) < KIDS_PER_HOUSE);
      if (open.length) return { city, house: open[Math.floor(Math.random() * open.length)] };
    }
  }
  const open = PASS_ORDER.flatMap((t) => housesOnTier(first, t));
  return { city: first, house: open[Math.floor(Math.random() * open.length)] ?? 0 };
}

// Nobody chooses who they are: a new character is born at random into a family (see data/birth.mjs).
// `body.side` ('player' or 'monster') narrows the race to one side, if given.
async function create(accountId, username, body) {
  if (await load(accountId)) return { error: 'This account already has a character.' };
  await keepAppraisalHeld();
  const opts = await uniquesHeld();
  const kept = await db.get('SELECT data FROM fallen WHERE account_id = ?', accountId);
  const keep = kept ? JSON.parse(kept.data) : null;
  // born again as one of your own children, or at random into a family
  const asKid = Number.isInteger(body?.asChild) ? rebirthAsChild(keep, body.asChild, rollBirth) : null;
  const birth = asKid?.birth || rollBirth(['player', 'monster'].includes(body?.side) ? body.side : null);
  const result = bornCharacter(username, birth, (asKid?.home && houseCount(asKid.home.city) > asKid.home.house ? asKid.home : null) || await findHome(birth.race), opts);
  if (result.error) return result;
  // the flag chosen at sign-up goes on the ID
  const acc = await db.get('SELECT country FROM accounts WHERE id = ?', accountId);
  result.character.country = cleanCountry(acc?.country);
  if (asKid) { result.character.child.school = asKid.kid.school || null; result.character.child.plan = asKid.kid.plan; result.character.rebornFrom = keep.name || null; }
  // a character who fell before passes their Unique Skill on
  if (keep) rebornWith(result.character, keep);
  try {
    await db.run('INSERT INTO characters (account_id, data) VALUES (?, ?)', accountId, JSON.stringify(result.character));
  } catch (e) {
    if (e.code === '23505') return { error: 'This account already has a character.' };
    throw e;
  }
  await db.run('DELETE FROM fallen WHERE account_id = ?', accountId);
  return { ...result, character: await withTuning(result.character) };
}

// The Ceremony of Revealing: a child who has reached 7 learns their class
async function ceremony(accountId) {
  const character = await load(accountId);
  if (!character) return { error: 'No character yet.' };
  if (!ceremonyDue(character)) return { error: 'You are not old enough yet.' };
  const cls = rollClass(character);
  const city = character.child?.family?.city || 'central';
  growUp(character, cls);
  await store(accountId, character);
  // the new card is shown in the sky over the city's shrine for a while, for everyone there to see
  const now = Date.now();
  const list = await recentCeremonies(now);
  list.push({ city, name: character.name, race: character.race, cls, level: character.level, rank: character.uniqueSkill?.rank || null, unique: character.uniqueSkill?.name || null, at: now });
  await db.run("INSERT INTO world_state (key, data) VALUES ('ceremonies', ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data", JSON.stringify(list.slice(-30)));
  return { ok: true, character };
}
// Ceremonies held in the last CEREMONY_SHOW_MS (see data/birth.mjs)
async function recentCeremonies(now = Date.now()) {
  const r = await db.get("SELECT data FROM world_state WHERE key = 'ceremonies'");
  return (r ? JSON.parse(r.data) : []).filter((c) => now - c.at < CEREMONY_SHOW_MS);
}

// Raise the Unique Skill one rank when the character has earned a proof of growth for it (see
// rankProofs): at most two ranks above its birth rank, and SS and SSS only while there is room.
async function rankUp(accountId) {
  const character = await load(accountId);
  if (!character?.uniqueSkill) return { error: 'No Unique Skill yet.' };
  const u = character.uniqueSkill;
  if (isAppraisal(character)) return { error: 'Appraisal has no ranks to climb.' };
  const raised = u.raised || 0;
  if (rankProofs(character).total <= raised) return { error: 'Not yet: it needs another proof of growth.' };
  const born = u.born || rankOf(u);
  const next = climbedRank(born, raised + 1);
  if (next === rankOf(u)) return { error: 'It is already as high as it can go.' };
  if (RANK_CAP[next] != null && ((await uniquesHeld()).held[next] || 0) >= RANK_CAP[next]) return { error: `Every ${next} place in the world is held. It will climb when one is free.`, full: true };
  character.uniqueSkill = { ...u, rank: next, born, raised: raised + 1 };
  await store(accountId, character);
  return { ok: true, uniqueSkill: character.uniqueSkill };
}

// Appraisal is held by one person only. If they stay away for more than a month it leaves them
// and they are given another Unique Skill (alive or fallen).
async function keepAppraisalHeld(now = Date.now()) {
  const away = (iso) => !iso || now - Date.parse(String(iso).replace(' ', 'T') + (String(iso).includes('Z') ? '' : 'Z')) > APPRAISAL_AWAY_MS;
  const fresh = async () => { const o = await uniquesHeld(); return uniqueSlot(pickUnique(o.takenUniques, Math.random, { held: o.held })); };
  for (const r of await db.all("SELECT account_id, data, updated_at FROM characters WHERE lower((data::jsonb #>> '{uniqueSkill,name}')) = 'appraisal'")) {
    if (!away(r.updated_at)) continue;
    const c = JSON.parse(r.data);
    c.uniqueSkill = await fresh();
    c.appraisalLost = true;
    await db.run('UPDATE characters SET data = ? WHERE account_id = ?', JSON.stringify(c), r.account_id);
  }
  for (const r of await db.all("SELECT account_id, data FROM fallen WHERE lower((data::jsonb #>> '{uniqueSkill,name}')) = 'appraisal'")) {
    const k = JSON.parse(r.data);
    if (!away(k.fell)) continue;
    k.uniqueSkill = await fresh();
    await db.run('UPDATE fallen SET data = ? WHERE account_id = ?', JSON.stringify(k), r.account_id);
  }
}

// Death is final: the character is gone and the player starts again from the beginning, born anew
// at random into a new family. Only the Unique Skill (and a sinner's or blessed soul) passes on.
async function fall(accountId) {
  const character = await load(accountId);
  if (!character) return { error: 'No character yet.' };
  const keep = fallenKeep(character);
  await db.tx(async (t) => {
    await t.run('INSERT INTO fallen (account_id, data) VALUES (?, ?) ON CONFLICT (account_id) DO UPDATE SET data = excluded.data', accountId, JSON.stringify(keep));
    // the whole of the life is kept too, so an admin can look at it, change it, or bring the player back to it
    await t.run('INSERT INTO past_lives (account_id, at, cause, data) VALUES (?, ?, ?, ?)', accountId, Date.now(), 'died', JSON.stringify(character));
    await t.run('DELETE FROM characters WHERE account_id = ?', accountId);
  });
  return { ok: true, kept: keep };
}

// An admin changed this character after the game loaded it: the game must load it again instead of
// saving its older copy over the change
const staleCopy = (character, p) => ((character.adminRev || 0) > (Number(p?.adminRev) || 0)
  ? { error: 'Your character was changed by the game\'s owner. Loading it again...', reload: true } : null);

async function saveLocation(accountId, loc) {
  const character = await load(accountId);
  if (!character) return { error: 'No character yet.' };
  const stale = staleCopy(character, loc);
  if (stale) return stale;
  const n = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : 0);
  character.location = { ...character.location, x: n(loc.x), y: n(loc.y), z: n(loc.z), heading: n(loc.heading) };
  await store(accountId, character);
  return { ok: true };
}

// One bag entry from the game, checked and with only the fields that matter (null if it is not real)
function cleanItem(s) {
  const int = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : null);
  if (typeof s?.id !== 'string' || !/^[a-z_]{1,32}$/.test(s.id) || !int(s.n, 1, 1e6)) return null;
  const item = { id: s.id, n: s.n };
  if (s.uid !== undefined) {
    if (typeof s.uid !== 'string' || !/^g[a-z0-9]{1,24}$/.test(s.uid)) return null;
    item.uid = s.uid;
  }
  if (s.plus !== undefined) {
    if (int(s.plus, 0, 10) === null) return null;
    item.plus = s.plus;
  }
  // a coating a Blacksmith put on a weapon: its effect and the hits left
  if (s.coat !== undefined) {
    if (!EFFECTS[s.coat?.id] || int(s.coat?.hits, 1, 100) === null) return null;
    item.coat = { id: s.coat.id, hits: s.coat.hits };
  }
  // spells attached to a staff
  if (s.spells !== undefined) {
    if (!Array.isArray(s.spells) || s.spells.length > 5 || !s.spells.every((id) => typeof id === 'string' && SPELLS[id])) return null;
    item.spells = [...new Set(s.spells)];
  }
  // skills from Skill Stones set into a piece of gear (5 at most)
  if (s.skills !== undefined) {
    if (!Array.isArray(s.skills) || s.skills.length > 5 || !s.skills.every((id) => typeof id === 'string' && SKILLS[id])) return null;
    item.skills = [...new Set(s.skills)];
  }
  return item;
}

// Saves level, EXP, coins, HP, stats and the bag. The game runs these rules in the browser for now;
// once multiplayer arrives the server will check every change itself.
async function saveProgress(accountId, p) {
  const character = await load(accountId);
  if (!character) return { error: 'No character yet.' };
  const stale = staleCopy(character, p);
  if (stale) return stale;
  const int = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : null);
  const fields = {
    level: int(p.level, 1, 10000), exp: int(p.exp, 0, 1e12), coins: int(p.coins, 0, 1e12), hp: int(p.hp, 0, 1e9), sp: int(p.sp, 0, 1e9),
    unspentPoints: int(p.unspentPoints, 0, 1e6), uniquePoints: int(p.uniquePoints, 0, 1e6),
    fatigue: int(p.fatigue ?? 0, 0, 100), hunger: int(p.hunger ?? 100, 0, 100), savedAt: int(p.savedAt ?? 0, 0, 1e15),
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
    const item = cleanItem(s);
    if (!item) return { error: 'Bad inventory item.' };
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
  // monster villages out in the wilds: where they are, who lives there and who is beaten
  const vv = p.villages && typeof p.villages === 'object' ? p.villages : {};
  const villages = {
    list: (Array.isArray(vv.list) ? vv.list.slice(0, 8) : []).filter((v) => typeof v?.id === 'string' && /^v[a-z0-9]{1,20}$/.test(v.id)
      && int(v.x, -1e6, 1e6) !== null && int(v.z, -1e6, 1e6) !== null && VILLAGE_RACES.includes(v.race)
      && Array.isArray(v.folk) && v.folk.length <= 16 && v.folk.every((f) => Array.isArray(f) && int(f[0], 0, 3) !== null && int(f[1], 1, 499) !== null)
      && Array.isArray(v.dead) && v.dead.every((i) => int(i, 0, 15) !== null))
      .map((v) => ({ id: v.id, x: v.x, z: v.z, race: v.race, size: ['small', 'village', 'big'].includes(v.size) ? v.size : 'village', folk: v.folk.map(([a, b]) => [a, b]), dead: [...new Set(v.dead)], looted: false })),
    due: (Array.isArray(vv.due) ? vv.due.slice(0, 8) : []).filter((t) => int(t, 0, 1e15) !== null),
  };
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
  const room = p.room && int(p.room.until, 0, 1e15) !== null ? { until: p.room.until, n: int(p.room.n ?? 1, 1, 3) ?? 1 } : null;
  // visiting your parents (play time of the last visit), and whether you once left them unvisited
  const visitPlay = int(p.visitPlay ?? 0, 0, 1e15) ?? 0;
  const neglect = p.neglect === true || character.neglect === true; // once a sinner, always (this life)
  // lives only ever go down; an undying character (level 250+) can be renewed younger after old age
  // a hired bodyguard: which kind, and until when (at most 3 hours ahead)
  const guard = p.guard && BODYGUARDS[p.guard.tier] && int(p.guard.until, 0, Date.now() + 3 * 3600 * 1000 + 60000) !== null ? { tier: p.guard.tier, until: p.guard.until } : null;
  // married: a player spouse is set only by the server (see family.js); a townsperson by the game
  const okStr = (v, n) => typeof v === 'string' && v.length > 0 && v.length <= n;
  const spouse = character.spouse?.npc === false ? character.spouse
    : p.spouse && p.spouse.npc === true && okStr(p.spouse.name, 24) && RACES[p.spouse.race] && CLASSES[p.spouse.cls] && canMarry(character)
      ? { name: p.spouse.name, race: p.spouse.race, cls: p.spouse.cls, npc: true, since: int(p.spouse.since, 0, 1e15) ?? Date.now() } : (character.spouse || null);
  const children = (Array.isArray(p.children) ? p.children : character.children || []).slice(0, MAX_CHILDREN)
    .filter((k) => okStr(k?.name, 24) && RACES[k.race] && (k.school == null || SCHOOLS[k.school]))
    .map((k) => ({ name: k.name, race: k.race, plan: { a: CLASSES[k.plan?.a] ? k.plan.a : null, b: CLASSES[k.plan?.b] ? k.plan.b : null }, school: k.school || null, born: int(k.born, 0, 1e15) ?? 0 }));
  // a newcomer's first journey: which steps are done, and whether it was hidden
  const journey = p.journey === undefined ? (character.journey || null) : p.journey && Array.isArray(p.journey.seen)
    ? { seen: [...new Set(p.journey.seen.filter((s) => typeof s === 'string' && /^[a-z_]{1,20}$/.test(s)))].slice(0, 40), off: p.journey.off === true } : null;
  const lastChildPlay = int(p.lastChildPlay ?? character.lastChildPlay ?? 0, 0, 1e15) ?? 0;
  const storedLives = Number.isInteger(character.livesLeft) ? character.livesLeft : LIVES;
  const livesLeft = Math.min(storedLives, int(p.livesLeft ?? storedLives, 0, 1e9) ?? storedLives); // (an admin may give more than 3)
  const ageShift = character.level >= UNDYING_LEVEL && Number.isFinite(p.ageShift) && p.ageShift <= 0 && p.ageShift > -1e5 ? p.ageShift : (character.ageShift || 0);
  const growth = { work: int(p.growth?.work ?? 0, 0, 1e9) ?? 0, trials: int(p.growth?.trials ?? 0, 0, 1e6) ?? 0 };
  // a broken bone from a bad fall, and the treatments it has had (one a day)
  // a day pass bought at a city's inner gate: which ring, which city, until when (one day of the realm)
  const dp = p.dayPass;
  const dayPass = dp && PASS_ORDER.includes(dp.tier) && (dp.city == null || (typeof dp.city === 'string' && dp.city.length <= 32)) && int(dp.until, 0, Date.now() + DAY_PASS_MS + 60000) !== null
    ? { tier: dp.tier, city: dp.city || null, until: dp.until } : null;
  // the real-world country the player said they are from (a flag on the ID), or none
  if (p.country !== undefined && cleanCountry(p.country) !== (character.country ?? null)) {
    character.country = cleanCountry(p.country);
    await db.run('UPDATE accounts SET country = ? WHERE id = ?', character.country, accountId); // (kept for the next life too)
  }
  const injury = p.injury && ['leg', 'arm', 'ribs'].includes(p.injury.part) && int(p.injury.left, 1, 5) !== null
    ? { part: p.injury.part, left: p.injury.left, lastTreat: int(p.injury.lastTreat ?? 0, 0, 1e15) ?? 0 } : null;
  const torches = (Array.isArray(p.torches) ? p.torches.slice(0, 10) : [])
    .filter((t) => Number.isFinite(t?.x) && Number.isFinite(t?.z) && Math.abs(t.x) < 1e6 && Math.abs(t.z) < 1e6)
    .map((t) => ({ x: t.x, z: t.z }));
  // Skills: known skill ids, up to 6 on keys
  const skills = (Array.isArray(p.skills) ? p.skills.slice(0, 200) : []).filter((id) => typeof id === 'string' && SKILLS[id]);
  // techniques learned as a child at school (two per school)
  const techniques = [...new Set((Array.isArray(p.techniques) ? p.techniques.slice(0, 20) : []).filter((id) => typeof id === 'string' && SKILLS[id]))];
  const skillBar = (Array.isArray(p.skillBar) ? p.skillBar.slice(0, 6) : [])
    .filter((b) => SKILLS[b?.id] && (b.key === null || (typeof b.key === 'string' && /^[A-Za-z0-9]{1,20}$/.test(b.key))))
    .map((b) => ({ id: b.id, key: b.key }));
  // Spells you know, and which one the attack key casts
  const spells = [...new Set((Array.isArray(p.spells) ? p.spells.slice(0, 100) : []).filter((id) => typeof id === 'string' && SPELLS[id]))];
  const spellPick = int(p.spellPick ?? 0, 0, 10) ?? 0;
  const skillPicks = int(p.skillPicks ?? 0, 0, 1000) ?? 0;
  const t = p.tent;
  const tent = t && Number.isFinite(t.x) && Number.isFinite(t.z) && Math.abs(t.x) < 1e6 && Math.abs(t.z) < 1e6
    ? { x: t.x, z: t.z, heading: Number.isFinite(t.heading) ? t.heading : 0 } : null;
  // a cult's dark pact or the Order's holy blessing
  character.pact = ['dark', 'holy'].includes(p.pact) ? p.pact : null;
  // real time played (it only ever grows)
  const playMs = int(Math.round(Number(p.playMs) || 0), 0, 1e13);
  if (playMs !== null && playMs >= (character.playMs || 0)) character.playMs = playMs;
  // a child's school and time trained at each (never more than the time they have lived)
  if (character.child && p.child && typeof p.child === 'object') {
    const lived = Math.max(0, (character.playMs || 0) - (character.child.bornPlay || 0)) + 60000;
    const train = {};
    for (const [k, v] of Object.entries(p.child.train || {})) if (SCHOOLS[k] && Number.isFinite(v) && v > 0) train[k] = Math.min(Math.round(v), lived);
    character.child.train = train;
    character.child.school = SCHOOLS[p.child.school] ? p.child.school : null;
  }
  // the Hunter's Guild Card: asked for (pending) or read by the crystal (with a rank)
  const gc = p.guildCard;
  if (gc && typeof gc === 'object') {
    const t = (v) => (Number.isFinite(v) && v > 0 ? Math.round(v) : Date.now());
    if (gc.pending === true) character.guildCard = { pending: true, issued: t(gc.issued) };
    else if (CARD_RANKS.some((r) => r.id === gc.rank)) character.guildCard = { rank: gc.rank, level: int(gc.level, 1, 10000) ?? 1, issued: t(gc.issued), assessed: t(gc.assessed) };
  }
  // monster players from level 100 can switch to their humanoid form and back
  if ((p.form === 'monster' || p.form === 'humanoid') && mayChangeForm({ ...character, level: fields.level ?? character.level })) character.form = p.form;
  // the beds you planted (data/crops.mjs) and where you left your mount (data/mounts.mjs)
  const crops = cleanBeds(p.crops);
  const mount = p.mount && ITEMS[p.mount.item]?.kind === 'mount' && Number.isFinite(p.mount.x) && Number.isFinite(p.mount.z)
    ? { item: p.mount.item, x: Math.round(p.mount.x * 10) / 10, z: Math.round(p.mount.z * 10) / 10 } : null;
  // the names you gave your dragons and mounts (for voice commands), by their item id
  const petNames = {};
  if (p.petNames && typeof p.petNames === 'object') {
    for (const [item, name] of Object.entries(p.petNames).slice(0, 12)) {
      const clean = ITEMS[item]?.kind === 'mount' ? cleanPetName(name) : null;
      if (clean) petNames[item] = clean;
    }
  }
  Object.assign(character, fields, { petNames, crops, mount, stats, inventory, equipped, boosts, quests, questNext, questDay, guildQuests, guildNext, room, injury, dayPass, growth, visitPlay, neglect, guard, livesLeft, ageShift, spouse, children, lastChildPlay, techniques, torches, skills, skillBar, skillPicks, spells, spellPick, tent, potionMaker, trained, caves, villages, journey });
  await store(accountId, character);
  return { ok: true };
}

async function store(accountId, character) {
  await db.run('UPDATE characters SET data = ?, updated_at = now() WHERE account_id = ?', JSON.stringify(character), accountId);
}

// The highest-level characters on the server (EXP breaks ties)
async function top(limit = 10) {
  return (await db.all('SELECT data FROM characters'))
    .map((r) => JSON.parse(r.data))
    .map((c) => ({ name: c.name, race: c.race, cls: c.cls, side: c.side, level: c.level || 1, exp: c.exp || 0 }))
    .sort((a, b) => b.level - a.level || b.exp - a.exp)
    .slice(0, limit);
}

module.exports = { tuning, withTuning, cleanItem, create, fall, rankUp, load, store, saveLocation, saveProgress, top, ceremony, recentCeremonies, keepAppraisalHeld };
