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
