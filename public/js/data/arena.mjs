// The Colosseum of the Central City, duels between players, and the Weekly Championship.
// Shared by the game (the building, the fight on screen) and the server (who may fight, the HP,
// every blow, the championship's draw and rounds).
//
// The Colosseum stands in the Dump, the outer ring of the Central City by its walls, between the
// south road and the east road, so anyone may walk in and watch (no City Pass is needed down there).
// Its sand floor is ringed by a wall; the stands rise in rows behind it, and two stairways climb the
// outside of the great wall to the top row. Four gates lead straight in to the floor.
//
// Duels: a player challenges another by name. The other gets a call on screen (or an email when
// they are away, unless they turned those emails off), and on Accept both are summoned to the floor.
// A fight in the Colosseum never costs a life: whoever is beaten simply loses the fight. Each
// fighter has their own full HP for the fight, whatever their HP was outside.
//
// The Weekly Championship: every grown-up character is in it. The draw is made each Friday at 18:00
// (UTC) and every player is sent an email with the time of their first fight. The fights start on
// Saturday at 18:00 (UTC), one round every 15 minutes. Whoever isn't in the Colosseum within 3
// minutes of their fight's time is out at once. The last one standing wins the No.1 medal and keeps
// it until the next week's champion takes it.
import { derivedStats } from './game-data.mjs';
import { ITEMS, upgraded } from './items.mjs';
import { placesWithPositions } from './world-layout.mjs';

// ---------- the building ----------
// where it stands in the Central City: its middle this far from the city's middle, at this angle
// (x = sin a, z = cos a; 0 is south, PI/2 east)
export const COLOSSEUM = { city: 'central', a: Math.PI / 4, r: 229 };
export const FLOOR_R = 14;        // the sand floor the fights are on
export const PODIUM_R = 15;       // the wall round the floor (its outer face)
export const PODIUM_H = 2.6;      // how high that wall stands
export const ROWS = 12;           // rows of stone seats
export const ROW_D = 1.1;         // each row this deep
export const ROW0_Y = 2.8;        // the front row stands this high above the floor
export const ROW_RISE = 0.5;      // and each row behind is this much higher
export const TOP_Y = ROW0_Y + ROW_RISE * (ROWS - 1);       // the top row
export const STANDS_R = PODIUM_R + ROWS * ROW_D;            // where the top row ends (28.2)
export const WALL_R0 = STANDS_R + 0.8, WALL_R1 = WALL_R0 + 2; // the great outer wall
export const WALL_H = 16;
export const GATE_HALF = 2.2;     // half the width of a gate's tunnel
export const GATE_H = 4;          // a gate's tunnel is this high where it goes through the outer wall
// the four gates, by their angle round the Colosseum (in its own turn: 0 faces the city's middle)
export const GATES = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
// the two stairways up the outside of the great wall, either side of the city gate (0): each climbs
// from RAMP_A0 round to RAMP_A1, then a landing leads in through a door to the top row
export const RAMP_R0 = WALL_R1 + 0.2, RAMP_R1 = RAMP_R0 + 2.6;
export const RAMP_A0 = 0.22, RAMP_A1 = 1.0, LANDING_A1 = 1.13;
export const OUTER_R = RAMP_R1 + 0.6; // nothing else is built inside this

// The Colosseum's middle in the world, its turn (local 0 points at the city's middle), and its
// floor's height is the Dump's (the city works that out)
export function colosseumPlace() {
  const city = placesWithPositions().find((p) => p.id === COLOSSEUM.city);
  if (!city) return null;
  const lx = Math.sin(COLOSSEUM.a) * COLOSSEUM.r, lz = Math.cos(COLOSSEUM.a) * COLOSSEUM.r;
  return { x: city.x + lx, z: city.z + lz, lx, lz, turn: COLOSSEUM.a + Math.PI, city };
}
// (x, z) in the Colosseum's own frame: r from its middle, and the angle round it (0 = the city gate)
export function colosseumLocal(x, z, at = colosseumPlace()) {
  const dx = x - at.x, dz = z - at.z;
  const a = Math.atan2(dx, dz) - at.turn;
  return { r: Math.hypot(dx, dz), a: Math.atan2(Math.sin(a), Math.cos(a)) };
}
export const inColosseum = (x, z, at = colosseumPlace()) => !!at && Math.hypot(x - at.x, z - at.z) < WALL_R1;
export const onFloor = (x, z, at = colosseumPlace()) => !!at && Math.hypot(x - at.x, z - at.z) < FLOOR_R;
// where the two fighters stand at the start: either side of the floor, facing each other
export function startSpots(at = colosseumPlace()) {
  const d = FLOOR_R - 4;
  const side = (k) => {
    const a = at.turn + Math.PI / 2 * k;
    return { x: at.x + Math.sin(a) * d, z: at.z + Math.cos(a) * d, heading: a + Math.PI };
  };
  return [side(1), side(-1)];
}

// ---------- duels ----------
export const CHALLENGE_MS = 24 * 3600 * 1000;  // a challenge waits this long for an answer
export const ACCEPTED_MS = 60 * 60 * 1000;     // once accepted, both must come within this long
export const CHECKIN_MS = 3 * 60 * 1000;       // a championship fighter must come within this long
export const COUNTDOWN_MS = 5000;              // 5, 4, 3, 2, 1, Fight!
export const FIGHT_MS = 3 * 60 * 1000;         // a fight lasts at most this long
export const HIT_GAP_MS = 380;                 // the fastest one fighter can land blows
export const AWAY_MS = 20000;                  // a fighter not heard from for this long gives up the fight
export const REACH = { melee: 7, magic: 32 };  // how far a blow can land (the server allows for lag)
export const MIN_AGE_NOTE = 'Children can watch, but only grown-ups fight in the Colosseum.';

