// Seeing other players (see public/js/data/presence.mjs): each game reports its player's spot every
// moment or two and gets back the players close by in the same place. Only the latest spot is kept.
const db = require('./db');
const P = require('../public/js/data/presence.mjs');

let lastSweep = 0;

// POST /api/presence { x, y, z, heading, speed, place, pose, body? } -> { players: [...] }
async function report(acc, body = {}, now = Date.now()) {
  const me = P.cleanSpot(body);
  const look = P.cleanBody(body.body);
  await db.run(`INSERT INTO presence (account_id, name, x, y, z, heading, speed, place, pose, body, at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (account_id) DO UPDATE SET name = EXCLUDED.name, x = EXCLUDED.x, y = EXCLUDED.y, z = EXCLUDED.z,
        heading = EXCLUDED.heading, speed = EXCLUDED.speed, place = EXCLUDED.place, pose = EXCLUDED.pose,
        body = COALESCE(EXCLUDED.body, presence.body), at = EXCLUDED.at`,
  acc.id, acc.username, me.x, me.y, me.z, me.heading, me.speed, me.place, me.pose, look ? JSON.stringify(look) : null, now);
  const rows = await db.all(`SELECT account_id, name, x, y, z, heading, speed, pose, body FROM presence
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
    players: rows.map((r) => ({
      id: r.account_id, name: r.name, x: r.x, y: r.y, z: r.z, heading: r.heading, speed: r.speed, pose: r.pose,
      body: r.body ? JSON.parse(r.body) : null,
    })),
  };
}

// Signing out or closing the game: gone at once instead of after a few seconds
const leave = (acc) => db.run('DELETE FROM presence WHERE account_id = ?', acc.id).then(() => ({ ok: true }));

module.exports = { report, leave };
