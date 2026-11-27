// The far wilds' strongholds: Monster Towers and Monster Camps (where they stand: WILD_SITES in
// world-layout.mjs). Shared by the game and the map. Each land builds them in its own way and fills
// them with its own monsters, and the further from Central City they stand, the stronger those are.
import { WILD_SITES, PLACES, toWorld, heightAt } from './world-layout.mjs';
import { wildLevelAt, WILD_MAX } from './wilds.mjs';

// Where each side starts out: Central City, and each monster race's homeland and Monster City.
// The further from the nearest of these, the more dangerous the land.
const STARTS = PLACES.filter((p) => p.spawn || p.home || p.city).map((p) => toWorld(p.px, p.py));
export const startDistance = (x, z) => Math.min(...STARTS.map((s) => Math.hypot(x - s.x, z - s.z)));
// How dangerous a spot is: the wilds' own level there, or (whichever is higher) a level that grows
// with the distance from the nearest start: about 5 at 2 km, 50 at 30 km, 150 at 100 km, 300 at
// 200 km, near the top of the wilds out at the edges of the world.
export const dangerAt = (x, z) => Math.min(WILD_MAX, Math.max(Math.round(wildLevelAt(x, z)), Math.round(2 + startDistance(x, z) * 0.0015)));

// The towers: what they're built of and who holds each floor (low floors first), and the Warden on the roof
export const TOWER_THEMES = {
  heart: { name: 'Forsaken Tower', wall: '#7a7468', wall2: '#686258', trim: '#4a4038', roof: '#3a4a5a', glow: '#ffb050', banner: '#5a2a2a',
    floors: [['goblin', 'slime'], ['hobgoblin', 'goblin'], ['chieftain', 'hobgoblin'], ['goblinlord', 'chieftain']], warden: 'ogrelord' },
  warrens: { name: 'Bone Tower', wall: '#8a7258', wall2: '#7a6248', trim: '#e8dcc0', roof: '#4e3a26', glow: '#ff8a3a', banner: '#3d5a22',
    floors: [['hobgoblin', 'chieftain'], ['chieftain', 'goblinlord'], ['goblinlord', 'ogrelord']], warden: 'emperor' },
  peaks: { name: 'Obsidian Spire', wall: '#2e2a2c', wall2: '#3a3436', trim: '#9a2e1c', roof: '#1e1a1c', glow: '#ff4a18', banner: '#9a1a10',
    floors: [['drake'], ['drake'], ['drake']], warden: 'drake' },
  mire: { name: 'Sunken Tower', wall: '#5a6650', wall2: '#4a5640', trim: '#6b4a2b', roof: '#2f4a3a', glow: '#9aff6a', banner: '#2f5a3a',
    floors: [['lizard', 'lizard'], ['lizard', 'serpent'], ['serpent']], warden: 'serpent' },
  frost: { name: 'Frost Spire', wall: '#bcd4e0', wall2: '#a8c4d4', trim: '#eaf6ff', roof: '#5a8ab0', glow: '#7ae0ff', banner: '#2a6a9a',
    floors: [['frostslime', 'slime'], ['frostslime']], warden: 'frostslime' },
  sun: { name: 'Sandstone Tower', wall: '#c8a26a', wall2: '#b8925a', trim: '#7a4a24', roof: '#9a5a2a', glow: '#ffc85a', banner: '#a8402a',
    floors: [['sandlizard', 'lizard'], ['sandlizard']], warden: 'sandlizard' },
  fae: { name: 'Crystal Spire', wall: '#d4cee4', wall2: '#c4bcd8', trim: '#a898d8', roof: '#5e4ca8', glow: '#d8a0ff', banner: '#8a5ad0',
    floors: [['wisp', 'slime'], ['wisp']], warden: 'wisp' },
};
// The camps: a warband round its fire, with a chief
export const CAMP_THEMES = {
  heart: { name: 'Goblin Camp', tent: '#7a5a3a', fire: '#ff9a40', kinds: ['goblin', 'goblin', 'hobgoblin'], chief: 'chieftain' },
  warrens: { name: 'Warband Camp', tent: '#6a4a2a', fire: '#ff7a2a', kinds: ['hobgoblin', 'chieftain'], chief: 'goblinlord' },
  peaks: { name: 'Drake Roost', tent: '#3a2a24', fire: '#ff4a18', kinds: ['drake'], chief: 'drake' },
  mire: { name: 'Serpent Nest', tent: '#4a5a34', fire: '#9aff6a', kinds: ['lizard', 'serpent'], chief: 'serpent' },
  frost: { name: 'Frozen Camp', tent: '#9ab8c8', fire: '#7ae0ff', kinds: ['frostslime', 'slime'], chief: 'frostslime' },
  sun: { name: 'Raider Camp', tent: '#b8925a', fire: '#ffb040', kinds: ['sandlizard', 'lizard'], chief: 'sandlizard' },
  fae: { name: 'Wisp Circle', tent: '#8a7ab8', fire: '#d8a0ff', kinds: ['wisp', 'slime'], chief: 'wisp' },
};
// the kind of cave ore a land's treasure is drawn from (see depths.mjs THEMES)
export const LOOT_THEME = { warrens: 'warren', heart: 'goblin', mire: 'serpent', peaks: 'drake', frost: 'slime', fae: 'fae', sun: 'sand' };

// A tower's floors: 3 near the middle, up to 8 out where the strongest monsters live
export const towerFloors = (level) => Math.min(8, 3 + Math.floor(level / 80));
export const FLOOR_H = 7; // metres from one floor to the next
// the Warden's level, and the level of the monsters on floor `f` (0 = the ground floor)
export const wardenLevel = (site) => Math.min(800, Math.round(site.level * 1.3 + 15));
export const floorLevel = (site, f) => Math.round(site.level + (wardenLevel(site) - 10 - site.level) * (f / site.floors));
// how long a beaten Warden or chief takes to come back
export const SITE_RETURNS_MS = 24 * 3600 * 1000;

let cache = null;
// Every tower and camp: id, kind, land, where it stands, how strong it is, its name and look
export function allSites() {
  if (cache) return cache;
  const n = { tower: 0, camp: 0 };
  cache = WILD_SITES.map(([kind, px, py, region]) => {
    const { x, z } = toWorld(px, py);
    const level = dangerAt(x, z);
    const T = (kind === 'tower' ? TOWER_THEMES : CAMP_THEMES)[region] || (kind === 'tower' ? TOWER_THEMES.heart : CAMP_THEMES.heart);
    const s = { id: `${kind}${n[kind]++}`, kind, region, px, py, x, z, level, theme: T, name: T.name };
    if (kind === 'tower') s.floors = towerFloors(level);
    return s;
  });
  return cache;
}
export const siteById = (id) => allSites().find((s) => s.id === id) || null;
// the ground a site stands on (the highest point under it, so nothing pokes through its floor)
export function siteGround(s, r) {
  let top = -Infinity, low = Infinity;
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI * 2, d = i === 8 ? 0 : r;
    const h = heightAt(s.x + Math.cos(a) * d, s.z + Math.sin(a) * d);
    top = Math.max(top, h); low = Math.min(low, h);
  }
  return { top, low };
}
// A fake cave of the right land and strength, so a tower's or camp's treasure is drawn just like a
// boss chest's (depths.mjs chestLoot)
export const lootCave = (s) => ({ theme: LOOT_THEME[s.region] || 'goblin', size: s.kind === 'tower' ? 'deep' : 'medium', dungeon: true, level: s.level });
