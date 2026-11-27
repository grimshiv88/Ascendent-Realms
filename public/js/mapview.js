// The world map window (M) and the minimap in the corner. Both follow you as you move.
// Zoom in far enough and the map shows the real ground at its true size.
import { drawWorldMap } from './world/mapdraw.js';
import { createTerrainPainter } from './world/terrainmap.js';
import { toMap, toWorld, METRES_PER_PX, placesWithPositions, PLOT } from './data/world-layout.mjs';
import { allPortals, portalsFrom, portalLevel } from './data/portals.mjs';
import { allCastles } from './data/kings.mjs';
import { allWonders } from './data/wonders.mjs';
import { allFarms, standOf } from './data/farms.mjs';
import { CITY_R } from './data/world-layout.mjs';
import { drawCityPlan } from './world/cityplan.js';
import { MAX_MAP_MARKS, MARK_NAME, MARK_COLOURS } from './data/social.mjs';

const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

const W = 1600, H = 1000;          // the map canvas, in map pixels at zoom 1
const MAX_ZOOM = 2560;             // at the closest, the window is about 250 m across
const DETAIL_FROM = 4;             // real ground starts showing from this zoom
const VIEW_KEY = 'ar-mapview';

// The map opens where you left it, even after a reload
let view = (() => {
  try { const v = JSON.parse(localStorage.getItem(VIEW_KEY)); if (v && v.zoom) return v; } catch {}
  return { zoom: 1, cx: 800, cy: 500, follow: false };
})();
// friends are shown on the map unless you turn them off (the ON/OFF button on the map)
export const mapShowsFriends = () => view.friends !== false;
const saveView = () => { try { localStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch {} };

// your position: a small arrow, the same size at every zoom, with a ring so it's easy to find
function drawMe(ctx, x, y, heading, size, t) {
  const ring = (t / 1400) % 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = `rgba(255, 90, 70, ${0.7 * (1 - ring)})`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, size * (0.9 + ring * 1.6), 0, Math.PI * 2); ctx.stroke();
  ctx.rotate(Math.PI - (heading || 0));
  ctx.fillStyle = '#e0301f'; ctx.strokeStyle = '#fff4d8'; ctx.lineWidth = Math.max(1.2, size * 0.16);
  ctx.beginPath(); ctx.moveTo(0, -size * 0.75); ctx.lineTo(size * 0.48, size * 0.55); ctx.lineTo(0, size * 0.28); ctx.lineTo(-size * 0.48, size * 0.55); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function diamond(ctx, x, y, label) {
  ctx.save();
  ctx.shadowColor = '#3d9bff'; ctx.shadowBlur = 10;
  ctx.fillStyle = '#9fd4ff'; ctx.strokeStyle = '#0a1a33'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 6.5, y); ctx.lineTo(x, y + 9); ctx.lineTo(x - 6.5, y); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  if (label) {
    ctx.font = 'bold 15px Cinzel, Georgia, serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)'; ctx.strokeText(label, x, y - 14);
    ctx.fillStyle = '#e6f3ff'; ctx.fillText(label, x, y - 14);
  }
  ctx.restore();
}

// one of your own marks: a pin in its colour, with its name
function drawPin(ctx, x, y, colour, label, size = 1, picked = false) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(size, size);
  if (picked) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -13, 13, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = colour; ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-3, -6, -8, -9, -8, -14); ctx.arc(0, -14, 8, Math.PI, 0); ctx.bezierCurveTo(8, -9, 3, -6, 0, 0); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1a1208'; ctx.beginPath(); ctx.arc(0, -14, 2.8, 0, Math.PI * 2); ctx.fill();
  if (label) {
    ctx.font = '600 14px Cinzel, Georgia, serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)'; ctx.strokeText(label, 0, -27);
    ctx.fillStyle = colour; ctx.fillText(label, 0, -27);
  }
  ctx.restore();
}

// a friend in the game: a green dot with their username (a little house when they are indoors or underground)
function drawFriend(ctx, x, y, f, size = 1) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(size, size);
  ctx.shadowColor = '#3fff8a'; ctx.shadowBlur = 8;
  ctx.fillStyle = '#3fdc7a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  if (f.inside) { ctx.beginPath(); ctx.moveTo(-6, 5); ctx.lineTo(-6, -2); ctx.lineTo(0, -8); ctx.lineTo(6, -2); ctx.lineTo(6, 5); ctx.closePath(); }
  else { ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); }
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.font = '700 13px Georgia, serif'; ctx.textAlign = 'center';
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)'; ctx.strokeText(f.name, 0, -12);
  ctx.fillStyle = '#a8ffc8'; ctx.fillText(f.name, 0, -12);
  ctx.restore();
}

