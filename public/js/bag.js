// The Bag (inventory with your character and equipment), the Shop and the Blacksmith's merging.
// They share one window with the Status Window, with tabs along the top.
import { ITEMS, SHOP, SLOTS, isGear, slotOf, upgraded, reachText, RANKS, rankOf, evolvedName, effectText, EFFECTS, BREWS, POTION_MAKER, brewCost, brewSeconds, brewHerbs, categoryOf, forgeCost, forgeOres, FORGE, FORGE_RANK_LEVEL, MARKETS, marketStock } from './data/items.mjs';
import { codeFor, keyName } from './data/controls.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const keyOf = (e) => e.uid || e.id;
// An item picture: the rendered model fills in later (see icons.js); the emoji shows until then
const pic = (id, plus = 0, cls = 'bag-icon') => `<img class="item-pic" data-icon="${id}" data-plus="${plus}" alt=""><span class="${cls}">${ITEMS[id]?.icon || '?'}</span>`;
const nameOf = (e) => `${ITEMS[e.id] ? evolvedName(ITEMS[e.id], e.plus || 0) : e.id}${e.plus ? ` +${e.plus}` : ''}`;
// A weapon's rank as a coloured tag
const rankTag = (it, plus = 0) => { const r = RANKS[rankOf(it, plus)]; return `<span class="rank-tag" style="--rank:${r.color}">${r.name}</span>`; };

// Only a Potion Maker sees the Potion-Maker tab (main.js says which class is playing)
let playingClass = null;
export const setTabsClass = (cls) => { playingClass = cls; };
export function tabsHtml(active) {
  const tab = (id, label, action) => `<button type="button" class="sw-tab" data-open="${id}" aria-pressed="${active === id}">${label}${action ? ` <kbd>${esc(keyName(codeFor(action)))}</kbd>` : ''}</button>`;
  return `<div class="sw-tabs">${tab('status', 'Status', 'status')}${tab('bag', 'Bag', 'bag')}${tab('shop', 'Shop', 'shop')}${tab('quests', 'Quests', 'quests')}${tab('smith', 'Blacksmith')}${playingClass === 'potion_maker' ? tab('potions', 'Potion-Maker') : ''}</div>`;
}
// "Weapon › Sword", "Armour › Helmet": what an item can be merged with
const catTag = (it) => { const k = categoryOf(it); return `<span class="cat-tag">${k.cat}${k.sub ? ` › ${k.sub}` : ''}</span>`; };

