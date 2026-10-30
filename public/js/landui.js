// The Land window: shows the plot you picked on the grid (press L), and lets you buy it,
// choose what it is for, and clear and level it.
import { PURPOSES, PURPOSE_FEE, prepareCost, clearCost, PLOT, REACH } from './data/land.mjs';
import { THEMES, SIZES, cavePrice, caveOres, strongCave } from './data/depths.mjs';
import { ITEMS } from './data/items.mjs';
import { money } from './data/money.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

// `plot` is { ix, iz, owned, why, river } (the one last tapped); `choice` is the purpose picked on the
// cards; `basket` the plots chosen to buy together [{ix, iz, price}]
export function renderLand(el, plot, game, { choice = 'house', message = '', busy = false, basket = [] } = {}) {
  const c = game.character;
  const owned = plot.owned;
  const mine = owned?.mine;
  const purposeCards = (current) => `<div class="land-purposes">${Object.entries(PURPOSES).map(([id, p]) => `
      <button type="button" class="land-purpose" data-land-pick="${id}" aria-pressed="${choice === id}" style="--pc:${p.color}">
        <b>${p.name}${current === id ? ' <small>(now)</small>' : ''}</b><span>${esc(p.text)}</span></button>`).join('')}</div>`;
  let body;
  const total = basket.reduce((a, p) => a + p.price, 0);
  if (!owned && basket.length) {
    const n = basket.length;
    body = `<p class="sys-top">Chosen: <b>${n} plot${n === 1 ? '' : 's'}</b> <span>·</span> Total <b>${money(total)}</b> <span>·</span> You have <b>${money(c.coins)}</b></p>
      <div class="land-basket">${basket.map((p) => `<button type="button" class="land-chip" data-land-unpick="${p.ix},${p.iz}" title="Take it out">${p.ix}, ${p.iz} <small>${money(p.price)}</small> ×</button>`).join('')}</div>
      <p class="sys-hint">Tap more squares on the grid, or on the Map (M), to add them; tap one again to take it out. Blue river squares can be bought beside your land, or beside land you choose with them. You can buy up to ${REACH} m from where you stand.</p>
      <h3 class="sys-sub">What will this land be for?</h3>${purposeCards(null)}
      <div class="land-actions"><button type="button" class="sys-button" data-land-buy ${busy ? 'disabled' : ''}>${c.coins < total ? 'Not enough coins' : `Buy ${n === 1 ? 'it' : `all ${n}`} as ${PURPOSES[choice].name} for ${money(total)}`}</button>
        <button type="button" class="sys-button ghost" data-land-clear ${busy ? 'disabled' : ''}>Clear</button></div>`;
  } else if (!owned && plot.why) {
    body = `<p class="sys-msg bad">${esc(plot.why)}</p><p class="sys-hint">Green squares on the grid can be bought. Grey ones can't; red ones belong to someone else; gold ones are yours.</p>`;
  } else if (!owned) {
    body = `<p class="sys-hint">Tap squares on the grid, or on the Map (M), to choose land to buy. You can buy up to ${REACH} m from where you stand.</p>`;
  } else if (!mine) {
    body = `<p class="sys-top">Owned by <b>${esc(owned.owner)}</b> <span>·</span> ${PURPOSES[owned.purpose]?.name || 'Land'}</p>`;
  } else {
    const cost = prepareCost(plot.ix, plot.iz, c.cls), clear = clearCost(c.cls);
    const level = Number.isFinite(owned.flat), cleared = level || owned.cleared;
    const btn = (how, price, label) => `<button type="button" class="sys-button${how === 'clear' ? ' ghost' : ''}" data-land-prepare="${how}" ${busy ? 'disabled' : ''}>${c.coins < price ? `Needs ${money(price)}` : `${label} for ${money(price)}`}</button>`;
    body = `<p class="sys-top">Your land <span>·</span> <b>${PURPOSES[owned.purpose]?.name}</b></p>
      <h3 class="sys-sub">Clear and flatten</h3>
      ${level ? '<p class="sys-hint">✓ Cleared and flattened, ready to build on. Its edges slope gently down (or up) to the land around it.</p>'
        : `<p class="sys-hint">${cleared ? '✓ Cleared of trees, rocks and grass. The ground keeps its shape.' : '<b>Clear</b> takes away the trees, rocks and grass; the ground keeps its shape.'}
           <b>Flatten</b> also makes the whole plot one level, with a gentle slope at its edges (beside land you've already flattened, it takes the same level). You need flat land to build.${c.cls === 'builder' ? ' Builders pay half.' : ''}</p>
           <div class="land-actions">${cleared ? '' : btn('clear', clear, 'Clear')}${btn('flatten', cost, 'Flatten')}</div>`}
      <h3 class="sys-sub">Change what it is for <small>${money(PURPOSE_FEE)}</small></h3>${purposeCards(owned.purpose)}
      <div class="land-actions"><button type="button" class="sys-button ghost" data-land-change ${busy || choice === owned.purpose ? 'disabled' : ''}>Change to ${PURPOSES[choice].name}</button></div>`;
  }
  if (mine && basket.length) body += `<p class="sys-hint">${basket.length} plot${basket.length === 1 ? '' : 's'} chosen to buy (${money(total)}). <button type="button" class="sys-button ghost" data-land-open-basket>Show them</button></p>`;
  el.innerHTML = `
    <div class="system-window land-window" role="dialog" aria-label="Land">
      <button type="button" class="sys-close" data-close aria-label="Close">×</button>
      <div class="sys-title"><span class="sys-bang">!</span><h2>Land</h2></div>
      <p class="sys-top">Plot ${plot.ix}, ${plot.iz} <span>·</span> ${PLOT} × ${PLOT} m</p>
      <p class="sys-msg${/need|not|already|can't|cannot|only|too/i.test(message) ? ' bad' : ''}" role="status">${esc(message)}</p>
      ${body}
    </div>`;
}

// The Cave window: the cave you're standing in, what's down there, and buying it once its boss is beaten
export function renderCave(el, cave, game, { owner = null, mine = false, message = '', busy = false } = {}) {
  const c = game.character;
  const t = THEMES[cave.theme];
  const price = cavePrice(cave);
  const beaten = game.caveCleared(cave.id);
  let action;
  if (mine) action = '<p class="sys-top">✓ <b>This cave is yours.</b> It shows in gold on your map.</p>';
  else if (owner) action = `<p class="sys-top">Owned by <b>${esc(owner)}</b></p>`;
  else if (!beaten) action = '<p class="sys-hint">Beat the boss in its deepest chamber, and this cave can be yours.</p>';
  else action = `<p class="sys-top">You beat its boss. For sale: <b>${money(price)}</b> <span>·</span> You have <b>${money(c.coins)}</b></p>
    <div class="land-actions"><button type="button" class="sys-button" data-cave-buy="${cave.id}" ${busy ? 'disabled' : ''}>${c.coins < price ? 'Not enough coins' : `Buy this cave for ${money(price)}`}</button></div>`;
  el.innerHTML = `
    <div class="system-window" role="dialog" aria-label="Cave">
      <button type="button" class="sys-close" data-close aria-label="Close">×</button>
      <div class="sys-title"><span class="sys-bang">!</span><h2>${esc(cave.name)}</h2></div>
      <p class="sys-top">${SIZES[cave.size].name} ${cave.dungeon ? 'dungeon' : 'cave'} <span>·</span> ${SIZES[cave.size].chambers} chambers deep <span>·</span> Boss: <b>${game.bossHome(cave.id) ? 'waiting below' : 'beaten (back within a day)'}</b></p>
      <p class="sys-hint">Walk into the dark shaft at the back to go down. It's pitch black below: light a torch in your hand with T. Swing at ore veins to mine them, break nests before they fill the cave with monsters, and the boss's chest holds treasure chosen for your class.</p>
      <h3 class="sys-sub">Found down here</h3>
      <p class="sys-hint">${caveOres(cave, 1).map(([id]) => `${ITEMS[id].icon} ${esc(ITEMS[id].name)}`).join(' · ')}${strongCave(cave) ? ` · ${ITEMS.orichalcum.icon} ${esc(ITEMS.orichalcum.name)}` : ''}</p>
      <p class="sys-hint">${strongCave(cave) ? `A strong dungeon (level ${cave.level} wilds): its boss is at least level ${cave.level}, and rare ores and gems lie in its deepest chambers.` : 'No rare ores or gems here: those lie only in the deepest chambers of high-level Dungeons (in wilds of level 60 and up), guarded by strong bosses.'}</p>
      <p class="sys-msg${/need|first|owns/i.test(message) ? ' bad' : ''}" role="status">${esc(message)}</p>
      ${action}
    </div>`;
}
