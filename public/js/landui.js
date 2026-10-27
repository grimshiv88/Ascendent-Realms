// The Land window: shows the plot you picked on the grid (press L), and lets you buy it,
// choose what it is for, and clear and level it.
import { PURPOSES, PURPOSE_FEE, plotPrice, prepareCost, PLOT } from './data/land.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

// `plot` is { ix, iz, owned, why }; `choice` is the purpose picked on the cards
export function renderLand(el, plot, game, { choice = 'house', message = '', busy = false } = {}) {
  const c = game.character;
  const owned = plot.owned;
  const mine = owned?.mine;
  const purposeCards = (current) => `<div class="land-purposes">${Object.entries(PURPOSES).map(([id, p]) => `
      <button type="button" class="land-purpose" data-land-pick="${id}" aria-pressed="${choice === id}" style="--pc:${p.color}">
        <b>${p.name}${current === id ? ' <small>(now)</small>' : ''}</b><span>${esc(p.text)}</span></button>`).join('')}</div>`;
  let body;
  if (!owned && plot.why) {
    body = `<p class="sys-msg bad">${esc(plot.why)}</p><p class="sys-hint">Green squares on the grid can be bought. Grey ones can't; red ones belong to someone else; gold ones are yours.</p>`;
  } else if (!owned) {
    const price = plotPrice(plot.ix, plot.iz);
    body = `<p class="sys-top">For sale: <b>${price} G</b> <span>·</span> You have <b>${c.coins} G</b></p>
      <h3 class="sys-sub">What will this land be for?</h3>${purposeCards(null)}
      <div class="land-actions"><button type="button" class="sys-button" data-land-buy ${busy || c.coins < price ? 'disabled' : ''}>${c.coins < price ? 'Not enough coins' : `Buy as ${PURPOSES[choice].name} for ${price} G`}</button></div>`;
  } else if (!mine) {
    body = `<p class="sys-top">Owned by <b>${esc(owned.owner)}</b> <span>·</span> ${PURPOSES[owned.purpose]?.name || 'Land'}</p>`;
  } else {
    const cost = prepareCost(plot.ix, plot.iz, c.cls);
    body = `<p class="sys-top">Your land <span>·</span> <b>${PURPOSES[owned.purpose]?.name}</b></p>
      <h3 class="sys-sub">Clear and level</h3>
      ${Number.isFinite(owned.flat)
        ? '<p class="sys-hint">✓ Cleared of trees and levelled, ready to build on. Building walls, floors and roofs comes next.</p>'
        : `<p class="sys-hint">Cuts down the trees and makes the ground flat so you can build.${c.cls === 'builder' ? ' Builders pay half.' : ''}</p>
           <div class="land-actions"><button type="button" class="sys-button" data-land-prepare ${busy || c.coins < cost ? 'disabled' : ''}>${c.coins < cost ? `Needs ${cost} G` : `Clear and level for ${cost} G`}</button></div>`}
      <h3 class="sys-sub">Change what it is for <small>${PURPOSE_FEE} G</small></h3>${purposeCards(owned.purpose)}
      <div class="land-actions"><button type="button" class="sys-button ghost" data-land-change ${busy || choice === owned.purpose || c.coins < PURPOSE_FEE ? 'disabled' : ''}>Change to ${PURPOSES[choice].name}</button></div>`;
  }
  el.innerHTML = `
    <div class="system-window land-window" role="dialog" aria-label="Land">
      <button type="button" class="sys-close" data-close aria-label="Close">×</button>
      <div class="sys-title"><span class="sys-bang">!</span><h2>Land</h2></div>
      <p class="sys-top">Plot ${plot.ix}, ${plot.iz} <span>·</span> ${PLOT} × ${PLOT} m</p>
      <p class="sys-msg${/need|not|already|can't|cannot|only|too/i.test(message) ? ' bad' : ''}" role="status">${esc(message)}</p>
      ${body}
    </div>`;
}
