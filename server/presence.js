// Seeing other players (see public/js/data/presence.mjs): each game reports its player's spot every
// moment or two and gets back the players close by in the same place. Only the latest spot is kept.
const db = require('./db');
const P = require('../public/js/data/presence.mjs');

const WL = require('../public/js/data/world-layout.mjs');
const { caveById } = require('../public/js/data/depths.mjs');

let lastSweep = 0;

// Live movement (public/js/live.js) goes through Supabase Realtime. The game needs the project's
// address and its public (anon) key. Vercel's Supabase integration adds them as settings
// (SUPABASE_URL and SUPABASE_ANON_KEY, or the NEXT_PUBLIC_ ones); without the key, one is made from
// SUPABASE_JWT_SECRET. Neither is secret: Supabase's public key is meant for browsers, and every
// table has Row Level Security on with no rules, so it can't read or change any game data.
// REALTIME_OFF=1 switches live movement off (players then move with the slower server checks).
const crypto = require('node:crypto');
let liveCache;
function liveConfig() {
  if (liveCache !== undefined) return liveCache;
  const env = process.env;
  if (env.REALTIME_OFF === '1') return (liveCache = null);
  let url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  if (!url) {
    // the project's id is in the database address: db.<ref>.supabase.co, or the user postgres.<ref> on the pooler
    try {
      const u = new URL(env.DATABASE_URL || env.POSTGRES_URL || '');
      const ref = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(u.hostname)?.[1] || /^postgres\.([a-z0-9]+)$/.exec(decodeURIComponent(u.username))?.[1];
      if (ref) url = `https://${ref}.supabase.co`;
    } catch { /* no database address */ }
  }
  let key = (env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (!key && env.SUPABASE_JWT_SECRET) {
    const b = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const head = b({ alg: 'HS256', typ: 'JWT' }), body = b({ iss: 'supabase', role: 'anon', iat: now, exp: now + 10 * 365 * 86400 });
    key = `${head}.${body}.${crypto.createHmac('sha256', env.SUPABASE_JWT_SECRET).update(`${head}.${body}`).digest('base64url')}`;
  }
  liveCache = url && key ? { url, key } : null;
  return liveCache;
}

// In words, where a spot is: the nearest town or landmark and the land it is in
function whereIs(place, x, z) {
  if (place.startsWith('cave:')) return `In ${caveById(place.slice(5))?.name || 'a cave'}`;
  let near = null, best = 900 ** 2;
  for (const p of WL.placesWithPositions()) {
    if (p.cave) continue;
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < best) { best = d; near = p; }
  }
  let land = '';
  try { land = WL.regionName(WL.sample(x, z, {}).region); } catch { /* far outside the map */ }
  const at = near ? (best < 150 ** 2 ? `${near.name}` : `near ${near.name}`) : 'the wilds';
  if (place.startsWith('in:')) {
    const what = place.split(':')[1].replace(/_/g, ' ');
    return `Inside a building (${what}), ${at}${land ? `, ${land}` : ''}`;
  }
  return `${at}${land ? `, ${land}` : ''}`;
}

// How many players are in the world right now
async function onlineCount(now = Date.now()) {
  const r = await db.get('SELECT COUNT(*)::int AS n FROM presence WHERE at > ?', now - P.GONE_MS);
  return r?.n || 0;
}

// Everyone in the world right now, for the admins: who, their character, and where they are
async function online(now = Date.now()) {
  const rows = await db.all(`SELECT p.account_id, p.name, p.x, p.z, p.place, p.pose, p.at, c.data
      FROM presence p LEFT JOIN characters c ON c.account_id = p.account_id
      WHERE p.at > ? ORDER BY lower(p.name)`, now - P.GONE_MS);
  return {
    ok: true,
    players: rows.map((r) => {
      let c = null;
      try { c = r.data ? JSON.parse(r.data) : null; } catch { /* unreadable save */ }
      return {
        id: r.account_id, username: r.name, character: c?.name || null, level: c?.level || null,
        race: c?.race || null, cls: c?.cls || null, side: c?.side || null,
        x: Math.round(r.x), z: Math.round(r.z), place: r.place, pose: r.pose,
        where: whereIs(r.place, r.x, r.z), heard: now - r.at,
      };
    }),
  };
}

// POST /api/presence { x, y, z, heading, speed, place, pose, body?, pet? } -> { players: [...] }
async function report(acc, body = {}, now = Date.now(), isAdmin = false) {
  const me = P.cleanSpot(body);
  const look = P.cleanBody(body.body);
  const pet = P.cleanPet(body.pet);
  await db.run(`INSERT INTO presence (account_id, name, x, y, z, heading, speed, place, pose, body, pet, at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (account_id) DO UPDATE SET name = EXCLUDED.name, x = EXCLUDED.x, y = EXCLUDED.y, z = EXCLUDED.z,
        heading = EXCLUDED.heading, speed = EXCLUDED.speed, place = EXCLUDED.place, pose = EXCLUDED.pose,
        body = COALESCE(EXCLUDED.body, presence.body), pet = EXCLUDED.pet, at = EXCLUDED.at`,
  acc.id, acc.username, me.x, me.y, me.z, me.heading, me.speed, me.place, me.pose, look ? JSON.stringify(look) : null, pet ? JSON.stringify(pet) : null, now);
  const rows = await db.all(`SELECT account_id, name, x, y, z, heading, speed, pose, body, pet FROM presence
      WHERE account_id != ? AND at > ? AND place = ? AND x BETWEEN ? AND ? AND z BETWEEN ? AND ?
      ORDER BY (x - ?) * (x - ?) + (z - ?) * (z - ?) LIMIT ?`,
  acc.id, now - P.GONE_MS, me.place, me.x - P.SEE_FAR, me.x + P.SEE_FAR, me.z - P.SEE_FAR, me.z + P.SEE_FAR,
  me.x, me.x, me.z, me.z, P.MAX_SEEN);
  // now and then, forget players who left long ago
  if (now - lastSweep > 10 * 60 * 1000) {
    lastSweep = now;
    db.run('DELETE FROM presence WHERE at < ?', now - 3600 * 1000).catch(() => {});
  }
  return {
    ok: true,
    me: acc.id,
    ...(body.wantLive ? { live: liveConfig() } : {}),
    ...(isAdmin ? { online: await onlineCount(now) } : {}),
    players: rows.map((r) => ({
      id: r.account_id, name: r.name, x: r.x, y: r.y, z: r.z, heading: r.heading, speed: r.speed, pose: r.pose,
      body: r.body ? JSON.parse(r.body) : null,
      pet: r.pet ? JSON.parse(r.pet) : null,
    })),
  };
}

// Signing out or closing the game: gone at once instead of after a few seconds
const leave = (acc) => db.run('DELETE FROM presence WHERE account_id = ?', acc.id).then(() => ({ ok: true }));

module.exports = { liveConfig, report, leave, online, onlineCount, whereIs };
