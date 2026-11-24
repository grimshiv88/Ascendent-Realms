// The Bag (inventory with your character and equipment), the Shop and the Blacksmith's merging.
// They share one window with the Status Window, with tabs along the top.
import { ITEMS, shopFor, formName, SLOTS, isGear, slotOf, upgraded, reachText, RANKS, rankOf, evolvedName, effectText, EFFECTS, BREWS, POTION_MAKER, brewCost, brewSeconds, brewHerbs, categoryOf, forgeCost, forgeOres, FORGE, FORGE_WORKSHOP, FORGE_RANK_LEVEL, MARKETS, marketStock, marketPrice, gearSkillSlots, mythicSkill } from './data/items.mjs';
import { SKILLS } from './data/skills.mjs';
import { codeFor, keyName } from './data/controls.mjs';
import { subOf, LADDERS, MERGES, MERGE_COUNT, mergesWith, ladderName } from './data/merges.mjs';
import { money, MINT } from './data/money.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const keyOf = (e) => e.uid || e.id;
// An item picture: the rendered model fills in later (see icons.js); the emoji shows until then
const pic = (id, plus = 0, cls = 'bag-icon') => `<img class="item-pic" data-icon="${id}" data-plus="${plus}" alt=""><span class="${cls}">${ITEMS[id]?.icon || '?'}</span>`;
// monster gear goes by another name while its wearer is in humanoid form (set by each window)
let wearerForm = null;
const nameOf = (e) => `${ITEMS[e.id] ? evolvedName({ ...ITEMS[e.id], name: formName(ITEMS[e.id], wearerForm) }, e.plus || 0) : e.id}${e.plus ? ` +${e.plus}` : ''}`;
// A weapon's rank as a coloured tag
const rankTag = (it, plus = 0) => { const r = RANKS[rankOf(it, plus)]; return `<span class="rank-tag" style="--rank:${r.color}">${r.name}</span>`; };

// Only a Potion Maker sees the Potion-Maker tab (main.js says which class is playing)
let playingClass = null;
export const setTabsClass = (cls) => { playingClass = cls; };
export function tabsHtml(active) {
  const tab = (id, label, action) => `<button type="button" class="sw-tab" data-open="${id}" aria-pressed="${active === id}">${label}${action ? ` <kbd>${esc(keyName(codeFor(action)))}</kbd>` : ''}</button>`;
  return `<div class="sw-tabs">${tab('status', 'Status', 'status')}${tab('bag', 'Bag', 'bag')}${tab('shop', 'Shop', 'shop')}${tab('quests', 'Quests', 'quests')}${playingClass === 'blacksmith' ? tab('smith', 'Blacksmith') : ''}${playingClass === 'potion_maker' ? tab('potions', 'Potion-Maker') : ''}</div>`;
}
// "Weapon › Sword", "Armour › Helmet": what an item can be merged with
const catTag = (it) => { const k = categoryOf(it); return `<span class="cat-tag">${k.cat}${k.sub ? ` › ${k.sub}` : ''}</span>`; };

function describe(it, plus = 0) {
  if (isGear(it)) return `${catTag(it)} ${describeGear(it, plus)}${it.beast ? `<br><span class="faint">Monster gear · in humanoid form: ${esc(it.human || it.name)}</span>` : ''}`;
  return describeGear(it, plus);
}
function describeGear(it, plus = 0) {
  if (it.kind === 'weapon') {
    const fx = effectText(it, plus);
    const next = [3, 6, 9].find((n) => n > plus);
    return `${rankTag(it, plus)} ${it.magic ? 'MATK' : 'ATK'} +${upgraded(it.power, plus)} · ${it.speed}s per swing · ${reachText(it)}${it.chop >= 4 ? ' · fells even great trees' : it.chop >= 3 ? ' · fells big trees' : it.chop >= 1.5 ? ' · chops young trees fast' : ''}${fx ? `<br>${fx}` : ''}${next ? `<br><span class="faint">Evolves at +${next}</span>` : ''}`;
  }
  if (it.kind === 'furniture') return '🏠 Furniture for a home';
  if (it.kind === 'stone') return `💠 Skill Stone · set it into Rare or better gear`;
  if (it.kind === 'coating') return `${EFFECTS[it.coat].icon} Coats a weapon for ${it.hits} hits (Blacksmith)`;
  if (it.kind === 'armour') return `${rankTag(it, plus)} ${SLOTS.find(([s]) => s === it.slot)[1]} · DEF +${upgraded(it.def || 0, plus)}${it.mdef ? ` · MDEF +${upgraded(it.mdef, plus)}` : ''}`;
  if (it.kind === 'food') return [it.heal && (it.heal > 999 ? 'Fills HP' : `Restores ${it.heal} HP`), it.sp && (it.sp > 999 ? 'Fills SP' : `Restores ${it.sp} SP`), it.boost && `+${it.boost.sp} max SP for ${it.boost.minutes} min`,
    it.buff && `+${it.buff.pct}% ${it.buff.stat === 'speed' ? 'speed' : it.buff.stat.toUpperCase()} for ${it.buff.minutes} min`, it.rest && (it.rest >= 100 ? 'Clears Fatigue' : `-${it.rest} Fatigue`)].filter(Boolean).join(' · ');
  if (it.id === 'torch') return 'Hold it in the dark caves (T), or stand it in the ground; it keeps monsters away';
  if (it.rank != null) return `${rankTag(it)} Mined in the caves`;
  if (it.id === 'tent') return 'Sleep anywhere and clear your Fatigue';
  return 'Material';
}