function describe(it, plus = 0) {
  if (isGear(it)) return `${catTag(it)} ${describeGear(it, plus)}`;
  return describeGear(it, plus);
}
function describeGear(it, plus = 0) {
  if (it.kind === 'weapon') {
    const fx = effectText(it, plus);
    const next = [3, 6, 9].find((n) => n > plus);
    return `${rankTag(it, plus)} ${it.magic ? 'MATK' : 'ATK'} +${upgraded(it.power, plus)} · ${it.speed}s per swing · ${reachText(it)}${it.chop >= 4 ? ' · fells even great trees' : it.chop >= 3 ? ' · fells big trees' : it.chop >= 1.5 ? ' · chops young trees fast' : ''}${fx ? `<br>${fx}` : ''}${next ? `<br><span class="faint">Evolves at +${next}</span>` : ''}`;
  }
  if (it.kind === 'coating') return `${EFFECTS[it.coat].icon} Coats a weapon for ${it.hits} hits (Blacksmith)`;
  if (it.kind === 'armour') return `${rankTag(it, plus)} ${SLOTS.find(([s]) => s === it.slot)[1]} · DEF +${upgraded(it.def || 0, plus)}${it.mdef ? ` · MDEF +${upgraded(it.mdef, plus)}` : ''}`;
  if (it.kind === 'food') return [it.heal && (it.heal > 999 ? 'Fills HP' : `Restores ${it.heal} HP`), it.sp && (it.sp > 999 ? 'Fills SP' : `Restores ${it.sp} SP`), it.boost && `+${it.boost.sp} max SP for ${it.boost.minutes} min`,
    it.buff && `+${it.buff.pct}% ${it.buff.stat === 'speed' ? 'speed' : it.buff.stat.toUpperCase()} for ${it.buff.minutes} min`, it.rest && (it.rest >= 100 ? 'Clears Fatigue' : `-${it.rest} Fatigue`)].filter(Boolean).join(' · ');
  if (it.id === 'torch') return 'Hold it in the dark caves (T), or stand it in the ground; it keeps monsters away';
  if (it.rank != null) return `${rankTag(it)} Mined in the caves`;
  if (it.id === 'tent') return 'Sleep anywhere and clear your Fatigue';
  return 'Material';
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
    if (sel.kind === 'food') actions.push(`<button type="button" class="gold-button small" data-use="${keyOf(e)}">Use</button>`);
    actions.push(`<button type="button" class="link-button" data-drop="${keyOf(e)}">Drop one</button>`);
    details = `<div class="bag-detail"><span class="bag-big">${pic(e.id, e.plus, '')}</span><div><h3>${esc(nameOf(e))}</h3><p>${esc(sel.text)}</p><p class="bag-stat">${describe(sel, e.plus)}${e.coat ? `<br>${EFFECTS[e.coat.id].icon} Coated with ${EFFECTS[e.coat.id].name}: ${e.coat.hits} hits left` : ''}</p><div class="bag-actions">${actions.join('')}</div></div></div>`;
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
      <p class="bag-top"><span>Coins: <b>${c.coins}</b></span><span>HP: <b>${Math.round(c.hp)} / ${s.hp}</b></span><span>SP: <b>${Math.round(c.sp)} / ${s.sp}</b></span>
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
  const c = game.character;
  const mk = market && MARKETS[market];
  // a spawn-point market sells its own speciality stock (and unlocks it a few levels early)
  const open = mk ? marketStock(market, c.level).map((id) => [id, 0]) : SHOP.filter(([, lvl]) => c.level >= lvl);
  const next = mk ? Infinity : SHOP.filter(([, lvl]) => c.level < lvl).reduce((m, [, lvl]) => Math.min(m, lvl), Infinity);
  const group = (title, kind) => {
    const cards = open.filter(([id]) => ITEMS[id].kind === kind).map(([id]) => {
      const it = ITEMS[id];
      const poor = c.coins < it.price;
      return `<div class="sys-card${poor ? ' poor' : ''}">
        <div class="sys-pic">${pic(id, 0, 'sys-emoji')}</div>
        <b>${esc(it.name)}</b><small>${describe(it)}</small>
        <div class="sys-buy"><span class="sys-price">${it.price} G</span>
        <button type="button" class="sys-button" data-buy="${id}" ${poor ? 'disabled' : ''}>${poor ? 'Not enough' : 'Buy'}</button></div></div>`;
    }).join('');
    return cards ? `<h3 class="sys-sub">${title}</h3><div class="sys-grid">${cards}</div>` : '';
  };
  const sellable = c.inventory.filter((e) => !game.isEquipped(e));
  const sell = sellable.length ? sellable.map((e) => {
    const it = ITEMS[e.id];
    return `<div class="sys-row"><span class="sys-mini">${pic(e.id, e.plus)}</span><span class="sys-name"><b>${esc(nameOf(e))}</b><small>You have ${e.n} · shop price ${it.price} G</small></span>
      <span class="sys-price">${game.sellPrice(e)} G</span><span class="sys-sell-btns"><button type="button" class="sys-button ghost" data-sell="${keyOf(e)}">Sell one</button>${e.n > 1 ? `<button type="button" class="sys-button" data-sell-all="${keyOf(e)}">Sell all ${e.n} · ${game.sellPrice(e) * e.n} G</button>` : ''}</span></div>`;
  }).join('') : '<p class="sys-hint">Nothing to sell yet. Gather wood and berries, or defeat monsters for their drops. Take gear off before selling it.</p>';
  const bad = /not|need|full/i.test(message);
  el.innerHTML = `
    <div class="system-window" role="dialog" aria-label="${mk ? esc(mk.name) : 'Shop'}">
      <button type="button" class="sys-close" data-close aria-label="Close">×</button>
      ${mk ? '' : tabsHtml('shop')}
      <div class="sys-title"><span class="sys-bang">!</span><h2>${mk ? esc(mk.name) : 'Shop'}</h2></div>
      ${mk ? `<p class="sys-hint">${esc(mk.text)}</p>` : ''}
      <p class="sys-top">Coins <b>${c.coins} G</b> <span>·</span> Level <b>${c.level}</b>${next < Infinity ? ` <span>·</span> New items at level <b>${next}</b>` : ''}</p>
      <p class="sys-msg${bad ? ' bad' : ''}" role="status">${esc(message)}</p>
      ${group('Weapons', 'weapon')}
      ${group('Armour', 'armour')}
      ${group('Potions and food', 'food')}
      ${group('Coatings for weapons', 'coating')}
      ${group('Tools', 'material')}
      <h3 class="sys-sub">Sell <small>for less than the shop price</small></h3>
      ${sell}
    </div>`;
}

