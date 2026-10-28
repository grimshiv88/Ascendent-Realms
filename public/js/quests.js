// Quests: a board of quests made to fit your level and where you are. Kinds: Hunt (a kind of
// monster), Slay (any monsters at or above a level), Gather (wood, berries, monster parts), Mine
// (ore from the caves), Supply (food or potions), and Explore (reach a place). They grow harder as
// you level: more to do, stronger monsters, further to travel, and bigger rewards.
// You can take on QUESTS_PER_DAY quests from the board each day of the realm. A finished or
// abandoned quest isn't replaced at once: a new one is posted every NEW_QUEST_MS (8 hours of the
// realm's day, 20 real minutes).
import { ITEMS } from './data/items.mjs';
import { expToNext } from './data/game-data.mjs';
import { placesWithPositions, regionName, sample } from './data/world-layout.mjs';
import { gameTime, now, DAY_MS } from './data/clock.mjs';
import { KINDS, BY_REGION, GOBLIN_LINE } from './world/creatures.js';

export const BOARD = 4;
export const QUESTS_PER_DAY = 3;
export const NEW_QUEST_MS = DAY_MS / 3;
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
// how much more a quest asks for at your level: 1 at level 1, 2 at 25, 3 at 50…
const scale = (c) => 1 + (c.level - 1) / 25;

// What can be gathered, and how many to ask for (before the level scale)
const GATHER = [['log', 4, 10], ['berries', 3, 8], ['reed', 3, 8], ['cactus_flesh', 2, 5], ['slime_gel', 2, 6], ['goblin_ear', 2, 5], ['lizard_scale', 2, 5], ['fae_dust', 2, 4]];
const GATHER_REGION = { log: null, berries: null, reed: 'mire', cactus_flesh: 'sun', slime_gel: null, goblin_ear: 'warrens', lizard_scale: 'mire', fae_dust: 'fae' };
// ore by the level you'd be mining it at
const MINE = [['copper_ore', 1], ['iron_ore', 1], ['crystal_shard', 10], ['silver_ore', 15], ['gold_ore', 25], ['emerald', 30], ['sapphire', 35], ['ruby', 50], ['moonstone', 80], ['dragonite', 100]];
const SUPPLY = [['bread', 1], ['water_flask', 1], ['apple', 1], ['herbal_tea', 1], ['honey_cake', 3], ['roast_meat', 4], ['potion', 5], ['sp_potion', 5], ['stew', 12], ['big_potion', 20]];

function rewardFor(c, effort) {
  // effort 1 is a quick job; a level's worth of EXP takes several quests
  const need = expToNext(c.level, c.race);
  const exp = Math.max(3, Math.round(need * (0.12 + Math.random() * 0.1) * effort));
  const coins = Math.round((5 + c.level * 3) * effort * (0.8 + Math.random() * 0.4));
  const item = Math.random() < 0.3 ? pick(c.level >= 20 ? ['big_potion', 'sp_potion', 'stew', 'silver_ore'] : c.level >= 5 ? ['potion', 'herb', 'sp_potion', 'bread'] : ['herb', 'bread', 'bread']) : null;
  return { exp, coins, ...(item ? { item } : {}) };
}

export function makeQuest(c, here, type = pick(['hunt', 'hunt', 'slay', 'gather', 'mine', 'supply', 'explore'])) {
  const region = sample(here.x, here.z, {}).region;
  const k = scale(c);
  if (type === 'hunt') {
    // monsters of this region, near your level if possible
    const local = [...new Set(BY_REGION[region] || BY_REGION.heart)];
    const fit = local.filter((id) => KINDS[id].levels[0] <= c.level + 4 && KINDS[id].levels[1] >= c.level - 10);
    // nothing here near your level: ask for strong monsters anywhere instead
    if (!fit.length) return makeQuest(c, here, 'slay');
    let kind = pick(fit);
    // goblins near an evolved player are evolved too
    if (GOBLIN_LINE.includes(kind)) kind = GOBLIN_LINE[Math.min(5, Math.max(GOBLIN_LINE.indexOf(kind), c.stage || 0))];
    const need = Math.min(30, Math.round(between(3, 6) * k));
    return { type, kind, need, have: 0, title: `Hunt: ${KINDS[kind].name}`, text: `Defeat ${need} ${KINDS[kind].name}s around ${regionName(region)}.`, reward: rewardFor(c, need / 3) };
  }
  if (type === 'slay') {
    const min = Math.max(1, c.level - 2);
    const need = Math.min(25, Math.round(between(4, 7) * k));
    return { type, min, need, have: 0, title: `Slay: Level ${min}+`, text: `Defeat ${need} monsters of level ${min} or higher, anywhere.`, reward: rewardFor(c, need / 2.6) };
  }
  if (type === 'mine') {
    const ores = MINE.filter(([, lvl]) => lvl <= c.level);
    const [item] = ores[Math.max(0, ores.length - 1 - between(0, 2))] || MINE[0];
    const need = Math.min(40, Math.round(between(3, 6) * Math.sqrt(k)));
    return { type: 'gather', item, need, have: 0, title: `Mine: ${ITEMS[item].name}`, text: `Bring ${need} ${ITEMS[item].name} from the caves. They are taken from your bag when you claim the reward.`, reward: rewardFor(c, 0.9 + need / 6) };
  }
  if (type === 'supply') {
    const goods = SUPPLY.filter(([, lvl]) => lvl <= c.level);
    const [item] = pick(goods.slice(-4));
    const need = Math.min(20, Math.round(between(2, 4) * Math.sqrt(k)));
    return { type: 'gather', item, need, have: 0, title: `Supply: ${ITEMS[item].name}`, text: `The waystone keepers need ${need} ${ITEMS[item].name}. Buy, brew or cook them; they are taken from your bag when you claim the reward.`, reward: rewardFor(c, 0.5 + need / 6) };
  }
  if (type === 'gather') {
    const options = GATHER.filter(([id]) => !GATHER_REGION[id] || GATHER_REGION[id] === region);
    const [item, lo, hi] = pick(options);
    const need = Math.min(60, Math.round(between(lo, hi) * k));
    return { type, item, need, have: 0, title: `Gather: ${ITEMS[item].name}`, text: `Bring ${need} ${ITEMS[item].name}. They are taken from your bag when you claim the reward.`, reward: rewardFor(c, 0.6 + need / 8) };
  }
  // explore a place or a cave; the higher your level, the further away
  const far = 3000 + c.level * 150;
  const spots = placesWithPositions().filter((p) => {
    const d = Math.hypot(p.x - here.x, p.z - here.z);
    return d > 300 && d < far;
  });
  if (!spots.length) return makeQuest(c, here, 'slay');
  const p = pick(spots);
  const d = Math.hypot(p.x - here.x, p.z - here.z);
  const name = p.cave ? `the cave in ${regionName(sample(p.x, p.z, {}).region)}` : p.name;
  const dir = compass(p.x - here.x, p.z - here.z);
  return { type: 'explore', place: { x: Math.round(p.x), z: Math.round(p.z), r: p.cave ? 25 : 60 }, need: 1, have: 0, title: `Explore: ${p.cave ? 'A hidden cave' : p.name}`, text: `Travel to ${name}, about ${(d / 1000).toFixed(1)} km to the ${dir}. It shows on your map (M).`, reward: rewardFor(c, 0.8 + d / 2500) };
}

