// The depths: every cave on the map leads down into its own underground warren of chambers.
// Shared by the game and the server, so both agree on what each cave holds and what it costs to buy.
import { placesWithPositions, sample, heightAt, DEPTHS_X } from './world-layout.mjs';
import { ITEMS } from './items.mjs';
const oreRank = (id) => ITEMS[id]?.rank || 0;

// What lives in each kind of cave, what can be mined there (with how often each ore turns up),
// and the boss waiting in the last chamber
export const THEMES = {
  goblin: {
    name: 'Goblin Den', rock: '#4f463d', glow: '#ff8a3a',
    kinds: ['goblin', 'goblin', 'hobgoblin'], boss: 'hobgoblin', nest: 'goblin', guards: 'goblin',
    ores: [['copper_ore', 50], ['iron_ore', 30], ['silver_ore', 14], ['gold_ore', 5], ['ruby', 1]],
  },
  warren: {
    name: 'Goblin Warren', rock: '#463c33', glow: '#ff6a2a',
    kinds: ['hobgoblin', 'chieftain', 'chieftain'], boss: 'goblinlord', nest: 'hobgoblin', guards: 'hobgoblin',
    ores: [['iron_ore', 45], ['silver_ore', 30], ['gold_ore', 18], ['ruby', 6], ['diamond', 2], ['moonstone', 1]],
  },
  slime: {
    name: 'Slime Grotto', rock: '#3d4a52', glow: '#5ad0ff',
    kinds: ['slime', 'slime', 'frostslime'], boss: 'frostslime', nest: 'slime',
    ores: [['crystal_shard', 45], ['copper_ore', 30], ['silver_ore', 18], ['sapphire', 6], ['moonstone', 1]],
  },
  serpent: {
    name: 'Serpent Hollow', rock: '#3a4433', glow: '#7aff6a',
    kinds: ['lizard', 'lizard', 'serpent'], boss: 'serpent', nest: 'lizard',
    ores: [['iron_ore', 40], ['crystal_shard', 30], ['emerald', 20], ['gold_ore', 9], ['moonstone', 1]],
  },
  drake: {
    name: 'Drake Lair', rock: '#4a332c', glow: '#ff4a2a',
    kinds: ['drake', 'drake', 'drake'], boss: 'drake', nest: 'drake',
    ores: [['iron_ore', 30], ['gold_ore', 30], ['ruby', 22], ['dragonite', 15], ['diamond', 4], ['moonstone', 3]],
  },
  fae: {
    name: 'Glimmer Cave', rock: '#3f3a52', glow: '#c88aff',
    kinds: ['wisp', 'wisp', 'slime'], boss: 'wisp', nest: 'wisp',
    ores: [['crystal_shard', 50], ['silver_ore', 25], ['sapphire', 15], ['diamond', 3], ['moonstone', 10]],
  },
  sand: {
    name: 'Sandstone Burrow', rock: '#6a5438', glow: '#ffc85a',
    kinds: ['sandlizard', 'sandlizard', 'lizard'], boss: 'sandlizard', nest: 'sandlizard',
    ores: [['copper_ore', 40], ['gold_ore', 35], ['ruby', 15], ['sapphire', 10]],
  },
};
// Caves whose mouths open high on a mountainside are Dungeons: one size bigger, with more false routes
export const DUNGEON_HEIGHT = 150;
const DUNGEON_NAME = { goblin: 'Goblin Dungeon', warren: 'Warren Dungeon', slime: 'Slime Dungeon', serpent: 'Serpent Dungeon', drake: 'Drake Dungeon', fae: 'Glimmer Dungeon', sand: 'Sandstone Dungeon' };
const BIGGER = { small: 'medium', medium: 'deep', deep: 'deep' };
const BY_REGION = { warrens: 'warren', heart: 'goblin', mire: 'serpent', peaks: 'drake', frost: 'slime', fae: 'fae', sun: 'sand' };

export const SIZES = {
  small: { name: 'Small', chambers: 3, price: 800 },
  medium: { name: 'Medium', chambers: 5, price: 2500 },
  deep: { name: 'Deep', chambers: 8, price: 8000 },
};

// How big an ore vein is, and how many pieces of ore it breaks into. Rarer ore comes in smaller
// veins. A huge copper vein mints about 16 Copper; a small one, 2.
export const VEIN_SIZES = [
  { id: 'small', name: 'Small', scale: 0.75, hits: 2, ore: [1, 1], weight: 40 },
  { id: 'medium', name: 'Medium', scale: 1, hits: 3, ore: [2, 3], weight: 35 },
  { id: 'large', name: 'Large', scale: 1.35, hits: 5, ore: [4, 6], weight: 18 },
  { id: 'huge', name: 'Huge', scale: 1.7, hits: 7, ore: [7, 8], weight: 7 },
];
// `deep` (0-1) is how far down the chamber is: deeper chambers hold bigger veins
export function pickVein(ore, rnd = Math.random, deep = 0) {
  const top = oreRank(ore) >= 5 ? 1 : oreRank(ore) >= 3 ? 2 : 3; // gems and rare metals: small or medium (or large)
  const w = VEIN_SIZES.slice(0, top + 1).map((v, i) => v.weight * (1 + deep * i));
  let r = rnd() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return VEIN_SIZES[i]; }
  return VEIN_SIZES[0];
}
// Orichalcum turns up only in Dungeons, in their deepest chambers
export const ORICHALCUM_CHANCE = 0.06;

