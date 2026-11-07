// Signed distance shapes for sculpting bodies: round cones (limbs, fingers), ellipsoids (muscles,
// skull, pelvis), blended together with smooth unions, and carved with smooth subtractions.
// Plain numbers and arrays only (no three.js), so the same code can run in a worker.
// A distance is negative inside the body, positive outside, in metres.

// One shape. kind 'cone': a round cone from a (radius ra) to b (radius rb).
// kind 'ell': an ellipsoid at c with radii r, turned by the 3x3 matrix m (rows: its local axes).
// blend: how softly it melts into the shapes before it (metres). sub: carve it out instead.
// bone: the bone that carries it (for skin weights).
export function cone(a, b, ra, rb, opts = {}) {
  return { kind: 'cone', a, b, ra, rb, blend: 0.02, ...opts };
}
export function ell(c, r, opts = {}) {
  return { kind: 'ell', c, r, m: opts.m || null, blend: 0.02, ...opts };
}

// kind 'loft': a smooth trunk through horizontal rings [y, rx, front depth, back depth, z of the
// middle], from the lowest ring to the highest, with rounded ends. Good for a torso, whose outline
// a sculptor would draw slice by slice.
export function loft(rings, opts = {}) {
  return { kind: 'loft', rings, blend: 0.02, ...opts };
}

