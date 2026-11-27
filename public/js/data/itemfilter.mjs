// Searching for items with filters: the kind of item, its rank, its type, the level it can be
// bought or forged from, where it comes from, and its name. The admin board's item finder and the
// game's Bag and Shop all filter with this, so an item lands in the same group everywhere.
import { ITEMS, RANKS, SHOP, MONSTER_SHOP, FORGE } from './items.mjs';
import { SKILLS } from './skills.mjs';
// the admin board writes prices with this (it can't import modules itself)
export { moneyWords } from './money.mjs';

// The groups an item can be in, in the order the chips show them
export const ITEM_GROUPS = [
  { id: 'weapon', name: 'Weapons', icon: '⚔️' },
  { id: 'armour', name: 'Armour', icon: '🛡️' },
  { id: 'food', name: 'Food & drink', icon: '🍞' },
  { id: 'potion', name: 'Potions', icon: '🧪' },
  { id: 'coating', name: 'Coatings', icon: '🧴' },
  { id: 'ore', name: 'Ores & gems', icon: '⛏️' },
  { id: 'material', name: 'Materials', icon: '🪵' },
  { id: 'tool', name: 'Tools', icon: '🔦' },
  { id: 'furniture', name: 'Furniture', icon: '🪑' },
  { id: 'seed', name: 'Seeds', icon: '🌱' },
  { id: 'mount', name: 'Mounts', icon: '🐎' },
  { id: 'egg', name: 'Eggs', icon: '🥚' },
  { id: 'pet', name: 'Pets', icon: '🐲' },
  { id: 'stone', name: 'Skill Stones', icon: '💎' },
];
// Item ranks (Basic to Mythic) and the letter ranks of the skills inside Skill Stones (F to SSS)
export const ITEM_RANKS = RANKS.map((r, i) => ({ id: String(i), name: r.name, color: r.color }));
export const STONE_RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
const WEAPON_TYPES = { sword: 'Sword', axe: 'Axe', club: 'Club', dagger: 'Dagger', mace: 'Mace', spear: 'Spear', staff: 'Staff', bow: 'Bow' };
const ARMOUR_SLOTS = { head: 'Helmet', body: 'Chest armour', legs: 'Leg armour', feet: 'Boots', shield: 'Shield' };
// the types the Type filter offers for weapons and armour
export const ITEM_TYPES = { weapon: WEAPON_TYPES, armour: ARMOUR_SLOTS };
export const ITEM_SOURCES = { shop: 'Sold in shops', forge: 'Forged by a Blacksmith', found: 'Found only (drops, gathering, mining)' };

// the lowest level each item is sold from, and the lowest a Blacksmith forges it from
const lowest = (list) => { const m = {}; for (const [id, lvl] of list) m[id] = Math.min(m[id] ?? Infinity, lvl); return m; };
const SHOP_LEVEL = lowest([...SHOP, ...MONSTER_SHOP]);
const FORGE_LEVEL = lowest(FORGE);

function groupOf(id, it) {
  if (it.kind === 'food') return it.heal || it.sp ? 'food' : 'potion';
  if (it.kind === 'material') return it.rank != null ? 'ore' : SHOP_LEVEL[id] != null ? 'tool' : 'material';
  return ITEM_GROUPS.some((g) => g.id === it.kind) ? it.kind : 'material';
}

const cache = {};
// Everything the filters look at for one item
export function itemInfo(id) {
  if (cache[id]) return cache[id];
  const it = ITEMS[id];
  if (!it) return null;
  const group = groupOf(id, it);
  const sub = it.kind === 'weapon' ? WEAPON_TYPES[it.type] || 'Weapon' : it.kind === 'armour' ? ARMOUR_SLOTS[it.slot] || 'Armour' : '';
  const shop = SHOP_LEVEL[id] ?? null, forge = FORGE_LEVEL[id] ?? null;
  const levels = [shop, forge].filter((x) => x != null);
  const skillRank = it.kind === 'stone' ? SKILLS[it.skill]?.rank || '' : '';
  const rank = Math.min(RANKS.length - 1, it.rank || 0);
  return (cache[id] = {
    id, name: it.name, icon: it.icon || '', group, sub, rank, skillRank, price: it.price || 0,
    shop, forge, level: levels.length ? Math.min(...levels) : null,
    from: [shop != null && 'shop', forge != null && 'forge', !levels.length && 'found'].filter(Boolean),
    text: it.text || '',
  });
}

export const emptyItemFilter = () => ({ group: 'all', rank: 'all', sub: 'all', from: 'all', min: '', max: '', q: '', sort: 'rank' });

// Does an item pass the filter? rank is 'all', an item rank '0'..'6', or 'stone:F'..'stone:SSS'
export function itemMatches(info, f) {
  if (!info) return false;
  if (f.group && f.group !== 'all' && info.group !== f.group) return false;
  if (f.rank && f.rank !== 'all') {
    if (f.rank.startsWith('stone:')) { if (info.skillRank !== f.rank.slice(6)) return false; }
    else if (String(info.rank) !== f.rank) return false;
  }
  if (f.sub && f.sub !== 'all' && info.sub !== f.sub) return false;
  if (f.from && f.from !== 'all' && !info.from.includes(f.from)) return false;
  const min = f.min === '' || f.min == null ? null : Number(f.min), max = f.max === '' || f.max == null ? null : Number(f.max);
  if ((min != null || max != null) && info.level == null) return false;
  if (min != null && info.level < min) return false;
  if (max != null && info.level > max) return false;
  const q = String(f.q || '').trim().toLowerCase();
  if (q && !info.name.toLowerCase().includes(q) && !info.id.includes(q.replace(/\s+/g, '_'))) return false;
  return true;
}

// Sort: by rank (highest first), name, price (dearest first) or level (lowest first)
export function sortItems(list, how = 'rank') {
  const lv = (x) => x.level ?? Infinity;
  const stone = (x) => STONE_RANKS.indexOf(x.skillRank);
  const by = {
    rank: (a, b) => b.rank - a.rank || stone(b) - stone(a) || a.name.localeCompare(b.name),
    name: (a, b) => a.name.localeCompare(b.name),
    price: (a, b) => b.price - a.price || a.name.localeCompare(b.name),
    level: (a, b) => lv(a) - lv(b) || a.name.localeCompare(b.name),
  }[how] || ((a, b) => a.name.localeCompare(b.name));
  return list.sort(by);
}
