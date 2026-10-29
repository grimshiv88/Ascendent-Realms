// Anime hair: locks that grow from the crown, follow the shape of the head (lying a little off it,
// in layers), then fall with their weight: over the forehead as bangs, past the ears as side locks,
// down the back. Each lock is a flattened ribbon that tapers to a point. The skin under the hair is
// darkened to the hair's colour (see build.js), so gaps between locks never show a bald scalp.
// Plain numbers and arrays only (no three.js).
import { fieldDist } from './sdf.js';

// Styles. len(a): how far a lock at angle a (0 = front, ±π = back) reaches, in metres along the
// head; lift: how far each layer stands off the head; tip: how much the tips curl; count: locks
// per layer; drop: extra length that falls free below the skull (long hair)
export const HAIR_STYLES = {
  short: { layers: [0.008, 0.017], count: 22, width: 0.044, len: (a) => lerpA(a, 0.235, 0.23, 0.2), tip: 0.5, messy: 0.35, drop: 0 },
  medium: { layers: [0.008, 0.016, 0.023], count: 22, width: 0.046, len: (a) => lerpA(a, 0.24, 0.27, 0.27), tip: 0.4, messy: 0.25, drop: 0.06 },
  long: { layers: [0.008, 0.016, 0.023], count: 24, width: 0.048, len: (a) => lerpA(a, 0.235, 0.36, 0.42), tip: 0.25, messy: 0.15, drop: 0.3 },
  spiky: { layers: [0.01, 0.022], count: 18, width: 0.046, len: (a) => lerpA(a, 0.23, 0.21, 0.22), tip: 0.2, messy: 0.6, drop: 0, spikes: 1 },
  curly: { layers: [0.01, 0.02, 0.028], count: 20, width: 0.044, len: (a) => lerpA(a, 0.21, 0.22, 0.22), tip: 1.2, messy: 0.5, drop: 0, curls: 1 },
  bald: null,
};
// length by angle: front (bangs), sides, back
function lerpA(a, front, side, back) {
  const t = Math.abs(a) / Math.PI; // 0 front .. 1 back
  if (t < 0.5) return front + (side - front) * smooth(t / 0.5);
  return side + (back - side) * smooth((t - 0.5) / 0.5);
}
const smooth = (t) => t * t * (3 - 2 * t);

