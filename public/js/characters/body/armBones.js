// The bones of the arm, shaped the way they really are: the upper arm bone (humerus), the two
// forearm bones (ulna and radius), each with its heads, necks, ridges, grooves, bumps where the
// muscles pull, and the hollows the other bones fit into. Drawn for the body's left side (x > 0);
// s = -1 mirrors it. In drawing units (skull top at 1.09), standing straight, arms hanging, palms
// to the thighs (so the forearm is half turned: the thumb side faces forward).
// Angles round a bone (see sweep in sdf.js): 0 = front, PI/2 = outside (lateral), PI = back,
// -PI/2 = inside (medial).
import { cone, ell, sweep, alongDir } from './sdf.js';

const PI = Math.PI;

// shJ: the middle of the shoulder ball; elJ: the elbow's hinge; wrJ: the wrist
export function armBones(s, { shJ, elJ, wrJ }) {
  const X = (x, y, z) => [s * x, y, z];
  const E = (o) => ({ front: [0, 0, 1], lat: [s, 0, 0], ...o });
  const ellA = (c, dir, r, roll = 0, o = {}) => ell(c, r, { m: alongDir(dir, roll), blend: 0.0015, ...o });
  const ex = elJ[1], ez = elJ[2]; // the elbow's hinge runs along x through (ex, ez)
  // ======================================================================================
  // HUMERUS
  // ======================================================================================
  const hu = [];
  // the head: a smooth ball, a third of it showing, facing in, up and back into the socket
  hu.push(ellA([shJ[0] + s * 0.0012, shJ[1] - 0.0008, shJ[2] + 0.0004], [-s, 0.75, -0.35], [0.0149, 0.0132, 0.0149], 0, { blend: 0.001 }));
  // the bone behind the head (where the tubercles sit); the head joins it along a shallow ring,
  // the anatomical neck
  hu.push(ell(X(0.1215, 0.8, -0.016), [0.0108, 0.0145, 0.0112], { blend: 0.0015 }));
  // greater tubercle: the big rounded mass on the outside that makes the shoulder's outline, a
  // little lower than the top of the head; its three flat facets (top, middle, back) are where
  // supraspinatus, infraspinatus and teres minor land
  hu.push(ell(X(0.1262, 0.8055, -0.0178), [0.0072, 0.0118, 0.0102], { blend: 0.004 }));
  hu.push(ell(X(0.1268, 0.8122, -0.0145), [0.0058, 0.0042, 0.0062], { blend: 0.003 }));   // top facet
  hu.push(ell(X(0.1272, 0.8045, -0.0245), [0.0052, 0.0068, 0.0042], { blend: 0.003 }));   // back facets
  // lesser tubercle: the smaller knob in front, where subscapularis lands
  hu.push(ellA(X(0.1158, 0.7995, -0.0052), [0, 1, 0.15], [0.0034, 0.0058, 0.003], 0, { blend: 0.004 }));
  // the shaft, from the surgical neck down to just above the elbow: round at the top, with the
  // bicipital groove in front between its two lips; the deltoid's rough V on the outside half way
  // down; the shallow spiral groove for the radial nerve winding round the back; then broad and
  // flat from front to back, with a ridge running down each side to the knobs of the elbow
  const R = {
    groove: 0, lipG: 1, lipL: 2, deltoid: 3, spiral: 4, ridgeL: 5, ridgeM: 6, nutr: 7,
  };
  const ridges = [
    { a: 0.12, w: 0.24 },   // bicipital groove (negative)
    { a: 0.55, w: 0.22 },   // its outer lip, the crest of the greater tubercle (pectoralis major lands here)
    { a: -0.32, w: 0.2 },   // its inner lip, the crest of the lesser tubercle (teres major)
    { a: 1.3, w: 0.42 },    // deltoid tuberosity
    { a: -2.4, w: 0.35 },   // radial groove, winding from the back-inside to the back-outside (negative)
    { a: 1.62, w: 0.3 },    // lateral supracondylar ridge
    { a: -1.62, w: 0.3 },   // medial supracondylar ridge
    { a: -0.9, w: 0.2 },    // (unused)
  ];
  const st = (y, x, z, f, l, b, m, h, a) => ({ p: X(x, y, z), r: [f, l, b, m], h, a });
  hu.push(sweep([
    //          y      x       z       front   lat     back    med     groove  lipG    lipL    delt    spiral  rL      rM   -    angles (only the spiral turns)
    st(0.796, 0.1205, -0.0145, 0.0098, 0.0098, 0.0098, 0.0094, [-0.0022, 0.0012, 0.0008, 0, 0, 0, 0, 0], [0.12, 0.55, -0.32, 1.3, -2.6, 1.62, -1.62, -0.9]),
    st(0.785, 0.1215, -0.0145, 0.0078, 0.0078, 0.0078, 0.0074, [-0.0022, 0.0012, 0.0009, 0, 0, 0, 0, 0], [0.12, 0.55, -0.32, 1.3, -2.6, 1.62, -1.62, -0.9]),
    st(0.765, 0.1225, -0.0148, 0.0069, 0.007, 0.0069, 0.0066, [-0.0018, 0.0011, 0.0008, 0.0002, 0, 0, 0, 0], [0.14, 0.6, -0.3, 1.3, -2.6, 1.62, -1.62, -0.9]),
    st(0.74, 0.1232, -0.015, 0.0066, 0.0066, 0.0065, 0.0062, [-0.0009, 0.0007, 0.0005, 0.0009, -0.0004, 0, 0, 0], [0.18, 0.65, -0.28, 1.28, -2.5, 1.62, -1.62, -0.9]),
    st(0.715, 0.1238, -0.0153, 0.0064, 0.0064, 0.0063, 0.006, [0, 0.0003, 0.0002, 0.0014, -0.0006, 0, 0, 0], [0.2, 0.7, -0.28, 1.25, -2.9, 1.62, -1.62, -0.9]),
    st(0.69, 0.124, -0.0157, 0.0061, 0.0063, 0.006, 0.0058, [0, 0, 0, 0.0008, -0.0006, 0.0002, 0.0001, 0], [0.2, 0.7, -0.28, 1.3, -3.38, 1.62, -1.62, -0.9]),
    st(0.665, 0.124, -0.0162, 0.0056, 0.0072, 0.0054, 0.0066, [0, 0, 0, 0, -0.0004, 0.0012, 0.0008, 0], [0.2, 0.7, -0.28, 1.3, -3.88, 1.65, -1.6, -0.9]),
    st(0.645, 0.1235, -0.0168, 0.0049, 0.0098, 0.0047, 0.0094, [0, 0, 0, 0, 0, 0.0018, 0.0012, 0], [0.2, 0.7, -0.28, 1.3, -3.88, 1.68, -1.58, -0.9]),
    st(0.633, 0.1222, -0.0172, 0.0046, 0.0128, 0.0045, 0.0128, [0, 0, 0, 0, 0, 0.001, 0.0008, 0], [0.2, 0.7, -0.28, 1.3, -3.88, 1.7, -1.55, -0.9]),
    st(0.624, 0.1195, -0.0176, 0.0052, 0.0165, 0.0052, 0.0175, [0, 0, 0, 0, 0, 0.0004, 0.0004, 0], [0.2, 0.7, -0.28, 1.3, -3.88, 1.7, -1.55, -0.9]),
    st(0.618, 0.1185, -0.0172, 0.0055, 0.0155, 0.0055, 0.0165, [0, 0, 0, 0, 0, 0, 0, 0], [0.2, 0.7, -0.28, 1.3, -3.88, 1.7, -1.55, -0.9]),
  ], E({ ridges, blend: 0.002, steps: 8, round: 0.003 })));
  // the lower end. The hinge surface: the trochlea (a spool, inside, that the ulna wraps round)
  // and the capitulum (a half ball, outside and in front, that the radius's head turns on)
  const tro = [0.1065, 0.1105, 0.114, 0.1175, 0.1205];
  hu.push(sweep([
    { p: X(tro[0] - 0.001, ex - 0.0014, ez - 0.0004), r: [0.0072, 0.0072, 0.0072, 0.0072] },
    { p: X(tro[0] + 0.0012, ex - 0.0012, ez), r: [0.0088, 0.0088, 0.0088, 0.0088] },
    { p: X(tro[1], ex - 0.0004, ez), r: [0.0084, 0.0084, 0.0084, 0.0084] },
    { p: X(tro[2], ex, ez), r: [0.0071, 0.0071, 0.0071, 0.0071] },
    { p: X(tro[3], ex, ez), r: [0.0076, 0.0076, 0.0076, 0.0076] },
    { p: X(tro[4], ex, ez), r: [0.0079, 0.0079, 0.0079, 0.0079] },
  ], { front: [0, 0, 1], lat: [0, 1, 0], blend: 0.0012, steps: 12, round: 0.0035 }));
  hu.push(ell(X(0.1295, ex, ez + 0.0004), [0.0068, 0.0069, 0.0069], { blend: 0.0018 }));
  // the knobs either side of the elbow: the big inside one (medial epicondyle, the "funny bone",
  // where the forearm's flexors start) and the smaller outside one (lateral epicondyle, the extensors)
  hu.push(ellA(X(0.1018, 0.6205, -0.0188), [-1, 0.4, -0.2], [0.0048, 0.0075, 0.0044], 0, { blend: 0.005 }));
  hu.push(ellA(X(0.1365, 0.623, -0.0172), [1, 0.9, -0.08], [0.0032, 0.0065, 0.0034], 0, { blend: 0.005 }));
  // the bone between the knobs and the hinge (the condyles), behind and above it
  hu.push(ellA(X(0.1185, 0.6195, -0.0172), [1, 0, -0.05], [0.0062, 0.0185, 0.0064], 0, { blend: 0.004 }));
  // the hollows: the deep one at the back that the point of the elbow drops into when the arm is
  // straight (olecranon fossa), and the two small ones in front for the ulna's beak and the radius's
  // head when it bends (coronoid and radial fossae)
  hu.push(ellA(X(0.1145, 0.6305, -0.0248), [0, 1, -0.25], [0.0058, 0.0085, 0.0048], 0, { sub: true, blend: 0.0022 }));
  hu.push(ell(X(0.1145, 0.6268, -0.0112), [0.0038, 0.0045, 0.0026], { sub: true, blend: 0.0018 }));
  hu.push(ell(X(0.1295, 0.626, -0.0112), [0.0028, 0.0034, 0.0022], { sub: true, blend: 0.0016 }));
  // the bicipital groove carries on up between the tubercles
  hu.push(cone(X(0.1205, 0.8175, -0.0025), X(0.1222, 0.786, -0.0045), 0.0019, 0.0021, { sub: true, blend: 0.0016 }));

  // ======================================================================================
  // ULNA (little-finger side): the hook at the elbow, a long three-sided shaft, a small head
  // ======================================================================================
  const ul = [];
  // the hook at the top: one curved piece wrapped round the humerus's spool, from the point of the
  // elbow (olecranon, at the back, its tip curling forward into the hollow) round underneath to the
  // beak in front (coronoid process). Stations go round the hinge; at each, the piece's half widths
  // (outside, inside) and its thickness (away from the hinge, toward it).
  const cx0 = 0.1142;
  const hook = (deg, rc, wl, out, wm, inn) => {
    const f = deg * PI / 180, d = [0, Math.cos(f), -Math.sin(f)];
    return { p: X(cx0, ex + d[1] * rc, ez + d[2] * rc), r: [wl, out, wm, inn], lat: d };
  };
  ul.push(sweep([
    hook(38, 0.0118, 0.0042, 0.0026, 0.0044, 0.0028),
    hook(55, 0.0132, 0.0064, 0.0045, 0.0066, 0.0042),
    hook(85, 0.0139, 0.0074, 0.006, 0.0078, 0.0054),
    hook(130, 0.0134, 0.007, 0.006, 0.0072, 0.005),
    hook(180, 0.0126, 0.0066, 0.0058, 0.0066, 0.0046),
    hook(215, 0.0121, 0.0062, 0.005, 0.006, 0.0042),
    hook(248, 0.0106, 0.0042, 0.003, 0.0042, 0.0026),
  ], { front: [s, 0, 0], lat: [0, 1, 0], blend: 0.002, steps: 16, round: 0.0018 }));
  // the olecranon's flat top, where triceps lands, standing up behind the hinge
  ul.push(ellA(X(cx0, ex + 0.0105, ez - 0.0175), [0, 1, -0.35], [0.0074, 0.0062, 0.0058], 0, { blend: 0.004 }));
  // the side of the beak the radius's head turns against (radial notch), and below it the
  // supinator crest
  ul.push(ell(X(0.1205, 0.6012, -0.0135), [0.0035, 0.0045, 0.0055], { blend: 0.002 }));
  const uRidges = [
    { a: 1.2, w: 0.22 },  // interosseous border, the sharp edge toward the radius
    { a: PI, w: 0.4 },    // the back border, the edge you can feel all the way down
    { a: 0.15, w: 0.5 },  // ulnar tuberosity, where brachialis lands (front, top)
    { a: 1.55, w: 0.25 }, // supinator crest (outside, top)
  ];
  const us = (y, x, z, f, l, b, m, h, a) => ({ p: X(x, y, z), r: [f, l, b, m], h, a });
  ul.push(sweep([
    us(0.598, 0.1162, -0.0195, 0.0066, 0.006, 0.0062, 0.0062, [0, 0, 0.0008, 0.0006], [1.3, PI, 0.15, 1.6]),
    us(0.585, 0.1168, -0.0205, 0.0055, 0.005, 0.0054, 0.0052, [0.0004, 0.0004, 0.0012, 0.0008], [1.3, PI, 0.15, 1.6]),
    us(0.565, 0.1172, -0.0208, 0.0047, 0.0042, 0.0048, 0.0045, [0.0012, 0.0006, 0.0003, 0.0004], [1.28, PI, 0.15, 1.55]),
    us(0.535, 0.1177, -0.0204, 0.0042, 0.0038, 0.0043, 0.004, [0.0015, 0.0006, 0, 0], [1.22, PI, 0.15, 1.55]),
    us(0.5, 0.1185, -0.0194, 0.0037, 0.0034, 0.0039, 0.0036, [0.0013, 0.0005, 0, 0], [1.12, PI, 0.15, 1.55]),
    us(0.47, 0.1193, -0.0177, 0.0033, 0.0032, 0.0035, 0.0033, [0.0007, 0.0003, 0, 0], [1.0, PI, 0.15, 1.55]),
    us(0.456, 0.1198, -0.0158, 0.0042, 0.0042, 0.0044, 0.0042, [0, 0, 0, 0], [1.0, PI, 0.15, 1.55]),
    us(0.4475, 0.1198, -0.015, 0.0048, 0.0048, 0.0049, 0.0048, [0, 0, 0, 0], [1.0, PI, 0.15, 1.55]),
  ], E({ ridges: uRidges, blend: 0.0025, steps: 7, round: 0.002 })));
  // the head at the wrist end, and the small spike behind it (styloid process)
  ul.push(ell(X(0.1198, 0.4472, -0.015), [0.0054, 0.0052, 0.0054], { blend: 0.003 }));
  ul.push(cone(X(0.1182, 0.4475, -0.0192), X(0.1174, 0.4418, -0.0203), 0.0022, 0.0012, { blend: 0.0025 }));
  // the trochlear notch: the deep half-moon hollow that wraps the humerus's spool (carved with the
  // spool's own shape, a hair bigger, so the two fit), and the radial notch for the radius's head
  ul.push(sweep([
    { p: X(tro[0] - 0.002, ex, ez), r: [0.0093, 0.0093, 0.0093, 0.0093] },
    { p: X(tro[1], ex, ez), r: [0.0089, 0.0089, 0.0089, 0.0089] },
    { p: X(tro[2], ex, ez), r: [0.0077, 0.0077, 0.0077, 0.0077] },
    { p: X(tro[3], ex, ez), r: [0.0082, 0.0082, 0.0082, 0.0082] },
    { p: X(tro[4] + 0.002, ex, ez), r: [0.0085, 0.0085, 0.0085, 0.0085] },
  ], { front: [0, 0, 1], lat: [0, 1, 0], sub: true, blend: 0.0012, steps: 12, round: 0.002 }));
  ul.push(cone(X(0.1298, 0.6045, ez), X(0.1298, 0.597, ez), 0.0082, 0.0082, { sub: true, blend: 0.0012 }));

  // ======================================================================================
  // RADIUS (thumb side): a round head under the capitulum, a thin neck, the biceps' bump, a shaft
  // bowed outward that grows broad at the wrist
  // ======================================================================================
  const ra = [];
  const rh = X(0.1298, 0.6005, ez + 0.0002); // middle of the head
  ra.push(cone(X(0.1298, 0.6035, ez + 0.0002), X(0.1298, 0.5975, ez + 0.0002), 0.0074, 0.0072, { blend: 0.001 }));
  ra.push(cone(X(0.1298, 0.5975, ez + 0.0002), X(0.1299, 0.5915, ez + 0.0006), 0.0072, 0.0046, { blend: 0.0015 }));
  // the shallow cup on top of the head that turns against the capitulum
  ra.push(ell(X(0.1295, ex, ez + 0.0004), [0.0072, 0.0074, 0.0074], { sub: true, blend: 0.001 }));
  const rRidges = [
    { a: -2.75, w: 0.22 }, // interosseous border, the sharp edge toward the ulna
    { a: -2.5, w: 0.5 },   // radial tuberosity (biceps)
    { a: 1.35, w: 0.6 },   // pronator teres's rough patch, outside, half way down
    { a: 1.3, w: 0.25 },   // Lister's tubercle, on the back of the wrist end
  ];
  const rs = (y, x, z, f, l, b, m, h, a) => ({ p: X(x, y, z), r: [f, l, b, m], h, a });
  ra.push(sweep([
    rs(0.592, 0.1299, -0.0134, 0.0045, 0.0045, 0.0045, 0.0045, [0, 0, 0, 0], [-2.75, -2.5, 1.35, 1.3]),
    rs(0.584, 0.1302, -0.0128, 0.0045, 0.0045, 0.0047, 0.0046, [0, 0.0028, 0, 0], [-2.75, -2.5, 1.35, 1.3]),
    rs(0.575, 0.1306, -0.0118, 0.0044, 0.0044, 0.0045, 0.0044, [0.0004, 0.0018, 0, 0], [-2.75, -2.5, 1.35, 1.3]),
    rs(0.55, 0.1316, -0.0088, 0.0042, 0.0042, 0.0042, 0.0041, [0.0013, 0, 0.0003, 0], [-2.8, -2.5, 1.35, 1.3]),
    rs(0.52, 0.1318, -0.0052, 0.0043, 0.0043, 0.0043, 0.0041, [0.0015, 0, 0.0007, 0], [-2.85, -2.5, 1.35, 1.3]),
    rs(0.495, 0.1302, -0.0015, 0.0049, 0.0045, 0.0045, 0.0043, [0.0013, 0, 0.0002, 0], [-2.95, -2.5, 1.35, 1.3]),
    rs(0.475, 0.127, 0.0015, 0.0068, 0.0051, 0.0058, 0.0049, [0.0008, 0, 0, 0.0003], [-3.05, -2.5, 1.35, 1.3]),
    rs(0.463, 0.1238, 0.0034, 0.0102, 0.0058, 0.009, 0.0055, [0.0002, 0, 0, 0.0008], [-3.1, -2.5, 1.35, 1.3]),
    rs(0.453, 0.1225, 0.0042, 0.012, 0.0063, 0.0104, 0.006, [0, 0, 0, 0.0009], [-3.1, -2.5, 1.35, 1.3]),
    rs(0.4422, 0.1222, 0.0045, 0.0116, 0.0059, 0.0104, 0.0057, [0, 0, 0, 0.0003], [-3.1, -2.5, 1.35, 1.3]),
  ], E({ ridges: rRidges, blend: 0.0025, steps: 7, round: 0.0022 })));
  // the styloid point on the thumb side, reaching lowest
  ra.push(cone(X(0.1218, 0.4515, 0.0115), X(0.1216, 0.4412, 0.0146), 0.0046, 0.0021, { blend: 0.0035 }));
  // Lister's tubercle on the back, with the tendon grooves either side
  ra.push(ellA(X(0.1288, 0.4545, 0.0028), [0, 1, 0], [0.0016, 0.0042, 0.0014], 0, { blend: 0.0015 }));
  ra.push(cone(X(0.1292, 0.462, 0.0068), X(0.1292, 0.446, 0.0072), 0.0009, 0.0009, { sub: true, blend: 0.0012 }));
  ra.push(cone(X(0.1292, 0.462, -0.0012), X(0.1292, 0.446, -0.0018), 0.0009, 0.0009, { sub: true, blend: 0.0012 }));
  // the notch at the little-finger side that turns round the ulna's head, and the shallow cup
  // underneath that the wrist bones sit in
  ra.push(ell(X(0.1198, 0.4472, -0.015), [0.0062, 0.0058, 0.0062], { sub: true, blend: 0.0012 }));
  ra.push(ellA(X(0.1222, 0.4374, 0.0042), [0, 0.25, 1], [0.0056, 0.0105, 0.0042], 0, { sub: true, blend: 0.0015 }));

  // ---- the cartilage on the joint surfaces (smooth, glassy, about a millimetre thick) ----
  const huC = [], ulC = [], raC = [];
  const grow = (q, g) => (q.kind === 'sweep' ? { ...q, stations: q.stations.map((t) => ({ ...t, r: t.r.map((v) => v + g) })), sub: false }
    : q.kind === 'cone' ? { ...q, ra: q.ra + g, rb: q.rb + g, sub: false } : { ...q, r: q.r.map((v) => v + g), sub: false });
  // the ball of the shoulder: a cap over the head only (cut away where the tubercles start)
  huC.push(grow(hu[0], 0.0008));
  const ax = [s, -0.75, 0.35], al = Math.hypot(...ax);
  huC.push(ell([shJ[0] + ax[0] / al * 0.0185, shJ[1] + ax[1] / al * 0.0185, shJ[2] + ax[2] / al * 0.0185], [0.0175, 0.0175, 0.0175], { sub: true, blend: 0.002 }));
  // the spool and the half ball at the elbow
  const spool = hu.find((q) => q.kind === 'sweep' && q.lat[1] === 1);
  huC.push(grow(spool, 0.0007), grow(hu.find((q) => q.kind === 'ell' && q.c[0] === s * 0.1295 && !q.sub), 0.0007));
  huC.push(ell(X(0.118, ex + 0.0125, ez - 0.0005), [0.016, 0.0085, 0.012], { sub: true, blend: 0.002 })); // (only below the fossae)
  // the lining of the ulna's half-moon notch: the spool's shape, a hair bigger, its front cut away
  const notch = ul.find((q) => q.sub && q.kind === 'sweep');
  ulC.push(grow(notch, 0.0006), { ...notch, stations: notch.stations.map((t) => ({ ...t, r: t.r.map((v) => v - 0.0002) })) });
  ulC.push(ell([s * 0.114, ex + 0.0115 * 0.77, ez + 0.0115 * 0.64], [0.012, 0.0118, 0.0118], { sub: true, blend: 0.001 }));
  ulC.push(ell(X(0.114, ex - 0.0005, ez - 0.0175), [0.012, 0.0125, 0.0085], { sub: true, blend: 0.001 })); // (not past the notch's back)
  // the radius's head: its cup and rim
  raC.push({ ...ra[0], ra: ra[0].ra + 0.0006, rb: ra[0].rb + 0.0006, blend: 0.001 });
  raC.push(ell(X(0.1295, ex, ez + 0.0004), [0.0068, 0.007, 0.007], { sub: true, blend: 0.0008 }));
  // the ulna's head at the wrist
  ulC.push(ell(X(0.1198, 0.4472, -0.015), [0.006, 0.0058, 0.006], { blend: 0.001 }));
  ulC.push(ell(X(0.1198, 0.4502, -0.017), [0.007, 0.004, 0.0062], { sub: true, blend: 0.001 }));
  return { humerus: hu, ulna: ul, radius: ra, radialHead: rh, cart: { humerus: huC, ulna: ulC, radius: raC } };
}

