// The soft parts of the arm's joints that tie one bone to the next: the ligaments (tough white
// bands), the joint capsules (a thin sleeve round each joint, shown see-through), and the
// interosseous membrane between the two forearm bones. Each end is given on the bone it is fixed
// to (rest, drawing units, body's left side; s = -1 mirrors it) and carried into the pose, so a
// band crossing a joint stretches and turns with it. Plain numbers and arrays only (no three.js).
import { sweep } from './sdf.js';
import { poseRig } from './muscles.js';
import { boneField } from './boneField.js';

const mv = (A, v) => [A[0] * v[0] + A[1] * v[1] + A[2] * v[2], A[3] * v[0] + A[4] * v[1] + A[5] * v[2], A[6] * v[0] + A[7] * v[1] + A[8] * v[2]];
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

export function goblinArmJoints(S, { posed = true } = {}) {
  const { J, at, k } = poseRig(S, posed);
  const B = boneField(S, J); // (a ligament lies on the bones it ties, never inside them)
  const parts = [];
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'left' : 'right';
    const X = (x, y, z) => [s * x, y, z];
    const sh = side + 'Shoulder', ua = side + 'UpperArm', la = side + 'LowerArm';
    const P = (jn, x, y, z) => at(jn, X(x, y, z));
    const D = (jn, v) => mv(J[jn].R, [s * v[0], v[1], v[2]]);
    const lig = { name: side + 'ArmLigaments', joint: null, mat: 'tendon', cell: 0.0005 * k / 0.864, shapes: [] };
    const cap = { name: side + 'ArmCapsules', joint: null, mat: 'capsule', cell: 0.0007 * k / 0.864, shapes: [] };
    const mem = { name: side + 'Interosseous', joint: null, mat: 'tendon', cell: 0.00045 * k / 0.864, shapes: [] };
    parts.push(lig, cap, mem);
    // a flat band through posed points pts, w wide (from w0 to w1), t thick, its flat side facing nrm
    const band = (out, pts, w0, w1, t, nrm, o = {}) => {
      const n = pts.length - 1;
      out.push(sweep(pts.map((p, i) => { const w = (w0 + (w1 - w0) * i / n) * k / 2; return { p: B.push(p, t * k * 1.1), r: [t * k, w, t * k, w] }; }), { front: nrm, lat: [0, 1, 0], steps: 6, round: Math.min(w0, w1) * k * 0.35, blend: 0.001 * k, ...o }));
    };
    // ---------------- shoulder ----------------
    // coracoacromial ligament: the roof over the joint, from the coracoid's side to the acromion's tip
    band(lig.shapes, [P(sh, 0.0915, 0.8255, -0.006), P(sh, 0.1, 0.8305, -0.009), P(sh, 0.1072, 0.8335, -0.0115)], 0.0075, 0.0045, 0.0006, D(sh, [0, 1, 0]));
    // coracohumeral ligament: from the coracoid's root over the top of the ball to the tubercles
    band(lig.shapes, [P(sh, 0.0868, 0.8268, -0.0145), P(ua, 0.106, 0.8235, -0.0105), P(ua, 0.1225, 0.8165, -0.0085)], 0.0055, 0.0065, 0.0006, D(sh, [0, 1, 0.2]));
    // the three glenohumeral ligaments, thick bands in the front of the capsule
    for (const [y0, y1, z1, w] of [[0.8115, 0.8045, -0.0045, 0.0028], [0.8035, 0.7965, -0.0045, 0.0034], [0.7945, 0.7865, -0.0115, 0.0042]]) {
      band(lig.shapes, [P(sh, 0.0968, y0, -0.0125), P(ua, 0.104, (y0 + y1) / 2, -0.0045), P(ua, 0.1125, y1, z1)], w, w * 1.15, 0.0006, D(ua, [0, 0, 1]));
    }
    // transverse humeral ligament: a strap over the bicipital groove that holds the biceps' tendon in
    band(lig.shapes, [P(ua, 0.1168, 0.8045, -0.0032), P(ua, 0.1208, 0.8045, -0.0012), P(ua, 0.1248, 0.8045, -0.0038)], 0.003, 0.003, 0.0005, D(ua, [0, 0, 1]));
    // acromioclavicular ligament over the joint between collarbone and acromion
    band(lig.shapes, [P(sh, 0.0985, 0.8392, -0.0035), P(sh, 0.1035, 0.8398, -0.0075), P(sh, 0.1075, 0.8388, -0.011)], 0.0055, 0.0055, 0.0006, D(sh, [0, 1, 0]));
    // coracoclavicular ligaments: trapezoid (outer, flat) and conoid (inner, a cone), hanging the
    // shoulder blade from the collarbone
    band(lig.shapes, [P(sh, 0.0905, 0.8268, -0.005), P(sh, 0.0925, 0.8298, 0.0005), P(sh, 0.0945, 0.8322, 0.0045)], 0.0055, 0.0065, 0.0007, D(sh, [1, 0, -0.4]));
    band(lig.shapes, [P(sh, 0.0852, 0.829, -0.019), P(sh, 0.0862, 0.8302, -0.002), P(sh, 0.0872, 0.8305, 0.0135)], 0.0028, 0.0058, 0.0008, D(sh, [1, 0, 0]));
    // the capsule: a loose sleeve from the socket's rim to the neck of the ball
    {
      const g = P(sh, 0.0948, 0.8028, -0.0225), c = at(ua, X(0.111, 0.806, -0.018)), o = P(ua, 0.1215, 0.799, -0.0135);
      cap.shapes.push(sweep([
        { p: g, r: [0.0098, 0.0122, 0.0098, 0.0122].map((v) => v * k) },
        { p: lerp(g, c, 0.55), r: [0.0148, 0.0158, 0.0148, 0.0172].map((v) => v * k) },
        { p: lerp(c, o, 0.45), r: [0.0145, 0.0158, 0.014, 0.0175].map((v) => v * k) },
        { p: o, r: [0.0118, 0.0128, 0.0118, 0.0138].map((v) => v * k) },
      ], { front: D(ua, [0, 0, 1]), lat: D(ua, [0, 1, 0]), steps: 6, round: 0.004 * k, blend: 0.002 * k }));
    }
    // ---------------- elbow ----------------
    // inner (ulnar) collateral ligament: a front band to the beak, a fan to the hook, and a
    // crossing band between them
    band(lig.shapes, [P(ua, 0.1008, 0.6158, -0.0155), P(la, 0.1045, 0.6075, -0.0118), P(la, 0.1085, 0.6005, -0.0092)], 0.0038, 0.0042, 0.0008, D(ua, [-1, 0, 0]));
    band(lig.shapes, [P(ua, 0.1015, 0.6165, -0.0218), P(la, 0.1035, 0.6125, -0.0262), P(la, 0.1078, 0.6118, -0.0305)], 0.004, 0.0062, 0.0007, D(ua, [-1, 0, 0]));
    band(lig.shapes, [P(la, 0.1078, 0.6015, -0.0105), P(la, 0.1062, 0.6025, -0.02), P(la, 0.1075, 0.6085, -0.0292)], 0.0022, 0.0022, 0.0006, D(la, [-1, 0, 0]));
    // outer (radial) collateral ligament: from the outer knob fanning into the ring round the radius
    band(lig.shapes, [P(ua, 0.1392, 0.6175, -0.0162), P(la, 0.1395, 0.6085, -0.0142), P(la, 0.1385, 0.6005, -0.0138)], 0.0035, 0.0062, 0.0007, D(la, [1, 0, 0]));
    // annular ligament: the ring that holds the radius's head against the ulna while it turns
    {
      const rc = [0.1298, 0.5995, -0.0138], pts = [];
      for (let i = 0; i <= 14; i++) {
        const a = (-140 + (280 * i) / 14) * Math.PI / 180;
        pts.push(P(la, rc[0] + Math.cos(a) * 0.0084, rc[1] + 0.0004 * Math.cos(a), rc[2] + Math.sin(a) * 0.0084));
      }
      lig.shapes.push(sweep(pts.map((p) => ({ p: B.push(p, 0.0008 * k), r: [0.0032 * k, 0.0008 * k, 0.0032 * k, 0.0006 * k] })), { front: D(la, [0, 1, 0]), lat: D(la, [1, 0, 0]), steps: 3, round: 0.0006 * k, blend: 0.001 * k }));
    }
    // the elbow's capsule: from just above the hollows of the humerus to the radius's neck and
    // the ulna below its notch
    {
      const top = P(ua, 0.119, 0.6335, -0.0165), mid = at(ua, X(0.1195, 0.612, -0.0142)), bot = P(la, 0.1225, 0.5935, -0.0155);
      cap.shapes.push(sweep([
        { p: top, r: [0.0078, 0.0128, 0.0085, 0.0128].map((v) => v * k) },
        { p: mid, r: [0.0108, 0.0158, 0.0122, 0.0158].map((v) => v * k) },
        { p: bot, r: [0.0098, 0.0128, 0.0092, 0.0118].map((v) => v * k) },
      ], { front: D(la, [0, 0, 1]), lat: D(la, [1, 0, 0]), steps: 8, round: 0.003 * k, blend: 0.002 * k }));
    }
    // ---------------- forearm ----------------
    // the interosseous membrane: a thin sheet tying the radius's sharp edge to the ulna's, its
    // fibres running down and in from the radius to the ulna
    {
      const rC = [[0.575, 0.1306, -0.0118, -2.75], [0.55, 0.1316, -0.0088, -2.8], [0.52, 0.1318, -0.0052, -2.85], [0.495, 0.1302, -0.0015, -2.95], [0.475, 0.127, 0.0015, -3.05], [0.462, 0.1238, 0.0034, -3.1]];
      const uC = [[0.585, 0.1168, -0.0205, 1.3], [0.565, 0.1172, -0.0208, 1.28], [0.535, 0.1177, -0.0204, 1.22], [0.5, 0.1185, -0.0194, 1.12], [0.47, 0.1193, -0.0177, 1.0], [0.456, 0.1198, -0.0158, 1.0]];
      const edge = (c, r) => [c[1] + Math.sin(c[3]) * r, c[0], c[2] + Math.cos(c[3]) * r];
      const R = rC.map((c) => edge(c, 0.0048)), U = uC.map((c) => edge(c, 0.0048));
      // the sheet (slice by slice from the radius's edge to the ulna's)
      mem.shapes.push(sweep(R.map((r, i) => {
        const u = U[i], m = lerp(r, u, 0.5), d = [s * (u[0] - r[0]), u[1] - r[1], u[2] - r[2]], h = Math.hypot(...d) / 2;
        return { p: B.push(at(la, X(...m)), 0.0004 * k), r: [0.00028 * k, h * k, 0.00028 * k, h * k], lat: mv(J[la].R, d.map((v) => v / (2 * h))) };
      }), { front: D(la, [0, 0, 1]), lat: D(la, [1, 0, 0]), steps: 5, blend: 0.0006 * k }));
      // its fibre bundles, slanting down from the radius to the ulna
      for (let i = 0; i < 5; i++) band(mem.shapes, [P(la, ...R[i]), P(la, ...lerp(R[i], U[i + 1], 0.5)), P(la, ...U[i + 1])], 0.0016, 0.0016, 0.00045, D(la, [0.6, 0, 0.8]), { blend: 0.0008 * k });
      // (the oblique cord, a little band the other way near the elbow)
      band(mem.shapes, [P(la, 0.1185, 0.5935, -0.0168), P(la, 0.1245, 0.585, -0.0148), P(la, 0.1285, 0.5795, -0.0145)], 0.0015, 0.0015, 0.0005, D(la, [0.6, 0, 0.8]), { blend: 0.0008 * k });
    }
  }
  return parts;
}

