// The blood vessels of a skeleton with its muscles (skeleton.js, muscles.js): the arteries (red)
// that carry blood out from the heart, and the veins (blue) that bring it back, following real
// anatomy. Deep vessels run beside the bones, between the muscles; surface veins lie on top of
// the muscles under the skin, wavy and a little raised, with the small bumps of their valves.
// Every point of a vessel is fixed to a bone, so in any pose the vessels bend at the joints, and
// the surface veins are then laid back down onto the muscles as they are in that pose, so they
// slide over them as the body moves. Plain numbers and arrays only (no three.js).
import { cone, ell, alongDir, shapeDist, shapeBox, mapShape } from './sdf.js';
import { poseRig } from './muscles.js';
import { boneField } from './boneField.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

function spline(pts, steps) {
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = typeof steps === 'function' ? steps(p1, p2) : steps;
    for (let k = 1; k <= n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1, 2].map((j) => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  return out;
}

// The body's solid surface (bones and muscles, in the pose), to lay surface veins on: a grid of
// the shapes near each place, and the distance and outward direction at a point
function surfaceOf(S, J, muscleParts) {
  const shapes = [];
  for (const p of S.parts) {
    if (p.mat !== 'bone' || !p.joint) continue;
    const q = J[p.joint], R = q.R, RT = [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
    const P = (x) => add(q.p, [R[0] * (x[0] - q.rest[0]) + R[1] * (x[1] - q.rest[1]) + R[2] * (x[2] - q.rest[2]), R[3] * (x[0] - q.rest[0]) + R[4] * (x[1] - q.rest[1]) + R[5] * (x[2] - q.rest[2]), R[6] * (x[0] - q.rest[0]) + R[7] * (x[1] - q.rest[1]) + R[8] * (x[2] - q.rest[2])]);
    for (const s of p.shapes) if (!s.sub) shapes.push({ ...mapShape(s, P, R), blend: 0 });
  }
  for (const p of muscleParts) for (const s of p.shapes) if (!s.sub) shapes.push({ ...s, blend: 0 });
  const G = 0.02, grid = new Map(), key = (i, j, k) => i + ',' + j + ',' + k;
  shapes.forEach((s, n) => {
    const b = shapeBox(s);
    for (let i = Math.floor(b[0] / G); i <= Math.floor(b[3] / G); i++) for (let j = Math.floor(b[1] / G); j <= Math.floor(b[4] / G); j++) for (let k = Math.floor(b[2] / G); k <= Math.floor(b[5] / G); k++) {
      const c = key(i, j, k); if (!grid.has(c)) grid.set(c, []); grid.get(c).push(n);
    }
  });
  const near = (p) => {
    const i0 = Math.floor(p[0] / G), j0 = Math.floor(p[1] / G), k0 = Math.floor(p[2] / G), set = new Set();
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) for (let k = k0 - 1; k <= k0 + 1; k++) for (const n of grid.get(key(i, j, k)) || []) set.add(n);
    return [...set].map((n) => shapes[n]);
  };
  const dist = (p, list) => { let d = 1e9; for (const s of list) d = Math.min(d, shapeDist(s, p[0], p[1], p[2])); return d; };
  return {
    rise(p, lift) {
      let q = p;
      for (let it = 0; it < 4; it++) {
        const list = near(q); if (!list.length) return q;
        const d = dist(q, list); if (d >= lift - 0.00005) return q;
        const e = 0.0004;
        const n = norm([dist(add(q, [e, 0, 0]), list) - dist(add(q, [-e, 0, 0]), list), dist(add(q, [0, e, 0]), list) - dist(add(q, [0, -e, 0]), list), dist(add(q, [0, 0, e]), list) - dist(add(q, [0, 0, -e]), list)]);
        q = add(q, mul(n, lift - d));
      }
      return q;
    },
    // lay a point onto the surface, its centre `lift` outside it; returns the point and the outward direction
    lay(p, lift) {
      let q = p, n = [0, 0, 1];
      for (let it = 0; it < 6; it++) {
        const list = near(q);
        if (!list.length) break;
        const d = dist(q, list), e = 0.0004;
        n = norm([dist(add(q, [e, 0, 0]), list) - dist(add(q, [-e, 0, 0]), list), dist(add(q, [0, e, 0]), list) - dist(add(q, [0, -e, 0]), list), dist(add(q, [0, 0, e]), list) - dist(add(q, [0, 0, -e]), list)]);
        if (d > 0.03) break; // (nothing close: leave it)
        q = sub(q, mul(n, d - lift));
        if (Math.abs(d - lift) < 0.0001) break;
      }
      return { p: q, n };
    },
  };
}

export function goblinVessels(S, muscleParts, { posed = true } = {}) {
  const { J, at, atScaled, k } = poseRig(S, posed);
  const surf = surfaceOf(S, J, muscleParts);
  const B = boneField(S, J); // (no vessel may pass through a bone)
  const parts = [];
  const group = (name, mat, cell) => { const p = { name, joint: null, mat, cell: cell * k / 0.864, shapes: [] }; parts.push(p); return p.shapes; };
  let seed = 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  // One vessel through posed points: radius r0 at its start to r1 at its end (drawing units).
  // surface: lay it on the muscles; wave: how much it wanders side to side (in radii);
  // valves: the bumps of a vein's valves; the first piece melts into the vessel it branches from.
  const vessel = (out, pts, r0, r1, { surface = false, wave = 0, valves = false, lift = 0.5 } = {}) => {
    if (surface) { r0 *= 1.4; r1 *= 1.4; } // (surface veins stand out: a little fuller than the deep ones' share)
    const step = 0.002 * k / 0.864;
    let p = spline(pts, (a, b) => Math.max(1, Math.round(len(sub(b, a)) / step)));
    const n = p.length;
    const R = (i) => (r0 + (r1 - r0) * (i / (n - 1))) * k;
    const ph = rnd() * 6.28, ph2 = rnd() * 6.28, lam = (0.032 + rnd() * 0.014) * k / 0.864;
    // lay on the surface first, to know which way is out
    let normals = p.map(() => [0, 0, 1]);
    const smooth = (q, times) => { for (let t = 0; t < times; t++) q = q.map((x, i) => (i === 0 || i === q.length - 1 ? x : lerp(x, lerp(q[i - 1], q[i + 1], 0.5), 0.6))); return q; };
    const rise = (q) => q.map((x, i) => surf.rise(x, R(i) * lift));
    if (surface) { const l = p.map((q, i) => surf.lay(q, R(i) * lift)); p = smooth(l.map((x) => x.p), 6); normals = l.map((x) => x.n); p = smooth(rise(p), 2); p = rise(p); }
    if (wave) {
      let s = 0;
      p = p.map((q, i) => {
        if (i) s += len(sub(q, p[i - 1]));
        const t = norm(sub(p[Math.min(n - 1, i + 1)], p[Math.max(0, i - 1)]));
        const side = norm(cross(t, surface ? normals[i] : (Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])));
        const fade = Math.min(1, i / 4, (n - 1 - i) / 4); // (the ends stay put, so branches still meet)
        return add(q, mul(side, fade * wave * R(i) * (Math.sin(ph + (s / lam) * 6.28) + 0.35 * Math.sin(ph2 + (s / lam) * 2.9))));
      });
      if (surface) p = rise(smooth(rise(p), 2));
    }
    // last, lift every point clear of the bones (a vessel runs beside a bone, never through it)
    p = p.map((q, i) => B.push(q, R(i) * 1.15 + 0.0002 * k));
    // smooth the pushed path (so it curves round a bone, not kinks) and clear the bone again
    for (let it = 0; it < 3; it++) {
      p = p.map((q, i) => (i === 0 || i === p.length - 1 ? q : q.map((v, j) => 0.25 * p[i - 1][j] + 0.5 * v + 0.25 * p[i + 1][j])));
      p = p.map((q, i) => B.push(q, R(i) * 1.15 + 0.0002 * k));
    }
    const wob = p.map(() => 0.96 + rnd() * 0.08);
    for (let i = 0; i < n - 1; i++) out.push(cone(p[i], p[i + 1], R(i) * wob[i], R(i + 1) * wob[i + 1], { blend: (i ? 0.0003 : 0.0018) * k / 0.864 }));
    if (valves) {
      let s = 0, next = (0.012 + rnd() * 0.01) * k / 0.864;
      for (let i = 1; i < n - 1; i++) {
        s += len(sub(p[i], p[i - 1]));
        if (s > next) { next = s + (0.016 + rnd() * 0.01) * k / 0.864; const t = sub(p[i + 1], p[i - 1]); out.push(ell(p[i], [R(i) * 1.25, R(i) * 1.9, R(i) * 1.25], { m: alongDir(t), blend: 0.0012 * k / 0.864 })); }
      }
    }
    return p;
  };

  const H0 = [0, 0.922, -0.036];
  const hd = (x, y, z) => [H0[0] + x, H0[1] + y, H0[2] + z];

  // ---- the trunk: the aorta and its arch, the two great veins (venae cavae) ----
  // (they run to where the heart will be: the heart comes with the organs)
  {
    const A = group('aorta', 'artery', 0.0009), V = group('venaeCavae', 'vein', 0.0009);
    vessel(A, [at('chest', [0.002, 0.738, 0.03]), at('chest', [0.004, 0.775, 0.03]), at('chest', [0.008, 0.796, 0.02]), at('chest', [0.014, 0.8, 0.0]), at('chest', [0.013, 0.788, -0.02]), at('chest', [0.011, 0.75, -0.03]), at('chest', [0.009, 0.7, -0.026]), at('spine', [0.008, 0.645, -0.006]), at('spine', [0.006, 0.6, 0.012]), at('spine', [0.0, 0.578, 0.02])], 0.0058, 0.0042);
    // inferior vena cava: up the right of the spine from the hips, through the liver's place to the heart
    vessel(V, [at('spine', [-0.004, 0.574, 0.016]), at('spine', [-0.015, 0.6, 0.016]), at('spine', [-0.016, 0.65, 0.004]), at('chest', [-0.016, 0.7, -0.004]), at('chest', [-0.012, 0.73, 0.008]), at('chest', [-0.008, 0.745, 0.024])], 0.0055, 0.006);
    // superior vena cava: down from where the two arm-and-head veins meet
    vessel(V, [at('chest', [-0.016, 0.808, 0.024]), at('chest', [-0.014, 0.78, 0.026]), at('chest', [-0.01, 0.758, 0.028])], 0.0048, 0.005);
    // the arch's three branches: brachiocephalic (right), left carotid, left subclavian
    vessel(A, [at('chest', [0.006, 0.797, 0.02]), at('chest', [-0.008, 0.812, 0.022]), at('chest', [-0.018, 0.822, 0.018])], 0.0032, 0.003);
    vessel(A, [at('chest', [0.01, 0.8, 0.012]), at('chest', [0.016, 0.82, 0.01])], 0.0022, 0.0022);
    vessel(A, [at('chest', [0.013, 0.799, 0.0]), at('chest', [0.024, 0.815, 0.004])], 0.0025, 0.0025);
    // the arteries along the ribs (intercostals), from the aorta round under each rib
    const thor = (t) => [0, 0.656 + t * 0.196, -0.03];
    for (let i = 2; i < 11; i++) {
      const y = 0.852 - (i + 0.5) * 0.0163;
      for (const s of [-1, 1]) {
        vessel(A, [at('chest', [0.008, y, -0.032]), at('chest', [s * 0.03, y - 0.002, -0.05]), at('chest', [s * 0.06, y - 0.008, -0.04]), at('chest', [s * 0.074, y - 0.022, -0.004])], 0.0009, 0.0006);
      }
    }
    void thor;
  }

  for (const s of [-1, 1]) {
    const side = s > 0 ? 'left' : 'right';
    const X = (p) => [s * p[0], p[1], p[2]];
    const C = (jn, p) => at(jn, X(p));
    // which arm bone carries a point (by height), and which leg bone
    const armJ = (p) => (p[1] > 0.79 && p[0] < 0.1 ? 'Shoulder' : p[1] > 0.62 ? 'UpperArm' : p[1] > 0.447 ? 'LowerArm' : 'Hand');
    // A point on the arm or leg, carried by its bone; near a joint it is carried partly by the bone
    // on each side (as skin is), so a vessel bends round the joint in a smooth curve, bunching on the
    // inside of the bend and stretching on the outside, instead of folding sharply
    const blendAt = (jA, jB, yJ, w, p) => {
      const t = Math.min(1, Math.max(0, (yJ + w - p[1]) / (2 * w))), u = t * t * (3 - 2 * t);
      return u <= 0 ? at(jA, p) : u >= 1 ? at(jB, p) : lerp(at(jA, p), at(jB, p), u);
    };
    const AR = (p) => {
      const q = X(p), j = armJ(p);
      if (j === 'Shoulder') return at(side + j, q);
      if (Math.abs(p[1] - 0.612) < 0.03) return blendAt(side + 'UpperArm', side + 'LowerArm', 0.612, 0.03, q);
      if (Math.abs(p[1] - 0.44) < 0.015) return blendAt(side + 'LowerArm', side + 'Hand', 0.44, 0.015, q);
      return at(side + j, q);
    };
    const legJ = (p) => (p[1] > 0.49 ? null : p[1] > 0.258 ? 'UpperLeg' : p[1] > 0.044 || p[2] < -0.01 ? 'LowerLeg' : 'Foot');
    const LG = (p) => {
      const q = X(p), j = legJ(p);
      if (Math.abs(p[1] - 0.252) < 0.035) return blendAt(side + 'UpperLeg', side + 'LowerLeg', 0.252, 0.035, q);
      if (Math.abs(p[1] - 0.48) < 0.02 && p[2] > 0) return blendAt('hips', side + 'UpperLeg', 0.48, 0.02, q);
      return j ? at(side + j, q) : at('hips', q);
    };
    // a finger joint's rest position, in drawing units
    const fj = (n) => mul(S.joints.find((j) => j.name === side + n).pos, 1 / k);

    // ---- head and neck ----
    const art = group(side + 'HeadNeckArteries', 'artery', 0.0006), vn = group(side + 'HeadNeckVeins', 'vein', 0.0006);
    // common carotid up the neck beside the windpipe, splitting at the top of the throat
    const cTop = C('neck', [0.03, 0.902, 0.006]);
    vessel(art, [C('chest', s > 0 ? [0.016, 0.82, 0.01] : [0.018, 0.822, 0.018]), C('neck', [0.022, 0.86, -0.002]), C('neck', [0.026, 0.885, 0.002]), cTop], 0.0022, 0.0021);
    vessel(art, [cTop, C('head', hd(0.03, -0.03, 0.0)), C('head', hd(0.028, -0.008, -0.004))], 0.0018, 0.0016); // internal carotid, into the skull
    const ext = vessel(art, [cTop, C('head', hd(0.04, -0.04, 0.008)), C('head', hd(0.058, -0.018, -0.002)), C('head', hd(0.072, 0.0, -0.002))], 0.0016, 0.0013);
    // facial artery: over the jaw's edge in front of the chewing muscle, winding up beside the nose
    vessel(art, [C('head', hd(0.04, -0.04, 0.012)), C('jaw', hd(0.046, -0.07, 0.042)), C('jaw', hd(0.044, -0.05, 0.07)), C('head', hd(0.04, -0.024, 0.09)), C('head', hd(0.026, 0.0, 0.11)), C('head', hd(0.016, 0.025, 0.118))], 0.0011, 0.0007, { surface: true, wave: 1.2, lift: 0.4 });
    // the temple's artery in front of the ear, up and over the skull in two branches
    const tp = ext[ext.length - 1];
    vessel(art, [tp, C('head', hd(0.084, 0.03, 0.01)), C('head', hd(0.088, 0.07, 0.04)), C('head', hd(0.07, 0.12, 0.075))], 0.0011, 0.0006, { surface: true, wave: 1.5, lift: 0.5 });
    vessel(art, [C('head', hd(0.086, 0.04, 0.012)), C('head', hd(0.09, 0.09, -0.01)), C('head', hd(0.07, 0.14, -0.04))], 0.0009, 0.0005, { surface: true, wave: 1.5, lift: 0.5 });
    // internal jugular vein beside the carotid, and the external jugular on the surface of the neck
    vessel(vn, [C('head', hd(0.04, -0.012, -0.012)), C('neck', [0.036, 0.9, -0.01]), C('neck', [0.032, 0.865, -0.008]), C('chest', [0.03, 0.825, 0.012]), C('chest', [0.018, 0.815, 0.022])], 0.0026, 0.003);
    vessel(vn, [C('head', hd(0.062, -0.04, -0.012)), C('neck', [0.048, 0.89, -0.004]), C('neck', [0.05, 0.86, 0.006]), C('chest', [0.052, 0.832, 0.018]), C('chest', [0.046, 0.822, 0.026])], 0.0013, 0.0016, { surface: true, wave: 1.2, valves: true });
    // the temple's vein and the face's vein beside their arteries
    vessel(vn, [C('head', hd(0.074, 0.11, 0.0)), C('head', hd(0.09, 0.06, 0.02)), C('head', hd(0.08, 0.01, -0.006)), C('head', hd(0.066, -0.035, -0.012))], 0.0007, 0.0011, { surface: true, wave: 1.6, lift: 0.5 });
    vessel(vn, [C('head', hd(0.02, 0.03, 0.115)), C('head', hd(0.034, -0.002, 0.104)), C('jaw', hd(0.05, -0.05, 0.06)), C('jaw', hd(0.05, -0.07, 0.035)), C('head', hd(0.042, -0.042, 0.0))], 0.0006, 0.001, { surface: true, wave: 1.4, lift: 0.4 });

    // ---- the arm ----
    const aa = group(side + 'ArmArteries', 'artery', 0.0005), av = group(side + 'ArmVeins', 'vein', 0.0005);
    // subclavian under the collarbone, then axillary through the armpit, brachial down the inner arm
    const sub0 = s > 0 ? C('chest', [0.024, 0.815, 0.004]) : C('chest', [0.018, 0.822, 0.018]);
    vessel(aa, [sub0, C('chest', [0.045, 0.826, 0.012]), at(side + 'Shoulder', X([0.075, 0.815, 0.008])), AR([0.098, 0.78, -0.004]), AR([0.108, 0.72, -0.002]), AR([0.111, 0.66, 0.004]), AR([0.118, 0.628, 0.012]), AR([0.124, 0.6, 0.012])], 0.0025, 0.0017);
    // at the elbow it splits: the radial artery down the thumb side (where the pulse is felt at the
    // wrist), the ulnar down the little-finger side; they join again in arches across the palm
    vessel(aa, [AR([0.124, 0.6, 0.012]), AR([0.13, 0.55, 0.014]), AR([0.128, 0.49, 0.016]), AR([0.125, 0.455, 0.017]), AR([0.122, 0.432, 0.02]), AR([0.126, 0.425, 0.012])], 0.0013, 0.0011);
    vessel(aa, [AR([0.124, 0.6, 0.012]), AR([0.114, 0.56, -0.004]), AR([0.112, 0.5, -0.012]), AR([0.113, 0.455, -0.013]), AR([0.112, 0.432, -0.012])], 0.0014, 0.0011);
    const arch = vessel(aa, [AR([0.112, 0.432, -0.012]), AR([0.109, 0.415, -0.008]), AR([0.108, 0.405, 0.002]), AR([0.109, 0.41, 0.014]), AR([0.114, 0.424, 0.02])], 0.0009, 0.0008);
    // deep veins beside the arteries (paired, as they are in the limbs)
    vessel(av, [AR([0.12, 0.6, 0.008]), AR([0.108, 0.66, 0.0]), AR([0.104, 0.72, -0.006]), AR([0.094, 0.78, -0.008]), at(side + 'Shoulder', X([0.072, 0.81, 0.004])), C('chest', [0.045, 0.822, 0.02]), C('chest', [0.024, 0.818, 0.022])], 0.0015, 0.0026);
    // the back of the hand: the network of veins over the knuckles, gathering into an arch
    const hb = 0.128;
    const dorsal = vessel(av, [AR([0.126, 0.43, -0.016]), AR([hb, 0.415, -0.013]), AR([hb + 0.001, 0.398, -0.005]), AR([hb + 0.001, 0.396, 0.004]), AR([hb, 0.405, 0.012]), AR([0.126, 0.425, 0.018])], 0.0008, 0.0009, { surface: true, wave: 1.0, lift: 0.4 });
    void dorsal;
    for (const [i, f] of ['Index', 'Middle', 'Ring', 'Little'].entries()) {
      const pj = fj(f + 'Proximal'), ij = fj(f + 'Intermediate');
      // a small vein from the back of each finger up between the knuckles to the arch
      const z0 = pj[2];
      const XX = (p) => p; // (finger joints are already on their own side)
      vessel(av, [at(side + f + 'Proximal', add(lerp(pj, ij, 0.5), [s * 0.004, 0, 0])), at(side + f + 'Proximal', add(pj, [s * 0.004, 0.0, 0])), AR([hb, 0.378, z0 - 0.002 * (i - 1.5)]), AR([hb + 0.001, 0.396, z0 * 0.6])], 0.0004, 0.0006, { surface: true, wave: 0.8, lift: 0.4 });
      // the palm's arch sends an artery down each side of each finger (on the palm side)
      const dj = fj(f + 'Distal');
      const tip = add(dj, mul(sub(dj, ij), 0.75));
      for (const dz of [-0.0026, 0.0026]) {
        const o = [-s * 0.0028, 0, dz];
        vessel(aa, [arch[Math.round(((3 - i) / 3) * (arch.length - 1) * 0.7 + 1)], at(side + f + 'Proximal', add(pj, o)), at(side + f + 'Proximal', add(lerp(pj, ij, 0.5), o)), at(side + f + 'Intermediate', add(ij, o)), at(side + f + 'Intermediate', add(lerp(ij, dj, 0.5), o)), at(side + f + 'Distal', add(dj, o)), at(side + f + 'Distal', add(lerp(dj, tip, 0.7), o))], 0.00055, 0.0004);
      }
    }
    { // the thumb's arteries
      const m = fj('ThumbMetacarpal'), p1 = fj('ThumbProximal'), d1 = fj('ThumbDistal'), tip = add(d1, mul(sub(d1, p1), 0.7));
      for (const dz of [-0.0026, 0.0026]) {
        const o = [-s * 0.003, 0, dz];
        vessel(aa, [arch[arch.length - 1], at(side + 'ThumbMetacarpal', add(lerp(m, p1, 0.6), o)), at(side + 'ThumbProximal', add(p1, o)), at(side + 'ThumbProximal', add(lerp(p1, d1, 0.5), o)), at(side + 'ThumbDistal', add(d1, o)), at(side + 'ThumbDistal', add(lerp(d1, tip, 0.7), o))], 0.0006, 0.0004);
      }
    }
    // cephalic vein: from the thumb side of the hand's arch, up the thumb side of the forearm, past
    // the elbow on the outside of the biceps, into the groove between shoulder and chest
    const ceph = vessel(av, [AR([0.126, 0.425, 0.018]), AR([0.128, 0.445, 0.02]), AR([0.134, 0.49, 0.02]), AR([0.14, 0.55, 0.02]), AR([0.142, 0.6, 0.016]), AR([0.142, 0.64, 0.014]), AR([0.14, 0.7, 0.016]), AR([0.134, 0.76, 0.02]), at(side + 'Shoulder', X([0.112, 0.8, 0.03])), at(side + 'Shoulder', X([0.09, 0.82, 0.03])), at(side + 'Shoulder', X([0.075, 0.818, 0.02]))], 0.0013, 0.0017, { surface: true, wave: 1.6, valves: true });
    // basilic vein: from the little-finger side, up the back-inner forearm, the inner elbow, then deep mid-arm
    const bas = vessel(av, [AR([0.126, 0.43, -0.016]), AR([0.122, 0.46, -0.022]), AR([0.118, 0.51, -0.026]), AR([0.11, 0.57, -0.02]), AR([0.103, 0.61, -0.01]), AR([0.102, 0.65, -0.006]), AR([0.103, 0.69, -0.006]), AR([0.106, 0.72, -0.004])], 0.0013, 0.0018, { surface: true, wave: 1.6, valves: true });
    // median cubital vein: the slanting link across the front of the elbow (where blood is taken)
    const at6 = (path, y) => path.reduce((b, q) => (Math.abs(q[1] - y) < Math.abs(b[1] - y) ? q : b), path[0]);
    const yC = AR([0.142, 0.598, 0.016])[1], yB = AR([0.103, 0.625, -0.01])[1];
    vessel(av, [AR([0.141, 0.598, 0.017]), AR([0.13, 0.606, 0.022]), AR([0.115, 0.616, 0.014]), AR([0.104, 0.622, -0.008])], 0.0016, 0.0016, { surface: true, wave: 0.6 });
    void at6; void yC; void yB;
    // where the surface veins dive in to join the deep veins: the basilic in the middle of the arm,
    // the cephalic under the collarbone
    vessel(av, [bas[bas.length - 1], AR([0.105, 0.725, -0.005]), AR([0.103, 0.735, -0.006])], 0.0024, 0.0022);
    vessel(av, [ceph[ceph.length - 1], C('chest', [0.06, 0.822, 0.022]), C('chest', [0.045, 0.822, 0.02])], 0.0023, 0.0024);
    // median vein of the forearm: up the middle of the front of the forearm into the median cubital
    vessel(av, [AR([0.115, 0.452, 0.006]), AR([0.115, 0.5, 0.012]), AR([0.12, 0.55, 0.018]), AR([0.124, 0.603, 0.02])], 0.0008, 0.001, { surface: true, wave: 1.8, valves: true });

    // ---- the leg ----
    const la = group(side + 'LegArteries', 'artery', 0.0006), lv = group(side + 'LegVeins', 'vein', 0.0006);
    // common iliac from the aorta's fork, the external iliac along the pelvis's rim, under the groin's
    // ligament into the femoral artery down the front-inner thigh
    vessel(la, [at('spine', [0.0, 0.578, 0.02]), at('hips', X([0.02, 0.555, 0.022])), at('hips', X([0.036, 0.53, 0.024])), at('hips', X([0.05, 0.506, 0.032])), at('hips', X([0.058, 0.49, 0.042])), LG([0.06, 0.45, 0.032]), LG([0.056, 0.39, 0.016]), LG([0.05, 0.33, -0.004]), LG([0.052, 0.29, -0.02]), LG([0.055, 0.262, -0.024]), LG([0.055, 0.235, -0.022])], 0.0036, 0.0024);
    // the internal iliac artery into the pelvis
    vessel(la, [at('hips', X([0.02, 0.553, 0.022])), at('hips', X([0.028, 0.53, 0.0])), at('hips', X([0.032, 0.505, -0.012]))], 0.0018, 0.0012);
    // deep artery of the thigh, behind and outside
    vessel(la, [LG([0.06, 0.455, 0.034]), LG([0.07, 0.42, 0.01]), LG([0.076, 0.37, -0.008]), LG([0.078, 0.31, -0.012])], 0.0018, 0.0012);
    // below the knee: anterior tibial through to the front of the shin and on to the top of the foot
    // (the pulse on the foot); posterior tibial behind the inner ankle into the sole; the fibular
    vessel(la, [LG([0.055, 0.235, -0.022]), LG([0.062, 0.21, -0.008]), LG([0.066, 0.2, 0.006]), LG([0.063, 0.14, 0.012]), LG([0.058, 0.08, 0.014]), LG([0.052, 0.05, 0.02]), LG([0.047, 0.036, 0.038]), LG([0.042, 0.028, 0.06]), LG([0.036, 0.02, 0.085])], 0.0014, 0.0009);
    vessel(la, [LG([0.055, 0.235, -0.022]), LG([0.05, 0.2, -0.024]), LG([0.046, 0.13, -0.02]), LG([0.04, 0.07, -0.016]), LG([0.036, 0.046, -0.012]), LG([0.04, 0.012, 0.0]), LG([0.05, 0.006, 0.03]), LG([0.064, 0.006, 0.06]), LG([0.05, 0.007, 0.085]), LG([0.034, 0.008, 0.09])], 0.0015, 0.0009);
    vessel(la, [LG([0.052, 0.21, -0.024]), LG([0.064, 0.17, -0.02]), LG([0.07, 0.1, -0.016]), LG([0.07, 0.055, -0.014])], 0.001, 0.0008);
    // the deep veins: femoral and popliteal beside the artery, larger
    vessel(lv, [LG([0.05, 0.235, -0.026]), LG([0.05, 0.262, -0.028]), LG([0.046, 0.29, -0.024]), LG([0.044, 0.33, -0.008]), LG([0.048, 0.39, 0.014]), LG([0.052, 0.45, 0.03]), at('hips', X([0.05, 0.49, 0.04])), at('hips', X([0.042, 0.506, 0.03])), at('hips', X([0.028, 0.53, 0.02])), at('hips', X([0.012, 0.556, 0.018])), at('spine', [-0.004, 0.574, 0.016])], 0.0028, 0.0042);
    // the top of the foot: the arch of surface veins across the bases of the toes
    const fArch = vessel(lv, [LG([0.03, 0.02, 0.068]), LG([0.042, 0.03, 0.074]), LG([0.058, 0.03, 0.074]), LG([0.072, 0.024, 0.062]), LG([0.082, 0.016, 0.046])], 0.0009, 0.001, { surface: true, wave: 1.0, lift: 0.45 });
    for (const [x, z] of [[0.026, 0.1], [0.042, 0.1], [0.058, 0.097], [0.072, 0.09], [0.085, 0.08]]) {
      const tgt = fArch.reduce((b, q) => (len(sub(q, LG([x, 0.026, 0.072]))) < len(sub(b, LG([x, 0.026, 0.072]))) ? q : b), fArch[0]);
      vessel(lv, [LG([x, 0.012, z]), LG([x, 0.02, z - 0.015]), tgt], 0.0004, 0.0006, { surface: true, wave: 0.6, lift: 0.45 });
    }
    // great saphenous vein: from the inner end of the arch, in front of the inner ankle, up the inner
    // shin, behind the inner knee, up the inner thigh to the groin; the longest vein of the body
    vessel(lv, [fArch[0], LG([0.032, 0.04, 0.03]), LG([0.033, 0.06, 0.012]), LG([0.036, 0.1, 0.004]), LG([0.038, 0.16, -0.004]), LG([0.036, 0.22, -0.012]), LG([0.034, 0.25, -0.016]), LG([0.034, 0.29, -0.012]), LG([0.036, 0.35, 0.0]), LG([0.042, 0.41, 0.016]), LG([0.048, 0.455, 0.034]), at('hips', X([0.052, 0.478, 0.044]))], 0.0013, 0.0018, { surface: true, wave: 1.5, valves: true });
    // small saphenous vein: from the outer end of the arch, behind the outer ankle, up the middle of
    // the back of the calf into the deep vein behind the knee
    vessel(lv, [fArch[fArch.length - 1], LG([0.08, 0.02, 0.02]), LG([0.078, 0.03, -0.018]), LG([0.07, 0.06, -0.032]), LG([0.062, 0.12, -0.042]), LG([0.056, 0.18, -0.046]), LG([0.054, 0.225, -0.036]), LG([0.05, 0.245, -0.028])], 0.0011, 0.0015, { surface: true, wave: 1.5, valves: true });
    // the vein over the belly from the groin (superficial epigastric)
    vessel(lv, [at('hips', X([0.05, 0.48, 0.046])), at('hips', X([0.044, 0.52, 0.06])), at('spine', X([0.042, 0.57, 0.068])), at('spine', X([0.046, 0.62, 0.068])), C('chest', [0.054, 0.66, 0.06])], 0.0006, 0.0009, { surface: true, wave: 2, valves: false, lift: 0.4 });
  }
  return parts;
}