// The shoulder girdle: the collarbone (clavicle) and the shoulder blade (scapula), for the body's
// left side (s = -1 mirrors it). The blade is a thin curved plate with thick edges, the spine
// standing out of its back and running up into the flat roof over the shoulder (acromion), the
// hooked finger in front (coracoid), and the shallow socket the arm's ball turns in (glenoid),
// carved to the ball's own curve.
export function shoulderGirdle(s, { shJ }) {
  const X = (x, y, z) => [s * x, y, z];
  const ellA = (c, dir, r, roll = 0, o = {}) => ell(c, r, { m: alongDir(dir, roll), blend: 0.0015, ...o });
  const tubeS = (out, pts, r0, r1, o = {}) => {
    // a smooth round rod through points (as a sweep), radius r0 at the start to r1 at the end
    const n = pts.length - 1;
    out.push(sweep(pts.map((p, i) => { const r = r0 + (r1 - r0) * i / n; return { p, r: [r, r, r, r] }; }), { steps: 8, round: Math.min(r0, r1) * 0.8, blend: 0.002, ...o }));
  };
  const cl = [], sc = [];
  // ---- the collarbone: an S, bowed forward near the breastbone and backward near the shoulder,
  // round and thick at the inner end, flat and broad at the outer end
  const cp = [[0.0165, 0.8178, 0.0425], [0.03, 0.8215, 0.0478], [0.05, 0.8262, 0.0462], [0.068, 0.8305, 0.0365], [0.083, 0.8335, 0.0215], [0.095, 0.8355, 0.0055], [0.1035, 0.8368, -0.0065]];
  const cr = [[0.0062, 0.0058], [0.0054, 0.0052], [0.0048, 0.0048], [0.0042, 0.0052], [0.0034, 0.0062], [0.0029, 0.0068], [0.0027, 0.0064]];
  cl.push(sweep(cp.map((p, i) => ({ p: X(...p), r: [cr[i][0], cr[i][1], cr[i][0] * 1.05, cr[i][1]] })), { front: [0, 1, 0], lat: [0, 0, 1], steps: 8, round: 0.0025, blend: 0.002 }));
  cl.push(ell(X(0.017, 0.8175, 0.0425), [0.0058, 0.0068, 0.0062], { blend: 0.003 })); // the knob at the breastbone
  cl.push(ellA(X(0.06, 0.8248, 0.0435), [1, 0, -0.3], [0.0018, 0.008, 0.0016], 0, { blend: 0.003 })); // (subclavius groove's edge)
  cl.push(ell(X(0.087, 0.8302, 0.0185), [0.0035, 0.002, 0.0035], { blend: 0.003 })); // conoid tubercle underneath

  // ---- the shoulder blade
  // the plate, slice by slice from top to bottom: the inner (medial) edge and the outer edge
  const sl = [
    // y       medial edge              lateral edge
    [0.8255, [0.042, -0.086], [0.078, -0.052]],
    [0.812, [0.037, -0.094], [0.085, -0.043]],
    [0.795, [0.034, -0.1], [0.087, -0.04]],
    [0.775, [0.035, -0.101], [0.083, -0.047]],
    [0.755, [0.039, -0.1], [0.077, -0.056]],
    [0.735, [0.046, -0.098], [0.07, -0.067]],
    [0.72, [0.054, -0.094], [0.063, -0.079]],
    [0.7135, [0.059, -0.09], [0.0605, -0.0865]],
  ];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  sc.push(sweep(sl.map(([y, m, l]) => {
    const c = mid(m, l), dx = l[0] - m[0], dz = l[1] - m[1], w = Math.hypot(dx, dz) / 2;
    return { p: X(c[0], y, c[1]), r: [0.001, w, 0.0009, w], lat: [s * dx / (2 * w), 0, dz / (2 * w)] };
  }), { front: [0, 0, 1], lat: [s, 0, 0], steps: 6, blend: 0.0015 }));
  // the inner (vertebral) edge, the thick outer (axillary) edge running up to under the socket,
  // and the thin top edge with its notch, then the inferior angle's rounded point
  const med = sl.map(([y, m]) => X(m[0] - 0.0004, y, m[1] - 0.0002));
  tubeS(sc, med.slice(0, 7), 0.0016, 0.0019);
  tubeS(sc, [X(0.0598, 0.7148, -0.0878), X(0.066, 0.728, -0.0795), X(0.074, 0.75, -0.0655), X(0.081, 0.772, -0.0515), X(0.0862, 0.789, -0.0385)], 0.0028, 0.0038);
  tubeS(sc, [X(0.042, 0.8258, -0.086), X(0.056, 0.8262, -0.072), X(0.067, 0.8225, -0.062), X(0.0725, 0.8238, -0.0565)], 0.0014, 0.0015);
  sc.push(cone(X(0.0735, 0.8195, -0.0555), X(0.0735, 0.8275, -0.0555), 0.0026, 0.0026, { sub: true, blend: 0.0012 })); // suprascapular notch
  sc.push(ell(X(0.0595, 0.7155, -0.0885), [0.0032, 0.0032, 0.0026], { blend: 0.003 }));
  // the neck under the socket and the socket itself: a pear-shaped shallow cup, its face turned
  // out and a little forward, carved to the ball (with room for the cartilage)
  sc.push(ellA(X(0.0898, 0.8025, -0.0295), [0.05, 1, 0.12], [0.0065, 0.0125, 0.0088], -0.5, { blend: 0.004 }));
  sc.push(ellA(X(0.0935, 0.7985, -0.0245), [0.05, 1, 0.12], [0.0042, 0.0072, 0.0072], -0.5, { blend: 0.003 })); // the wider lower half
  sc.push(ell(X(0.0935, 0.8065, -0.0215), [0.0035, 0.009, 0.0062], { blend: 0.003 }));
  sc.push(ell(shJ, [0.0162, 0.0162, 0.0162], { sub: true, blend: 0.0012 }));
  sc.push(ell(X(0.0935, 0.8172, -0.0222), [0.0025, 0.0022, 0.0025], { blend: 0.002 })); // supraglenoid tubercle (biceps' long head)
  sc.push(ellA(X(0.0875, 0.7895, -0.0345), [0.2, 1, 0.3], [0.0026, 0.0045, 0.0026], 0, { blend: 0.003 })); // infraglenoid tubercle (triceps' long head)
  // the spine: a shelf standing out of the back of the blade, from a smooth triangle at the inner
  // edge up and out to the acromion: a thin wall (its height toward the back), topped by a thick crest
  const spineBase = [[0.0355, 0.7935, -0.0995], [0.05, 0.8005, -0.0825], [0.065, 0.809, -0.0655], [0.078, 0.8155, -0.0505], [0.088, 0.8225, -0.0395]];
  const spineCrest = [[0.0385, 0.7948, -0.1022], [0.0568, 0.8055, -0.0885], [0.074, 0.8155, -0.0735], [0.087, 0.8245, -0.0585], [0.0975, 0.8318, -0.0475]];
  sc.push(sweep(spineBase.map((b, i) => {
    const c = spineCrest[i], d = [c[0] - b[0], c[1] - b[1], c[2] - b[2]], h = Math.hypot(...d) / 2;
    return { p: X((b[0] + c[0]) / 2, (b[1] + c[1]) / 2, (b[2] + c[2]) / 2), r: [0.0016, h + 0.0006, 0.0016, h + 0.0012], lat: [s * d[0] / (2 * h), d[1] / (2 * h), d[2] / (2 * h)] };
  }), { front: [0, 1, 0], lat: [s, 0, 0], steps: 6, blend: 0.003 }));
  tubeS(sc, [...spineCrest, [0.1035, 0.8355, -0.0385]].map((p) => X(...p)), 0.0026, 0.004, { blend: 0.0035 });
  // the acromion: the flat roof over the shoulder, the spine's end bent forward, its front inner
  // corner meeting the collarbone
  sc.push(sweep([
    { p: X(0.1005, 0.8345, -0.043), r: [0.0026, 0.0055, 0.0026, 0.0042] },
    { p: X(0.1075, 0.8352, -0.031), r: [0.0024, 0.0072, 0.0024, 0.0058] },
    { p: X(0.1092, 0.8358, -0.0185), r: [0.0023, 0.0068, 0.0023, 0.0058] },
    { p: X(0.1075, 0.836, -0.0085), r: [0.0024, 0.0048, 0.0024, 0.0042] },
  ], { front: [0, 1, 0], lat: [s, 0, 0], steps: 8, round: 0.0022, blend: 0.003 }));
  // the coracoid: a bent finger from the top of the neck, up, then forward and out
  tubeS(sc, [X(0.081, 0.8165, -0.045), X(0.0835, 0.8262, -0.034), X(0.0872, 0.8285, -0.018), X(0.0925, 0.8245, -0.002), X(0.0952, 0.8215, 0.004)], 0.0042, 0.0026);
  sc.push(ell(X(0.0952, 0.8212, 0.0045), [0.003, 0.0027, 0.0032], { blend: 0.0025 }));
  // the cartilage of the socket, and the ring of gristle round its rim (the labrum) that deepens it
  const scC = [];
  const g = [s * 0.0955, 0.803, -0.0222], n = [s * 0.94, 0, 0.34];
  scC.push(ellA(g, [0, 1, 0], [0.0022, 0.0098, 0.0072], 0, { m: (() => { const e1 = [0, 1, 0], e2 = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]]; return [...n, ...e1, ...e2]; })(), blend: 0.001 }));
  scC[0].r = [0.003, 0.0098, 0.0072];
  scC.push(ell(shJ, [0.0151, 0.0151, 0.0151], { sub: true, blend: 0.0006 }));
  const e1 = [0, 1, 0], e2 = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]];
  const rim = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * 2 * Math.PI, ry = Math.sin(a) > 0 ? 0.0098 : 0.0105, rz = Math.cos(a) * Math.sin(a) < 0 ? 0.0068 : 0.0078;
    let p = [g[0] + e1[0] * Math.sin(a) * ry + e2[0] * Math.cos(a) * rz, g[1] + e1[1] * Math.sin(a) * ry + e2[1] * Math.cos(a) * rz, g[2] + e1[2] * Math.sin(a) * ry + e2[2] * Math.cos(a) * rz];
    const d = [p[0] - shJ[0], p[1] - shJ[1], p[2] - shJ[2]], l = Math.hypot(...d);
    p = [shJ[0] + d[0] / l * 0.0166, shJ[1] + d[1] / l * 0.0166, shJ[2] + d[2] / l * 0.0166];
    rim.push({ p, r: [0.0016, 0.0012, 0.0016, 0.0012], lat: d.map((v) => v / l) });
  }
  scC.push(sweep(rim, { front: n, steps: 3, blend: 0.0012, labrum: true }));
  return { clavicle: cl, scapula: sc, cart: { scapula: scC } };
}
