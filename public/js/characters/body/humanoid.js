// The plan of a two-legged body: its skeleton (down to every finger joint) and the shapes that
// are sculpted onto each bone (bones, muscles, joints, the face). Everything is laid out standing
// straight with the arms hanging ("rest"), in metres, facing +z, with the body's left at +x.
// The bones' names follow the VRM humanoid standard, so motions can be shared with other models.
import { cone, ell, loft, rotXYZ, alongDir, norm, fieldDist } from './sdf.js';

// The default: a young adult of 1.75 m. Every race changes some of these (see races.js).
export const BASE = {
  height: 1.75,
  head: 1,          // head size
  torso: 1,         // torso length
  legs: 1,          // leg length
  arms: 1,          // arm length
  shoulders: 1,     // shoulder width
  hips: 1,          // hip width
  waist: 1,         // waist width
  chest: 1,         // ribcage size
  bulk: 1,          // thickness of the limbs and body
  muscle: 0.3,      // 0 soft and slim .. 1 heavily muscled
  fat: 0.5,         // 0 lean .. 1 heavy: a soft layer over the whole body (a healthy amount by default)
  belly: 0,         // 0 .. 1
  neck: 1,          // neck thickness
  hands: 1, feet: 1,
  fingers: 1,       // finger length
  ears: 'round',    // 'round', 'elf', 'none' (animal ears are added on top, see races.js)
  earSize: 1,
  jaw: 1, chin: 1, nose: 1, cheeks: 1, brow: 0.3,
  eyes: 1,          // eye size
  claws: false,
  animalEars: null, // 'wolf', 'cat', 'fox': furred ears on top of the head (beastkin)
  tail: null,       // 'wolf', 'cat', 'fox'
  beard: 0,         // 0 none .. 1 a full, long beard (dwarves)
  tusks: 0,         // small tusks from the lower jaw (giants), 0 .. 1
  horns: 0,         // 0 none, 1 one horn in the middle of the forehead, 2 a pair (oni)
  hornLen: 1,
  moustache: 0,     // a thick moustache drooping past the mouth, 0 .. 1 (with a beard)
  braid: 0,         // a braid hanging from the beard's point, 0 .. 1 (its length)
  ridges: 0,        // a hard, lined face: furrows across the forehead and deep folds by the nose, 0 .. 1
  crown: 0,         // a ring of bone spikes round the head (a goblin emperor), 0 .. 1
};

// Fingers: [name, side offset across the palm (front is +), knuckle drop, segment lengths, radius]
const FINGERS = [
  ['Index', 0.027, 0.093, [0.043, 0.025, 0.021], 0.0092],
  ['Middle', 0.008, 0.097, [0.047, 0.029, 0.023], 0.0095],
  ['Ring', -0.011, 0.094, [0.044, 0.027, 0.022], 0.0088],
  ['Little', -0.028, 0.086, [0.035, 0.021, 0.019], 0.0078],
];
const SEGS = ['Proximal', 'Intermediate', 'Distal'];
// how far each finger fans out in the sculpting pose (radians about x)
const SPREAD = { Index: -0.13, Middle: -0.035, Ring: 0.06, Little: 0.16 };

