// The bones as one solid, in a pose: how far a point is from the nearest bone, and a way to push a
// point out of the bones to a given clearance. Used so that vessels, muscles and tendons never
// pass through a bone. Plain numbers and arrays only (no three.js).
import { shapeDist, shapeBox, mapShape } from './sdf.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// J: the posed joints from poseRig (muscles.js)
export function boneField(S, J) {
  const shapes = [];
  for (const p of S.parts) {
    if (p.mat !== 'bone' || !p.joint) continue;
    const q = J[p.joint], R = q.R;
    const P = (x) => { const d = [x[0] - q.rest[0], x[1] - q.rest[1], x[2] - q.rest[2]]; return add(q.p, [R[0] * d[0] + R[1] * d[1] + R[2] * d[2], R[3] * d[0] + R[4] * d[1] + R[5] * d[2], R[6] * d[0] + R[7] * d[1] + R[8] * d[2]]); };
    const subs = p.shapes.filter((s) => s.sub);
    for (const s of p.shapes) if (!s.sub) shapes.push({ ...mapShape(s, P, R), blend: 0 });
    void subs; // (the hollows carved in a bone are left solid here: nothing should sit in them either)
  }
  const G = 0.012, grid = new Map(), key = (i, j, k) => i + ',' + j + ',' + k;
  shapes.forEach((s, n) => {
    const b = shapeBox(s);
    for (let i = Math.floor(b[0] / G); i <= Math.floor(b[3] / G); i++) for (let j = Math.floor(b[1] / G); j <= Math.floor(b[4] / G); j++) for (let k = Math.floor(b[2] / G); k <= Math.floor(b[5] / G); k++) {
      const c = key(i, j, k); if (!grid.has(c)) grid.set(c, []); grid.get(c).push(n);
    }
  });
  const near = (p) => {
    const set = grid.get(key(Math.floor(p[0] / G), Math.floor(p[1] / G), Math.floor(p[2] / G)));
    return set || [];
  };
  const dist = (p) => { let d = 0.05; for (const n of near(p)) d = Math.min(d, shapeDist(shapes[n], p[0], p[1], p[2])); return d; };
  const grad = (p) => {
    const e = 0.0003;
    const g = [dist(add(p, [e, 0, 0])) - dist(add(p, [-e, 0, 0])), dist(add(p, [0, e, 0])) - dist(add(p, [0, -e, 0])), dist(add(p, [0, 0, e])) - dist(add(p, [0, 0, -e]))];
    const l = Math.hypot(...g) || 1; return g.map((v) => v / l);
  };
  // move p straight out of the bone until it is at least `clear` from it (it is left alone if it is already)
  const push = (p, clear) => {
    let q = p;
    for (let it = 0; it < 8; it++) {
      const d = dist(q); if (d >= clear - 1e-5) return q;
      const n = grad(q); q = add(q, n.map((v) => v * (clear - d) * (d < 0 ? 1.05 : 1)));
    }
    return q;
  };
  return { dist, push };
}
