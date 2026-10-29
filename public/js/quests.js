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
import { CARD_RANKS, rankIndex, rankHard, rankForLevel, CARD_FEE, mayTake } from './data/guildcard.mjs';
import { money } from './data/money.mjs';

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

function baseReward(c, effort) {
  // effort 1 is a quick job; a level's worth of EXP takes several quests
  const need = expToNext(c.level, c.race);
  const exp = Math.max(3, Math.round(need * (0.12 + Math.random() * 0.1) * effort));
  const coins = Math.round((5 + c.level * 3) * effort * (0.8 + Math.random() * 0.4));
  const item = Math.random() < 0.3 ? pick(c.level >= 20 ? ['big_potion', 'sp_potion', 'stew', 'silver_ore'] : c.level >= 5 ? ['potion', 'herb', 'sp_potion', 'bread'] : ['herb', 'bread', 'bread']) : null;
  return { exp, coins, ...(item ? { item } : {}) };
}

export function makeQuest(c, here, type = pick(['hunt', 'hunt', 'slay', 'gather', 'mine', 'supply', 'explore']), hard = 1) {
  const region = sample(here.x, here.z, {}).region;
  const k = scale(c) * hard;
  const rewardFor = (cc, effort) => baseReward(cc, effort * hard);
  if (type === 'hunt') {
    // monsters of this region, near your level if possible
    const local = [...new Set(BY_REGION[region] || BY_REGION.heart)];
    const fit = local.filter((id) => KINDS[id].levels[0] <= c.level + 4 && KINDS[id].levels[1] >= c.level - 10);
    // nothing here near your level: ask for strong monsters anywhere instead
    if (!fit.length) return makeQuest(c, here, 'slay', hard);
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
  if (!spots.length) return makeQuest(c, here, 'slay', hard);
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

// The boards: the quest board (Q) and the guild board in the Main Guild Hall. Guild requests are
// harder and pay more, and you can hold only one at a time.
export const BOARDS = {
  quests: { list: 'quests', next: 'questNext', size: BOARD, hard: 1 },
  guild: { list: 'guildQuests', next: 'guildNext', size: 3, hard: 1.6 },
};
// Fill a board: a new board starts full; after that one quest is posted every NEW_QUEST_MS.
export function fillBoard(c, here, board = 'quests') {
  const B = BOARDS[board];
  c[B.list] ||= [];
  const list = c[B.list];
  const post = () => {
    if (board === 'guild') {
      // guild requests carry a rank: mostly the hunter's own, now and then one higher (to aim for)
      const mine = c.guildCard?.rank ? rankIndex(c.guildCard.rank) : rankIndex(rankForLevel(c.level).id);
      const own = CARD_RANKS[mine].id;
      const higher = list.some((q) => q.rank === own) && Math.random() < 0.3; // always at least one you can take
      const rank = CARD_RANKS[Math.min(CARD_RANKS.length - 1, mine + (higher ? 1 : 0))].id;
      const q = { ...makeQuest(c, here, undefined, rankHard(rank)), accepted: false, guild: true, rank };
      q.title = `Rank ${rank} · Guild ${q.title}`;
      list.push(q);
      return;
    }
    list.push({ ...makeQuest(c, here, undefined, B.hard), accepted: false });
  };
  const t = now();
  if (!list.length && !c[B.next]) { while (list.length < B.size) post(); return; }
  if (list.length >= B.size) { c[B.next] = 0; return; }
  if (!c[B.next]) { c[B.next] = t + NEW_QUEST_MS; return; }
  while (list.length < B.size && t >= c[B.next]) { post(); c[B.next] += NEW_QUEST_MS; }
  if (list.length >= B.size) c[B.next] = 0;
  else if (c[B.next] < t) c[B.next] = t + NEW_QUEST_MS;
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

function questCards(game, board) {
  const c = game.character;
  const list = c[BOARDS[board].list] || [];
  const blocked = board === 'guild' ? list.some((q) => q.accepted) : questsToday(c) >= QUESTS_PER_DAY;
  return list.map((q, i) => {
    const have = progressOf(q, game);
    const done = q.accepted && have >= q.need;
    const r = q.reward;
    const locked = board === 'guild' && (!c.guildCard?.rank || (q.rank && !mayTake(c.guildCard, q.rank)));
    const reward = [`${r.exp} EXP`, `${money(r.coins)}`, r.item ? ITEMS[r.item].name : null].filter(Boolean).join(' · ');
    const at = `data-board="${board}"`;
    const action = !q.accepted
      ? `<button type="button" class="sys-button" data-quest-accept="${i}" ${at} ${blocked || locked ? 'disabled' : ''}>${locked ? (c.guildCard?.rank ? `Needs rank ${q.rank}` : 'Needs a Guild Card') : 'Accept'}</button>`
      : done
        ? `<button type="button" class="sys-button" data-quest-claim="${i}" ${at}>Claim reward</button>`
        : `<button type="button" class="sys-button ghost" data-quest-drop="${i}" ${at}>Give up</button>`;
    return `<div class="quest${q.accepted ? ' on' : ''}${done ? ' done' : ''}">
      <div class="quest-head"><b>${esc(q.title)}</b>${q.accepted ? `<span class="quest-count">${have} / ${q.need}</span>` : ''}</div>
      <p>${esc(q.text)}</p>
      ${q.accepted ? `<div class="quest-bar"><span style="width:${(have / q.need) * 100}%"></span></div>` : ''}
      <div class="quest-foot"><span class="quest-reward">Reward: ${esc(reward)}</span>${action}</div>
    </div>`;
  }).join('');
}
const nextIn = (c, board) => { const B = BOARDS[board]; return (c[B.list] || []).length < B.size && c[B.next] ? Math.max(1, Math.ceil((c[B.next] - now()) / 60000)) : 0; };

export function renderQuests(el, game, tabsHtml, message = '') {
  const c = game.character;
  const cards = questCards(game, 'quests');
  const mins = nextIn(c, 'quests');
  const guild = (c.guildQuests || []).find((q) => q.accepted);
  el.innerHTML = `
    <div class="system-window quest-window" role="dialog" aria-label="Quests">
      <button type="button" class="sys-close" data-close aria-label="Close">×</button>
      ${tabsHtml('quests')}
      <div class="sys-title"><span class="sys-bang">!</span><h2>Quests</h2></div>
      <p class="sys-top">Taken today: <b>${questsToday(c)} / ${QUESTS_PER_DAY}</b>${mins ? ` <span>·</span> Next quest posted in <b>${mins} min</b>` : ''}</p>
      <p class="sys-hint">You can take on ${QUESTS_PER_DAY} quests a day. A new one is posted every 8 hours of the realm (20 minutes). They grow harder, and pay more, as you level.</p>
      <p class="sys-msg" role="status">${esc(message)}</p>
      <div class="quest-list">${cards || '<p class="sys-hint">The board is empty. Come back when a new quest is posted.</p>'}</div>
      ${guild ? `<h3 class="sys-sub">Your guild request</h3><p class="sys-hint">${esc(guild.title)}: ${progressOf(guild, game)} / ${guild.need}. Claim it at the Main Guild Hall in the Central City.</p>` : ''}
    </div>`;
}

// The Main Guild Hall: every guild's requests are posted here. One guild request at a time.
// The Main Guild Hall counter: your Hunter's Guild Card, guild requests, the Bounty Board, and the
// way to the meeting rooms and to parties and guilds. `bounty` is { board, message } from the guild.
export function renderGuild(el, game, message = '', bounty = null) {
  const c = game.character;
  const mins = nextIn(c, 'guild');
  const card = c.guildCard;
  const rank = card?.rank ? CARD_RANKS[rankIndex(card.rank)] : null;
  const cardHtml = !card
    ? `<p class="sys-hint">To take guild requests you need a <b>Hunter's Guild Card</b>. Ask for one here, then go to the Assessment Room (the glowing crystal in the back left corner) to have your level and stats read.</p>
       <button type="button" class="gold-button small" data-card-request>Ask for a Hunter Card · ${money(CARD_FEE)}</button>`
    : card.pending
      ? '<p class="sys-hint">Your card is waiting. Go to the <b>Assessment Room</b> in the back left corner and press E at the crystal to have it read.</p>'
      : `<div class="guild-card"><span class="gc-rank">${rank.id}</span><span><b>${esc(c.name)}</b><small>Rank ${rank.id} · ${rank.name} hunter · read at level ${card.level}</small></span></div>
         <p class="sys-hint">You can take requests of rank ${rank.id} and below.${rankForLevel(c.level).id !== rank.id ? ' <b>You have grown since your card was read:</b> touch the crystal again to raise its rank.' : ''}</p>`;
  const board = bounty?.board || [];
  const rows = board.map((b) => `<div class="bounty${b.featured ? ' featured' : ''}"><b>${esc(b.target)}</b>
      <span>${money(b.total + b.gift)}${b.gift ? ` <small>(${b.total} from hunters + ${b.gift} from the guild)</small>` : ''}${b.mine ? ` <small>· ${money(b.mine)} of it is yours</small>` : ''}</span>${b.featured ? '<em>Wanted today</em>' : ''}</div>`).join('');
  el.innerHTML = `
    <div class="system-window quest-window" role="dialog" aria-label="Main Guild Hall">
      <button type="button" class="sys-close" data-close aria-label="Close">×</button>
      <div class="sys-title"><span class="sys-bang">!</span><h2>Main Guild Hall</h2></div>
      <p class="sys-msg" role="status">${esc(message)}</p>
      <h3 class="sys-sub">Your Guild Card</h3>
      ${cardHtml}
      <h3 class="sys-sub">Guild requests</h3>
      <p class="sys-top">Harder than the quest board, and they pay more. Each has a rank; you can hold <b>one</b> at a time.${mins ? ` <span>·</span> Next request in <b>${mins} min</b>` : ''}</p>
      <div class="quest-list">${questCards(game, 'guild') || '<p class="sys-hint">No requests right now. A new one is posted every 20 minutes.</p>'}</div>
      <h3 class="sys-sub">Bounty Board</h3>
      <p class="sys-hint">Put a price on anyone's head, player or monster. You pay the prize to the guild (plus a 10% fee) and the guild pays whoever brings them down. Each day the guild picks a few wanted names and adds a prize of its own.</p>
      <div class="bounty-list">${bounty ? rows || '<p class="sys-hint">No bounties posted.</p>' : '<p class="sys-hint">Reading the board…</p>'}</div>
      <form class="bounty-form" data-bounty-form>
        <input name="target" maxlength="24" placeholder="Name" autocomplete="off" required>
        <input name="prize" type="number" min="100" step="10" placeholder="Prize in Copper (100 = 1 Silver)" required>
        <button type="submit" class="gold-button small">Post bounty</button>
      </form>
      ${bounty?.message ? `<p class="sys-msg">${esc(bounty.message)}</p>` : ''}
      <h3 class="sys-sub">Meeting rooms</h3>
      <p class="sys-hint">Upstairs are rooms for parties and guild masters, rented by the hour, with their own private chat.</p>
      <button type="button" class="gold-button small" data-open-rooms>See the meeting rooms</button>
      <h3 class="sys-sub">Parties and guilds</h3>
      <p class="sys-hint">Start a party, answer invites, or found a guild of your own here.</p>
      <button type="button" class="gold-button small" data-open-groups>Party and guild</button>
    </div>`;
}
