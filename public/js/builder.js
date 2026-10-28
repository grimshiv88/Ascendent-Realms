// The Builder View (V): your land in 3D from above, with ready-made buildings and single pieces to
// place on it. Pieces you place go into a plan first; Build pays for the whole plan at once.
import * as THREE from 'three';
import { codeFor } from './data/controls.mjs';
import { heightAt, PLOT } from './data/world-layout.mjs';
import {
  CELL, STOREY, MAX_LEVEL, PIECES, BUILDINGS, COUNTRY_PLOTS, isRuler, homePlot, pieceKey, placeBuilding, buildingSize,
  piecesCost, removeCost, buildingCost, hireMinutes, applyBuild, READY_MARKUP, PIECE_GROUPS, BUILDING_GROUPS,
} from './data/building.mjs';
import { buildPieces, storeyY } from './world/buildings.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const ghost = (color) => new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false });
const LOOKS = { ok: ghost('#5fe07a'), bad: ghost('#ff5040'), plan: ghost('#6ab4ff'), remove: ghost('#ff9a30') };

// `opts`: { plots (everyone's, with mine/flat/pieces), cls, coins(), build(body) -> Promise<plots>, onClose, onWalk, say(text) }
export function openBuilder(host, opts) {
  let plots = opts.plots;
  const mineOf = () => plots.filter((p) => p.mine);
  if (!mineOf().length) return null;

  host.innerHTML = `
    <div class="builder" role="dialog" aria-label="Builder View">
      <canvas class="bv-canvas"></canvas>
      <div class="bv-top">
        <h2>Builder View</h2>
        <span class="bv-coins"></span>
        <button type="button" class="bv-walk" data-bv="walk" title="Walk about your land and build from your character">Build from your character</button>
        <button type="button" class="bv-close" data-bv="close" aria-label="Close">×</button>
      </div>
      <p class="bv-msg" role="status"></p>
      <div class="bv-panel">
        <div class="bv-tabs" role="tablist">
          <button type="button" data-tab="ready" role="tab">Ready buildings</button>
          <button type="button" data-tab="pieces" role="tab">Pieces</button>
          <button type="button" data-tab="remove" role="tab">Remove</button>
        </div>
        <div class="bv-tools"></div>
        <div class="bv-strip">
          <button type="button" class="bv-scroll" data-scroll="-1" aria-label="Scroll left">‹</button>
          <div class="bv-cards"></div>
          <button type="button" class="bv-scroll" data-scroll="1" aria-label="Scroll right">›</button>
        </div>
      </div>
    </div>`;
  const root = host.querySelector('.builder');
  const canvas = root.querySelector('canvas');
  const $ = (s) => root.querySelector(s);
  // the list of buildings and pieces is wider than the screen: arrows and the mouse wheel move it sideways
  const cards = $('.bv-cards');
  for (const b of root.querySelectorAll('[data-scroll]')) b.addEventListener('click', () => cards.scrollBy({ left: Number(b.dataset.scroll) * cards.clientWidth * 0.8, behavior: 'smooth' }));
  cards.addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { cards.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });

  // ---------- the scene ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9cc7e8');
  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 4000);
  scene.add(new THREE.HemisphereLight('#fff6e0', '#4a5a3a', 1.3));
  const sun = new THREE.DirectionalLight('#fff0d0', 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun, sun.target);

  // the area to show: your land, with a plot of room around it
  const mine = mineOf();
  let x0 = Math.min(...mine.map((p) => p.ix)) - 1, x1 = Math.max(...mine.map((p) => p.ix)) + 2;
  let z0 = Math.min(...mine.map((p) => p.iz)) - 1, z1 = Math.max(...mine.map((p) => p.iz)) + 2;
  // very wide lands show the part around the middle (you can still pan)
  const MAXP = 40;
  if (x1 - x0 > MAXP) { const c = Math.round((x0 + x1) / 2); x0 = c - MAXP / 2; x1 = c + MAXP / 2; }
  if (z1 - z0 > MAXP) { const c = Math.round((z0 + z1) / 2); z0 = c - MAXP / 2; z1 = c + MAXP / 2; }
  const W = (x1 - x0) * PLOT, D = (z1 - z0) * PLOT;
  const ground = (() => {
    const seg = Math.min(200, Math.round(Math.max(W, D) / 2));
    const geo = new THREE.PlaneGeometry(W, D, seg, seg);
    geo.rotateX(-Math.PI / 2);
    geo.translate(x0 * PLOT + W / 2, 0, z0 * PLOT + D / 2);
    const pos = geo.attributes.position, colors = [];
    const owner = new Map(plots.map((p) => [`${p.ix},${p.iz}`, p]));
    const col = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, heightAt(x, z));
      const p = owner.get(`${Math.floor(x / PLOT)},${Math.floor(z / PLOT)}`);
      col.set(!p ? '#5d8a3f' : !p.mine ? '#a8584a' : p.flat != null ? '#c9a24e' : '#b07a3a');
      colors.push(col.r, col.g, col.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    m.receiveShadow = true;
    return m;
  })();
  scene.add(ground);

  // the 4 m grid over your levelled plots, at the storey you're working on
  let gridLines = null;
  function drawGrid() {
    if (gridLines) scene.remove(gridLines);
    const pts = [];
    for (const p of mineOf()) {
      if (p.flat == null) continue;
      const y = storeyY(p.flat, level) + 0.03;
      for (let i = 0; i <= PLOT / CELL; i++) {
        const a = p.ix * PLOT + i * CELL, b = p.iz * PLOT + i * CELL;
        pts.push(a, y, p.iz * PLOT, a, y, (p.iz + 1) * PLOT, p.ix * PLOT, y, b, (p.ix + 1) * PLOT, y, b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    gridLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: level ? '#2a6dff' : '#fff6d0', transparent: true, opacity: 0.55 }));
    scene.add(gridLines);
  }

  // ---------- state ----------
  let tab = 'ready', choice = 'hut', piece = 'foundation', level = 0, turn = 0;
  let section = { ready: 0, pieces: 0 }; // which section of buildings or pieces is showing
  let plan = [];          // pieces waiting to be paid for
  let removing = new Set(); // keys of built pieces marked to come down
  let offer = null;       // a ready building placed and waiting for "build now" or "hire"
  let hover = null;       // the piece (or building) under the pointer
  let busy = false;
  const ruler = () => isRuler(mineOf());
  const groundOk = (ix, iz) => { const p = plots.find((q) => q.mine && q.ix === ix && q.iz === iz); return p?.flat != null; };
  const flatAt = (ix, iz) => plots.find((q) => q.ix === ix && q.iz === iz)?.flat ?? heightAt((ix + 0.5) * PLOT, (iz + 0.5) * PLOT);
  const flatOf = (p) => { const h = homePlot(p, groundOk) || homePlot(p, () => true); return flatAt(h.ix, h.iz); };
  const builtPieces = () => mineOf().flatMap((p) => p.pieces || []);
  const say = (t) => { $('.bv-msg').textContent = t || ''; };

  // ---------- drawing what's built, the plan and the ghost ----------
  let builtGroup = null, planGroup = null, ghostGroup = null;
  function drawBuilt() {
    if (builtGroup) scene.remove(builtGroup);
    builtGroup = new THREE.Group();
    for (const p of plots) {
      if (!p.pieces?.length || p.flat == null) continue;
      const g = buildPieces(p.pieces, () => p.flat);
      g.userData.mine = p.mine;
      builtGroup.add(g);
    }
    // pieces marked for removal glow orange
    if (removing.size) builtGroup.add(buildPieces(builtPieces().filter((q) => removing.has(pieceKey(q))), flatOf, { look: LOOKS.remove }));
    scene.add(builtGroup);
  }
  function drawPlan() {
    if (planGroup) scene.remove(planGroup);
    planGroup = buildPieces(plan, flatOf, { look: LOOKS.plan });
    scene.add(planGroup);
  }
  function drawGhost(pieces, ok) {
    if (ghostGroup) scene.remove(ghostGroup);
    ghostGroup = pieces ? buildPieces(pieces, flatOf, { look: ok ? LOOKS.ok : LOOKS.bad }) : null;
    if (ghostGroup) scene.add(ghostGroup);
  }

  // would this go up? (the same rules the server uses)
  const check = (body) => applyBuild(mineOf().map((p) => ({ ...p, pieces: p.pieces || [] })), body, opts.cls, Date.now());

  // ---------- the panel ----------
  function drawPanel() {
    $('.bv-coins').textContent = `${opts.coins().toLocaleString()} G`;
    for (const b of root.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    const builder = opts.cls === 'builder';
    const downCost = removeCost(builtPieces().filter((q) => removing.has(pieceKey(q))), opts.cls);
    const planCost = piecesCost(plan, opts.cls) + downCost;
    const groups = tab === 'ready' ? BUILDING_GROUPS : tab === 'pieces' ? PIECE_GROUPS : null;
    $('.bv-tools').innerHTML = `
      ${groups ? `<span class="bv-sections">${groups.map(([name], i) => `<button type="button" class="bv-section${section[tab] === i ? ' on' : ''}" data-section="${i}">${esc(name)}</button>`).join('')}</span>` : ''}
      ${tab !== 'ready' ? `<span class="bv-level">Storey <button type="button" data-bv="down" aria-label="Down a storey" ${level ? '' : 'disabled'}>−</button> <b>${level + 1}</b> <button type="button" data-bv="up" aria-label="Up a storey" ${level < MAX_LEVEL ? '' : 'disabled'}>+</button></span>` : ''}
      ${tab !== 'remove' ? `<button type="button" data-bv="turn">Turn <kbd>R</kbd></button>` : ''}
      ${plan.length || removing.size ? `<span class="bv-plan">Plan: ${plan.length ? `${plan.length} piece${plan.length === 1 ? '' : 's'} · <b>${(planCost - downCost).toLocaleString()} G</b>` : ''}${removing.size ? ` ${removing.size} to remove (${downCost.toLocaleString()} G)` : ''}${plan.length && removing.size ? ` · total <b>${planCost.toLocaleString()} G</b>` : ''}</span>
        <button type="button" class="gold-button" data-bv="build" ${busy ? 'disabled' : ''}>Build</button>
        <button type="button" data-bv="clear">Clear plan</button>` : ''}`;
    if (offer) {
      const b = BUILDINGS[offer.type];
      const self = buildingCost(offer.type, opts.cls, 'self'), hire = buildingCost(offer.type, opts.cls, 'hire');
      $('.bv-cards').innerHTML = `
        <div class="bv-offer">
          <p><b>${esc(b.name)}</b> here. How do you want it built?</p>
          <button type="button" class="gold-button" data-bv="hire" ${busy ? 'disabled' : ''}>Hire a builder (quest): ${hire.toLocaleString()} G <small>ready in ${hireMinutes(offer.type)} min</small></button>
          <button type="button" class="${builder ? 'gold-button' : ''}" data-bv="self" ${busy ? 'disabled' : ''}>${builder ? 'Build it now (Builder price)' : 'Build it now yourself'}: ${self.toLocaleString()} G</button>
          <button type="button" data-bv="cancel">Cancel</button>
          <p class="bv-hint">${builder ? 'As a Builder you raise ready buildings for less than hiring one.' : `Raising it yourself costs ${READY_MARKUP}× what a hired builder charges. A Builder pays far less.`}</p>
        </div>`;
      return;
    }
    if (tab === 'ready') {
      $('.bv-cards').innerHTML = BUILDING_GROUPS[section.ready][1].map((id) => [id, BUILDINGS[id]]).map(([id, b]) => {
        const locked = b.ruler && !ruler();
        const [w, d] = b.size;
        return `<button type="button" class="bv-card${choice === id ? ' on' : ''}" data-pick="${id}" ${locked ? 'disabled' : ''}>
          <b>${esc(b.name)}</b><small>${w * CELL} × ${d * CELL} m</small>
          <span>Hire: ${buildingCost(id, opts.cls, 'hire').toLocaleString()} G</span>
          <span>${builder ? 'Builder' : 'Yourself'}: ${buildingCost(id, opts.cls, 'self').toLocaleString()} G</span>
          <small>${locked ? `Rulers only (${COUNTRY_PLOTS}+ joined plots)` : esc(b.text)}</small></button>`;
      }).join('');
    } else if (tab === 'pieces') {
      $('.bv-cards').innerHTML = PIECE_GROUPS[section.pieces][1].map((id) => `<button type="button" class="bv-card${piece === id ? ' on' : ''}" data-piece="${id}">
          <b>${PIECES[id].name}</b><span>${Math.round(PIECES[id].price * (builder ? 0.6 : 1))} G</span><small>${PIECES[id].text}</small></button>`).join('');
    } else {
      $('.bv-cards').innerHTML = '<p class="bv-hint">Tap a piece you built to mark it for removal (tap again to keep it), then press Build. Taking pieces down costs about a third of their build price. Pieces holding others up can only come down with them.</p>';
    }
  }

  // ---------- pointer: which cell, edge or corner ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const avgFlat = mine.reduce((a, p) => a + (p.flat ?? heightAt((p.ix + 0.5) * PLOT, (p.iz + 0.5) * PLOT)), 0) / mine.length;
  function spotAt(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    // aim at the floor of the storey you're on, on the plot under the pointer
    let y = avgFlat + 0.3 + level * STOREY, hit = new THREE.Vector3();
    for (let i = 0; i < 2; i++) {
      if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), hit)) return null;
      y = storeyY(flatAt(Math.floor(hit.x / PLOT), Math.floor(hit.z / PLOT)), level);
    }
    return { u: hit.x / CELL, v: hit.z / CELL };
  }
  function pieceAt(s) {
    const cx = Math.floor(s.u), cz = Math.floor(s.v);
    const on = PIECES[piece].on;
    if (on === 'cell') return { t: piece, x: cx, z: cz, l: piece === 'foundation' ? 0 : piece === 'floor' ? Math.max(1, level) : level, ...(piece === 'stairs' || piece === 'roof' ? { r: turn } : {}) };
    if (on === 'corner') return { t: piece, x: Math.round(s.u), z: Math.round(s.v), l: level };
    const fx = s.u - cx, fz = s.v - cz;
    const d = [[fz, cx, cz, 'n'], [1 - fz, cx, cz + 1, 'n'], [fx, cx, cz, 'w'], [1 - fx, cx + 1, cz, 'w']].sort((a, b) => a[0] - b[0])[0];
    return { t: piece, x: d[1], z: d[2], l: level, e: d[3] };
  }
  function buildingAt(s) {
    const [w, d] = buildingSize(choice, turn);
    return { type: choice, x: Math.round(s.u - w / 2), z: Math.round(s.v - d / 2), r: turn };
  }
  function pickBuilt(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(builtGroup.children.filter((g) => g.userData.mine), true);
    return hits.find((h) => h.object.userData.piece)?.object.userData.piece || null;
  }

  function hoverAt(e) {
    if (offer || busy) return;
    if (tab === 'remove') { hover = pickBuilt(e); drawGhost(hover ? [hover] : null, false); return; }
    const s = spotAt(e);
    if (!s) { drawGhost(null); return; }
    if (tab === 'ready') {
      const b = buildingAt(s);
      const sig = JSON.stringify(b);
      if (hover?.sig === sig) return;
      const pieces = placeBuilding(b.type, b.x, b.z, b.r);
      const r = check({ building: { ...b, how: 'hire' } });
      hover = { sig, b, ok: !r.error, why: r.error };
      drawGhost(pieces, !r.error);
      say(r.error || `${BUILDINGS[b.type].name}: tap to place it.`);
    } else {
      const p = pieceAt(s);
      const sig = pieceKey(p) + p.t + (p.r ?? '');
      if (hover?.sig === sig) return;
      const r = check({ add: [...plan, p], remove: [...removing] });
      hover = { sig, p, ok: !r.error, why: r.error };
      drawGhost([p], !r.error);
      say(r.error ? r.error : `${PIECES[p.t].name}: tap to add it to the plan.`);
    }
  }
  function tapAt(e) {
    if (offer || busy) return;
    hover = null;
    hoverAt(e);
    if (tab === 'remove') {
      const p = pickBuilt(e);
      if (!p) return;
      const k = pieceKey(p);
      if (removing.has(k)) removing.delete(k); else removing.add(k);
      const r = check({ add: plan, remove: [...removing] });
      if (r.error) { removing.delete(k); say('That piece holds others up. Remove what stands on it first.'); }
      else say(removing.has(k) ? `${PIECES[p.t].name} marked to come down. Press Build to remove it.` : 'Kept.');
      drawBuilt(); drawPanel(); return;
    }
    if (!hover?.ok) return;
    if (tab === 'ready') { offer = hover.b; drawGhost(placeBuilding(offer.type, offer.x, offer.z, offer.r), true); drawPanel(); return; }
    plan.push(hover.p);
    hover = null;
    drawGhost(null); drawPlan(); drawPanel();
    say(`${plan.length} in the plan. Keep adding, then press Build.`);
  }

  async function commit(body, okText) {
    busy = true; drawPanel();
    try {
      plots = await opts.build(body);
      plan = []; removing = new Set(); offer = null; hover = null;
      drawBuilt(); drawPlan(); drawGhost(null);
      say(okText);
    } catch (err) { say(err.message); }
    busy = false; drawPanel();
  }

  // ---------- camera: drag to turn, scroll or pinch to zoom, right-drag or two fingers to move ----------
  const target = new THREE.Vector3(mine.reduce((a, p) => a + (p.ix + 0.5) * PLOT, 0) / mine.length, avgFlat, mine.reduce((a, p) => a + (p.iz + 0.5) * PLOT, 0) / mine.length);
  let yaw = 0.7, pitch = 0.9, dist = Math.min(500, Math.max(45, Math.max(W, D) * 0.45));
  function place() {
    camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    camera.lookAt(target);
    sun.position.set(target.x + 60, target.y + 120, target.z + 40);
    sun.target.position.copy(target);
    const s = Math.min(300, dist);
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, far: 600 });
    sun.shadow.camera.updateProjectionMatrix();
  }
  const pts = new Map();
  let downAt = null, pinch = 0, moved = 0;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY, e.button]); downAt = [e.clientX, e.clientY]; moved = 0; });
  canvas.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) { if (e.pointerType === 'mouse') hoverAt(e); return; }
    const [ox, oy, btn] = pts.get(e.pointerId);
    const dx = e.clientX - ox, dy = e.clientY - oy;
    pts.set(e.pointerId, [e.clientX, e.clientY, btn]);
    moved += Math.abs(dx) + Math.abs(dy);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) dist = Math.min(900, Math.max(12, dist * (pinch / d)));
      pinch = d;
      pan(dx / 2, dy / 2);
    } else if (btn === 2 || e.shiftKey) pan(dx, dy);
    else { yaw -= dx * 0.006; pitch = Math.min(1.45, Math.max(0.25, pitch + dy * 0.005)); }
    place();
  });
  function pan(dx, dy) {
    const k = dist / 600;
    target.x -= (Math.cos(yaw) * dx + Math.sin(yaw) * dy) * k;
    target.z -= (-Math.sin(yaw) * dx + Math.cos(yaw) * dy) * k;
  }
  const up = (e) => {
    const was = pts.get(e.pointerId);
    pts.delete(e.pointerId); pinch = 0;
    if (was && e.type === 'pointerup' && moved < 8 && was[2] === 0 && downAt) tapAt(e);
    downAt = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); dist = Math.min(900, Math.max(12, dist * (e.deltaY > 0 ? 1.12 : 0.89))); place(); }, { passive: false });

  root.addEventListener('click', (e) => {
    const t = (a) => e.target.closest(`[${a}]`)?.getAttribute(a);
    let v;
    if ((v = t('data-tab'))) { tab = v; hover = null; offer = null; drawGhost(null); say(v === 'ready' ? 'Pick a building, then tap your land to place it.' : v === 'pieces' ? 'Start with foundations on levelled land, then walls, then floors or a roof.' : ''); drawPanel(); return; }
    if ((v = t('data-section')) != null) { section[tab] = Number(v); cards.scrollLeft = 0; drawPanel(); return; }
    if ((v = t('data-pick'))) { choice = v; hover = null; drawPanel(); return; }
    if ((v = t('data-piece'))) { piece = v; hover = null; if (v === 'foundation') { level = 0; drawGrid(); } drawPanel(); return; }
    switch (t('data-bv')) {
      case 'close': close(); break;
      case 'walk': close(); opts.onWalk?.(); break;
      case 'up': level = Math.min(MAX_LEVEL, level + 1); hover = null; drawGrid(); drawPanel(); break;
      case 'down': level = Math.max(0, level - 1); hover = null; drawGrid(); drawPanel(); break;
      case 'turn': turn = (turn + 1) % 4; hover = null; drawGhost(null); break;
      case 'clear': plan = []; removing = new Set(); drawPlan(); drawBuilt(); drawPanel(); say('Plan cleared.'); break;
      case 'build': commit({ add: plan, remove: [...removing] }, 'Built!'); break;
      case 'cancel': offer = null; drawGhost(null); drawPanel(); break;
      case 'hire': commit({ building: { ...offer, how: 'hire' } }, `A builder took the job. It will be ready in ${hireMinutes(offer.type)} minutes.`); break;
      case 'self': commit({ building: { ...offer, how: 'self' } }, `Your ${BUILDINGS[offer.type].name} is built!`); break;
      default:
    }
  });
  // while building, keys belong to the Builder View (the world behind doesn't move)
  const onKey = (e) => {
    if (e.target.closest?.('input, textarea')) return;
    e.stopImmediatePropagation();
    if (e.code === 'Escape' || e.code === codeFor('builder')) close();
    if (e.code === 'KeyR') { turn = (turn + 1) % 4; hover = null; drawGhost(null); }
  };
  window.addEventListener('keydown', onKey, true);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize(); place(); drawGrid(); drawBuilt(); drawPlan(); drawPanel();
  say(mine.some((p) => p.flat != null) ? 'Pick a building, then tap your land to place it. Drag to turn, scroll to zoom, right-drag to move.' : 'Clear and level a plot first (Land window, L): buildings need a proper base.');
  renderer.setAnimationLoop(() => renderer.render(scene, camera));

  function close() {
    renderer.setAnimationLoop(null);
    renderer.dispose();
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', resize);
    host.innerHTML = '';
    opts.onClose?.();
  }
  return { close };
}
