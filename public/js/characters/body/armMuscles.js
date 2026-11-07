// The muscles of the shoulder, arm, forearm and hand, each shaped as it really is: a smooth belly
// (flat where it lies on bone, full where it bulges), fine fibre lines running along it, and white
// tendons at its ends that land on the right spot of the right bone. Every point is given on the
// bone that carries it (rest, drawing units, the body's left side; s = -1 mirrors it) and carried
// into the pose. A muscle keeps its volume: when its ends come together (it shortens) its belly
// grows thicker, and when it is stretched it grows thinner, as a real one does.
// Plain numbers and arrays only (no three.js).
import { sweep } from './sdf.js';
import { poseRig } from './muscles.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mv = (A, v) => [A[0] * v[0] + A[1] * v[1] + A[2] * v[2], A[3] * v[0] + A[4] * v[1] + A[5] * v[2], A[6] * v[0] + A[7] * v[1] + A[8] * v[2]];

// Catmull-Rom through points, then resampled evenly along its length: n+1 points and the length
function evenCurve(pts, n) {
  const fine = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 1; k <= 12; k++) {
      const t = k / 12, t2 = t * t, t3 = t2 * t;
      fine.push([0, 1, 2].map((j) => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  const L = [0]; for (let i = 1; i < fine.length; i++) L.push(L[i - 1] + len(sub(fine[i], fine[i - 1])));
  const total = L[L.length - 1], out = [];
  let j = 0;
  for (let i = 0; i <= n; i++) {
    const want = (total * i) / n;
    while (j < L.length - 2 && L[j + 1] < want) j++;
    const f = (want - L[j]) / Math.max(1e-12, L[j + 1] - L[j]);
    out.push(lerp(fine[j], fine[j + 1], Math.min(1, Math.max(0, f))));
  }
  return { pts: out, length: total };
}

const STRIAE = 18; // fibre lines round a belly
// (the goblin is thickly muscled: bellies filled out so neighbours meet as in a real body)
const FILL_W = 1.5, FILL_D = 1.25;

export function goblinArmMuscles(S, { posed = true } = {}) {
  const k = S.scale;
  const rig = poseRig(S, posed), rest = poseRig(S, false);
  const parts = [];
  const jl = (n) => mul(S.joints.find((j) => j.name === n).pos, 1 / k); // a joint's rest place, drawing units

  for (const s of [-1, 1]) {
    const side = s > 0 ? 'left' : 'right';
    const X = (p) => [s * p[0], p[1], p[2]];
    const L = (n) => { const p = jl('left' + n); return [p[0], p[1], p[2]]; }; // (left side's numbers; X mirrors)
    const muscle = (name) => {
      const m = { name: side + name, joint: null, mat: 'muscle', cell: 0.00055 * k / 0.864, shapes: [] };
      const t = { name: side + name + 'Tendons', joint: null, mat: 'tendon', cell: 0.00045 * k / 0.864, shapes: [] };
      parts.push(m, t);
      return { m: m.shapes, t: t.shapes, sw: 1 };
    };
    const jn = (n) => (n.startsWith('upperChest') || n === 'chest' ? n : side + n);
    // One belly. pts: [[bone, point], ...] from origin to insertion. w: half width, d: half depth
    // (outward), di: half depth (inward, toward the bone); out: [bone, the outward direction];
    // ta / tb: how much of the length is tendon at each end; tw / tt: the tendon's half width and
    // half thickness; peak: where along the belly it is fattest (0..1).
    const belly = (M, pts, o) => {
      let { w, d, di = d * 0.8, ta = 0.06, tb = 0.12, tw = w * 0.35, tt = Math.min(d, di) * 0.3, peak = 0.5, out, blend = 0.0024, tendonA = true, tendonB = true, fl = 1, lines = true, form = 'spindle' } = o;
      w *= FILL_W * (M.sw || 1); d *= FILL_D * Math.sqrt(M.sw || 1); di *= FILL_D;
      const P = pts.map(([b, p]) => rig.at(jn(b), X(p)));
      const R0 = pts.map(([b, p]) => rest.at(jn(b), X(p)));
      const N = 20, cp = evenCurve(P, N), cr = evenCurve(R0, N);
      // keep the volume: the belly's section grows as the muscle shortens
      const bulge = Math.min(1.35, Math.max(0.82, Math.sqrt(cr.length / cp.length)));
      const front = mv(rig.J[jn(out[0])].R, X(out[1]));
      const prof = (u) => {
        if (u <= ta || u >= 1 - tb) return 0;
        const v = (u - ta) / (1 - ta - tb), q = v < peak ? 0.5 * v / peak : 0.5 + 0.5 * (v - peak) / (1 - peak);
        return Math.pow(Math.sin(Math.PI * q), 0.4);
      };
      const ridges = lines ? Array.from({ length: STRIAE }, (_, i) => ({ a: -Math.PI + (i + 0.5) * 2 * Math.PI / STRIAE, w: 0.075 })) : [];
      const st = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N, f = prof(u);
        if (f <= 0 && !(i > 0 && prof((i - 1) / N) > 0) && !(i < N && prof((i + 1) / N) > 0)) continue;
        const g = Math.max(f, 0.18);
        // the width: a spindle is widest at its belly; a fan widest at its origin, narrowing to its
        // tendon; a strap keeps its width
        const v = Math.min(1, Math.max(0, (u - ta) / (1 - ta - tb)));
        const gw = form === 'fan' ? Math.max(0.12, Math.pow(1 - v, 0.75)) * Math.min(1, 0.55 + v * 6) * (f > 0 ? 1 : 0.4) : form === 'strap' ? Math.max(g, f > 0 ? 0.85 : 0) : g;
        const rw = (tw + (w * fl - tw) * gw) * (f > 0 ? Math.pow(bulge, 0.35) : 1);
        const rd = (tt + (d - tt) * g) * (f > 0 ? bulge : 1), rdi = (tt + (di - tt) * g) * (f > 0 ? Math.pow(bulge, 0.6) : 1);
        const hh = 0.00022 * Math.min(1, f * 2.5);
        st.push({ p: cp.pts[i], r: [rd * k, rw * k, rdi * k, rw * k], h: ridges.map((_, j) => (j % 2 ? -hh : hh * 0.6)) });
      }
      if (st.length > 1) M.m.push(sweep(st, { front, lat: [0, 1, 0], ridges, steps: 5, round: Math.min(tt, tw) * k, blend: blend * k }));
      // the tendons: from each end into the belly
      const tend = (i0, i1) => {
        const tst = [];
        for (let i = i0; i <= i1; i++) {
          const u = i / N, f = prof(u), sh = 1 - 0.55 * f;
          tst.push({ p: cp.pts[i], r: [tt * sh * k, tw * sh * k, tt * sh * k, tw * sh * k] });
        }
        M.t.push(sweep(tst, { front, lat: [0, 1, 0], steps: 4, round: Math.min(tt, tw) * 0.9 * k, blend: 0.0008 * k }));
      };
      if (tendonA && ta > 0) tend(0, Math.min(N, Math.ceil(ta * N) + 2));
      if (tendonB && tb > 0) tend(Math.max(0, Math.floor((1 - tb) * N) - 2), N);
    };
    // a long tendon on its own (for the hand): through points, half width tw, half thickness tt
    const tendon = (M, pts, tw, tt, out) => {
      const P = pts.map(([b, p]) => rig.at(jn(b), X(p)));
      const cp = evenCurve(P, Math.max(6, pts.length * 4));
      const front = mv(rig.J[jn(out[0])].R, X(out[1]));
      M.t.push(sweep(cp.pts.map((p) => ({ p, r: [tt * k, tw * k, tt * k, tw * k] })), { front, lat: [0, 1, 0], steps: 3, round: Math.min(tw, tt) * 0.9 * k, blend: 0.0006 * k }));
    };
    const H = (a, b, c) => [0.121 + c, 0.44 - a, -0.004 + b]; // a point in the hand's frame (left side)
    const off = (p, v) => add(p, v);

    // ============================ SHOULDER ============================
    { // deltoid: the cap of the shoulder. Front fibres from the collarbone, middle from the edge of
      // the acromion (many short slanting bundles: it is the strongest part), back from the spine
      // of the shoulder blade; all over the ball and tubercles to the rough V halfway down the arm
      const M = muscle('Deltoid');
      const ins = ['UpperArm', [0.1312, 0.7245, -0.0132]];
      // front (clavicular) part, middle (acromial) part, back (spinal) part
      belly(M, [['Shoulder', [0.0895, 0.8338, 0.0215]], ['UpperArm', [0.127, 0.808, 0.0165]], ['UpperArm', [0.1345, 0.762, 0.0045]], ins], { w: 0.0105, d: 0.0052, di: 0.0036, ta: 0.0, tb: 0.1, peak: 0.42, out: ['UpperArm', [0.6, 0.3, 0.8]], tw: 0.0026, tt: 0.0008, form: 'fan', blend: 0.006 });
      belly(M, [['Shoulder', [0.1135, 0.8395, -0.0125]], ['UpperArm', [0.1435, 0.809, -0.0085]], ['UpperArm', [0.1425, 0.762, -0.0095]], ins], { w: 0.0118, d: 0.006, di: 0.0042, ta: 0.0, tb: 0.1, peak: 0.42, out: ['UpperArm', [1, 0.3, 0]], tw: 0.0026, tt: 0.0008, form: 'fan', blend: 0.006 });
      belly(M, [['Shoulder', [0.1045, 0.8385, 0.0055]], ['UpperArm', [0.1385, 0.8105, 0.0045]], ['UpperArm', [0.1405, 0.762, -0.0025]], ins], { w: 0.0095, d: 0.0058, di: 0.004, ta: 0.0, tb: 0.1, peak: 0.42, out: ['UpperArm', [0.85, 0.3, 0.5]], tw: 0.0026, tt: 0.0008, form: 'fan', blend: 0.007, lines: true });
      belly(M, [['Shoulder', [0.1025, 0.8355, -0.0405]], ['UpperArm', [0.1405, 0.8085, -0.0275]], ['UpperArm', [0.1405, 0.761, -0.0175]], ins], { w: 0.0105, d: 0.0055, di: 0.004, ta: 0.0, tb: 0.1, peak: 0.42, out: ['UpperArm', [0.85, 0.3, -0.5]], tw: 0.0026, tt: 0.0008, form: 'fan', blend: 0.007 });
      belly(M, [['Shoulder', [0.0855, 0.8262, -0.0645]], ['UpperArm', [0.1335, 0.803, -0.0425]], ['UpperArm', [0.137, 0.76, -0.0255]], ins], { w: 0.0135, d: 0.0048, di: 0.0034, ta: 0.0, tb: 0.1, peak: 0.42, out: ['UpperArm', [0.6, 0.3, -0.8]], tw: 0.0026, tt: 0.0008, form: 'fan', blend: 0.006 });
    }
    { // supraspinatus: fills the hollow above the spine, runs under the acromion and over the top
      // of the ball to the top facet of the greater tubercle
      const M = muscle('Supraspinatus');
      belly(M, [['Shoulder', [0.0465, 0.8192, -0.0905]], ['Shoulder', [0.0685, 0.8215, -0.0715]], ['Shoulder', [0.0905, 0.8275, -0.042]], ['UpperArm', [0.112, 0.8245, -0.0205]], ['UpperArm', [0.1262, 0.8188, -0.0135]]], { w: 0.0075, d: 0.0042, di: 0.0028, ta: 0.0, tb: 0.3, peak: 0.3, out: ['Shoulder', [0, 1, -0.4]], tw: 0.0042, tt: 0.0011, form: 'fan' });
    }
    { // infraspinatus: the broad fan in the hollow below the spine, its fibres converging over the
      // back of the ball to the middle facet
      const M = muscle('Infraspinatus');
      belly(M, [['Shoulder', [0.0455, 0.7655, -0.1015]], ['Shoulder', [0.0745, 0.7855, -0.0815]], ['UpperArm', [0.1225, 0.8035, -0.0395]], ['UpperArm', [0.1318, 0.8085, -0.0235]]], { w: 0.0135, d: 0.0034, di: 0.0018, ta: 0.0, tb: 0.26, peak: 0.35, out: ['Shoulder', [0.6, 0, -0.8]], tw: 0.004, tt: 0.001, form: 'fan' });
    }
    { // teres minor: a narrow band along the outer edge of the blade to the lowest facet
      const M = muscle('TeresMinor');
      belly(M, [['Shoulder', [0.0705, 0.7425, -0.0775]], ['Shoulder', [0.0855, 0.7745, -0.0585]], ['UpperArm', [0.1195, 0.7905, -0.0395]], ['UpperArm', [0.1295, 0.7985, -0.0292]]], { w: 0.0042, d: 0.0034, ta: 0.02, tb: 0.25, peak: 0.4, out: ['Shoulder', [0.6, -0.2, -0.8]], tw: 0.0028, tt: 0.001 });
    }
    { // teres major: from the bottom corner of the blade, round under the arm, to the inner lip of
      // the bicipital groove (the back of the armpit)
      const M = muscle('TeresMajor');
      belly(M, [['Shoulder', [0.0615, 0.7215, -0.0935]], ['Shoulder', [0.0805, 0.7385, -0.0745]], ['UpperArm', [0.1055, 0.7655, -0.0365]], ['UpperArm', [0.1165, 0.7755, -0.0155]], ['UpperArm', [0.1182, 0.7775, -0.0105]]], { w: 0.0065, d: 0.0052, ta: 0.02, tb: 0.18, peak: 0.4, out: ['Shoulder', [0.3, -0.8, -0.5]], tw: 0.0042, tt: 0.0009 });
    }
    { // subscapularis: the big fan on the front of the blade (against the ribs), passing in front of
      // the joint to the lesser tubercle
      const M = muscle('Subscapularis');
      belly(M, [['Shoulder', [0.0475, 0.7755, -0.0845]], ['Shoulder', [0.0765, 0.7905, -0.0475]], ['UpperArm', [0.1035, 0.7975, -0.0055]], ['UpperArm', [0.1162, 0.7995, -0.0018]]], { w: 0.0132, d: 0.0028, di: 0.0022, ta: 0.0, tb: 0.22, peak: 0.38, out: ['Shoulder', [-0.6, 0, 0.8]], tw: 0.0042, tt: 0.001, form: 'fan' });
    }
    { // coracobrachialis: from the coracoid's tip down the inside of the arm
      const M = muscle('Coracobrachialis');
      belly(M, [['Shoulder', [0.0942, 0.8178, 0.0035]], ['UpperArm', [0.1055, 0.7845, 0.0005]], ['UpperArm', [0.1115, 0.7505, -0.0105]], ['UpperArm', [0.1172, 0.7335, -0.0145]]], { w: 0.0036, d: 0.0035, ta: 0.12, tb: 0.08, peak: 0.45, out: ['UpperArm', [-1, 0, 0.3]], tw: 0.0018, tt: 0.0009 });
    }

    // ============================ UPPER ARM ============================
    { // biceps brachii: the long head's tendon from the top of the socket over the ball and down the
      // bicipital groove, the short head from the coracoid; two bellies side by side down the front
      // of the arm, joining in one tendon that dives into the elbow's crook to the radius's
      // tuberosity, with a flat side-sheet (the bicipital aponeurosis) to the inner forearm
      const M = muscle('Biceps');
      const ins = [['UpperArm', [0.1255, 0.6235, 0.0035]], ['LowerArm', [0.1262, 0.5955, -0.0065]], ['LowerArm', [0.1258, 0.5855, -0.0155]]];
      belly(M, [['Shoulder', [0.0935, 0.8185, -0.0215]], ['UpperArm', [0.1105, 0.8225, -0.0105]], ['UpperArm', [0.1212, 0.8095, -0.0025]], ['UpperArm', [0.1218, 0.7855, -0.0005]], ['UpperArm', [0.1262, 0.7255, 0.0155]], ['UpperArm', [0.1265, 0.6705, 0.0135]], ...ins],
        { w: 0.0088, d: 0.0085, di: 0.006, ta: 0.3, tb: 0.26, peak: 0.55, out: ['UpperArm', [0.25, 0, 1]], tw: 0.0019, tt: 0.0012 });
      belly(M, [['Shoulder', [0.0942, 0.8172, 0.0055]], ['UpperArm', [0.1085, 0.7845, 0.0065]], ['UpperArm', [0.1182, 0.7255, 0.0145]], ['UpperArm', [0.1225, 0.6705, 0.0125]], ...ins],
        { w: 0.0084, d: 0.0082, di: 0.0058, ta: 0.14, tb: 0.3, peak: 0.55, out: ['UpperArm', [-0.25, 0, 1]], tw: 0.0019, tt: 0.0012 });
      tendon(M, [['UpperArm', [0.1235, 0.6255, 0.0085]], ['LowerArm', [0.1155, 0.6055, 0.0035]], ['LowerArm', [0.1065, 0.5885, -0.0055]]], 0.0032, 0.00045, ['LowerArm', [-0.7, 0, 0.7]]);
    }
    { // brachialis: under the biceps, from the front of the lower half of the humerus over the front
      // of the elbow to the ulna's tuberosity (the elbow's main bender)
      const M = muscle('Brachialis');
      belly(M, [['UpperArm', [0.1262, 0.7155, -0.0055]], ['UpperArm', [0.1245, 0.6755, -0.0005]], ['UpperArm', [0.1215, 0.6325, 0.0005]], ['LowerArm', [0.1182, 0.6095, -0.0025]], ['LowerArm', [0.1158, 0.5975, -0.0118]]],
        { w: 0.0112, d: 0.0052, di: 0.003, ta: 0.0, tb: 0.2, peak: 0.42, out: ['UpperArm', [0, 0, 1]], tw: 0.0042, tt: 0.0011, form: 'fan' });
    }
    { // triceps brachii: the long head from under the socket, the lateral head from the back of the
      // humerus above the spiral groove, the medial head (deep) from below it; one wide flat tendon
      // over the back of the lower arm into the point of the elbow
      const M = muscle('Triceps');
      const ins = [['UpperArm', [0.1175, 0.6545, -0.0365]], ['LowerArm', [0.1145, 0.6305, -0.0355]], ['LowerArm', [0.1142, 0.6265, -0.0332]]];
      belly(M, [['Shoulder', [0.0875, 0.7882, -0.0365]], ['UpperArm', [0.1065, 0.7605, -0.0395]], ['UpperArm', [0.1115, 0.7105, -0.0445]], ...ins], { w: 0.0095, d: 0.0072, di: 0.0055, ta: 0.06, tb: 0.3, peak: 0.42, out: ['UpperArm', [-0.45, 0, -1]], tw: 0.0052, tt: 0.0011 });
      belly(M, [['UpperArm', [0.1295, 0.7805, -0.0215]], ['UpperArm', [0.1352, 0.7405, -0.0325]], ['UpperArm', [0.1285, 0.6905, -0.0405]], ...ins], { w: 0.0098, d: 0.0068, di: 0.0048, ta: 0.0, tb: 0.32, peak: 0.42, out: ['UpperArm', [0.7, 0, -0.7]], tw: 0.0052, tt: 0.0011 });
      belly(M, [['UpperArm', [0.1205, 0.7255, -0.0255]], ['UpperArm', [0.1195, 0.6855, -0.0305]], ['UpperArm', [0.1175, 0.6555, -0.0335]], ['LowerArm', [0.1145, 0.6305, -0.0345]]], { w: 0.011, d: 0.0048, di: 0.003, ta: 0.0, tb: 0.1, peak: 0.45, out: ['UpperArm', [0, 0, -1]], tw: 0.0045, tt: 0.001 });
    }
    { // anconeus: a small triangle from the back of the outer knob to the side of the ulna
      const M = muscle('Anconeus');
      belly(M, [['UpperArm', [0.1378, 0.6215, -0.0215]], ['LowerArm', [0.1312, 0.6045, -0.0275]], ['LowerArm', [0.1218, 0.5835, -0.0262]]], { w: 0.0042, d: 0.0024, ta: 0.08, tb: 0.04, peak: 0.4, out: ['LowerArm', [0.7, 0, -0.7]], tw: 0.002, tt: 0.0008 });
    }

    // ============================ FOREARM ============================
    // (palms face the thighs: the palm side of the forearm is inside (-x), the back of the hand
    // outside (+x), the thumb side in front (+z), the little-finger side behind (-z))
    const mE = [0.1015, 0.6205, -0.0145]; // the front of the inner knob (common flexor origin)
    const lE = [0.1392, 0.6225, -0.0165]; // the outer knob (common extensor origin)
    { // pronator teres: from the inner knob slanting across the front to the middle of the radius
      const M = muscle('PronatorTeres'); M.sw = 1.3;
      belly(M, [['UpperArm', [0.1025, 0.6285, -0.0115]], ['LowerArm', [0.1085, 0.6005, 0.0015]], ['LowerArm', [0.1255, 0.5605, 0.0035]], ['LowerArm', [0.1355, 0.5355, -0.0035]]], { w: 0.0046, d: 0.0042, ta: 0.04, tb: 0.2, peak: 0.42, out: ['LowerArm', [-0.6, 0, 0.8]], tw: 0.0022, tt: 0.0008 });
    }
    { // flexor carpi radialis: inner knob to the base of the index finger's palm bone
      const M = muscle('FlexorCarpiRadialis'); M.sw = 1.3;
      belly(M, [['UpperArm', mE], ['LowerArm', [0.1032, 0.5805, -0.0055]], ['LowerArm', [0.1045, 0.5205, 0.0005]], ['LowerArm', [0.1085, 0.4705, 0.0035]], ['Hand', H(0.008, 0.0072, -0.0065)], ['Hand', H(0.024, 0.0068, -0.0042)]], { w: 0.0046, d: 0.0038, ta: 0.04, tb: 0.45, peak: 0.4, out: ['LowerArm', [-1, 0, 0]], tw: 0.0013, tt: 0.0008 });
    }
    { // palmaris longus: a small belly and a very long thin tendon to the sheet in the palm
      const M = muscle('PalmarisLongus'); M.sw = 1.3;
      belly(M, [['UpperArm', mE], ['LowerArm', [0.1012, 0.5805, -0.0115]], ['LowerArm', [0.1015, 0.5305, -0.0085]], ['LowerArm', [0.1048, 0.4705, -0.0035]], ['Hand', H(0.006, 0.0005, -0.0085)]], { w: 0.0032, d: 0.0028, ta: 0.04, tb: 0.55, peak: 0.4, out: ['LowerArm', [-1, 0, 0]], tw: 0.0008, tt: 0.0005 });
      // the palmar aponeurosis: a flat fan in the palm toward the four fingers
      for (const f of ['Index', 'Middle', 'Ring', 'Little']) {
        const j = L(f + 'Proximal');
        tendon(M, [['Hand', H(0.006, 0.0005, -0.0085)], ['Hand', H(0.03, (j[2] + 0.004) * 0.6, -0.0078)], ['Hand', [j[0] - 0.0045, j[1] + 0.006, j[2]]]], 0.0021, 0.00035, ['Hand', [-1, 0, 0]]);
      }
    }
    { // flexor carpi ulnaris: from the inner knob and the hook of the ulna down the little-finger
      // edge to the pea-shaped wrist bone
      const M = muscle('FlexorCarpiUlnaris'); M.sw = 1.3;
      belly(M, [['UpperArm', [0.1012, 0.6195, -0.0205]], ['LowerArm', [0.1035, 0.5905, -0.0255]], ['LowerArm', [0.1065, 0.5305, -0.0265]], ['LowerArm', [0.1115, 0.4755, -0.0215]], ['Hand', H(0.0055, -0.0108, -0.0058)]], { w: 0.0045, d: 0.0042, ta: 0.03, tb: 0.28, peak: 0.42, out: ['LowerArm', [-0.7, 0, -0.7]], tw: 0.0016, tt: 0.0009 });
    }
    // the finger flexors' tendons: from the forearm through the wrist's tunnel and along each finger
    const fingerPath = (f, deep) => {
      const p = L(f + 'Proximal'), m = L(f + 'Intermediate'), dd = L(f + 'Distal');
      const palm = -0.0034; // toward the palm, from the bone's middle line
      const pts = [['Hand', H(0.004, (p[2] + 0.004) * 0.35 - 0.0005, -0.0072)], ['Hand', H(0.03, (p[2] + 0.004) * 0.75, -0.0068)], ['Hand', [p[0] + palm, p[1] + 0.003, p[2]]], [f + 'Proximal', [p[0] + palm * 0.95, p[1] - 0.006, p[2]]], [f + 'Proximal', [m[0] + palm * 0.9, m[1] + 0.002, m[2]]]];
      if (deep) pts.push([f + 'Intermediate', [m[0] + palm * 0.85, m[1] - 0.005, m[2]]], [f + 'Intermediate', [dd[0] + palm * 0.8, dd[1] + 0.0015, dd[2]]], [f + 'Distal', [dd[0] + palm * 0.72, dd[1] - 0.003, dd[2]]]);
      else pts.push([f + 'Intermediate', [m[0] + palm * 0.75, m[1] - 0.003, m[2]]]);
      return pts;
    };
    { // flexor digitorum superficialis: the middle layer, four tendons to the middle bones of the fingers
      const M = muscle('FlexorDigitorumSuperficialis'); M.sw = 1.3;
      const F = ['Index', 'Middle', 'Ring', 'Little'];
      F.forEach((f, i) => {
        const z = [0.0005, -0.0045, -0.0095, -0.0145][i];
        belly(M, [['UpperArm', [0.1022, 0.6175, -0.0135]], ['LowerArm', [0.1055, 0.5805, z * 0.6 - 0.006]], ['LowerArm', [0.1062, 0.5305, z * 0.7 - 0.004]], ['LowerArm', [0.1092, 0.4805, z * 0.5 - 0.003]], ['LowerArm', [0.1112, 0.4505, z * 0.4 - 0.004]]], { w: 0.0034, d: 0.0034, ta: 0.04, tb: 0.3, peak: 0.5, out: ['LowerArm', [-1, 0, 0]], tw: 0.0011, tt: 0.0008, blend: 0.0022 });
        tendon(M, [['LowerArm', [0.1112, 0.4555, z * 0.4 - 0.004]], ...fingerPath(f, false)], 0.0011, 0.0006, ['Hand', [-1, 0, 0]]);
      });
    }
    { // flexor digitorum profundus: the deep layer, from the front of the ulna and the membrane, four
      // tendons through the superficial ones' split to the fingertips' bones
      const M = muscle('FlexorDigitorumProfundus'); M.sw = 1.3;
      ['Index', 'Middle', 'Ring', 'Little'].forEach((f, i) => {
        const z = [0.001, -0.004, -0.009, -0.0135][i];
        belly(M, [['LowerArm', [0.1112, 0.5905, -0.0172 + i * 0.0012]], ['LowerArm', [0.1105, 0.5505, z * 0.4 - 0.009]], ['LowerArm', [0.1125, 0.5005, z * 0.5 - 0.006]], ['LowerArm', [0.1145, 0.4605, z * 0.45 - 0.004]]], { w: 0.0036, d: 0.0034, di: 0.0026, ta: 0.0, tb: 0.25, peak: 0.45, out: ['LowerArm', [-1, 0, 0]], tw: 0.0011, tt: 0.0008, blend: 0.0024 });
        tendon(M, [['LowerArm', [0.1145, 0.4655, z * 0.45 - 0.004]], ...fingerPath(f, true)], 0.001, 0.0006, ['Hand', [-1, 0, 0]]);
      });
    }
    { // flexor pollicis longus: from the front of the radius to the thumb's last bone
      const M = muscle('FlexorPollicisLongus'); M.sw = 1.3;
      const t1 = L('ThumbProximal'), t2 = L('ThumbDistal');
      belly(M, [['LowerArm', [0.1245, 0.5755, -0.0005]], ['LowerArm', [0.1185, 0.5305, 0.0035]], ['LowerArm', [0.1162, 0.4805, 0.0065]], ['LowerArm', [0.1158, 0.4555, 0.0062]]], { w: 0.0036, d: 0.0032, di: 0.0024, ta: 0.0, tb: 0.2, peak: 0.45, out: ['LowerArm', [-1, 0, 0.3]], tw: 0.0011, tt: 0.0008 });
      tendon(M, [['LowerArm', [0.1158, 0.4605, 0.0062]], ['Hand', H(0.006, 0.0055, -0.0068)], ['Hand', H(0.016, 0.0115, -0.0065)], ['ThumbMetacarpal', [t1[0] - 0.003, t1[1] + 0.003, t1[2] + 0.001]], ['ThumbProximal', [t2[0] - 0.0028, t2[1] + 0.002, t2[2] + 0.0012]], ['ThumbDistal', [t2[0] - 0.0025, t2[1] - 0.004, t2[2] + 0.0018]]], 0.0011, 0.0007, ['Hand', [-1, 0, 0]]);
    }
    { // pronator quadratus: the flat square across the front of the wrist end, ulna to radius
      const M = muscle('PronatorQuadratus');
      for (const y of [0.4705, 0.4615, 0.4525]) belly(M, [['LowerArm', [0.1145, y, -0.0175]], ['LowerArm', [0.1125, y + 0.0005, -0.0065]], ['LowerArm', [0.1155, y + 0.001, 0.0055]]], { w: 0.0046, d: 0.0018, di: 0.0012, ta: 0.06, tb: 0.06, peak: 0.5, out: ['LowerArm', [-1, 0, 0]], tw: 0.003, tt: 0.0005, blend: 0.002 });
    }
    { // brachioradialis: from high on the outer ridge of the humerus, the thumb-side edge of the
      // forearm, a long flat tendon to the radius's styloid
      const M = muscle('Brachioradialis'); M.sw = 1.3;
      belly(M, [['UpperArm', [0.1392, 0.6705, -0.0175]], ['UpperArm', [0.1415, 0.6355, -0.0065]], ['LowerArm', [0.1365, 0.5905, 0.0065]], ['LowerArm', [0.1335, 0.5305, 0.0105]], ['LowerArm', [0.1285, 0.4855, 0.0125]], ['LowerArm', [0.1235, 0.4545, 0.0155]]], { w: 0.0058, d: 0.0048, di: 0.0036, ta: 0.02, tb: 0.42, peak: 0.36, out: ['LowerArm', [0.2, 0, 1]], tw: 0.0022, tt: 0.0008 });
    }
    // the extensors' tendons over the back of the wrist and hand
    const backOf = (f) => {
      const p = L(f + 'Proximal'), m = L(f + 'Intermediate'), dd = L(f + 'Distal');
      const dor = 0.0032;
      return [['Hand', H(0.006, (p[2] + 0.004) * 0.5, 0.0058)], ['Hand', H(0.035, (p[2] + 0.004) * 0.9, 0.0052)], ['Hand', [p[0] + dor * 1.1, p[1] + 0.003, p[2]]], [f + 'Proximal', [p[0] + dor, p[1] - 0.006, p[2]]], [f + 'Proximal', [m[0] + dor * 0.9, m[1] + 0.002, m[2]]], [f + 'Intermediate', [m[0] + dor * 0.85, m[1] - 0.004, m[2]]], [f + 'Intermediate', [dd[0] + dor * 0.7, dd[1] + 0.0015, dd[2]]], [f + 'Distal', [dd[0] + dor * 0.6, dd[1] - 0.002, dd[2]]]];
    };
    { // extensor carpi radialis longus and brevis: from the outer ridge and knob, beside the
      // brachioradialis, to the backs of the index and middle palm bones
      const M = muscle('ExtensorCarpiRadialis'); M.sw = 1.3;
      belly(M, [['UpperArm', [0.1405, 0.6405, -0.0155]], ['LowerArm', [0.1418, 0.5905, -0.0015]], ['LowerArm', [0.1385, 0.5405, 0.0045]], ['LowerArm', [0.1335, 0.4905, 0.0075]], ['LowerArm', [0.1305, 0.4605, 0.0075]], ['Hand', H(0.008, 0.0072, 0.0058)], ['Hand', H(0.0245, 0.0068, 0.0042)]], { w: 0.0048, d: 0.0042, ta: 0.02, tb: 0.5, peak: 0.32, out: ['LowerArm', [1, 0, 0.4]], tw: 0.0014, tt: 0.0008 });
      belly(M, [['UpperArm', lE], ['LowerArm', [0.1435, 0.5905, -0.0085]], ['LowerArm', [0.1405, 0.5405, -0.0025]], ['LowerArm', [0.1352, 0.4905, 0.0015]], ['LowerArm', [0.1312, 0.4605, 0.0025]], ['Hand', H(0.008, 0.0015, 0.006)], ['Hand', H(0.0245, -0.0002, 0.0045)]], { w: 0.0046, d: 0.0042, ta: 0.03, tb: 0.42, peak: 0.36, out: ['LowerArm', [1, 0, 0]], tw: 0.0014, tt: 0.0008 });
    }
    { // extensor digitorum: from the outer knob down the middle of the back of the forearm, four
      // tendons over the back of the hand to the fingers (spreading into the extensor hoods)
      const M = muscle('ExtensorDigitorum'); M.sw = 1.3;
      ['Index', 'Middle', 'Ring', 'Little'].forEach((f, i) => {
        const z = [0.002, -0.003, -0.008, -0.012][i];
        belly(M, [['UpperArm', lE], ['LowerArm', [0.1425, 0.5805, -0.0145 + i * 0.001]], ['LowerArm', [0.1405, 0.5305, -0.0115 + z * 0.3]], ['LowerArm', [0.1352, 0.4855, -0.0065 + z * 0.4]], ['LowerArm', [0.1312, 0.4605, -0.0045 + z * 0.4]]], { w: 0.0032, d: 0.0034, ta: 0.04, tb: 0.28, peak: 0.45, out: ['LowerArm', [1, 0, 0]], tw: 0.001, tt: 0.0007, blend: 0.0022 });
        tendon(M, [['LowerArm', [0.1312, 0.4655, -0.0045 + z * 0.4]], ...backOf(f)], 0.0012, 0.0005, ['Hand', [1, 0, 0]]);
      });
    }
    { // extensor digiti minimi and extensor carpi ulnaris along the little-finger side of the back
      const M = muscle('ExtensorCarpiUlnaris'); M.sw = 1.3;
      belly(M, [['UpperArm', [0.1388, 0.6195, -0.0205]], ['LowerArm', [0.1335, 0.5805, -0.0255]], ['LowerArm', [0.1265, 0.5205, -0.0262]], ['LowerArm', [0.1225, 0.4705, -0.0225]], ['Hand', H(0.004, -0.0135, 0.0025)], ['Hand', H(0.0235, -0.0118, 0.0028)]], { w: 0.0042, d: 0.0038, ta: 0.03, tb: 0.35, peak: 0.42, out: ['LowerArm', [0.6, 0, -0.8]], tw: 0.0015, tt: 0.0008 });
      const M2 = muscle('ExtensorDigitiMinimi'); M2.sw = 1.3;
      belly(M2, [['UpperArm', lE], ['LowerArm', [0.1405, 0.5805, -0.0205]], ['LowerArm', [0.1345, 0.5205, -0.0195]], ['LowerArm', [0.1285, 0.4705, -0.0165]]], { w: 0.0026, d: 0.0028, ta: 0.04, tb: 0.25, peak: 0.45, out: ['LowerArm', [1, 0, -0.3]], tw: 0.0009, tt: 0.0006 });
      tendon(M2, [['LowerArm', [0.1285, 0.4755, -0.0165]], ...backOf('Little').map(([b, p], i) => (i < 2 ? [b, add(p, [0, 0, -0.0015])] : [b, p]))], 0.0009, 0.0005, ['Hand', [1, 0, 0]]);
    }
    { // supinator: deep, from the outer knob and the ulna's crest, wrapping round the top of the radius
      const M = muscle('Supinator'); M.sw = 1.3;
      belly(M, [['UpperArm', [0.1392, 0.6185, -0.0145]], ['LowerArm', [0.1385, 0.5955, -0.0185]], ['LowerArm', [0.1392, 0.5755, -0.0085]], ['LowerArm', [0.1345, 0.5625, -0.0015]]], { w: 0.0058, d: 0.0026, di: 0.0018, ta: 0.04, tb: 0.06, peak: 0.45, out: ['LowerArm', [1, 0, 0]], tw: 0.004, tt: 0.0006 });
      belly(M, [['LowerArm', [0.1225, 0.5925, -0.0185]], ['LowerArm', [0.1345, 0.5905, -0.0222]], ['LowerArm', [0.1405, 0.5755, -0.0115]], ['LowerArm', [0.1352, 0.5605, -0.0025]]], { w: 0.0042, d: 0.0024, di: 0.0016, ta: 0.04, tb: 0.06, peak: 0.45, out: ['LowerArm', [1, 0, -0.3]], tw: 0.003, tt: 0.0006 });
    }
    { // the thumb's three muscles from the back of the forearm: abductor pollicis longus and
      // extensor pollicis brevis cross over the radial wrist extensors to the thumb's base, the
      // extensor pollicis longus turns round Lister's tubercle to the thumb's last bone; and the
      // extensor indicis to the index finger
      const t0 = L('ThumbMetacarpal'), t1 = L('ThumbProximal'), t2 = L('ThumbDistal');
      const M = muscle('AbductorPollicisLongus'); M.sw = 1.3;
      belly(M, [['LowerArm', [0.1305, 0.5555, -0.0185]], ['LowerArm', [0.1385, 0.5155, -0.0105]], ['LowerArm', [0.1372, 0.4855, 0.0025]], ['LowerArm', [0.1288, 0.4605, 0.0125]], ['Hand', H(0.006, 0.0165, 0.0005)], ['ThumbMetacarpal', [t0[0] + 0.001, t0[1] - 0.003, t0[2] + 0.004]]], { w: 0.0034, d: 0.0028, ta: 0.0, tb: 0.42, peak: 0.42, out: ['LowerArm', [1, 0, 0]], tw: 0.0011, tt: 0.0007 });
      const M2 = muscle('ExtensorPollicisBrevis'); M2.sw = 1.3;
      belly(M2, [['LowerArm', [0.1328, 0.5155, -0.0155]], ['LowerArm', [0.1385, 0.4905, -0.0045]], ['LowerArm', [0.1325, 0.4655, 0.0095]], ['Hand', H(0.006, 0.0158, 0.0022)], ['ThumbMetacarpal', [t1[0] + 0.0028, t1[1] + 0.006, t1[2] + 0.001]], ['ThumbProximal', [t1[0] + 0.0026, t1[1] - 0.002, t1[2]]]], { w: 0.0026, d: 0.0024, ta: 0.0, tb: 0.5, peak: 0.42, out: ['LowerArm', [1, 0, 0]], tw: 0.0009, tt: 0.0006 });
      const M3 = muscle('ExtensorPollicisLongus'); M3.sw = 1.3;
      belly(M3, [['LowerArm', [0.1275, 0.5455, -0.0235]], ['LowerArm', [0.1335, 0.5055, -0.0175]], ['LowerArm', [0.1335, 0.4705, -0.0075]], ['LowerArm', [0.1305, 0.4575, -0.0005]], ['Hand', H(0.008, 0.0085, 0.0062)], ['Hand', H(0.018, 0.0145, 0.0048)], ['ThumbMetacarpal', [t1[0] + 0.0028, t1[1] + 0.003, t1[2]]], ['ThumbProximal', [t2[0] + 0.0024, t2[1] + 0.002, t2[2]]], ['ThumbDistal', [t2[0] + 0.0021, t2[1] - 0.0025, t2[2]]]], { w: 0.0028, d: 0.0026, ta: 0.0, tb: 0.6, peak: 0.45, out: ['LowerArm', [1, 0, 0]], tw: 0.0009, tt: 0.0006 });
      const M4 = muscle('ExtensorIndicis'); M4.sw = 1.3;
      belly(M4, [['LowerArm', [0.1262, 0.5155, -0.0225]], ['LowerArm', [0.1315, 0.4855, -0.0145]], ['LowerArm', [0.1312, 0.4625, -0.0055]]], { w: 0.0026, d: 0.0022, ta: 0.0, tb: 0.25, peak: 0.45, out: ['LowerArm', [1, 0, 0]], tw: 0.0009, tt: 0.0006 });
      tendon(M4, [['LowerArm', [0.1312, 0.4675, -0.0055]], ...backOf('Index').map(([b, p], i) => (i < 3 ? [b, add(p, [0.0006, 0, -0.0012])] : [b, p]))], 0.0009, 0.0005, ['Hand', [1, 0, 0]]);
    }

    // ============================ HAND ============================
    { // the ball of the thumb (thenar): abductor pollicis brevis on top, flexor pollicis brevis
      // beside it, opponens underneath along the thumb's palm bone
      const t0 = L('ThumbMetacarpal'), t1 = L('ThumbProximal');
      const M = muscle('Thenar');
      belly(M, [['Hand', H(0.008, 0.0095, -0.0085)], ['Hand', H(0.016, 0.0145, -0.0098)], ['ThumbMetacarpal', [t1[0] - 0.0035, t1[1] + 0.0065, t1[2] + 0.0028]], ['ThumbProximal', [t1[0] - 0.002, t1[1] - 0.002, t1[2] + 0.0032]]], { w: 0.0046, d: 0.0042, di: 0.003, ta: 0.04, tb: 0.15, peak: 0.45, out: ['Hand', [-0.8, 0, 0.6]], tw: 0.0018, tt: 0.0007 });
      belly(M, [['Hand', H(0.009, 0.0045, -0.0082)], ['Hand', H(0.018, 0.0085, -0.0102)], ['ThumbMetacarpal', [t1[0] - 0.0042, t1[1] + 0.005, t1[2] - 0.0008]], ['ThumbProximal', [t1[0] - 0.003, t1[1] - 0.002, t1[2] - 0.001]]], { w: 0.0042, d: 0.0038, di: 0.0028, ta: 0.04, tb: 0.15, peak: 0.45, out: ['Hand', [-1, 0, 0.3]], tw: 0.0016, tt: 0.0007, blend: 0.0024 });
      belly(M, [['Hand', H(0.008, 0.0125, -0.0062)], ['ThumbMetacarpal', [t0[0] - 0.003, t0[1] - 0.005, t0[2] + 0.0055]], ['ThumbMetacarpal', [t1[0] - 0.002, t1[1] + 0.006, t1[2] + 0.0042]]], { w: 0.0036, d: 0.0028, di: 0.002, ta: 0.04, tb: 0.06, peak: 0.45, out: ['Hand', [-0.4, 0, 1]], tw: 0.0018, tt: 0.0006, blend: 0.0024 });
      // adductor pollicis: the fan from the middle palm bone across the palm to the thumb's base
      const M2 = muscle('AdductorPollicis');
      for (const a of [0.03, 0.045, 0.058]) belly(M2, [['Hand', H(a, -0.001, -0.0045)], ['Hand', H((a + 0.03) / 2, 0.006, -0.0062)], ['ThumbProximal', [t1[0] - 0.0028, t1[1] + 0.0005, t1[2] - 0.0028]]], { w: 0.0034, d: 0.0022, di: 0.0018, ta: 0.02, tb: 0.18, peak: 0.4, out: ['Hand', [-1, 0, 0]], tw: 0.0016, tt: 0.0006, blend: 0.0026 });
    }
    { // the little finger's mound (hypothenar): abductor, short flexor and opponens of the little finger
      const p5 = L('LittleProximal');
      const M = muscle('Hypothenar');
      belly(M, [['Hand', H(0.006, -0.0125, -0.0062)], ['Hand', H(0.035, -0.0168, -0.0055)], ['Hand', [p5[0] - 0.0015, p5[1] + 0.004, p5[2] - 0.003]], ['LittleProximal', [p5[0] - 0.0005, p5[1] - 0.003, p5[2] - 0.0032]]], { w: 0.0044, d: 0.004, di: 0.003, ta: 0.04, tb: 0.15, peak: 0.42, out: ['Hand', [-0.5, 0, -1]], tw: 0.0016, tt: 0.0007 });
      belly(M, [['Hand', H(0.012, -0.0095, -0.0082)], ['Hand', H(0.04, -0.0135, -0.0088)], ['LittleProximal', [p5[0] - 0.0025, p5[1] - 0.002, p5[2] - 0.0012]]], { w: 0.0036, d: 0.0034, di: 0.0024, ta: 0.04, tb: 0.15, peak: 0.42, out: ['Hand', [-1, 0, -0.3]], tw: 0.0014, tt: 0.0006, blend: 0.0024 });
    }
    { // the lumbricals: four slim worms in the palm, from the deep flexor's tendons round the thumb
      // side of each finger to its extensor hood
      const M = muscle('Lumbricals');
      ['Index', 'Middle', 'Ring', 'Little'].forEach((f) => {
        const p = L(f + 'Proximal');
        belly(M, [['Hand', H(0.026, (p[2] + 0.004) * 0.75, -0.0062)], ['Hand', H(0.05, (p[2] + 0.004) * 0.95 + 0.0018, -0.0058)], ['Hand', [p[0] - 0.0012, p[1] + 0.003, p[2] + 0.0032]], [f + 'Proximal', [p[0] + 0.0012, p[1] - 0.007, p[2] + 0.0028]]], { w: 0.0016, d: 0.0016, ta: 0.04, tb: 0.3, peak: 0.4, out: ['Hand', [-1, 0, 0]], tw: 0.0007, tt: 0.0004, blend: 0.001 });
      });
    }
    { // the interossei: between the palm bones, the dorsal ones (four, two-headed, seen on the back
      // of the hand) and the palmar ones (three) to the sides of the fingers' first bones
      const M = muscle('Interossei');
      const F = ['Index', 'Middle', 'Ring', 'Little'], mid = [0.0045, -0.0035, -0.0085, -0.012];
      const dorsal = [['Index', 1], ['Middle', 1], ['Middle', -1], ['Ring', -1]]; // (which finger, which side it pulls)
      dorsal.forEach(([f, side2], i) => {
        const p = L(f + 'Proximal'), b = i === 0 ? 0.0092 : (mid[i - 1] + mid[i]) / 2 + 0.0012;
        belly(M, [['Hand', H(0.026, b, 0.0012)], ['Hand', H(0.05, b * 0.95, 0.0015)], [f + 'Proximal', [p[0] + 0.0008, p[1] - 0.004, p[2] + side2 * 0.0032]]], { w: 0.0022, d: 0.0026, di: 0.0022, ta: 0.02, tb: 0.2, peak: 0.42, out: ['Hand', [1, 0, 0]], tw: 0.001, tt: 0.0005, blend: 0.0012 });
      });
      [['Index', -1, 0], ['Ring', 1, 1], ['Little', 1, 2]].forEach(([f, side2, i]) => {
        const p = L(f + 'Proximal'), b = [0.002, -0.0072, -0.0108][i];
        belly(M, [['Hand', H(0.028, b, -0.0028)], ['Hand', H(0.05, b, -0.0025)], [f + 'Proximal', [p[0] - 0.0008, p[1] - 0.004, p[2] + side2 * 0.003]]], { w: 0.0018, d: 0.002, di: 0.0018, ta: 0.02, tb: 0.2, peak: 0.42, out: ['Hand', [-1, 0, 0]], tw: 0.0009, tt: 0.0005, blend: 0.0012 });
      });
    }
  }
  return parts;
}
