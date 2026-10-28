// Monster villages: camps of one monster race out in the wilds, a few kilometres from the towns.
// Each holds plain monsters of the race, a couple that have made their first evolution (level 20)
// and a chief that has made its second (level 50), with the village chest in the middle. When every
// monster is beaten the chest opens; once it is looted the village is gone, and a while later a new
// one springs up somewhere else. Each character has their own villages (kept with the character).
export const VILLAGES_AT_ONCE = 3;
export const VILLAGE_RETURNS_MS = 30 * 60 * 1000; // a new village appears half an hour after one is looted
export const VILLAGE_NEAR = [3000, 6000]; // metres from the nearest town (monsters of about level 16 to 35 live there)
export const VILLAGE_RACES = ['goblin', 'slime', 'fairy', 'lizardman', 'naga', 'dragonewt'];
// the wild monster each race's village is made of (see world/creatures.js KINDS)
export const VILLAGE_KIND = { goblin: 'goblin', slime: 'slime', fairy: 'wisp', lizardman: 'lizard', naga: 'serpent', dragonewt: 'drake' };
// the races that settle in each part of the land
const REGION_RACES = { heart: ['goblin', 'slime'], warrens: ['goblin'], peaks: ['dragonewt'], fae: ['fairy'], mire: ['lizardman', 'naga'], frost: ['slime'], sun: ['lizardman'] };
export const VILLAGE_NAME = { goblin: 'Goblin Village', slime: 'Slime Pools', fairy: 'Fae Hollow', lizardman: 'Lizardfolk Camp', naga: 'Naga Nest', dragonewt: 'Dragonewt Roost' };

export const raceForRegion = (region, rnd = Math.random) => {
  const list = REGION_RACES[region] || REGION_RACES.heart;
  return list[Math.floor(rnd() * list.length)];
};
const between = (a, b, rnd) => a + Math.floor(rnd() * (b - a + 1));

// Who lives there: [stage, level] for each monster. 6 to 8 plain ones (level 10 to 19), 2 or 3 that
// have evolved once (level 20 to 28) and one chief that has evolved twice (level 50 to 55).
export function villageFolk(rnd = Math.random) {
  const folk = [];
  for (let i = between(6, 8, rnd); i > 0; i--) folk.push([0, between(10, 19, rnd)]);
  for (let i = between(2, 3, rnd); i > 0; i--) folk.push([1, between(20, 28, rnd)]);
  folk.push([2, between(50, 55, rnd)]);
  return folk;
}

// A new village at (x, z) for this region's race
export function newVillage(x, z, region, rnd = Math.random) {
  const race = raceForRegion(region, rnd);
  return { id: `v${Date.now().toString(36)}${Math.floor(rnd() * 1296).toString(36)}`, x: Math.round(x), z: Math.round(z), race, folk: villageFolk(rnd), dead: [], looted: false };
}

export const villageName = (v) => VILLAGE_NAME[v.race] || 'Monster Village';
export const villageCleared = (v) => v.folk.every((_, i) => v.dead.includes(i));

// What the chest holds: coins and a few things, more for a stronger chief
export function villageLoot(v, rnd = Math.random) {
  const chief = Math.max(...v.folk.map(([, l]) => l));
  const items = [['big_potion', between(1, 2, rnd)], ['potion', between(2, 4, rnd)]];
  const rare = ['moonstone', 'gold_ore', 'iron_ore', 'iron_sword', 'chainmail', 'hand_axe', 'iron_mace'];
  for (let i = 0; i < 2; i++) items.push([rare[Math.floor(rnd() * rare.length)], 1]);
  return { coins: 300 + chief * 20 + between(0, 200, rnd), items };
}
