// The Bag (inventory with your character and equipment), the Shop and the Blacksmith's merging.
// They share one window with the Status Window, with tabs along the top.
import { ITEMS, SHOP, SLOTS, isGear, slotOf, upgraded } from './data/items.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const keyOf = (e) => e.uid || e.id;
// An item picture: the rendered model fills in later (see icons.js); the emoji shows until then
const pic = (id, plus = 0, cls = 'bag-icon') => `<img class="item-pic" data-icon="${id}" data-plus="${plus}" alt=""><span class="${cls}">${ITEMS[id]?.icon || '?'}</span>`;
const nameOf = (e) => `${ITEMS[e.id]?.name || e.id}${e.plus ? ` +${e.plus}` : ''}`;

export function tabsHtml(active) {
  const tab = (id, label, key) => `<button type="button" class="sw-tab" data-open="${id}" aria-pressed="${active === id}">${label}${key ? ` <kbd>${key}</kbd>` : ''}</button>`;
  return `<div class="sw-tabs">${tab('status', 'Status', 'C')}${tab('bag', 'Bag', 'I')}${tab('shop', 'Shop', 'B')}${tab('quests', 'Quests', 'Q')}${tab('smith', 'Blacksmith')}</div>`;
}

function describe(it, plus = 0) {
  if (it.kind === 'weapon') return `${it.magic ? 'MATK' : 'ATK'} +${upgraded(it.power, plus)} · ${it.speed}s per swing${it.chop >= 4 ? ' · fells even great trees' : it.chop >= 3 ? ' · fells big trees' : it.chop >= 1.5 ? ' · chops young trees fast' : ''}`;
  if (it.kind === 'armour') return `${SLOTS.find(([s]) => s === it.slot)[1]} · DEF +${upgraded(it.def || 0, plus)}${it.mdef ? ` · MDEF +${upgraded(it.mdef, plus)}` : ''}`;
  if (it.kind === 'food') return [it.heal && `Restores ${it.heal} HP`, it.sp && (it.sp > 999 ? 'Fills SP' : `Restores ${it.sp} SP`), it.boost && `+${it.boost.sp} max SP for ${it.boost.minutes} min`].filter(Boolean).join(' · ');
  if (it.id === 'torch') return 'Lights the night and keeps monsters away';
  return 'Material';
}

function slotButton(e, game, selected) {
  const it = ITEMS[e.id] || { name: e.id, icon: '?' };
  const on = game.isEquipped(e);
  return `<button type="button" class="bag-slot${on ? ' equipped' : ''}" data-item="${keyOf(e)}" aria-pressed="${selected === keyOf(e)}" title="${esc(nameOf(e))}">
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
    if (e.id === 'torch') actions.push(`<button type="button" class="gold-button small" data-torch>Place here (T)</button>`);
    if (sel.kind === 'food') actions.push(`<button type="button" class="gold-button small" data-use="${keyOf(e)}">Use</button>`);
    actions.push(`<button type="button" class="link-button" data-drop="${keyOf(e)}">Drop one</button>`);
    details = `<div class="bag-detail"><span class="bag-big">${pic(e.id, e.plus, '')}</span><div><h3>${esc(nameOf(e))}</h3><p>${esc(sel.text)}</p><p class="bag-stat">${describe(sel, e.plus)}</p><div class="bag-actions">${actions.join('')}</div></div></div>`;
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
export function renderShop(el, game, message = '') {
  const c = game.character;
  const open = SHOP.filter(([, lvl]) => c.level >= lvl);
  const next = SHOP.filter(([, lvl]) => c.level < lvl).reduce((m, [, lvl]) => Math.min(m, lvl), Infinity);
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
    <div class="system-window" role="dialog" aria-label="Shop">
      <button type="button" class="sys-close" data-close aria-label="Close">×</button>
      ${tabsHtml('shop')}
      <div class="sys-title"><span class="sys-bang">!</span><h2>Shop</h2></div>
      <p class="sys-top">Coins <b>${c.coins} G</b> <span>·</span> Level <b>${c.level}</b>${next < Infinity ? ` <span>·</span> New items at level <b>${next}</b>` : ''}</p>
      <p class="sys-msg${bad ? ' bad' : ''}" role="status">${esc(message)}</p>
      ${group('Weapons', 'weapon')}
      ${group('Armour', 'armour')}
      ${group('Potions and food', 'food')}
      ${group('Tools', 'material')}
      <h3 class="sys-sub">Sell <small>for less than the shop price</small></h3>
      ${sell}
    </div>`;
}

// Merging: pick the item to strengthen, then one of the same kind to melt into it
export function renderSmith(el, game, pick = [], message = '') {
  const c = game.character;
  const gear = c.inventory.filter((e) => isGear(ITEMS[e.id]));
  const [a, b] = pick.map((k) => game.entry(k));
  const result = a && b ? game.mergePreview(keyOf(a), keyOf(b)) : null;
  const can = game.canMerge();
  const list = gear.length ? gear.map((e) => {
    const it = ITEMS[e.id];
    const which = a && keyOf(a) === keyOf(e) ? 'first' : b && keyOf(b) === keyOf(e) ? 'second' : '';
    const fits = !a || which || (slotOf(ITEMS[a.id]) === slotOf(it));
    return `<button type="button" class="shop-row smith-row${which ? ` ${which}` : ''}" data-pick="${keyOf(e)}" ${fits ? '' : 'disabled'}>
      <span class="bag-icon">${it.icon}</span><span class="shop-name"><b>${esc(nameOf(e))}</b><small>${describe(it, e.plus)}${game.isEquipped(e) ? ' · equipped' : ''}</small></span>
      <span class="smith-tag">${which === 'first' ? 'Strengthen' : which === 'second' ? 'Melt in' : ''}</span></button>`;
  }).join('') : '<p class="bag-hint">You have no weapons or armour to merge yet.</p>';
  let summary = '<p class="bag-hint">Pick the item to strengthen first, then a second item of the same kind to melt into it.</p>';
  if (a && b) {
    summary = result == null
      ? '<p class="shop-msg">These two are different kinds. Merge weapons with weapons, or armour for the same body part.</p>'
      : `<p class="smith-result">${esc(nameOf(a))} becomes <b>${esc(ITEMS[a.id].name)} +${result}</b>. ${esc(nameOf(b))} is used up.</p>
         <button type="button" class="gold-button small" data-merge ${can ? '' : 'disabled'}>Merge</button>`;
  }
  el.innerHTML = `
    <div class="status-window bag-window" role="dialog" aria-label="Blacksmith">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      ${tabsHtml('smith')}
      <h2>Blacksmith</h2>
      <p class="bag-top">${can ? '<span>As a Blacksmith you can merge gear of the same kind to make it stronger.</span>' : '<span><b>Only the Blacksmith class can merge.</b> You can still see how it works here.</span>'}</p>
      <p class="bag-hint">Same category (two weapons, or two helmets): +1. Same type too (a sword and a sword): +1 and the second item's upgrades carry over. Each + is 12% stronger, up to +10.</p>
      <p class="shop-msg" role="status">${esc(message)}</p>
      ${summary}
      <div class="smith-list">${list}</div>
    </div>`;
}
