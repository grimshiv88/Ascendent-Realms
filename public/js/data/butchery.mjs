// How much meat a hunted animal gives when it is cut up.
//
// The body: every animal is born a little bigger or smaller than the next (its `grow`, about 0.8
// to 1.25 of the usual size). A bigger one is stronger (more health) and carries more meat: the
// full meat on a body is its kind's usual `cuts` times grow squared, so a huge old stag gives
// about twice what a small young one does.
//
// The blade: a Halal Butcher wastes nothing. Cutting it up yourself, you keep only a share of
// that full meat, by the tool you cut with:
//   - its kind: a knife is made for the job, a dagger nearly so, a sword is long and clumsy for
//     it, and an axe hacks the meat to pieces
//   - its edge: the better the blade (its rank, each upgrade on it, a diamond edge), the cleaner
//     the cuts and the less is spoilt
// The best tool you have is used: a butcher's or hunting knife in your bag, or the blade in your
// hand. All of it is halal meat; animals whose meat is not halal give none (data/animals.mjs).

// the share of the meat each kind of tool keeps at a perfect edge
export const BLADE_FIT = { knife: 1, dagger: 0.95, sword: 0.85, axe: 0.7 };
// how good a weapon's edge is, by its rank (0 Basic .. 5 Mythic); each upgrade (+1) adds a little
export const RANK_EDGE = [0.55, 0.65, 0.75, 0.85, 0.95, 1.05];
export const PLUS_EDGE = 0.02, DIAMOND_EDGE = 0.1;
// knives kept in your bag just for cutting up game
export const KNIVES = {
  hunting_knife: 0.75,
  butcher_knife: 0.95,
};
// an animal's size at birth: from GROW_MIN to GROW_MAX of its kind's usual size, most near 1
export const GROW_MIN = 0.8, GROW_MAX = 1.25;
export function rollGrow(rnd = Math.random) {
  const t = (rnd() + rnd()) / 2; // most are near the middle, a few very small or very big
  return Math.round((GROW_MIN + t * (GROW_MAX - GROW_MIN)) * 100) / 100;
}
// what to call an animal of that size
export function sizeWord(grow = 1) {
  return grow < 0.88 ? 'Small' : grow < 0.97 ? 'Smallish' : grow < 1.06 ? 'Average' : grow < 1.15 ? 'Big' : 'Huge';
}
// its strength next to the usual one of its kind (health goes with the weight)
export const strengthOf = (grow = 1) => grow * grow;

// all the meat on the body, before any is spoilt by the cutting (a number, can be a fraction)
export function fullMeat(a, grow = 1) {
  if (!a?.meat) return 0;
  return Math.max(1, (a.cuts || 1) * strengthOf(grow));
}

// the share of the meat a tool keeps: 0 (no blade) .. 1 (nothing wasted)
export function weaponShare(w) {
  if (!w || !(w.type in BLADE_FIT) || w.type === 'knife') return 0;
  const edge = (RANK_EDGE[Math.max(0, Math.min(5, w.rank || 0))] || 0.55) + (w.plus || 0) * PLUS_EDGE + (w.metal === 'diamond' ? DIAMOND_EDGE : 0);
  return Math.max(0.2, Math.min(1, BLADE_FIT[w.type] * edge));
}
// the best tool you have: { share, name, knife } or null when you have no blade at all
// (`has(id)` asks the bag; `weapon` is what is in your hand, with its rank and upgrades)
export function bestBlade(has, weapon, names = {}) {
  let best = null;
  for (const [id, share] of Object.entries(KNIVES)) if (has(id) && (!best || share > best.share)) best = { share, name: names[id] || id, knife: id };
  const ws = weaponShare(weapon);
  if (ws && (!best || ws > best.share)) best = { share: ws, name: weapon.name, knife: null };
  return best;
}

// how many whole cuts you get: the full meat times the share, a fraction rounded up or down by
// chance (so on average you get exactly your share), and never less than 1 from a halal body
export function meatCut(a, grow, share, rnd = Math.random) {
  const full = fullMeat(a, grow);
  if (!full) return 0;
  const want = full * Math.max(0, Math.min(1, share));
  const n = Math.floor(want) + (rnd() < want - Math.floor(want) ? 1 : 0);
  return Math.max(1, n);
}
// what a butcher gives (no waste) and charges for it
export const butcherMeat = (a, grow) => Math.max(a?.meat ? 1 : 0, Math.round(fullMeat(a, grow)));
