// An admin's Dragon radar (the "radar" power, data/staff.mjs): a round radar under the minimap, north
// up, with every dragon and wyvern near you as a dot (red: a dragon, orange: a wyvern, purple: the
// King of the Wild Dragons, grey: slain and not back yet), and the nearest ones listed under it with
// their way, how far, and whether they are alive or slain. Tap the radar to change its range.

const RANGES = [3000, 15000, 60000]; // metres from the middle to the edge
const STORE = 'ar.radar.range';
const WAYS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const way = (dx, dz) => WAYS[Math.round(((Math.atan2(dx, -dz) * 180 / Math.PI) + 360) % 360 / 45) % 8];
const far = (m) => (m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km` : `${Math.round(m)} m`);
const mins = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function createRadar(host, { read }) {
  host.insertAdjacentHTML('beforeend', `
    <div class="rd" hidden>
      <button type="button" class="rd-disc" aria-label="Dragon radar: tap to change the range"><canvas width="300" height="300"></canvas><span class="rd-range"></span></button>
      <ol class="rd-list" aria-label="Nearest dragons and wyverns"></ol>
    </div>`);
  const box = host.querySelector('.rd:last-of-type');
  const canvas = box.querySelector('canvas'), ctx = canvas.getContext('2d');
  const rangeEl = box.querySelector('.rd-range'), list = box.querySelector('.rd-list');
  let range = 1;
  try { range = Math.min(RANGES.length - 1, Math.max(0, Number(localStorage.getItem(STORE)) || 1)); } catch { /* blocked */ }
  box.querySelector('.rd-disc').addEventListener('click', () => {
    range = (range + 1) % RANGES.length;
    try { localStorage.setItem(STORE, String(range)); } catch { /* blocked */ }
    draw();
  });

  let timer = null;
  function draw() {
    const r = read();
    if (!r) return;
    const W = canvas.width, R = W / 2 - 6, span = RANGES[range];
    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.translate(W / 2, W / 2);
    // the disc, its rings and the cross
    ctx.fillStyle = 'rgba(6, 18, 10, 0.82)';
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(90, 224, 138, 0.35)'; ctx.lineWidth = 2;
    for (const k of [1 / 3, 2 / 3, 1]) { ctx.beginPath(); ctx.arc(0, 0, R * k, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-R, 0); ctx.lineTo(R, 0); ctx.moveTo(0, -R); ctx.lineTo(0, R); ctx.stroke();
    ctx.fillStyle = '#5fe08a'; ctx.font = '700 22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('N', 0, -R + 4);
    // the way you face
    ctx.save();
    ctx.rotate(-r.yaw); // (the camera looks along (-sin yaw, -cos yaw), and up on the disc is north, -z)
    ctx.fillStyle = 'rgba(95, 224, 138, 0.18)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, -Math.PI / 2 - 0.4, -Math.PI / 2 + 0.4); ctx.closePath(); ctx.fill();
    ctx.restore();
    // the beasts (those past the edge sit on the rim, pointing the way)
    for (const b of r.beasts) {
      const dx = b.x - r.x, dz = b.z - r.z;
      const d = Math.hypot(dx, dz);
      const k = Math.min(1, d / span) * R;
      const px = d ? (dx / d) * k : 0, py = d ? (dz / d) * k : 0;
      const gone = b.backIn > 0;
      ctx.fillStyle = gone ? '#7a7a7a' : b.king ? '#c070ff' : b.wyvern ? '#ffa030' : '#ff4a3a';
      ctx.globalAlpha = d > span ? 0.45 : 1;
      ctx.beginPath(); ctx.arc(px, py, b.king || b.boss ? 9 : 6, 0, Math.PI * 2); ctx.fill();
      if (b.seen && !gone) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    // you
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    rangeEl.textContent = far(span);
    // the nearest five
    list.innerHTML = r.beasts.slice(0, 5).map((b) => {
      const state = b.backIn > 0 ? `slain, back in ${mins(b.backIn)}` : b.seen ? `here${b.air > 3 ? `, flying ${b.air} m up` : ''}${b.hp != null && b.hp < 100 ? `, ${b.hp}% HP` : ''}` : 'at its lair';
      return `<li class="${b.backIn > 0 ? 'gone' : b.king ? 'king' : b.wyvern ? 'wyv' : 'drg'}"><b>${b.name}</b><span>${way(b.x - r.x, b.z - r.z)} · ${far(b.dist)}</span><small>${state}</small></li>`;
    }).join('');
  }
  return {
    show(on) {
      box.hidden = !on;
      clearInterval(timer);
      if (on) { draw(); timer = setInterval(draw, 500); }
    },
  };
}
