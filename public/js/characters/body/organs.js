// The organs inside the trunk, each sculpted as its own shape and fitted into the space the
// skeleton and muscles leave: in the chest the heart (four chambers, the great vessels at its base,
// the coronary vessels on its surface), the two lungs (three lobes on the right, two on the left),
// the windpipe with its rings and the bronchi, the gullet, and the dome of the diaphragm; in the
// belly the liver and gallbladder, stomach, spleen, pancreas, the duodenum, small and large
// intestine with the appendix, the kidneys with their adrenal glands, and the vessels that feed
// them; in the pelvis the bladder, the ureters and the rectum. (The body is unisex, so there are no
// reproductive organs.)
// Laid out like the bones: rest, drawing units (a skull top at 1.1), body's left at +x, front +z,
// then scaled by k and hung on the trunk's joints (chest, spine, hips) so they move with it.
// Plain numbers and arrays only (no three.js).
import { ell, sweep, mapShape, norm } from './sdf.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);

// Catmull-Rom through points
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
// an ellipsoid with its own axes: a (radius r[0]), b (made square to a; r[1]) and a × b (r[2])
function ellF(c, a, b, r, opts = {}) {
  const A = norm(a), B = norm(sub(b, mul(A, dot(A, b)))), C = cross(A, B);
  return ell(c, r, { m: [...A, ...B, ...C], blend: 0.003, ...opts });
}
// a round tube (one sweep) through points, radius r0 to r1 (or r(t) for t 0..1)
function tube(pts, r0, r1 = r0, opts = {}) {
  const R = typeof r0 === 'function' ? r0 : (t) => r0 + (r1 - r0) * t;
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + len(sub(pts[i], pts[i - 1])));
  return sweep(pts.map((p, i) => { const r = R(L[i] / L[L.length - 1]); return { p, r: [r, r, r, r] }; }), { steps: 4, blend: 0.0015, round: 0, ...opts });
}
// a half-space carving: removes everything on the side n points to, beyond the plane through p
// (a huge sphere, so it is flat enough here)
const cut = (p, n, blend = 0.003) => { const N = norm(n), R = 2; return ell(add(p, mul(N, R)), [R, R, R], { sub: true, blend }); };
// a bag along a curve whose radius swells and narrows in a row of pouches (the large intestine's
// haustra): pouch length `step`, radius r(t), pinched to `pinch` of it between pouches
function pouched(pts, r, step, pinch = 0.82, opts = {}) {
  const p = spline(pts, 8), L = [0];
  for (let i = 1; i < p.length; i++) L.push(L[i - 1] + len(sub(p[i], p[i - 1])));
  const tot = L[L.length - 1], st = [], n = Math.max(4, Math.round(tot / (step / 4)));
  let j = 0;
  for (let i = 0; i <= n; i++) {
    const d = (tot * i) / n;
    while (j < L.length - 2 && L[j + 1] < d) j++;
    const q = lerp(p[j], p[j + 1], (d - L[j]) / Math.max(1e-9, L[j + 1] - L[j]));
    const wob = 1 - (1 - pinch) * Math.pow(Math.cos(Math.PI * d / step), 8);
    const rr = r(d / tot) * wob;
    st.push({ p: q, r: [rr, rr, rr, rr] });
  }
  return sweep(st, { steps: 2, blend: 0.0012, round: 0, ...opts });
}

