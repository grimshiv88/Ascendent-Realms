// The muscles over a skeleton (skeleton.js): each muscle is drawn the way an anatomy model shows
// it, as bundles of fibres running from where it starts on one bone (origin) to where it pulls on
// another (insertion), fat in the middle (the belly) and narrowing into white tendons at the ends.
// Every point is given on the bone that carries it, at rest, then carried into the creature's pose,
// so a muscle that crosses a joint bends with it. Plain numbers and arrays only (no three.js).
import { cone } from './sdf.js';
import { goblinArmMuscles } from './armMuscles.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const bez = (p0, p1, p2, t) => lerp(lerp(p0, p1, t), lerp(p1, p2, t), t);

// rotation matrices (row-major 3x3), the same order three.js uses for an 'XYZ' euler: Rx * Ry * Rz
function eulerM([x, y, z]) {
  const a = Math.cos(x), b = Math.sin(x), c = Math.cos(y), d = Math.sin(y), e = Math.cos(z), f = Math.sin(z);
  const ae = a * e, af = a * f, be = b * e, bf = b * f;
  return [c * e, -c * f, d, af + be * d, ae - bf * d, -b * c, bf - ae * d, be + af * d, a * c];
}
const mm = (A, B) => { const R = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]; return R; };
const mv = (A, v) => [A[0] * v[0] + A[1] * v[1] + A[2] * v[2], A[3] * v[0] + A[4] * v[1] + A[5] * v[2], A[6] * v[0] + A[7] * v[1] + A[8] * v[2]];