// kind 'sweep': a bone shaft or a muscle belly drawn the way a sculptor shapes one, as a smooth run
// of cross-sections along a curve. Each station is { p: centre, r: [front, lateral, back, medial]
// radii, h: [ridge heights], a: [ridge angles, if they turn along the run] }; the outline between those four radii is elliptical, and each ridge
// (opts.ridges: [{ a: angle, w: width }], angle 0 = front, PI/2 = lateral, PI = back, -PI/2 =
// medial) adds a crest (or, with a negative height, a groove) along the run. opts.front and opts.lat
// are the directions taken as front and lateral; a station's tw (radians) twists its section about
// the curve (toward lateral). steps: points worked out between stations.
export function sweep(stations, opts = {}) {
  return { kind: 'sweep', stations, front: [0, 0, 1], lat: [1, 0, 0], ridges: [], steps: 6, blend: 0.002, ...opts };
}
// One shape carried by a point map P (rest -> pose), a rotation Rm (row-major 3x3, for directions)
// and a scale k for its sizes. Works for every kind (used to scale a skeleton and to pose bones).
export function mapShape(s, P, Rm = null, k = 1) {
  const R = (v) => (Rm ? [Rm[0] * v[0] + Rm[1] * v[1] + Rm[2] * v[2], Rm[3] * v[0] + Rm[4] * v[1] + Rm[5] * v[2], Rm[6] * v[0] + Rm[7] * v[1] + Rm[8] * v[2]] : v);
  const o = { ...s, blend: (s.blend || 0) * k };
  delete o._ba; delete o._S;
  if (s.kind === 'cone') { o.a = P(s.a); o.b = P(s.b); o.ra = s.ra * k; o.rb = s.rb * k; return o; }
  if (s.kind === 'sweep') {
    o.stations = s.stations.map((q) => ({ ...q, p: P(q.p), r: q.r.map((v) => v * k), h: q.h ? q.h.map((v) => v * k) : undefined, lat: q.lat ? R(q.lat) : undefined }));
    o.front = R(s.front); o.lat = R(s.lat);
    return o;
  }
  if (s.kind === 'ell') {
    o.c = P(s.c); o.r = s.r.map((v) => v * k);
    if (Rm) {
      const m = s.m || [1, 0, 0, 0, 1, 0, 0, 0, 1], M = new Array(9);
      // local = m * world_rest = m * RmT * world_pose
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[i * 3 + j] = m[i * 3] * Rm[j * 3] + m[i * 3 + 1] * Rm[j * 3 + 1] + m[i * 3 + 2] * Rm[j * 3 + 2];
      o.m = M;
    }
    return o;
  }
  return o;
}
function prepSweep(s) {
  const st = s.stations, n = st.length, steps = s.steps, NR = s.ridges.length;
  const cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  // every number of a station in one list, eased between stations (Catmull-Rom)
  const own = !!st[0].lat; // stations may carry their own lateral direction (a run that bends right round)
  const flat = (q) => [...q.p, ...q.r, ...(q.h || new Array(NR).fill(0)), ...(q.a || s.ridges.map((g) => g.a)), ...(own ? q.lat : []), q.tw || 0];
  const F = st.map(flat), m = F[0].length, smp = [];
  for (let i = 0; i < n - 1; i++) {
    const f0 = F[Math.max(0, i - 1)], f1 = F[i], f2 = F[i + 1], f3 = F[Math.min(n - 1, i + 2)];
    for (let k = i ? 1 : 0; k <= steps; k++) {
      const t = k / steps, v = new Array(m);
      for (let j = 0; j < m; j++) v[j] = cr(f0[j], f1[j], f2[j], f3[j], t);
      smp.push(v);
    }
  }
  const N = smp.length, out = [];
  let maxR = 0;
  for (let i = 0; i < N; i++) {
    const v = smp[i], a = smp[Math.max(0, i - 1)], b = smp[Math.min(N - 1, i + 1)];
    const t = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    const pr = (d) => { const k = d[0] * t[0] + d[1] * t[1] + d[2] * t[2]; return [d[0] - t[0] * k, d[1] - t[1] * k, d[2] - t[2] * k]; };
    const L = own ? v.slice(7 + 2 * NR, 10 + 2 * NR) : s.lat;
    let u, w;
    if (own) {
      // a station's own lateral direction rules; the front is square to it, on front's side
      w = norm(pr(L));
      u = [w[1] * t[2] - w[2] * t[1], w[2] * t[0] - w[0] * t[2], w[0] * t[1] - w[1] * t[0]];
      if (u[0] * s.front[0] + u[1] * s.front[1] + u[2] * s.front[2] < 0) u = [-u[0], -u[1], -u[2]];
    } else {
    u = norm(pr(s.front));
    if (Math.hypot(...u) < 1e-6) u = norm(pr(Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    // the lateral direction: square to the run and to the front; at the start on the side `lat`
    // points to, then always on the same side as the point before (so it never flips over)
    w = norm([t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]]);
    const lw = w[0] * L[0] + w[1] * L[1] + w[2] * L[2];
    const prev = out.length ? out[out.length - 1].w : null;
    if (prev ? w[0] * prev[0] + w[1] * prev[1] + w[2] * prev[2] < 0 : lw < 0) w = [-w[0], -w[1], -w[2]];
    }
    const tw = v[m - 1];
    if (tw) { const c = Math.cos(tw), si = Math.sin(tw); [u, w] = [[u[0] * c + w[0] * si, u[1] * c + w[1] * si, u[2] * c + w[2] * si], [w[0] * c - u[0] * si, w[1] * c - u[1] * si, w[2] * c - u[2] * si]]; }
    const r = v.slice(3, 7).map((x) => Math.max(x, 1e-5)), h = v.slice(7, 7 + NR), ang = v.slice(7 + NR, 7 + 2 * NR);
    let top = Math.max(...r) + Math.max(0, ...h);
    maxR = Math.max(maxR, top);
    out.push({ c: [v[0], v[1], v[2]], t, u, w, r, h, ang, top });
  }
  const L = [0];
  for (let i = 1; i < out.length; i++) { const a = out[i - 1].c, b = out[i].c; L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])); }
  s._S = { smp: out, maxR, L };
}
// the ridges' height at angle th (0 front, PI/2 lateral)
function ridgeAt(s, h, ang, th) {
  let R = 0;
  for (let j = 0; j < s.ridges.length; j++) {
    if (!h[j]) continue;
    let d = th - ang[j]; d = Math.atan2(Math.sin(d), Math.cos(d));
    R += h[j] * Math.exp(-((d / s.ridges[j].w) ** 2));
  }
  return R;
}
function sweepDist(s, px, py, pz) {
  if (!s._S) prepSweep(s);
  const S = s._S.smp, N = S.length;
  let best = 1e9, bi = 0, bt = 0;
  for (let i = 0; i < N - 1; i++) {
    const A = S[i].c, B = S[i + 1].c;
    const bx = B[0] - A[0], by = B[1] - A[1], bz = B[2] - A[2];
    const l2 = bx * bx + by * by + bz * bz || 1e-12;
    let t = ((px - A[0]) * bx + (py - A[1]) * by + (pz - A[2]) * bz) / l2;
    const tr = t;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = px - A[0] - bx * t, dy = py - A[1] - by * t, dz = pz - A[2] - bz * t;
    const e = dx * dx + dy * dy + dz * dz; // (the nearest point on the centre line, so the choice never jumps)
    if (e < best) { best = e; bi = i; bt = (i === 0 && tr < 0) || (i === N - 2 && tr > 1) ? tr : t; }
  }
  const P = S[bi], Q = S[bi + 1], t = Math.min(1, Math.max(0, bt));
  const L = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const c = L(P.c, Q.c), u = L(P.u, Q.u), w = L(P.w, Q.w), T = L(P.t, Q.t);
  const r = P.r.map((v, j) => v + (Q.r[j] - v) * t), h = P.h.map((v, j) => v + (Q.h[j] - v) * t), ang = P.ang.map((v, j) => v + (Q.ang[j] - v) * t);
  const qx = px - c[0], qy = py - c[1], qz = pz - c[2];
  const x = qx * u[0] + qy * u[1] + qz * u[2], y = qx * w[0] + qy * w[1] + qz * w[2];
  // the outline: an ellipse in each quarter (front/back by lateral/medial), its distance worked out
  // the way an ellipsoid's is (good even for a thin plate), less the ridges' height there
  const ax = x >= 0 ? r[0] : r[2], ay = y >= 0 ? r[1] : r[3];
  const k0 = Math.hypot(x / ax, y / ay), k1 = Math.hypot(x / (ax * ax), y / (ay * ay));
  // (inside, a cautious guess, so a thin plate is never taken for solid)
  let d = k0 >= 1 ? (k0 * (k0 - 1)) / k1 : (k0 - 1) * Math.min(ax, ay);
  if (s.ridges.length) d -= ridgeAt(s, h, ang, Math.atan2(y, x));
  // the flat ends: how far past (or, negative, how far short of) the nearer end, measured along the run
  const Lc = s._S.L, sl = Lc[bi + 1] - Lc[bi], at = Lc[bi] + bt * sl;
  const e = Math.max(-at, at - Lc[N - 1]);
  if (s.round) { // a rounded rim at the ends
    const rc = s.round, a = d + rc, b = e + rc;
    return Math.hypot(Math.max(a, 0), Math.max(b, 0)) + Math.min(Math.max(a, b), 0) - rc;
  }
  if (e > 0 && d > 0) return Math.hypot(d, e);
  return Math.max(d, e);
  return d;
}

