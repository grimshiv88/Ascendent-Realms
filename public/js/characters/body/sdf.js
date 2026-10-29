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