function compass(dx, dz) {
  // north is -z
  const a = (Math.atan2(dx, -dz) * 180) / Math.PI;
  return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(((a + 360) % 360) / 45) % 8];
}

// Fill the board: a new board starts full; after that one quest is posted every NEW_QUEST_MS.
export function fillBoard(c, here) {
  c.quests ||= [];
  const t = now();
  if (!c.quests.length && !c.questNext) { while (c.quests.length < BOARD) c.quests.push({ ...makeQuest(c, here), accepted: false }); return; }
  if (c.quests.length >= BOARD) { c.questNext = 0; return; }
  if (!c.questNext) { c.questNext = t + NEW_QUEST_MS; return; }
  while (c.quests.length < BOARD && t >= c.questNext) {
    c.quests.push({ ...makeQuest(c, here), accepted: false });
    c.questNext += NEW_QUEST_MS;
  }
  if (c.quests.length >= BOARD) c.questNext = 0;
  else if (c.questNext < t) c.questNext = t + NEW_QUEST_MS;
}
// how many quests you have taken on today (a day of the realm)
export function questsToday(c) {
  const day = gameTime().day;
  return c.questDay?.day === day ? c.questDay.n : 0;
}

// How far a quest has come; gather quests count what is in your bag
export function progressOf(q, game) {
  if (q.type === 'gather') return Math.min(q.need, game.count(q.item));
  return Math.min(q.need, q.have);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export function renderQuests(el, game, tabsHtml, message = '') {
  const c = game.character;
  const cards = c.quests.map((q, i) => {
    const have = progressOf(q, game);
    const done = q.accepted && have >= q.need;
    const r = q.reward;
    const reward = [`${r.exp} EXP`, `${r.coins} G`, r.item ? ITEMS[r.item].name : null].filter(Boolean).join(' · ');
    const action = !q.accepted
      ? `<button type="button" class="sys-button" data-quest-accept="${i}" ${questsToday(c) >= QUESTS_PER_DAY ? 'disabled' : ''}>Accept</button>`
      : done
        ? `<button type="button" class="sys-button" data-quest-claim="${i}">Claim reward</button>`
        : `<button type="button" class="sys-button ghost" data-quest-drop="${i}">Give up</button>`;
    return `<div class="quest${q.accepted ? ' on' : ''}${done ? ' done' : ''}">
      <div class="quest-head"><b>${esc(q.title)}</b>${q.accepted ? `<span class="quest-count">${have} / ${q.need}</span>` : ''}</div>
      <p>${esc(q.text)}</p>
      ${q.accepted ? `<div class="quest-bar"><span style="width:${(have / q.need) * 100}%"></span></div>` : ''}
      <div class="quest-foot"><span class="quest-reward">Reward: ${esc(reward)}</span>${action}</div>
    </div>`;
  }).join('');
  el.innerHTML = `
    <div class="system-window quest-window" role="dialog" aria-label="Quests">
      <button type="button" class="sys-close" data-close aria-label="Close">×</button>
      ${tabsHtml('quests')}
      <div class="sys-title"><span class="sys-bang">!</span><h2>Quests</h2></div>
      <p class="sys-top">Taken today: <b>${questsToday(c)} / ${QUESTS_PER_DAY}</b>${c.quests.length < BOARD && c.questNext ? ` <span>·</span> Next quest posted in <b>${Math.max(1, Math.ceil((c.questNext - now()) / 60000))} min</b>` : ''}</p>
      <p class="sys-hint">You can take on ${QUESTS_PER_DAY} quests a day. A new one is posted every 8 hours of the realm (20 minutes). They grow harder, and pay more, as you level.</p>
      <p class="sys-msg" role="status">${esc(message)}</p>
      <div class="quest-list">${cards || '<p class="sys-hint">The board is empty. Come back when a new quest is posted.</p>'}</div>
    </div>`;
}