// Rotation matrices for ellipsoids (rows are the shape's local axes in world space)
export function rotXYZ(x = 0, y = 0, z = 0) {
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  // R = Rz * Ry * Rx; we store R transposed (world -> local)
  const r00 = cy * cz, r01 = sx * sy * cz - cx * sz, r02 = cx * sy * cz + sx * sz;
  const r10 = cy * sz, r11 = sx * sy * sz + cx * cz, r12 = cx * sy * sz - sx * cz;
  const r20 = -sy, r21 = sx * cy, r22 = cx * cy;
  return [r00, r10, r20, r01, r11, r21, r02, r12, r22];
}
// An ellipsoid's axes from its long direction (the shape's local y lies along `dir`)
export function alongDir(dir, roll = 0) {
  const [dx, dy, dz] = norm(dir);
  // pick a side vector not parallel to dir
  let sx = 0, sy = 0, sz = 1;
  if (Math.abs(dz) > 0.9) { sx = 1; sz = 0; }
  // x = side × dir, z = dir × x
  let xx = sy * dz - sz * dy, xy = sz * dx - sx * dz, xz = sx * dy - sy * dx;
  const xl = Math.hypot(xx, xy, xz); xx /= xl; xy /= xl; xz /= xl;
  let zx = dy * xz - dz * xy, zy = dz * xx - dx * xz, zz = dx * xy - dy * xx;
  if (roll) {
    const c = Math.cos(roll), s = Math.sin(roll);
    const nx = [xx * c + zx * s, xy * c + zy * s, xz * c + zz * s];
    const nz = [zx * c - xx * s, zy * c - xy * s, zz * c - xz * s];
    [xx, xy, xz] = nx; [zx, zy, zz] = nz;
  }
  return [xx, xy, xz, dx, dy, dz, zx, zy, zz];
}
export const norm = ([x, y, z]) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };

// Distance to one shape
export function shapeDist(s, px, py, pz) {
  if (s.kind === 'cone') return roundCone(px, py, pz, s);
  if (s.kind === 'loft') return loftDist(s, px, py, pz);
  if (s.kind === 'sweep') return sweepDist(s, px, py, pz);
  let x = px - s.c[0], y = py - s.c[1], z = pz - s.c[2];
  const m = s.m;
  if (m) {
    const lx = m[0] * x + m[1] * y + m[2] * z;
    const ly = m[3] * x + m[4] * y + m[5] * z;
    const lz = m[6] * x + m[7] * y + m[8] * z;
    x = lx; y = ly; z = lz;
  }
  const [rx, ry, rz] = s.r;
  const k0 = Math.sqrt((x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2);
  const k1 = Math.sqrt((x / (rx * rx)) ** 2 + (y / (ry * ry)) ** 2 + (z / (rz * rz)) ** 2);
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
}

// The ring at height y, each measure eased between the rings above and below (Catmull-Rom)
function ringAt(R, y) {
  const n = R.length;
  if (y <= R[0][0]) return R[0];
  if (y >= R[n - 1][0]) return R[n - 1];
  let i = 0;
  while (i < n - 2 && R[i + 1][0] < y) i++;
  const p0 = R[Math.max(0, i - 1)], p1 = R[i], p2 = R[i + 1], p3 = R[Math.min(n - 1, i + 2)];
  const t = (y - p1[0]) / (p2[0] - p1[0]);
  const out = [y];
  for (let k = 1; k < 5; k++) {
    const a = p0[k], b = p1[k], c = p2[k], d = p3[k];
    out.push(0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t));
  }
  return out;
}
function loftDist(s, px, py, pz) {
  const R = s.rings;
  const [, rx, rf, rb, cz] = ringAt(R, py);
  const x = px, z = pz - cz;
  const rz = z > 0 ? rf : rb;
  const k0 = Math.hypot(x / rx, z / rz), k1 = Math.hypot(x / (rx * rx), z / (rz * rz));
  const d = k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, rz);
  // rounded ends: below the lowest ring and above the highest
  const lo = R[0][0], hi = R[R.length - 1][0];
  const r0 = Math.min(R[0][1], R[0][2]) * 0.8, r1 = Math.min(R[R.length - 1][1], R[R.length - 1][2]) * 0.8;
  if (py < lo + r0) { const dy = lo + r0 - py; return Math.max(d, Math.hypot(Math.max(d + r0, 0), dy) - r0); }
  if (py > hi - r1) { const dy = py - (hi - r1); return Math.max(d, Math.hypot(Math.max(d + r1, 0), dy) - r1); }
  return d;
}