export function humanoidPlan(opts = {}) {
  const P = { ...BASE, ...opts };
  const bones = [];
  const shapes = [];
  const pos = {};
  const bone = (name, parent, p, bind = null) => { bones.push({ name, parent, pos: p, bind }); pos[name] = p; };
  const put = (name, s) => { s.bone = name; shapes.push(s); return s; };
  const fat = P.fat;
  const b = P.bulk * (1 + 0.14 * fat), m = P.muscle;
  const add = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
  const mix = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];

  // ---- heights ----
  const legL = P.legs, tor = P.torso, hd = P.head;
  const ankleY = 0.085 * P.feet;
  const hipY = ankleY + 0.845 * legL;
  const kneeY = ankleY + 0.415 * legL;
  const T = (k) => hipY + k * tor; // a height up the torso

  // ---- the spine ----
  bone('hips', null, [0, T(0.05), 0]);
  bone('spine', 'hips', [0, T(0.13), -0.005]);
  bone('chest', 'spine', [0, T(0.27), -0.01]);
  bone('upperChest', 'chest', [0, T(0.4), -0.012]);
  bone('neck', 'upperChest', [0, T(0.545), -0.022]);
  bone('head', 'neck', [0, T(0.545) + 0.095 * Math.sqrt(hd), -0.006]);
  const headO = pos.head;
  const H = (x, y, z) => [headO[0] + x * hd, headO[1] + y * hd, headO[2] + z * hd]; // a point on the head

  const sw = P.shoulders, hw = P.hips * (1 + 0.08 * fat), ww = P.waist * (1 + 0.18 * fat), ch = P.chest;
  // The trunk, drawn slice by slice from the hips to the base of the neck: the seat behind, a flat
  // belly, a waist narrower than the ribs, the chest deepest at the front and widest under the arms
  const bl = P.belly + 0.15 * fat;
  const R = (k, rx, f, bk, cz = 0) => [T(k), rx * b, f * b, bk * b, cz];
  put('hips', loft([
    R(-0.1, 0.112 * hw, 0.066, 0.072),
    R(-0.05, 0.15 * hw, 0.078, 0.098, -0.008),
    R(0.0, 0.153 * hw, 0.08 + bl * 0.01, 0.096, -0.008),
    R(0.07, 0.138 * (hw + ww) / 2, 0.081 + bl * 0.03, 0.08),
    R(0.15, 0.121 * ww, 0.08 + bl * 0.045, 0.072),
    R(0.23, 0.133 * (ww + ch) / 2, 0.085 + bl * 0.03, 0.077),
    R(0.3, 0.149 * ch, 0.093, 0.085),
    R(0.37, 0.16 * ch, 0.098, 0.091),
    R(0.44, 0.165 * ch * sw, 0.094, 0.09, -0.004),
    R(0.5, 0.145 * sw, 0.07, 0.077, -0.01),
    R(0.55, 0.075, 0.042, 0.052, -0.02),
  ], { blend: 0.02, span: [['hips', T(0.02)], ['spine', T(0.15)], ['chest', T(0.29)], ['upperChest', T(0.42)]] }));
  // The muscles over the trunk, more defined the more muscled (def 0 soft .. 1 cut): each lies on
  // the skin with a soft edge, and the grooves between them are carved
  const def = Math.min(1, Math.max(0, (m - 0.15) / 0.6)) * (1 - 0.3 * fat); // (fat softens the muscles' edges)
  const front = (k) => { // how far forward the trunk's front is at height k (roughly)
    const ks = [[0.07, 0.081], [0.15, 0.08], [0.23, 0.085], [0.3, 0.093], [0.37, 0.098], [0.44, 0.094]];
    for (let i = 1; i < ks.length; i++) if (k <= ks[i][0]) { const t = (k - ks[i - 1][0]) / (ks[i][0] - ks[i - 1][0]); return (ks[i - 1][1] + (ks[i][1] - ks[i - 1][1]) * Math.max(0, t)) * b; }
    return 0.094 * b;
  };
  // the skin's place at the front, x across and k up the trunk (an ellipse round each slice)
  const rxAt = (k) => (k < 0.23 ? 0.121 * ww + (0.133 * (ww + ch) / 2 - 0.121 * ww) * Math.max(0, (k - 0.15) / 0.08) : k < 0.37 ? 0.133 * (ww + ch) / 2 + (0.16 * ch - 0.133 * (ww + ch) / 2) * Math.min(1, (k - 0.23) / 0.14) : 0.16 * ch) * b;
  const surf = (x, k) => front(k) * Math.sqrt(Math.max(0.05, 1 - (x / rxAt(k)) ** 2));
  // a groove carved along points [x, k] on the front of the trunk, r wide, `depth` deep
  // (measured on the skin as sculpted so far, so a groove is as deep as asked over any muscle)
  // (dir -1: on the back, marching from behind; the result is then the depth behind, as a positive z)
  const skinAt = (x, y, z0, dir = 1) => {
    const solid = shapes.filter((q) => !q.sub && !q.ghost);
    let z = z0;
    for (let i = 0; i < 60; i++) { const d = fieldDist(solid, x, y, dir * z); if (Math.abs(d) < 2e-5) break; z -= d; }
    return z;
  };
  const groove = (bn, pts, r, depth, opts = {}) => {
    const at = ([x, k]) => [x, T(k), skinAt(x, T(k), surf(x, k)) + r - depth];
    for (let i = 1; i < pts.length; i++) put(bn, cone(at(pts[i - 1]), at(pts[i]), r, r, { sub: true, blend: r * 1.6, ...opts }));
  };
  for (const s of [-1, 1]) {
    // chest: a broad fan from the breastbone to the shoulder, its lower edge crisp on the muscled
    if (def > 0.05) {
      // (a broad, low mound; its lower edge is drawn by a groove, as a sculptor would cut it)
      put('upperChest', ell([s * 0.064 * sw, T(0.405), surf(s * 0.064 * sw, 0.4) - 0.03 + 0.004 + 0.008 * def], [0.085 * sw, 0.062, 0.03], { m: rotXYZ(0.2, s * 0.42, s * 0.1), blend: 0.04 }));
      groove('upperChest', [[s * 0.008, 0.355], [s * 0.05 * sw, 0.343], [s * 0.095 * sw, 0.36], [s * 0.132 * sw, 0.405]], 0.013, 0.0018 + 0.0028 * def, { detail: true });
      // the side of the chest under the arm, and the wide back muscles giving the V to the trunk
      put('chest', ell([s * 0.118 * ch, T(0.36), -0.032], [0.03 * b, 0.1, 0.058 * b], { m: rotXYZ(0, 0, s * 0.25), blend: 0.05 }));
      // obliques over the hips
      put('spine', ell([s * 0.108 * ww, T(0.12), 0.012], [0.026 * b, 0.07, 0.055 * b], { blend: 0.045 }));
    }
    // the slope from the neck to the shoulders (the trapezius)
    put('upperChest', cone([s * 0.024, T(0.535), -0.024], [s * 0.14 * sw, T(0.48), -0.016], 0.03 * (0.8 + m * 0.5), 0.024, { blend: 0.05 }));
    // the seat
    put('hips', ell([s * 0.06 * hw, T(-0.045), -0.066 * b], [0.062 * b, 0.07, 0.046 * b], { m: rotXYZ(0.15, 0, s * 0.12), blend: 0.045 }));
  }
  if (def > 0.05) {
    // the back of the neck and shoulders, a diamond down the upper back
    put('upperChest', ell([0, T(0.45), -0.068 * b], [0.085 * sw, 0.085, 0.022 + 0.008 * def], { blend: 0.04 }));
    // the groove down the middle of the chest, and of the back along the spine
    groove('upperChest', [[0, 0.34], [0, 0.46]], 0.011, 0.0015 + 0.002 * def, { detail: true });
    // the long muscles either side of the spine, and the groove between them
    for (const s of [-1, 1]) put('spine', ell([s * 0.026, T(0.14), -0.074 * b], [0.022, 0.13, 0.018], { blend: 0.035 }));
    const back = ([x, k]) => { const z0 = -0.09 * b; return [x, T(k), -skinAt(x, T(k), -z0, -1) - 0.011 + 0.0016 + 0.0024 * def]; };
    for (const [p0, p1] of [[[0, 0.03], [0, 0.2]], [[0, 0.2], [0, 0.36]], [[0, 0.36], [0, 0.47]]]) put('chest', cone(back(p0), back(p1), 0.011, 0.011, { sub: true, blend: 0.018 }));
  }
  if (def > 0.25) {
    // stomach muscles: a low swell, cut by the line down the middle and three lines across
    const d2 = (def - 0.25) / 0.75;
    for (const s of [-1, 1]) put('spine', ell([s * 0.03, T(0.17), front(0.17) - 0.03 + 0.004 + 0.003 * d2], [0.034, 0.12, 0.03], { blend: 0.03, detail: true }));
    groove('spine', [[0, 0.05], [0, 0.3]], 0.01, 0.001 + 0.0018 * d2, { detail: true });
    for (const k of [0.132, 0.2, 0.266]) groove('spine', [[-0.05, k - 0.006], [-0.025, k], [0, k + 0.004], [0.025, k], [0.05, k - 0.006]], 0.009, 0.0008 + 0.0014 * d2, { detail: true });
    // the lines from the hip bones down to the groin
    for (const s of [-1, 1]) put('hips', cone([s * 0.105 * hw, T(0.05), front(0.07) - 0.012], [s * 0.035, T(-0.07), 0.066 * b], 0.004, 0.003, { sub: true, blend: 0.012, detail: true }));
  }

  // ---- neck and head ----
  const nr = 0.038 * P.neck * Math.sqrt(b);
  // (the neck meets the skull behind the jaw, so the jaw's line stands clear of it)
  put('neck', cone([0, T(0.49), -0.022], [0, headO[1] - 0.004, -0.02], nr * 1.08, nr * 0.96, { blend: 0.03 }));

  // skull, face, jaw and chin (anime-realistic: a big round skull, a fine face, a clean jawline from
  // under the ear to a defined chin, high cheekbones). The eyes, brows and mouth are painted on
  // afterwards (see face.js).
  const jw = P.jaw, cn = P.chin;
  put('head', ell(H(0, 0.104, -0.01), [0.08, 0.084, 0.096], { blend: 0.02 }));
  // the face, drawn slice by slice like the trunk: [height, half width, depth in front, depth behind,
  // middle], from under the chin up to the brow. Its outline from the front: straight down from the
  // temples past the cheekbones, then a clean slant in to a narrow chin; from the side: a flat brow,
  // the eyes set in, and a firm chin a little behind the mouth.
  // (full cheeks widen the face most at the cheeks and jaw, less at the chin and brow)
  const fw = (y) => 1 + 0.17 * P.cheeks * Math.max(0, 1 - Math.abs(y - 0.02) / 0.075);
  const F = (y, rx, f, bk, cz, wx = 1) => [headO[1] + y * hd, rx * hd * wx * fw(y), f * hd, bk * hd, headO[2] + cz * hd];
  put('head', loft([
    F(-0.027, 0.009, 0.012, 0.012, 0.054, cn),
    F(-0.018, 0.019, 0.022, 0.04, 0.049, cn),
    F(-0.006, 0.031, 0.034, 0.06, 0.043, (jw + cn) / 2),
    F(0.008, 0.041, 0.046, 0.066, 0.033, jw),
    F(0.022, 0.049, 0.057, 0.066, 0.025, jw),
    F(0.038, 0.056, 0.066, 0.066, 0.02),
    F(0.055, 0.058, 0.071, 0.07, 0.018),
    F(0.072, 0.06, 0.074, 0.075, 0.016),
    F(0.092, 0.062, 0.07, 0.08, 0.014),
  ], { blend: 0.012 }));
  // the jaw's edge, from under the ear to the chin, and the cheekbones, faintly
  for (const s of [-1, 1]) {
    const corner = H(s * 0.047 * jw, 0.012, -0.022), front = H(s * 0.01 * cn, -0.02, 0.063);
    put('head', cone(H(s * 0.052 * jw, 0.045, -0.024), corner, 0.008 * jw, 0.0075 * jw, { blend: 0.016 }));
    put('head', cone(corner, front, 0.0075 * jw, 0.007 * cn, { blend: 0.014 }));
    put('head', ell(H(s * 0.047, 0.058, 0.052), [0.012, 0.007, 0.01], { m: rotXYZ(0, s * 0.5, s * -0.2), blend: 0.026 }));
  }
  put('head', ell(H(0, -0.017, 0.064), [0.012 * cn, 0.009, 0.008], { blend: 0.012 })); // the point of the chin
  // soft, full cheeks over the cheekbones and down towards the jaw
  for (const s of [-1, 1]) put('head', ell(H(s * 0.044, 0.038, 0.048), [0.024 * P.cheeks, 0.026, 0.022 * P.cheeks], { blend: 0.05 }));
  for (const s of [-1, 1]) {
    put('head', ell(H(s * 0.034, 0.063, 0.094), [0.021 * P.eyes, 0.012 * P.eyes, 0.0055], { sub: true, blend: 0.014 })); // a shallow bed for the eye
  }
  if (P.brow > 0.4) put('head', ell(H(0, 0.086, 0.07), [0.058, 0.011, 0.016], { blend: 0.03 * P.brow })); // a heavy brow
  // the nose: a fine bridge and a small soft tip
  const nz = P.nose;
  put('head', cone(H(0, 0.054, 0.088), H(0, 0.04, 0.094 + 0.005 * nz), 0.003, 0.0046 * nz, { blend: 0.012 }));
  // soft lips, barely raised (the mouth's line is painted)
  put('head', ell(H(0, 0.0125, 0.0675), [0.011, 0.003, 0.0045], { blend: 0.008 }));
  put('head', ell(H(0, 0.0045, 0.0665), [0.009, 0.0036, 0.0046], { blend: 0.008 }));
  // ears
  for (const s of [-1, 1]) {
    const es = P.earSize;
    if (P.ears === 'round') {
      put('head', ell(H(s * 0.076, 0.056, -0.004), [0.008, 0.024 * es, 0.015 * es], { m: rotXYZ(0, s * -0.35, 0), blend: 0.006, ear: true }));
    } else if (P.ears === 'goblin') {
      // long and broad, standing out sideways and a little back, to a point
      const root = H(s * 0.072, 0.06, -0.012), tip = H(s * (0.075 + 0.1 * es), 0.085 + 0.012 * es, -0.045);
      const dir = norm([tip[0] - root[0], tip[1] - root[1], tip[2] - root[2]]);
      const len = Math.hypot(tip[0] - root[0], tip[1] - root[1], tip[2] - root[2]);
      put('head', ell(mix(root, tip, 0.42), [0.0065, len * 0.56, 0.026 * es], { m: alongDir(dir, s * 0.6), blend: 0.008, ear: true }));
      put('head', ell(mix(root, tip, 0.4).map((v, i) => v + [0, 0, 0.007][i]), [0.004, len * 0.4, 0.016 * es], { m: alongDir(dir, s * 0.6), sub: true, blend: 0.006, ear: true })); // hollow in front
    } else if (P.ears === 'elf') {
      const root = H(s * 0.074, 0.055, -0.01), tip = H(s * 0.16 * es, 0.1 * es, -0.05);
      const dir = norm([tip[0] - root[0], tip[1] - root[1], tip[2] - root[2]]);
      const len = Math.hypot(tip[0] - root[0], tip[1] - root[1], tip[2] - root[2]);
      put('head', ell(mix(root, tip, 0.42), [0.006, len * 0.56, 0.019 * es], { m: alongDir(dir, s * 0.5), blend: 0.006, ear: true }));
      put('head', ell(H(s * 0.077, 0.045, -0.012), [0.008, 0.02, 0.014], { blend: 0.006, ear: true })); // the lobe
    }
  }

  // animal ears on top of the head: a tall furred cone, hollowed in front
  if (P.animalEars) {
    const tall = { wolf: 0.085, cat: 0.06, fox: 0.095 }[P.animalEars] || 0.08;
    const wide = { wolf: 0.032, cat: 0.03, fox: 0.034 }[P.animalEars] || 0.032;
    for (const s of [-1, 1]) {
      const root = H(s * 0.052, 0.168, -0.012), tip = H(s * 0.085, 0.168 + tall * 1.05, -0.026);
      const dir = norm([tip[0] - root[0], tip[1] - root[1], tip[2] - root[2]]);
      put('head', cone(root, tip, wide * hd, 0.004 * hd, { blend: 0.012, part: 'fur' }));
      // flattened front to back, and hollow at the front
      put('head', ell(mix(root, tip, 0.45).map((v, i) => v + [0, 0, 0.022 * hd][i]), [wide * 0.75 * hd, tall * 0.42 * hd, 0.012 * hd], { m: alongDir(dir), sub: true, blend: 0.008 }));
      put('head', ell(mix(root, tip, 0.4).map((v, i) => v + [0, 0, -0.026 * hd][i]), [wide * 1.1 * hd, tall * 0.5 * hd, 0.012 * hd], { m: alongDir(dir), sub: true, blend: 0.01 }));
    }
  }
  // a beard: full over the jaw and chin, falling to a point, with a moustache
  if (P.beard > 0) {
    const bd = P.beard;
    // it grows from the jaw and chin, below the mouth (the lips stay clear), and hangs down the chest
    put('head', ell(H(0, -0.028, 0.045), [0.058, 0.04, 0.046], { blend: 0.03, part: 'fur' }));
    for (const sd of [-1, 1]) put('head', ell(H(sd * 0.052, 0.012, 0.022), [0.022, 0.04, 0.036], { blend: 0.025, part: 'fur' }));
    put('head', cone(H(0, -0.05, 0.058), H(0, -0.08 - 0.12 * bd, 0.06 + 0.02 * bd), 0.046, 0.012, { blend: 0.04, part: 'fur' }));
    if (!P.moustache) for (const sd of [-1, 1]) put('head', cone(H(sd * 0.004, 0.026, 0.078), H(sd * 0.032, 0.008, 0.07), 0.0065, 0.0035, { blend: 0.006, part: 'fur' }));
    // a braid from the beard's point: thick plaits, turning round each other down its length
    if (P.braid > 0) {
      const top = H(0, -0.08 - 0.12 * bd, 0.06 + 0.02 * bd), n = Math.round(6 + 6 * P.braid), step = 0.022 * hd;
      for (let i = 0; i < n; i++) {
        const y = top[1] - 0.004 - i * step, w = 0.012 * hd * (1 - 0.35 * i / n);
        const s = i % 2 ? 1 : -1;
        put('head', ell([top[0] + s * w * 0.32, y, top[2] - 0.004 * i * hd], [w * 0.8, step * 0.72, w * 0.72], { m: rotXYZ(0, 0, s * 0.55), blend: 0.004, part: 'fur' }));
      }
      put('head', ell([top[0], top[1] - n * step - 0.006 * hd, top[2] - 0.004 * n * hd], [0.0075 * hd, 0.008 * hd, 0.0075 * hd], { blend: 0.003, part: 'tusk' })); // a ring at its end
    }
  }
  // a thick moustache: from under the nose out over the corners of the mouth, drooping to points
  if (P.moustache > 0) {
    const mu = P.moustache;
    for (const sd of [-1, 1]) {
      put('head', cone(H(sd * 0.003, 0.027, 0.08), H(sd * 0.026, 0.017, 0.074), 0.009 * mu, 0.0085 * mu, { blend: 0.008, part: 'fur' }));
      put('head', cone(H(sd * 0.026, 0.017, 0.074), H(sd * 0.036, -0.012 - 0.02 * mu, 0.066), 0.0085 * mu, 0.003, { blend: 0.008, part: 'fur' }));
    }
  }
  if (P.tusks > 0) {
    for (const sd of [-1, 1]) put('head', cone(H(sd * 0.017, 0.001, 0.064), H(sd * 0.023, 0.024 + 0.01 * P.tusks, 0.077), 0.0055 * P.tusks, 0.0015, { blend: 0.002, part: 'tusk' })); // from the lower jaw, up past the lip
  }
  // horns (oni): from the top of the forehead, through the hair, sweeping up and back to a sharp point
  if (P.horns > 0) {
    const hl = P.hornLen;
    const roots = P.horns === 1 ? [[0, 0]] : [[-1, 0.036], [1, 0.036]];
    for (const [s, x] of roots) {
      const N = 6;
      const at = (t) => H(s * x + s * 0.016 * t * hl, 0.152 + 0.1 * t * hl, 0.052 + (0.02 * t - 0.055 * t * t) * hl);
      for (let i = 0; i < N; i++) {
        const t0 = i / N, t1 = (i + 1) / N;
        const r = (t) => (0.0115 * Math.pow(1 - t, 0.85) + 0.0012) * hd * (P.horns === 1 ? 1.1 : 1);
        put('head', cone(at(t0), at(t1), r(t0), r(t1), { blend: i ? 0.002 : 0.006, part: 'horn' }));
      }
    }
  }
  // a crown of bone spikes, standing up round the head
  if (P.crown > 0) {
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const base = H(sa * 0.072, 0.152, -0.01 + ca * 0.086), tip = H(sa * 0.082, 0.152 + (0.05 + 0.025 * (i % 2 ? 0 : 1) + (i === 0 ? 0.02 : 0)) * P.crown, -0.01 + ca * 0.098);
      put('head', cone(base, tip, 0.012 * hd, 0.0015 * hd, { blend: 0.003, part: 'horn' }));
    }
    // the band
    for (let i = 0; i < n * 2; i++) {
      const a0 = (i / (n * 2)) * Math.PI * 2, a1 = ((i + 1) / (n * 2)) * Math.PI * 2;
      put('head', cone(H(Math.sin(a0) * 0.084, 0.148, -0.01 + Math.cos(a0) * 0.1), H(Math.sin(a1) * 0.084, 0.148, -0.01 + Math.cos(a1) * 0.1), 0.007 * hd, 0.007 * hd, { blend: 0.002, part: 'horn' }));
    }
  }
  // a hard, weathered face: furrows across the forehead, a deep line between the brows, heavy folds
  // from the nose past the mouth, and a lined ridge under each eye
  if (P.ridges > 0) {
    const rg = P.ridges;
    for (let i = 0; i < 3; i++) {
      const y = 0.112 + 0.014 * i;
      put('head', cone(H(-0.04, y - 0.003, 0.074), H(0, y + 0.002, 0.084), 0.0028, 0.0028, { sub: true, blend: 0.004, detail: true }));
      put('head', cone(H(0, y + 0.002, 0.084), H(0.04, y - 0.003, 0.074), 0.0028, 0.0028, { sub: true, blend: 0.004, detail: true }));
    }
    for (const sd of [-1, 1]) {
      put('head', cone(H(sd * 0.006, 0.075, 0.091), H(sd * 0.008, 0.093, 0.088), 0.0026, 0.0022, { sub: true, blend: 0.004, detail: true }));
      // the fold from beside the nose to past the corner of the mouth, and the cheek over it
      put('head', cone(H(sd * 0.018, 0.044, 0.084), H(sd * 0.03, 0.01, 0.07), 0.006 * rg, 0.005 * rg, { blend: 0.014, detail: true }));
      put('head', cone(H(sd * 0.014, 0.042, 0.087), H(sd * 0.026, 0.008, 0.073), 0.0025, 0.0025, { sub: true, blend: 0.006, detail: true }));
    }
  }

  // ---- arms and hands ----
  const al = P.arms;
  const upLen = 0.29 * al, foreLen = 0.248 * al;
  for (const s of [-1, 1]) {
    const L = s > 0 ? 'left' : 'right';
    const sh = [s * 0.185 * sw, T(0.485), -0.016];
    bone(`${L}Shoulder`, 'upperChest', [s * 0.025, T(0.48), -0.005]);
    bone(`${L}UpperArm`, `${L}Shoulder`, sh, [0, 0, s * 0.82]);
    const el = add(sh, [0, -upLen, 0]);
    bone(`${L}LowerArm`, `${L}UpperArm`, el);
    const wr = add(el, [0, -foreLen, 0.004]);
    bone(`${L}Hand`, `${L}LowerArm`, wr);
    const ua = `${L}UpperArm`, la = `${L}LowerArm`, hn = `${L}Hand`;
    const mk = 0.75 + m * 0.6;
    // shoulder cap, upper arm, biceps and triceps
    put(ua, ell(add(sh, [s * 0.012, -0.05, 0.002]), [0.047 * b * mk, 0.085, 0.054 * b * mk], { m: rotXYZ(0, 0, s * 0.12), blend: 0.034 }));
    put(ua, cone(sh, el, 0.043 * b, 0.032 * b, { blend: 0.03 }));
    put(ua, ell(add(sh, [0, -upLen * 0.55, 0.017 * b]), [0.035 * b * mk, upLen * 0.27, 0.032 * b * mk], { blend: 0.026 })); // biceps
    put(ua, ell(add(sh, [0, -upLen * 0.42, -0.019 * b]), [0.035 * b * mk, upLen * 0.32, 0.031 * b * mk], { blend: 0.026 })); // triceps
    // elbow and forearm, wider at the top, flat at the wrist
    put(la, ell(add(el, [0, 0.004, -0.018]), [0.018, 0.018, 0.012], { blend: 0.012 }));
    put(la, cone(el, add(wr, [0, 0.01, 0]), 0.033 * b, 0.022 * b, { blend: 0.01 }));
    put(la, ell(add(el, [s * 0.003, -foreLen * 0.25, 0.006]), [0.029 * b * mk, foreLen * 0.3, 0.033 * b * mk], { blend: 0.035 }));
    put(la, ell(add(wr, [0, 0.022, 0]), [0.018 * b, 0.03, 0.027 * b], { blend: 0.02 }));
    hand(s, L, wr);
  }

  // A hand hanging with its palm towards the thigh (-s x), fingers down, the thumb to the front
  function hand(s, L, wr) {
    const hs = P.hands, fl = P.fingers * hs, hn = `${L}Hand`;
    put(hn, ell(add(wr, [0, -0.008, 0]), [0.016 * hs, 0.018 * hs, 0.027 * hs], { blend: 0.012 })); // wrist
    // the palm: four bones fanning out from the wrist to the knuckles, padded on the palm side
    for (const [name, z, drop, , r] of FINGERS) {
      const k = add(wr, [s * 0.001, -drop * hs, z * hs]);
      put(hn, cone(add(wr, [0, -0.016 * hs, z * 0.45 * hs]), k, 0.0115 * hs, r * 1.08 * hs, { blend: 0.012 }));
    }
    put(hn, ell(add(wr, [-s * 0.008 * hs, -0.058 * hs, -0.004 * hs]), [0.009 * hs, 0.036 * hs, 0.034 * hs], { blend: 0.012 })); // palm pad
    put(hn, ell(add(wr, [-s * 0.009 * hs, -0.04 * hs, -0.026 * hs]), [0.009 * hs, 0.03 * hs, 0.012 * hs], { blend: 0.01 })); // under the little finger
    // fingers
    for (const [name, z, drop, lens, r] of FINGERS) {
      let at = add(wr, [s * 0.001, -drop * hs, z * hs]);
      let parent = hn;
      lens.forEach((len, i) => {
        const nm = `${L}${name}${SEGS[i]}`;
        bone(nm, parent, at, i === 0 ? [SPREAD[name], 0, 0] : null);
        const end = add(at, [0, -len * fl, 0]);
        const r0 = r * hs * (1 - i * 0.075), r1 = r * hs * (1 - (i + 1) * 0.075);
        put(nm, cone(at, i === 2 ? add(end, [0, r1 * 0.6, 0]) : end, r0, i === 2 ? r1 * 0.86 : r1, { blend: i ? 0.0012 : 0.006 }));
        if (i === 2) nail(nm, end, r1, s);
        at = end; parent = nm;
      });
    }
    // the thumb: from the heel of the hand, forward and down, its pad towards the palm
    const tdir = norm([-s * 0.32, -0.86, 0.4]);
    let at = add(wr, [-s * 0.006 * hs, -0.02 * hs, 0.02 * hs]);
    put(hn, ell(add(at, [-s * 0.004, -0.02 * hs, 0.004]), [0.012 * hs, 0.026 * hs, 0.014 * hs], { m: alongDir(tdir), blend: 0.012 })); // the ball of the thumb
    let parent = hn;
    [['Metacarpal', 0.04, 0.0125], ['Proximal', 0.031, 0.0102], ['Distal', 0.027, 0.0094]].forEach(([seg, len, r], i) => {
      const nm = `${L}Thumb${seg}`;
      bone(nm, parent, at);
      const end = add(at, tdir.map((v) => v * len * fl));
      put(nm, cone(at, i === 2 ? add(end, tdir.map((v) => -v * r * 0.5)) : end, r * hs, r * hs * (i === 2 ? 0.82 : 0.92), { blend: i ? 0.005 : 0.01 }));
      if (i === 2) nail(nm, end, r * hs * 0.85, s, tdir);
      at = end; parent = nm;
    });
  }
  // a fingernail (or a claw) on the back of the last joint
  function nail(nm, tip, r, s, dir = [0, -1, 0]) {
    const back = [s, 0, 0];
    if (P.claws) {
      put(nm, cone(tip.map((v, i) => v + back[i] * r * 0.4 - dir[i] * r * 1.2), tip.map((v, i) => v + dir[i] * r * 2.2 - back[i] * r * 0.4), r * 0.55, r * 0.08, { blend: 0.002, part: 'claw' }));
      return;
    }
    put(nm, ell(tip.map((v, i) => v + back[i] * r * 0.62 - dir[i] * r * 0.75), [r * 0.32, r * 1.05, r * 0.8], { m: alongDir(dir), blend: 0.002, part: 'nail' }));
  }

  // ---- legs and feet ----
  for (const s of [-1, 1]) {
    const L = s > 0 ? 'left' : 'right';
    const hip = [s * 0.09 * hw, hipY, 0];
    bone(`${L}UpperLeg`, 'hips', hip, [0, 0, s * 0.07]);
    const kn = [s * 0.09 * hw, kneeY, 0.006];
    bone(`${L}LowerLeg`, `${L}UpperLeg`, kn);
    const an = [s * 0.09 * hw, ankleY, -0.012];
    bone(`${L}Foot`, `${L}LowerLeg`, an);
    const ft = P.feet;
    const ball = [s * 0.092 * hw, 0.022 * ft, 0.128 * ft];
    bone(`${L}Toes`, `${L}Foot`, ball);
    const ul = `${L}UpperLeg`, ll = `${L}LowerLeg`, fo = `${L}Foot`, to = `${L}Toes`;
    const mk = 0.78 + m * 0.6;
    const thighLen = hipY - kneeY;
    // thigh: the main mass, the front muscles, the inner thigh and the outer sweep
    put(ul, cone(add(hip, [0, 0.01, -0.01]), add(kn, [0, 0.045, 0]), 0.077 * b, 0.054 * b, { blend: 0.05 }));
    put(ul, ell(add(hip, [s * 0.004, -thighLen * 0.45, 0.03 * b]), [0.05 * b * mk, thighLen * 0.38, 0.045 * b * mk], { blend: 0.032 })); // the front of the thigh
    put(ul, ell(add(hip, [-s * 0.03, -thighLen * 0.28, 0.0]), [0.04 * b, thighLen * 0.28, 0.05 * b], { blend: 0.045 })); // inner thigh
    put(ul, ell(add(hip, [s * 0.04, -thighLen * 0.42, -0.004]), [0.032 * b * mk, thighLen * 0.36, 0.05 * b], { blend: 0.035 })); // the outer sweep
    put(ul, ell(add(kn, [-s * 0.024, thighLen * 0.2, 0.026 * b]), [0.026 * b * mk, thighLen * 0.15, 0.026 * b * mk], { m: rotXYZ(0, 0, -s * 0.25), blend: 0.022 })); // the teardrop above the knee
    put(ul, ell(add(hip, [0, -thighLen * 0.5, -0.04 * b]), [0.045 * b, thighLen * 0.36, 0.034 * b * mk], { blend: 0.04 })); // the back of the thigh
    // knee and shin, the calf with its two heads, the ankle bones
    const shinLen = kneeY - ankleY;
    put(ll, ell(add(kn, [0, 0.012, 0.03]), [0.024, 0.028, 0.014], { blend: 0.015 }));
    put(ll, cone(add(kn, [0, -0.005, 0]), add(an, [0, 0.03, 0]), 0.046 * b, 0.027 * b, { blend: 0.012 }));
    put(ll, ell(add(kn, [-s * 0.013, -shinLen * 0.29, -0.032 * b]), [0.036 * b * mk, shinLen * 0.25, 0.038 * b * mk], { blend: 0.028 })); // the calf: inner head, lower
    put(ll, ell(add(kn, [s * 0.016, -shinLen * 0.24, -0.03 * b]), [0.031 * b * mk, shinLen * 0.21, 0.034 * b * mk], { blend: 0.028 })); // outer head
    put(ll, ell(add(kn, [s * 0.018, -shinLen * 0.3, 0.014 * b]), [0.016 * b * mk, shinLen * 0.3, 0.016 * b * mk], { blend: 0.025 })); // the muscle beside the shin bone
    put(ll, cone(add(an, [0, 0.06, -0.035]), add(an, [0, -0.01, -0.045]), 0.013, 0.015, { blend: 0.025 })); // the heel cord
    for (const k of [-1, 1]) put(ll, ell(add(an, [k * 0.024, 0.0, 0.002]), [0.01, 0.012, 0.012], { blend: 0.012 }));
    // the foot: heel, arch and the ball of the foot, then the toes
    put(fo, ell([an[0], ankleY * 0.47, an[2] - 0.035 * ft], [0.032 * ft, 0.037 * ft, 0.038 * ft], { blend: 0.025 }));
    put(fo, cone(add(an, [0, -0.01, 0.0]), add(ball, [0, 0.008, -0.01]), 0.032 * ft, 0.026 * ft, { blend: 0.03 }));
    put(fo, ell(add(ball, [0, -0.004, -0.045]), [0.04 * ft, 0.019 * ft, 0.06 * ft], { blend: 0.025 }));
    put(to, ell(add(ball, [-s * 0.002, -0.005, 0.03 * ft]), [0.043 * ft, 0.015 * ft, 0.036 * ft], { blend: 0.012 }));
    put(to, ell(add(ball, [-s * 0.02 * ft, -0.003, 0.05 * ft]), [0.013 * ft, 0.012 * ft, 0.02 * ft], { blend: 0.008 })); // the big toe
  }

  // a tail, from the base of the spine, curving down and out behind; bushy for a wolf or fox
  if (P.tail) {
    const bushy = P.tail === 'cat' ? 0.6 : 1;
    const N = 5;
    let at = [0, hipY + 0.06, -0.085], parent = 'hips';
    for (let i = 0; i < N; i++) {
      const nm = `tail${i + 1}`;
      bone(nm, parent, at);
      const k = (i + 1) / N;
      const next = [0, hipY + 0.06 - 0.09 * k - 0.16 * k * k, -0.085 - 0.13 * k - 0.05 * k * k];
      const r0 = (0.018 + 0.03 * bushy * Math.sin(Math.PI * Math.min(1, (i / N) * 1.2 + 0.1))), r1 = (0.018 + 0.03 * bushy * Math.sin(Math.PI * Math.min(1, (k) * 1.2 + 0.1)));
      put(nm, cone(at, next, i === 0 ? 0.02 : r0, i === N - 1 ? 0.006 : r1, { blend: i ? 0.01 : 0.03, part: 'fur' }));
      at = next; parent = nm;
    }
  }

  const top = headO[1] + 0.186 * hd; // the crown of the skull
  return { bones, shapes, P, top, eyes: { y: H(0, 0.063, 0)[1], x: 0.032 * hd }, mouth: H(0, 0.0085, 0)[1], headO, hd };
}