export function goblinOrgans(S) {
  const k = S.scale;
  const parts = [];
  const part = (name, joint, mat, cell = 0.0009) => { const p = { name, joint, mat, cell, shapes: [] }; parts.push(p); return p.shapes; };

  // ======================= CHEST =======================
  // ---- the heart: tilted forward and to the left, its tip (apex) touching the chest wall ----
  const base = [-0.002, 0.744, 0.024], apex = [0.036, 0.699, 0.053];
  const ax = norm(sub(apex, base)), fr = norm(sub([0, 0.25, 1], mul(ax, dot(ax, [0, 0.25, 1])))); // the front (sternocostal) face
  const lt = cross(ax, fr); // toward the heart's left side
  const H = (u, f, l) => add(add(add(base, mul(ax, u)), mul(fr, f)), mul(lt, l)); // a point in the heart's frame
  {
    const h = part('heart', 'chest', 'heart', 0.0008);
    // the ventricles: a blunt cone from the base to the apex, flat underneath (it rests on the
    // diaphragm), the thick left ventricle making the left side and apex, the right one the front
    // (overlapping ellipsoids melted together: smooth however fat; a sweep this fat would show steps)
    h.push(ellF(H(0.02, 0.001, 0.0), ax, fr, [0.024, 0.02, 0.022], { blend: 0.004 }));
    h.push(ellF(H(0.04, 0.001, 0.003), ax, fr, [0.024, 0.016, 0.017], { blend: 0.012 }));
    h.push(ellF(H(0.056, 0.0, 0.004), ax, fr, [0.011, 0.008, 0.008], { blend: 0.01 }));
    h.push(ellF(H(0.03, 0.007, -0.008), ax, fr, [0.024, 0.014, 0.014], { blend: 0.01 })); // (the right ventricle's front)
    h.push(cut(H(0.03, -0.016, 0), mul(fr, -1), 0.008)); // the flat underside on the diaphragm
    // the groove between the two ventricles on the front (where the left anterior descending
    // coronary artery runs) and the one between atria and ventricles (where the right coronary runs)
    h.push(sweep([0.012, 0.03, 0.048, 0.06].map((u, i) => ({ p: H(u, 0.021 - i * 0.002 - (u > 0.05 ? 0.007 : 0), 0.004 + i * 0.001), r: [0.0012, 0.0016, 0.0012, 0.0016] })), { front: fr, lat: lt, sub: true, blend: 0.002 }));
    // right atrium (receives both venae cavae) with its ear (auricle) folding round the aorta's root
    h.push(ellF([-0.017, 0.742, 0.019], [0, 1, 0.1], [1, 0, 0.2], [0.014, 0.013, 0.012], { blend: 0.004 }));
    h.push(ellF([-0.009, 0.755, 0.033], [0.8, 0.2, 0.3], [0, 1, 0], [0.008, 0.0045, 0.004], { blend: 0.003 }));
    // left atrium (receives the four lung veins), at the back, and its ear peeking out on the left
    h.push(ellF([0.006, 0.749, -0.002], [1, 0, 0], [0, 1, 0], [0.017, 0.011, 0.01], { blend: 0.004 }));
    h.push(ellF([0.024, 0.752, 0.024], [0.3, -0.3, 1], [1, 0, 0], [0.008, 0.004, 0.0035], { blend: 0.003 }));
    // the outflow cone of the right ventricle rising to the pulmonary trunk
    h.push(ellF([0.008, 0.744, 0.04], [0.15, 1, -0.2], [1, 0, 0], [0.008, 0.0085, 0.0075], { blend: 0.004 }));
    // great vessels at the base: the pulmonary trunk (left and in front of the aorta) and its two
    // branches to the lungs (the aorta and venae cavae are drawn with the other vessels)
    const pa = part('pulmonaryArteries', 'chest', 'vein', 0.0006); // (blood without oxygen: shown blue)
    pa.push(tube([[0.009, 0.748, 0.042], [0.013, 0.762, 0.038], [0.015, 0.774, 0.026], [0.014, 0.778, 0.014]], 0.0055, 0.005));
    pa.push(tube([[0.014, 0.778, 0.014], [0.005, 0.776, 0.012], [-0.012, 0.774, 0.01], [-0.026, 0.772, -0.006], [-0.034, 0.77, -0.014]], 0.004, 0.0034));
    pa.push(tube([[0.014, 0.778, 0.014], [0.024, 0.779, 0.004], [0.032, 0.776, -0.008], [0.036, 0.772, -0.014]], 0.004, 0.0034));
    // the ductus ligament: the cord left by the newborn's closed shortcut from pulmonary trunk to aorta
    part('heartLigaments', 'chest', 'tendon', 0.0005).push(tube([[0.015, 0.777, 0.02], [0.016, 0.785, 0.012], [0.015, 0.792, 0.006]], 0.0011));
    // the four lung veins into the left atrium (blood full of oxygen: shown red)
    const pv = part('pulmonaryVeins', 'chest', 'artery', 0.0006);
    for (const s of [-1, 1]) for (const [y, yl] of [[0.753, 0.762], [0.744, 0.742]]) {
      pv.push(tube([[s * 0.034, yl, -0.016], [s * 0.024, (y + yl) / 2, -0.01], [s * 0.012 + 0.006, y, -0.004]], 0.0028, 0.003));
    }
    // the coronary arteries on the heart's surface, from the root of the aorta: the left one splits
    // into the anterior descending (down the front groove) and the circumflex (round the left side);
    // the right one runs round the right in the groove between atrium and ventricle
    const cor = part('coronaryArteries', 'chest', 'artery', 0.0004);
    const lad = [0.008, 0.02, 0.034, 0.048, 0.06].map((u, i) => H(u, 0.0215 - i * 0.0015 - (u > 0.05 ? 0.007 : 0), 0.004 + i * 0.001));
    cor.push(tube([[0.004, 0.741, 0.031], [0.009, 0.742, 0.034], ...lad], 0.0013, 0.0007));
    cor.push(tube([[0.009, 0.742, 0.034], H(0.012, 0.012, 0.016), H(0.016, 0, 0.022), H(0.022, -0.012, 0.018), H(0.03, -0.018, 0.012)], 0.0011, 0.0007));
    cor.push(tube([[-0.002, 0.738, 0.033], H(0.004, 0.015, -0.018), H(0.012, 0.004, -0.024), H(0.02, -0.012, -0.02), H(0.03, -0.018, -0.008), H(0.044, -0.016, 0.0)], 0.0013, 0.0007));
    // and the great cardiac vein beside the anterior descending artery, into the coronary sinus
    const cv = part('coronaryVeins', 'chest', 'vein', 0.0004);
    cv.push(tube([...lad.slice(1).reverse().map((p) => add(p, mul(lt, 0.0028))), H(0.012, 0.012, 0.019), H(0.016, -0.002, 0.024), H(0.016, -0.016, 0.014), H(0.012, -0.02, 0.0), H(0.008, -0.018, -0.012)], 0.0007, 0.0014));
  }

  // ---- the windpipe (trachea) with its C-shaped rings, splitting into the two main bronchi ----
  const carina = [0, 0.784, -0.013];
  const trPts = [[0, 0.872, -0.022], [0, 0.85, -0.019], [0, 0.82, -0.017], [0, 0.8, -0.015], carina];
  const rB = [[-0.008, 0.779, -0.015], [-0.02, 0.773, -0.016], [-0.03, 0.768, -0.017]]; // right: short, wide, steep
  const lB = [[0.009, 0.781, -0.015], [0.021, 0.775, -0.018], [0.034, 0.767, -0.02]];   // left: long, under the aortic arch
  {
    const tr = part('trachea', 'upperChest', 'airway', 0.0005);
    tr.push(tube(trPts, 0.0058, 0.0056));
    tr.push(tube([carina, ...rB], 0.0045, 0.004));
    tr.push(tube([carina, ...lB], 0.0042, 0.0036));
    // inside each lung the bronchi split into lobar and segment branches (seen with the lung hidden)
    const lobar = [
      [rB[2], [-0.034, 0.79, -0.024], [-0.04, 0.81, -0.03]], // right upper lobe
      [rB[2], [-0.044, 0.758, 0.0], [-0.054, 0.75, 0.02]],    // right middle lobe
      [rB[2], [-0.04, 0.74, -0.03], [-0.046, 0.7, -0.046]],   // right lower lobe
      [lB[2], [0.04, 0.786, -0.022], [0.044, 0.812, -0.03]],   // left upper lobe
      [lB[2], [0.046, 0.76, 0.006], [0.054, 0.742, 0.018]],    // (the upper lobe's tongue, the lingula)
      [lB[2], [0.042, 0.74, -0.032], [0.048, 0.7, -0.048]],    // left lower lobe
    ];
    for (const b of lobar) {
      tr.push(tube(b, 0.003, 0.0018));
      const e = b[2], d = norm(sub(b[2], b[1]));
      for (const tw of [[0.6, 0.3, 0.5], [-0.5, -0.4, 0.6], [0.2, -0.6, -0.5]]) {
        const o = norm(add(d, tw));
        tr.push(tube([e, add(e, mul(o, 0.006)), add(e, mul(norm(add(o, d)), 0.011))], 0.0017, 0.001));
      }
    }
    // the rings: horseshoes of cartilage, open at the back where the gullet lies
    const rings = part('tracheaRings', 'upperChest', 'cartilage', 0.0004);
    const tp = spline(trPts, 6);
    for (let i = 1; i < tp.length - 1; i += 1) {
      const c = tp[i], t = norm(sub(tp[i + 1], tp[i - 1]));
      const pts = [];
      for (let a = -150; a <= 150; a += 25) {
        const r = (a * Math.PI) / 180, u = [Math.sin(r), 0, Math.cos(r)];
        pts.push(add(c, mul(norm(sub(u, mul(t, dot(u, t)))), 0.0057)));
      }
      rings.push(sweep(pts.map((p) => ({ p, r: [0.0007, 0.0011, 0.0007, 0.0011] })), { front: t, lat: [0, 1, 0], steps: 2, blend: 0.0006 }));
    }
  }

  // ---- the gullet (esophagus): behind the windpipe, in front of the spine, to the right of the
  // descending aorta, then forward and left through the diaphragm into the stomach ----
  const cardia = [0.021, 0.674, 0.002];
  part('esophagus', 'chest', 'gut', 0.0006).push(tube([[-0.001, 0.872, -0.032], [-0.002, 0.84, -0.03], [-0.003, 0.8, -0.03], [-0.004, 0.77, -0.033], [-0.003, 0.74, -0.034], [0.0, 0.715, -0.026], [0.006, 0.698, -0.016], [0.013, 0.686, -0.008], cardia], 0.0042, 0.005));

  // ---- the diaphragm: two domes (the right one higher, over the liver) meeting in a flatter middle
  // under the heart; a muscle sheet whose middle is a clover of tendon ----
  const domes = [
    // (lens-shaped, widest where the ribcage is, so their sides follow the ribs inward below)
    { c: [-0.022, 0.672, -0.006], r: [0.033, 0.036, 0.043] }, // right dome, top at 0.708
    { c: [0.024, 0.67, -0.008], r: [0.032, 0.031, 0.042] },   // left dome, top at 0.701
    { c: [0, 0.672, 0.0], r: [0.03, 0.02, 0.045] },           // the middle under the heart (0.692)
  ];
  const T = 0.0016;
  const rim = (sh, b) => { // the sheet ends where it springs from the ribs, spine and breastbone
    sh.push(cut([0, 0.662, 0.0], [0, -1, 0.25], b)); // (front higher than back)
  };
  {
    const d = part('diaphragm', 'chest', 'muscle', 0.0007);
    for (const q of domes) d.push(ell(q.c, q.r, { blend: 0.01 }));
    for (const q of domes) d.push(ell(q.c, q.r.map((v) => v - T), { sub: true, blend: 0.002 }));
    rim(d, 0.002);
    d.push(tube([[0, 0.73, -0.06], [0, 0.705, -0.053], [0, 0.673, -0.04], [0, 0.656, -0.03], [0, 0.62, -0.016]], 0.0175, 0.0175, { sub: true, blend: 0.003 })); // (it arches round the spine)
    // the two pillars (crura) that hold it to the front of the lumbar spine, and the openings for
    // the gullet and the inferior vena cava are left by the shapes passing through
    for (const s of [-1, 1]) d.push(tube([[s * 0.011, 0.664, -0.018], [s * 0.01, 0.645, -0.01], [s * 0.008, 0.62, -0.002], [s * 0.006, 0.598, 0.004]], s > 0 ? 0.0025 : 0.003, 0.0012));
    const ct = part('diaphragmTendon', 'chest', 'tendon', 0.0007);
    for (const q of domes) ct.push(ell(q.c, q.r.map((v) => v + 0.0003), { blend: 0.01 }));
    for (const q of domes) ct.push(ell(q.c, q.r.map((v) => v - T - 0.0003), { sub: true, blend: 0.002 }));
    // (only the middle: a clover of three leaves, front and either side, under the heart)
    ct.push(cut([0, 0.689, 0.0], [0, -1, 0], 0.002), cut([0.026, 0, 0], [1, 0, 0.3], 0.004), cut([-0.028, 0, 0], [-1, 0, 0.3], 0.004), cut([0, 0, -0.016], [0, 0, -1], 0.004));
    ct.push(tube([[0, 0.73, -0.06], [0, 0.705, -0.053], [0, 0.673, -0.04], [0, 0.656, -0.03], [0, 0.62, -0.016]], 0.0175, 0.0175, { sub: true, blend: 0.003 }));
  }

  // ---- the lungs: filling the ribcage beside the heart; the right one with three lobes, the left
  // with two and a notch where the heart presses ----
  // (x lateral, front z, back z) of each section, read off the inside of the ribcage
  const LS = [
    [0.846, 0.03, -0.022, -0.036], [0.836, 0.044, -0.006, -0.046], [0.822, 0.05, 0.006, -0.06], [0.806, 0.052, 0.022, -0.074],
    [0.79, 0.058, 0.03, -0.078], [0.775, 0.065, 0.036, -0.08], [0.76, 0.068, 0.04, -0.08], [0.745, 0.069, 0.044, -0.079],
    [0.73, 0.069, 0.048, -0.077], [0.715, 0.069, 0.049, -0.073], [0.7, 0.067, 0.049, -0.068], [0.685, 0.064, 0.046, -0.06],
    [0.67, 0.057, 0.038, -0.05], [0.656, 0.05, 0.026, -0.042],
  ];
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'left' : 'right';
    const lu = part(side + 'Lung', 'chest', 'lung', 0.0009);
    const med = 0.011;
    LS.forEach(([y, xl, zf, zb], i) => {
      
      xl -= y > 0.83 ? 0.008 : 0.004; zb += 0.005; // (kept clear of the ribs, which bulge in at the back angle)
      const cx = (xl + med) / 2, cz = (zf + zb) / 2, f = (zf - zb) / 2, top = i === 0 ? 0.55 : 1;
      lu.push(ell([s * cx, y, cz], [((xl - med) / 2) * top, y > 0.83 ? 0.011 : y > 0.8 ? 0.014 : 0.024, f * top], { blend: 0.014 }));
    });
    // the base sits on the dome of the diaphragm
    for (const q of domes) lu.push(ell(q.c, q.r.map((v) => v + 0.0012), { sub: true, blend: 0.004 }));
    // pressed in by the heart (much more on the left: the cardiac notch), the great vessels, the
    // gullet, the windpipe and the spine
    lu.push(ell([-0.012, 0.75, 0.02], [0.021, 0.02, 0.019], { sub: true, blend: 0.004 }));
    lu.push(ellF(H(0.024, 0.002, 0.001), ax, fr, [0.03, 0.025, 0.027], { sub: true, blend: 0.004 }));
    lu.push(ellF(H(0.05, 0.002, 0.004), ax, fr, [0.022, 0.019, 0.02], { sub: true, blend: 0.004 }));
    if (s > 0) lu.push(ellF(H(0.05, 0.012, 0.02), ax, fr, [0.024, 0.014, 0.014], { sub: true, blend: 0.004 })); // (the notch)
    lu.push(tube([[0, 0.86, -0.018], [0, 0.8, -0.016], [0, 0.785, -0.015]], 0.0085, 0.0085, { sub: true, blend: 0.003 }));
    lu.push(tube([[0.002, 0.738, 0.03], [0.004, 0.775, 0.03], [0.008, 0.796, 0.02], [0.014, 0.8, 0.0], [0.013, 0.788, -0.02], [0.011, 0.75, -0.03], [0.009, 0.7, -0.026]], 0.0085, 0.0085, { sub: true, blend: 0.003 }));
    lu.push(tube([[-0.016, 0.83, 0.024], [-0.014, 0.78, 0.026], [-0.01, 0.75, 0.024], [-0.012, 0.73, 0.008], [-0.016, 0.69, -0.004]], 0.008, 0.008, { sub: true, blend: 0.003 }));
    lu.push(tube([[-0.002, 0.86, -0.03], [-0.004, 0.77, -0.033], [-0.003, 0.74, -0.034], [0.003, 0.7, -0.02]], 0.0075, 0.0075, { sub: true, blend: 0.003 }));
    // the spine: the bodies of the chest's vertebrae and the heads of the ribs beside them
    lu.push(tube([[0, 0.87, -0.05], [0, 0.82, -0.064], [0, 0.76, -0.07], [0, 0.7, -0.058], [0, 0.65, -0.04]], 0.024, 0.024, { sub: true, blend: 0.004 }));
    // the hilum: the root where the bronchus and vessels go in (a dip on the inner face)
    lu.push(ell([s * 0.026, 0.764, -0.014], [0.009, 0.014, 0.01], { sub: true, blend: 0.004 }));
    // the fissures between the lobes: thin cuts from the outside in, stopping short of the root
    const fis = (c, n, r) => lu.push(ellF(c, [1, 0, 0], n, r, { sub: true, blend: 0.0012 }));
    const oblN = norm([0, 1, 0.95]); // the oblique fissure: high at the back, low at the front
    fis([s * 0.058, 0.746, -0.016], oblN, [0.034, 0.0016, 0.085]);
    // the right lung's horizontal fissure, from the front back to the oblique one
    if (s < 0) fis([-0.058, 0.752, 0.012], [0, 1, 0], [0.034, 0.0016, 0.032]);
  }

  // ======================= BELLY =======================
  // ---- the liver: under the right dome, its big right lobe filling the right upper belly and its
  // thin left lobe reaching across in front of the stomach ----
  {
    const lv = part('liver', 'chest', 'liver', 0.0009);
    // its top is the underside of the right dome and the middle; below, it narrows with the ribs
    for (const q of [domes[0], domes[2]]) lv.push(ell(q.c, q.r.map((v) => v - T - 0.0012), { blend: 0.008 }));
    lv.push(ell([-0.024, 0.648, 0.004], [0.031, 0.038, 0.038], { blend: 0.012 }));
    // the underside (visceral surface) faces down, back and left; the lower edge is sharp in front
    lv.push(cut([-0.03, 0.618, 0.04], [0.45, -1, -0.5], 0.004));
    lv.push(cut([0.012, 0.66, 0.0], [1, -0.4, 0], 0.006)); // (where the left lobe will carry on)
    lv.push(cut([0, 0.62, -0.03], [0, 0, -1], 0.006)); // the back against the right kidney and spine
    lv.push(tube([[0, 0.73, -0.06], [0, 0.705, -0.053], [0, 0.673, -0.04], [0, 0.656, -0.03], [0, 0.62, -0.016]], 0.0175, 0.0175, { sub: true, blend: 0.003 }));
    // the left lobe, a thin wedge
    lv.push(ell([0.014, 0.674, 0.026], [0.026, 0.009, 0.02], { blend: 0.012 }));
    lv.push(ell([0.036, 0.68, 0.02], [0.012, 0.0045, 0.01], { blend: 0.01 }));
    // the hollows the gallbladder and the right kidney press into it, and the fissure for the
    // round ligament between the lobes
    lv.push(ell([-0.03, 0.612, 0.034], [0.008, 0.012, 0.008], { sub: true, blend: 0.003 }));
    lv.push(ell([-0.034, 0.64, -0.02], [0.014, 0.022, 0.012], { sub: true, blend: 0.005 }));
    lv.push(ellF([0.0, 0.645, 0.044], [0, 1, 0.4], [1, 0, 0], [0.024, 0.0018, 0.008], { sub: true, blend: 0.001 }));
    // gallbladder, and its duct joining the liver's ducts into the common bile duct
    const gb = part('gallbladder', 'chest', 'gall', 0.0005);
    gb.push(sweep([
      { p: [-0.032, 0.604, 0.042], r: [0.0045, 0.0045, 0.0045, 0.0045] },
      { p: [-0.031, 0.611, 0.035], r: [0.0062, 0.0062, 0.0062, 0.0062] },
      { p: [-0.027, 0.621, 0.026], r: [0.0045, 0.0045, 0.0045, 0.0045] },
      { p: [-0.022, 0.628, 0.02], r: [0.0022, 0.0022, 0.0022, 0.0022] },
    ], { steps: 5, blend: 0.002, round: 0.003 }));
    gb.push(tube([[-0.022, 0.628, 0.02], [-0.018, 0.632, 0.018], [-0.016, 0.636, 0.02]], 0.0012));
    gb.push(tube([[-0.012, 0.646, 0.018], [-0.016, 0.632, 0.018], [-0.019, 0.62, 0.02], [-0.022, 0.61, 0.021]], 0.0015));
  }

  // ---- the stomach: a J-shaped bag under the left dome, from the gullet (cardia) round its domed
  // top (fundus) and body down to the narrow exit (pylorus) on the right ----
  const pylorus = [-0.007, 0.628, 0.036];
  {
    const st = part('stomach', 'chest', 'gut', 0.0008);
    st.push(sweep([
      { p: [0.029, 0.69, -0.012], r: [0.004, 0.004, 0.004, 0.004] },
      { p: [0.032, 0.682, -0.008], r: [0.012, 0.013, 0.012, 0.012] },
      { p: [0.037, 0.666, 0.005], r: [0.016, 0.016, 0.015, 0.014] },
      { p: [0.037, 0.648, 0.019], r: [0.015, 0.016, 0.014, 0.013] },
      { p: [0.029, 0.632, 0.031], r: [0.013, 0.013, 0.012, 0.012] },
      { p: [0.012, 0.624, 0.038], r: [0.0105, 0.01, 0.0095, 0.01] },
      { p: [0.001, 0.625, 0.038], r: [0.0075, 0.0075, 0.007, 0.0075] },
      { p: pylorus, r: [0.0052, 0.0052, 0.0052, 0.0052] },
    ], { front: [0, 0, 1], lat: [1, 0, 0], steps: 6, blend: 0.003, round: 0.002 }));
    st.push(tube([[0.014, 0.682, -0.006], cardia, [0.026, 0.672, 0.004]], 0.0052, 0.0062));
    st.push(ell(pylorus, [0.004, 0.0062, 0.0062], { blend: 0.002 })); // (the ring of the pyloric sphincter)
  }

  // ---- the spleen: a fist-sized lump high in the left back, along the 10th rib ----
  part('spleen', 'chest', 'spleen', 0.0006).push(
    ellF([0.045, 0.674, -0.02], [0.25, -0.5, 0.83], [0.85, 0.05, -0.5], [0.02, 0.006, 0.0115], { blend: 0.003 }),
    ell([0.038, 0.67, -0.012], [0.004, 0.008, 0.004], { sub: true, blend: 0.003 }), // (its hilum, where the vessels go in)
  );

  // ---- the duodenum: the C-shaped first part of the small intestine, round the head of the pancreas ----
  const djFlexure = [0.02, 0.612, 0.026];
  part('duodenum', 'spine', 'gut', 0.0007).push(tube([pylorus, [-0.018, 0.632, 0.03], [-0.027, 0.626, 0.024], [-0.03, 0.612, 0.02], [-0.029, 0.598, 0.021], [-0.018, 0.592, 0.026], [0.0, 0.592, 0.029], [0.012, 0.598, 0.029], [0.018, 0.606, 0.027], djFlexure], 0.0052, 0.0055));

  // ---- the pancreas: head in the duodenum's curve, body across the spine, tail to the spleen ----
  part('pancreas', 'spine', 'pancreas', 0.0006).push(sweep([
    { p: [-0.019, 0.606, 0.023], r: [0.006, 0.006, 0.006, 0.006] },
    { p: [-0.016, 0.616, 0.022], r: [0.0075, 0.007, 0.006, 0.007] },
    { p: [-0.002, 0.624, 0.022], r: [0.004, 0.005, 0.004, 0.005] },
    { p: [0.018, 0.634, 0.012], r: [0.004, 0.0055, 0.0035, 0.0055] },
    { p: [0.034, 0.645, 0.0], r: [0.0035, 0.0045, 0.003, 0.0045] },
    { p: [0.043, 0.656, -0.012], r: [0.002, 0.0025, 0.002, 0.0025] },
  ], { front: [0, 0, 1], lat: [0, 1, 0], steps: 6, blend: 0.002, round: 0.002, ridges: [{ a: 0, w: 0.5 }, { a: Math.PI, w: 0.5 }] }));

  // ---- the kidneys and their adrenal glands: high on the back wall either side of the spine, the
  // right one lower (the liver sits above it); the hilum faces in and forward ----
  const hilum = {};
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'left' : 'right';
    const c = [s * 0.037, s > 0 ? 0.633 : 0.624, -0.013];
    const up = [-s * 0.25, 1, -0.12], out = [1 * s, 0.1 * s, -0.5];
    const kd = part(side + 'Kidney', 'spine', 'kidney', 0.0006);
    kd.push(ellF(c, up, out, [0.026, 0.0145, 0.0095], { blend: 0.003 }));
    const h = add(c, [-s * 0.013, 0, 0.004]);
    kd.push(ell(h, [0.006, 0.009, 0.006], { sub: true, blend: 0.003 }));
    hilum[s] = add(c, [-s * 0.012, 0, 0.003]);
    // the renal pelvis (the funnel collecting the urine) and the ureter down to the bladder
    const ur = part(side + 'Ureter', 'spine', 'bladder', 0.0005);
    ur.push(sweep([
      { p: add(c, [-s * 0.005, 0.004, 0.0]), r: [0.004, 0.004, 0.004, 0.004] },
      { p: add(c, [-s * 0.013, -0.003, 0.004]), r: [0.003, 0.003, 0.003, 0.003] },
      { p: add(c, [-s * 0.016, -0.012, 0.007]), r: [0.0013, 0.0013, 0.0013, 0.0013] },
    ], { steps: 4, blend: 0.002 }));
    ur.push(tube([add(c, [-s * 0.016, -0.012, 0.007]), [s * 0.021, 0.58, 0.016], [s * 0.025, 0.55, 0.012], [s * 0.028, 0.522, 0.0], [s * 0.028, 0.498, -0.012], [s * 0.022, 0.478, -0.006], [s * 0.011, 0.466, 0.006]], 0.0012, 0.0011));
    // adrenal gland: a cap on the upper pole (a pyramid on the right, a crescent on the left)
    const ad = part(side + 'Adrenal', 'spine', 'adrenal', 0.0005);
    const top = add(c, mul(norm(up), 0.024));
    ad.push(ellF(add(top, [-s * 0.004, 0.003, 0.002]), [0, 1, 0], [1, 0, 0], s > 0 ? [0.006, 0.0035, 0.0022] : [0.0055, 0.004, 0.0025], { blend: 0.002 }));
    ad.push(ellF(add(top, [-s * 0.008, -0.004, 0.003]), [s * 0.3, -1, 0.2], [1, 0, 0], [0.006, 0.0025, 0.002], { blend: 0.002 }));
  }

  // ---- the small intestine (jejunum then ileum): a long tube folded into a tangle of loops in the
  // middle of the belly, in front of the duodenum and inside the frame of the large intestine, from
  // the duodenum's end down to the start of the large intestine low on the right. The folding is a
  // path through a grid of places, each visited once, picked the same way every time ----
  const colonPath = [
    [-0.043, 0.513, 0.03], [-0.047, 0.535, 0.026], [-0.05, 0.57, 0.02], [-0.05, 0.598, 0.02], [-0.043, 0.607, 0.034],
    [-0.025, 0.607, 0.047], [-0.002, 0.596, 0.05], [0.022, 0.606, 0.047], [0.04, 0.622, 0.032], [0.048, 0.632, 0.01],
    [0.051, 0.618, -0.001], [0.052, 0.585, 0.0], [0.05, 0.555, 0.004], [0.044, 0.53, 0.012], [0.032, 0.514, 0.022],
    [0.012, 0.505, 0.022], [-0.004, 0.502, 0.006], [-0.002, 0.494, -0.014],
  ];
  const ileumEnd = [-0.036, 0.52, 0.026];
  {
    const obst = [...spline(colonPath, 4).map((p) => [p, 0.0095]), [[0, 0.471, 0.018], 0.016], [[0, 0.59, 0.028], 0.007], [[0.006, 0.6, 0.012], 0.005]];
    const NX = 8, NY = 7, NZ = 3, cells = [];
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) for (let l = 0; l < NZ; l++) {
      const y = 0.578 - j * 0.0105, w = y < 0.53 ? 0.03 : 0.036;
      const c = [-w + (2 * w * i) / (NX - 1), y, 0.016 + l * 0.0145];
      const ok = obst.every(([q, r]) => len(sub(q, c)) > r + 0.0062) && c[2] < 0.052 - (y > 0.57 ? 0.004 : 0);
      cells.push(ok ? { c, i, j, l, n: [] } : null);
    }
    const id = (i, j, l) => (i < 0 || j < 0 || l < 0 || i >= NX || j >= NY || l >= NZ ? null : cells[(i * NY + j) * NZ + l]);
    const live = cells.filter(Boolean);
    for (const q of live) for (const [a, b, c] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const o = id(q.i + a, q.j + b, q.l + c); if (o) q.n.push(o); }
    // a seeded walk that always steps to the neighbour with fewest ways on (so it seldom traps itself)
    let best = null;
    for (let seed = 1; seed < 400 && !(best && best.full); seed++) {
      let r = seed * 9301 + 49297;
      const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
      const seen = new Set(), path = [];
      let cur = live.reduce((a, q) => (len(sub(q.c, djFlexure)) < len(sub(a.c, djFlexure)) ? q : a));
      while (cur) {
        seen.add(cur); path.push(cur);
        const nx = cur.n.filter((q) => !seen.has(q));
        if (!nx.length) break;
        nx.sort((a, b) => a.n.filter((q) => !seen.has(q)).length - b.n.filter((q) => !seen.has(q)).length + (rnd() - 0.5) * 0.9);
        cur = nx[0];
      }
      const endD = len(sub(path[path.length - 1].c, ileumEnd));
      const score = path.length / live.length - endD * 4;
      if (!best || score > best.score) best = { path, score, full: path.length >= live.length * 0.9 && endD < 0.03 };
    }
    let r2 = 7;
    const jit = () => ((r2 = (r2 * 9301 + 49297) % 233280) / 233280 - 0.5) * 0.004;
    const pts = [djFlexure, ...best.path.map((q) => [q.c[0] + jit(), q.c[1] + jit(), q.c[2] + jit()]), ileumEnd, [-0.04, 0.518, 0.028]];
    part('smallIntestine', 'spine', 'gut', 0.0008).push(tube(spline(pts, 3), 0.0052, 0.0046, { steps: 2 }));
  }

  // ---- the large intestine: the cecum low on the right (with the appendix), up the right flank,
  // across under the liver and stomach (transverse colon), down the left flank, the S-bend in the
  // pelvis (sigmoid), and the rectum in front of the sacrum ----
  {
    const co = part('colon', 'spine', 'colon', 0.0008);
    const path = colonPath;
    co.push(pouched(path, (t) => (t < 0.08 ? 0.0095 : 0.0085 - t * 0.0025), 0.009));
    co.push(ell([-0.043, 0.515, 0.03], [0.0095, 0.009, 0.0095], { blend: 0.003 })); // the cecum's blind end
    // the three bands of lengthwise muscle (taeniae) on the colon's surface
    const tn = part('colonBands', 'spine', 'tendon', 0.0005);
    const cp = spline(path, 6);
    for (const [ao, f] of [[0, 1], [2.1, 1], [-2.1, 1]]) {
      const pts = cp.map((p, i) => {
        const t = norm(sub(cp[Math.min(cp.length - 1, i + 1)], cp[Math.max(0, i - 1)]));
        const u = norm(sub([0, 0, 1], mul(t, dot(t, [0, 0, 1])))), w = cross(t, u);
        const r = 0.0083 - (i / cp.length) * 0.0024;
        return add(p, add(mul(u, Math.cos(ao) * r * f), mul(w, Math.sin(ao) * r * f)));
      });
      tn.push(tube(pts, 0.0008, 0.0006, { steps: 2 }));
    }
    // the appendix, a thin worm from the cecum's base
    co.push(tube([[-0.038, 0.512, 0.024], [-0.032, 0.505, 0.018], [-0.026, 0.506, 0.01], [-0.024, 0.514, 0.004]], 0.0018, 0.0014));
    // the rectum and anal canal
    part('rectum', 'hips', 'colon', 0.0007).push(tube([[-0.002, 0.494, -0.014], [0, 0.48, -0.026], [0, 0.462, -0.027], [0, 0.448, -0.02], [0, 0.436, -0.014]], (t) => 0.0078 - 0.0035 * t * t));
  }

  // ---- the bladder, low in front of the pelvis behind the pubic bones ----
  part('bladder', 'hips', 'bladder', 0.0006).push(
    ell([0, 0.471, 0.018], [0.015, 0.012, 0.013], { blend: 0.003 }),
    ell([0, 0.46, 0.012], [0.006, 0.006, 0.006], { blend: 0.004 }), // (its neck, toward the urethra)
  );

  // ---- the vessels of the belly's organs, from the aorta and back to the venae cavae ----
  {
    const ar = part('organArteries', 'spine', 'artery', 0.0005), vn = part('organVeins', 'spine', 'vein', 0.0005);
    // the celiac trunk, splitting into the arteries of the stomach, liver and spleen
    const ce = [0.008, 0.652, 0.002];
    ar.push(tube([[0.008, 0.645, -0.006], ce, [0.008, 0.654, 0.01]], 0.0024, 0.002));
    ar.push(tube([[0.008, 0.654, 0.01], [0.022, 0.648, 0.008], [0.034, 0.652, -0.004], [0.043, 0.663, -0.016]], 0.0016, 0.0013)); // splenic
    ar.push(tube([[0.008, 0.654, 0.01], [-0.006, 0.648, 0.016], [-0.012, 0.646, 0.02], [-0.014, 0.65, 0.022]], 0.0016, 0.0013)); // common hepatic
    ar.push(tube([[0.008, 0.654, 0.01], [0.014, 0.662, 0.008], [0.02, 0.668, 0.006]], 0.0011, 0.0009)); // left gastric
    // the superior mesenteric artery: behind the pancreas, in front of the duodenum, into the
    // fan (mesentery) of the small intestine
    ar.push(tube([[0.007, 0.64, -0.004], [0.007, 0.628, 0.006], [0.006, 0.612, 0.016], [0.004, 0.598, 0.03], [0.0, 0.58, 0.036], [-0.008, 0.56, 0.034]], 0.0022, 0.0013));
    for (const s of [-1, 1]) {
      // renal arteries straight out to each kidney (the right one behind the vena cava)
      ar.push(tube([[0.007, 0.632, -0.001], [s * 0.016, 0.63 - (s < 0 ? 0.004 : 0), -0.006], hilum[s]], 0.002, 0.0017));
      // renal veins: the left one in front of the aorta to the vena cava
      vn.push(tube(s > 0 ? [hilum[s], [0.016, 0.632, 0.0], [0.006, 0.632, 0.006], [-0.008, 0.63, 0.012], [-0.015, 0.628, 0.012]] : [hilum[s], [-0.02, 0.622, 0.004], [-0.015, 0.624, 0.01]], 0.0021, 0.0024));
    }
    // the portal vein: from behind the pancreas's neck up to the liver, gathering the splenic vein
    // (along the back of the pancreas) and the superior mesenteric vein
    vn.push(tube([[-0.002, 0.616, 0.017], [-0.008, 0.628, 0.016], [-0.014, 0.642, 0.016], [-0.018, 0.652, 0.012]], 0.0028, 0.0026));
    vn.push(tube([[0.043, 0.658, -0.014], [0.032, 0.644, -0.004], [0.016, 0.632, 0.007], [0.0, 0.622, 0.014], [-0.002, 0.616, 0.017]], 0.0016, 0.002));
    vn.push(tube([[-0.012, 0.56, 0.034], [-0.004, 0.58, 0.036], [-0.0, 0.598, 0.03], [-0.002, 0.616, 0.017]], 0.0014, 0.0022));
  }

  // scale to the body like the bones
  const P3 = (p) => mul(p, k);
  for (const p of parts) {
    p.cell *= k;
    p.shapes = p.shapes.map((q) => mapShape(q, P3, null, k));
  }
  return parts;
}
