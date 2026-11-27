// Seeing other players: every few moments each game says where its player is, and hears back
// who else is close by in the same place (out in the world, the same cave, or the same building).
// The server keeps only the latest spot of each player; nothing here is saved for long.

export const SEE_FAR = 160;        // metres: players further away than this are not sent to you
export const MAX_SEEN = 40;        // at most this many other players are sent at once
export const GONE_MS = 12000;      // a player not heard from for this long has left (closed the game)
export const POLL_MS = 1200;        // how often the game reports in while someone is near (without live movement)
export const POLL_LIVE_MS = 2500;  // ...and with live movement, which moves them in between
export const POLL_ALONE_MS = 4000; // ...and while nobody is
export const SLOTS = ['weapon', 'head', 'body', 'legs', 'feet', 'shield'];

const num = (v, lo, hi, d = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const word = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const round = (v, k = 100) => Math.round(v * k) / k;

// Where you are: 'out' in the open world, 'cave:<id>' underground, 'in:<what>:<x>,<z>' in a building
export const placeKey = (v) => (/^(out|cave:[\w-]{1,40}|in:[\w-]{1,40}:-?\d{1,6},-?\d{1,6})$/.test(String(v || '')) ? String(v) : 'out');

// A player's spot and pose, cleaned up (whatever a game sends, only these fields, in range)
export function cleanSpot(s = {}) {
  return {
    x: round(num(s.x, -1e5, 1e5)), y: round(num(s.y, -1e4, 1e4)), z: round(num(s.z, -1e5, 1e5)),
    heading: round(num(s.heading, -100, 100), 1000),
    speed: round(num(s.speed, 0, 12)),
    place: placeKey(s.place),
    // what they are doing that changes how they look: riding, sitting, lying down (asleep or knocked out)
    pose: ['ride', 'sit', 'lie', 'fly', 'swim'].includes(s.pose) ? s.pose : '',
  };
}

// The tamed dragon or wyvern with them (ridden or at their side), or their hatchling ('h:<kind>'):
// which beast, where it is, which way it faces, how high it flies, and (a hatchling) how big it is
export function cleanPet(p) {
  if (!p || typeof p !== 'object' || !/^(h:)?\w{1,24}$/.test(String(p.k || ''))) return null;
  return {
    k: String(p.k),
    x: round(num(p.x, -1e5, 1e5)), y: round(num(p.y, -1e4, 1e4)), z: round(num(p.z, -1e5, 1e5)),
    h: round(num(p.h, -100, 100), 1000), air: round(num(p.air, 0, 700)),
    s: round(num(p.s, 0, 5, 0), 1000),
  };
}

// How a player's body looks: race, form, evolution, colours and what they wear
export function cleanBody(b) {
  if (!b || typeof b !== 'object') return null;
  const look = {};
  if (b.look && typeof b.look === 'object') {
    for (const [k, v] of Object.entries(b.look).slice(0, 24)) {
      if (!/^\w{1,24}$/.test(k)) continue;
      if (typeof v === 'string' && v.length <= 40) look[k] = v;
      else if (typeof v === 'number' && Number.isFinite(v)) look[k] = v;
      else if (typeof v === 'boolean') look[k] = v;
    }
  }
  const gear = {};
  for (const slot of SLOTS) {
    const g = b.gear?.[slot];
    if (g && typeof g.id === 'string' && /^\w{1,40}$/.test(g.id)) gear[slot] = { id: g.id, plus: Math.round(num(g.plus, 0, 99)) };
  }
  return {
    race: word(b.race, 24), form: word(b.form, 16) || 'monster', stage: Math.round(num(b.stage, 0, 20)),
    age: b.age == null ? null : Math.round(num(b.age, 0, 10000)), look, gear,
  };
}

// The same body, as text, to tell when it changes
export const bodySig = (b) => JSON.stringify(b || null);