// Catmull-Rom through points
function spline(pts, steps) {
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 1; k <= steps; k++) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      out.push([0, 1, 2].map((j) => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  return out;
}

// Forward kinematics for a skeleton (skeleton.js) in its pose (or at rest): each joint's world
// rotation R (row-major 3x3) and position p, and `at(joint, point)` that carries a point given at
// rest on that joint (in the skeleton's drawing units, before scaling) into the pose.
export function poseRig(S, posed = true) {
  const k = S.scale, J = {};
  for (const j of S.joints) {
    const R0 = posed && S.pose[j.name] ? eulerM(S.pose[j.name]) : [1, 0, 0, 0, 1, 0, 0, 0, 1];
    if (!j.parent) { J[j.name] = { R: R0, p: j.pos, rest: j.pos }; continue; }
    const P = J[j.parent];
    J[j.name] = { R: mm(P.R, R0), p: add(P.p, mv(P.R, sub(j.pos, P.rest))), rest: j.pos };
  }
  const at = (jn, p) => { const q = J[jn]; return add(q.p, mv(q.R, sub(mul(p, k), q.rest))); };
  const atScaled = (jn, p) => { const q = J[jn]; return add(q.p, mv(q.R, sub(p, q.rest))); }; // p already scaled
  return { J, at, atScaled, k };
}

const FULL = 1.38;

export function goblinMuscles(S, { posed = true } = {}) {
  const k = S.scale;
  const { at } = poseRig(S, posed);
  const H0 = [0, 0.922, -0.036];
  const hd = (x, y, z) => [H0[0] + x, H0[1] + y, H0[2] + z];

  const parts = [];
  const muscle = (name) => {
    const m = { name, joint: null, mat: 'muscle', cell: 0.0013 * k / 0.864, shapes: [] };
    const t = { name: name + 'Tendons', joint: null, mat: 'tendon', cell: 0.0011 * k / 0.864, shapes: [] };
    parts.push(m, t);
    return { m: m.shapes, t: t.shapes };
  };
  // One bundle of fibres along posed points `pts`: the belly r thick at its fattest (drawing units),
  // tendons ta / tb (fractions of the length) at each end, fat at `peak` (0..1 along the belly).
  // Bundles of the same muscle melt together (blend) into one sheet, with a soft groove between.
  const fibre = (M, pts, r, { ta = 0.08, tb = 0.12, peak = 0.5, tr = 0.22, blend = 0.0055, steps = 6, flat = 1 } = {}) => {
    r *= FULL; // (the goblin's muscles, filled out so neighbouring bundles meet)
    const p = spline(pts, steps), n = p.length - 1;
    const L = [0]; for (let i = 1; i <= n; i++) L.push(L[i - 1] + len(sub(p[i], p[i - 1])));
    const total = L[n];
    const R = (u) => {
      if (u < ta || u > 1 - tb) return r * tr;
      const v = (u - ta) / (1 - ta - tb), w = v < peak ? v / peak : (1 - v) / (1 - peak);
      return r * tr + (r - r * tr) * Math.pow(Math.sin(w * Math.PI / 2), 0.75);
    };
    for (let i = 0; i < n; i++) {
      const u0 = L[i] / total, u1 = L[i + 1] / total, um = (u0 + u1) / 2;
      const tendon = um < ta || um > 1 - tb;
      (tendon ? M.t : M.m).push(cone(p[i], p[i + 1], R(u0) * k * flat, R(u1) * k * flat, { blend: (i ? 0.0006 : blend) * k / 0.864 }));
    }
  };
  // A fan: bundles from each origin point to the insertion (or to matching insertion points)
  const fan = (M, origins, ins, r, opts = {}, via = null) => {
    origins.forEach((o, i) => {
      const t = origins.length > 1 ? i / (origins.length - 1) : 0.5;
      const e = Array.isArray(ins[0]) ? ins[Math.round(t * (ins.length - 1))] : ins;
      const mid = via ? via(o, e, t) : null;
      fibre(M, mid ? [o, ...[].concat(mid.length && Array.isArray(mid[0]) ? mid : [mid]), e] : [o, e], r, opts);
    });
  };

  // the spine's back line (the tips of the back spikes), at rest, from bottom (t 0) to top (t 1)
  const thor = (t) => add(bez([0, 0.656, -0.03], [0, 0.755, -0.088], [0, 0.852, -0.048], t), [0, -0.008, -0.03]);
  const lumb = (t) => add(bez([0, 0.552, -0.016], [0, 0.605, -0.006], [0, 0.656, -0.03], t), [0, -0.004, -0.03]);
  const neck = (t) => add(bez([0, 0.852, -0.048], [0, 0.89, -0.026], [0, 0.918, -0.036], t), [0, 0, -0.022]);

  for (const s of [-1, 1]) {
    const side = s > 0 ? 'left' : 'right';
    const X = (p) => [s * p[0], p[1], p[2]];
    const B = (jn, p) => at(side + jn, X(p)); // a point on this side's limb bone
    const C = (jn, p) => at(jn, X(p));        // a point on a middle bone, on this side

    // ---- head and neck ----
    { // temporalis: a fan on the side of the skull, down under the cheek arch to the jaw
      const M = muscle(side + 'Temporalis');
      const o = []; for (let i = 0; i < 6; i++) { const a = -0.6 + i * 0.36; o.push(C('head', hd(0.093 - Math.abs(a) * 0.006, 0.045 + Math.cos(a) * 0.028, 0.03 + Math.sin(a) * 0.045))); }
      fan(M, o, C('jaw', hd(0.058, -0.004, 0.022)), 0.0055, { ta: 0.02, tb: 0.25, peak: 0.3 }, (oo, e) => lerp(oo, e, 0.5).map((v, i) => v + (i === 0 ? s * 0.004 * k : 0)));
    }
    { // masseter: from the cheek arch down to the angle of the jaw
      const M = muscle(side + 'Masseter');
      for (let i = 0; i < 4; i++) fibre(M, [C('head', hd(0.07, 0.008, 0.05 - i * 0.012)), C('jaw', hd(0.058, -0.05, 0.03 - i * 0.012))], 0.0058, { ta: 0.12, tb: 0.06 });
    }
    { // sternocleidomastoid: behind the ear down the side of the neck to the breastbone and collarbone
      const M = muscle(side + 'Sternocleidomastoid');
      fibre(M, [C('head', hd(0.062, -0.014, -0.03)), C('neck', [0.03, 0.882, 0.0]), C('chest', [0.012, 0.818, 0.045])], 0.0065, { ta: 0.08, tb: 0.15 });
      fibre(M, [C('head', hd(0.066, -0.006, -0.035)), C('neck', [0.036, 0.88, -0.008]), at(side + 'Shoulder', X([0.032, 0.826, 0.046]))], 0.0058, { ta: 0.06, tb: 0.1 });
    }
    { // trapezius: a thin diamond sheet from the skull and the whole upper spine to the shoulder
      const M = muscle(side + 'Trapezius');
      const o = [C('head', hd(0.012, 0.012, -0.095)), C('head', hd(0.03, 0.0, -0.088)), C('neck', neck(0.75)), C('neck', neck(0.4)), C('neck', neck(0.05)), C('chest', thor(0.92)), C('chest', thor(0.75)), C('chest', thor(0.58)), C('chest', thor(0.42)), C('chest', thor(0.25)), C('chest', thor(0.08))];
      const sh = side + 'Shoulder';
      const ins = [at(sh, X([0.078, 0.832, 0.022])), at(sh, X([0.09, 0.834, 0.008])), at(sh, X([0.1, 0.836, -0.008])), at(sh, X([0.104, 0.836, -0.016])), at(sh, X([0.095, 0.828, -0.045])), at(sh, X([0.08, 0.818, -0.072])), at(sh, X([0.066, 0.812, -0.08])), at(sh, X([0.052, 0.805, -0.083])), at(sh, X([0.042, 0.802, -0.083])), at(sh, X([0.038, 0.8, -0.083])), at(sh, X([0.036, 0.8, -0.083]))];
      fan(M, o, ins, 0.0032, { ta: 0.06, tb: 0.06, peak: 0.45, tr: 0.45, blend: 0.006 }, (oo, e, t) => {
        const m = lerp(oo, e, 0.5); return t < 0.4 ? add(m, [0, 0.004 * k, -0.006 * k]) : add(m, [0, 0, -0.004 * k]);
      });
    }

    // ---- chest, belly and back ----
    { // pectoralis major: a fan from the collarbone, breastbone and ribs to the upper arm bone
      const M = muscle(side + 'Pectoralis');
      const o = [at(side + 'Shoulder', X([0.03, 0.824, 0.05])), at(side + 'Shoulder', X([0.05, 0.828, 0.05])), at(side + 'Shoulder', X([0.068, 0.83, 0.04]))];
      for (let i = 0; i < 6; i++) { const y = 0.808 - i * 0.017; o.push(C('chest', [0.013, y, 0.05 + i * 0.004])); }
      o.push(C('chest', [0.035, 0.708, 0.065]));
      const ins = B('UpperArm', [0.123, 0.772, 0.004]);
      fan(M, o, ins, 0.0062, { ta: 0.02, tb: 0.14, peak: 0.4, blend: 0.006 }, (oo, e, t) => add(lerp(oo, e, 0.45), [0, 0, (0.012 + t * 0.006) * k]));
    }
    { // latissimus dorsi: the wide back muscle, from the lower spine and hip to under the arm
      const M = muscle(side + 'Latissimus');
      const o = [C('chest', thor(0.5)), C('chest', thor(0.38)), C('chest', thor(0.24)), C('chest', thor(0.1)), C('spine', lumb(0.7)), C('spine', lumb(0.35)), at('hips', X([0.03, 0.56, -0.05])), at('hips', X([0.06, 0.575, -0.04]))];
      const ins = B('UpperArm', [0.116, 0.774, -0.004]);
      fan(M, o, ins, 0.0042, { ta: 0.3, tb: 0.12, peak: 0.6, tr: 0.65, blend: 0.006 }, (oo, e, t) => [C('chest', [0.07 + t * 0.012, 0.72 - t * 0.01, -0.07 + t * 0.02]), C('chest', [0.092, 0.765, -0.045])]);
    }
    { // serratus anterior: finger-like slips on the side of the ribs, running back under the shoulder blade
      const M = muscle(side + 'Serratus');
      for (let i = 0; i < 6; i++) {
        const y = 0.79 - i * 0.017;
        fibre(M, [C('chest', [0.072 + Math.min(i, 3) * 0.003, y - 0.012, 0.012 + i * 0.002]), C('chest', [0.083, y - 0.004, -0.02]), at(side + 'Shoulder', X([0.05, 0.808 - i * 0.015, -0.074]))], 0.0042, { ta: 0.04, tb: 0.2, peak: 0.35, blend: 0.004 });
      }
    }
    { // external oblique: from the lower ribs down and forward to the hip's crest and the belly's midline
      const M = muscle(side + 'Oblique');
      for (let i = 0; i < 6; i++) {
        const y = 0.735 - i * 0.016;
        const o = C('chest', [0.074, y, 0.022 - i * 0.004]);
        const e = i < 3 ? C('spine', [0.035, 0.6 - i * 0.012, 0.064]) : at('hips', X([0.088 - (i - 3) * 0.001, 0.566, 0.012 - (i - 3) * 0.012]));
        fibre(M, [o, add(lerp(o, e, 0.5), [s * 0.005 * k, 0, 0.004 * k]), e], 0.0048, { ta: 0.05, tb: i < 3 ? 0.35 : 0.12, peak: 0.4, blend: 0.006 });
      }
    }
    { // rectus abdominis: the strap down the belly, crossed by three tendon lines (the "six-pack")
      const M = muscle(side + 'RectusAbdominis');
      for (const dx of [0.009, 0.02]) {
        const pts = [at('hips', X([dx * 0.6 + 0.004, 0.476, 0.05])), at('spine', X([dx, 0.56, 0.066])), at('spine', X([dx, 0.62, 0.07])), C('chest', [dx + 0.004, 0.672, 0.072]), C('chest', [dx + 0.01, 0.712, 0.066])];
        fibre(M, pts, 0.0065, { ta: 0.05, tb: 0.04, peak: 0.6, tr: 0.55, blend: 0.006, flat: 0.95 });
      }
      for (const y of [0.592, 0.63, 0.666]) { const j = y < 0.655 ? 'spine' : 'chest'; M.t.push(cone(at(j, X([0.004, y, 0.073])), at(j, X([0.027, y + 0.002, 0.071])), 0.0022 * k, 0.0022 * k, { blend: 0.001 })); }
    }
    { // the columns along the spine (erector spinae): thick in the lower back, thin up to the neck
      const M = muscle(side + 'ErectorSpinae');
      for (const [dx, r] of [[0.016, 0.0085], [0.03, 0.0075], [0.042, 0.0055]]) {
        fibre(M, [at('hips', X([dx * 0.8, 0.52, -0.052])), at('spine', X([dx, 0.6, -0.05])), C('chest', add(thor(0.25), [s * 0, 0, 0]).map((v, i) => i === 0 ? dx : i === 2 ? v + 0.002 : v)), C('chest', add(thor(0.6), [0, 0, 0]).map((v, i) => i === 0 ? dx * 0.95 : i === 2 ? v + 0.004 : v)), C('chest', thor(0.9).map((v, i) => i === 0 ? dx * 0.8 : i === 2 ? v + 0.008 : v))], r, { ta: 0.04, tb: 0.06, peak: 0.25, tr: 0.35, blend: 0.005 });
      }
    }
    { // rhomboids: from the upper spine to the inner edge of the shoulder blade
      const M = muscle(side + 'Rhomboid');
      for (let i = 0; i < 4; i++) fibre(M, [C('chest', thor(0.95 - i * 0.12)), at(side + 'Shoulder', X([0.038 + i * 0.006, 0.815 - i * 0.026, -0.083]))], 0.0035, { ta: 0.12, tb: 0.06, blend: 0.004 });
    }


    { // internal oblique: under the outer oblique, from the hip's crest fanning up and in to the
      // lower ribs and the belly's midline (it fills the flank above the hip)
      const M = muscle(side + 'InternalOblique');
      for (let i = 0; i < 6; i++) {
        const t = i / 5, o = at('hips', X([0.05 + t * 0.036, 0.574 - Math.abs(t - 0.5) * 0.012, -0.03 + t * 0.065]));
        const e = t < 0.5 ? C('chest', [0.07 - t * 0.04, 0.68 - t * 0.02, 0.0 + t * 0.06]) : at('spine', X([0.03, 0.61 - (t - 0.5) * 0.05, 0.066]));
        fibre(M, [o, add(lerp(o, e, 0.5), [s * 0.008 * k, 0, 0.006 * k]), e], 0.0042, { ta: 0.04, tb: 0.2, peak: 0.4, blend: 0.006 });
      }
    }
    { // the back of the neck: splenius from the spine up to behind the ear, the levator from the neck
      // down to the shoulder blade, and the scalenes on the side of the neck to the first rib
      const M = muscle(side + 'NeckMuscles');
      fibre(M, [C('chest', thor(0.85)), C('neck', [0.012, 0.87, -0.065]), C('neck', [0.03, 0.9, -0.06]), C('head', hd(0.058, -0.006, -0.05))], 0.006, { ta: 0.06, tb: 0.1, peak: 0.5 });
      fibre(M, [C('neck', [0.022, 0.905, -0.04]), C('neck', [0.034, 0.875, -0.05]), at(side + 'Shoulder', X([0.042, 0.826, -0.064]))], 0.0055, { ta: 0.1, tb: 0.1 });
      fibre(M, [C('neck', [0.022, 0.9, -0.02]), C('neck', [0.034, 0.865, -0.016]), C('chest', [0.036, 0.832, -0.01])], 0.0055, { ta: 0.08, tb: 0.1 });
    }
    { // tensor fasciae latae: from the front point of the hip down the outer thigh into its long
      // tendon band (the iliotibial band) that reaches below the knee
      const M = muscle(side + 'TensorFasciae');
      fibre(M, [at('hips', X([0.088, 0.548, 0.026])), B('UpperLeg', [0.098, 0.49, 0.016]), B('UpperLeg', [0.104, 0.44, 0.008]), B('UpperLeg', [0.098, 0.36, 0.0]), B('UpperLeg', [0.082, 0.28, 0.0]), B('LowerLeg', [0.072, 0.236, 0.006])], 0.0065, { ta: 0.03, tb: 0.62, peak: 0.45, tr: 0.45 });
    }
    { // iliopsoas: from inside the hip's wing and the lower spine, over the front of the hip joint
      const M = muscle(side + 'Iliopsoas');
      fibre(M, [at('spine', X([0.022, 0.62, -0.006])), at('hips', X([0.045, 0.53, 0.012])), at('hips', X([0.05, 0.49, 0.036])), B('UpperLeg', [0.07, 0.448, 0.0])], 0.0075, { ta: 0.03, tb: 0.15, peak: 0.45 });
      fibre(M, [at('hips', X([0.07, 0.56, 0.0])), at('hips', X([0.06, 0.51, 0.03])), B('UpperLeg', [0.07, 0.448, 0.0])], 0.0068, { ta: 0.03, tb: 0.15 });
    }

    // ---- the arm: see armMuscles.js ----

    // ---- the leg ----
    { // gluteus maximus: the big seat muscle, from the back of the hip and sacrum to the thigh bone
      const M = muscle(side + 'GluteusMaximus');
      const o = []; for (let i = 0; i < 7; i++) { const t = i / 6; o.push(at('hips', X([0.012 + t * 0.06, 0.465 + t * 0.1 - t * t * 0.02, -0.05 - (1 - t) * 0.008]))); }
      fan(M, o, [B('UpperLeg', [0.088, 0.47, -0.012]), B('UpperLeg', [0.09, 0.42, -0.01])], 0.0095, { ta: 0.03, tb: 0.12, peak: 0.4, blend: 0.007 }, (oo, e, t) => add(lerp(oo, e, 0.5), [s * 0.004 * k, 0, -0.016 * k]));
    }
    { // gluteus medius: from the outside of the hip's wing to the knob at the top of the thigh bone
      const M = muscle(side + 'GluteusMedius');
      for (let i = 0; i < 5; i++) { const t = i / 4; fibre(M, [at('hips', X([0.05 + t * 0.04, 0.572 - Math.abs(t - 0.6) * 0.01, -0.035 + t * 0.05])), at('hips', X([0.088 + t * 0.006, 0.535, -0.025 + t * 0.03])), B('UpperLeg', [0.098, 0.48, -0.002])], 0.0065, { ta: 0.04, tb: 0.15, peak: 0.4, blend: 0.006 }); }
    }
    { // quadriceps: four heads down the front of the thigh into the knee cap, then the tendon to the shin
      const M = muscle(side + 'Quadriceps');
      // rectus femoris (the middle), vastus lateralis (outside), vastus medialis (the teardrop inside)
      fibre(M, [at('hips', X([0.077, 0.52, 0.032])), B('UpperLeg', [0.082, 0.45, 0.022]), B('UpperLeg', [0.072, 0.37, 0.028]), B('UpperLeg', [0.062, 0.31, 0.026]), B('UpperLeg', [0.056, 0.284, 0.024])], 0.0088, { ta: 0.08, tb: 0.14, peak: 0.45 });
      fibre(M, [B('UpperLeg', [0.096, 0.46, 0.004]), B('UpperLeg', [0.1, 0.4, 0.004]), B('UpperLeg', [0.088, 0.33, 0.014]), B('UpperLeg', [0.068, 0.287, 0.022])], 0.0095, { ta: 0.03, tb: 0.15, peak: 0.45 });
      fibre(M, [B('UpperLeg', [0.072, 0.43, 0.006]), B('UpperLeg', [0.058, 0.36, 0.012]), B('UpperLeg', [0.045, 0.3, 0.014]), B('UpperLeg', [0.048, 0.28, 0.02])], 0.0088, { ta: 0.04, tb: 0.1, peak: 0.72 });
      fibre(M, [B('UpperLeg', [0.084, 0.44, 0.014]), B('UpperLeg', [0.074, 0.37, 0.016]), B('UpperLeg', [0.06, 0.3, 0.018])], 0.0072, { ta: 0.03, tb: 0.15 });
      fibre(M, [B('UpperLeg', [0.055, 0.262, 0.024]), B('LowerLeg', [0.055, 0.226, 0.019])], 0.0045, { ta: 0.5, tb: 0.5 }); // the knee cap's tendon
    }
    { // sartorius: the long thin strap from the front point of the hip, across the thigh, to inside the knee
      const M = muscle(side + 'Sartorius');
      fibre(M, [at('hips', X([0.086, 0.54, 0.036])), B('UpperLeg', [0.082, 0.47, 0.03]), B('UpperLeg', [0.06, 0.39, 0.03]), B('UpperLeg', [0.042, 0.32, 0.012]), B('UpperLeg', [0.035, 0.27, -0.006]), B('LowerLeg', [0.042, 0.225, 0.004])], 0.0042, { ta: 0.03, tb: 0.1, peak: 0.5, tr: 0.5 });
    }
    { // adductors: from the pubic bone fanning down the inside of the thigh
      const M = muscle(side + 'Adductors');
      for (let i = 0; i < 4; i++) {
        const o = at('hips', X([0.012 + i * 0.008, 0.465 - i * 0.008, 0.04 - i * 0.012]));
        fibre(M, [o, B('UpperLeg', [0.05 + i * 0.002, 0.42 - i * 0.03, 0.006 - i * 0.004]), B('UpperLeg', [0.068, 0.4 - i * 0.04, -0.008])], 0.0078 - i * 0.0004, { ta: 0.05, tb: 0.1, peak: 0.4, blend: 0.006 });
      }
      fibre(M, [at('hips', X([0.012, 0.462, 0.038])), B('UpperLeg', [0.042, 0.38, 0.002]), B('UpperLeg', [0.036, 0.29, -0.01]), B('LowerLeg', [0.042, 0.222, 0.0])], 0.0045, { ta: 0.04, tb: 0.15 }); // gracilis
    }
    { // hamstrings: from the sitting bone down the back of the thigh to either side of the knee
      const M = muscle(side + 'Hamstrings');
      fibre(M, [at('hips', X([0.05, 0.438, -0.016])), B('UpperLeg', [0.075, 0.38, -0.026]), B('UpperLeg', [0.08, 0.3, -0.022]), B('LowerLeg', [0.077, 0.234, -0.016])], 0.0085, { ta: 0.06, tb: 0.18 });
      fibre(M, [at('hips', X([0.044, 0.438, -0.015])), B('UpperLeg', [0.056, 0.38, -0.028]), B('UpperLeg', [0.045, 0.3, -0.024]), B('LowerLeg', [0.042, 0.226, -0.012])], 0.0082, { ta: 0.08, tb: 0.2 });
      fibre(M, [at('hips', X([0.047, 0.436, -0.01])), B('UpperLeg', [0.06, 0.37, -0.018]), B('UpperLeg', [0.052, 0.3, -0.016]), B('LowerLeg', [0.045, 0.232, -0.012])], 0.008, { ta: 0.15, tb: 0.1 });
    }
    { // calf: the two heads of the gastrocnemius over the soleus, joined into the heel cord
      const M = muscle(side + 'Calf');
      fibre(M, [B('UpperLeg', [0.044, 0.275, -0.018]), B('LowerLeg', [0.045, 0.21, -0.03]), B('LowerLeg', [0.05, 0.15, -0.026]), B('LowerLeg', [0.053, 0.08, -0.03]), B('Foot', [0.054, 0.02, -0.05])], 0.0095, { ta: 0.03, tb: 0.42, peak: 0.3 });
      fibre(M, [B('UpperLeg', [0.066, 0.275, -0.018]), B('LowerLeg', [0.066, 0.21, -0.028]), B('LowerLeg', [0.06, 0.15, -0.025]), B('LowerLeg', [0.055, 0.08, -0.03]), B('Foot', [0.054, 0.02, -0.05])], 0.0085, { ta: 0.03, tb: 0.45, peak: 0.28 });
      fibre(M, [B('LowerLeg', [0.068, 0.215, -0.018]), B('LowerLeg', [0.06, 0.15, -0.02]), B('LowerLeg', [0.055, 0.09, -0.024]), B('Foot', [0.054, 0.02, -0.048])], 0.008, { ta: 0.03, tb: 0.35, peak: 0.45 });
    }
    { // the front and outside of the shin: tibialis anterior to the inner foot, the toe extensors,
      // and the peroneus behind the outer ankle to the outer foot
      const M = muscle(side + 'Shin');
      fibre(M, [B('LowerLeg', [0.064, 0.225, 0.008]), B('LowerLeg', [0.064, 0.16, 0.014]), B('LowerLeg', [0.056, 0.08, 0.016]), B('Foot', [0.045, 0.048, 0.02]), B('Foot', [0.033, 0.028, 0.046])], 0.0062, { ta: 0.03, tb: 0.42, peak: 0.35 });
      fibre(M, [B('LowerLeg', [0.072, 0.21, 0.004]), B('LowerLeg', [0.072, 0.15, 0.008]), B('LowerLeg', [0.066, 0.08, 0.012]), B('Foot', [0.058, 0.044, 0.024]), B('Foot', [0.06, 0.022, 0.06]), B('Foot', [0.065, 0.012, 0.095])], 0.0048, { ta: 0.03, tb: 0.55, peak: 0.4 });
      fibre(M, [B('LowerLeg', [0.08, 0.22, -0.008]), B('LowerLeg', [0.082, 0.15, -0.008]), B('LowerLeg', [0.076, 0.08, -0.012]), B('Foot', [0.074, 0.035, -0.014]), B('Foot', [0.079, 0.016, 0.02]), B('Foot', [0.077, 0.014, 0.042])], 0.0052, { ta: 0.03, tb: 0.5, peak: 0.4 });
    }
    { // the foot: the big toe's muscle along the inner arch, the little toe's along the outer edge,
      // and the short toe extensor on top
      const M = muscle(side + 'FootMuscles');
      fibre(M, [B('Foot', [0.046, 0.008, -0.035]), B('Foot', [0.036, 0.008, 0.03]), B('Foot', [0.026, 0.006, 0.1])], 0.0052, { ta: 0.05, tb: 0.25 });
      fibre(M, [B('Foot', [0.064, 0.006, -0.035]), B('Foot', [0.08, 0.007, 0.03]), B('Foot', [0.086, 0.005, 0.08])], 0.0042, { ta: 0.05, tb: 0.25 });
      fibre(M, [B('Foot', [0.056, 0.006, -0.03]), B('Foot', [0.056, 0.005, 0.04]), B('Foot', [0.05, 0.004, 0.09])], 0.005, { ta: 0.05, tb: 0.3 });
      fibre(M, [B('Foot', [0.068, 0.026, 0.02]), B('Foot', [0.058, 0.026, 0.05]), B('Foot', [0.048, 0.02, 0.085])], 0.0038, { ta: 0.05, tb: 0.35 });
    }
  }
  // the shoulder, arm, forearm and hand, each muscle shaped on its own (armMuscles.js)
  parts.push(...goblinArmMuscles(S, { posed }));
  return parts;
}