// how long before a beaten boss (and its chest) comes back
export const BOSS_RETURNS_MS = 24 * 3600 * 1000;

const seeded = (n) => { let s = (n * 2654435761) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

let caches = null;
// Every cave: its id, where its mouth is, its theme and size
export function allCaves() {
  if (caches) return caches;
  const tmp = {};
  caches = placesWithPositions().filter((p) => p.cave).map((p, i) => {
    const region = sample(p.x, p.z, tmp).region;
    let theme = BY_REGION[region] || 'goblin';
    const rnd = seeded(i + 7);
    if (theme === 'goblin' && i % 3 === 0) theme = 'slime'; // a third of the Heartland's caves are slime grottos
    const far = Math.hypot(p.x, p.z);
    let size = far < 3000 ? 'small' : far < 12000 ? (rnd() < 0.6 ? 'medium' : 'small') : rnd() < 0.5 ? 'deep' : 'medium';
    const dungeon = heightAt(p.x, p.z) >= DUNGEON_HEIGHT;
    if (dungeon) size = BIGGER[size];
    return { id: p.id, index: i, place: p, theme, size, dungeon, name: dungeon ? DUNGEON_NAME[theme] : THEMES[theme].name };
  });
  // the nearest cave to the spawn is always a small goblin den, to learn on
  const first = caches.reduce((a, b) => (Math.hypot(b.place.x, b.place.z) < Math.hypot(a.place.x, a.place.z) ? b : a));
  first.theme = 'goblin'; first.size = 'small'; first.dungeon = false; first.name = THEMES.goblin.name;
  return caches;
}
export const caveById = (id) => allCaves().find((c) => c.id === id) || null;
export const cavePrice = (cave) => SIZES[cave.size].price;
export const caveWord = (cave) => (cave.dungeon ? 'dungeon' : 'cave');

// The chambers underground, each lower than the last, joined by winding tunnels.
// Laid out far beyond the edge of the map so nothing up top gets in the way.
// Off the true way down run false routes: side tunnels that look just the same and also go deep,
// through chamber after chamber, only to end in rock. Dungeons have more of them, and longer.
export function caveLayout(cave) {
  const rnd = seeded(cave.index * 31 + 3);
  const n = SIZES[cave.size].chambers;
  // far past the edge of the world (beyond DEPTHS_X, where the land answers for the depths), past
  // the building insides too (see interiors.js), each cave on its own stretch
  const ox = DEPTHS_X + 200000 + cave.index * 2500, oz = 0;
  const chambers = [];
  let x = ox, z = oz, y = -40, a = rnd() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const boss = i === n - 1;
    const r = boss ? 13 : 7 + rnd() * 4;
    if (i > 0) {
      a += (rnd() - 0.5) * 2.2;
      const len = chambers[i - 1].r + r + 10 + rnd() * 12;
      x += Math.cos(a) * len; z += Math.sin(a) * len;
      y -= 4 + rnd() * 4; // ever deeper
    }
    chambers.push({ x, z, y, r, boss });
  }
  const tunnels = chambers.slice(1).map((c, i) => ({ a: chambers[i], b: c, w: 3.6 }));
  const branches = falseRoutes(cave, chambers, tunnels);
  return { chambers, branches, all: [...chambers, ...branches], tunnels, entry: chambers[0], rnd };
}