// The pop-up an item opens when you touch it in a shop, at the Blacksmith or on a display stand:
// its picture, what it is, and everything it does. `e` is a bag entry (or what's on a stand), if any.
export function itemInfoHtml(id, e = null, { extra = '', form = null } = {}) {
  const it = ITEMS[id];
  if (!it) return '';
  wearerForm = form;
  const plus = e?.plus || 0;
  const name = e ? nameOf(e) : formName(it, form);
  const myth = isGear(it) ? mythicSkill(it, plus) : null;
  const skills = (e?.skills || []).map((k) => SKILLS[k]).filter(Boolean);
  const stone = it.kind === 'stone' ? SKILLS[it.skill] : null;
  return `<div class="item-pop-box" role="dialog" aria-label="${esc(name)}">
      <button type="button" class="sw-close" data-pop-close aria-label="Close">×</button>
      <div class="bag-detail"><span class="bag-big">${pic(id, plus, '')}</span><div>
        <h3>${esc(name)}</h3>
        <p>${esc(it.text || '')}</p>
        <p class="bag-stat">${describe(it, plus)}${e?.coat ? `<br>${EFFECTS[e.coat.id].icon} Coated with ${EFFECTS[e.coat.id].name}: ${e.coat.hits} hits left` : ''}</p>
        ${stone ? `<p class="bag-stat">${stone.icon} <b>${esc(stone.name)}</b> · ${esc(stone.text)}</p>` : ''}
        ${myth ? `<p class="gear-myth">🌟 <b>${esc(myth.name)}</b> · ${esc(myth.text)}</p>` : ''}
        ${skills.length ? `<p class="bag-stat"><b>Skills set in it:</b> ${skills.map((k) => `${k.icon} ${esc(k.name)}`).join(', ')}</p>` : ''}
        ${isGear(it) && !myth && gearSkillSlots(it, plus) ? `<p class="bag-hint">Holds up to ${gearSkillSlots(it, plus)} skills from Skill Stones.</p>` : ''}
        <p class="bag-hint">Price in the shop: ${money(it.price)}</p>
        ${extra}
      </div></div>
    </div>`;
}

// The skills set into a piece of gear (from Skill Stones), and the Mythic weapon's own skill
function gearSkillsHtml(game, e, it) {
  const slots = gearSkillSlots(it, e.plus || 0);
  const myth = mythicSkill(it, e.plus || 0);
  const own = myth ? `<p class="gear-myth">🌟 <b>${esc(myth.name)}</b> · ${esc(myth.text)} Use it with ${esc(keyName(codeFor('mythic')))} while it's in your hand.</p>` : '';
  if (!slots) return `${own}<p class="bag-hint">Rare or better gear can hold skills from Skill Stones.</p>`;
  const set = e.skills || [];
  const rows = set.map((id) => `<li>${SKILLS[id].icon} ${esc(SKILLS[id].name)} <button type="button" class="link-button" data-take-stone="${e.uid}|${id}">Take out</button></li>`).join('');
  const stones = set.length >= slots ? [] : game.character.inventory.filter((x) => ITEMS[x.id]?.kind === 'stone' && !set.includes(ITEMS[x.id].skill));
  const add = stones.map((x) => `<button type="button" class="gold-button small" data-set-stone="${e.uid}|${x.id}">${SKILLS[ITEMS[x.id].skill].icon} ${esc(SKILLS[ITEMS[x.id].skill].name)}</button>`).join('');
  return `${own}<div class="gear-skills"><b>Skills (${set.length} of ${slots})</b>${rows ? `<ul>${rows}</ul>` : '<p class="bag-hint">None set yet. Skill Stones drop from monsters now and then.</p>'}
    ${add ? `<p class="bag-hint">Set a stone in:</p><div class="bag-actions">${add}</div>` : ''}<p class="bag-hint">You can use these skills while you wear it (put them on a key in the Skills window).</p></div>`;
}

