// The real skeleton under a body: every bone sculpted as its own shape (skull and jaw, each
// vertebra, the ribs and their cartilage, breastbone, collarbones, shoulder blades, pelvis, and the
// bones of the arms, hands, legs and feet), hung on the same joints as the sculpted body (VRM names).
// It is laid out standing straight with the arms hanging ("rest"), in metres, facing +z, with the
// body's left at +x; a pose then bends it into the creature's own stance.
// Plain numbers and arrays only (no three.js). The first creature is the newborn goblin; the
// later goblin stages and the other races will grow from it.
import { cone, ell, alongDir, norm } from './sdf.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const bez = (p0, p1, p2, t) => lerp(lerp(p0, p1, t), lerp(p1, p2, t), t);
// Catmull-Rom through points (a smooth curve for ribs, collarbones, the jaw)
function spline(pts, steps = 4) {
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
// A round tube along a smooth curve, its radius going from r0 to r1 (r may also be a function of t)
function tube(out, pts, r0, r1, opts = {}, steps = 4) {
  const p = spline(pts, steps), n = p.length - 1;
  const R = typeof r0 === 'function' ? r0 : (t) => r0 + (r1 - r0) * t;
  // (only the first piece melts into what is there already; the rest join end to end, so the tube
  // stays smooth instead of swelling at every join)
  for (let i = 0; i < n; i++) out.push(cone(p[i], p[i + 1], R(i / n), R((i + 1) / n), { blend: 0.0015, ...opts, ...(i ? { blend: Math.min(opts.blend ?? 0.0015, 0.0004) } : {}) }));
}
// An ellipsoid lying along a direction (its y radius along dir); roll turns it about that line
const ellAlong = (c, dir, r, roll = 0, opts = {}) => ell(c, r, { m: alongDir(dir, roll), blend: 0.0015, ...opts });

// ---------------------------------------------------------------------------------------------
// One vertebra: c its body's centre, up the spine's direction there. k: the body's radius r and
// height h, kind 'c' (neck), 't' (chest), 'l' (lower back), and how long its back spike (sp) and
// side spikes (tp) are, and how steeply the back spike points down (dip)
function vertebra(out, c, up, k) {
  const U = norm(up), X = [1, 0, 0], F = cross(X, U);
  const P = (x, y, z) => add(add(add(c, mul(X, x)), mul(U, y)), mul(F, z));
  const { r, h } = k, b = 0.0015;
  // the body: a short drum, waisted, with flat round ends
  out.push(ell(P(0, h * 0.3, 0), [r, h * 0.22, r * 0.8], { m: [...X, ...U, ...F], blend: b }));
  out.push(ell(P(0, -h * 0.3, 0), [r, h * 0.22, r * 0.8], { m: [...X, ...U, ...F], blend: b }));
  out.push(ell(P(0, 0, 0), [r * 0.88, h * 0.4, r * 0.7], { m: [...X, ...U, ...F], blend: b * 1.5 }));
  // the arch round the spinal cord: two pedicles back from the body, then the laminae meeting behind
  const w = r * 0.62, back = r * 0.8, t = Math.max(0.0018, r * 0.17);
  for (const s of [-1, 1]) {
    out.push(cone(P(s * w * 0.75, 0, -back * 0.75), P(s * w, 0, -back - r * 0.45), t, t, { blend: b }));
    out.push(cone(P(s * w, 0, -back - r * 0.45), P(0, -h * 0.05, -back - r * 1.0), t, t * 0.95, { blend: b }));
    // the joints to the vertebrae above and below
    out.push(ell(P(s * w * 1.05, h * 0.42, -back - r * 0.45), [t * 1.2, t * 1.4, t * 1.2], { blend: b }));
    out.push(ell(P(s * w * 1.05, -h * 0.42, -back - r * 0.45), [t * 1.2, t * 1.4, t * 1.2], { blend: b }));
    // the side spikes
    const tp = k.tp;
    if (k.kind === 'l') out.push(cone(P(s * w, 0, -back - r * 0.4), P(s * (w + tp), h * 0.02, -back - r * 0.45), t * 1.1, t * 0.8, { blend: b }));
    else if (k.kind === 't') out.push(cone(P(s * w, h * 0.1, -back - r * 0.45), P(s * (w + tp), h * 0.25, -back - r * 0.95), t * 1.15, t * 1.05, { blend: b }));
    else out.push(cone(P(s * w * 0.9, 0, -back * 0.3), P(s * (w + tp), -h * 0.05, -back * 0.2), t * 0.9, t * 0.7, { blend: b }));
  }
  // the back spike: steep and long in the chest, flat and blunt in the lower back, short and forked in the neck
  const sp = k.sp, dip = k.dip;
  const root = P(0, -h * 0.05, -back - r * 1.0), tip = P(0, -sp * Math.sin(dip), -back - r * 1.0 - sp * Math.cos(dip));
  if (k.kind === 'l') out.push(ellAlong(lerp(root, tip, 0.55), sub(tip, root), [t * 0.8, sp * 0.55, h * 0.4], Math.PI / 2, { blend: b }));
  else out.push(cone(root, tip, t * 1.1, t * (k.kind === 'c' && !k.long ? 1.0 : 0.85), { blend: b }));
  if (k.kind === 'c' && !k.long) for (const s of [-1, 1]) out.push(ell(add(tip, mul(X, s * t * 0.8)), [t * 0.9, t * 0.9, t * 0.9], { blend: b }));
}

// ---------------------------------------------------------------------------------------------
// The newborn goblin's skeleton. Its build, from the goblin lineup Mohammed sent: a huge round
// skull with a small face, big round eye sockets, a long hooked nose and long pointed ears, small
// sharp teeth, a narrow pointed chin; a short, thin body with a narrow chest; long thin arms and
// long fingers; short legs with big, long feet. It stands bent over: a rounded back, the head
// thrust forward, hips and knees bent, the arms hanging.
export function goblinSkeleton({ height = 0.95 } = {}) {
  const parts = [];
  const part = (name, joint, mat = 'bone', cell = 0.0012) => { const p = { name, joint, mat, cell, shapes: [] }; parts.push(p); return p.shapes; };
  const joints = [];
  const J = {};
  const joint = (name, parent, pos) => { joints.push({ name, parent, pos }); J[name] = pos; };

  // ---- the spine's line (rest), from the bottom of the lower back to the skull ----
  const L5 = [0, 0.552, -0.016], T12b = [0, 0.656, -0.03], T1t = [0, 0.852, -0.048], C1t = [0, 0.918, -0.036];
  const lumbar = (t) => bez(L5, [0, 0.605, -0.006], T12b, t);         // a little hollow (bowed forward)
  const thoracic = (t) => bez(T12b, [0, 0.755, -0.088], T1t, t);      // rounded back (bowed backward)
  const cervical = (t) => bez(T1t, [0, 0.89, -0.026], C1t, t);       // hollow again in the neck
  const H0 = [0, 0.922, -0.036];                                      // where the skull sits on the spine

  joint('hips', null, [0, 0.5, 0]);
  joint('spine', 'hips', L5);
  joint('chest', 'spine', T12b);
  joint('upperChest', 'chest', [0, 0.8, -0.02]);
  joint('neck', 'upperChest', T1t);
  joint('head', 'neck', H0);
  const h = (x, y, z) => [H0[0] + x, H0[1] + y, H0[2] + z];
  joint('jaw', 'head', h(0, 0.004, -0.002));

  // ---- the vertebrae, with the cushioning discs between them ----
  const column = (name, jn, curve, n, kinds) => {
    const bones = part(name, jn), discs = part(name + 'Discs', jn, 'cartilage');
    for (let i = 0; i < n; i++) {
      const k = kinds(i), t0 = i / n, t1 = (i + 1) / n;
      const a = curve(t0), b = curve(t1), c = lerp(a, b, 0.5), up = sub(b, a);
      vertebra(bones, c, up, { ...k, h: len(up) * 0.74 });
      if (i < n - 1 || name !== 'cervical') {
        const U = norm(up), X = [1, 0, 0], F = cross(X, U);
        discs.push(ell(b, [k.r * 0.86, len(up) * 0.15, k.r * 0.68], { m: [...X, ...U, ...F], blend: 0.001 }));
      }
    }
  };
  // lower back: L5 (bottom) .. L1, big blunt bodies
  column('lumbar', 'spine', lumbar, 5, (i) => ({ kind: 'l', r: 0.0155 - i * 0.0005, sp: 0.016, tp: 0.016 - Math.abs(i - 2) * 0.0015, dip: 0.12 }));
  // chest: T12 (bottom) .. T1, each carrying a pair of ribs
  column('thoracic', 'chest', thoracic, 12, (i) => ({ kind: 't', r: 0.0125 - i * 0.00042, sp: 0.02 + (i > 3 && i < 9 ? 0.004 : 0), tp: 0.012, dip: i < 3 ? 0.5 : i < 9 ? 1.05 : 0.7 }));
  // neck: C7 (bottom, with the long spike you can feel) .. C2
  column('cervical', 'neck', cervical, 7, (i) => ({ kind: 'c', r: 0.0075 - i * 0.00015, sp: i === 0 ? 0.017 : 0.009 - i * 0.0006, tp: 0.008, dip: 0.35, long: i === 0 }));
  // the top two neck bones: the ring that carries the skull (atlas) and its peg (axis) are drawn
  // as the last ring of the neck
  {
    const neck = parts.find((p) => p.name === 'cervical').shapes;
    const c = cervical(0.97);
    for (let k = 0; k < 10; k++) {
      const a0 = (k / 10) * Math.PI * 2, a1 = ((k + 1) / 10) * Math.PI * 2;
      const at = (a) => [c[0] + Math.sin(a) * 0.013, c[1] + 0.002, c[2] - 0.004 + Math.cos(a) * 0.009 - 0.004];
      neck.push(cone(at(a0), at(a1), 0.0025, 0.0025, { blend: 0.0015 }));
    }
    for (const s of [-1, 1]) neck.push(ell([s * 0.019, c[1] + 0.002, c[2] - 0.006], [0.006, 0.003, 0.004], { blend: 0.002 }));
  }

  // ---- the ribcage: twelve pairs of ribs from the chest's vertebrae round to the breastbone ----
  const ribs = part('ribs', 'chest'), cart = part('costalCartilage', 'chest', 'cartilage');
  const sternumTop = 0.818, sternumBot = 0.708;
  const front = (y) => 0.044 + Math.min(1, Math.max(0, (sternumTop - y) / (sternumTop - sternumBot))) * 0.024; // breastbone's z at height y
  const tv = (k) => thoracic(1 - (k - 0.5) / 12); // the middle of the kth chest vertebra (1 at the top)
  const RW = [0.038, 0.054, 0.064, 0.071, 0.076, 0.079, 0.081, 0.081, 0.079, 0.075, 0.067, 0.056]; // half-widths
  const DROP = [0.01, 0.026, 0.037, 0.044, 0.05, 0.054, 0.057, 0.058, 0.057, 0.053, 0.034, 0.024];
  const STERN = [0.812, 0.797, 0.781, 0.764, 0.747, 0.73, 0.714]; // where ribs 1-7 meet the breastbone
  const rib7end = [];
  for (let k = 1; k <= 12; k++) {
    const v = tv(k), a = RW[k - 1], y = v[1], zk = v[2], d = DROP[k - 1];
    const ye = y - d, fz = front(Math.max(sternumBot, ye));
    const zc = (zk + fz) / 2 - 0.004;
    for (const s of [-1, 1]) {
      const r = k === 1 ? 0.0034 : k > 10 ? 0.0026 : 0.003;
      const head = [s * 0.008, y + 0.002, zk - 0.004];
      const tub = [s * 0.022, y - 0.001, zk - 0.017];                 // resting on the side spike
      const ang = [s * a * 0.6, y - 0.005, zk - 0.02];                // the rib's back angle
      const side = [s * a, y - d * 0.42, zc];
      if (k <= 10) {
        const fl = [s * a * 0.8, y - d * 0.8, zc + (fz - zc) * 0.62];
        const end = [s * a * (k <= 7 ? 0.48 : 0.62), ye, fz - 0.006 - (k > 7 ? 0.012 : 0)];
        tube(ribs, k === 1 ? [head, tub, [s * a * 0.8, y - 0.003, zk - 0.008], [s * a, y - d * 0.5, zc], end] : [head, tub, ang, side, fl, end], r, r * 1.1);
        // the cartilage that joins the rib to the breastbone (ribs 1-7) or to the cartilage above (8-10)
        if (k <= 7) {
          const sy = STERN[k - 1];
          const to = [s * 0.011, sy, front(sy) - 0.002];
          tube(cart, [end, lerp(end, to, 0.5), to], r * 1.05, r * 0.95);
          if (k === 7) rib7end[s] = { end, to };
        } else {
          const r7 = rib7end[s] || { end, to: end };
          const to = lerp(r7.end, r7.to, 0.2 + (k - 8) * 0.1);
          tube(cart, [end, lerp(end, to, 0.5), to], r, r * 0.8);
        }
      } else {
        // floating ribs: short, ending in the side of the belly
        const end = [s * a * 0.88, y - d, zc + 0.022];
        tube(ribs, [head, tub, ang, side, end], r, r * 0.9);
        tube(cart, [end, add(end, [0, -0.004, 0.008])], r * 0.9, r * 0.5);
      }
    }
  }
  // the breastbone: a broad top (manubrium) where the collarbones meet it, a long blade, a small tip
  {
    const st = part('sternum', 'chest');
    st.push(ell([0, 0.81, front(0.81)], [0.017, 0.011, 0.0055], { blend: 0.002 }));
    st.push(ell([0, 0.822, front(0.822) - 0.001], [0.004, 0.003, 0.006], { sub: true, blend: 0.003 })); // the notch at the throat
    for (let i = 0; i < 4; i++) {
      const y = 0.792 - i * 0.022;
      st.push(ell([0, y, front(y)], [0.0105 + i * 0.0008, 0.0125, 0.0045], { blend: 0.003 }));
    }
    tube(st, [[0, 0.71, front(0.71)], [0, 0.695, front(0.71) + 0.003], [0, 0.686, front(0.71) + 0.002]], 0.0045, 0.0015);
  }

  // ---- shoulders: collarbones and shoulder blades ----
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'left' : 'right';
    joint(side + 'Shoulder', 'upperChest', [s * 0.013, 0.818, 0.04]);
    const sh = part(side + 'Shoulder', side + 'Shoulder');
    // the collarbone: an S, bowed forward near the breastbone and backward near the shoulder
    tube(sh, [[s * 0.016, 0.818, 0.042], [s * 0.045, 0.825, 0.047], [s * 0.078, 0.831, 0.026], [s * 0.1, 0.835, -0.004]], 0.0052, 0.0042, {}, 5);
    sh.push(ell([s * 0.016, 0.818, 0.042], [0.0055, 0.006, 0.0055], { blend: 0.002 }));
    // the shoulder blade: a thin triangle lying on the back of the ribs
    const sup = [s * 0.04, 0.828, -0.062], inf = [s * 0.06, 0.716, -0.07], glen = [s * 0.098, 0.806, -0.022];
    const med = (t) => bez(sup, [s * 0.034, 0.78, -0.084], inf, t);
    tube(sh, [sup, med(0.5), inf], 0.0028, 0.0035);                   // the inner edge
    tube(sh, [inf, [s * 0.082, 0.758, -0.052], [s * 0.093, 0.79, -0.032], glen], 0.0035, 0.0045); // the outer edge
    tube(sh, [sup, [s * 0.07, 0.818, -0.048], [s * 0.09, 0.812, -0.032]], 0.0026, 0.0035); // the top edge
    for (let i = 1; i < 20; i++) sh.push(cone(med(i / 20), lerp(glen, [s * 0.088, 0.79, -0.034], 0.6), 0.0022, 0.003, { blend: 0.006 })); // the blade
    // the spine of the shoulder blade, rising to the point of the shoulder (acromion)
    tube(sh, [[s * 0.036, 0.8, -0.083], [s * 0.065, 0.81, -0.08], [s * 0.092, 0.825, -0.05], [s * 0.104, 0.835, -0.018]], 0.0028, 0.0042);
    sh.push(ell([s * 0.106, 0.837, -0.012], [0.009, 0.0035, 0.011], { blend: 0.003 }));
    // the shallow socket the arm turns in, and the hooked beak in front of it (coracoid)
    sh.push(ellAlong([s * 0.097, 0.806, -0.02], [0, 1, 0.2], [0.0045, 0.011, 0.0075], 0, { blend: 0.003 }));
    tube(sh, [[s * 0.088, 0.814, -0.026], [s * 0.088, 0.826, -0.006], [s * 0.094, 0.822, 0.01]], 0.0038, 0.0025);
  }

  // ---- the pelvis: hip bones joined at the back to the sacrum ----
  {
    const pv = part('pelvis', 'hips');
    // the sacrum and tail bone, curving down and back, then forward
    const sac = (t) => bez([0, 0.548, -0.022], [0, 0.505, -0.05], [0, 0.468, -0.045], t);
    for (let i = 0; i < 5; i++) {
      const t = i / 5, c = sac(t + 0.1), w = 0.024 - i * 0.004;
      pv.push(ellAlong(c, sub(sac(t + 0.2), sac(t)), [w, 0.008, 0.007], 0, { blend: 0.004 }));
    }
    tube(pv, [sac(1), [0, 0.456, -0.04], [0, 0.448, -0.032]], 0.0035, 0.0018);
    for (const s of [-1, 1]) {
      const acet = [s * 0.064, 0.48, 0.012];
      // the wing of the hip (ilium): a thin, flared blade from the sacrum round to the front point
      const crest = [[s * 0.022, 0.552, -0.044], [s * 0.05, 0.573, -0.04], [s * 0.078, 0.578, -0.016], [s * 0.09, 0.565, 0.016], [s * 0.084, 0.538, 0.036]];
      tube(pv, crest, 0.0045, 0.0042, {}, 5);
      const pts = spline(crest, 8);
      for (let i = 0; i < pts.length; i += 1) {
        const q = pts[i], low = [s * (0.042 + Math.abs(q[0]) * 0.3), 0.512, q[2] * 0.35 - 0.004];
        pv.push(cone(q, low, 0.0028, 0.0045, { blend: i ? 0.007 : 0.004 }));
      }
      // where the hip meets the sacrum
      pv.push(ell([s * 0.026, 0.535, -0.038], [0.008, 0.016, 0.01], { blend: 0.006 }));
      // the thick bone above the hip socket, and the socket itself
      pv.push(cone([s * 0.05, 0.52, -0.012], [s * 0.062, 0.49, 0.008], 0.009, 0.012, { blend: 0.006 }));
      pv.push(ell([s * 0.062, 0.481, 0.01], [0.016, 0.017, 0.017], { blend: 0.004 }));
      // the pubic bone, to the joint at the front in the middle, and the lower ring to the sitting bone
      const sym = [s * 0.006, 0.47, 0.046];
      tube(pv, [[s * 0.056, 0.49, 0.024], [s * 0.032, 0.485, 0.044], sym], 0.0055, 0.0055);
      pv.push(ell(add(sym, [0, -0.006, -0.001]), [0.005, 0.011, 0.006], { blend: 0.003 }));
      tube(pv, [add(sym, [0, -0.012, -0.002]), [s * 0.026, 0.444, 0.025], [s * 0.044, 0.437, -0.004]], 0.0042, 0.005);
      // the sitting bone (ischium) behind and below the socket
      tube(pv, [[s * 0.064, 0.47, -0.004], [s * 0.056, 0.45, -0.014], [s * 0.046, 0.437, -0.01]], 0.008, 0.0075);
      pv.push(ell([s * 0.048, 0.438, -0.012], [0.008, 0.007, 0.009], { blend: 0.004 }));
      // the cup the thigh bone turns in (open to the side)
      pv.push(ell(add(acet, [s * 0.011, 0, 0.002]), [0.0165, 0.0165, 0.0165], { sub: true, blend: 0.003 }));
    }
  }

  // ---- the legs ----
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'left' : 'right';
    const hipJ = [s * 0.064, 0.48, 0.012], kneeJ = [s * 0.054, 0.252, 0.0], ankleJ = [s * 0.05, 0.047, -0.002];
    joint(side + 'UpperLeg', 'hips', hipJ);
    joint(side + 'LowerLeg', side + 'UpperLeg', kneeJ);
    joint(side + 'Foot', side + 'LowerLeg', ankleJ);
    // thigh bone (femur): a ball on an angled neck, the big knob outside (greater trochanter), a
    // long shaft slanting in to the knee and bowed a little forward, two rounded knuckles at the knee
    const fe = part(side + 'Femur', side + 'UpperLeg');
    fe.push(ell(hipJ, [0.0145, 0.0145, 0.0145], { blend: 0.002 }));
    fe.push(cone(hipJ, [s * 0.086, 0.466, 0.006], 0.0085, 0.0095, { blend: 0.004 }));
    fe.push(ell([s * 0.093, 0.474, 0.0], [0.009, 0.016, 0.012], { blend: 0.005 }));
    fe.push(ell([s * 0.074, 0.447, -0.006], [0.005, 0.006, 0.005], { blend: 0.004 }));
    tube(fe, [[s * 0.088, 0.462, 0.003], [s * 0.081, 0.41, 0.006], [s * 0.069, 0.34, 0.007], [s * 0.058, 0.285, 0.002]], (t) => 0.0098 - 0.0012 * Math.sin(t * Math.PI) + (t > 0.85 ? (t - 0.85) * 0.06 : 0), 0, { blend: 0.004 });
    fe.push(ell([s * 0.042, 0.264, -0.004], [0.011, 0.015, 0.017], { blend: 0.006 }));
    fe.push(ell([s * 0.067, 0.265, -0.004], [0.011, 0.014, 0.017], { blend: 0.006 }));
    fe.push(ell([s * 0.054, 0.256, -0.006], [0.004, 0.012, 0.02], { sub: true, blend: 0.004 })); // the notch between them
    // knee cap
    const pa = part(side + 'Patella', side + 'UpperLeg');
    pa.push(ell([s * 0.055, 0.268, 0.021], [0.0115, 0.0135, 0.0055], { blend: 0.002 }));
    // shin bone (tibia): a flat top under the knuckles, a sharp front edge, the inner ankle knob;
    // and the thin outer bone (fibula) down to the outer ankle knob
    const ti = part(side + 'Tibia', side + 'LowerLeg');
    ti.push(ell([s * 0.054, 0.242, -0.002], [0.026, 0.0085, 0.019], { blend: 0.004 }));
    ti.push(ell([s * 0.055, 0.226, 0.013], [0.006, 0.008, 0.005], { blend: 0.005 }));
    tube(ti, [[s * 0.054, 0.236, 0.0], [s * 0.053, 0.16, 0.002], [s * 0.05, 0.075, 0.0]], (t) => 0.0115 - 0.003 * Math.sin(t * 2.2), 0, { blend: 0.005 });
    tube(ti, [[s * 0.054, 0.222, 0.008], [s * 0.053, 0.15, 0.009], [s * 0.05, 0.085, 0.006]], 0.004, 0.003, { blend: 0.006 });
    ti.push(ell([s * 0.049, 0.062, -0.001], [0.0125, 0.012, 0.0125], { blend: 0.006 }));
    ti.push(ell([s * 0.038, 0.049, 0.0], [0.0055, 0.011, 0.0075], { blend: 0.004 }));
    const fi = part(side + 'Fibula', side + 'LowerLeg');
    fi.push(ell([s * 0.077, 0.232, -0.012], [0.0065, 0.0075, 0.0065], { blend: 0.003 }));
    tube(fi, [[s * 0.077, 0.226, -0.012], [s * 0.076, 0.14, -0.01], [s * 0.071, 0.058, -0.008]], 0.0042, 0.0038);
    fi.push(ell([s * 0.069, 0.046, -0.008], [0.0055, 0.0135, 0.0075], { blend: 0.004 }));
    // the foot: ankle bone (talus) on the heel bone (calcaneus), the midfoot bones, five long
    // splayed metatarsals and the toes; long and broad (a goblin's feet are big)
    const fo = part(side + 'FootBones', side + 'Foot', 'bone', 0.001);
    fo.push(ell([s * 0.05, 0.039, 0.004], [0.0135, 0.0105, 0.017], { blend: 0.003 }));
    fo.push(cone([s * 0.051, 0.03, 0.012], [s * 0.047, 0.03, 0.026], 0.0085, 0.008, { blend: 0.003 }));
    fo.push(ellAlong([s * 0.053, 0.02, -0.016], [0, 0.28, 1], [0.0125, 0.027, 0.0135], 0, { blend: 0.004 }));
    fo.push(ell([s * 0.054, 0.012, -0.039], [0.0105, 0.0115, 0.01], { blend: 0.006 }));
    fo.push(ell([s * 0.043, 0.026, 0.034], [0.0115, 0.0085, 0.0065], { blend: 0.002 }));  // navicular
    fo.push(ell([s * 0.068, 0.017, 0.03], [0.0095, 0.0085, 0.011], { blend: 0.002 }));   // cuboid
    for (let i = 0; i < 3; i++) fo.push(ell([s * (0.03 + i * 0.012), 0.023 - i * 0.002, 0.047], [0.0055, 0.0075, 0.0075], { blend: 0.0015 })); // cuneiforms
    // metatarsals (big toe first, on the inside) and toe bones
    const toes = [
      { base: [0.03, 0.024, 0.055], head: [0.024, 0.01, 0.106], r: 0.0068, ph: [0.024, 0.017] },
      { base: [0.043, 0.023, 0.056], head: [0.042, 0.009, 0.108], r: 0.0045, ph: [0.017, 0.011, 0.008] },
      { base: [0.055, 0.021, 0.054], head: [0.058, 0.008, 0.103], r: 0.0042, ph: [0.016, 0.01, 0.0075] },
      { base: [0.066, 0.018, 0.049], head: [0.073, 0.007, 0.096], r: 0.004, ph: [0.014, 0.009, 0.007] },
      { base: [0.076, 0.015, 0.042], head: [0.087, 0.006, 0.086], r: 0.0042, ph: [0.012, 0.008, 0.006] },
    ];
    for (const [i, t] of toes.entries()) {
      const b = [s * t.base[0], t.base[1], t.base[2]], hd = [s * t.head[0], t.head[1], t.head[2]];
      fo.push(ell(b, [t.r * 1.15, t.r * 1.1, t.r * 1.3], { blend: 0.0015 }));
      fo.push(cone(b, hd, t.r * 0.85, t.r * 0.72, { blend: 0.0015 }));
      fo.push(ell(hd, [t.r * 1.05, t.r * 1.1, t.r * 1.05], { blend: 0.0015 }));
      // toes: each bone a little shorter, gently curled down at the tip, spread out
      let p = add(hd, [0, 0.0005, t.r * 0.9]);
      const spread = s * (i - 1.2) * 0.06;
      for (const [j, l] of t.ph.entries()) {
        const pitch = -0.12 - j * 0.12 + (j === 0 ? 0.18 : 0);
        const d = norm([Math.sin(spread), Math.sin(pitch), Math.cos(spread)]);
        const q = add(p, mul(d, l));
        const rr = t.r * (0.95 - j * 0.12) * (i ? 1.1 : 1.05);
        fo.push(cone(add(p, mul(d, 0.0018)), add(q, mul(d, -0.0012)), rr, rr * (j === t.ph.length - 1 ? 0.55 : 0.82), { blend: 0.0012 }));
        if (j < t.ph.length - 1) fo.push(ell(q, [rr * 0.95, rr * 0.9, rr * 0.8], { blend: 0.001 }));
        p = add(q, mul(d, 0.0016));
      }
    }
  }

  // ---- the arms ----
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'left' : 'right';
    const shJ = [s * 0.111, 0.806, -0.018], elJ = [s * 0.122, 0.612, -0.014], wrJ = [s * 0.121, 0.44, -0.004];
    joint(side + 'UpperArm', side + 'Shoulder', shJ);
    joint(side + 'LowerArm', side + 'UpperArm', elJ);
    joint(side + 'Hand', side + 'LowerArm', wrJ);
    // upper arm bone (humerus): a round head facing in to the socket, a long thin shaft, and a
    // broad lower end with a knob each side (the "funny bone" inside)
    const hu = part(side + 'Humerus', side + 'UpperArm');
    hu.push(ell(add(shJ, [-s * 0.002, 0.002, -0.002]), [0.0138, 0.0145, 0.0138], { blend: 0.002 }));
    hu.push(ell([s * 0.122, 0.806, -0.006], [0.008, 0.011, 0.0085], { blend: 0.005 }));
    tube(hu, [[s * 0.117, 0.796, -0.014], [s * 0.123, 0.74, -0.014], [s * 0.124, 0.66, -0.016], [s * 0.122, 0.628, -0.016]], (t) => 0.0082 - 0.0014 * Math.sin(t * Math.PI) + (t > 0.8 ? (t - 0.8) * 0.03 : 0), 0, { blend: 0.004 });
    hu.push(ellAlong([s * 0.122, 0.62, -0.012], [1, 0, 0], [0.0075, 0.016, 0.0085], 0, { blend: 0.004 }));
    hu.push(ell([s * 0.103, 0.623, -0.016], [0.0065, 0.006, 0.0055], { blend: 0.004 }));
    hu.push(ell([s * 0.139, 0.625, -0.015], [0.005, 0.006, 0.005], { blend: 0.004 }));
    // forearm: the ulna (little-finger side, its hook the point of the elbow) and the radius
    // (thumb side, thin at the elbow, broad at the wrist); with palms facing the thighs the thumb
    // side is in front
    const ul = part(side + 'Ulna', side + 'LowerArm');
    ul.push(ell([s * 0.118, 0.618, -0.03], [0.0072, 0.012, 0.0072], { blend: 0.003 }));
    ul.push(ell([s * 0.118, 0.607, -0.022], [0.007, 0.007, 0.006], { blend: 0.004 }));
    tube(ul, [[s * 0.118, 0.605, -0.025], [s * 0.118, 0.54, -0.022], [s * 0.119, 0.47, -0.017], [s * 0.12, 0.452, -0.015]], 0.0068, 0.004, { blend: 0.003 });
    ul.push(ell([s * 0.12, 0.449, -0.015], [0.0055, 0.006, 0.0055], { blend: 0.003 }));
    const ra = part(side + 'Radius', side + 'LowerArm');
    ra.push(cone([s * 0.134, 0.609, -0.006], [s * 0.134, 0.6, -0.006], 0.0068, 0.0068, { blend: 0.002 }));
    tube(ra, [[s * 0.134, 0.598, -0.006], [s * 0.132, 0.55, 0.0], [s * 0.126, 0.49, 0.006], [s * 0.123, 0.457, 0.007]], (t) => 0.004 + t * t * 0.004, 0, { blend: 0.003 });
    ra.push(ellAlong([s * 0.122, 0.452, 0.004], [0, 0, 1], [0.0085, 0.013, 0.006], 0, { blend: 0.004 }));
    // ---- the hand, bone by bone ----
    // Built in the hand's own frame: U down the hand (toward the fingertips), V across the palm
    // toward the thumb, N out of the back of the hand (the palm faces the thigh, so the palm is -N).
    const W = wrJ, U = [0, -1, 0], V = [0, 0, 1], N = [s, 0, 0];
    const P = (a, b, c) => add(add(add(W, mul(U, a)), mul(V, b)), mul(N, c));
    // an ellipsoid in a bone's frame: rows [across, along, back-of-hand], radii in that order
    const bell = (c, D, Nb, r, blend = 0.0012) => { const X = norm(cross(D, Nb)), Nn = cross(X, D); return ell(c, r, { m: [...X, ...D, ...Nn], blend }); };
    const turn = (D, Nb, a) => [norm(add(mul(D, Math.cos(a)), mul(Nb, -Math.sin(a)))), norm(add(mul(Nb, Math.cos(a)), mul(D, Math.sin(a))))]; // curl toward the palm
    const spreadBy = (D, Nb, a) => { const X = norm(cross(D, Nb)); return norm(add(mul(D, Math.cos(a)), mul(X, Math.sin(a)))); };
    // one long bone of the hand: a flared base, a slim shaft flat on the palm side and bowed to the
    // back, and a head: rounded (palm bones), two small knuckles with a groove (finger bones), or
    // the flat spade that carries the nail (fingertips)
    const longBone = (out, p, D, Nb, l, w, kind) => {
      const X = norm(cross(D, Nb)), at = (u, x = 0, c = 0) => add(add(add(p, mul(D, u)), mul(X, x)), mul(Nb, c));
      if (kind === 'meta') out.push(bell(at(l * 0.1, 0, 0.0002), D, Nb, [w * 1.25, l * 0.12, w * 1.2]));
      else out.push(bell(at(w * 0.6, 0, -w * 0.05), D, Nb, [w * 1.12, w * 0.75, w * 0.92]));
      out.push(bell(at(l * 0.5, 0, w * 0.08), D, Nb, [w * 0.9, l * 0.47, w * 0.72], 0.0028));
      if (kind === 'meta') out.push(bell(at(l - w * 1.0, 0, -w * 0.12), D, Nb, [w * 1.0, w * 1.1, w * 1.2], 0.0028));
      else if (kind === 'tip') {
        out.push(bell(at(l - w * 0.55, 0, w * 0.05), D, Nb, [w * 0.9, w * 0.55, w * 0.42], 0.0012));
        out.push(bell(at(l - w * 0.75, 0, -w * 0.25), D, Nb, [w * 0.55, w * 0.45, w * 0.3], 0.0012));
      } else for (const k of [-1, 1]) out.push(bell(at(l - w * 0.6, k * w * 0.4, -w * 0.06), D, Nb, [w * 0.52, w * 0.62, w * 0.72], 0.0022));
    };
    const ha = part(side + 'Carpals', side + 'Hand', 'bone', 0.0008);
    // the wrist: two rows of four small bones, set in an arch (the palm side is hollow)
    const tilt = (a) => [norm(add(mul(U, Math.cos(a)), mul(V, Math.sin(a)))), N];
    for (const [c, r, a] of [
      [P(0.008, 0.009, -0.001), [0.0042, 0.0062, 0.0038], 0.6],    // scaphoid (boat-shaped, under the thumb)
      [P(0.0072, 0.0002, 0.0002), [0.0038, 0.0045, 0.0044], 0],    // lunate (half-moon)
      [P(0.0092, -0.0083, 0.0), [0.0034, 0.0043, 0.0036], -0.3],   // triquetrum
      [P(0.0102, -0.0092, -0.0048), [0.0026, 0.003, 0.0026], 0],   // pisiform (the pea on the palm side)
      [P(0.0182, 0.0128, -0.0028), [0.0042, 0.0042, 0.0038], 0.45], // trapezium (the thumb's saddle)
      [P(0.0178, 0.0058, 0.0002), [0.0031, 0.0042, 0.0036], 0.1],  // trapezoid
      [P(0.0162, -0.0004, 0.0001), [0.0037, 0.0066, 0.0043], 0],   // capitate (the biggest, in the middle)
      [P(0.0175, -0.0079, -0.0006), [0.0037, 0.0055, 0.0038], -0.15], // hamate
    ]) { const [D, Nb] = tilt(a); ha.push(bell(c, D, Nb, r.map((v) => v * 1.1), 0.0006)); }
    ha.push(bell(P(0.0195, -0.0086, -0.0054), U, N, [0.0017, 0.0026, 0.0022], 0.0015)); // the hamate's hook
    // the four fingers: palm bone (metacarpal) from the wrist, then three finger bones (phalanges).
    // Goblin fingers are long; the middle finger is the longest, the little finger the shortest.
    const FING = [
      // name, metacarpal base [a, b], head [a, b, c], width, phalanx lengths, spread, curl at each joint
      ['Index', [0.023, 0.006], [0.0705, 0.0105, -0.0005], 0.0029, [0.029, 0.017, 0.0135], 0.05, [0.12, 0.25, 0.15]],
      ['Middle', [0.0225, -0.0003], [0.0715, 0.0032, 0.0], 0.003, [0.032, 0.02, 0.0145], 0, [0.15, 0.28, 0.17]],
      ['Ring', [0.0225, -0.0062], [0.068, -0.0045, -0.0008], 0.0027, [0.03, 0.019, 0.014], -0.04, [0.2, 0.32, 0.2]],
      ['Little', [0.0225, -0.0098], [0.0625, -0.0115, -0.0025], 0.0025, [0.024, 0.014, 0.0125], -0.1, [0.26, 0.38, 0.24]],
    ];
    const gap = 0.0013;
    for (const [i, [name, b0, h0, w, ph, spread, curls]] of FING.entries()) {
      const base = P(b0[0], b0[1], 0), head = P(...h0);
      // the back of the hand curves: the outer fingers lean toward the palm
      const roll = (i - 1) * 0.12 * (i > 1 ? 1.4 : 1);
      let D = norm(sub(head, base)), Nb = norm(add(mul(N, Math.cos(roll)), mul(V, -Math.sin(roll))));
      Nb = norm(sub(Nb, mul(D, D[0] * Nb[0] + D[1] * Nb[1] + D[2] * Nb[2])));
      const mc = part(side + name + 'Metacarpal', side + 'Hand', 'bone', 0.0008);
      longBone(mc, base, D, Nb, len(sub(head, base)) + w * 0.4, w * 1.05, 'meta');
      let p = add(head, mul(D, w * 0.4 + gap));
      D = spreadBy(D, Nb, spread);
      let parent = side + 'Hand';
      for (const [j, l] of ph.entries()) {
        [D, Nb] = turn(D, Nb, curls[j]);
        const jn = side + name + ['Proximal', 'Intermediate', 'Distal'][j];
        joint(jn, parent, p); parent = jn;
        const fb = part(jn, jn, 'bone', 0.0007);
        const ww = w * [0.95, 0.8, 0.7][j];
        longBone(fb, p, D, Nb, l, ww, j === 2 ? 'tip' : 'mid');
        p = add(p, mul(D, l + gap));
      }
    }
    // the thumb: a short, thick metacarpal off the saddle of the trapezium, set in front of the palm
    // and turned so its nail faces sideways, then two bones; two pea-sized sesamoids under its knuckle
    {
      let D = norm(add(add(mul(U, 0.9), mul(V, 0.22)), mul(N, -0.36)));
      let Nb = norm(add(mul(V, 0.55), mul(N, 0.6)));
      Nb = norm(sub(Nb, mul(D, D[0] * Nb[0] + D[1] * Nb[1] + D[2] * Nb[2])));
      const base = P(0.0215, 0.0145, -0.0052), w = 0.0037, l = 0.03;
      const mc = part(side + 'ThumbMetacarpal', side + 'Hand', 'bone', 0.0008);
      joint(side + 'ThumbMetacarpal', side + 'Hand', base);
      longBone(mc, base, D, Nb, l, w, 'meta');
      const X = norm(cross(D, Nb));
      for (const k of [-1, 1]) mc.push(ell(add(add(add(base, mul(D, l - w * 0.9)), mul(Nb, -w * 1.25)), mul(X, k * w * 0.55)), [0.0014, 0.0016, 0.0014], { blend: 0.0005 }));
      let p = add(base, mul(D, l + gap));
      let parent = side + 'ThumbMetacarpal';
      for (const [j, [l2, c]] of [[0.022, 0.12], [0.0175, 0.22]].entries()) {
        [D, Nb] = turn(D, Nb, c);
        const jn = side + 'Thumb' + ['Proximal', 'Distal'][j];
        joint(jn, parent, p); parent = jn;
        const fb = part(jn, jn, 'bone', 0.0007);
        longBone(fb, p, D, Nb, l2, w * [0.9, 0.82][j], j ? 'tip' : 'mid');
        p = add(p, mul(D, l2 + gap));
      }
    }
  }

  // ---- the skull ----
  {
    const sk = part('skull', 'head', 'bone', 0.0011);
    // the dental arch (x, z) at t 0 (front teeth) .. 1 (back teeth), shared by teeth and jaws
    const arch = (t, s, k = 1) => [s * (0.005 + 0.029 * t) * k, 0.104 * k - 0.05 * Math.pow(t, 1.4) * k];
    // the braincase: big and round, bulging behind (a goblin's head is huge for its body)
    sk.push(ell(h(0, 0.08, 0.008), [0.091, 0.089, 0.11], { blend: 0.004 }));
    sk.push(ell(h(0, 0.06, -0.06), [0.072, 0.066, 0.06], { blend: 0.02 }));
    // the base of the skull behind the jaw joints, and the knobs behind the ears (mastoids)
    sk.push(ell(h(0, 0.004, -0.008), [0.062, 0.022, 0.05], { blend: 0.012 }));
    for (const s of [-1, 1]) sk.push(ell(h(s * 0.064, -0.012, -0.03), [0.009, 0.014, 0.009], { blend: 0.008 }));
    // the face, built forward of the braincase: the brow and eye-socket block, the cheekbones, the
    // upper jaw, and the ridge that holds the upper teeth
    sk.push(ell(h(0, 0.03, 0.074), [0.06, 0.036, 0.04], { blend: 0.01 }));
    sk.push(ell(h(0, -0.002, 0.08), [0.04, 0.022, 0.032], { blend: 0.01 }));
    for (const s of [-1, 1]) sk.push(ell(h(s * 0.051, 0.012, 0.08), [0.0145, 0.014, 0.019], { blend: 0.008 }));
    {
      const pts = [];
      for (let i = 6; i >= 0; i--) pts.push(arch(i / 6, -1));
      for (let i = 1; i <= 6; i++) pts.push(arch(i / 6, 1));
      tube(sk, pts.map(([x, z]) => h(x, -0.014, z + 0.001)), 0.0075, 0.0075, { blend: 0.008 }, 3);
    }
    // the rims of the eye sockets: big and round (a goblin's eyes are big), the outer edge set back
    const eye = (s) => h(s * 0.035, 0.038, 0.104);
    for (const s of [-1, 1]) {
      const o = eye(s), ring = [];
      for (let k = 0; k <= 14; k++) {
        const a = (k / 14) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
        ring.push(add(o, [s * c * 0.0225, sn * 0.0205 + (sn > 0 ? 0.002 : 0), -Math.max(0, c) * 0.016 + (sn > 0 ? 0.003 * sn : 0)]));
      }
      tube(sk, ring, (t) => 0.0042 + 0.0016 * Math.max(0, Math.sin(t * Math.PI * 2)), 0, { blend: 0.006 }, 6);
    }
    // carved out: the sockets themselves (deep cones narrowing back toward the brain), the hollows at
    // the temples where the chewing muscle lies, the pear-shaped opening of the nose, the jaw joints'
    // sockets and the ear holes
    for (const s of [-1, 1]) {
      const o = eye(s);
      sk.push(cone(add(o, [0, 0, 0.03]), add(o, [-s * 0.004, -0.002, -0.004]), 0.0195, 0.0185, { sub: true, blend: 0.003 }));
      sk.push(cone(add(o, [-s * 0.004, -0.002, -0.004]), add(o, [-s * 0.01, 0.0, -0.04]), 0.0185, 0.007, { sub: true, blend: 0.004 }));
    }
    for (const s of [-1, 1]) sk.push(ell(h(s * 0.103, 0.035, 0.035), [0.024, 0.036, 0.044], { sub: true, blend: 0.012 }));
    sk.push(ell(h(0, 0.006, 0.112), [0.0105, 0.0155, 0.022], { sub: true, blend: 0.003 }));
    sk.push(ell(h(0, -0.004, 0.112), [0.0135, 0.007, 0.02], { sub: true, blend: 0.004 }));
    for (const s of [-1, 1]) {
      sk.push(ell(h(s * 0.062, 0.004, -0.006), [0.007, 0.004, 0.006], { sub: true, blend: 0.002 }));
      sk.push(cone(h(s * 0.07, 0.012, -0.018), h(s * 0.1, 0.012, -0.018), 0.0055, 0.0055, { sub: true, blend: 0.002 }));
    }
    // added after the carving: the bridge of the long hooked nose, and the cheek arches back to the ear
    tube(sk, [h(0, 0.06, 0.112), h(0, 0.04, 0.12), h(0, 0.024, 0.129)], 0.0062, 0.0036, { blend: 0.007 });
    for (const s of [-1, 1]) {
      tube(sk, [h(s * 0.06, 0.014, 0.074), h(s * 0.07, 0.013, 0.04), h(s * 0.07, 0.01, 0.004)], (t) => 0.0048 - t * 0.001, 0, { blend: 0.004 });
      sk.push(ellAlong(h(s * 0.07, 0.013, 0.04), [0, 0, 1], [0.0035, 0.02, 0.0065], 0, { blend: 0.004 })); // (flat, not round)
    }
    // upper teeth: small and sharp, a longer fang at each corner
    const te = part('upperTeeth', 'head', 'tooth', 0.0007);
    for (const s of [-1, 1]) for (let i = 0; i < 7; i++) {
      const [x, z] = arch(i / 6, s);
      const fang = i === 2, len2 = fang ? 0.016 : i > 3 ? 0.008 : 0.011;
      const r = i > 3 ? 0.0042 : fang ? 0.0036 : 0.0029;
      te.push(cone(h(x, -0.016, z), h(x, -0.018 - len2, z + (i < 2 ? 0.002 : 0)), r, i > 3 ? 0.0018 : 0.0006, { blend: 0.0006 }));
    }
    // the lower jaw (on its own joint): a narrow U to a pointed chin, the upright branches to the joints
    const jw = part('jawBone', 'jaw', 'bone', 0.0011);
    {
      // the body of the jaw: a tall, thin band round the U
      const side = (s) => [h(s * 0.05, -0.054, -0.002), h(s * 0.043, -0.053, 0.045), h(s * 0.025, -0.054, 0.084)];
      const path = spline([...side(-1), h(0, -0.056, 0.099), ...side(1).reverse()], 4);
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i], b = path[i + 1], c = lerp(a, b, 0.5), mid = Math.abs(i - (path.length - 2) / 2) / ((path.length - 2) / 2);
        jw.push(ellAlong(c, sub(b, a), [0.0125 + (1 - mid) * 0.002, len(sub(b, a)) * 1.3, 0.0045], 0, { blend: 0.004 }));
      }
      // the point of the chin, and the ridge that holds the lower teeth
      jw.push(ell(h(0, -0.066, 0.1), [0.0085, 0.008, 0.0065], { blend: 0.006 }));
      const pts = [];
      for (let i = 6; i >= 0; i--) pts.push(arch(i / 6, -1, 0.94));
      for (let i = 1; i <= 6; i++) pts.push(arch(i / 6, 1, 0.94));
      tube(jw, pts.map(([x, z]) => h(x, -0.044, z)), 0.0055, 0.0055, { blend: 0.006 }, 3);
    }
    for (const s of [-1, 1]) {
      // the upright branch to the jaw joint, the thin blade in front of it (coronoid), the joint's knob
      const g = h(s * 0.05, -0.058, -0.004), cd = h(s * 0.06, -0.002, -0.006);
      jw.push(ellAlong(lerp(g, cd, 0.5), sub(cd, g), [0.0038, len(sub(cd, g)) * 0.55, 0.0105], 0, { blend: 0.006 }));
      const c0 = h(s * 0.051, -0.04, 0.012), c1 = h(s * 0.056, -0.003, 0.021);
      jw.push(ellAlong(lerp(c0, c1, 0.5), sub(c1, c0), [0.0032, len(sub(c1, c0)) * 0.55, 0.0065], 0, { blend: 0.006 }));
      jw.push(ell(h(s * 0.061, 0.002, -0.006), [0.0085, 0.0042, 0.0055], { blend: 0.004 }));
    }
    const lt = part('lowerTeeth', 'jaw', 'tooth', 0.0007);
    for (const s of [-1, 1]) for (let i = 0; i < 7; i++) {
      const [x, z] = arch(i / 6, s, 0.94);
      const fang = i === 2, len2 = fang ? 0.013 : i > 3 ? 0.007 : 0.009;
      const r = i > 3 ? 0.004 : fang ? 0.0034 : 0.0026;
      lt.push(cone(h(x, -0.041, z), h(x, -0.041 + len2, z), r, i > 3 ? 0.0017 : 0.0006, { blend: 0.0006 }));
    }
    // the cartilage that shapes the goblin's long hooked nose and long pointed ears (not bone, but
    // drawn here pale so the head's real outline can be judged)
    const ca = part('noseAndEars', 'head', 'cartilage', 0.0011);
    tube(ca, [h(0, 0.026, 0.13), h(0, 0.012, 0.15), h(0, -0.004, 0.164), h(0, -0.018, 0.16), h(0, -0.02, 0.152)], (t) => 0.0055 + Math.sin(t * Math.PI) * 0.004, 0, { blend: 0.004 });
    for (const s of [-1, 1]) {
      ca.push(ell(h(s * 0.011, -0.008, 0.138), [0.008, 0.007, 0.011], { blend: 0.006 }));
      // the ear: a long, flat leaf sweeping out, up and back from the ear hole to a point
      const base = h(s * 0.088, 0.016, -0.012), tip = h(s * 0.2, 0.072, -0.058);
      const dir = sub(tip, base);
      for (let i = 0; i < 24; i++) {
        const t = i / 24, c = lerp(base, tip, t + 0.02);
        const w = 0.021 * Math.sin((t * 0.85 + 0.12) * Math.PI) * (1 - t * 0.45) + 0.002;
        ca.push(ellAlong(c, dir, [w, len(dir) * 0.06, 0.0026], s * 0.9, { blend: 0.006 }));
      }
      tube(ca, [base, lerp(base, tip, 0.5), tip], 0.0028, 0.0012, { blend: 0.004 });
    }
  }

  // The stance: bent over, as the newborn stands in the lineup. Angles in radians (x bends
  // forward, z swings out to the side), each joint relative to its parent.
  const pose = {
    hips: [0.24, 0, 0], spine: [0.1, 0, 0], chest: [0.18, 0, 0],
    neck: [-0.24, 0, 0], head: [-0.26, 0, 0], jaw: [0.04, 0, 0],
    leftUpperLeg: [-0.86, 0, 0.06], rightUpperLeg: [-0.86, 0, -0.06],
    leftLowerLeg: [1.0, 0, 0], rightLowerLeg: [1.0, 0, 0],
    leftFoot: [-0.38, 0, -0.04], rightFoot: [-0.38, 0, 0.04],
    leftShoulder: [0, 0.12, 0], rightShoulder: [0, -0.12, 0],
    leftUpperArm: [-0.48, 0, 0.1], rightUpperArm: [-0.48, 0, -0.1],
    leftLowerArm: [-0.32, 0, 0], rightLowerArm: [-0.32, 0, 0],
    leftHand: [0.08, 0, 0], rightHand: [0.08, 0, 0],
  };
  // everything above is drawn for a skull top at 1.09 m; scale it to the newborn's height (0.95 m
  // standing straight, skin and scalp included)
  const k = height / 1.1;
  const P3 = (p) => mul(p, k);
  for (const j of joints) j.pos = P3(j.pos);
  for (const p of parts) {
    p.cell *= k;
    for (const q of p.shapes) {
      q.blend *= k;
      if (q.kind === 'cone') { q.a = P3(q.a); q.b = P3(q.b); q.ra *= k; q.rb *= k; } else { q.c = P3(q.c); q.r = q.r.map((v) => v * k); }
    }
  }
  return { name: 'Goblin (newborn)', height, joints, parts, pose };
}
