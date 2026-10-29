// The Appraisal window: what the one holder of Appraisal sees. The monster in front of them, the
// true worth of everything in their bag and of the land and buildings they stand on, and anyone they
// name: all there is to know, even the side they secretly serve.
import { ITEMS } from './data/items.mjs';
import { RACES, CLASSES, STAT_NAMES, MAIN_STATS } from './data/game-data.mjs';
import { PARENT_JOBS } from './data/birth.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const g = (n) => `${Number(n || 0).toLocaleString()} G`;

// `a` is { monster, land, person, message, busy } (see main.js)
export function renderAppraise(el, game, a = {}) {
  const c = game.character;
  const m = a.monster;
  const monster = m
    ? `<p class="bag-hint"><b>${esc(m.name)}</b>${m.boss ? ' (boss)' : m.chief ? ' (chief)' : ''} · Lv ${m.level} · HP ${m.hp} / ${m.maxHp} · ATK ${m.atk} · DEF ${m.def}</p>`
    : '<p class="bag-hint">No monster in front of you.</p>';
  const worth = (e) => {
    const it = ITEMS[e.id];
    if (!it) return 0;
    return it.kind === 'weapon' || it.kind === 'armour' ? Math.round(it.price * (1 + (e.plus || 0) * 0.25)) : it.price;
  };
  const bag = c.inventory.filter((e) => ITEMS[e.id]).map((e) => `<li>${ITEMS[e.id].icon} ${esc(ITEMS[e.id].name)}${e.plus ? ` +${e.plus}` : ''}${e.n > 1 ? ` ×${e.n}` : ''} <small>${g(worth(e) * e.n)}</small></li>`).join('');
  const land = a.land
    ? `<p class="bag-hint">Plot ${a.land.ix}, ${a.land.iz}${a.land.owner ? ` (owned by ${esc(a.land.owner)})` : ''}: the land is worth <b>${g(a.land.price)}</b>${a.land.pieces ? `, and its ${a.land.pieces} building pieces <b>${g(a.land.built)}</b>` : ''}.</p>`
    : '<p class="bag-hint">You are not standing on anyone\'s land.</p>';
  const p = a.person;
  const person = p ? `<div class="appraise-person">
      <p><b>${esc(p.name)}</b> · ${esc(RACES[p.race]?.name || p.race)} · ${esc(CLASSES[p.cls]?.name || p.cls)} · Lv ${p.level} · ${g(p.coins)} · life ${p.lives}</p>
      <p class="bag-hint">${MAIN_STATS.map((k) => `${STAT_NAMES[k]} ${p.stats?.[k] ?? '?'}`).join(' · ')} · Elements: ${esc((p.elements || []).join(', '))}</p>
      <p class="bag-hint">Unique Skill: <b>${esc(p.unique?.name)}</b> (${esc(p.unique?.rank)}-Rank)</p>
      ${p.child ? `<p class="bag-hint">A child. Parents: ${(p.child.family?.parents || []).map((q) => `${esc(q.name)} (${esc(PARENT_JOBS[q.job]?.name || q.job)})`).join(', ')}.</p>` : ''}
      <p class="bag-hint">Secret side: <b>${p.allegiance?.cult ? `${esc(p.allegiance.rank)} of the cult ${esc(p.allegiance.cult)}` : p.allegiance?.order ? `sworn to the ${esc(p.allegiance.order)}` : 'none'}</b></p></div>` : '';
  el.innerHTML = `
    <div class="status-window skills-window" role="dialog" aria-label="Appraisal">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      <h2>👁️ Appraisal</h2>
      <p class="shop-msg" role="status">${esc(a.message || '')}</p>
      <h3 class="bag-sub">In front of you</h3>${monster}
      <h3 class="bag-sub">Appraise a person</h3>
      <div class="room-form"><label>Username <input type="text" data-appraise-name maxlength="16" autocomplete="off"></label>
        <button type="button" class="gold-button small" data-appraise ${a.busy ? 'disabled' : ''}>Appraise</button></div>
      ${person}
      <h3 class="bag-sub">The land under you</h3>${land}
      <h3 class="bag-sub">The true worth of your bag</h3><ul class="appraise-bag">${bag || '<li>Empty</li>'}</ul>
    </div>`;
}