function slotButton(e, game, selected) {
  const it = ITEMS[e.id] || { name: e.id, icon: '?' };
  const on = game.isEquipped(e);
  const ranked = it.kind === 'weapon' && rankOf(it, e.plus || 0) > 0;
  return `<button type="button" class="bag-slot${on ? ' equipped' : ''}${ranked ? ' ranked' : ''}"${ranked ? ` style="--rank:${RANKS[rankOf(it, e.plus || 0)].color}"` : ''} data-item="${keyOf(e)}" aria-pressed="${selected === keyOf(e)}" title="${esc(nameOf(e))}">
    ${pic(e.id, e.plus)}${e.n > 1 ? `<span class="bag-n">${e.n}</span>` : ''}${e.plus ? `<span class="bag-plus">+${e.plus}</span>` : ''}${on ? '<span class="bag-eq">E</span>' : ''}</button>`;
}

// `selected` is the key (gear id or item id) of the item whose details are shown.
// The 3D character is drawn by the caller into the element marked data-preview.
export function renderBag(el, game, selected) {
  wearerForm = game.character.form;
  const c = game.character;
  // worn gear sits in its slot under your character, not in the bag
  const loose = c.inventory.filter((e) => !game.isEquipped(e));
  const slots = [];
  for (let i = 0; i < game.bagSlots; i++) {
    const e = loose[i];
    slots.push(e ? slotButton(e, game, selected) : '<div class="bag-slot empty"></div>');
  }
  const gear = SLOTS.map(([slot, label]) => {
    const g = game.gearIn(slot);
    return g
      ? `<button type="button" class="gear-slot filled" data-item="${keyOf(g.entry)}" data-slot="${slot}" title="${esc(nameOf(g.entry))}"><span class="gear-pic">${pic(g.entry.id, g.plus)}</span><small>${label}</small>${g.plus ? `<span class="bag-plus">+${g.plus}</span>` : ''}</button>`
      : `<div class="gear-slot" data-slot="${slot}"><span class="bag-icon faint">${slot === 'weapon' ? '👊' : '·'}</span><small>${label}</small></div>`;
  });
  const e = selected && game.entry(selected);
  const sel = e && ITEMS[e.id];
  let details = '<p class="bag-hint">Choose an item to see what it does. Weapons and armour can be put on from here.</p>';
  if (sel) {
    const actions = [];
    if (isGear(sel)) actions.push(`<button type="button" class="gold-button small" data-equip="${keyOf(e)}">${game.isEquipped(e) ? 'Take off' : 'Equip'}</button>`);
    if (e.id === 'torch') actions.push(`<button type="button" class="gold-button small" data-hold-torch>Hold / put out</button>`, `<button type="button" class="gold-button small" data-torch>Place here (T)</button>`);
    if (e.id === 'tent') actions.push(`<button type="button" class="gold-button small" data-tent>Pitch here (P)</button>`);
    if (e.id === 'firewood') actions.push(`<button type="button" class="gold-button small" data-campfire>Light a campfire here</button>`);
    if (sel.kind === 'food') actions.push(`<button type="button" class="gold-button small" data-use="${keyOf(e)}">Use</button>`);
    actions.push(`<button type="button" class="link-button" data-drop="${keyOf(e)}">Drop one</button>`);
    details = `<div class="bag-detail"><span class="bag-big">${pic(e.id, e.plus, '')}</span><div><h3>${esc(nameOf(e))}</h3><p>${esc(sel.text)}</p><p class="bag-stat">${describe(sel, e.plus)}${e.coat ? `<br>${EFFECTS[e.coat.id].icon} Coated with ${EFFECTS[e.coat.id].name}: ${e.coat.hits} hits left` : ''}</p><div class="bag-actions">${actions.join('')}</div>${isGear(sel) && e.uid ? gearSkillsHtml(game, e, sel) : ''}</div></div>`;
  }
  const crafts = game.recipes.map((r) => {
    const it = ITEMS[r.makes];
    const need = r.needs.map(([id, n]) => `${n} ${ITEMS[id].name}${n > 1 ? 's' : ''}`).join(', ');
    return `<div class="shop-row"><span class="bag-icon">${it.icon}</span><div class="shop-name"><b>${esc(it.name)}</b><small>Needs ${need}</small></div>
      <button type="button" class="gold-button small" data-craft="${r.makes}" ${game.canCraft(r) ? '' : 'disabled'}>Craft</button></div>`;
  }).join('');
  const s = game.stats();
  el.innerHTML = `
    <div class="status-window bag-window" role="dialog" aria-label="Bag">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      ${tabsHtml('bag')}
      <h2>Bag</h2>
      <p class="bag-top"><span>Coins: <b>${money(c.coins)}</b></span><span>HP: <b>${Math.round(c.hp)} / ${s.hp}</b></span><span>SP: <b>${Math.round(c.sp)} / ${s.sp}</b></span>
        <span>ATK <b>${s.atk}</b> · DEF <b>${s.def}</b> · MATK <b>${s.matk}</b> · MDEF <b>${s.mdef}</b></span></p>
      <div class="bag-layout">
        <div class="bag-doll">
          <div class="bag-preview" data-preview aria-label="Your character"></div>
          <div class="gear-slots">${gear.join('')}</div>
        </div>
        <div class="bag-side">
          <div class="bag-grid">${slots.join('')}</div>
          ${details}
        </div>
      </div>
      <h3 class="bag-sub">Crafting</h3>
      ${crafts}
    </div>`;
}