// shapes: the head's shapes (sculpting pose); plan: the body plan. Returns mesh data with, for
// each point, how far along its lock it is (0 root .. 1 tip) and which layer it is on.
export function growHair(styleName, shapes, plan, seed = 1) {
  const S = HAIR_STYLES[styleName];
  if (!S) return null;
  const hd = plan.hd, o = plan.headO;
  const f = (x, y, z) => fieldDist(shapes, x, y, z);
  const grad = (p) => {
    const e = 0.0005;
    const g = [f(p[0] + e, p[1], p[2]) - f(p[0] - e, p[1], p[2]), f(p[0], p[1] + e, p[2]) - f(p[0], p[1] - e, p[2]), f(p[0], p[1], p[2] + e) - f(p[0], p[1], p[2] - e)];
    return norm(g);
  };
  let rs = seed * 9301 + 49297;
  const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
  const centre = [0, o[1] + 0.097 * hd, o[2] - 0.01 * hd];
  // the crown: the top of the head, a little to the back
  const crown = surfaceAlong(f, centre, norm([0, 1, -0.45]));
  const earY = o[1] + 0.03 * hd; // below this a lock falls free instead of hugging the head
  const brow = plan.eyes.y + 0.022 * hd; // bangs stop about at the brows

  const P = [], N = [], T = [], L = [], I = [];
  const SEG = 14, RING = 6;
  S.layers.forEach((lift0, layer) => {
    const count = Math.round(S.count * (layer === 0 ? 1 : 0.85));
    for (let i = 0; i < count; i++) {
      const a = -Math.PI + (i + 0.5 + (layer % 2) * 0.5) * (2 * Math.PI / count) + (rnd() - 0.5) * 0.08;
      const lift = lift0 * hd * (0.8 + rnd() * 0.4);
      let len = S.len(a) * hd * (0.85 + rnd() * 0.3) * (1 - layer * 0.04);
      const stopAt = brow + (rnd() - 0.3) * 0.016 * hd;
      const front = Math.cos(a); // 1 at the front, -1 at the back
      const width = S.width * hd * (0.75 + rnd() * 0.5) * (front > 0.6 ? 0.9 : 1);
      // walk out from the crown towards angle a, hugging the head, then let it fall
      const start = add(crown, scale(grad(crown), lift));
      let dir = tangent(norm([Math.sin(a), 0.05, Math.cos(a)]), grad(crown));
      const pts = [start];
      let p = start, travelled = 0;
      const step = len / SEG;
      const extra = S.drop * hd * (front < 0.3 ? (0.4 + 0.6 * (1 - front) / 1.3) : 0);
      const total = len + extra;
      const n = Math.max(SEG, Math.round(total / step));
      const wobble = (rnd() - 0.5) * S.messy;
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const g = grad(p);
        const hugging = p[1] > earY && travelled < len;
        // weight pulls the lock down more and more once it is past the top of the head
        const fall = hugging ? Math.max(0, 0.06 + (centre[1] - p[1]) / (0.1 * hd)) * 0.25 : 0.35;
        dir = norm(add(dir, [0, -fall, 0]));
        if (hugging) dir = tangent(dir, g);
        // messy hair: the lock wanders a little to one side
        dir = norm(add(dir, scale(cross(dir, g), wobble * 0.08)));
        // the tip curls (inwards for bangs, outwards at the back)
        if (t > 0.72) dir = norm(add(dir, scale(g, (front > 0.5 ? -1 : 1) * S.tip * 0.18 * (t - 0.72) / 0.28)));
        p = add(p, scale(dir, step));
        travelled += step;
        // stay off the head: hug it above the ears, only keep out of it below
        const d = f(...p);
        if (hugging) p = add(p, scale(g, lift * (1 - 0.35 * t) - d));
        else if (d < lift * 0.6) p = add(p, scale(g, lift * 0.6 - d));
        // bangs end above the eyes
        if (front > 0.75 && p[1] < stopAt && p[2] > o[2]) { pts.push(p); break; }
        pts.push(p);
      }
      ribbon(pts, width, lift, layer, S, rnd);
    }
  });

  function ribbon(pts, width, lift, layer, S, rnd) {
    const n = pts.length;
    if (n < 3) return;
    const base = P.length / 3;
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      const p = pts[k];
      const fwd = norm(sub(pts[Math.min(n - 1, k + 1)], pts[Math.max(0, k - 1)]));
      let up = grad(p);
      const side = norm(cross(fwd, up));
      up = norm(cross(side, fwd));
      // wide near the root, swelling a little, then to a sharp point
      const w = width * (0.75 + 0.5 * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5)) * Math.pow(1 - t, 0.7) * 0.5 + 0.0004;
      const th = Math.max(0.0012, w * 0.32);
      for (let r = 0; r < RING; r++) {
        const ang = (r / RING) * Math.PI * 2;
        const cs = Math.cos(ang), sn = Math.sin(ang);
        // a flattened, slightly curved cross-section (like a leaf)
        const off = add(scale(side, cs * w), scale(up, sn * th + (cs * cs) * th * -0.6));
        P.push(p[0] + off[0], p[1] + off[1], p[2] + off[2]);
        const nn = norm(add(scale(side, cs * th), scale(up, sn * w)));
        N.push(nn[0], nn[1], nn[2]);
        T.push(t); L.push(layer);
      }
    }
    for (let k = 0; k < n - 1; k++) for (let r = 0; r < RING; r++) {
      const a = base + k * RING + r, b = base + k * RING + (r + 1) % RING, c = a + RING, d = b + RING;
      I.push(a, c, b, b, c, d);
    }
  }
  return { positions: new Float32Array(P), normals: new Float32Array(N), along: new Float32Array(T), layer: new Float32Array(L), indices: new Uint32Array(I) };
}

// the point on the surface found going out from `from` along `dir`
function surfaceAlong(f, from, dir) {
  let t = 0;
  for (let i = 0; i < 80; i++) { const d = f(from[0] + dir[0] * t, from[1] + dir[1] * t, from[2] + dir[2] * t); if (d > -1e-5 && d < 1e-4) break; t += d < 0 ? Math.max(-d, 0.0005) : -d * 0.5; }
  return [from[0] + dir[0] * t, from[1] + dir[1] * t, from[2] + dir[2] * t];
}

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const tangent = (v, n) => norm(sub(v, scale(n, dot(v, n))));
