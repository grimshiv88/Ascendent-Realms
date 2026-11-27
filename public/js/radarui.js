// An admin's Dragon radar (the "radar" power, data/staff.mjs): a round radar on the right, under the
// minimap (and under the ☰ menu's list while that is open), north up, with every dragon and wyvern
// near you as a dot (red: a dragon, orange: a wyvern, purple: the King of the Wild Dragons, blue: the
// Spirit King of the lake, grey: slain and not back yet), and the nearest ones listed under it with
// their way, how far, and whether they are alive or slain.
// The chips under it choose what it shows (saved in this browser); the big radar can also look for a
// name.
// Tap the radar to open it big: zoom with the mouse wheel, a pinch or the + and − buttons, drag to
// look around, ◎ to come back to yourself; close it with ✕ or Esc.

const SMALL_SPAN = 15000; // the small radar: metres from the middle to the edge
const MIN_SPAN = 200, MAX_SPAN = 150000; // how far the big radar zooms in and out
const STORE = 'ar.radar.span', SHOW_STORE = 'ar.radar.show';
// what the radar can show, each with its own chip: [kind, chip name, colour]
const KINDS = [['drg', 'Dragons', '#ff4a3a'], ['wyv', 'Wyverns', '#ffa030'], ['king', 'Dragon King', '#c070ff'], ['spirit', 'Spirit King', '#40c8ff'], ['gone', 'Slain', '#7a7a7a']];
const kindOf = (b) => (b.king ? 'king' : b.spirit ? 'spirit' : b.wyvern ? 'wyv' : 'drg');
const WAYS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const way = (dx, dz) => WAYS[Math.round(((Math.atan2(dx, -dz) * 180 / Math.PI) + 360) % 360 / 45) % 8];
const far = (m) => (m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km` : `${Math.round(m)} m`);
const mins = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const cls = (b) => (b.backIn > 0 ? 'gone' : kindOf(b));
const colour = (b) => KINDS.find(([k]) => k === cls(b))[2];
const state = (b) => (b.backIn > 0 ? `slain, back in ${mins(b.backIn)}`
  : b.seen ? `${b.spirit ? 'risen from the lake' : 'here'}${b.air > 3 ? `, flying ${b.air} m up` : ''}${b.hp != null && b.hp < 100 ? `, ${b.hp}% HP` : ''}` : b.spirit ? 'resting under the lake' : 'at its lair');
const chips = (show) => KINDS.map(([k, name, c]) => `<button type="button" class="rd-chip" data-rd-kind="${k}" aria-pressed="${show[k] !== false}"><i style="background:${c}"></i>${name}</button>`).join('');
const row = (b, r) => `<li class="${cls(b)}"><b>${b.name}</b><span>${way(b.x - r.x, b.z - r.z)} · ${far(b.dist)}</span><small>${state(b)}</small></li>`;

// One radar picture. `span`: metres from the middle to the edge; (ox, oz): how far the middle is from
// you (looking around on the big radar); `big`: names beside the dots and distances on the rings.
function drawDisc(ctx, W, r, { span, ox = 0, oz = 0, big = false }) {
  const R = W / 2 - 6, s = W / 300; // (s: sizes grow with the canvas)
  const mx = r.x + ox, mz = r.z + oz; // the middle, in the world
  const toPx = (x, z) => [((x - mx) / span) * R, ((z - mz) / span) * R];
  ctx.clearRect(0, 0, W, W);
  ctx.save();
  ctx.translate(W / 2, W / 2);
  ctx.fillStyle = 'rgba(6, 18, 10, 0.86)';
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.clip();
  // the rings and the cross
  ctx.strokeStyle = 'rgba(90, 224, 138, 0.35)'; ctx.lineWidth = 2 * s;
  for (const k of [1 / 3, 2 / 3, 1]) { ctx.beginPath(); ctx.arc(0, 0, R * k, 0, Math.PI * 2); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-R, 0); ctx.lineTo(R, 0); ctx.moveTo(0, -R); ctx.lineTo(0, R); ctx.stroke();
  if (big) {
    ctx.fillStyle = 'rgba(95, 224, 138, 0.75)'; ctx.font = `${11 * s}px sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    for (const k of [1 / 3, 2 / 3]) ctx.fillText(far(span * k), 4 * s, -R * k - 2 * s);
  }
  // you, and the way you face (the camera looks along (-sin yaw, -cos yaw); up is north, -z)
  const [yx, yy] = toPx(r.x, r.z);
  ctx.save();
  ctx.translate(yx, yy);
  ctx.rotate(-r.yaw);
  ctx.fillStyle = 'rgba(95, 224, 138, 0.18)';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, -Math.PI / 2 - 0.4, -Math.PI / 2 + 0.4); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  // the beasts (those past the edge sit on the rim, pointing the way)
  const placed = [];
  for (const b of r.beasts) {
    let [px, py] = toPx(b.x, b.z);
    const d = Math.hypot(px, py), out = d > R;
    if (out) { px = (px / d) * R; py = (py / d) * R; }
    ctx.fillStyle = colour(b);
    ctx.globalAlpha = out ? 0.45 : 1;
    ctx.beginPath(); ctx.arc(px, py, (b.king || b.boss ? 9 : 6) * s * (big ? 0.7 : 1), 0, Math.PI * 2); ctx.fill();
    if (b.seen && b.backIn <= 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * s * (big ? 0.6 : 1); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // on the big radar: its name beside it (unless another name is already there)
    if (big && !out && !placed.some(([qx, qy]) => Math.abs(qx - px) < 90 * s && Math.abs(qy - py) < 13 * s)) {
      placed.push([px, py]);
      ctx.font = `600 ${11 * s}px Georgia, serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3 * s; ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      const label = `${b.name} · ${far(b.dist)}`;
      ctx.strokeText(label, px + 9 * s, py); ctx.fillText(label, px + 9 * s, py);
    }
  }
  // you
  if (Math.hypot(yx, yy) <= R) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(yx, yy, 4 * s * (big ? 0.8 : 1), 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#5fe08a'; ctx.font = `700 ${22 * s * (big ? 0.6 : 1)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('N', 0, -R + 4 * s);
  ctx.restore();
}

export function createRadar(host, { read, onOpen }) {
  host.insertAdjacentHTML('beforeend', `
    <div class="rd" hidden>
      <button type="button" class="rd-disc" aria-label="Dragon radar: tap to open it big"><canvas width="300" height="300"></canvas><span class="rd-range"></span></button>
      <div class="rd-chips" role="group" aria-label="What the radar shows"></div>
      <ol class="rd-list" aria-label="Nearest dragons and wyverns"></ol>
    </div>
    <div class="rd-big" role="dialog" aria-label="Dragon radar" hidden>
      <div class="rd-big-box">
        <div class="rd-big-head"><b>Dragon radar</b><span class="rd-big-range"></span><button type="button" class="rd-close" aria-label="Close">✕</button></div>
        <div class="rd-big-body">
          <div class="rd-stage"><canvas></canvas>
            <div class="rd-zoom"><button type="button" data-z="in" aria-label="Zoom in">+</button><button type="button" data-z="out" aria-label="Zoom out">−</button><button type="button" data-z="me" aria-label="Back to me">◎</button></div>
          </div>
          <div class="rd-side"><p class="rd-hint">Scroll or pinch to zoom, drag to look around.</p>
            <div class="rd-chips" role="group" aria-label="What the radar shows"></div>
            <input type="search" class="rd-find" placeholder="Look for a name…" aria-label="Look for a name">
            <ol class="rd-list rd-all" aria-label="Dragons and wyverns, nearest first"></ol></div>
        </div>
      </div>
    </div>`);
  const last = (sel) => [...host.querySelectorAll(sel)].pop();
  const box = last('.rd'), big = last('.rd-big');
  const canvas = box.querySelector('canvas'), ctx = canvas.getContext('2d');
  const rangeEl = box.querySelector('.rd-range'), list = box.querySelector('.rd-list');
  const bigCanvas = big.querySelector('canvas'), bctx = bigCanvas.getContext('2d');
  const bigRange = big.querySelector('.rd-big-range'), bigList = big.querySelector('.rd-all');
  const findEl = big.querySelector('.rd-find');

  // what to show: each kind on or off (all on at first), and a name to look for on the big radar
  let show = {};
  try { show = JSON.parse(localStorage.getItem(SHOW_STORE) || '{}') || {}; } catch { show = {}; }
  const paintChips = () => { for (const el of [box, big]) el.querySelector('.rd-chips').innerHTML = chips(show); };
  paintChips();
  const shown = (b, find = '') => show[kindOf(b)] !== false && (b.backIn <= 0 || show.gone !== false) && (!find || b.name.toLowerCase().includes(find));
  const pick = (r, find) => ({ ...r, beasts: r.beasts.filter((b) => shown(b, find)) });
  for (const el of [box, big]) el.querySelector('.rd-chips').addEventListener('click', (e) => {
    const k = e.target.closest('[data-rd-kind]')?.dataset.rdKind;
    if (!k) return;
    show[k] = show[k] === false;
    try { localStorage.setItem(SHOW_STORE, JSON.stringify(show)); } catch { /* blocked */ }
    paintChips(); draw();
  });
  findEl.addEventListener('input', () => draw());
  findEl.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); }); // (typing a name doesn't walk)

  // Sit under whatever is above it on the right: the minimap, the "online" button and, while it is
  // open, the ☰ menu's list (so it never covers those buttons)
  function place() {
    if (box.hidden) return;
    const top0 = host.getBoundingClientRect().top;
    let low = 0;
    for (const el of document.querySelectorAll('#minimap, #online-now, #hud .hud-buttons:not(.hidden)')) {
      const b = el.getBoundingClientRect();
      if (b.height && b.right > innerWidth - 220) low = Math.max(low, b.bottom - top0);
    }
    const top = `${Math.round(low + 8)}px`;
    if (box.style.top !== top) box.style.top = top;
  }
  document.addEventListener('click', () => requestAnimationFrame(place));
  addEventListener('resize', place);

  // the big radar's view: how far it reaches, and where its middle is (from you)
  const view = { span: SMALL_SPAN, ox: 0, oz: 0 };
  try { const v = Number(localStorage.getItem(STORE)); if (v >= MIN_SPAN && v <= MAX_SPAN) view.span = v; } catch { /* blocked */ }
  const keepSpan = () => { try { localStorage.setItem(STORE, String(Math.round(view.span))); } catch { /* blocked */ } };

  let timer = null, isOn = false;
  function drawSmall(r) {
    place();
    r = pick(r);
    drawDisc(ctx, canvas.width, r, { span: SMALL_SPAN });
    rangeEl.textContent = far(SMALL_SPAN);
    list.innerHTML = r.beasts.slice(0, 5).map((b) => row(b, r)).join('') || '<li class="rd-none">Nothing to show</li>';
  }
  function drawBig(r) {
    r = pick(r, findEl.value.trim().toLowerCase());
    const size = Math.round(bigCanvas.clientWidth * (window.devicePixelRatio || 1));
    if (size && bigCanvas.width !== size) { bigCanvas.width = size; bigCanvas.height = size; }
    drawDisc(bctx, bigCanvas.width, r, { span: view.span, ox: view.ox, oz: view.oz, big: true });
    bigRange.textContent = `edge ${far(view.span)}${Math.hypot(view.ox, view.oz) > view.span * 0.05 ? ' · looking around (◎ to come back)' : ''}`;
    bigList.innerHTML = r.beasts.slice(0, 25).map((b) => row(b, r)).join('') || '<li class="rd-none">Nothing to show: turn a chip on, or look for another name.</li>';
  }
  function draw() {
    const r = read();
    if (!r) return;
    if (!box.hidden) drawSmall(r);
    if (!big.hidden) drawBig(r);
  }

  // ---------- the big radar ----------
  function open(v) {
    big.hidden = !v;
    if (v) { view.ox = 0; view.oz = 0; onOpen?.(); requestAnimationFrame(draw); } // (once it has a size)
  }
  box.querySelector('.rd-disc').addEventListener('click', () => open(true));
  big.querySelector('.rd-close').addEventListener('click', () => open(false));
  big.addEventListener('click', (e) => { if (e.target === big) open(false); }); // (a tap outside the box)
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !big.hidden) { e.stopPropagation(); open(false); } }, true);
  // zoom by `k` (above 1: zoom out) keeping the world under (cx, cy) (canvas pixels from the middle) still
  function zoom(k, cx = 0, cy = 0) {
    const R = bigCanvas.clientWidth / 2 - 3;
    const before = view.span;
    view.span = Math.min(MAX_SPAN, Math.max(MIN_SPAN, view.span * k));
    const f = (view.span - before) / R;
    view.ox -= cx * f; view.oz -= cy * f;
    keepSpan();
    draw();
  }
  big.querySelector('.rd-zoom').addEventListener('click', (e) => {
    const z = e.target.closest('[data-z]')?.dataset.z;
    if (z === 'in') zoom(1 / 1.5); else if (z === 'out') zoom(1.5);
    else if (z === 'me') { view.ox = 0; view.oz = 0; draw(); }
  });
  const stage = big.querySelector('.rd-stage');
  const fromMiddle = (e) => { const b = bigCanvas.getBoundingClientRect(); return [e.clientX - b.left - b.width / 2, e.clientY - b.top - b.height / 2]; };
  bigCanvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom(Math.exp(e.deltaY * 0.0015), ...fromMiddle(e)); }, { passive: false });
  // drag to look around; two fingers pinch to zoom
  const touches = new Map();
  let pinch = 0;
  bigCanvas.addEventListener('pointerdown', (e) => { bigCanvas.setPointerCapture(e.pointerId); touches.set(e.pointerId, [e.clientX, e.clientY]); pinch = 0; });
  bigCanvas.addEventListener('pointermove', (e) => {
    const was = touches.get(e.pointerId);
    if (!was) return;
    touches.set(e.pointerId, [e.clientX, e.clientY]);
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) { const r = bigCanvas.getBoundingClientRect(); zoom(pinch / d, (a[0] + b[0]) / 2 - r.left - r.width / 2, (a[1] + b[1]) / 2 - r.top - r.height / 2); }
      pinch = d;
    } else if (touches.size === 1) {
      const m = view.span / (bigCanvas.clientWidth / 2 - 3); // metres per pixel
      view.ox -= (e.clientX - was[0]) * m; view.oz -= (e.clientY - was[1]) * m;
      draw();
    }
  });
  const lift = (e) => { touches.delete(e.pointerId); pinch = 0; };
  for (const ev of ['pointerup', 'pointercancel']) bigCanvas.addEventListener(ev, lift);
  stage.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    show(on) {
      isOn = on;
      box.hidden = !on;
      if (!on) open(false);
      clearInterval(timer);
      if (on) { draw(); timer = setInterval(draw, 500); }
    },
    get open() { return isOn && !big.hidden; },
  };
}