// A rounded distance (1, 2 or 5 × a power of ten) that fits in about `maxM` metres
function niceMetres(maxM) {
  const p = 10 ** Math.floor(Math.log10(maxM));
  return [5, 2, 1].map((k) => k * p).find((m) => m <= maxM) || p;
}
const distText = (m) => (m >= 1000 ? `${m / 1000} km` : `${m} m`);

// `getPlayer()` gives {x, z, heading}; `marks` are quest places [{x, z, label}];
// `mine` is your territory: { plots: [{ix, iz}], caves: [{x, z, name}], others: plots of other owners };
// `pick(x, z)`, when given (the land grid is open), is called when you tap a spot to buy land there;
// `travel`, when given ({ from, to, onPick }), turns the map into a portal's: tap a portal on this
// continent to choose it
// `warp(x, z)`, when given (an admin's Teleport power is on), is called when you tap any spot.
// `extra` (the plain world map only): `pins` = your own marks { list(), save(list) };
// `friends` = where your friends are { spots(), refresh() }.
export function renderMap(el, getPlayer, marks = [], mine = { plots: [], caves: [] }, pick = null, travel = null, warp = null, extra = {}) {
  const pins = !pick && !travel ? extra.pins : null;
  const pals = !travel ? extra.friends : null;
  let marking = false;   // the next tap puts a mark down
  let picked = null;     // the id of the mark being named or moved
  const portals = allPortals();
  const reachable = travel ? portalsFrom(travel.from) : [];
  // on a portal's map: how strong the monsters are round each one (a portal won't send you where
  // they are stronger than you)
  const lvOf = new Map(reachable.map((p) => [p, portalLevel(p)]));
  const locked = (p) => travel && ((lvOf.get(p) ?? 0) > (travel.level ?? Infinity) || !!travel.shut?.(p));
  if (travel) {
    // open on the whole continent
    const pts = [travel.from, ...reachable].map((q) => toMap(q.x, q.z));
    const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    view.follow = false;
    view.cx = (x0 + x1) / 2; view.cy = (y0 + y1) / 2;
    view.zoom = Math.max(1, Math.min(3, Math.min(W / (x1 - x0 + 160), H / (y1 - y0 + 160))));
    saveView();
  }
  el.innerHTML = `
    <div class="status-window map-window" role="dialog" aria-label="${travel ? 'Portal' : 'World map'}">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      <h2>${travel ? `${esc(travel.from.name)}: where to?` : 'World Map'}</h2>
      ${travel ? `<div class="portal-pick" aria-live="polite"><p>Tap a glowing portal on this continent to see the fee. Portals can't cross the sea, and only open where the monsters are your level or lower (red ones show the level you need).</p></div>` : ''}
      <div class="map-frame">
        <canvas width="${W}" height="${H}" aria-label="World map with your position"></canvas>
        <div class="map-zoom">
          <button type="button" data-zoom="1" aria-label="Zoom in">+</button>
          <button type="button" data-zoom="-1" aria-label="Zoom out">−</button>
          <button type="button" data-zoom="me" aria-label="Follow me">◎</button>
          <button type="button" data-zoom="0" aria-label="Show the whole map">⤢</button>
        </div>
        ${pick ? '<div class="map-basket" role="status" hidden></div>' : ''}
        ${pins || pals ? `<div class="map-tools">
          ${pins ? '<button type="button" data-map-tool="mark" aria-pressed="false" title="Tap this, then tap the map to mark a place">📍 Mark a place</button>' : ''}
          ${pals ? `<button type="button" data-map-tool="friends" aria-pressed="${mapShowsFriends()}" title="Show or hide your friends on the map">👥 Friends: ${mapShowsFriends() ? 'ON' : 'OFF'}</button>` : ''}
        </div>` : ''}
        ${pins ? '<div class="map-pin-edit" hidden></div>' : ''}
      </div>
      ${pins || pals ? '<div class="map-lists"></div>' : ''}
      <p class="map-note">${warp && !pick && !travel ? '<b>Teleport is on: tap anywhere to go there.</b> ' : ''}${travel ? '' : 'Purple rings are portals. '}Scroll or pinch to zoom, drag to move around, ◎ to follow yourself. The red arrow is you, drawn small so you can see how big the land really is. Zoom right in to see the real ground. ${pins ? 'Your own marks (📍) are seen only by you. ' : ''}${pals ? 'Green dots are friends who share where they are (each player chooses this in their Status window). ' : ''}${pick ? '<b>Land grid is open: zoom in and tap squares to choose them, then press Buy. The dashed square is how far you can buy (1 km across, around you).</b> ' : ''}${mine.plots.length || mine.caves.length ? `<b>Gold is your territory:</b> ${mine.plots.length} plot${mine.plots.length === 1 ? '' : 's'} of land and ${mine.caves.length} cave${mine.caves.length === 1 ? '' : 's'}.` : 'Land and caves you buy show here in gold.'}</p>
    </div>`;
  // the painted map, drawn once at twice the size so it stays sharp when zoomed a little
  const full = document.createElement('canvas');
  full.width = W * 2; full.height = H * 2;
  drawWorldMap(full);
  const cv = el.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const ground = createTerrainPainter(200, 125);
  let asked = null; // the area of real ground asked for
  const places = placesWithPositions();

  const clampView = () => {
    view.zoom = Math.min(MAX_ZOOM, Math.max(1, view.zoom));
    const sw = W / view.zoom, sh = H / view.zoom;
    view.cx = Math.min(W - sw / 2, Math.max(sw / 2, view.cx));
    view.cy = Math.min(H - sh / 2, Math.max(sh / 2, view.cy));
  };
  // map pixel -> canvas pixel
  const toCanvas = (mx, my) => [(mx - view.cx) * view.zoom + W / 2, (my - view.cy) * view.zoom + H / 2];

  function frame(t) {
    const p = getPlayer();
    const me = p ? toMap(p.x, p.z) : null;
    if (view.follow && me) { view.cx = me.x; view.cy = me.y; }
    clampView();
    const sw = W / view.zoom, sh = H / view.zoom;
    const vx0 = view.cx - sw / 2, vy0 = view.cy - sh / 2;
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    // the real ground, faded in as you zoom closer
    const detail = Math.min(1, Math.max(0, (view.zoom - DETAIL_FROM) / DETAIL_FROM));
    if (detail < 1) ctx.drawImage(full, vx0 * 2, vy0 * 2, sw * 2, sh * 2, 0, 0, W, H);
    else { ctx.fillStyle = '#2b3a2a'; ctx.fillRect(0, 0, W, H); }
    if (detail > 0) {
      const a = toWorld(vx0, vy0), b = toWorld(vx0 + sw, vy0 + sh);
      const inside = asked && a.x >= asked.x0 && a.z >= asked.z0 && b.x <= asked.x1 && b.z <= asked.z1 && asked.x1 - asked.x0 < (b.x - a.x) * 1.8;
      if (!inside) {
        const padX = (b.x - a.x) * 0.2, padZ = (b.z - a.z) * 0.2;
        asked = { x0: a.x - padX, z0: a.z - padZ, x1: b.x + padX, z1: b.z + padZ };
        ground.want(asked);
      }
      ground.step(7);
      ctx.globalAlpha = detail;
      ground.draw(ctx, (g) => {
        const a = toMap(g.x0, g.z0), b = toMap(g.x1, g.z1);
        const [x0, y0] = toCanvas(a.x, a.y), [x1, y1] = toCanvas(b.x, b.y);
        return [x0, y0, x1 - x0, y1 - y0];
      });
      ctx.globalAlpha = 1;
      // zoomed in on a city: its plan, streets, buildings and names
      const k = view.zoom / METRES_PER_PX;
      const cityAlpha = Math.min(1, Math.max(0, (k * CITY_R * 2 - 160) / 160));
      if (cityAlpha > 0) for (const pl of places) {
        if (!pl.city) continue;
        const m = toMap(pl.x, pl.z), [x, y] = toCanvas(m.x, m.y), r = CITY_R * k;
        if (x < -r || y < -r || x > W + r || y > H + r) continue;
        drawCityPlan(ctx, pl, (wx, wz) => { const q = toMap(wx, wz); return toCanvas(q.x, q.y); }, k, cityAlpha);
      }
      // place names stay readable over the real ground
      ctx.save();
      ctx.globalAlpha = detail;
      ctx.font = '600 15px Cinzel, Georgia, serif'; ctx.textAlign = 'center';
      for (const pl of places) {
        const m = toMap(pl.x, pl.z);
        const [x, y] = toCanvas(m.x, m.y);
        if (x < -100 || y < -40 || x > W + 100 || y > H + 40) continue;
        ctx.fillStyle = '#8a1f1a'; ctx.strokeStyle = '#fff4d8'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)'; ctx.strokeText(pl.name, x, y - 12);
        ctx.fillStyle = '#f5ebd0'; ctx.fillText(pl.name, x, y - 12);
      }
      // every farm's Farm Stand, where horses and donkeys are sold
      ctx.font = '600 13px Cinzel, Georgia, serif';
      for (const f of allFarms()) {
        const st = standOf(f), m = toMap(st.x, st.z);
        const [x, y] = toCanvas(m.x, m.y);
        if (x < -100 || y < -40 || x > W + 100 || y > H + 40) continue;
        ctx.fillStyle = '#3d7a2a'; ctx.strokeStyle = '#fff4d8'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.font = '12px serif'; ctx.fillText('🐎', x, y + 4);
        ctx.font = '600 13px Cinzel, Georgia, serif';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)'; ctx.strokeText('Farm Stand · horses', x, y - 13);
        ctx.fillStyle = '#d8f5c0'; ctx.fillText('Farm Stand · horses', x, y - 13);
      }
      ctx.restore();
    }

    // the land grid, once squares are big enough to tap; other people's land in red
    ctx.save();
    const plotPx = (PLOT / METRES_PER_PX) * view.zoom;
    if (pick && plotPx >= 8) {
      const a = toWorld(vx0, vy0), b = toWorld(vx0 + sw, vy0 + sh);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let ix = Math.floor(a.x / PLOT); ix <= Math.ceil(b.x / PLOT); ix++) { const [x] = toCanvas(toMap(ix * PLOT, 0).x, 0); ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let iz = Math.floor(a.z / PLOT); iz <= Math.ceil(b.z / PLOT); iz++) { const [, y] = toCanvas(0, toMap(0, iz * PLOT).y); ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
    }
    // while buying: the 1 km square you can buy in, and the plots chosen so far
    if (pick && mine.reach) {
      const p = getPlayer();
      if (p) {
        const a = toMap(p.x - mine.reach, p.z - mine.reach), b = toMap(p.x + mine.reach, p.z + mine.reach);
        const [x0, y0] = toCanvas(a.x, a.y), [x1, y1] = toCanvas(b.x, b.y);
        ctx.setLineDash([6, 4]); ctx.strokeStyle = 'rgba(159, 212, 255, 0.9)'; ctx.lineWidth = 2;
        ctx.strokeRect(x0, y0, x1 - x0, y1 - y0); ctx.setLineDash([]);
      }
    }
    for (const p of mine.chosen?.() || []) {
      const a = toMap(p.ix * PLOT, p.iz * PLOT), b = toMap((p.ix + 1) * PLOT, (p.iz + 1) * PLOT);
      const [x0, y0] = toCanvas(a.x, a.y), [x1, y1] = toCanvas(b.x, b.y);
      const w = Math.max(4, x1 - x0), h = Math.max(4, y1 - y0);
      ctx.fillStyle = 'rgba(80, 170, 255, 0.55)'; ctx.strokeStyle = '#9fd4ff'; ctx.lineWidth = 1.5;
      ctx.fillRect(x0, y0, w, h); ctx.strokeRect(x0, y0, w, h);
    }
    for (const p of mine.others || []) {
      const a = toMap(p.ix * PLOT, p.iz * PLOT), b = toMap((p.ix + 1) * PLOT, (p.iz + 1) * PLOT);
      const [x0, y0] = toCanvas(a.x, a.y), [x1, y1] = toCanvas(b.x, b.y);
      if (x1 - x0 < 2) continue;
      ctx.fillStyle = 'rgba(200, 60, 50, 0.45)'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    // your territory, in gold: land plots (never smaller than a dot) and the caves you own
    for (const p of mine.plots) {
      const a = toMap(p.ix * PLOT, p.iz * PLOT), b = toMap((p.ix + 1) * PLOT, (p.iz + 1) * PLOT);
      const [x0, y0] = toCanvas(a.x, a.y), [x1, y1] = toCanvas(b.x, b.y);
      const w = Math.max(6, x1 - x0), h = Math.max(6, y1 - y0);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      ctx.fillStyle = 'rgba(232, 178, 40, 0.55)'; ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 2;
      ctx.fillRect(cx - w / 2, cy - h / 2, w, h); ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
    }
    ctx.font = '600 14px Cinzel, Georgia, serif'; ctx.textAlign = 'center';
    for (const c of mine.caves) {
      const q = toMap(c.x, c.z);
      const [x, y] = toCanvas(q.x, q.y);
      ctx.fillStyle = '#ffd76a'; ctx.strokeStyle = '#3a2a08'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 9, y + 6); ctx.lineTo(x, y - 9); ctx.lineTo(x + 9, y + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)'; ctx.strokeText(c.name, x, y - 14);
      ctx.fillStyle = '#ffd76a'; ctx.fillText(c.name, x, y - 14);
    }
    ctx.restore();
    // portals: on a portal's map, the ones you can go to glow and carry their names
    ctx.save();
    ctx.font = '600 13px Cinzel, Georgia, serif'; ctx.textAlign = 'center';
    for (const pt of portals) {
      const q = toMap(pt.x, pt.z);
      const [x, y] = toCanvas(q.x, q.y);
      if (x < -60 || y < -30 || x > W + 60 || y > H + 30) continue;
      const open = !travel || reachable.includes(pt), here = travel && pt === travel.from, chosen = travel && pt === travel.to;
      if (travel && !open && !here) { ctx.globalAlpha = 0.25; }
      const shut = open && !here && locked(pt);
      ctx.strokeStyle = chosen ? '#fff' : here ? '#ffd76a' : shut ? '#d0605a' : '#b98cff'; ctx.lineWidth = chosen || here ? 3.5 : 2.5;
      ctx.fillStyle = shut ? 'rgba(90, 20, 20, 0.6)' : 'rgba(60, 20, 120, 0.6)';
      ctx.beginPath(); ctx.arc(x, y, travel ? 7 : 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if ((travel && (open || here)) || view.zoom >= 4) {
        const label = here ? 'You are here' : shut ? (travel.shut?.(pt) ? '🔒 Private' : `🔒 Lv ${lvOf.get(pt)}`) : pt.name.replace(/ Portal$/, '');
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)'; ctx.strokeText(label, x, y - 11);
        ctx.fillStyle = chosen ? '#fff' : here ? '#ffd76a' : shut ? '#ffb0a8' : '#e2d2ff'; ctx.fillText(label, x, y - 11);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // the Monster Kings' castles
    ctx.save();
    ctx.font = '700 14px Cinzel, Georgia, serif'; ctx.textAlign = 'center';
    for (const c of allCastles()) {
      const q = toMap(c.x, c.z);
      const [x, y] = toCanvas(q.x, q.y);
      ctx.fillStyle = '#3a2a4a'; ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 9, y + 7); ctx.lineTo(x - 9, y - 5); ctx.lineTo(x - 5, y - 1); ctx.lineTo(x, y - 9); ctx.lineTo(x + 5, y - 1); ctx.lineTo(x + 9, y - 5); ctx.lineTo(x + 9, y + 7); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)'; ctx.strokeText(c.castle, x, y - 14);
      ctx.fillStyle = '#ffd76a'; ctx.fillText(c.castle, x, y - 14);
    }
    ctx.restore();
    // the wonders of the realm: a star and the wonder's name
    ctx.save();
    ctx.font = 'italic 600 13px Cinzel, Georgia, serif'; ctx.textAlign = 'center';
    for (const w of allWonders()) {
      const q = toMap(w.x, w.z);
      const [x, y] = toCanvas(q.x, q.y);
      ctx.fillStyle = '#bfe8ff'; ctx.strokeStyle = '#123'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 3.5 : 8; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)'; ctx.strokeText(w.name, x, y + 22);
      ctx.fillStyle = '#bfe8ff'; ctx.fillText(w.name, x, y + 22);
    }
    ctx.restore();
    for (const m of marks) { const q = toMap(m.x, m.z); diamond(ctx, ...toCanvas(q.x, q.y), m.label); }
    if (pins) for (const m of pins.list()) { const q = toMap(m.x, m.z); drawPin(ctx, ...toCanvas(q.x, q.y), m.colour, m.name, 1, m.id === picked); }
    if (pals && mapShowsFriends()) for (const f of pals.spots()) { const q = toMap(f.x, f.z); drawFriend(ctx, ...toCanvas(q.x, q.y), f); }
    if (me) drawMe(ctx, ...toCanvas(me.x, me.y), p.heading, 11, t);

    // a scale bar for the current zoom
    const mPerPx = METRES_PER_PX / view.zoom;
    const metres = niceMetres(200 * mPerPx);
    const len = metres / mPerPx;
    ctx.save();
    ctx.fillStyle = 'rgba(8, 6, 3, 0.72)'; ctx.fillRect(16, H - 58, len + 32, 42);
    ctx.fillStyle = '#f5ebd0'; ctx.fillRect(32, H - 30, len, 5);
    ctx.fillStyle = '#c8921a'; ctx.fillRect(32, H - 30, len / 2, 5);
    ctx.font = '600 16px Cinzel, Georgia, serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#f5ebd0';
    ctx.fillText(distText(metres), 32, H - 38);
    ctx.restore();

    // stop once the window is closed
    if (cv.isConnected && cv.offsetParent) requestAnimationFrame(frame);
    else saveView();
  }

  // zoom keeping the map point under (px, py) on the canvas still
  const zoomAt = (factor, px = W / 2, py = H / 2) => {
    if (view.follow) { px = W / 2; py = H / 2; }
    const mx = view.cx + (px - W / 2) / view.zoom, my = view.cy + (py - H / 2) / view.zoom;
    view.zoom = Math.min(MAX_ZOOM, Math.max(1, view.zoom * factor));
    view.cx = mx - (px - W / 2) / view.zoom;
    view.cy = my - (py - H / 2) / view.zoom;
    saveView();
  };
  const pointer = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  cv.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, ...pointer(e)); }, { passive: false });
  const touches = new Map();
  let pinch = 0;
  let tap = null; // where a press started, to tell a tap from a drag
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); touches.set(e.pointerId, pointer(e)); tap = touches.size === 1 ? pointer(e) : null; });
  cv.addEventListener('pointermove', (e) => {
    if (!touches.has(e.pointerId)) return;
    const [x, y] = pointer(e);
    const [ox, oy] = touches.get(e.pointerId);
    touches.set(e.pointerId, [x, y]);
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) zoomAt(d / pinch, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      pinch = d;
    } else if (x !== ox || y !== oy) {
      view.follow = false; // dragging lets you look around; ◎ follows you again
      view.cx -= (x - ox) / view.zoom;
      view.cy -= (y - oy) / view.zoom;
    }
  });
  const lift = (e) => {
    // on a portal's map, a tap picks the nearest portal you can go to
    if (travel && tap && e.type === 'pointerup' && touches.size === 1) {
      const [x, y] = pointer(e);
      if (Math.hypot(x - tap[0], y - tap[1]) < 6) {
        let best = null, bd = 26;
        for (const pt of reachable) { const q = toMap(pt.x, pt.z); const [px, py] = toCanvas(q.x, q.y); const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = pt; } }
        if (best) { travel.to = best; travel.onPick(best); }
      }
    }
    // a tap on the map with the land grid open picks the plot there
    if (pick && tap && e.type === 'pointerup' && touches.size === 1) {
      const [x, y] = pointer(e);
      if (Math.hypot(x - tap[0], y - tap[1]) < 6) {
        const w = toWorld(view.cx + (x - W / 2) / view.zoom, view.cy + (y - H / 2) / view.zoom);
        if ((PLOT / METRES_PER_PX) * view.zoom >= 8) pick(w.x, w.z);
        else zoomAt(4, x, y); // too small to tap a square: zoom in on it first
      }
    }
    // your own marks: a tap on one opens it (rename, colour, remove); with 📍 on, a tap puts one down
    let used = false;
    if (pins && tap && e.type === 'pointerup' && touches.size === 1) {
      const [x, y] = pointer(e);
      if (Math.hypot(x - tap[0], y - tap[1]) < 6) {
        let best = null, bd = 18;
        for (const m of pins.list()) { const q = toMap(m.x, m.z); const [px, py] = toCanvas(q.x, q.y); const d = Math.hypot(px - x, py + 12 - y); if (d < bd) { bd = d; best = m; } }
        if (best && !marking) { picked = best.id; used = true; drawPinEdit(); }
        else if (marking) {
          used = true;
          const w = toWorld(view.cx + (x - W / 2) / view.zoom, view.cy + (y - H / 2) / view.zoom);
          const list = pins.list();
          if (list.length >= MAX_MAP_MARKS) note(`You already have ${MAX_MAP_MARKS} marks. Remove one first.`);
          else {
            const m = { id: Math.random().toString(36).slice(2, 10), x: Math.round(w.x * 10) / 10, z: Math.round(w.z * 10) / 10, name: `Mark ${list.length + 1}`, colour: MARK_COLOURS[list.length % MARK_COLOURS.length] };
            pins.save([...list, m]);
            picked = m.id;
            setMarking(false);
            drawPinEdit(true);
            drawLists();
          }
        } else if (picked) { picked = null; drawPinEdit(); }
      }
    }
    // an admin's Teleport power: a tap anywhere goes there
    if (warp && !used && !pick && !travel && tap && e.type === 'pointerup' && touches.size === 1) {
      const [x, y] = pointer(e);
      if (Math.hypot(x - tap[0], y - tap[1]) < 6) {
        const w = toWorld(view.cx + (x - W / 2) / view.zoom, view.cy + (y - H / 2) / view.zoom);
        warp(w.x, w.z);
      }
    }
    tap = null;
    touches.delete(e.pointerId); pinch = 0; saveView();
  };
  cv.addEventListener('pointerup', lift);
  cv.addEventListener('pointercancel', lift);
  el.querySelector('.map-zoom').addEventListener('click', (e) => {
    const z = e.target.closest('[data-zoom]')?.dataset.zoom;
    const p = getPlayer();
    if (z === '1') {
      if (view.zoom === 1 && p) { const m = toMap(p.x, p.z); view.cx = m.x; view.cy = m.y; }
      zoomAt(1.8);
    } else if (z === '-1') zoomAt(1 / 1.8);
    else if (z === 'me') { view.follow = true; if (view.zoom < 12) view.zoom = 12; saveView(); }
    else if (z === '0') { view.zoom = 1; view.follow = false; saveView(); }
  });
  // ---- your marks and your friends ----
  const toolsEl = el.querySelector('.map-tools');
  const editEl = el.querySelector('.map-pin-edit');
  const listsEl = el.querySelector('.map-lists');
  const centreOn = (x, z) => { const q = toMap(x, z); view.follow = false; view.cx = q.x; view.cy = q.y; if (view.zoom < 12) view.zoom = 12; saveView(); };
  let noteText = '';
  const note = (t) => { noteText = t; drawLists(); };
  function setMarking(on) {
    marking = on;
    const b = toolsEl?.querySelector('[data-map-tool="mark"]');
    if (b) { b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '📍 Tap the map…' : '📍 Mark a place'; }
    cv.classList.toggle('marking', on);
  }
  function drawPinEdit(focus = false) {
    if (!editEl) return;
    const m = pins.list().find((q) => q.id === picked);
    editEl.hidden = !m;
    if (!m) { editEl.innerHTML = ''; return; }
    editEl.innerHTML = `
      <input type="text" maxlength="${MARK_NAME}" value="${esc(m.name)}" aria-label="Name of this mark" data-pin-name>
      <span class="map-pin-colours" role="radiogroup" aria-label="Colour">${MARK_COLOURS.map((c) => `<button type="button" role="radio" aria-checked="${c === m.colour}" data-pin-colour="${c}" style="background:${c}" aria-label="Colour"></button>`).join('')}</span>
      <button type="button" data-pin-act="remove">Remove</button>
      <button type="button" data-pin-act="done">Done</button>`;
    if (focus) { const i = editEl.querySelector('input'); i.focus(); i.select(); }
  }
  const change = (id, fn) => pins.save(pins.list().map((q) => (q.id === id ? { ...q, ...fn(q) } : q)));
  function drawLists() {
    if (!listsEl) return;
    const list = pins ? pins.list() : [];
    const spots = pals && mapShowsFriends() ? pals.spots() : [];
    listsEl.innerHTML = `
      ${noteText ? `<p class="map-tools-note">${esc(noteText)}</p>` : ''}
      ${pins ? `<details class="map-list" ${list.length ? '' : 'open'}><summary>Your marks (${list.length}/${MAX_MAP_MARKS})</summary>
        ${list.length ? `<ul>${list.map((m) => `<li><i style="background:${m.colour}"></i><button type="button" class="map-link" data-pin-go="${m.id}">${esc(m.name)}</button><button type="button" class="map-x" data-pin-del="${m.id}" aria-label="Remove ${esc(m.name)}">×</button></li>`).join('')}</ul>`
        : '<p>Press 📍 Mark a place, then tap anywhere on the map. Only you can see your marks.</p>'}</details>` : ''}
      ${pals && mapShowsFriends() ? `<details class="map-list"><summary>Friends on the map (${spots.length})</summary>
        ${spots.length ? `<ul>${spots.map((f) => `<li><i class="pal"></i><button type="button" class="map-link" data-pal-go="${esc(f.name)}">${esc(f.name)}</button><small>${esc(f.where || '')}</small></li>`).join('')}</ul>`
        : '<p>None of your friends are in the game right now, or they keep where they are hidden.</p>'}</details>` : ''}`;
  }
  // the friends list changes as they move: redraw it when the names or places change
  let palsKey = '';
  if (pals) {
    const tick = setInterval(() => {
      if (!cv.isConnected) { clearInterval(tick); return; }
      const k = mapShowsFriends() ? pals.spots().map((f) => `${f.name}|${f.where}`).join(',') : 'off';
      if (k !== palsKey) { palsKey = k; const openNow = [...(listsEl?.querySelectorAll('details') || [])].map((d) => d.open); drawLists(); listsEl?.querySelectorAll('details').forEach((d, i) => { if (openNow[i] != null) d.open = openNow[i]; }); }
    }, 1000);
    if (mapShowsFriends()) pals.refresh();
  }
  toolsEl?.addEventListener('click', (e) => {
    const tool = e.target.closest('[data-map-tool]')?.dataset.mapTool;
    if (tool === 'mark') { setMarking(!marking); if (marking) { picked = null; drawPinEdit(); } }
    if (tool === 'friends') {
      view.friends = !mapShowsFriends(); saveView();
      const b = e.target.closest('button');
      b.setAttribute('aria-pressed', String(mapShowsFriends())); b.textContent = `👥 Friends: ${mapShowsFriends() ? 'ON' : 'OFF'}`;
      if (mapShowsFriends()) pals.refresh();
      drawLists();
    }
  });
  editEl?.addEventListener('input', (e) => {
    if (e.target.matches('[data-pin-name]') && picked) { const v = e.target.value.slice(0, MARK_NAME); change(picked, () => ({ name: v })); clearTimeout(editEl.t); editEl.t = setTimeout(drawLists, 300); }
  });
  editEl?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { picked = null; drawPinEdit(); drawLists(); } });
  editEl?.addEventListener('click', (e) => {
    const c = e.target.closest('[data-pin-colour]')?.dataset.pinColour;
    if (c && picked) { change(picked, () => ({ colour: c })); drawPinEdit(); drawLists(); return; }
    const act = e.target.closest('[data-pin-act]')?.dataset.pinAct;
    if (act === 'remove' && picked) { pins.save(pins.list().filter((q) => q.id !== picked)); picked = null; drawPinEdit(); drawLists(); }
    if (act === 'done') { picked = null; drawPinEdit(); drawLists(); }
  });
  listsEl?.addEventListener('click', (e) => {
    const go = e.target.closest('[data-pin-go]')?.dataset.pinGo;
    if (go) { const m = pins.list().find((q) => q.id === go); if (m) { centreOn(m.x, m.z); picked = m.id; drawPinEdit(); } return; }
    const del = e.target.closest('[data-pin-del]')?.dataset.pinDel;
    if (del) { pins.save(pins.list().filter((q) => q.id !== del)); if (picked === del) { picked = null; drawPinEdit(); } drawLists(); return; }
    const pal = e.target.closest('[data-pal-go]')?.dataset.palGo;
    if (pal) { const f = pals.spots().find((q) => q.name === pal); if (f) centreOn(f.x, f.z); }
  });
  drawLists();
  requestAnimationFrame(frame);
}

// The round minimap in the corner: the real ground about 400 m across, north at the top.
// `extra` = { pins: () => your marks, friends: () => your friends' spots (when shown) }
export function createMinimap(el, getPlayer, onOpen, extra = {}) {
  const SIZE = 180;          // canvas pixels
  const SPAN = 400;          // metres across the minimap
  el.innerHTML = `<canvas width="${SIZE}" height="${SIZE}" aria-hidden="true"></canvas><span class="mm-n">N</span>`;
  el.title = 'Open the world map (M)';
  el.addEventListener('click', onOpen);
  const cv = el.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const ground = createTerrainPainter(72, 72); // 900 m square, 12.5 m per cell
  const AREA = 900;
  let asked = null;
  const places = placesWithPositions();
  let alive = true;

  function frame(t) {
    if (!alive) return;
    const p = getPlayer();
    if (p && !el.hidden) {
      if (!asked || Math.abs(p.x - (asked.x0 + AREA / 2)) > 180 || Math.abs(p.z - (asked.z0 + AREA / 2)) > 180) {
        const cx = Math.round(p.x / 50) * 50, cz = Math.round(p.z / 50) * 50;
        asked = { x0: cx - AREA / 2, z0: cz - AREA / 2, x1: cx + AREA / 2, z1: cz + AREA / 2 };
        ground.want(asked);
      }
      ground.step(3);
      const k = SIZE / SPAN; // canvas pixels per metre
      const at = (x, z) => [SIZE / 2 + (x - p.x) * k, SIZE / 2 + (z - p.z) * k];
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.save();
      ctx.beginPath(); ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#2b3a2a'; ctx.fillRect(0, 0, SIZE, SIZE);
      ground.draw(ctx, (g) => [...at(g.x0, g.z0), (g.x1 - g.x0) * k, (g.z1 - g.z0) * k]);
      // in or near a city: its plan
      for (const pl of places) if (pl.city && Math.hypot(pl.x - p.x, pl.z - p.z) < CITY_R + SPAN / 2) drawCityPlan(ctx, pl, at, k, 1, false);
      ctx.font = '600 11px Cinzel, Georgia, serif'; ctx.textAlign = 'center';
      for (const pl of places) {
        const [x, y] = at(pl.x, pl.z);
        if (x < -40 || y < -20 || x > SIZE + 40 || y > SIZE + 20) continue;
        ctx.fillStyle = '#8a1f1a'; ctx.strokeStyle = '#fff4d8'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)'; ctx.strokeText(pl.name, x, y - 8);
        ctx.fillStyle = '#f5ebd0'; ctx.fillText(pl.name, x, y - 8);
      }
      // your marks and your friends; ones beyond the edge sit on the rim, pointing the way
      const rim = (x, z) => {
        let [cx, cy] = at(x, z);
        const dx = cx - SIZE / 2, dy = cy - SIZE / 2, d = Math.hypot(dx, dy), max = SIZE / 2 - 12;
        if (d > max) { cx = SIZE / 2 + (dx / d) * max; cy = SIZE / 2 + (dy / d) * max; }
        return [cx, cy, d > max];
      };
      for (const m of extra.pins?.() || []) { const [x, y, edge] = rim(m.x, m.z); drawPin(ctx, x, y + 7, m.colour, edge ? '' : m.name, 0.7); }
      if (mapShowsFriends()) for (const f of extra.friends?.() || []) { const [x, y, edge] = rim(f.x, f.z); drawFriend(ctx, x, y, edge ? { ...f, name: '' } : f, 0.75); }
      drawMe(ctx, SIZE / 2, SIZE / 2, p.heading, 9, t);
      ctx.restore();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { stop() { alive = false; el.innerHTML = ''; } };
}
