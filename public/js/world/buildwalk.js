// Building from your character: the same pieces and ready buildings as the Builder View, but you
// walk about your land in the normal view and a see-through piece shows where it will go, just in
// front of you (where the camera looks). Green means it can go there, red means it can't. Pieces you
// place join a plan (shown in blue) and Build pays for the whole plan at once, as in the Builder View.
import * as THREE from 'three';
import { heightAt, PLOT } from '../data/world-layout.mjs';
import {
  CELL, MAX_LEVEL, PIECES, BUILDINGS, isRuler, homePlot, pieceKey, placeBuilding, buildingSize,
  piecesCost, buildingCost, hireMinutes, applyBuild, PIECE_GROUPS, BUILDING_GROUPS,
} from '../data/building.mjs';
import { buildPieces } from './buildings.js';
import { money } from '../data/money.mjs';
import { actionFor, codeFor, keyName } from '../data/controls.mjs';

const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const ghost = (color, opacity = 0.5) => new THREE.MeshStandardMaterial({ color, transparent: true, opacity, depthWrite: false });
const LOOKS = { ok: ghost('#5fe07a'), bad: ghost('#ff5040'), plan: ghost('#6ab4ff', 0.45) };
const AHEAD = 5; // metres in front of you that the piece goes

// `opts`: { plots, cls, coins(), build(body) -> Promise<plots>, onClose(), aim() -> { x, z } }
export function startWalkBuild(scene, host, opts) {
  let plots = opts.plots;
  const mineOf = () => plots.filter((p) => p.mine);
  let mode = 'pieces', piece = 'foundation', choice = 'hut', level = 0, turn = 0;
  let plan = [], offer = null, busy = false, hover = null, msg = '';
  const section = { pieces: 0, ready: 0 };
  const groundOk = (ix, iz) => plots.some((q) => q.mine && q.ix === ix && q.iz === iz && q.flat != null);
  const flatAt = (ix, iz) => plots.find((q) => q.ix === ix && q.iz === iz)?.flat ?? heightAt((ix + 0.5) * PLOT, (iz + 0.5) * PLOT);
  const flatOf = (p) => { const h = homePlot(p, groundOk) || homePlot(p, () => true); return flatAt(h.ix, h.iz); };
  const check = (body) => applyBuild(mineOf().map((p) => ({ ...p, pieces: p.pieces || [] })), body, opts.cls, Date.now());

  let planGroup = null, ghostGroup = null;
  function drawPlan() {
    if (planGroup) scene.remove(planGroup);
    planGroup = plan.length ? buildPieces(plan, flatOf, { look: LOOKS.plan }) : null;
    if (planGroup) scene.add(planGroup);
  }
  function drawGhost(pieces, ok) {
    if (ghostGroup) scene.remove(ghostGroup);
    ghostGroup = pieces ? buildPieces(pieces, flatOf, { look: ok ? LOOKS.ok : LOOKS.bad }) : null;
    if (ghostGroup) scene.add(ghostGroup);
  }

  // the grid spot in front of you
  function pieceAt(u, v) {
    const cx = Math.floor(u), cz = Math.floor(v);
    const on = PIECES[piece].on;
    if (on === 'cell') return { t: piece, x: cx, z: cz, l: piece === 'foundation' ? 0 : piece === 'floor' ? Math.max(1, level) : level, ...(piece === 'stairs' || piece === 'roof' ? { r: turn } : {}) };
    if (on === 'corner') return { t: piece, x: Math.round(u), z: Math.round(v), l: level };
    const fx = u - cx, fz = v - cz;
    const d = [[fz, cx, cz, 'n'], [1 - fz, cx, cz + 1, 'n'], [fx, cx, cz, 'w'], [1 - fx, cx + 1, cz, 'w']].sort((a, b) => a[0] - b[0])[0];
    return { t: piece, x: d[1], z: d[2], l: level, e: d[3] };
  }
  function update() {
    if (busy || offer) return;
    const a = opts.aim(AHEAD);
    const u = a.x / CELL, v = a.z / CELL;
    if (mode === 'ready') {
      const [w, d] = buildingSize(choice, turn);
      const b = { type: choice, x: Math.round(u - w / 2), z: Math.round(v - d / 2), r: turn };
      const sig = JSON.stringify(b);
      if (hover?.sig === sig) return;
      const r = check({ building: { ...b, how: 'hire' } });
      hover = { sig, b, ok: !r.error };
      drawGhost(placeBuilding(b.type, b.x, b.z, b.r), !r.error);
      setMsg(r.error || `${BUILDINGS[b.type].name}: press Place to put it here.`);
    } else {
      const p = pieceAt(u, v);
      const sig = pieceKey(p) + p.t + (p.r ?? '');
      if (hover?.sig === sig) return;
      if (plan.some((q) => pieceKey(q) === pieceKey(p))) {
        hover = { sig, p, ok: false };
        drawGhost(null);
        setMsg(`In your plan (${plan.length}). Turn or walk on to place the next one.`);
        return;
      }
      const r = check({ add: [...plan, p], remove: [] });
      hover = { sig, p, ok: !r.error };
      drawGhost([p], !r.error);
      setMsg(r.error || `${PIECES[p.t].name}: press Place to add it to the plan.`);
    }
  }

  // ---------- the bar along the bottom ----------
  const bar = document.createElement('div');
  bar.className = 'walkbuild';
  host.appendChild(bar);
  function setMsg(t) { msg = t || ''; const m = bar.querySelector('.wb-msg'); if (m) m.textContent = msg; }
  function draw() {
    const builder = opts.cls === 'builder';
    const cost = piecesCost(plan, opts.cls);
    const groups = mode === 'pieces' ? PIECE_GROUPS : BUILDING_GROUPS;
    const sections = groups.map(([name], i) => `<button type="button" class="wb-sec${section[mode] === i ? ' on' : ''}" data-wb-sec="${i}">${esc(name)}</button>`).join('');
    const chips = mode === 'pieces'
      ? PIECE_GROUPS[section.pieces][1].map((id) => `<button type="button" class="wb-chip${piece === id ? ' on' : ''}" data-wb-piece="${id}">${PIECES[id].name} <small>${money(Math.round(PIECES[id].price * (builder ? 0.6 : 1)))}</small></button>`).join('')
      : BUILDING_GROUPS[section.ready][1].map((id) => [id, BUILDINGS[id]]).map(([id, b]) => `<button type="button" class="wb-chip${choice === id ? ' on' : ''}" data-wb-pick="${id}" ${b.ruler && !isRuler(mineOf()) ? 'disabled' : ''}>${esc(b.name)} <small>${money(buildingCost(id, opts.cls, 'hire'))}</small></button>`).join('');
    const offerHtml = offer ? (() => {
      const self = buildingCost(offer.type, opts.cls, 'self'), hire = buildingCost(offer.type, opts.cls, 'hire');
      return `<div class="wb-offer"><b>${esc(BUILDINGS[offer.type].name)} here.</b>
        <button type="button" class="gold-button small" data-wb="hire" ${busy ? 'disabled' : ''}>Hire a builder: ${money(hire)} (${hireMinutes(offer.type)} min)</button>
        <button type="button" class="gold-button small" data-wb="self" ${busy ? 'disabled' : ''}>Build it now${builder ? ' (Builder price)' : ' yourself'}: ${money(self)}</button>
        <button type="button" data-wb="cancel">Cancel</button></div>`;
    })() : '';
    bar.innerHTML = `
      <div class="wb-top"><b>Building</b> <span class="wb-coins">${money(opts.coins())}</span>
        <button type="button" class="${mode === 'pieces' ? 'on' : ''}" data-wb-mode="pieces">Pieces</button>
        <button type="button" class="${mode === 'ready' ? 'on' : ''}" data-wb-mode="ready">Ready buildings</button>
        <button type="button" class="wb-x" data-wb="close" aria-label="Stop building">×</button></div>
      <p class="wb-msg" role="status">${esc(msg)}</p>
      ${offerHtml || `<div class="wb-secs">${sections}</div><div class="wb-chips">${chips}</div>
      <div class="wb-tools">
        <button type="button" class="gold-button" data-wb="place">Place <kbd>${keyName(codeFor('b_place'))}</kbd></button>
        <button type="button" data-wb="turn">Turn <kbd>R</kbd></button>
        ${mode === 'pieces' ? `<span class="wb-level">Storey <button type="button" data-wb="down" ${level ? '' : 'disabled'}>−</button> <b>${level + 1}</b> <button type="button" data-wb="up" ${level < MAX_LEVEL ? '' : 'disabled'}>+</button></span>` : ''}
        ${plan.length ? `<button type="button" data-wb="undo">Undo</button>
          <button type="button" class="gold-button" data-wb="build" ${busy ? 'disabled' : ''}>Build ${plan.length} for ${money(cost)}</button>` : ''}
      </div>`}`;
  }

  function place() {
    if (busy || offer) return;
    hover = null; update();
    if (!hover?.ok) return;
    if (mode === 'ready') { offer = hover.b; draw(); return; }
    plan.push(hover.p);
    hover = null;
    drawPlan(); draw();
    setMsg(`${plan.length} in the plan. Walk on and keep adding, then press Build.`);
  }
  async function commit(body, okText) {
    busy = true; draw();
    try {
      plots = await opts.build(body);
      plan = []; offer = null; hover = null;
      drawPlan(); drawGhost(null);
      msg = okText;
    } catch (err) { msg = err.message; }
    busy = false; draw();
  }
  function act(what) {
    switch (what) {
      case 'close': stop(); break;
      case 'place': place(); break;
      case 'turn': turn = (turn + 1) % 4; hover = null; break;
      case 'up': level = Math.min(MAX_LEVEL, level + 1); hover = null; draw(); break;
      case 'down': level = Math.max(0, level - 1); hover = null; draw(); break;
      case 'undo': plan.pop(); drawPlan(); draw(); break;
      case 'build': commit({ add: plan, remove: [] }, 'Built!'); break;
      case 'cancel': offer = null; hover = null; draw(); break;
      case 'hire': commit({ building: { ...offer, how: 'hire' } }, `A builder took the job. It will be ready in ${hireMinutes(offer.type)} minutes.`); break;
      case 'self': commit({ building: { ...offer, how: 'self' } }, `Your ${BUILDINGS[offer.type].name} is built!`); break;
      default:
    }
  }
  bar.addEventListener('click', (e) => {
    const t = (a) => e.target.closest(`[${a}]`)?.getAttribute(a);
    let v;
    if ((v = t('data-wb-sec')) != null) { section[mode] = Number(v); draw(); return; }
    if ((v = t('data-wb-mode'))) { mode = v; hover = null; offer = null; draw(); return; }
    if ((v = t('data-wb-piece'))) { piece = v; if (v === 'foundation') level = 0; hover = null; draw(); return; }
    if ((v = t('data-wb-pick'))) { choice = v; hover = null; draw(); return; }
    if ((v = t('data-wb'))) act(v);
  });
  // a few keys change meaning while you build (Settings → Controls → Building): E places, R turns,
  // PageUp/PageDown change storey
  const onKey = (e) => {
    if (e.target.closest?.('input, textarea')) return;
    const k = e.code === 'Escape' ? 'close' : { b_place: 'place', b_turn: 'turn', b_up: 'up', b_down: 'down' }[actionFor(e.code, { building: true })];
    if (!k) return;
    e.preventDefault(); e.stopImmediatePropagation();
    act(k);
  };
  window.addEventListener('keydown', onKey, true);

  function stop() {
    window.removeEventListener('keydown', onKey, true);
    drawGhost(null);
    if (planGroup) scene.remove(planGroup);
    bar.remove();
    opts.onClose?.();
  }
  draw();
  setMsg(mineOf().some((p) => p.flat != null) ? 'Walk onto your levelled land. The piece shows just in front of you.' : 'Clear and level a plot first (Land window, L): buildings need a proper base.');
  return { update, stop, setPlots(list) { plots = list; hover = null; } };
}
