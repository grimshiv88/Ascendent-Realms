// The animals of the realm: wild ones that roam the land, and tame ones kept on the farms.
// Sizes are real-world, in metres: `len` nose to rump, `tall` the height at the shoulder.
//
// temper: 'shy'    runs from you when you come close or run at it (rabbits, deer)
//         'calm'   grazes and lets you near; runs only when hurt (horses, cows, sheep)
//         'fierce' hunts you like a monster (wolves, bears)
// meat:   the cut of meat a body gives (data/items.mjs raw_X / cooked_X), or null when it is not
//         halal to eat (predators, horses and donkeys are never food). Only halal animals are eaten.
// shape:  'quad' four legs, 'hopper' a rabbit's folded hind legs, 'bird' two legs and wings
// where:  the regions it lives in ('farm' = only kept on farms), and whether it keeps to woods
export const ANIMALS = {
  rabbit: { name: 'Rabbit', shape: 'hopper', len: 0.42, tall: 0.24, temper: 'shy', speed: 6, hp: 6, meat: 'rabbit', cuts: 1, hide: 1,
    coat: '#8a7258', belly: '#d8ccb8', dark: '#4a3a2c', ears: 'long', tail: 'puff', where: ['heart', 'fae', 'frost'], herd: [1, 3] },
  hare: { name: 'Hare', shape: 'hopper', len: 0.6, tall: 0.32, temper: 'shy', speed: 8, hp: 8, meat: 'rabbit', cuts: 2, hide: 1,
    coat: '#9a7e5a', belly: '#e0d4c0', dark: '#2a2018', ears: 'long', tail: 'puff', where: ['heart', 'sun', 'frost', 'warrens'], herd: [1, 2] },
  deer: { name: 'Red Deer', shape: 'quad', len: 1.7, tall: 1.15, legs: 0.62, temper: 'shy', speed: 9, hp: 40, meat: 'venison', cuts: 4, hide: 2,
    coat: '#8a5a34', belly: '#d8c4a4', dark: '#3a2818', ears: 'deer', tail: 'short', horns: 'antlers', neck: 0.55, where: ['heart', 'fae'], woods: true, herd: [2, 4] },
  stag: { name: 'White Stag', shape: 'quad', len: 1.8, tall: 1.25, legs: 0.62, temper: 'shy', speed: 10, hp: 60, meat: 'venison', cuts: 4, hide: 2,
    coat: '#eeeae0', belly: '#ffffff', dark: '#8a8070', ears: 'deer', tail: 'short', horns: 'antlers', neck: 0.55, where: ['fae'], rare: true, herd: [1, 1] },
  elk: { name: 'Elk', shape: 'quad', len: 2.4, tall: 1.6, legs: 0.6, temper: 'calm', speed: 8, hp: 90, meat: 'venison', cuts: 7, hide: 3,
    coat: '#5a4030', belly: '#8a6a4a', dark: '#2a1c12', ears: 'deer', tail: 'short', horns: 'palms', neck: 0.6, girth: 1.15, where: ['frost', 'heart'], woods: true, herd: [1, 3] },
  reindeer: { name: 'Reindeer', shape: 'quad', len: 1.8, tall: 1.1, legs: 0.58, temper: 'shy', speed: 8, hp: 45, meat: 'venison', cuts: 4, hide: 2,
    coat: '#7a6a5a', belly: '#e8e0d4', dark: '#3a3028', ears: 'deer', tail: 'short', horns: 'antlers', neck: 0.5, where: ['frost'], herd: [3, 6] },
  gazelle: { name: 'Gazelle', shape: 'quad', len: 1.1, tall: 0.75, legs: 0.66, temper: 'shy', speed: 11, hp: 22, meat: 'venison', cuts: 2, hide: 1,
    coat: '#c8945a', belly: '#f4ecdc', dark: '#3a2a1a', ears: 'deer', tail: 'short', horns: 'spikes', neck: 0.5, girth: 0.8, where: ['sun'], herd: [3, 6] },
  ibex: { name: 'Mountain Ibex', shape: 'quad', len: 1.4, tall: 0.9, legs: 0.55, temper: 'shy', speed: 8, hp: 35, meat: 'goat', cuts: 3, hide: 2,
    coat: '#8a7a64', belly: '#c8bca8', dark: '#3a3228', ears: 'goat', tail: 'short', horns: 'sweep', neck: 0.4, beard: true, where: ['peaks', 'frost', 'warrens'], herd: [2, 4] },
  wild_goat: { name: 'Wild Goat', shape: 'quad', len: 1.2, tall: 0.75, legs: 0.55, temper: 'shy', speed: 7, hp: 28, meat: 'goat', cuts: 3, hide: 1,
    coat: '#5a4a3a', belly: '#9a8a74', dark: '#2a2018', ears: 'goat', tail: 'short', horns: 'curve', neck: 0.4, beard: true, where: ['warrens', 'heart'], herd: [2, 4] },
  wild_horse: { name: 'Wild Horse', shape: 'quad', len: 2.3, tall: 1.5, legs: 0.58, temper: 'shy', speed: 12, hp: 80, meat: null, hide: 0,
    coat: '#7a4a2a', belly: '#8a5a3a', dark: '#1c1410', ears: 'horse', tail: 'long', mane: true, neck: 0.75, hooves: '#1a1410', where: ['heart', 'sun'], herd: [3, 6] },
  bison: { name: 'Bison', shape: 'quad', len: 3, tall: 1.8, legs: 0.48, temper: 'calm', speed: 8, hp: 160, meat: 'beef', cuts: 9, hide: 4,
    coat: '#4a3424', belly: '#3a2818', dark: '#1a120c', ears: 'cow', tail: 'tuft', horns: 'short', hump: 0.35, shag: true, neck: 0.3, girth: 1.4, where: ['heart', 'frost'], herd: [3, 5] },
  camel: { name: 'Camel', shape: 'quad', len: 3, tall: 1.9, legs: 0.66, temper: 'calm', speed: 7, hp: 120, meat: 'camel', cuts: 8, hide: 3,
    coat: '#c8a070', belly: '#d8b484', dark: '#7a5a3a', ears: 'small', tail: 'tuft', hump: 0.4, neck: 0.95, neckUp: 0.35, girth: 1.05, where: ['sun'], herd: [2, 4] },
  duck: { name: 'Wild Duck', shape: 'bird', len: 0.5, tall: 0.4, temper: 'shy', speed: 4, hp: 5, meat: 'poultry', cuts: 1, hide: 0,
    coat: '#7a6a4a', belly: '#c8b48c', dark: '#e0902a', head: '#1e6a3a', beak: '#d8b030', where: ['mire', 'heart'], water: true, herd: [2, 5] },
  goose: { name: 'Wild Goose', shape: 'bird', len: 0.8, tall: 0.7, temper: 'shy', speed: 5, hp: 9, meat: 'poultry', cuts: 2, hide: 0,
    coat: '#8a8478', belly: '#e8e4dc', dark: '#d8802a', head: '#2a2a2a', beak: '#2a2a2a', longNeck: true, where: ['mire', 'frost'], water: true, herd: [3, 6] },
  partridge: { name: 'Partridge', shape: 'bird', len: 0.32, tall: 0.28, temper: 'shy', speed: 5, hp: 4, meat: 'poultry', cuts: 1, hide: 0,
    coat: '#8a7a64', belly: '#b8a890', dark: '#c84a2a', head: '#c8783a', beak: '#5a5048', where: ['heart', 'sun', 'warrens'], herd: [3, 6] },
  // wild beasts that bite: their hides and fangs sell, their meat is never eaten
  fox: { name: 'Red Fox', shape: 'quad', len: 0.75, tall: 0.4, legs: 0.5, temper: 'shy', speed: 9, hp: 14, meat: null, hide: 1, fang: 1,
    coat: '#c8642a', belly: '#f0e8dc', dark: '#2a1a12', ears: 'fox', tail: 'brush', snout: 1.3, neck: 0.3, girth: 0.75, where: ['heart', 'fae', 'frost'], woods: true, herd: [1, 1] },
  jackal: { name: 'Golden Jackal', shape: 'quad', len: 0.9, tall: 0.45, legs: 0.52, temper: 'shy', speed: 9, hp: 18, meat: null, hide: 1, fang: 1,
    coat: '#b8904a', belly: '#e8dcc0', dark: '#3a2a1a', ears: 'fox', tail: 'brush', snout: 1.25, neck: 0.3, girth: 0.75, where: ['sun', 'mire', 'warrens'], herd: [1, 2] },
  lynx: { name: 'Mountain Lynx', shape: 'quad', len: 1.05, tall: 0.62, legs: 0.56, temper: 'fierce', speed: 9, hp: 40, atk: 1.0, meat: null, hide: 2, fang: 1,
    coat: '#a88a64', belly: '#ece0cc', dark: '#2a2018', ears: 'fox', tail: 'stub', snout: 0.8, neck: 0.3, girth: 0.85, where: ['peaks', 'frost', 'sun', 'fae'], herd: [1, 1] },
  wolf: { name: 'Grey Wolf', shape: 'quad', len: 1.3, tall: 0.8, legs: 0.55, temper: 'fierce', speed: 9, hp: 45, atk: 1.1, meat: null, hide: 2, fang: 2,
    coat: '#7a7470', belly: '#c8c2b8', dark: '#2a2826', ears: 'fox', tail: 'brush', snout: 1.2, neck: 0.35, girth: 0.9, where: ['heart', 'frost', 'warrens', 'peaks'], woods: true, herd: [2, 4], night: true },
  bear: { name: 'Brown Bear', shape: 'quad', len: 2.2, tall: 1.2, legs: 0.42, temper: 'fierce', speed: 8, hp: 160, atk: 1.6, meat: null, hide: 4, fang: 2,
    coat: '#5a3a22', belly: '#4a3020', dark: '#2a1a10', ears: 'round', tail: 'stub', snout: 0.9, neck: 0.25, girth: 1.5, hump: 0.15, where: ['heart', 'frost', 'peaks'], woods: true, herd: [1, 1] },
  // kept on the farms: they belong to the farmer, so you feed and pet them, you don't hunt them
  horse: { name: 'Horse', shape: 'quad', len: 2.4, tall: 1.6, legs: 0.58, temper: 'calm', speed: 6, hp: 90, meat: null, hide: 0, farm: true,
    coat: '#5a3420', belly: '#6a4028', dark: '#1a120c', ears: 'horse', tail: 'long', mane: true, blaze: true, neck: 0.8, hooves: '#2a2018', where: ['farm'] },
  donkey: { name: 'Donkey', shape: 'quad', len: 1.6, tall: 1.1, legs: 0.55, temper: 'calm', speed: 4, hp: 50, meat: null, hide: 0, farm: true,
    coat: '#7a7068', belly: '#d8d0c4', dark: '#2a2622', ears: 'donkey', tail: 'tuft', mane: true, neck: 0.55, where: ['farm'] },
  cow: { name: 'Cow', shape: 'quad', len: 2.4, tall: 1.4, legs: 0.48, temper: 'calm', speed: 3, hp: 110, meat: 'beef', cuts: 8, hide: 3, farm: true,
    coat: '#f2eee4', belly: '#f2eee4', dark: '#2a2420', patches: '#2a2420', ears: 'cow', tail: 'tuft', horns: 'short', udder: true, neck: 0.35, girth: 1.3, where: ['farm'] },
  sheep: { name: 'Sheep', shape: 'quad', len: 1.3, tall: 0.8, legs: 0.42, temper: 'calm', speed: 4, hp: 30, meat: 'mutton', cuts: 3, hide: 1, farm: true,
    coat: '#ece4d4', belly: '#ece4d4', dark: '#2a2420', face: '#2a2420', ears: 'small', tail: 'short', wool: true, neck: 0.3, girth: 1.3, where: ['farm'] },
  goat: { name: 'Goat', shape: 'quad', len: 1.2, tall: 0.75, legs: 0.55, temper: 'calm', speed: 4, hp: 26, meat: 'goat', cuts: 3, hide: 1, farm: true,
    coat: '#f0ece4', belly: '#f0ece4', dark: '#5a5048', ears: 'goat', tail: 'short', horns: 'curve', beard: true, neck: 0.4, where: ['farm'] },
  chicken: { name: 'Chicken', shape: 'bird', len: 0.4, tall: 0.42, temper: 'calm', speed: 2.5, hp: 4, meat: 'poultry', cuts: 1, hide: 0, farm: true,
    coat: '#c8743a', belly: '#d89a5a', dark: '#e0b040', head: '#c8743a', beak: '#e0b040', comb: true, where: ['farm'] },
  turkey: { name: 'Turkey', shape: 'bird', len: 0.9, tall: 0.8, temper: 'calm', speed: 3, hp: 10, meat: 'poultry', cuts: 2, hide: 0, farm: true,
    coat: '#3a2e26', belly: '#4a3a2e', dark: '#c8a08a', head: '#a8c0d8', beak: '#c8b8a0', fan: true, comb: true, where: ['farm'] },
};