// The shop, styled like a Solo Leveling system window. It only shows what your level can buy;
// more appears as you level up.
export function renderShop(el, game, message = '', market = null) {
  wearerForm = game.character.form;
  const c = game.character;
  const mk = market && MARKETS[market];
  // a spawn-point market sells its own speciality stock (and unlocks it a few levels early)
  const list = shopFor(c), dark = !mk && c.side === 'monster';
  const open = mk ? marketStock(market, c.level).map((id) => [id, 0]) : list.filter(([, lvl]) => c.level >= lvl);
  const next = mk ? Infinity : list.filter(([, lvl]) => c.level < lvl).reduce((m, [, lvl]) => Math.min(m, lvl), Infinity);
  const group = (title, kind) => {
    const cards = open.filter(([id]) => ITEMS[id].kind === kind).map(([id]) => {
      const it = ITEMS[id];
      const price = mk ? marketPrice(market, id) : it.price;
      const poor = c.coins < price;
      return `<div class="sys-card sys-item${poor ? ' poor' : ''}" data-info="${id}" title="Touch to see what it does">
        <div class="sys-pic">${pic(id, 0, 'sys-emoji')}</div>
        <div class="sys-side"><b>${esc(formName(it, c.form))}</b><span class="sys-price">${money(price)}</span>
        <button type="button" class="sys-button" data-buy="${id}">${poor ? 'Not enough' : 'Buy'}</button></div></div>`;
    }).join('');
    return cards ? `<h3 class="sys-sub">${title}</h3><div class="sys-grid">${cards}</div>` : '';
  };
  const sellable = c.inventory.filter((e) => !game.isEquipped(e) && !ITEMS[e.id]?.bound);
  const sell = sellable.length ? sellable.map((e) => {
    const it = ITEMS[e.id];
    return `<div class="sys-row" data-info-entry="${keyOf(e)}"><span class="sys-mini">${pic(e.id, e.plus)}</span><span class="sys-name"><b>${esc(nameOf(e))}</b><small>You have ${e.n} · shop price ${money(it.price)}</small></span>
      <span class="sys-price">${money(game.sellPrice(e, market))}</span><span class="sys-sell-btns"><button type="button" class="sys-button ghost" data-sell="${keyOf(e)}">Sell one</button>${e.n > 1 ? `<button type="button" class="sys-button" data-sell-all="${keyOf(e)}">Sell all ${e.n} · ${money(game.sellPrice(e, market) * e.n)}</button>` : ''}</span></div>`;
  }).join('') : '<p class="sys-hint">Nothing to sell yet. Gather wood and berries, or defeat monsters for their drops. Take gear off before selling it.</p>';
  const bad = /\bnot\b|\bneed|bag is full/i.test(message);
  el.innerHTML = `
    <div class="system-window${dark ? ' dark-market' : ''}" role="dialog" aria-label="${mk ? esc(mk.name) : dark ? 'Dark Market' : 'Shop'}">
      <button type="button" class="sys-close" data-close aria-label="Close">×</button>
      ${mk ? '' : tabsHtml('shop')}
      <div class="sys-title"><span class="sys-bang">!</span><h2>${mk ? esc(mk.name) : dark ? 'Dark Market' : 'Shop'}</h2></div>
      ${dark ? '<p class="sys-hint">Gear made for monsters: cut for claws, horns, tails and hides. When you take humanoid form it reshapes to fit you.</p>' : ''}
      ${mk ? `<p class="sys-hint">${esc(mk.text)}${mk.bot ? ' City shops charge more and pay less than player shops.' : ''}</p>` : ''}
      <p class="sys-top">Coins <b>${money(c.coins)}</b> <span>·</span> Level <b>${c.level}</b>${next < Infinity ? ` <span>·</span> New items at level <b>${next}</b>` : ''}</p>
      <p class="sys-msg${bad ? ' bad' : ''}" role="status">${esc(message)}</p>
      <p class="sys-hint">Touch an item to see what it does.</p>
      ${market === 'tavern' ? roomHtml(game) : ''}
      ${market === 'city_potions' ? treatHtml(game) : ''}
      ${group('Weapons', 'weapon')}
      ${group(market === 'city_tailor' ? 'Clothes' : 'Armour', 'armour')}
      ${group(mk?.bot && market !== 'city_potions' ? 'Food and drink (all halal)' : 'Potions and food', 'food')}
      ${group('Coatings for weapons', 'coating')}
      ${group('Furniture', 'furniture')}
      ${group('Tools', 'material')}
      <h3 class="sys-sub">Sell <small>for less than the shop price</small></h3>
      ${sell}
    </div>`;
}

