// Draws the world map onto a canvas (1600 × 1000). Used by the map page and the in-game map.
import { REGIONS, PLACES, RIVERS, LAKE, LAKES, SECTIONS, METRES_PER_PX, sectionAt, noise1, toMap } from '../data/world-layout.mjs';

let cache = null;

// Draws the map once and keeps it; `player` ({x, z, heading} in world metres) adds a marker.
// `marks` ([{x, z, label}]) adds quest targets as glowing blue diamonds.
export function drawWorldMap(cv, { player = null, marks = [] } = {}) {
  const ctx = cv.getContext('2d');
  if (!cache) {
    // painted at twice the size so the map stays sharp when zoomed in
    cache = document.createElement('canvas');
    cache.width = 3200;
    cache.height = 2000;
    const c2 = cache.getContext('2d');
    c2.scale(2, 2);
    paint(c2, 1600, 1000);
  }
  ctx.drawImage(cache, 0, 0, cv.width, cv.height);
  for (const m of marks) {
    const p = toMap(m.x, m.z);
    const x = p.x * cv.width / 1600, y = p.y * cv.height / 1000;
    ctx.save();
    ctx.shadowColor = '#3d9bff'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#9fd4ff'; ctx.strokeStyle = '#0a1a33'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 11); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 11); ctx.lineTo(x - 8, y); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = 'bold 15px Cinzel, Georgia, serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)'; ctx.strokeText(m.label, x, y - 16);
    ctx.fillStyle = '#e6f3ff'; ctx.fillText(m.label, x, y - 16);
    ctx.restore();
  }
  if (player) {
    const p = toMap(player.x, player.z);
    const sx = cv.width / 1600, sy = cv.height / 1000;
    ctx.save();
    ctx.translate(p.x * sx, p.y * sy);
    ctx.rotate(Math.PI - (player.heading || 0));
    ctx.fillStyle = '#c0261c'; ctx.strokeStyle = '#fff4d8'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(9, 10); ctx.lineTo(0, 5); ctx.lineTo(-9, 10); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

function paint(ctx, W, H) {

  // --- small seeded helpers ---
  function rng(seed) { let s = seed * 9301 + 49297; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
  function blobPath(x, y, r, seed, stretch = [1, 1], wobble = 0.22) {
    const pts = [];
    for (let i = 0; i < 180; i++) {
      const a = (i / 180) * Math.PI * 2;
      const rr = r * (1 + noise1(a, seed) * wobble);
      pts.push([x + Math.cos(a) * rr * stretch[0], y + Math.sin(a) * rr * stretch[1]]);
    }
    return pts;
  }
  function trace(pts) { ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); }
  function inside(pts, x, y) {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }

  // --- sea ---
  const sea = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.7);
  sea.addColorStop(0, '#9fc2c4'); sea.addColorStop(1, '#5f8a92');
  ctx.fillStyle = sea; ctx.fillRect(0, 0, W, H);
  const R = rng(99);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 140; i++) { // wave marks
    const x = R() * W, y = R() * H;
    ctx.beginPath(); ctx.arc(x, y, 6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  }

  // --- land ---
  const shapes = {};
  for (const reg of REGIONS) {
    const list = reg.islands ? reg.islands.map(([x, y, r, s]) => blobPath(x, y, r, s, [1.2, 0.9], 0.28)) : [blobPath(reg.land.x, reg.land.y, reg.land.r, reg.land.seed, reg.land.stretch)];
    shapes[reg.id] = list;
    for (const pts of list) {
      // shallow-water halo
      ctx.save(); trace(pts); ctx.lineWidth = 26; ctx.strokeStyle = 'rgba(200,230,225,0.35)'; ctx.stroke(); ctx.restore();
    }
  }
  const landColor = { heart: '#d9c99a', peaks: '#cdb894', warrens: '#d6b98a', fae: '#d4d0a0', mire: '#c9c495', frost: '#e6e8ea', sun: '#e3c88e' };
  for (const reg of REGIONS) {
    for (const pts of shapes[reg.id]) {
      trace(pts);
      ctx.fillStyle = landColor[reg.id]; ctx.fill();
      ctx.lineWidth = 2.4; ctx.strokeStyle = '#4a3418'; ctx.stroke();
    }
  }

  // --- symbols ---
  function tree(x, y, s, col = '#4f6b2f') {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - 9 * s); ctx.lineTo(x + 5 * s, y + 3 * s); ctx.lineTo(x - 5 * s, y + 3 * s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3b2a17'; ctx.lineWidth = 0.8; ctx.stroke();
  }
  function mountain(x, y, s, snow) {
    ctx.fillStyle = '#a89676'; ctx.beginPath(); ctx.moveTo(x - 13 * s, y + 6 * s); ctx.lineTo(x, y - 14 * s); ctx.lineTo(x + 13 * s, y + 6 * s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3b2a17'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = 'rgba(60,40,20,0.35)'; ctx.beginPath(); ctx.moveTo(x, y - 14 * s); ctx.lineTo(x + 13 * s, y + 6 * s); ctx.lineTo(x + 2 * s, y + 6 * s); ctx.closePath(); ctx.fill();
    if (snow) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x, y - 14 * s); ctx.lineTo(x + 4 * s, y - 8 * s); ctx.lineTo(x - 4 * s, y - 8 * s); ctx.closePath(); ctx.fill(); }
  }
  function volcano(x, y, s) { mountain(x, y, s * 1.3, false); ctx.fillStyle = '#d9481a'; ctx.beginPath(); ctx.arc(x, y - 17 * s, 3 * s, 0, Math.PI * 2); ctx.fill(); }
  function tuft(x, y) { ctx.strokeStyle = '#5a6b3a'; ctx.lineWidth = 1; for (const d of [-3, 0, 3]) { ctx.beginPath(); ctx.moveTo(x + d, y); ctx.lineTo(x + d * 1.6, y - 6); ctx.stroke(); } }
  function dot(x, y, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill(); }
  function scatter(id, count, seed, fn, test = () => true) {
    const r = rng(seed);
    const pts = shapes[id][0];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    let n = 0, tries = 0;
    while (n < count && tries++ < count * 30) {
      const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0);
      if (!inside(pts, x, y)) continue;
      // keep away from the coast
      if (!inside(pts, x + 14, y) || !inside(pts, x - 14, y) || !inside(pts, x, y + 14) || !inside(pts, x, y - 14)) continue;
      if (!test(x, y)) continue;
      fn(x, y, r); n++;
    }
  }

  // Heartland: each section drawn in its own kind of land
  // rivers stop at the coast
  ctx.save(); ctx.beginPath();
  for (const id of ['heart', 'sun']) for (const pts of shapes[id]) pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.clip();
  ctx.strokeStyle = '#4f86a0';
  RIVERS.forEach(([p0, p1, p2, p3], i) => {
    ctx.lineWidth = i === 0 ? 2.5 : 3.5; ctx.beginPath(); ctx.moveTo(...p0); ctx.bezierCurveTo(...p1, ...p2, ...p3); ctx.stroke();
  });
  ctx.restore();
  const biomeOf = (x, y) => sectionAt(x, y, 'heart')?.biome;
  // soft tints under the symbols
  for (const sc of SECTIONS.filter((q) => q.region === 'heart')) {
    const tint = { plains: 'rgba(230,200,110,0.35)', darkwood: 'rgba(40,50,30,0.35)', jungle: 'rgba(90,160,70,0.25)', highland: 'rgba(150,140,120,0.3)', lakeland: 'rgba(140,190,190,0.2)' }[sc.biome];
    if (!tint) continue;
    const g = ctx.createRadialGradient(sc.px, sc.py, 0, sc.px, sc.py, sc.r * 1.1);
    g.addColorStop(0, tint); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); trace(shapes.heart[0]); ctx.clip(); ctx.fillStyle = g; ctx.fillRect(sc.px - sc.r * 1.2, sc.py - sc.r * 1.2, sc.r * 2.4, sc.r * 2.4); ctx.restore();
  }
  const nearCity = (x, y) => Math.hypot(x - 800, y - 520) < 12;
  scatter('heart', 420, 4, (x, y, r) => tree(x, y, 0.8 + r() * 0.4, r() < 0.5 ? '#4f6b2f' : '#3e5a28'), (x, y) => biomeOf(x, y) === 'forest' && !nearCity(x, y));
  scatter('heart', 160, 5, (x, y, r) => tree(x, y, 0.9 + r() * 0.3, r() < 0.5 ? '#26331b' : '#1d2914'), (x, y) => biomeOf(x, y) === 'darkwood');
  scatter('heart', 300, 6, (x, y, r) => tree(x, y, 0.8 + r() * 0.5, r() < 0.5 ? '#3f8a35' : '#2f7a3a'), (x, y) => biomeOf(x, y) === 'jungle');
  scatter('heart', 80, 7, (x, y, r) => tree(x, y, 0.7, '#557a3a'), (x, y) => biomeOf(x, y) === 'lakeland');
  scatter('heart', 32, 8, (x, y, r) => mountain(x, y, 0.8 + r() * 0.5, r() < 0.4), (x, y) => biomeOf(x, y) === 'highland');
  scatter('heart', 14, 10, (x, y, r) => mountain(x, y, 0.6 + r() * 0.3, false), (x, y) => biomeOf(x, y) === 'hills');
  scatter('heart', 60, 9, (x, y) => tuft(x, y), (x, y) => biomeOf(x, y) === 'hills');
  scatter('heart', 160, 11, (x, y) => dot(x, y, '#a8862e'), (x, y) => biomeOf(x, y) === 'plains');

  // Dragon Peaks: mountains and volcanoes
  scatter('peaks', 34, 12, (x, y, r) => (r() < 0.2 ? volcano(x, y, 0.9) : mountain(x, y, 0.9 + r() * 0.6, true)));
  // Ashen Wastes: dry dots, a few mesas, cliffs at Gloomhollow
  scatter('warrens', 260, 14, (x, y) => dot(x, y, '#8a6a3a'));
  scatter('warrens', 12, 15, (x, y, r) => mountain(x, y, 0.7 + r() * 0.3, false), (x, y) => y > 520);
  // Fae Isles: glowing trees
  for (const [i, pts] of shapes.fae.entries()) {
    const r = rng(30 + i);
    for (let k = 0; k < 40; k++) {
      const [cx, cy] = [pts[0][0], pts[0][1]];
      const reg = REGIONS.find((q) => q.id === 'fae').islands[i];
      const x = reg[0] + (r() - 0.5) * reg[2] * 1.6, y = reg[1] + (r() - 0.5) * reg[2] * 1.2;
      if (inside(pts, x, y) && inside(pts, x + 8, y) && inside(pts, x - 8, y)) tree(x, y, 0.7, r() < 0.3 ? '#7fae9a' : '#5f8f6a');
    }
  }
  // Mirefall: the great lake and marsh tufts
  const lake = blobPath(LAKE.x, LAKE.y, LAKE.r, LAKE.seed, LAKE.stretch, LAKE.wobble);
  trace(lake); ctx.fillStyle = '#6fa3b0'; ctx.fill(); ctx.strokeStyle = '#3b5a68'; ctx.lineWidth = 1.6; ctx.stroke();
  scatter('mire', 120, 18, (x, y) => tuft(x, y), (x, y) => !inside(lake, x, y) && Math.hypot((x - LAKE.x) / 1.5, y - LAKE.y) > 82);
  // the smaller lakes everywhere
  LAKES.forEach(([x, y, r], i) => {
    trace(blobPath(x, y, Math.max(1.6, r), 60 + i, [1.2, 0.85], 0.2));
    ctx.fillStyle = '#6fa3b0'; ctx.fill(); ctx.strokeStyle = '#3b5a68'; ctx.lineWidth = 0.8; ctx.stroke();
  });
  // Temple in the lake
  ctx.fillStyle = '#e8dcb8'; ctx.strokeStyle = '#3b2a17'; ctx.lineWidth = 1.2;
  const tx0 = LAKE.x - 8, ty0 = LAKE.y - 14;
  ctx.fillRect(tx0, ty0, 16, 14); ctx.strokeRect(tx0, ty0, 16, 14);
  ctx.beginPath(); ctx.moveTo(tx0 - 4, ty0); ctx.lineTo(LAKE.x, ty0 - 10); ctx.lineTo(tx0 + 20, ty0); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Frostreach and Sunscar
  scatter('frost', 14, 19, (x, y, r) => mountain(x, y, 0.7 + r() * 0.3, true));
  scatter('sun', 220, 20, (x, y) => dot(x, y, '#b08a4a'));

  // --- places ---
  function marker(x, y, label, opts = {}) {
    if (opts.star) {
      ctx.fillStyle = '#f5c84c'; ctx.strokeStyle = '#3b2a17'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 ? 6 : 15; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillStyle = opts.color || '#8a1f1a'; ctx.strokeStyle = '#fff4d8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, (opts.size || 15) < 13 ? 4 : 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.font = `${opts.bold ? 700 : 500} ${opts.size || 15}px Cinzel, Georgia, serif`;
    ctx.textAlign = opts.align || 'left'; ctx.textBaseline = 'middle';
    const tx = x + (opts.align === 'right' ? -12 : opts.align === 'center' ? 0 : 12), ty = y + (opts.dy || 0);
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(245,235,205,0.9)'; ctx.strokeText(label, tx, ty);
    ctx.fillStyle = '#2a1c0c'; ctx.fillText(label, tx, ty);
  }
  function regionLabel(x, y, text, size = 26) {
    ctx.font = `700 ${size}px Cinzel, Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(245,235,205,0.85)'; ctx.strokeText(text.toUpperCase(), x, y);
    ctx.fillStyle = '#5a3a14'; ctx.fillText(text.toUpperCase(), x, y);
  }

  // section names, small and slanted
  ctx.font = 'italic 600 12px Cinzel, Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const sc of SECTIONS) {
    if (sc.region === 'fae' || sc.region === 'frost' || sc.name === 'Gloomhollow') continue; // named elsewhere already
    const y = sc.py + (sc.region === 'heart' ? sc.r * 0.45 : 22);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(245,235,205,0.8)'; ctx.strokeText(sc.name, sc.px, y);
    ctx.fillStyle = sc.biome === 'darkwood' ? '#2a1a10' : '#6a4a20'; ctx.fillText(sc.name, sc.px, y);
  }
  regionLabel(800, 268, 'The Verdant Heartland', 28);
  regionLabel(790, 40, 'Dragon Peaks', 24);
  regionLabel(230, 250, 'Ashen Wastes', 22);
  regionLabel(1440, 150, 'The Fae Isles', 22);
  regionLabel(1130, 812, 'Mirefall', 24);
  regionLabel(240, 55, 'Frostreach', 18);
  regionLabel(330, 955, 'Sunscar Desert', 18);

  const LABEL = {
    central: { star: true, bold: true, size: 17, label: 'Central City (spawn)' },
    crossroads: { color: '#5a3a14', size: 13, align: 'right' },
    riverhold: { color: '#5a3a14', size: 13 },
    hills: { color: '#5a3a14', size: 13 },
    nests: { color: '#8a1f1a' },
    warrens: { color: '#8a1f1a' },
    slimecaves: { color: '#8a1f1a', align: 'center', dy: 18 },
    glade: { color: '#8a1f1a', align: 'center', dy: -18 },
    temple: { color: '#8a1f1a', align: 'center', dy: -26 },
    lumenhollow: { color: '#8a1f1a', align: 'right' },
    marsh: { color: '#8a1f1a', align: 'right' },
  };
  const VILLAGE = { color: '#5a3a14', size: 11 };
  for (const p of PLACES) marker(p.px, p.py, LABEL[p.id]?.label || p.name, LABEL[p.id] || (p.village ? { ...VILLAGE, color: p.summit ? '#7a6a5a' : VILLAGE.color } : {}));

  // --- compass and scale ---
  function compass(x, y) {
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = '#3b2a17'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = i % 2 ? '#f5c84c' : '#3b2a17';
      ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(7, 0); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    ctx.font = '700 16px Cinzel, Georgia, serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#2a1c0c'; ctx.fillText('N', x, y - 56);
  }
  compass(1500, 860);
  // scale bar: 100 px on the map
  ctx.fillStyle = '#2a1c0c'; ctx.fillRect(1400, 950, 50, 6); ctx.fillStyle = '#f5ebd0'; ctx.fillRect(1450, 950, 50, 6);
  ctx.strokeStyle = '#2a1c0c'; ctx.strokeRect(1400, 950, 100, 6);
  ctx.font = '500 13px Cinzel, Georgia, serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#2a1c0c';
  ctx.fillText('0', 1400, 972); ctx.fillText(`${Math.round(100 * METRES_PER_PX / 1000)} km`, 1500, 972);

  // paper vignette and border
  const vg = ctx.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, W * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(40,25,5,0.45)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#3b2a17'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, W - 8, H - 8);
}