// A fighter's numbers for a fight: the same as their Status window (stats, level, training, gear)
export function duelStats(c) {
  const d = derivedStats(c.stats || {}, c.level || 1, c.trained || {}, c.extraHp || 0);
  const b = { atk: 0, matk: 0, def: 0, mdef: 0 };
  let magic = false;
  for (const [slot, uid] of Object.entries(c.equipped || {})) {
    const e = (c.inventory || []).find((s) => s.uid === uid);
    const it = e && ITEMS[e.id];
    if (!it) continue;
    if (it.kind === 'weapon') { b[it.magic ? 'matk' : 'atk'] += upgraded(it.power || 0, e.plus || 0); if (slot === 'weapon' && it.magic) magic = true; }
    else { b.def += upgraded(it.def || 0, e.plus || 0); b.mdef += upgraded(it.mdef || 0, e.plus || 0); }
  }
  return {
    hp: Math.max(1, d.hp), atk: d.atk + b.atk, matk: d.matk + b.matk, def: d.def + b.def, mdef: d.mdef + b.mdef,
    dex: Number(c.stats?.dex) || 0, magic, level: c.level || 1,
  };
}
// One blow: `mult` is the skill's strength (1 for a plain blow), clamped so no game can send more
export function duelDamage(att, def, mult = 1, magic = false, rnd = Math.random) {
  const k = Math.min(4, Math.max(0.3, Number(mult) || 1));
  const power = magic ? att.matk : att.atk;
  const guard = magic ? def.mdef : def.def;
  let dmg = power * k * (0.9 + rnd() * 0.2) - guard * 0.5;
  const crit = rnd() < 0.1 + Math.min(att.dex * 0.002, 0.25);
  if (crit) dmg *= 1.6;
  return { dmg: Math.max(1, Math.round(dmg)), crit };
}
// Who won when the time ran out: the one with more of their HP left (a draw when even)
export function timeWinner(d) {
  const fa = d.hp_a / Math.max(1, d.max_a), fb = d.hp_b / Math.max(1, d.max_b);
  if (Math.abs(fa - fb) < 1e-6) return null;
  return fa > fb ? 'a' : 'b';
}

// ---------- the Weekly Championship ----------
export const CUP = {
  day: 6,                 // Saturday (0 = Sunday)
  hour: 18,               // at 18:00 UTC
  drawBefore: 24 * 3600 * 1000, // the draw, and the emails, a day before (Friday 18:00 UTC)
  roundMs: 15 * 60 * 1000,      // a round every 15 minutes
  maxRounds: 24,
};
// The start of this week's championship: the next Saturday 18:00 UTC, or the one running now
export function cupStart(now = Date.now()) {
  const d = new Date(now - CUP.maxRounds * CUP.roundMs);
  d.setUTCHours(CUP.hour, 0, 0, 0);
  while (d.getUTCDay() !== CUP.day || d.getTime() <= now - CUP.maxRounds * CUP.roundMs) d.setUTCDate(d.getUTCDate() + 1);
  return d.getTime();
}
export const roundAt = (start, r) => start + r * CUP.roundMs;
export const roundsFor = (n) => Math.max(1, Math.ceil(Math.log2(Math.max(2, n))));

// The first round: the strongest are seeded apart (1 meets the weakest, and so on), and where the
// count isn't a power of two the strongest get a bye (they go straight to the next round)
export function drawCup(players) {
  const list = [...players].sort((p, q) => (q.level || 1) - (p.level || 1) || String(p.name).localeCompare(String(q.name)));
  const size = 2 ** roundsFor(list.length);
  // the classic seeding order, so seeds 1 and 2 can only meet in the final
  let order = [1];
  while (order.length < size) order = order.flatMap((s) => [s, order.length * 2 + 1 - s]);
  const slot = (seed) => list[seed - 1] || null;
  const matches = [];
  for (let i = 0; i < size; i += 2) matches.push({ a: slot(order[i]), b: slot(order[i + 1]) });
  return matches.map((m) => (m.a ? m : { a: m.b, b: null }));
}
// The next round from the winners of the last (null where nobody came to a match)
export function nextRound(matches) {
  const out = [];
  for (let i = 0; i < matches.length; i += 2) {
    const a = matches[i]?.winner || null, b = matches[i + 1]?.winner || null;
    out.push(a ? { a, b } : { a: b, b: null });
  }
  return out;
}
// A time in words for the emails (UTC), e.g. "Saturday 18:15 UTC"
export function utcWords(t) {
  const d = new Date(t);
  const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()];
  return `${day} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
}

// Is (lx, lz), in the city's own frame, where the Colosseum stands in city `cityId`? (the Dump's
// shacks, junk and yards there were cleared away to build it)
export function underColosseum(cityId, lx, lz, pad = 2) {
  if (cityId !== COLOSSEUM.city) return false;
  const x = Math.sin(COLOSSEUM.a) * COLOSSEUM.r, z = Math.cos(COLOSSEUM.a) * COLOSSEUM.r;
  return Math.hypot(lx - x, lz - z) < OUTER_R + pad;
}
