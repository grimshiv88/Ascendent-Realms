// The depths: every cave on the map leads down into its own underground warren of chambers.
// Shared by the game and the server, so both agree on what each cave holds and what it costs to buy.
import { placesWithPositions, sample } from './world-layout.mjs';

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
    ores: [['iron_ore', 45], ['silver_ore', 30], ['gold_ore', 18], ['ruby', 6], ['moonstone', 1]],
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
    ores: [['iron_ore', 30], ['gold_ore', 30], ['ruby', 22], ['dragonite', 15], ['moonstone', 3]],
  },
  fae: {
    name: 'Glimmer Cave', rock: '#3f3a52', glow: '#c88aff',
    kinds: ['wisp', 'wisp', 'slime'], boss: 'wisp', nest: 'wisp',
    ores: [['crystal_shard', 50], ['silver_ore', 25], ['sapphire', 15], ['moonstone', 10]],
  },
  sand: {
    name: 'Sandstone Burrow', rock: '#6a5438', glow: '#ffc85a',
    kinds: ['sandlizard', 'sandlizard', 'lizard'], boss: 'sandlizard', nest: 'sandlizard',
    ores: [['copper_ore', 40], ['gold_ore', 35], ['ruby', 15], ['sapphire', 10]],
  },
};
const BY_REGION = { warrens: 'warren', heart: 'goblin', mire: 'serpent', peaks: 'drake', frost: 'slime', fae: 'fae', sun: 'sand' };

export const SIZES = {
  small: { name: 'Small', chambers: 3, price: 800 },
  medium: { name: 'Medium', chambers: 5, price: 2500 },
  deep: { name: 'Deep', chambers: 8, price: 8000 },
};

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
    const size = far < 3000 ? 'small' : far < 12000 ? (rnd() < 0.6 ? 'medium' : 'small') : rnd() < 0.5 ? 'deep' : 'medium';
    return { id: p.id, index: i, place: p, theme, size, name: `${THEMES[theme].name}` };
  });
  // the nearest cave to the spawn is always a small goblin den, to learn on
  const first = caches.reduce((a, b) => (Math.hypot(b.place.x, b.place.z) < Math.hypot(a.place.x, a.place.z) ? b : a));
  first.theme = 'goblin'; first.size = 'small'; first.name = THEMES.goblin.name;
  return caches;
}
export const caveById = (id) => allCaves().find((c) => c.id === id) || null;
export const cavePrice = (cave) => SIZES[cave.size].price;

// The chambers underground, each lower than the last, joined by winding tunnels.
// Laid out far beyond the edge of the map so nothing up top gets in the way.
export function caveLayout(cave) {
  const rnd = seeded(cave.index * 31 + 3);
  const n = SIZES[cave.size].chambers;
  const ox = 420000 + cave.index * 2500, oz = 0;
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
  return { chambers, tunnels, entry: chambers[0], rnd };
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