// Broken bones from a bad fall are set and treated here, once a day until they mend
function treatHtml(game) {
  const j = game.injury();
  if (!j) return '';
  return `<h3 class="sys-sub">Treatment</h3>
    <div class="sys-row"><span class="sys-name"><b>${esc(j.name)} · ${j.left} treatment${j.left > 1 ? 's' : ''} left</b><small>${esc(j.effect)} One treatment a day of the realm (one real hour).${j.waitMin ? ` Next treatment in ${j.waitMin} min.` : ''}</small></span>
      ${j.waitMin ? '' : `<button type="button" class="sys-button" data-treat>Treat · ${money(j.price)}</button>`}</div>`;
}

// A tavern room: rent it for a day of the realm (one real hour), sleep in it to wake rested
function roomHtml(game) {
  const room = game.room();
  const price = game.roomPrice();
  return `<h3 class="sys-sub">Rooms</h3>
    <div class="sys-row"><span class="sys-name"><b>${room ? `Your room: Room ${room.n}, upstairs · ${room.minutes} min left` : 'A room for the day'}</b><small>${room ? 'Go up the stairs to your room and lie on the bed (E) to wake with full HP and SP and no Fatigue.' : 'No land or money for a house? Rent a room upstairs for a day of the realm (one real hour). Sleep in its bed to wake fully rested.'}</small></span>
      ${room ? '' : `<button type="button" class="sys-button" data-room="rent">Rent · ${money(price)}</button>`}</div>
    <p class="sys-hint">Drinks are made to order: pay here, find a seat, and the waiter brings yours to you. A fresh drink does a little more than one from your bag.</p>`;
}

