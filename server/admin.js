// The admin board: the game owner can see every account and character, set a new password for a
// player who forgot theirs, sign an account out everywhere, or delete it.
// Admins are the accounts whose emails are listed in the ADMIN_EMAILS setting (comma-separated).
// Passwords are stored hashed, so nobody (admins included) can read them; they can only be replaced.
const db = require('./db');
const mail = require('./mail');
const { checkBirthdate, ageOf } = require('../public/js/data/birthdate.mjs');
const { hashPassword, shownEmail } = require('./auth');

const adminEmails = () => (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
// (once emails can be sent, only after the admin has confirmed the email, so nobody else can sign up with it)
const isAdmin = (account) => !!account && adminEmails().includes(String(account.email).toLowerCase()) && (!!account.email_verified || !mail.ready());

async function accounts() {
  const rows = await db.all(`
    SELECT a.id, a.email, a.username, a.created_at, a.birthdate, c.data, c.updated_at,
      (SELECT COUNT(*)::int FROM sessions s WHERE s.account_id = a.id) AS sessions,
      (SELECT COUNT(*)::int FROM lands l WHERE l.account_id = a.id) AS plots
    FROM accounts a LEFT JOIN characters c ON c.account_id = a.id
    ORDER BY a.id DESC`);
  return {
    accounts: rows.map((r) => {
      const c = r.data ? JSON.parse(r.data) : null;
      return {
        id: r.id, email: shownEmail(r.email), username: r.username, birthdate: r.birthdate || null, age: ageOf(r.birthdate), createdAt: r.created_at, lastPlayed: r.updated_at,
        signedIn: r.sessions > 0, plots: r.plots, admin: adminEmails().includes(r.email.toLowerCase()),
        character: c && { name: c.name, race: c.race, cls: c.cls, form: c.form, level: c.level, coins: c.coins, exp: c.exp },
      };
    }),
  };
}

async function setPassword({ id, password }, me) {
  password = String(password || '');
  if (password.length < 8) return { error: 'The new password needs at least 8 characters.' };
  const row = await db.get('SELECT id, username FROM accounts WHERE id = ?', Number(id) || 0);
  if (!row) return { error: 'No such account.' };
  await db.run('UPDATE accounts SET password_hash = ? WHERE id = ?', hashPassword(password), row.id);
  await db.run('DELETE FROM sessions WHERE account_id = ?', row.id); // sign them out everywhere
  await log(me, 'new password', row.username);
  return { ok: true, target: row.id };
}

// a player's birth date was typed wrong: the admin can set it (players can't change it themselves)
async function setBirthdate({ id, birthdate }) {
  const born = checkBirthdate(birthdate);
  if (born.error) return born;
  const { changes } = await db.run('UPDATE accounts SET birthdate = ? WHERE id = ?', born.date, Number(id) || 0);
  return changes ? { ok: true } : { error: 'No such account.' };
}

async function signOutEverywhere({ id }) {
  await db.run('DELETE FROM sessions WHERE account_id = ?', Number(id) || 0);
  return { ok: true };
}

async function remove({ id }, me) {
  const row = await db.get('SELECT id, email, username FROM accounts WHERE id = ?', Number(id) || 0);
  if (!row) return { error: 'No such account.' };
  if (row.id === me.id) return { error: 'You can\'t delete your own admin account from here.' };
  // the account's sessions, character and land go with it
  // everything that belongs to the account is removed with it (ON DELETE CASCADE)
  await db.run('DELETE FROM accounts WHERE id = ?', row.id);
  await log(me, 'delete account', row.username || row.email);
  return { ok: true };
}


// ---------- the bigger admin board ----------
const characters = require('./characters');
const K = require('../public/js/data/kings.mjs');
const S = require('../public/js/data/social.mjs');
const B = require('../public/js/data/birth.mjs');
const { ITEMS } = require('../public/js/data/items.mjs');
const { PLACES, toWorld } = require('../public/js/data/world-layout.mjs');
const G = require('../public/js/data/game-data.mjs');
const { SKILLS, SKILL_CATEGORIES, skillCategory, skillPower } = require('../public/js/data/skills.mjs');
const { SPELLS } = require('../public/js/data/spells.mjs');
const U = require('../public/js/data/unique.mjs');
const P = require('../public/js/data/citypass.mjs');
const cults = require('./cults');
const CU = require('../public/js/data/cults.mjs');

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const int = (v, min, max) => { const n = num(v); return n !== null && Number.isInteger(n) && n >= min && n <= max ? n : null; };
const short = (v, n) => String(v ?? '').trim().slice(0, n);

// Every change made here is written down, so the owner can always see what was done and when
async function log(me, action, target, detail) {
  await db.run('INSERT INTO admin_log (at, admin, action, target, detail) VALUES (?, ?, ?, ?, ?)', Date.now(), me?.username || '?', action, target || null, detail || null);
}
const accountById = (id) => db.get('SELECT id, username, email FROM accounts WHERE id = ?', int(id, 1, 2e9) || 0);

// The numbers at the top of the board
async function stats() {
  const now = Date.now();
  const r = await db.get(`SELECT
      (SELECT COUNT(*)::int FROM accounts) AS accounts,
      (SELECT COUNT(*)::int FROM characters) AS characters,
      (SELECT COUNT(*)::int FROM accounts WHERE last_seen > ?) AS online,
      (SELECT COUNT(*)::int FROM characters WHERE updated_at > now() - interval '24 hours') AS today,
      (SELECT COUNT(*)::int FROM accounts WHERE banned_until = -1 OR banned_until > ?) AS banned,
      (SELECT COUNT(*)::int FROM reports WHERE NOT done) AS reports`, now - S.ONLINE_MS, now);
  return { stats: r };
}

// One player's full card: the account and everything about the character
async function player({ id }) {
  const a = await db.get(`SELECT a.id, a.username, a.email, a.created_at, a.last_seen, a.banned_until, a.ban_reason, a.muted_until, a.country, a.birthdate,
      c.data, c.updated_at,
      (SELECT COUNT(*)::int FROM lands l WHERE l.account_id = a.id) AS plots,
      (SELECT COUNT(*)::int FROM cave_owners v WHERE v.account_id = a.id) AS caves,
      (SELECT COUNT(*)::int FROM city_homes h WHERE h.account_id = a.id) AS homes
    FROM accounts a LEFT JOIN characters c ON c.account_id = a.id WHERE a.id = ?`, int(id, 1, 2e9) || 0);
  if (!a) return { error: 'No such account.' };
  const c = a.data ? JSON.parse(a.data) : null;
  const now = Date.now();
  return {
    player: {
      id: a.id, username: a.username, email: shownEmail(a.email), createdAt: a.created_at, lastPlayed: a.updated_at, country: a.country || null,
      online: now - (a.last_seen || 0) < S.ONLINE_MS,
      banned: a.banned_until === -1 || a.banned_until > now ? { until: a.banned_until, reason: a.ban_reason || '' } : null,
      muted: a.muted_until > now ? { until: a.muted_until } : null,
      owns: { plots: a.plots, caves: a.caves, homes: a.homes },
      character: c && {
        name: c.name, race: c.race, cls: c.cls, form: c.form, level: c.level, exp: c.exp, coins: c.coins, hp: c.hp, sp: c.sp,
        stats: c.stats, unspentPoints: c.unspentPoints, livesLeft: c.livesLeft, injury: c.injury || null, location: c.location || null,
        inventory: (c.inventory || []).map((s) => ({ ...s, name: ITEMS[s.id]?.name || s.id, icon: ITEMS[s.id]?.icon || '' })),
        equipped: c.equipped || {}, uniqueSkill: c.uniqueSkill || null, child: B.isChild(c) ? { age: Math.floor(B.ageOf(c) * 10) / 10 } : null,
        skills: c.skills || [], spells: c.spells || [], pact: c.pact || null, elements: c.elements || [], extraHp: c.extraHp || 0,
        cityAccess: c.cityAccess || null, cityPass: P.cityPass(c), lives: c.lives || 1,
      },
      pastLives: await pastLives(a.id),
      leads: c ? CU.leads(await cultsState(), c.name) : null,
    },
  };
}
const cultsState = async () => { const r = await db.get("SELECT data FROM world_state WHERE key = 'cults'"); return r ? JSON.parse(r.data) : { leaders: {} }; };

// ---------- past lives ----------
// Every life a player has lost is kept whole (characters.fall). The admins can read them, change
// one, and bring the player back to it.
const lifeSummary = (r) => { const c = JSON.parse(r.data); return { id: r.id, at: r.at, cause: r.cause, name: c.name, race: c.race, cls: c.cls, level: c.level, coins: c.coins, livesLeft: c.livesLeft ?? null, unique: c.uniqueSkill ? `${c.uniqueSkill.name} (${c.uniqueSkill.rank})` : null }; };
async function pastLives(accountId) {
  const rows = await db.all('SELECT id, at, cause, data FROM past_lives WHERE account_id = ? ORDER BY id DESC LIMIT 50', accountId);
  const fell = await db.get('SELECT data FROM fallen WHERE account_id = ?', accountId);
  return { lives: rows.map(lifeSummary), passedOn: fell ? JSON.parse(fell.data) : null };
}
// body: { id (account), life (past life id), name, level, coins, lives, race, cls }
async function editPastLife(body, me) {
  const acc = await accountById(body.id);
  const row = acc && await db.get('SELECT id, data FROM past_lives WHERE id = ? AND account_id = ?', int(body.life, 1, 2e9) || 0, acc.id);
  if (!row) return { error: 'No such past life.' };
  const c = JSON.parse(row.data);
  const said = [];
  const r = changeCharacter(c, body, said);
  if (r?.error) return r;
  if (!said.length) return { error: 'Nothing to change.' };
  await db.run('UPDATE past_lives SET data = ? WHERE id = ?', JSON.stringify(c), row.id);
  await log(me, 'edit past life', acc.username, `${c.name}: ${said.join(', ')}`);
  return { ok: true, ...(await player({ id: acc.id })) };
}
// Bring a player back to a past life: it becomes their character again (with at least one life),
// and the life they have now is kept among the past lives, so it can be brought back too.
async function restoreLife(body, me) {
  const acc = await accountById(body.id);
  const row = acc && await db.get('SELECT id, data FROM past_lives WHERE id = ? AND account_id = ?', int(body.life, 1, 2e9) || 0, acc.id);
  if (!row) return { error: 'No such past life.' };
  const back = JSON.parse(row.data);
  const now = await characters.load(acc.id);
  back.adminRev = Math.max(back.adminRev || 0, now?.adminRev || 0) + 1; // an open game reloads instead of saving over it
  if (!Number.isInteger(back.livesLeft) || back.livesLeft < 1) back.livesLeft = 1;
  back.hp = null; back.injury = null;
  delete back.tuning;
  await db.tx(async (t) => {
    if (now) await t.run('INSERT INTO past_lives (account_id, at, cause, data) VALUES (?, ?, ?, ?)', acc.id, Date.now(), 'set aside by an admin', JSON.stringify(now));
    await t.run('DELETE FROM past_lives WHERE id = ?', row.id);
    await t.run('DELETE FROM fallen WHERE account_id = ?', acc.id);
    await t.run('INSERT INTO characters (account_id, data) VALUES (?, ?) ON CONFLICT (account_id) DO UPDATE SET data = excluded.data, updated_at = now()', acc.id, JSON.stringify(back));
  });
  await log(me, 'return to past life', acc.username, `${back.name}, Lv ${back.level} ${back.race} ${back.cls}`);
  return { ok: true, ...(await player({ id: acc.id })) };
}

// ---------- the two sects ----------
// body: { side: 'dark'|'light', id (account, or none to take the title away) }
async function appointLeader(body, me) {
  const side = body.side === 'dark' ? 'dark' : body.side === 'light' ? 'light' : null;
  if (!side) return { error: 'Which sect?' };
  if (!body.id) {
    const r = await cults.appoint(side, null);
    if (r.error) return r;
    await log(me, 'remove sect leader', r.before, side === 'dark' ? 'evil sect' : 'good sect');
    return { ok: true, leaders: await cults.leaders() };
  }
  const acc = await accountById(body.id);
  const c = acc && await characters.load(acc.id);
  if (!c) return { error: 'This account has no character.' };
  if (B.isChild(c)) return { error: 'A child can\'t lead a sect.' };
  const r = await cults.appoint(side, c.name);
  if (r.error) return r;
  // they serve that side now: the dark pact (spells, dark and stronger), or the Light with its Book
  await editCharacter(acc.id, (ch) => {
    ch.pact = side === 'dark' ? 'dark' : 'holy';
    if (side === 'light' && !(ch.inventory || []).some((x) => x.id === 'dawn_book') && ITEMS.dawn_book) (ch.inventory ||= []).push({ id: 'dawn_book', n: 1 });
  });
  await log(me, 'appoint sect leader', acc.username, `${side === 'dark' ? 'evil sect (Dark Side)' : 'good sect (Order of the Dawn)'}${r.before ? `, replacing ${r.before}` : ''}`);
  return { ok: true, leaders: await cults.leaders(), ...(await player({ id: acc.id })) };
}

// ---------- health and healing numbers ----------
async function tuning() { return { tuning: await characters.tuning(), defaults: G.TUNING_DEFAULT }; }
async function setTuning(body, me) {
  const t = G.cleanTuning(body);
  await db.run("INSERT INTO world_state (key, data) VALUES ('tuning', ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data", JSON.stringify(t));
  await log(me, 'health numbers', null, `base HP ${t.hpBase}, +${t.hpPerLevel} HP a level, heals +${t.healPerLevel}% a level`);
  return { ok: true, tuning: t, defaults: G.TUNING_DEFAULT };
}

// ---------- skills ----------
// Every Unique Skill held in the world, by kind (defence to attack), highest rank first
async function skillsBoard() {
  const rows = await db.all('SELECT a.id, a.username, c.data FROM characters c JOIN accounts a ON a.id = c.account_id');
  const held = rows.map((r) => { const c = JSON.parse(r.data); return { id: r.id, username: r.username, name: c.name, level: c.level || 1, u: c.uniqueSkill }; }).filter((x) => x.u?.name);
  return {
    categories: SKILL_CATEGORIES.map((k) => ({
      ...k,
      uniques: held.filter((x) => (U.UNIQUE_CATEGORY[U.uniqueByName(x.u.name)?.kind || x.u.kind] || 'attack') === k.id)
        .sort((a, b) => U.byRank(a.u, b.u) || b.level - a.level)
        .map((x) => ({ id: x.id, username: x.username, name: x.name, level: x.level, skill: x.u.name, rank: U.rankOf(x.u), element: x.u.element || '' })),
      skills: Object.values(SKILLS).filter((sk) => skillCategory(sk) === k.id).sort((a, b) => skillPower(b) - skillPower(a)).map((sk) => ({ id: sk.id, name: sk.name, icon: sk.icon, text: sk.text })),
    })),
  };
}

// The changes the board can make to a character (alive, or a past life). Pushes what changed onto
// `said`; returns { error } when something is wrong.
function changeCharacter(c, body, said) {
  if (body.name != null) { const v = short(body.name, 24); if (!v) return { error: 'Type a name.' }; said.push(`name ${c.name} → ${v}`); c.name = v; }
  if (body.level != null) {
    const v = int(body.level, 1, 10000);
    if (v === null) return { error: 'Level is 1 to 10000.' };
    // raising the level brings the Stat Points of every level gained (3 a level, 10 at key levels);
    // lowering it takes nothing back
    const pts = v > (c.level || 1) ? G.pointsForLevels(c.level || 1, v) : 0;
    said.push(`level ${c.level} → ${v}${pts ? ` (+${pts} Stat Points)` : ''}`);
    c.unspentPoints = (c.unspentPoints || 0) + pts;
    c.level = v; c.exp = 0;
  }
  if (body.coins != null) { const v = int(body.coins, 0, 1e12); if (v === null) return { error: 'Coins must be a whole number, 0 or more.' }; said.push(`coins ${c.coins} → ${v}`); c.coins = v; }
  if (body.lives != null) { const v = int(body.lives, 0, 1e9); if (v === null) return { error: 'Lives must be a whole number.' }; said.push(`lives ${c.livesLeft ?? 3} → ${v}`); c.livesLeft = v; }
  if (body.race != null && body.race !== c.race) {
    if (!G.RACES[body.race]) return { error: 'No such race.' };
    const from = c.race;
    G.changeRace(c, body.race);
    said.push(`race ${from} → ${body.race}`);
  }
  if (body.cls != null && body.cls !== c.cls) {
    if (!G.CLASSES[body.cls] || body.cls === 'child') return { error: 'No such class.' };
    const from = c.cls;
    if (c.cls === 'child') { if (!G.growUp(c, body.cls)) return { error: 'That class can\'t be given.' }; }
    else G.changeClass(c, body.cls);
    said.push(`class ${from} → ${body.cls}`);
  }
  return null;
}

// The rest of the admins' powers over one character (see edit)
function morePowers(c, body, said) {
  const r = changeCharacter(c, { name: body.rename, level: body.level, race: body.race, cls: body.cls, lives: body.lives }, said);
  if (r?.error) return r;
  if (body.extraHp != null) { const v = int(body.extraHp, 0, 1e9); if (v === null) return { error: 'Extra HP must be 0 or more.' }; said.push(`extra HP ${c.extraHp || 0} → ${v}`); c.extraHp = v; c.hp = null; }
  if (body.cityAccess !== undefined) {
    const v = body.cityAccess || null;
    if (v !== null && !P.PASS_ORDER.includes(v)) return { error: 'No such ring of the city.' };
    said.push(`city pass granted: ${v ? P.PASS_NAME[v] : 'none'}`);
    c.cityAccess = v;
  }
  if (body.addSkill) {
    if (!SKILLS[body.addSkill]) return { error: 'No such skill.' };
    c.skills ||= [];
    if (c.skills.includes(body.addSkill)) return { error: 'They know that skill already.' };
    c.skills.push(body.addSkill);
    c.skillBar ||= [];
    if (c.skillBar.length < 6) c.skillBar.push({ id: body.addSkill, key: null });
    said.push(`gave skill ${SKILLS[body.addSkill].name}`);
  }
  if (body.removeSkill) {
    if (!(c.skills || []).includes(body.removeSkill)) return { error: 'They don\'t know that skill.' };
    c.skills = c.skills.filter((x) => x !== body.removeSkill);
    c.skillBar = (c.skillBar || []).filter((b) => b.id !== body.removeSkill);
    said.push(`took skill ${SKILLS[body.removeSkill]?.name || body.removeSkill}`);
  }
  if (body.addSpell) {
    if (!SPELLS[body.addSpell]) return { error: 'No such spell.' };
    c.spells ||= [];
    if (c.spells.includes(body.addSpell)) return { error: 'They know that spell already.' };
    c.spells.push(body.addSpell);
    said.push(`gave spell ${SPELLS[body.addSpell].name}`);
  }
  if (body.removeSpell) {
    c.spells = (c.spells || []).filter((x) => x !== body.removeSpell);
    said.push(`took spell ${SPELLS[body.removeSpell]?.name || body.removeSpell}`);
  }
  if (body.unique) {
    const u = U.uniqueByName(body.unique.name);
    if (!u) return { error: 'No Unique Skill has that name. Pick one from the list as you type.' };
    const rank = u.kind === 'appraise' ? U.APPRAISAL.rank : U.UNIQUE_RANKS.includes(body.unique.rank) ? body.unique.rank : U.rankOf(c.uniqueSkill);
    const before = c.uniqueSkill ? `${c.uniqueSkill.name} (${c.uniqueSkill.rank})` : 'none';
    c.uniqueSkill = { ...U.uniqueSlot({ ...u, rank }), born: rank, raised: 0 };
    said.push(`Unique Skill ${before} → ${u.name} (${rank})`);
  }
  return null;
}

// What the board can give: every item, and every named place to send someone to
function catalogue() {
  return {
    items: Object.entries(ITEMS).map(([id, it]) => ({ id, name: it.name, icon: it.icon || '', kind: it.kind })).sort((x, y) => x.name.localeCompare(y.name)),
    places: PLACES.map((p) => ({ id: p.id, name: p.name, city: !!p.city })),
    races: Object.keys(K.CASTLES),
    allRaces: Object.entries(G.RACES).map(([id, r]) => ({ id, name: r.name, side: r.side })),
    classes: Object.entries(G.CLASSES).filter(([id]) => id !== 'child').map(([id, k]) => ({ id, name: k.name })),
    rings: P.PASS_ORDER.map((id) => ({ id, name: P.PASS_NAME[id] })),
    categories: SKILL_CATEGORIES,
    skills: Object.values(SKILLS).map((sk) => ({ id: sk.id, name: sk.name, icon: sk.icon, category: skillCategory(sk), power: skillPower(sk) })),
    spells: Object.values(SPELLS).map((sp) => ({ id: sp.id, name: sp.name, element: sp.element, level: sp.level })),
    uniqueRanks: U.UNIQUE_RANKS,
    uniques: [U.APPRAISAL.name, ...U.UNIQUE_SKILLS.map((u) => u.name)],
  };
}

// Change a character. The change is marked (adminRev), so a game that is open with the old copy
// reloads instead of saving over it.
async function editCharacter(id, fn) {
  const acc = await accountById(id);
  if (!acc) return { error: 'No such account.' };
  const c = await characters.load(acc.id);
  if (!c) return { error: 'This account has no character.' };
  const r = fn(c);
  if (r?.error) return r;
  c.adminRev = (c.adminRev || 0) + 1;
  await characters.store(acc.id, c);
  return { ok: true, acc, said: r?.said || '' };
}

// body: { id, coins, addCoins, level, exp, stat: {key, value}, points, addItem: {id, n}, removeItem: {index, n}, heal, lives,
//   rename, race, cls, extraHp, cityAccess, addSkill, removeSkill, addSpell, removeSpell, unique: {name, rank} }
async function edit(body, me) {
  const said = [];
  const r = await editCharacter(body.id, (c) => {
    if (body.coins != null) { const v = int(body.coins, 0, 1e12); if (v === null) return { error: 'Coins must be a whole number, 0 or more.' }; said.push(`coins ${c.coins} → ${v}`); c.coins = v; }
    if (body.addCoins != null) { const v = int(body.addCoins, -1e12, 1e12); if (v === null) return { error: 'Bad number of coins.' }; const to = Math.max(0, (c.coins || 0) + v); said.push(`coins ${c.coins} → ${to}`); c.coins = to; }
    if (body.exp != null) { const v = int(body.exp, 0, 1e12); if (v === null) return { error: 'Bad EXP.' }; said.push(`EXP ${c.exp} → ${v}`); c.exp = v; }
    if (body.points != null) { const v = int(body.points, 0, 1e6); if (v === null) return { error: 'Bad Stat Points.' }; said.push(`unspent points ${c.unspentPoints || 0} → ${v}`); c.unspentPoints = v; }
    if (body.stat) {
      const k = String(body.stat.key || ''), v = int(body.stat.value, 0, 1e6);
      if (!c.stats || !(k in c.stats) || v === null) return { error: 'Choose a stat and a number.' };
      said.push(`${k} ${c.stats[k]} → ${v}`); c.stats[k] = v;
    }
    const more = morePowers(c, body, said);
    if (more?.error) return more;
    if (body.heal) { c.injury = null; c.hp = Math.max(c.hp || 0, 1e6); c.fatigue = 0; said.push('healed (HP full, bones mended, rested)'); }
    if (body.addItem) {
      const n = int(body.addItem.n ?? 1, 1, 1e6);
      const it = ITEMS[body.addItem.id];
      if (!it || n === null) return { error: 'Choose an item and how many.' };
      c.inventory ||= [];
      const gear = it.kind === 'weapon' || it.kind === 'armour';
      if (gear) {
        if (c.inventory.length + n > 60) return { error: 'The bag would be over 60 slots.' };
        for (let i = 0; i < n; i++) c.inventory.push({ id: body.addItem.id, n: 1, uid: `g${Date.now().toString(36)}${i.toString(36)}${Math.random().toString(36).slice(2, 6)}` });
      } else {
        const stack = c.inventory.find((s) => s.id === body.addItem.id && !s.uid);
        if (stack) stack.n += n; else { if (c.inventory.length >= 60) return { error: 'The bag is full (60 slots).' }; c.inventory.push({ id: body.addItem.id, n }); }
      }
      said.push(`gave ${n} × ${it.name}`);
    }
    if (body.removeItem) {
      const i = int(body.removeItem.index, 0, 59);
      const s = i !== null && c.inventory?.[i];
      if (!s) return { error: 'That bag slot is empty.' };
      const n = Math.min(s.n, int(body.removeItem.n ?? s.n, 1, 1e6) || s.n);
      s.n -= n;
      if (s.n <= 0) {
        c.inventory.splice(i, 1);
        for (const [slot, uid] of Object.entries(c.equipped || {})) if (uid && uid === s.uid) c.equipped[slot] = null;
      }
      said.push(`took ${n} × ${ITEMS[s.id]?.name || s.id}`);
    }
    if (!said.length) return { error: 'Nothing to change.' };
    return { said: said.join(', ') };
  });
  if (r.error) return r;
  await log(me, 'edit', r.acc.username, r.said);
  return { ok: true, ...(await player({ id: r.acc.id })) };
}

// Send a character to a named place, or to exact map coordinates (metres)
async function move(body, me) {
  let to;
  if (body.place) {
    const p = PLACES.find((x) => x.id === body.place);
    if (!p) return { error: 'No such place.' };
    to = { area: p.name, ...toWorld(p.px, p.py) };
  } else {
    const x = num(body.x), z = num(body.z);
    if (x === null || z === null || Math.abs(x) > 1e6 || Math.abs(z) > 1e6) return { error: 'Type the X and Z where they should go.' };
    to = { area: short(body.area, 40) || 'Moved by an admin', x, z };
  }
  const r = await editCharacter(body.id, (c) => {
    c.location = { ...(c.location || {}), area: to.area, x: Math.round(to.x * 100) / 100, y: 0, z: Math.round(to.z * 100) / 100 };
    return { said: `to ${to.area} (${Math.round(to.x)}, ${Math.round(to.z)})` };
  });
  if (r.error) return r;
  await log(me, 'move', r.acc.username, r.said);
  return { ok: true, ...(await player({ id: r.acc.id })) };
}

// Ban for some days (or forever), with a reason the player is shown; signs them out everywhere
async function ban(body, me) {
  const acc = await accountById(body.id);
  if (!acc) return { error: 'No such account.' };
  if (acc.id === me.id) return { error: 'You can\'t ban yourself.' };
  if (body.lift) {
    await db.run('UPDATE accounts SET banned_until = 0, ban_reason = NULL WHERE id = ?', acc.id);
    await log(me, 'unban', acc.username);
    return { ok: true, ...(await player({ id: acc.id })) };
  }
  const days = body.forever ? -1 : int(body.days, 1, 3650);
  if (days === null) return { error: 'Choose how many days, or forever.' };
  const reason = short(body.reason, 200);
  if (!reason) return { error: 'Write the reason. The player will see it.' };
  const until = days === -1 ? -1 : Date.now() + days * 86400000;
  await db.run('UPDATE accounts SET banned_until = ?, ban_reason = ? WHERE id = ?', until, reason, acc.id);
  await db.run('DELETE FROM sessions WHERE account_id = ?', acc.id);
  await log(me, 'ban', acc.username, `${days === -1 ? 'forever' : `${days} day(s)`}: ${reason}`);
  return { ok: true, ...(await player({ id: acc.id })) };
}

async function mute(body, me) {
  const acc = await accountById(body.id);
  if (!acc) return { error: 'No such account.' };
  const minutes = body.lift ? 0 : int(body.minutes, 1, 525600);
  if (minutes === null) return { error: 'Choose for how long.' };
  await db.run('UPDATE accounts SET muted_until = ? WHERE id = ?', minutes ? Date.now() + minutes * 60000 : 0, acc.id);
  await log(me, minutes ? 'mute' : 'unmute', acc.username, minutes ? `${minutes} minute(s)` : '');
  return { ok: true, ...(await player({ id: acc.id })) };
}

// The general chat (and meeting-room chats), newest last. Private messages between friends stay private.
async function chat() {
  const rows = await db.all("SELECT id, channel, from_id, from_name, text, at FROM (SELECT * FROM chat WHERE channel NOT LIKE 'dm:%' ORDER BY id DESC LIMIT 150) AS recent ORDER BY id");
  return { messages: rows.map((r) => ({ id: r.id, channel: r.channel, fromId: r.from_id, from: r.from_name, text: r.text, at: r.at })) };
}
async function deleteMessage({ id }, me) {
  const m = await db.get('SELECT id, from_name, text FROM chat WHERE id = ?', int(id, 1, 2e9) || 0);
  if (!m) return { error: 'That message is gone already.' };
  await db.run('DELETE FROM chat WHERE id = ?', m.id);
  await log(me, 'delete message', m.from_name, m.text.slice(0, 120));
  return { ok: true, ...(await chat()) };
}

async function reports() {
  const rows = await db.all('SELECT r.*, a.id AS target_id FROM reports r LEFT JOIN accounts a ON lower(a.username) = lower(r.target) ORDER BY r.done, r.id DESC LIMIT 200');
  return { reports: rows.map((r) => ({ id: r.id, at: r.at, by: r.by_name, target: r.target, targetId: r.target_id, reason: r.reason, text: r.text, done: r.done })) };
}
async function closeReport({ id }, me) {
  const r = await db.get('SELECT id, target FROM reports WHERE id = ?', int(id, 1, 2e9) || 0);
  if (!r) return { error: 'No such report.' };
  await db.run('UPDATE reports SET done = true WHERE id = ?', r.id);
  await log(me, 'close report', r.target);
  return { ok: true, ...(await reports()) };
}

// A message shown across the top of everyone's screen for a while
async function announce(body, me) {
  if (body.clear) {
    await db.run("DELETE FROM world_state WHERE key = 'announcement'");
    await log(me, 'clear announcement');
    return { ok: true, announcement: null };
  }
  const text = short(body.text, 240);
  const minutes = int(body.minutes ?? 60, 1, 10080);
  if (!text || minutes === null) return { error: 'Write the message and for how long it shows.' };
  const a = { text, at: Date.now(), until: Date.now() + minutes * 60000 };
  await db.run("INSERT INTO world_state (key, data) VALUES ('announcement', ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data", JSON.stringify(a));
  await log(me, 'announce', null, `${text} (${minutes} min)`);
  return { ok: true, announcement: a };
}
async function announcement() {
  const r = await db.get("SELECT data FROM world_state WHERE key = 'announcement'");
  const a = r ? JSON.parse(r.data) : null;
  return a && a.until > Date.now() ? a : null;
}

// Who owns what: land plots (by owner), caves, city houses, and the Kings' thrones
async function world() {
  const plots = await db.all('SELECT l.account_id, a.username, l.owner, COUNT(*)::int AS n, MIN(l.ix) AS ix, MIN(l.iz) AS iz FROM lands l JOIN accounts a ON a.id = l.account_id GROUP BY l.account_id, a.username, l.owner ORDER BY n DESC');
  const caves = await db.all('SELECT v.cave, v.owner, a.username FROM cave_owners v JOIN accounts a ON a.id = v.account_id ORDER BY v.cave');
  const homes = await db.all('SELECT h.city, h.house, h.owner, a.username FROM city_homes h JOIN accounts a ON a.id = h.account_id ORDER BY h.city, h.house');
  const courts = [];
  for (const race of Object.keys(K.CASTLES)) {
    const row = await db.get('SELECT data FROM courts WHERE race = ?', race);
    const c = row ? JSON.parse(row.data) : K.startingCourt(race);
    courts.push({ race, king: c.king, slainAt: c.slainAt || 0, challenge: c.challenge && !c.challenge.settled ? c.challenge : null });
  }
  return { land: plots.map((p) => ({ username: p.username, owner: p.owner, plots: p.n })), caves, homes, courts, announcement: await announcement() };
}

// Take something back from a player: all their land, a cave, or a house
async function take(body, me) {
  if (body.kind === 'land') {
    const acc = await db.get('SELECT id, username FROM accounts WHERE lower(username) = lower(?)', short(body.username, 40));
    if (!acc) return { error: 'No such player.' };
    const { changes } = await db.run('DELETE FROM lands WHERE account_id = ?', acc.id);
    await log(me, 'take land', acc.username, `${changes} plot(s)`);
  } else if (body.kind === 'cave') {
    const { changes } = await db.run('DELETE FROM cave_owners WHERE cave = ?', short(body.cave, 40));
    if (!changes) return { error: 'Nobody owns that cave.' };
    await log(me, 'take cave', null, short(body.cave, 40));
  } else if (body.kind === 'home') {
    const { changes } = await db.run('DELETE FROM city_homes WHERE city = ? AND house = ?', short(body.city, 40), short(body.house, 40));
    if (!changes) return { error: 'Nobody owns that house.' };
    await log(me, 'take house', null, `${short(body.city, 40)} ${short(body.house, 40)}`);
  } else return { error: 'Take what?' };
  return { ok: true, ...(await world()) };
}

// Put a throne back to its starting King (the NPC)
async function resetKing({ race }, me) {
  if (!K.CASTLES[race]) return { error: 'There is no such King.' };
  await db.run('DELETE FROM courts WHERE race = ?', race);
  await log(me, 'reset throne', race);
  return { ok: true, ...(await world()) };
}

// Skip a child's years (4 to 7): they are made 7 at once, so the Ceremony comes as soon as they play
async function skipChildhood(body, me) {
  const r = await editCharacter(body.id, (c) => {
    if (!B.isChild(c)) return { error: 'This character is grown up already.' };
    c.child.bornPlay = (c.playMs || 0) - (B.CEREMONY_AGE - B.BORN_AGE) * B.YEAR_MS - 1000;
    return { said: 'childhood skipped (Ceremony next)' };
  });
  if (r.error) return r;
  await log(me, 'skip childhood', r.acc.username);
  return { ok: true, ...(await player({ id: r.acc.id })) };
}

// A player reports another player
async function report(acc, body) {
  const target = short(body.name, 40);
  const reason = short(body.reason, 40);
  if (!target || !reason) return { error: 'Choose who and why.' };
  if (target.toLowerCase() === String(acc.username).toLowerCase()) return { error: 'You can\'t report yourself.' };
  const t = await db.get('SELECT username FROM accounts WHERE lower(username) = lower(?)', target);
  if (!t) return { error: 'No such player.' };
  const recent = await db.get('SELECT COUNT(*)::int AS n FROM reports WHERE by_id = ? AND at > ?', acc.id, Date.now() - 3600000);
  if (recent.n >= 10) return { error: 'You have sent a lot of reports. Please wait a while.' };
  await db.run('INSERT INTO reports (at, by_id, by_name, target, reason, text) VALUES (?, ?, ?, ?, ?, ?)', Date.now(), acc.id, acc.username, t.username, reason, short(body.text, 500) || null);
  return { ok: true };
}

async function adminLog() {
  const rows = await db.all('SELECT * FROM admin_log ORDER BY id DESC LIMIT 300');
  return { log: rows.map((r) => ({ at: r.at, admin: r.admin, action: r.action, target: r.target, detail: r.detail })) };
}

module.exports = {
  pastLives, editPastLife, restoreLife, appointLeader, tuning, setTuning, skillsBoard, leaders: async () => ({ leaders: await cults.leaders() }),
  isAdmin, accounts, setPassword, setBirthdate, signOutEverywhere, remove, log,
  stats, player, catalogue, edit, move, ban, mute, chat, deleteMessage, reports, closeReport, announce, announcement, world, take, resetKing, adminLog, skipChildhood, report,
};
