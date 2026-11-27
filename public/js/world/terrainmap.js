// A true-to-scale picture of the real ground (from the same terrain the world is built from).
// Used by the corner minimap and by the world map when you zoom in close.
import { sample } from '../data/world-layout.mjs';

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const GROUND = {
  heart: hex('#7f9b4e'), peaks: hex('#8c8468'), warrens: hex('#b39066'), fae: hex('#77a07c'),
  mire: hex('#6d7d4e'), frost: hex('#e4e9ec'), sun: hex('#d8bc84'),
};
const OTHER = hex('#c4b68a');
const SAND = hex('#d9cb9c'), WOOD = hex('#3f5b2a'), ROCK = hex('#8e877a'), SNOW = hex('#f3f4f2');
const SHALLOW = hex('#79adb8'), DEEP = hex('#3a6479'), ICE = hex('#bcd6e2');
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function colourOf(s) {
  if (s.ice) return ICE; // a frozen lake
  if (s.h < s.water) return mix(SHALLOW, DEEP, clamp01((s.water - s.h) / 25));
  let c = GROUND[s.region] || OTHER;
  if (s.h - s.water < 1.6 && s.coast < 1200 && !s.wet) c = SAND;
  c = mix(c, WOOD, s.forest * 0.75);
  if (s.region !== 'frost') c = mix(c, ROCK, clamp01((s.h - 260) / 300));
  c = mix(c, SNOW, clamp01((s.h - 900) / 250));
  return c;
}

// Paints the ground a few rows at a time so the game never stutters.
// `area` is {x0, z0, x1, z1} in world metres; the result fills `canvas` (cols × rows cells).
export function createTerrainPainter(cols, rows) {
  const canvas = document.createElement('canvas');
  canvas.width = cols; canvas.height = rows;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(cols, rows);
  const heights = new Float32Array(cols * (rows + 1));
  const s = {};
  let job = null;     // the area being painted
  let done = null;    // the area of the last finished picture
  let row = 0;
  // the last finished picture stays on show (in `before`) while the next one fills in row by row
  const before = document.createElement('canvas');
  before.width = cols; before.height = rows;
  let beforeArea = null;

  function step(budgetMs = 6) {
    if (!job) return false;
    const t0 = performance.now();
    const { x0, z0, x1, z1 } = job;
    const dx = (x1 - x0) / cols, dz = (z1 - z0) / rows;
    while (row < rows && performance.now() - t0 < budgetMs) {
      const z = z0 + (row + 0.5) * dz;
      for (let c = 0; c < cols; c++) {
        sample(x0 + (c + 0.5) * dx, z, s);
        heights[row * cols + c] = Math.max(s.h, s.water);
        const [r, g, b] = colourOf(s);
        // light from the north-west: slopes facing it are brighter
        const west = c ? heights[row * cols + c - 1] : heights[row * cols + c];
        const north = row ? heights[(row - 1) * cols + c] : heights[row * cols + c];
        const slope = ((heights[row * cols + c] - west) / dx + (heights[row * cols + c] - north) / dz) * 0.5;
        const shade = s.h < s.water ? 1 : Math.max(0.6, Math.min(1.35, 1 + slope * 1.4));
        const i = (row * cols + c) * 4;
        img.data[i] = r * shade; img.data[i + 1] = g * shade; img.data[i + 2] = b * shade; img.data[i + 3] = 255;
      }
      row++;
    }
    ctx.putImageData(img, 0, 0);
    if (row >= rows) { done = job; job = null; return true; }
    return false;
  }

  return {
    canvas,
    // start painting a new area (unless it is already painted or being painted)
    want(area) {
      const same = (a) => a && a.x0 === area.x0 && a.z0 === area.z0 && a.x1 === area.x1 && a.z1 === area.z1;
      if (same(job) || (!job && same(done))) return;
      if (done) { before.getContext('2d').clearRect(0, 0, cols, rows); before.getContext('2d').drawImage(canvas, 0, 0); beforeArea = done; }
      job = area; row = 0;
      img.data.fill(0);
      ctx.clearRect(0, 0, cols, rows);
    },
    // draw the ground onto `target`; `place(area)` gives [x, y, w, h] on the target for a world area
    draw(target, place) {
      if (job && beforeArea) target.drawImage(before, ...place(beforeArea));
      const a = job || done;
      if (a) target.drawImage(canvas, ...place(a));
    },
    step,
    get busy() { return !!job; },
    get area() { return job || done; },
  };
}