// Merging: pick a piece, then a second of the same sub-category; the merge book shows what each
// pair makes. At their own anvil (`workshop`) a Blacksmith can forge the workshop pieces too.
const KIND_SAYS = { same: 'the same piece, stronger', new: 'a new piece', up: 'the stronger piece, +1' };
function mergeBook(game, a) {
  const have = new Set(game.character.inventory.map((e) => e.id));
  const line = (x, y, r) => `<li${have.has(x) && have.has(y) ? ' class="have"' : ''}>${ITEMS[x].icon} ${esc(ITEMS[x].name)} + ${ITEMS[y].icon} ${esc(ITEMS[y].name)} → <b>${esc(ITEMS[r.makes].name)}</b>${r.kind === 'new' ? ' <em class="forged-tag">new</em>' : r.kind === 'same' ? ' +1' : ' +1'}</li>`;
  if (a) {
    const list = mergesWith(a.id).map((r) => line(a.id, r.with, r)).join('');
    return `<details class="merge-book" open><summary>What a ${esc(ITEMS[a.id].name)} merges with <small>(${ladderName(subOf(ITEMS[a.id])).sub})</small></summary><ul>${list}</ul></details>`;
  }
  const byLadder = Object.entries(LADDERS).map(([sub, ids]) => {
    const rows = [];
    for (const [k, r] of MERGES) { const [x, y] = k.split('|'); if (ids.includes(x)) rows.push(line(x, y, r)); }
    const c = ladderName(sub);
    return `<details class="merge-book"><summary>${c.cat} › ${c.sub} <small>(${rows.length})</small></summary><ul>${rows.join('')}</ul></details>`;
  }).join('');
  return `<h3 class="bag-sub">Merge Book <small>(${MERGE_COUNT} merges; gold lines are ones you can make with what you carry)</small></h3>${byLadder}`;
}
export function renderSmith(el, game, pick = [], message = '', { workshop = false } = {}) {
  wearerForm = game.character.form;
  const c = game.character;
  const can = game.canMerge();
  const gear = c.inventory.filter((e) => isGear(ITEMS[e.id]));
  const [a, b] = pick.map((k) => game.entry(k));
  const result = a && b ? game.mergePreview(keyOf(a), keyOf(b)) : null;
  const cost = a ? game.mergeCost(keyOf(a), b ? keyOf(b) : null) : null;
  const row = (e) => {
    const it = ITEMS[e.id];
    const which = a && keyOf(a) === keyOf(e) ? 'first' : b && keyOf(b) === keyOf(e) ? 'second' : '';
    const fits = !a || which || subOf(ITEMS[a.id]) === subOf(it);
    return `<button type="button" class="shop-row smith-row${which ? ` ${which}` : ''}" data-pick="${keyOf(e)}" ${fits ? '' : 'disabled'}>
      <span class="smith-pic" data-info-entry="${keyOf(e)}" title="See what it does">${pic(e.id, e.plus)}</span><span class="shop-name"><b>${esc(nameOf(e))}</b><small>${rankTag(it, e.plus)}${game.isEquipped(e) ? ' · equipped' : ''}</small></span>
      <span class="smith-tag">${which === 'first' ? 'Keep' : which === 'second' ? 'Melt in' : ''}</span></button>`;
  };
  const weapons = gear.filter((e) => ITEMS[e.id].kind === 'weapon'), armour = gear.filter((e) => ITEMS[e.id].kind !== 'weapon');
  let summary = '<p class="bag-hint">To merge, pick a piece, then a second of the same sub-category (a sword with a sword, boots with boots) to melt into it. The Merge Book below shows what every pair makes.</p>';
  if (a && b) {
    summary = result == null
      ? '<p class="shop-msg">These two are different sub-categories. Merge a sword with a sword, a helmet with a helmet, and so on.</p>'
      : `<p class="smith-result">${esc(nameOf(a))} + ${esc(nameOf(b))} makes <b>${esc(evolvedName(ITEMS[result.id], result.plus))}${result.plus ? ` +${result.plus}` : ''}</b> (${KIND_SAYS[result.kind]}).</p>
         <p class="bag-hint">${describe(ITEMS[result.id], result.plus)}</p>
         <p class="bag-hint">Cost: <b>${money(cost.coins)}</b>${cost.needs.map(([id, n]) => ` + <b>${n} ${esc(ITEMS[id].name)}</b> (you have ${game.count(id)})`).join('')}</p>
         <button type="button" class="gold-button small" data-merge ${can && game.canPay(cost) ? '' : 'disabled'}>${game.canPay(cost) ? 'Merge' : 'Not enough to pay'}</button>`;
  }
  // Coatings: brush a potion onto your weapon
  const w = game.gearIn('weapon');
  const coatings = c.inventory.filter((e) => ITEMS[e.id]?.kind === 'coating');
  const coatHtml = (w?.coat ? `<p class="bag-hint">${EFFECTS[w.coat.id].icon} ${esc(nameOf(w.entry))} is coated with ${EFFECTS[w.coat.id].name}: ${w.coat.hits} hits left. A new coating replaces it.</p>` : '')
    + (coatings.length ? coatings.map((e) => { const it = ITEMS[e.id]; return `<div class="shop-row"><span class="bag-icon">${it.icon}</span><span class="shop-name"><b>${esc(it.name)}</b><small>You have ${e.n} · ${esc(EFFECTS[it.coat].text)} on each of the next ${it.hits} hits</small></span>
      <button type="button" class="gold-button small" data-coat="${e.id}" ${can && w ? '' : 'disabled'}>${w ? `Coat ${esc(nameOf(w.entry))}` : 'Equip a weapon'}</button></div>`; }).join('')
    : '<p class="bag-hint">No coatings. Buy a Poison Potion, Fire Oil or Frost Oil in the shop (or ask a Potion Maker) to coat your weapon.</p>');
  // Minting: anyone can have their ore struck into coins here
  const mintHtml = Object.entries(MINT).map(([id, v]) => {
    const n = game.count(id);
    return `<div class="shop-row" data-info="${id}"><span class="smith-pic">${pic(id)}</span>
      <span class="shop-name"><b>${esc(ITEMS[id].name)}</b><small>Each one mints ${money(v)} · you have ${n}</small></span>
      <button type="button" class="gold-button small" data-mint="${id}" ${n ? '' : 'disabled'}>${n ? `Mint ${n} into ${money(n * v)}` : 'None to mint'}</button></div>`;
  }).join('');
  // Forging: only what the smith's level allows. Each rank opens at a class advancement, and a
  // better metal than the rank needs gives a stronger piece (+1 or +2).
  const forgeRow = ([id]) => {
    const it = ITEMS[id];
    const opts = forgeOres(it).map((ore) => forgeCost(it, ore)).filter((fc, i) => i === 0 || game.count(fc.ore) >= fc.needs[0][1]);
    const btns = opts.map((fc) => {
      const pay = c.coins >= fc.coins && fc.needs.every(([n, k]) => game.count(n) >= k);
      return `<button type="button" class="gold-button small" data-forge="${id}" data-ore="${fc.ore}"${workshop ? ' data-workshop' : ''} ${can && pay ? '' : 'disabled'}
        title="${fc.needs.map(([n, k]) => `${k} ${ITEMS[n].name} (you have ${game.count(n)})`).join(', ')}">${fc.bonus ? `+${fc.bonus} with ${esc(ITEMS[fc.ore].name)}` : 'Forge'} · ${money(fc.coins)}</button>`;
    }).join('');
    const base = opts[0];
    const need = base.needs.map(([n, k]) => `<span class="need${game.count(n) >= k ? ' ok' : ''}">${ITEMS[n].icon} ${k} ${esc(ITEMS[n].name)} <small>(you have ${game.count(n)})</small></span>`).join('');
    return `<div class="shop-row forge-row" data-info="${id}">
      <span class="smith-pic">${pic(id)}</span>
      <span class="shop-name"><b>${esc(it.name)}${it.forged ? ' <em class="forged-tag">· forged only</em>' : it.workshop ? ' <em class="forged-tag">· own anvil</em>' : ''}</b>
        <span class="forge-needs">${need}<span class="need${c.coins >= base.coins ? ' ok' : ''}">${money(base.coins)} <small>for the smith's labour</small></span></span></span>
      <span class="forge-btns">${btns}</span></div>`;
  };
  const forgeable = [...FORGE, ...(workshop ? FORGE_WORKSHOP : [])].filter(([, lvl]) => c.level >= lvl).sort((x, y) => x[1] - y[1]);
  const forgeWeapons = forgeable.filter(([id]) => ITEMS[id].kind === 'weapon').map(forgeRow).join('');
  const forgeItems = forgeable.filter(([id]) => ITEMS[id].kind !== 'weapon').map(forgeRow).join('');
  const myRank = FORGE_RANK_LEVEL.filter((l) => c.level >= l).length - 1;
  const nextRank = FORGE_RANK_LEVEL[myRank + 1];
  const nextPiece = [...FORGE, ...(workshop ? FORGE_WORKSHOP : [])].sort((x, y) => x[1] - y[1]).find(([, lvl]) => lvl > c.level);
  const forgeNote = `You forge up to <b>${RANKS[Math.max(0, myRank)].name}</b>.${nextRank < Infinity ? ` ${RANKS[myRank + 1].name} pieces unlock at level ${nextRank}.` : ''}${nextPiece ? ` Next new piece at level ${nextPiece[1]}.` : ''} Mythic weapons can't be forged: only the Kings hold them.`;
  el.innerHTML = `
    <div class="status-window bag-window smith-window" role="dialog" aria-label="Blacksmith">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      ${tabsHtml('smith')}
      <h2>${workshop ? 'Your Anvil' : 'Blacksmith'}</h2>
      <p class="bag-top">${can ? '<span>As a Blacksmith you can merge, coat and forge.</span>' : '<span><b>Only the Blacksmith class can merge, coat and forge.</b> You can still see how it works here.</span>'}<span>Coins: <b>${money(c.coins)}</b></span></p>
      <p class="bag-hint">Merging: two pieces of the same sub-category. Two of the same piece make it +1 and keep both pieces' upgrades. Two different pieces of about the same strength make a new, stronger piece. A weak piece melted into a much stronger one makes the stronger one +1. Each + is 12% stronger, up to +10. Weapons evolve at +3, +6 and +9 and climb a rank.</p>
      ${workshop ? `<p class="bag-hint"><b>Your own anvil:</b> here you can also forge the ${FORGE_WORKSHOP.length} workshop pieces (marked “own anvil”), which no shop sells.</p>` : `<p class="bag-hint">Build an Anvil on your own land to forge ${FORGE_WORKSHOP.length} more pieces there.</p>`}
      <p class="shop-msg" role="status">${esc(message)}</p>
      ${summary}
      <p class="bag-hint">Touch a picture to see what a piece does.</p>
      <h3 class="bag-sub">Current Weapons <small>(${weapons.length})</small></h3>
      <div class="smith-list">${weapons.map(row).join('') || '<p class="bag-hint">No weapons in your bag.</p>'}</div>
      <h3 class="bag-sub">Current Armour <small>(${armour.length})</small></h3>
      <div class="smith-list">${armour.map(row).join('') || '<p class="bag-hint">No armour in your bag.</p>'}</div>
      <h3 class="bag-sub">Current Coats</h3>
      ${coatHtml}
      <h3 class="bag-sub">Mint Coins <small>(anyone can; 100 Copper make 1 Silver, 100 Silver make 1 Gold)</small></h3>
      <p class="bag-hint">Bring ore from the caves and the Blacksmith strikes it into coins. Bigger veins break into more ore, so a huge copper vein makes about 16 Copper and a small one 2.</p>
      <div class="smith-list">${mintHtml}</div>
      <h3 class="bag-sub">Can Build <small>(forge from ore and coins; better and higher-ranked pieces cost more)</small></h3>
      <p class="bag-hint">${forgeNote} A better metal than a piece needs makes it stronger (+1 or +2).</p>
      <h4 class="bag-sub2">Weapons</h4>
      <div class="smith-list">${forgeWeapons || '<p class="bag-hint">No weapons you can forge yet.</p>'}</div>
      <h4 class="bag-sub2">Items <small>(armour and shields)</small></h4>
      <div class="smith-list">${forgeItems || '<p class="bag-hint">No items you can forge yet.</p>'}</div>
      ${mergeBook(game, a)}
    </div>`;
}

