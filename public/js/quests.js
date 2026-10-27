// Quests: a board of three randomly made quests that fit your level and where you are.
// Hunt (defeat monsters), Gather (bring items) and Explore (reach a place). Rewards are EXP, coins and
// sometimes an item. Finish one and claim it, and a new quest takes its place.
import { ITEMS } from './data/items.mjs';
import { expToNext } from './data/game-data.mjs';
import { placesWithPositions, regionName, sample } from './data/world-layout.mjs';
import { KINDS, BY_REGION } from './world/creatures.js';

const BOARD = 3;
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// What can be gathered, and how many to ask for
const GATHER = [['log', 4, 10], ['berries', 3, 8], ['reed', 3, 8], ['cactus_flesh', 2, 5], ['slime_gel', 2, 6], ['goblin_ear', 2, 5], ['lizard_scale', 2, 5], ['fae_dust', 2, 4]];
const GATHER_REGION = { log: null, berries: null, reed: 'mire', cactus_flesh: 'sun', slime_gel: null, goblin_ear: 'warrens', lizard_scale: 'mire', fae_dust: 'fae' };

function rewardFor(c, effort) {
  // effort 1 is a quick job; a level's worth of EXP takes several quests
  const need = expToNext(c.level, c.race);
  const exp = Math.max(3, Math.round(need * (0.12 + Math.random() * 0.1) * effort));
  const coins = Math.round((8 + c.level * 4) * effort * (0.8 + Math.random() * 0.4));
  const item = Math.random() < 0.3 ? pick(c.level >= 5 ? ['potion', 'herb', 'sp_potion', 'bread'] : ['herb', 'bread', 'bread']) : null;
  return { exp, coins, ...(item ? { item } : {}) };
}

export function makeQuest(c, here) {
  const region = sample(here.x, here.z, {}).region;
  const type = pick(['hunt', 'hunt', 'gather', 'explore']);
  if (type === 'hunt') {
    // monsters of this region, near your level if possible
    const local = [...new Set(BY_REGION[region] || BY_REGION.heart)];
    const fit = local.filter((k) => KINDS[k].levels[0] <= c.level + 4);
    const kind = pick(fit.length ? fit : local);
    const need = between(3, 6);
    return { type, kind, need, have: 0, title: `Hunt: ${KINDS[kind].name}`, text: `Defeat ${need} ${KINDS[kind].name}s around ${regionName(region)}.`, reward: rewardFor(c, need / 3) };
  }
  if (type === 'gather') {
    const options = GATHER.filter(([id]) => !GATHER_REGION[id] || GATHER_REGION[id] === region);
    const [item, lo, hi] = pick(options);
    const need = between(lo, hi);
    return { type, item, need, have: 0, title: `Gather: ${ITEMS[item].name}`, text: `Bring ${need} ${ITEMS[item].name}. They are taken from your bag when you claim the reward.`, reward: rewardFor(c, 0.6 + need / 8) };
  }
  // explore a place or a cave within a few kilometres
  const spots = placesWithPositions().filter((p) => {
    const d = Math.hypot(p.x - here.x, p.z - here.z);
    return d > 300 && d < 6000;
  });
  if (!spots.length) return makeQuestOf(c, here, 'hunt');
  const p = pick(spots);
  const d = Math.hypot(p.x - here.x, p.z - here.z);
  const name = p.cave ? `the cave in ${regionName(sample(p.x, p.z, {}).region)}` : p.name;
  const dir = compass(p.x - here.x, p.z - here.z);
  return { type: 'explore', place: { x: Math.round(p.x), z: Math.round(p.z), r: p.cave ? 25 : 60 }, need: 1, have: 0, title: `Explore: ${p.cave ? 'A hidden cave' : p.name}`, text: `Travel to ${name}, about ${(d / 1000).toFixed(1)} km to the ${dir}. It shows on your map (M).`, reward: rewardFor(c, 0.8 + d / 2500) };
}
function makeQuestOf(c, here, type) {
  for (let i = 0; i < 10; i++) { const q = makeQuest(c, here); if (q.type === type) return q; }
  return makeQuest(c, here);
}

function compass(dx, dz) {
  // north is -z
  const a = (Math.atan2(dx, -dz) * 180) / Math.PI;
  return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(((a + 360) % 360) / 45) % 8];
}

// Fill the board up to three quests
export function fillBoard(c, here) {
  c.quests ||= [];
  while (c.quests.length < BOARD) c.quests.push({ ...makeQuest(c, here), accepted: false });
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
      ? `<button type="button" class="sys-button" data-quest-accept="${i}">Accept</button>`
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
      <p class="sys-top">New quests appear when you finish or give one up. They fit your level and where you are.</p>
      <p class="sys-msg" role="status">${esc(message)}</p>
      <div class="quest-list">${cards}</div>
    </div>`;
}