// Merging: pick the item to strengthen, then one of the same kind to melt into it
export function renderSmith(el, game, pick = [], message = '') {
  const c = game.character;
  const can = game.canMerge();
  const gear = c.inventory.filter((e) => isGear(ITEMS[e.id]));
  const [a, b] = pick.map((k) => game.entry(k));
  const result = a && b ? game.mergePreview(keyOf(a), keyOf(b)) : null;
  const cost = a ? game.mergeCost(keyOf(a)) : null;
  const row = (e) => {
    const it = ITEMS[e.id];
    const which = a && keyOf(a) === keyOf(e) ? 'first' : b && keyOf(b) === keyOf(e) ? 'second' : '';
    const fits = !a || which || (slotOf(ITEMS[a.id]) === slotOf(it));
    return `<button type="button" class="shop-row smith-row${which ? ` ${which}` : ''}" data-pick="${keyOf(e)}" ${fits ? '' : 'disabled'}>
      <span class="bag-icon">${it.icon}</span><span class="shop-name"><b>${esc(nameOf(e))}</b><small>${describe(it, e.plus)}${game.isEquipped(e) ? ' · equipped' : ''}</small></span>
      <span class="smith-tag">${which === 'first' ? 'Strengthen' : which === 'second' ? 'Melt in' : ''}</span></button>`;
  };
  const weapons = gear.filter((e) => ITEMS[e.id].kind === 'weapon'), armour = gear.filter((e) => ITEMS[e.id].kind !== 'weapon');
  let summary = '<p class="bag-hint">To merge, pick the item to strengthen first, then a second of the same category (shown in gold on each item) to melt into it.</p>';
  if (a && b) {
    summary = result == null
      ? '<p class="shop-msg">These two are different categories. Merge weapons with weapons, or armour for the same part of the body.</p>'
      : `<p class="smith-result">${esc(nameOf(a))} becomes <b>${esc(evolvedName(ITEMS[a.id], result))} +${result}</b>. ${esc(nameOf(b))} is used up.</p>
         <p class="bag-hint">Cost: <b>${cost.coins} G</b>${cost.needs.map(([id, n]) => ` + <b>${n} ${esc(ITEMS[id].name)}</b> (you have ${game.count(id)})`).join('')}</p>
         <button type="button" class="gold-button small" data-merge ${can && game.canPay(cost) ? '' : 'disabled'}>${game.canPay(cost) ? 'Merge' : 'Not enough to pay'}</button>`;
  }
  // Coatings: brush a potion onto your weapon
  const w = game.gearIn('weapon');
  const coatings = c.inventory.filter((e) => ITEMS[e.id]?.kind === 'coating');
  const coatHtml = (w?.coat ? `<p class="bag-hint">${EFFECTS[w.coat.id].icon} ${esc(nameOf(w.entry))} is coated with ${EFFECTS[w.coat.id].name}: ${w.coat.hits} hits left. A new coating replaces it.</p>` : '')
    + (coatings.length ? coatings.map((e) => { const it = ITEMS[e.id]; return `<div class="shop-row"><span class="bag-icon">${it.icon}</span><span class="shop-name"><b>${esc(it.name)}</b><small>You have ${e.n} · ${esc(EFFECTS[it.coat].text)} on each of the next ${it.hits} hits</small></span>
      <button type="button" class="gold-button small" data-coat="${e.id}" ${can && w ? '' : 'disabled'}>${w ? `Coat ${esc(nameOf(w.entry))}` : 'Equip a weapon'}</button></div>`; }).join('')
    : '<p class="bag-hint">No coatings. Buy a Poison Potion, Fire Oil or Frost Oil in the shop (or ask a Potion Maker) to coat your weapon.</p>');
  // Forging: only what the smith's level allows. Each rank opens at a class advancement, and a
  // better metal than the rank needs gives a stronger piece (+1 or +2).
  const forgeRow = ([id]) => {
    const it = ITEMS[id];
    const opts = forgeOres(it).map((ore) => forgeCost(it, ore)).filter((fc, i) => i === 0 || game.count(fc.ore) >= fc.needs[0][1]);
    const btns = opts.map((fc) => {
      const pay = c.coins >= fc.coins && fc.needs.every(([n, k]) => game.count(n) >= k);
      return `<button type="button" class="gold-button small" data-forge="${id}" data-ore="${fc.ore}" ${can && pay ? '' : 'disabled'}
        title="${fc.needs.map(([n, k]) => `${k} ${ITEMS[n].name} (you have ${game.count(n)})`).join(', ')}">${fc.bonus ? `+${fc.bonus} with ${esc(ITEMS[fc.ore].name)}` : 'Forge'} · ${fc.coins} G</button>`;
    }).join('');
    const base = opts[0];
    return `<div class="shop-row"><span class="bag-icon">${it.icon}</span><span class="shop-name"><b>${esc(it.name)}${it.forged ? ' <em class="forged-tag">· forged only</em>' : ''}</b><small>${describe(it)}<br>Needs ${base.needs.map(([n, k]) => `${k} ${esc(ITEMS[n].name)} (you have ${game.count(n)})`).join(' + ')}</small></span>
      <span class="forge-btns">${btns}</span></div>`;
  };
  const forgeable = FORGE.filter(([, lvl]) => c.level >= lvl);
  const forgeWeapons = forgeable.filter(([id]) => ITEMS[id].kind === 'weapon').map(forgeRow).join('');
  const forgeItems = forgeable.filter(([id]) => ITEMS[id].kind !== 'weapon').map(forgeRow).join('');
  const myRank = FORGE_RANK_LEVEL.filter((l) => c.level >= l).length - 1;
  const nextRank = FORGE_RANK_LEVEL[myRank + 1];
  const nextPiece = FORGE.find(([, lvl]) => lvl > c.level);
  const forgeNote = `You forge up to <b>${RANKS[Math.max(0, myRank)].name}</b>.${nextRank < Infinity ? ` ${RANKS[myRank + 1].name} pieces unlock at level ${nextRank}.` : ''}${nextPiece ? ` Next new piece at level ${nextPiece[1]}.` : ''} Mythic weapons can't be forged: only the Kings hold them.`;
  el.innerHTML = `
    <div class="status-window bag-window smith-window" role="dialog" aria-label="Blacksmith">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      ${tabsHtml('smith')}
      <h2>Blacksmith</h2>
      <p class="bag-top">${can ? '<span>As a Blacksmith you can merge, coat and forge.</span>' : '<span><b>Only the Blacksmith class can merge, coat and forge.</b> You can still see how it works here.</span>'}<span>Coins: <b>${c.coins} G</b></span></p>
      <p class="bag-hint">Merging: the same category (two weapons, or two helmets) gives +1; the same type too (a sword and a sword) also carries the second item's upgrades over. Each + is 12% stronger, up to +10. Weapons evolve at +3, +6 and +9 and climb a rank.</p>
      <p class="shop-msg" role="status">${esc(message)}</p>
      ${summary}
      <h3 class="bag-sub">Current Weapons <small>(${weapons.length})</small></h3>
      <div class="smith-list">${weapons.map(row).join('') || '<p class="bag-hint">No weapons in your bag.</p>'}</div>
      <h3 class="bag-sub">Current Armour <small>(${armour.length})</small></h3>
      <div class="smith-list">${armour.map(row).join('') || '<p class="bag-hint">No armour in your bag.</p>'}</div>
      <h3 class="bag-sub">Current Coats</h3>
      ${coatHtml}
      <h3 class="bag-sub">Can Build <small>(forge from ore and coins; better and higher-ranked pieces cost more)</small></h3>
      <p class="bag-hint">${forgeNote} A better metal than a piece needs makes it stronger (+1 or +2).</p>
      <h4 class="bag-sub2">Weapons</h4>
      <div class="smith-list">${forgeWeapons || '<p class="bag-hint">No weapons you can forge yet.</p>'}</div>
      <h4 class="bag-sub2">Items <small>(armour and shields)</small></h4>
      <div class="smith-list">${forgeItems || '<p class="bag-hint">No items you can forge yet.</p>'}</div>
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
    return `<div class="shop-row"><span class="bag-icon">${it.icon}</span><span class="shop-name"><b>${esc(it.name)}</b><small>${describe(it)} · ${brewSeconds(id)}s to brew${it.brewOnly ? ' · <b>not sold in shops</b>' : ` · shop price ${it.price} G`}</small></span>
      <button type="button" class="gold-button small" data-brew="${id}" ${ok ? '' : 'disabled'}>Brew · ${herbs} 🌿 + ${price} G</button></div>`;
  }).join('');
  el.innerHTML = `
    <div class="status-window bag-window" role="dialog" aria-label="Potion-Maker">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      ${tabsHtml('potions')}
      <h2>Potion-Maker</h2>
      <p class="bag-top">${top}</p>
      <p class="bag-top"><span>Coins: <b>${c.coins} G</b></span></p>
      <p class="shop-msg" role="status">${esc(message)}</p>
      <h3 class="bag-sub">Brewing <small>(up to ${POTION_MAKER.queue} at a time; finished potions go into your bag)</small></h3>
      ${queue}
      <h3 class="bag-sub">Brew a potion</h3>
      ${list}
    </div>`;
}