// The Potion-Maker window: a Potion Maker brews from herbs and a few coins
export function renderPotions(el, game, message = '') {
  const c = game.character;
  const pm = c.potionMaker;
  const can = game.canBrew();
  const top = can ? `<span>Brew from herbs: each potion needs <b>Healing Herbs</b> and a few coins. You have <b>${game.count('herb')} herbs</b>.</span>`
    : '<span><b>Only the Potion Maker class can brew.</b> You can still see what they brew.</span>';
  const queue = pm?.queue?.length ? pm.queue.map((q) => {
    const left = Math.max(0, Math.ceil((q.ready - Date.now()) / 1000));
    return `<div class="shop-row"><span class="bag-icon">${ITEMS[q.id].icon}</span><span class="shop-name"><b>${esc(ITEMS[q.id].name)}</b><small>${left ? `Ready in ${left}s` : 'Ready: make room in your bag'}</small></span></div>`;
  }).join('') : '<p class="bag-hint">Nothing brewing.</p>';
  const list = BREWS.map((id) => {
    const it = ITEMS[id];
    const price = brewCost(id), herbs = brewHerbs(id);
    const ok = can && c.coins >= price && game.count('herb') >= herbs && (pm?.queue?.length || 0) < POTION_MAKER.queue;
    return `<div class="shop-row"><span class="bag-icon">${it.icon}</span><span class="shop-name"><b>${esc(it.name)}</b><small>${describe(it)} · ${brewSeconds(id)}s to brew${it.brewOnly ? ' · <b>not sold in shops</b>' : ` · shop price ${money(it.price)}`}</small></span>
      <button type="button" class="gold-button small" data-brew="${id}" ${ok ? '' : 'disabled'}>Brew · ${herbs} 🌿 + ${money(price)}</button></div>`;
  }).join('');
  el.innerHTML = `
    <div class="status-window bag-window" role="dialog" aria-label="Potion-Maker">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      ${tabsHtml('potions')}
      <h2>Potion-Maker</h2>
      <p class="bag-top">${top}</p>
      <p class="bag-top"><span>Coins: <b>${money(c.coins)}</b></span></p>
      <p class="shop-msg" role="status">${esc(message)}</p>
      <h3 class="bag-sub">Brewing <small>(up to ${POTION_MAKER.queue} at a time; finished potions go into your bag)</small></h3>
      ${queue}
      <h3 class="bag-sub">Brew a potion</h3>
      ${list}
    </div>`;
}