// The soft parts of the hip, knee, ankle and foot joints (same rules as the arm's: each end on the
// bone it is fixed to, carried into the pose, laid on the bones and never through them).
export function goblinLegJoints(S, { posed = true } = {}) {
  const { J, at, k } = poseRig(S, posed);
  const B = boneField(S, J);
  const parts = [];
  const nrm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
  const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'left' : 'right';
    const X = (x, y, z) => [s * x, y, z];
    const ul = side + 'UpperLeg', ll = side + 'LowerLeg', ft = side + 'Foot', hp = 'hips';
    const P = (jn, x, y, z) => at(jn, X(x, y, z));
    const D = (jn, v) => mv(J[jn].R, [s * v[0], v[1], v[2]]);
    const lig = { name: side + 'LegLigaments', joint: null, mat: 'tendon', cell: 0.0005 * k / 0.864, shapes: [] };
    const cap = { name: side + 'LegCapsules', joint: null, mat: 'capsule', cell: 0.0007 * k / 0.864, shapes: [] };
    const men = { name: side + 'Menisci', joint: null, mat: 'cartilage', cell: 0.0004 * k / 0.864, shapes: [] };
    const mem = { name: side + 'LegInterosseous', joint: null, mat: 'tendon', cell: 0.00045 * k / 0.864, shapes: [] };
    parts.push(lig, cap, men, mem);
    const band = (out, pts, w0, w1, t, nrmV, o = {}) => {
      const n = pts.length - 1;
      out.push(sweep(pts.map((p, i) => { const w = (w0 + (w1 - w0) * i / n) * k / 2; return { p: o.free ? p : B.push(p, t * k * 1.1), r: [t * k, w, t * k, w] }; }), { front: nrmV, lat: [0, 1, 0], steps: 6, round: Math.min(w0, w1) * k * 0.35, blend: 0.001 * k, ...o }));
    };
    // ---------------- hip ----------------
    const A = [0.064, 0.48, 0.012], n = nrm([1, -0.62, 0.45]);
    // the labrum: a ring of gristle on the socket's rim that deepens it, broken below at the notch
    {
      const c = A.map((v, i) => v + n[i] * 0.0075), u = nrm(crs(n, [0, 0, 1])), v = crs(n, u), pts = [];
      for (let i = 0; i <= 20; i++) {
        const a = (-130 + (260 * i) / 20) * Math.PI / 180; // (the gap faces down, toward the notch)
        const dir = u.map((x, j) => Math.cos(a) * -x + Math.sin(a) * v[j]);
        pts.push(P(hp, ...c.map((x, j) => x + dir[j] * 0.0138)));
      }
      men.shapes.push(sweep(pts.map((p) => ({ p, r: [0.0022 * k, 0.0014 * k, 0.0022 * k, 0.0012 * k] })), { front: D(hp, n), lat: D(hp, [0, 1, 0]), steps: 3, round: 0.001 * k, blend: 0.0008 * k }));
    }
    // the capsule: a strong sleeve from the socket's rim to the base of the neck
    cap.shapes.push(sweep([
      { p: P(hp, ...A.map((v, i) => v + n[i] * 0.004)), r: [0.0172, 0.0168, 0.0172, 0.0168].map((v) => v * k) },
      { p: P(ul, 0.0765, 0.4735, 0.0075), r: [0.0148, 0.0158, 0.0152, 0.0158].map((v) => v * k) },
      { p: P(ul, 0.0855, 0.4665, 0.0035), r: [0.0118, 0.0142, 0.0128, 0.0142].map((v) => v * k) },
    ], { front: D(ul, [0, 0, 1]), lat: D(ul, [0, 1, 0]), steps: 6, round: 0.004 * k, blend: 0.002 * k }));
    // iliofemoral ligament (the Y ligament, the strongest in the body): from below the front point
    // of the hip (AIIS) in two limbs to the line between the trochanters
    band(lig.shapes, [P(hp, 0.0725, 0.5135, 0.0258), P(ul, 0.0825, 0.4905, 0.0205), P(ul, 0.0912, 0.4755, 0.0085)], 0.0085, 0.0058, 0.0012, D(ul, [0.3, 0, 1]));
    band(lig.shapes, [P(hp, 0.0705, 0.5115, 0.0262), P(ul, 0.0752, 0.4765, 0.0255), P(ul, 0.0828, 0.4525, 0.0088)], 0.0085, 0.0058, 0.0012, D(ul, [0, 0, 1]));
    // pubofemoral, from the pubis's upper ramus round under the neck
    band(lig.shapes, [P(hp, 0.0482, 0.4865, 0.0318), P(ul, 0.0635, 0.4632, 0.0225), P(ul, 0.0778, 0.4538, 0.0078)], 0.0062, 0.0052, 0.0011, D(ul, [0, -0.4, 1]));
    // ischiofemoral, from the ischium behind the socket spiralling up over the back of the neck
    band(lig.shapes, [P(hp, 0.0575, 0.4625, -0.0105), P(ul, 0.0752, 0.4705, -0.0105), P(ul, 0.0878, 0.4795, -0.0075)], 0.0068, 0.0052, 0.0011, D(ul, [0, 0.3, -1]));
    // ---------------- knee ----------------
    const kx = 0.054, ky = 0.252, ty = 0.2515;
    // the menisci: two crescent wedges of gristle on the tibia's plateau, thick at the rim and thin
    // toward the middle; the inner one a wide C, the outer one nearly an O
    const meniscus = (cx, cz, rx, rz, a0, a1) => {
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const a = (a0 + ((a1 - a0) * i) / 16) * Math.PI / 180;
        const out = [Math.cos(a), 0, Math.sin(a)], q = [cx + out[0] * rx, ty + 0.0002, cz + out[2] * rz];
        const end = Math.min(1, i / 2.5, (16 - i) / 2.5);
        pts.push({ p: P(ll, ...q), r: [0.0019 * k * (0.5 + 0.5 * end), 0.0015 * k, 0.0006 * k, 0.0038 * k * (0.6 + 0.4 * end)], lat: D(ll, out) });
      }
      men.shapes.push(sweep(pts, { front: D(ll, [0, 1, 0]), lat: D(ll, [1, 0, 0]), steps: 3, round: 0.001 * k, blend: 0.0008 * k }));
    };
    meniscus(kx - 0.0118, -0.003, 0.0092, 0.0118, 35, 325);
    meniscus(kx + 0.0118, -0.004, 0.0082, 0.0098, -150, 150);
    // the cruciate ligaments, crossing in the notch between the condyles: the anterior from the
    // front of the tibia's spikes up and back to the inner wall of the outer condyle; the posterior
    // from the back of the tibia up and forward to the inner wall of the inner condyle
    band(lig.shapes, [P(ll, kx - 0.0028, ty - 0.0012, 0.0042), P(ll, kx + 0.0005, ty + 0.0065, -0.0035), P(ul, kx + 0.0045, ky + 0.0128, -0.0128)], 0.0052, 0.0045, 0.0024, D(ll, [1, 0, 0]), { free: true });
    band(lig.shapes, [P(ll, kx - 0.0002, ty - 0.0055, -0.0168), P(ll, kx - 0.0015, ty + 0.0055, -0.0115), P(ul, kx - 0.0048, ky + 0.0128, -0.0012)], 0.0058, 0.0052, 0.0026, D(ll, [1, 0, 0]), { free: true });
    // the inner (medial) collateral: a broad flat band from the inner epicondyle to the tibia well
    // below the joint (fused to the inner meniscus on the way)
    band(lig.shapes, [P(ul, kx - 0.0228, ky + 0.0168, -0.0035), P(ul, kx - 0.0232, ky + 0.0018, -0.0025), P(ll, kx - 0.0228, ty - 0.0168, -0.0015), P(ll, kx - 0.0112, ty - 0.0445, 0.0035)], 0.0072, 0.0062, 0.0009, D(ll, [-1, 0, 0]));
    // the outer (lateral) collateral: a round cord from the outer epicondyle to the fibula's head,
    // standing clear of the meniscus
    band(lig.shapes, [P(ul, kx + 0.0225, ky + 0.0168, -0.0035), P(ll, kx + 0.0262, ty - 0.0048, -0.0085), P(ll, kx + 0.0275, ty - 0.0148, -0.0122)], 0.0032, 0.0028, 0.0014, D(ll, [1, 0, 0]));
    // the patellar ligament, from the knee cap's point to the tibial tuberosity
    band(lig.shapes, [P(ul, kx + 0.0007, ky + 0.0058, 0.0222), P(ll, kx + 0.001, ty - 0.0125, 0.0188), P(ll, kx + 0.001, ty - 0.0278, 0.0128)], 0.0098, 0.0072, 0.0016, D(ll, [0, 0, 1]));
    // the knee's capsule, a loose sleeve from above the condyles to below the plateau
    cap.shapes.push(sweep([
      { p: P(ul, kx + 0.0005, ky + 0.032, -0.002), r: [0.0118, 0.0162, 0.0108, 0.0172].map((v) => v * k) },
      { p: P(ul, kx, ky + 0.0105, -0.0035), r: [0.0172, 0.0248, 0.0185, 0.0258].map((v) => v * k) },
      { p: P(ll, kx, ty - 0.0065, -0.0035), r: [0.0175, 0.0252, 0.0172, 0.0258].map((v) => v * k) },
      { p: P(ll, kx, ty - 0.017, -0.0025), r: [0.0122, 0.0148, 0.0118, 0.0152].map((v) => v * k) },
    ], { front: D(ll, [0, 0, 1]), lat: D(ll, [1, 0, 0]), steps: 8, round: 0.003 * k, blend: 0.002 * k }));
    // ---------------- shin ----------------
    // the interosseous membrane between the tibia's and the fibula's edges, fibres down and out
    {
      const ys = [0.218, 0.19, 0.16, 0.13, 0.1, 0.075];
      const tE = (y) => { const t = (ty - 0.012 - y) / (ty - 0.012 - 0.071); return [kx + 0.0005 + (0.0485 - kx) * t + 0.0068, y, -0.0025 + 0.002 * t]; };
      const fE = (y) => { const t = (0.234 - y) / (0.234 - 0.061); return [0.0786 - 0.0108 * t - 0.0035, y, -0.0105 + 0.0035 * t]; };
      mem.shapes.push(sweep(ys.map((y) => {
        const a = tE(y), b = fE(y), m = a.map((v, i) => (v + b[i]) / 2), d = [s * (b[0] - a[0]), b[1] - a[1], b[2] - a[2]], h = Math.hypot(...d) / 2;
        return { p: B.push(at(ll, X(...m)), 0.0004 * k), r: [0.0006 * k, h * k, 0.0006 * k, h * k], lat: mv(J[ll].R, d.map((v) => v / (2 * h))) };
      }), { front: D(ll, [0, 0, 1]), lat: D(ll, [1, 0, 0]), steps: 5, blend: 0.0006 * k }));
    }
    // the ligaments tying the fibula to the tibia at the ankle, front and back
    band(lig.shapes, [P(ll, 0.0585, 0.0625, 0.0072), P(ll, 0.0638, 0.0575, 0.0042), P(ll, 0.0678, 0.0525, -0.0005)], 0.0058, 0.0052, 0.001, D(ll, [0.3, 0, 1]));
    band(lig.shapes, [P(ll, 0.0548, 0.0618, -0.0125), P(ll, 0.0618, 0.0568, -0.0142), P(ll, 0.0672, 0.0515, -0.0128)], 0.0058, 0.0052, 0.001, D(ll, [0.3, 0, -1]));
    // ---------------- ankle ----------------
    const ax = 0.05, ay = 0.047;
    // the deltoid ligament: a strong fan from the inner ankle knob to the navicular, the heel
    // bone's shelf and the talus
    for (const [q, w] of [[[0.0328, 0.0228, 0.0362], 0.0052], [[0.0362, 0.0262, 0.0175], 0.0058], [[0.0402, 0.0245, -0.0005], 0.0062], [[0.0425, 0.0322, -0.0108], 0.0058]]) {
      band(lig.shapes, [P(ll, ax - 0.0152, ay - 0.0045, 0.0005), P(ft, (ax - 0.0152 + q[0]) / 2 - 0.0028, (ay - 0.0045 + q[1]) / 2, (0.0005 + q[2]) / 2), P(ft, ...q)], 0.0068, w, 0.001, D(ft, [-1, 0, 0]));
    }
    // the outer ankle's three: anterior talofibular (the one most often sprained), calcaneofibular,
    // posterior talofibular
    band(lig.shapes, [P(ll, ax + 0.0185, ay - 0.0048, -0.0012), P(ft, ax + 0.0142, ay - 0.0102, 0.0052), P(ft, ax + 0.0092, ay - 0.0128, 0.0105)], 0.0055, 0.0052, 0.001, D(ft, [0.6, 0, 1]));
    band(lig.shapes, [P(ll, ax + 0.0205, ay - 0.0138, -0.0078), P(ft, ax + 0.0198, ay - 0.0205, -0.0118), P(ft, ax + 0.0172, 0.0198, -0.0168)], 0.0042, 0.0042, 0.0013, D(ft, [1, 0, 0]));
    band(lig.shapes, [P(ll, ax + 0.0158, ay - 0.0062, -0.0128), P(ft, ax + 0.0095, ay - 0.0112, -0.0155), P(ft, ax + 0.0035, ay - 0.0142, -0.0172)], 0.0052, 0.0045, 0.0011, D(ft, [0.2, 0, -1]));
    // the ankle's capsule, thin in front and behind
    cap.shapes.push(sweep([
      { p: P(ll, ax, ay + 0.0062, -0.0008), r: [0.0118, 0.0158, 0.0102, 0.0158].map((v) => v * k) },
      { p: P(ft, ax, ay - 0.0068, 0.0005), r: [0.0175, 0.0158, 0.0152, 0.0158].map((v) => v * k) },
      { p: P(ft, ax - 0.001, ay - 0.0138, 0.003), r: [0.0168, 0.0132, 0.0138, 0.0132].map((v) => v * k) },
    ], { front: D(ft, [0, 0, 1]), lat: D(ft, [1, 0, 0]), steps: 6, round: 0.003 * k, blend: 0.002 * k }));
    // ---------------- foot ----------------
    // the spring ligament under the talus's head (it holds up the arch), the long plantar
    // ligament under the heel bone and cuboid
    band(lig.shapes, [P(ft, 0.0412, 0.0205, 0.0005), P(ft, 0.0392, 0.0172, 0.0198), P(ft, 0.0392, 0.0185, 0.0368)], 0.0065, 0.0068, 0.0013, D(ft, [0, -1, 0]));
    band(lig.shapes, [P(ft, 0.0552, 0.0052, -0.0198), P(ft, 0.0602, 0.0062, 0.0105), P(ft, 0.0672, 0.0085, 0.0398)], 0.0095, 0.0108, 0.0012, D(ft, [0, -1, 0]));
    // the plantar fascia: a tough sheet from the heel's tuber fanning to the five toes
    for (const [x, z] of [[0.0255, 0.0952], [0.0405, 0.1035], [0.0558, 0.0992], [0.0702, 0.0925], [0.0842, 0.0832]]) {
      band(lig.shapes, [P(ft, ax + 0.002, 0.0025, -0.0275), P(ft, ax + 0.002 + (x - ax - 0.002) * 0.35, 0.0028, 0.012), P(ft, x, 0.0032, z - 0.006)], 0.0068, 0.0042, 0.0008, D(ft, [0, -1, 0]), { free: true });
    }
  }
  return parts;
}