// distance from a point to a line segment, flat (x, z)
function segDist(px, pz, a, b) {
  const ax = b.x - a.x, az = b.z - a.z, l2 = ax * ax + az * az || 1;
  const k = Math.max(0, Math.min(1, ((px - a.x) * ax + (pz - a.z) * az) / l2));
  return Math.hypot(px - (a.x + ax * k), pz - (a.z + az * k));
}
// The false routes, added to `tunnels`; returns their chambers (each marked false: true)
function falseRoutes(cave, chambers, tunnels) {
  const rnd = seeded(cave.index * 53 + 11); // its own dice, so the true way stays the same
  const big = cave.dungeon;
  const out = [];
  const all = () => [...chambers, ...out];
  // a new chamber (and the tunnel to it) must keep well clear of every other one, so false
  // routes never join up and make a short cut
  const fits = (from, c) => {
    for (const o of all()) if (o !== from && Math.hypot(c.x - o.x, c.z - o.z) < c.r + o.r + 9) return false;
    for (const t of tunnels) if (segDist(c.x, c.z, t.a, t.b) < c.r + 6) return false;
    for (let s = 0.2; s <= 0.8; s += 0.1) {
      const px = from.x + (c.x - from.x) * s, pz = from.z + (c.z - from.z) * s;
      for (const o of all()) if (o !== from && Math.hypot(px - o.x, pz - o.z) < o.r + 5) return false;
      for (const t of tunnels) if (t.a !== from && t.b !== from && segDist(px, pz, t.a, t.b) < 7) return false;
    }
    return true;
  };
  // grow one route from chamber `from`, `left` chambers long, heading roughly `dir`
  const grow = (from, dir, left, forkAt) => {
    let at = from;
    for (let k = 0; k < left; k++) {
      let made = null;
      for (let tries = 0; tries < 8 && !made; tries++) {
        const r = 6 + rnd() * 4;
        const d = dir + (rnd() - 0.5) * (1.2 + tries * 0.5);
        const len = at.r + r + 10 + rnd() * 14;
        const c = { x: at.x + Math.cos(d) * len, z: at.z + Math.sin(d) * len, y: at.y - (4 + rnd() * 5), r, false: true };
        if (fits(at, c)) { made = c; dir = d; }
      }
      if (!made) return;
      out.push(made);
      tunnels.push({ a: at, b: made, w: 3.6 });
      // in a dungeon a false route can split again, so even turning back is a guess
      if (k === forkAt) grow(made, dir + (rnd() < 0.5 ? 1 : -1) * (0.9 + rnd() * 0.6), 1 + Math.floor(rnd() * 3), -1);
      at = made;
    }
  };
  // every chamber but the boss's may have a false route leading off it
  for (let i = 0; i < chambers.length - 1; i++) {
    if (rnd() > (big ? 0.85 : 0.6)) continue;
    const c = chambers[i], next = chambers[i + 1];
    const onward = Math.atan2(next.z - c.z, next.x - c.x);
    const dir = onward + (rnd() < 0.5 ? 1 : -1) * (0.8 + rnd() * 1.2);
    const len = big ? 3 + Math.floor(rnd() * 3) : 2 + Math.floor(rnd() * 2);
    grow(c, dir, len, big ? 1 : -1);
  }
  // every cave has at least one
  for (let i = 0; i < chambers.length - 1 && !out.length; i++) {
    const c = chambers[i], next = chambers[i + 1];
    for (const side of [1, -1]) if (!out.length) grow(c, Math.atan2(next.z - c.z, next.x - c.x) + side * 1.4, 2, -1);
  }
  return out;
}

// What a cleared boss leaves in its chest depends on who beat it: each class finds what it uses
const CLASS_LOOT = {
  swordsman: [['iron_sword', 12], ['steel_sword', 25], ['knight_blade', 45]],
  mage: [['oak_staff', 12], ['mage_robe', 25], ['crystal_staff', 45]],
  healer: [['big_potion', 1], ['mage_hat', 15], ['elixir_life', 40]],
  assassin: [['iron_dagger', 1], ['poison_potion', 1], ['steel_sword', 30]],
  tank: [['iron_shield', 1], ['chainmail', 15], ['tower_shield', 30]],
  blacksmith: [['iron_ore', 1], ['war_axe', 25], ['moonstone', 40]],
  farmer: [['hand_axe', 1], ['big_potion', 15], ['war_axe', 35]],
  businessman: [['gold_ore', 1], ['ruby', 15], ['sapphire', 30]],
  potion_maker: [['herb', 1], ['big_potion', 12], ['elixir_life', 35]],
  builder: [['iron_mace', 1], ['iron_helm', 10], ['steel_plate', 30]],
};
// [item, how many] for the chest, plus coins
export function chestLoot(cave, cls, level) {
  const rnd = Math.random;
  const t = THEMES[cave.theme];
  const big = SIZES[cave.size].chambers;
  const items = [];
  // the best piece of class loot the finder's level allows
  const table = CLASS_LOOT[cls] || CLASS_LOOT.swordsman;
  const fit = table.filter(([, lvl]) => level >= lvl).pop() || table[0];
  items.push([fit[0], 1]);
  // a handful of the cave's own ores, rarer ones for bigger caves
  for (let i = 0; i < 2 + Math.floor(big / 2); i++) items.push([pickOre(t.ores, rnd, big / 8), 1 + Math.floor(rnd() * 3)]);
  if (cave.dungeon && rnd() < 0.25) items.push(['orichalcum', 1]);
  items.push([level >= 20 ? 'big_potion' : 'potion', 1 + Math.floor(rnd() * 2)]);
  const coins = Math.round((40 + level * 12) * big * (cls === 'businessman' ? 1.6 : 1));
  return { items, coins };
}

// pick an ore by its weight; `luck` (0-1) makes the rarer ones a little more likely
export function pickOre(ores, rnd = Math.random, luck = 0) {
  const w = ores.map(([, n], i) => n * (1 + luck * i));
  let r = rnd() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ores.length; i++) { r -= w[i]; if (r <= 0) return ores[i][0]; }
  return ores[0][0];
}