// Exact distance to a round cone (Inigo Quilez)
function roundCone(px, py, pz, s) {
  if (!s._ba) prepCone(s);
  const { a, ra, rb, _ba: ba, _l2: l2, _rr: rr, _a2: a2, _il2: il2 } = s;
  const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
  const y = pax * ba[0] + pay * ba[1] + paz * ba[2];
  const z = y - l2;
  const xx = (pax * l2 - ba[0] * y) ** 2 + (pay * l2 - ba[1] * y) ** 2 + (paz * l2 - ba[2] * y) ** 2;
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * xx;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(xx + z2) * il2 - rb;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(xx + y2) * il2 - ra;
  return (Math.sqrt(xx * a2 * il2) + y * rr) * il2 - ra;
}
function prepCone(s) {
  const ba = [s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]];
  const l2 = Math.max(1e-10, ba[0] ** 2 + ba[1] ** 2 + ba[2] ** 2);
  s._ba = ba; s._l2 = l2; s._rr = s.ra - s.rb; s._a2 = l2 - s._rr * s._rr; s._il2 = 1 / l2;
}

// Bounding box of a shape, grown by its blend
export function shapeBox(s) {
  const g = (s.blend || 0) + 0.002;
  if (s.kind === 'cone') {
    const r = Math.max(s.ra, s.rb) + g;
    return [Math.min(s.a[0], s.b[0]) - r, Math.min(s.a[1], s.b[1]) - r, Math.min(s.a[2], s.b[2]) - r,
      Math.max(s.a[0], s.b[0]) + r, Math.max(s.a[1], s.b[1]) + r, Math.max(s.a[2], s.b[2]) + r];
  }
  if (s.kind === 'sweep') {
    if (!s._S) prepSweep(s);
    const b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    for (const q of s._S.smp) for (let j = 0; j < 3; j++) { b[j] = Math.min(b[j], q.c[j] - q.top - g); b[j + 3] = Math.max(b[j + 3], q.c[j] + q.top + g); }
    return b;
  }
  if (s.kind === 'loft') {
    let rx = 0, rz = 0, z0 = Infinity, z1 = -Infinity;
    for (const [, x, f, b, c] of s.rings) { rx = Math.max(rx, x); z0 = Math.min(z0, c - b); z1 = Math.max(z1, c + f); }
    return [-rx - g, s.rings[0][0] - g, z0 - g, rx + g, s.rings[s.rings.length - 1][0] + g, z1 + g];
  }
  const r = Math.max(...s.r) + g;
  return [s.c[0] - r, s.c[1] - r, s.c[2] - r, s.c[0] + r, s.c[1] + r, s.c[2] + r];
}

const smin = (a, b, k) => {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const smax = (a, b, k) => -smin(-a, -b, k);

// The distance to a list of shapes (in order: unions, then carvings). `clip` is an optional
// extra function (x, y, z, d) -> d that changes the distance last (to cut a part out of the body).
export function fieldDist(shapes, px, py, pz, clip) {
  let d = 1e9;
  for (let i = 0; i < shapes.length; i++) {
    const s = shapes[i];
    if (s.ghost) continue; // only marks where a clip adds something (see sculptor.js clothes)
    const e = shapeDist(s, px, py, pz);
    if (s.sub) d = smax(d, -e, s.blend);
    else if (s.inflate) d = smin(d, e - s.inflate, s.blend);
    else d = smin(d, e, s.blend);
  }
  return clip ? clip(px, py, pz, d) : d;
}