// What a hunter's bait draws in: the meat-eaters of the land (their meat is never eaten, but their
// hides and fangs sell). A body draws one bigger than itself if the land has one, so the bigger the
// bait, the bigger the beast that comes for it.
export function baitDraws(region, size) {
  const hunters = Object.entries(ANIMALS).filter(([, a]) => !a.farm && !a.meat && a.fang && a.where.includes(region));
  const bigger = hunters.filter(([, a]) => a.len > size);
  return (bigger.length ? bigger : hunters).map(([id]) => id);
}

// What the animals eat. Any of these in your bag can be fed to a grazing animal (or a bird);
// hunters and predators won't take them.
export const FEED = ['carrot', 'cabbage', 'lettuce', 'turnip', 'potato', 'pumpkin', 'apple', 'hay', 'grain'];

// Wild animals by region; woodland kinds only where trees are thick
export function wildAnimalsAt(region, forest = 0, nearWater = false) {
  const out = [];
  for (const [id, a] of Object.entries(ANIMALS)) {
    if (a.farm || !a.where.includes(region)) continue;
    if (a.woods && forest < 0.35) continue;
    if (a.water && !nearWater) continue;
    const n = a.rare ? 1 : a.temper === 'fierce' ? 2 : 4; // how often it turns up (out of the others)
    for (let i = 0; i < n; i++) out.push(id);
  }
  return out;
}

// The farm animals in a farm's pens and yard
export const FARM_HERD = [['cow', 3], ['sheep', 5], ['goat', 3], ['horse', 2], ['donkey', 1], ['chicken', 6], ['turkey', 2]];
