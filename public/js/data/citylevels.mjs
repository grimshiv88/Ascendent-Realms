// The great walled cities rise in rings, each a level higher than the one round it, like a
// layered hill: by the walls at the bottom the Dump, then the Common Quarter, then the Noble
// Quarter, and on top Castle Hill with the plaza, the shrine and the castle. Stone terrace walls
// hold up each ring, and ramps climb them where the four main roads cross.
// Shared by the land (world-layout.mjs), the game and the server. No imports, so anything can use it.

export const CITY_R = 280;           // the outer fortress wall (the Dump was made bigger 2026-11-24)
export const INNER_R = CITY_R - 14;  // the inner wall (the moat lies between)

// The rings from the middle out: each stands `y` metres above the city's foot (its gates).
// `r1` is where the ring's terrace wall stands; the next ring out begins TERRACE metres further.
export const TIERS = [
  { id: 'castle', name: 'Castle Hill', r0: 0, r1: 90, y: 18 },
  { id: 'noble', name: 'Noble Quarter', r0: 90, r1: 135, y: 12 },
  { id: 'common', name: 'Common Quarter', r0: 135, r1: 190, y: 6 },
  { id: 'dump', name: 'The Dump', r0: 190, r1: INNER_R, y: 0 },
];
export const TOP_Y = TIERS[0].y;
export const TERRACE = 4;            // how thick a terrace wall is (the land drops inside it)

// The four main roads run straight out from the middle (angle a: x = sin a, z = cos a; 0 is south)
export const ROAD_ANGLES = { south: 0, east: Math.PI / 2, north: Math.PI, west: -Math.PI / 2 };
export const ROAD_HALF = 4;          // half a road's width
export const RAMP_WALL = 4;          // the stone walls either side of a ramp, this thick
export const RAMP_IN = 10;           // a ramp starts this far inside a terrace wall (on the higher ring)
export const RAMP_OUT = 12;          // and ends this far outside it (on the lower ring)
// the ramps: [terrace (index into TIERS), road]; Castle Hill has none on the north road, where
// the castle stands
export const RAMPS = [];
for (let k = 0; k < TIERS.length - 1; k++) for (const road of Object.keys(ROAD_ANGLES)) if (!(k === 0 && road === 'north')) RAMPS.push({ k, road, a: ROAD_ANGLES[road] });

// the height of the rings alone at radius r (no ramps): flat on each ring, dropping across the
// terrace walls
export function ringY(r) {
  for (let k = 0; k < TIERS.length - 1; k++) {
    const b = TIERS[k].r1;
    if (r <= b) return TIERS[k].y;
    if (r < b + TERRACE) return TIERS[k].y + (TIERS[k + 1].y - TIERS[k].y) * ((r - b) / TERRACE);
  }
  return TIERS[TIERS.length - 1].y;
}
// the ring a spot is on (by radius)
export function tierAt(r) {
  for (const t of TIERS) if (r <= t.r1 + (t === TIERS[TIERS.length - 1] ? 1e9 : TERRACE / 2)) return t;
  return TIERS[TIERS.length - 1];
}
// where (dx, dz) lies along road `a` and across it
export const alongRoad = (dx, dz, a) => ({ along: dx * Math.sin(a) + dz * Math.cos(a), lat: dx * Math.cos(a) - dz * Math.sin(a) });
// the ramp (and how far up it, 0 at the bottom, 1 at the top) that (dx, dz) stands on, if any;
// `wide` takes in its side walls too
export function rampAt(dx, dz, wide = 0) {
  for (const R of RAMPS) {
    const { along, lat } = alongRoad(dx, dz, R.a);
    if (Math.abs(lat) > ROAD_HALF + wide) continue;
    const b = TIERS[R.k].r1, lo = b - RAMP_IN, hi = b + TERRACE + RAMP_OUT;
    if (along < lo || along > hi) continue;
    return { ramp: R, up: (hi - along) / (hi - lo), along, lat, y: TIERS[R.k + 1].y + (TIERS[R.k].y - TIERS[R.k + 1].y) * (hi - along) / (hi - lo) };
  }
  return null;
}
// How high the ground stands at (dx, dz) from a city's middle, above the city's foot
export function cityLift(dx, dz) {
  const r = Math.hypot(dx, dz);
  if (r > INNER_R) return 0;
  const on = rampAt(dx, dz);
  return on ? on.y : ringY(r);
}
// The ground as the land draws it (see world-layout.mjs). Where a ramp is built out over a lower
// ring, the land stays down at that ring's level under it: the ramp's own road is drawn on top at
// its exact height and its stone walls close the sides. (If the land rose with the ramp there, its
// coarse triangles poked out past the ramp's foot as patches of grass over the street.)
export function cityGround(dx, dz) {
  const r = Math.hypot(dx, dz);
  if (r > INNER_R) return 0;
  const on = rampAt(dx, dz), ring = ringY(r);
  return on ? Math.min(on.y, ring) : ring;
}
