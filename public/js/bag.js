// The Bag (inventory with your character and equipment), the Shop and the Blacksmith's merging.
// They share one window with the Status Window, with tabs along the top.
import { ITEMS, SHOP, SLOTS, isGear, slotOf, upgraded } from './data/items.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const keyOf = (e) => e.uid || e.id;
const nameOf = (e) => `${ITEMS[e.id]?.name || e.id}${e.plus ? ` +${e.plus}` : ''}`;

export function tabsHtml(active) {
  const tab = (id, label, key) => `<button type="button" class="sw-tab" data-open="${id}" aria-pressed="${active === id}">${label}${key ? ` <kbd>${key}</kbd>` : ''}</button>`;
  return `<div class="sw-tabs">${tab('status', 'Status', 'C')}${tab('bag', 'Bag', 'I')}${tab('shop', 'Shop', 'B')}${tab('smith', 'Blacksmith')}</div>`;
}

function describe(it, plus = 0) {
  if (it.kind === 'weapon') return `${it.magic ? 'MATK' : 'ATK'} +${upgraded(it.power, plus)} · ${it.speed}s per swing${it.chop >= 2 ? ' · chops trees fast' : ''}`;
  if (it.kind === 'armour') return `${SLOTS.find(([s]) => s === it.slot)[1]} · DEF +${upgraded(it.def || 0, plus)}${it.mdef ? ` · MDEF +${upgraded(it.mdef, plus)}` : ''}`;
  if (it.kind === 'food') return [it.heal && `Restores ${it.heal} HP`, it.sp && (it.sp > 999 ? 'Fills SP' : `Restores ${it.sp} SP`), it.boost && `+${it.boost.sp} max SP for ${it.boost.minutes} min`].filter(Boolean).join(' · ');
  return 'Material';
}

function slotButton(e, game, selected) {
  const it = ITEMS[e.id] || { name: e.id, icon: '?' };
  const on = game.isEquipped(e);
  return `<button type="button" class="bag-slot${on ? ' equipped' : ''}" data-item="${keyOf(e)}" aria-pressed="${selected === keyOf(e)}" title="${esc(nameOf(e))}">
    <span class="bag-icon">${it.icon}</span>${e.n > 1 ? `<span class="bag-n">${e.n}</span>` : ''}${e.plus ? `<span class="bag-plus">+${e.plus}</span>` : ''}${on ? '<span class="bag-eq">E</span>' : ''}</button>`;
}

// `selected` is the key (gear id or item id) of the item whose details are shown.
// The 3D character is drawn by the caller into the element marked data-preview.
export function renderBag(el, game, selected) {
  const c = game.character;
  const slots = [];
  for (let i = 0; i < game.bagSlots; i++) {
    const e = c.inventory[i];
    slots.push(e ? slotButton(e, game, selected) : '<div class="bag-slot empty"></div>');
  }
  const gear = SLOTS.map(([slot, label]) => {
    const g = game.gearIn(slot);
    return g
      ? `<button type="button" class="gear-slot filled" data-item="${keyOf(g.entry)}" data-slot="${slot}" title="${esc(nameOf(g.entry))}"><span class="bag-icon">${g.icon}</span><small>${label}</small>${g.plus ? `<span class="bag-plus">+${g.plus}</span>` : ''}</button>`
      : `<div class="gear-slot" data-slot="${slot}"><span class="bag-icon faint">${slot === 'weapon' ? '👊' : '·'}</span><small>${label}</small></div>`;
  });
  const e = selected && game.entry(selected);
  const sel = e && ITEMS[e.id];
  let details = '<p class="bag-hint">Choose an item to see what it does. Weapons and armour can be put on from here.</p>';
  if (sel) {
    const actions = [];
    if (isGear(sel)) actions.push(`<button type="button" class="gold-button small" data-equip="${keyOf(e)}">${game.isEquipped(e) ? 'Take off' : 'Equip'}</button>`);
    if (sel.kind === 'food') actions.push(`<button type="button" class="gold-button small" data-use="${keyOf(e)}">Use</button>`);
    actions.push(`<button type="button" class="link-button" data-drop="${keyOf(e)}">Drop one</button>`);
    details = `<div class="bag-detail"><span class="bag-big">${sel.icon}</span><div><h3>${esc(nameOf(e))}</h3><p>${esc(sel.text)}</p><p class="bag-stat">${describe(sel, e.plus)}</p><div class="bag-actions">${actions.join('')}</div></div></div>`;
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

export function renderShop(el, game, message = '') {
  const c = game.character;
  const group = (title, kinds) => SHOP.filter(([id]) => kinds.includes(ITEMS[id].kind)).map(([id, lvl]) => {
    const it = ITEMS[id];
    const locked = c.level < lvl;
    const poor = c.coins < it.price;
    return `<div class="shop-row${locked ? ' locked' : ''}"><span class="bag-icon">${locked ? '🔒' : it.icon}</span>
      <div class="shop-name"><b>${esc(it.name)}</b><small>${locked ? `Unlocks at level ${lvl}` : describe(it)}</small></div>
      <span class="shop-price">${it.price} 🪙</span>
      <button type="button" class="gold-button small" data-buy="${id}" ${locked || poor ? 'disabled' : ''}>Buy</button></div>`;
  }).join('');
  const sellable = c.inventory.filter((e) => !game.isEquipped(e));
  const sell = sellable.length ? sellable.map((e) => {
    const it = ITEMS[e.id];
    return `<div class="shop-row"><span class="bag-icon">${it.icon}</span><div class="shop-name"><b>${esc(nameOf(e))}</b><small>You have ${e.n} · the shop sells it for ${it.price}</small></div>
      <span class="shop-price">${game.sellPrice(e)} 🪙</span><button type="button" class="link-button" data-sell="${keyOf(e)}">Sell one</button></div>`;
  }).join('') : '<p class="bag-hint">Nothing to sell yet. Gather wood and berries, or defeat monsters for their drops. Take gear off before selling it.</p>';
  el.innerHTML = `
    <div class="status-window bag-window" role="dialog" aria-label="Shop">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      ${tabsHtml('shop')}
      <h2>Shop</h2>
      <p class="bag-top"><span>Coins: <b>${c.coins}</b></span><span>Level: <b>${c.level}</b></span><span>New items unlock as you level up.</span></p>
      <p class="shop-msg" role="status">${esc(message)}</p>
      <h3 class="bag-sub">Potions and food</h3>${group('food', ['food'])}
      <h3 class="bag-sub">Weapons</h3>${group('weapons', ['weapon'])}
      <h3 class="bag-sub">Armour</h3>${group('armour', ['armour'])}
      <h3 class="bag-sub">Sell (for less than the shop price)</h3>
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
