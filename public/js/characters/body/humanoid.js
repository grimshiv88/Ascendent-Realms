// The plan of a two-legged body: its skeleton (down to every finger joint) and the shapes that
// are sculpted onto each bone (bones, muscles, joints, the face). Everything is laid out standing
// straight with the arms hanging ("rest"), in metres, facing +z, with the body's left at +x.
// The bones' names follow the VRM humanoid standard, so motions can be shared with other models.
import { cone, ell, loft, rotXYZ, alongDir, norm } from './sdf.js';

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
  belly: 0,         // 0 .. 1
  neck: 1,          // neck thickness
  hands: 1, feet: 1,
  fingers: 1,       // finger length
  ears: 'round',    // 'round', 'elf', 'none' (animal ears are added on top, see races.js)
  earSize: 1,
  jaw: 1, chin: 1, nose: 1, cheeks: 1, brow: 0.3,
  eyes: 1,          // eye size
  claws: false,
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
  const b = P.bulk, m = P.muscle;
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

  const sw = P.shoulders, hw = P.hips, ww = P.waist, ch = P.chest;
  // The trunk, drawn slice by slice from the hips to the base of the neck: the seat behind, a flat
  // belly, a waist narrower than the ribs, the chest deepest at the front and widest under the arms
  const bl = P.belly;
  const R = (k, rx, f, bk, cz = 0) => [T(k), rx * b, f * b, bk * b, cz];
  put('hips', loft([
    R(-0.1, 0.11 * hw, 0.068, 0.07),
    R(-0.05, 0.15 * hw, 0.08, 0.1, -0.006),
    R(0.0, 0.152 * hw, 0.083 + bl * 0.01, 0.098, -0.006),
    R(0.07, 0.142 * (hw + ww) / 2, 0.084 + bl * 0.03, 0.082),
    R(0.15, 0.125 * ww, 0.083 + bl * 0.045, 0.074),
    R(0.23, 0.13 * (ww + ch) / 2, 0.087 + bl * 0.03, 0.078),
    R(0.3, 0.142 * ch, 0.095, 0.085),
    R(0.37, 0.152 * ch, 0.1, 0.09),
    R(0.44, 0.156 * ch * sw, 0.094, 0.088, -0.004),
    R(0.5, 0.142 * sw, 0.07, 0.075, -0.01),
    R(0.55, 0.075, 0.042, 0.052, -0.02),
  ], { blend: 0.02, span: [['hips', T(0.02)], ['spine', T(0.15)], ['chest', T(0.29)], ['upperChest', T(0.42)]] }));
  for (const s of [-1, 1]) {
    const pk = 0.6 + m * 0.7;
    // chest muscles, only on the muscled
    if (m > 0.4) put('upperChest', ell([s * 0.06 * sw, T(0.39), 0.074 * ch * b], [0.064 * sw, 0.044, 0.03 * (m - 0.3)], { m: rotXYZ(0, s * 0.25, s * 0.12), blend: 0.06 }));
    // the slope from the neck to the shoulders
    put('upperChest', cone([s * 0.024, T(0.535), -0.024], [s * 0.14 * sw, T(0.48), -0.016], 0.03 * (0.8 + m * 0.5), 0.024, { blend: 0.05 }));
  }
  if (m > 0.35) {
    // stomach muscles
    for (let row = 0; row < 3; row++) for (const s of [-1, 1]) {
      put('spine', ell([s * 0.024, T(0.1 + row * 0.07), 0.077 * b], [0.022, 0.03, 0.01 * (m - 0.2)], { blend: 0.025 }));
    }
  }

  // ---- neck and head ----
  const nr = 0.041 * P.neck * Math.sqrt(b);
  put('neck', cone([0, T(0.49), -0.022], [0, headO[1] + 0.012, -0.012], nr * 1.08, nr, { blend: 0.035 }));

  // skull, face, jaw and chin (anime-realistic: a big round skull, a small soft face, a narrow jaw
  // coming to a small chin). The eyes, brows and mouth are painted on afterwards (see face.js).
  put('head', ell(H(0, 0.097, -0.01), [0.08, 0.089, 0.096], { blend: 0.02 }));
  put('head', ell(H(0, 0.05, 0.02), [0.058, 0.062, 0.07], { blend: 0.045 }));
  put('head', cone(H(0, 0.056, 0.0), H(0, -0.017, 0.062 + 0.004 * P.chin), 0.05 * P.jaw, 0.012 * P.chin, { blend: 0.04 }));
  put('head', ell(H(0, -0.019, 0.063), [0.011 * P.chin, 0.008, 0.008], { blend: 0.014 })); // the point of the chin
  for (const s of [-1, 1]) {
    put('head', ell(H(s * 0.034, 0.063, 0.094), [0.021 * P.eyes, 0.012 * P.eyes, 0.0055], { sub: true, blend: 0.014 })); // a shallow bed for the eye
  }
  if (P.brow > 0.4) put('head', ell(H(0, 0.086, 0.07), [0.058, 0.011, 0.016], { blend: 0.03 * P.brow })); // a heavy brow
  // the nose: a fine bridge and a small soft tip
  const nz = P.nose;
  put('head', cone(H(0, 0.052, 0.089), H(0, 0.039, 0.0955 + 0.006 * nz), 0.003, 0.0048 * nz, { blend: 0.012 }));
  // soft lips, barely raised (the mouth's line is painted)
  put('head', ell(H(0, 0.0125, 0.0675), [0.011, 0.003, 0.0045], { blend: 0.008 }));
  put('head', ell(H(0, 0.0045, 0.0665), [0.009, 0.0036, 0.0046], { blend: 0.008 }));
  // ears
  for (const s of [-1, 1]) {
    const es = P.earSize;
    if (P.ears === 'round') {
      put('head', ell(H(s * 0.076, 0.056, -0.004), [0.008, 0.024 * es, 0.015 * es], { m: rotXYZ(0, s * -0.35, 0), blend: 0.006 }));
    } else if (P.ears === 'elf') {
      const root = H(s * 0.074, 0.055, -0.01), tip = H(s * 0.16 * es, 0.1 * es, -0.05);
      const dir = norm([tip[0] - root[0], tip[1] - root[1], tip[2] - root[2]]);
      const len = Math.hypot(tip[0] - root[0], tip[1] - root[1], tip[2] - root[2]);
      put('head', ell(mix(root, tip, 0.42), [0.006, len * 0.56, 0.019 * es], { m: alongDir(dir, s * 0.5), blend: 0.006 }));
      put('head', ell(H(s * 0.077, 0.045, -0.012), [0.008, 0.02, 0.014], { blend: 0.006 })); // the lobe
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
    put(ua, ell(add(sh, [s * 0.01, -0.042, 0]), [0.043 * b * mk, 0.07, 0.05 * b * mk], { blend: 0.045 }));
    put(ua, cone(sh, el, 0.043 * b, 0.032 * b, { blend: 0.03 }));
    put(ua, ell(add(sh, [0, -upLen * 0.52, 0.016 * b]), [0.034 * b * mk, upLen * 0.27, 0.03 * b * mk], { blend: 0.03 }));
    put(ua, ell(add(sh, [0, -upLen * 0.4, -0.018 * b]), [0.033 * b * mk, upLen * 0.3, 0.03 * b * mk], { blend: 0.03 }));
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
    const mk = 0.8 + m * 0.5;
    const thighLen = hipY - kneeY;
    // thigh: the main mass, the front muscles, the inner thigh and the outer sweep
    put(ul, cone(add(hip, [0, 0.01, -0.01]), add(kn, [0, 0.045, 0]), 0.077 * b, 0.054 * b, { blend: 0.05 }));
    put(ul, ell(add(hip, [s * 0.004, -thighLen * 0.45, 0.032 * b]), [0.053 * b * mk, thighLen * 0.36, 0.044 * b * mk], { blend: 0.035 }));
    put(ul, ell(add(hip, [-s * 0.03, -thighLen * 0.3, 0.0]), [0.04 * b, thighLen * 0.28, 0.05 * b], { blend: 0.045 }));
    put(ul, ell(add(hip, [s * 0.038, -thighLen * 0.32, -0.008]), [0.03 * b, thighLen * 0.3, 0.052 * b], { blend: 0.045 }));
    // knee and shin, the calf with its two heads, the ankle bones
    const shinLen = kneeY - ankleY;
    put(ll, ell(add(kn, [0, 0.012, 0.03]), [0.024, 0.028, 0.014], { blend: 0.015 }));
    put(ll, cone(add(kn, [0, -0.005, 0]), add(an, [0, 0.03, 0]), 0.046 * b, 0.027 * b, { blend: 0.012 }));
    put(ll, ell(add(kn, [-s * 0.012, -shinLen * 0.3, -0.03 * b]), [0.039 * b * mk, shinLen * 0.25, 0.04 * b * mk], { blend: 0.035 }));
    put(ll, ell(add(kn, [s * 0.016, -shinLen * 0.25, -0.028 * b]), [0.034 * b * mk, shinLen * 0.22, 0.036 * b * mk], { blend: 0.035 }));
    put(ll, cone(add(an, [0, 0.06, -0.035]), add(an, [0, -0.01, -0.045]), 0.013, 0.015, { blend: 0.025 })); // the heel cord
    for (const k of [-1, 1]) put(ll, ell(add(an, [k * 0.024, 0.0, 0.002]), [0.01, 0.012, 0.012], { blend: 0.012 }));
    // the foot: heel, arch and the ball of the foot, then the toes
    put(fo, ell([an[0], ankleY * 0.47, an[2] - 0.035 * ft], [0.032 * ft, 0.037 * ft, 0.038 * ft], { blend: 0.025 }));
    put(fo, cone(add(an, [0, -0.01, 0.0]), add(ball, [0, 0.008, -0.01]), 0.032 * ft, 0.026 * ft, { blend: 0.03 }));
    put(fo, ell(add(ball, [0, -0.004, -0.045]), [0.04 * ft, 0.019 * ft, 0.06 * ft], { blend: 0.025 }));
    put(to, ell(add(ball, [-s * 0.002, -0.005, 0.03 * ft]), [0.043 * ft, 0.015 * ft, 0.036 * ft], { blend: 0.012 }));
    put(to, ell(add(ball, [-s * 0.02 * ft, -0.003, 0.05 * ft]), [0.013 * ft, 0.012 * ft, 0.02 * ft], { blend: 0.008 })); // the big toe
  }

  const top = headO[1] + 0.186 * hd; // the crown of the skull
  return { bones, shapes, P, top, eyes: { y: H(0, 0.063, 0)[1], x: 0.032 * hd }, mouth: H(0, 0.0085, 0)[1], headO, hd };
}
