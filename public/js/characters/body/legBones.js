// The bones of the leg, shaped the way they really are: the thigh bone (femur) with its ball,
// angled neck, the two trochanters, the rough line down its back and the two rounded knuckles at
// the knee; the knee cap (patella); the shin bone (tibia) with its flat top, sharp front edge and
// inner ankle knob; the thin outer bone (fibula) down to the outer ankle knob. Drawn for the
// body's left side (x > 0); s = -1 mirrors it. In drawing units (skull top at 1.09), standing
// straight. Angles round a bone (see sweep in sdf.js): 0 = front, PI/2 = outside (lateral),
// PI = back, -PI/2 = inside (medial).
import { cone, ell, sweep, alongDir } from './sdf.js';

const PI = Math.PI;

// hipJ: the middle of the femur's ball; kneeJ: the knee's hinge; ankleJ: the ankle's hinge
export function legBones(s, { hipJ, kneeJ, ankleJ }) {
  const X = (x, y, z) => [s * x, y, z];
  const E = (o) => ({ front: [0, 0, 1], lat: [s, 0, 0], ...o });
  const ellA = (c, dir, r, roll = 0, o = {}) => ell(c, r, { m: alongDir([s * dir[0], dir[1], dir[2]], roll), blend: 0.0015, ...o });
  const hx = Math.abs(hipJ[0]), hy = hipJ[1], hz = hipJ[2];
  const ky = kneeJ[1], kx = Math.abs(kneeJ[0]);
  // ======================================================================================
  // FEMUR
  // ======================================================================================
  const fe = [];
  // the head: two thirds of a ball, facing up, in and a little forward into the hip socket, with
  // the small pit (fovea) where the round ligament holds on
  fe.push(ell(hipJ, [0.0138, 0.0138, 0.0138], { blend: 0.001 }));
  fe.push(ell(X(hx - 0.0128, hy - 0.0028, hz + 0.0006), [0.0026, 0.0026, 0.0026], { sub: true, blend: 0.001 }));
  // the neck: out, down and back from the head to the shaft at about 125 degrees, taller than it
  // is thick, waisted in the middle
  fe.push(sweep([
    { p: X(hx + 0.005, hy - 0.0015, hz - 0.001), r: [0.0074, 0.0098, 0.0074, 0.0098] },
    { p: X(hx + 0.012, hy - 0.0055, hz - 0.003), r: [0.0064, 0.0082, 0.0064, 0.0082] },
    { p: X(hx + 0.019, hy - 0.0095, hz - 0.0055), r: [0.0072, 0.0104, 0.0076, 0.0104] },
    { p: X(hx + 0.024, hy - 0.0135, hz - 0.0072), r: [0.0088, 0.0125, 0.0092, 0.0125] },
  ], { front: [0, 0, 1], lat: [0, 1, 0], blend: 0.0025, steps: 6, round: 0.003 }));
  // greater trochanter: the big squarish knob on the outside, its tip level with the middle of the
  // head and leaning back; the hollow on its inside back (trochanteric fossa) where the deep hip
  // rotators land
  fe.push(ellA(X(hx + 0.0275, hy - 0.0085, hz - 0.0105), [0.15, 1, -0.25], [0.0078, 0.0145, 0.0108], 0, { blend: 0.004 }));
  fe.push(ellA(X(hx + 0.026, hy + 0.0025, hz - 0.0145), [0.1, 1, -0.4], [0.0055, 0.0055, 0.0062], 0, { blend: 0.003 }));
  fe.push(ell(X(hx + 0.0215, hy - 0.004, hz - 0.0175), [0.0032, 0.0048, 0.0032], { sub: true, blend: 0.0018 }));
  // lesser trochanter: the knob on the inside back below the neck, where iliopsoas lands
  fe.push(cone(X(hx + 0.0175, hy - 0.031, hz - 0.012), X(hx + 0.0115, hy - 0.034, hz - 0.0195), 0.0046, 0.0032, { blend: 0.0035 }));
  // the intertrochanteric crest behind, from the greater to the lesser trochanter (quadratus
  // femoris lands on its tubercle), and the gentler intertrochanteric line in front
  fe.push(cone(X(hx + 0.0255, hy - 0.0065, hz - 0.0185), X(hx + 0.016, hy - 0.031, hz - 0.0175), 0.0029, 0.0026, { blend: 0.003 }));
  fe.push(cone(X(hx + 0.0255, hy - 0.006, hz - 0.001), X(hx + 0.0175, hy - 0.03, hz - 0.0012), 0.0016, 0.0014, { blend: 0.003 }));
  // the shaft: round in the middle, bowed a little forward, slanting in to the knee; the rough line
  // down its back (linea aspera) where the adductors and vastus muscles hold on; at the top it
  // splits into the gluteal tuberosity (outside, gluteus maximus) and the pectineal line (inside);
  // at the bottom into the two supracondylar lines, which open round the flat triangle behind the knee
  const fR = [
    { a: PI, w: 0.22 },        // linea aspera
    { a: PI - 0.55, w: 0.3 },  // gluteal tuberosity (top) / lateral supracondylar line (bottom)
    { a: PI + 0.55, w: 0.22 }, // pectineal / spiral line (top) / medial supracondylar line (bottom)
    { a: -PI / 2, w: 0.5 },    // the inner bulge above the knee (adductor tubercle region)
  ];
  const fs = (y, x, z, f, l, b, m, h, a) => ({ p: X(x, y, z), r: [f, l, b, m], h, a });
  fe.push(sweep([
    fs(hy - 0.016, hx + 0.0225, 0.0035, 0.0094, 0.0098, 0.0096, 0.0094, [0, 0.0008, 0, 0], [PI, PI - 0.6, PI + 0.6, -PI / 2]),
    fs(hy - 0.034, kx + 0.0295, 0.0045, 0.0082, 0.0083, 0.0086, 0.0082, [0.0003, 0.0018, 0.0008, 0], [PI, PI - 0.6, PI + 0.55, -PI / 2]),
    fs(hy - 0.06, kx + 0.0253, 0.0052, 0.0076, 0.0076, 0.0078, 0.0075, [0.0013, 0.0011, 0.0006, 0], [PI, PI - 0.4, PI + 0.4, -PI / 2]),
    fs(hy - 0.1, kx + 0.019, 0.0052, 0.0072, 0.0071, 0.0074, 0.0071, [0.0019, 0, 0, 0], [PI, PI - 0.3, PI + 0.3, -PI / 2]),
    fs(hy - 0.14, kx + 0.0125, 0.0042, 0.0071, 0.007, 0.0073, 0.007, [0.0018, 0, 0, 0], [PI, PI - 0.35, PI + 0.35, -PI / 2]),
    fs(ky + 0.062, kx + 0.0084, 0.0022, 0.0072, 0.0075, 0.0072, 0.0076, [0.0008, 0.0008, 0.0008, 0], [PI, PI - 0.55, PI + 0.55, -PI / 2]),
    fs(ky + 0.042, kx + 0.0052, 0.0, 0.0078, 0.0095, 0.0068, 0.01, [0, 0.0008, 0.0007, 0.0006], [PI, PI - 0.85, PI + 0.85, -PI / 2]),
    fs(ky + 0.027, kx + 0.0028, -0.0025, 0.0088, 0.0128, 0.0075, 0.0138, [0, 0.0004, 0.0004, 0.001], [PI, PI - 1.0, PI + 1.0, -PI / 2]),
    fs(ky + 0.019, kx + 0.0012, -0.0038, 0.0098, 0.0145, 0.0085, 0.0158, [0, 0, 0, 0.0004], [PI, PI - 1.0, PI + 1.0, -PI / 2]),
  ], E({ ridges: fR, blend: 0.0025, steps: 8, round: 0.004 })));
  // the knee end: two rounded knuckles (condyles), the inside one longer and reaching a little
  // lower, curving more tightly at the back (so the knee rolls and slides as it bends); between
  // them at the back the deep notch where the cruciate ligaments start; at the front the saddle
  // the knee cap glides in (its outer wall higher, to keep the knee cap from slipping out)
  fe.push(ellA(X(kx - 0.0115, ky + 0.0105, -0.0062), [0, 1, -0.08], [0.0092, 0.0118, 0.0178], 0, { blend: 0.0035 }));
  fe.push(ellA(X(kx + 0.0115, ky + 0.0118, -0.0042), [0, 1, -0.12], [0.0088, 0.0112, 0.0168], 0, { blend: 0.0035 }));
  // the back of the condyles stands out behind the shaft
  fe.push(ellA(X(kx - 0.0115, ky + 0.0115, -0.0155), [0, 1, -0.3], [0.0085, 0.0105, 0.0075], 0, { blend: 0.006 }));
  fe.push(ellA(X(kx + 0.0115, ky + 0.0125, -0.0145), [0, 1, -0.3], [0.008, 0.0098, 0.007], 0, { blend: 0.006 }));
  // the epicondyles on the sides (where the collateral ligaments start), and the adductor tubercle
  fe.push(ell(X(kx - 0.0195, ky + 0.016, -0.004), [0.0042, 0.0058, 0.0058], { blend: 0.003 }));
  fe.push(ell(X(kx + 0.0192, ky + 0.0165, -0.0035), [0.0036, 0.005, 0.0052], { blend: 0.003 }));
  fe.push(ell(X(kx - 0.0178, ky + 0.0262, -0.0072), [0.0028, 0.004, 0.003], { blend: 0.003 }));
  // the front saddle for the knee cap
  fe.push(ellA(X(kx + 0.0005, ky + 0.0182, 0.0058), [0, 1, 0.12], [0.0185, 0.0118, 0.0082], 0, { blend: 0.004 }));
  fe.push(ellA(X(kx + 0.0098, ky + 0.0215, 0.0085), [0, 1, 0.1], [0.0062, 0.0085, 0.0052], 0, { blend: 0.0028 })); // (outer wall, higher)
  fe.push(cone(X(kx + 0.0005, ky + 0.0295, 0.0142), X(kx + 0.0002, ky + 0.0075, 0.0148), 0.0034, 0.0042, { sub: true, blend: 0.0022 }));
  // the notch between the condyles at the back and underneath
  fe.push(ellA(X(kx - 0.0002, ky + 0.0045, -0.0105), [0, 1, 0.35], [0.0042, 0.0085, 0.0145], 0, { sub: true, blend: 0.0025 }));

  // ======================================================================================
  // PATELLA: a thick rounded triangle, point down, its back two facets (the outer one wider)
  // ======================================================================================
  const pa = [];
  pa.push(ellA(X(kx + 0.0008, ky + 0.0175, 0.0218), [0, 1, 0.12], [0.0108, 0.0128, 0.0052], 0, { blend: 0.002 }));
  pa.push(cone(X(kx + 0.0008, ky + 0.0105, 0.0225), X(kx + 0.0006, ky + 0.0042, 0.021), 0.0052, 0.0022, { blend: 0.004 }));
  pa.push(ell(X(kx + 0.0008, ky + 0.0245, 0.0212), [0.0098, 0.0052, 0.0052], { blend: 0.003 }));
  pa.push(ellA(X(kx + 0.0045, ky + 0.0172, 0.0162), [0, 1, 0.1], [0.0052, 0.0085, 0.0022], 0, { blend: 0.002 }));
  pa.push(ellA(X(kx - 0.0042, ky + 0.0172, 0.0165), [0, 1, 0.1], [0.0042, 0.008, 0.002], 0, { blend: 0.002 }));

  // ======================================================================================
  // TIBIA
  // ======================================================================================
  const ti = [];
  const ty = ky - 0.0005; // (the top of the plateau, under the condyles)
  // the plateau: two broad flat tables, the inner one oval and a little hollowed, the outer one
  // round and nearly flat, overhanging the shaft on every side
  ti.push(ell(X(kx - 0.0118, ty - 0.0072, -0.003), [0.0128, 0.0068, 0.0178], { blend: 0.003 }));
  ti.push(ell(X(kx + 0.0118, ty - 0.0075, -0.004), [0.0118, 0.0066, 0.0158], { blend: 0.003 }));
  ti.push(ell(X(kx, ty - 0.011, -0.003), [0.022, 0.009, 0.0165], { blend: 0.004 }));
  // the shallow cups the condyles sit in (with room for cartilage and the menisci)
  ti.push(ell(X(kx - 0.0118, ty + 0.0052, -0.003), [0.0092, 0.0052, 0.0125], { sub: true, blend: 0.0018 }));
  ti.push(ell(X(kx + 0.0118, ty + 0.0055, -0.004), [0.0082, 0.0052, 0.011], { sub: true, blend: 0.0018 }));
  // the two little spikes in the middle (intercondylar eminence) the cruciate ligaments hold beside
  ti.push(cone(X(kx - 0.0026, ty - 0.004, -0.004), X(kx - 0.0022, ty + 0.0012, -0.0038), 0.0024, 0.0011, { blend: 0.0015 }));
  ti.push(cone(X(kx + 0.0028, ty - 0.004, -0.0048), X(kx + 0.0026, ty + 0.0008, -0.0046), 0.0024, 0.0011, { blend: 0.0015 }));
  // tibial tuberosity in front (the knee cap's tendon lands here) and Gerdy's tubercle on the
  // outer front corner (the iliotibial band's end); the facet for the fibula's head behind it
  ti.push(ellA(X(kx + 0.001, ty - 0.0245, 0.0098), [0, 1, 0.22], [0.0055, 0.0098, 0.0042], 0, { blend: 0.0065 }));
  ti.push(ell(X(kx + 0.0158, ty - 0.0118, 0.0068), [0.0042, 0.004, 0.004], { blend: 0.005 }));
  ti.push(ell(X(kx + 0.0185, ty - 0.0138, -0.011), [0.004, 0.0042, 0.0042], { blend: 0.0045 }));
  // the shaft: three-sided. Its sharp front edge (the shin) runs down a little inside; the flat
  // inner face lies just under the skin; the interosseous edge faces the fibula; on the back the
  // soleal line slants down and in from the outer top
  const tR = [
    { a: 0.12, w: 0.2 },    // anterior border (the shin)
    { a: 1.85, w: 0.22 },   // interosseous border
    { a: -2.1, w: 0.3 },    // medial border
    { a: 2.7, w: 0.3 },     // soleal line (turns as it runs down)
  ];
  const ts = (y, x, z, f, l, b, m, h, a) => ({ p: X(x, y, z), r: [f, l, b, m], h, a });
  const ax = Math.abs(ankleJ[0]);
  ti.push(sweep([
    ts(ty - 0.012, kx + 0.0005, -0.002, 0.0118, 0.0135, 0.0105, 0.0138, [0, 0, 0, 0], [0.12, 1.85, -2.1, 2.7]),
    ts(ty - 0.028, kx + 0.0002, -0.0008, 0.0098, 0.0098, 0.0088, 0.0094, [0.0006, 0.0005, 0.0003, 0.0006], [0.12, 1.85, -2.1, 2.5]),
    ts(ty - 0.05, kx - 0.0002, 0.0005, 0.0086, 0.0078, 0.0072, 0.0076, [0.0018, 0.0012, 0.0006, 0.0008], [0.1, 1.85, -2.1, -2.8]),
    ts(ty - 0.08, kx - 0.0008, 0.0012, 0.0078, 0.0066, 0.0063, 0.0066, [0.0022, 0.0013, 0.0007, 0.0003], [0.08, 1.9, -2.15, -2.6]),
    ts(ty - 0.115, kx - 0.002, 0.0012, 0.0071, 0.006, 0.0058, 0.0062, [0.0018, 0.0011, 0.0006, 0], [0.04, 1.95, -2.2, -2.6]),
    ts(ty - 0.148, ax - 0.0015, 0.0006, 0.0068, 0.0064, 0.0064, 0.0066, [0.0008, 0.0006, 0.0003, 0], [-0.05, 2.0, -2.3, -2.6]),
    ts(ankleJ[1] + 0.024, ax - 0.001, -0.0002, 0.0085, 0.0088, 0.0082, 0.0098, [0.0002, 0.0002, 0, 0], [-0.1, 2.0, -2.3, -2.6]),
    ts(ankleJ[1] + 0.012, ax - 0.0008, -0.0008, 0.0102, 0.0098, 0.0098, 0.0118, [0, 0, 0, 0], [-0.1, 2.0, -2.3, -2.6]),
  ], E({ ridges: tR, blend: 0.0025, steps: 7, round: 0.004 })));
  // the lower end: the flat bottom over the ankle bone, the inner ankle knob (medial malleolus)
  // reaching down the inside, its back grooved for the tendon of tibialis posterior; the notch on
  // the outside where the fibula fits
  const ay = ankleJ[1];
  ti.push(ell(X(ax - 0.0006, ay + 0.0088, -0.0012), [0.0118, 0.0062, 0.0112], { blend: 0.004 }));
  ti.push(ellA(X(ax - 0.0112, ay + 0.0012, 0.0002), [-0.08, 1, 0], [0.0042, 0.0095, 0.0072], 0, { blend: 0.005 }));
  ti.push(cone(X(ax - 0.0138, ay + 0.009, -0.0058), X(ax - 0.0142, ay - 0.002, -0.0052), 0.0015, 0.0013, { sub: true, blend: 0.0012 }));
  ti.push(ell(X(ax + 0.0128, ay + 0.009, -0.0042), [0.0045, 0.0095, 0.0055], { sub: true, blend: 0.002 }));
  // (the ankle's mortise: the hollow the top of the talus turns in)
  ti.push(ell(X(ax, ay - 0.0045, 0.0005), [0.0102, 0.0068, 0.0145], { sub: true, blend: 0.0015 }));

  // ======================================================================================
  // FIBULA
  // ======================================================================================
  const fi = [];
  // the head, tucked under the outer back corner of the tibia's top, with its little point (apex)
  // where the biceps femoris tendon and the outer collateral ligament land
  const fhx = kx + 0.0228, fhy = ty - 0.0175, fhz = -0.0125;
  fi.push(ell(X(fhx, fhy, fhz), [0.0058, 0.0066, 0.0062], { blend: 0.002 }));
  fi.push(cone(X(fhx + 0.001, fhy + 0.003, fhz - 0.002), X(fhx + 0.0012, fhy + 0.0078, fhz - 0.003), 0.003, 0.0013, { blend: 0.002 }));
  // the neck and the thin shaft, three-edged with a twist, a little bowed
  const fbR = [{ a: 0.2, w: 0.25 }, { a: -1.5, w: 0.25 }, { a: PI, w: 0.35 }];
  fi.push(sweep([
    { p: X(fhx - 0.0002, fhy - 0.006, fhz + 0.0002), r: [0.0042, 0.0042, 0.0042, 0.0042], h: [0, 0, 0] },
    { p: X(fhx - 0.0006, fhy - 0.014, fhz + 0.0008), r: [0.0034, 0.0034, 0.0035, 0.0034], h: [0.0004, 0.0004, 0.0003] },
    { p: X(fhx - 0.0018, fhy - 0.05, fhz + 0.0022), r: [0.0035, 0.0033, 0.0038, 0.0034], h: [0.0008, 0.0009, 0.0006], a: [0.3, -1.4, PI] },
    { p: X(fhx - 0.0035, fhy - 0.095, fhz + 0.0035), r: [0.0034, 0.0032, 0.0036, 0.0034], h: [0.0009, 0.0009, 0.0006], a: [0.6, -1.2, PI + 0.4] },
    { p: X(ax + 0.0185, ay + 0.035, -0.0075), r: [0.0035, 0.0034, 0.0036, 0.0034], h: [0.0005, 0.0007, 0.0004], a: [0.9, -1.0, PI + 0.6] },
    { p: X(ax + 0.0178, ay + 0.014, -0.0072), r: [0.0046, 0.0042, 0.0048, 0.0044], h: [0, 0, 0], a: [0.9, -1.0, PI + 0.6] },
    { p: X(ax + 0.0178, ay + 0.004, -0.007), r: [0.0056, 0.0048, 0.0062, 0.0046], h: [0, 0, 0], a: [0.9, -1.0, PI + 0.6] },
  ], E({ ridges: fbR, blend: 0.002, steps: 7, round: 0.002 })));
  // the outer ankle knob (lateral malleolus): longer and lower than the inner one, flat on its
  // inner face against the talus, with the pit behind (malleolar fossa) and the groove behind for
  // the peroneal tendons
  fi.push(ellA(X(ax + 0.0178, ay - 0.0012, -0.0068), [0.05, 1, -0.12], [0.0052, 0.0138, 0.0068], 0, { blend: 0.003 }));
  fi.push(ell(X(ax + 0.0128, ay - 0.0032, -0.0115), [0.0022, 0.0045, 0.0026], { sub: true, blend: 0.0015 }));
  fi.push(cone(X(ax + 0.0195, ay + 0.012, -0.0138), X(ax + 0.0188, ay - 0.008, -0.0132), 0.0014, 0.0013, { sub: true, blend: 0.0012 }));

  // ---- the cartilage on the joint surfaces ----
  const grow = (q, g) => (q.kind === 'sweep' ? { ...q, stations: q.stations.map((t) => ({ ...t, r: t.r.map((v) => v + g) })), sub: false }
    : q.kind === 'ell' ? { ...q, r: q.r.map((v) => v + g), sub: false } : { ...q, ra: q.ra + g, rb: q.rb + g, sub: false });
  const feC = [grow(fe[0], 0.0009)];
  // the condyles (underneath and behind) and the front saddle
  const shiftC = (q) => ({ ...grow(q, 0.0005), c: [q.c[0], q.c[1] - 0.0026, q.c[2] - 0.0018], r: [q.r[0] - 0.0012, q.r[1] + 0.0005, q.r[2] + 0.0005] });
  feC.push(shiftC(fe.find((q) => q.kind === 'ell' && q.c[1] === ky + 0.0105)), shiftC(fe.find((q) => q.kind === 'ell' && q.c[1] === ky + 0.0118)));
  feC.push(grow(fe.find((q) => q.kind === 'ell' && q.c[1] === ky + 0.0182), 0.0007));
  const paC = [ellA(X(kx + 0.0008, ky + 0.0172, 0.0168), [0, 1, 0.1], [0.0088, 0.0098, 0.0028], 0, { blend: 0.002 })];
  const tiC = [
    ell(X(kx - 0.0118, ty - 0.0026, -0.003), [0.0098, 0.0022, 0.0128], { blend: 0.0015 }),
    ell(X(kx + 0.0118, ty - 0.0026, -0.004), [0.0088, 0.0022, 0.0115], { blend: 0.0015 }),
    ell(X(ax, ay + 0.0032, 0.0002), [0.0082, 0.0013, 0.0102], { blend: 0.0015 }),
  ];
  return { femur: fe, patella: pa, tibia: ti, fibula: fi, cart: { femur: feC, patella: paC, tibia: tiC } };
}

// the metatarsals (base, head, radii of base, shaft, head) and the lengths of the toe bones, left side
export const MTS = [
    { b: [0.0315, 0.0222, 0.0615], h: [0.0255, 0.0105, 0.1], rb: 0.0074, rs: 0.0052, rh: 0.0074 },
    { b: [0.0418, 0.0245, 0.0578], h: [0.0408, 0.0092, 0.1078], rb: 0.0052, rs: 0.0033, rh: 0.0046 },
    { b: [0.0515, 0.0228, 0.0592], h: [0.0565, 0.0085, 0.1032], rb: 0.0049, rs: 0.0031, rh: 0.0044 },
    { b: [0.0605, 0.0195, 0.0435], h: [0.0712, 0.0076, 0.0962], rb: 0.0049, rs: 0.003, rh: 0.0042 },
    { b: [0.0702, 0.0162, 0.0402], h: [0.0855, 0.0066, 0.0862], rb: 0.0052, rs: 0.0031, rh: 0.0043 },
  ];
export const TOE_LEN = [[0.0235, 0.0165], [0.0172, 0.0108, 0.0078], [0.0158, 0.0098, 0.0075], [0.0142, 0.0088, 0.0072], [0.012, 0.0078, 0.0062]];
// The joints of toe i (0 = big toe) from the ball of the foot to the tip, left side, standing:
// each { p: start, q: end, u: direction, rr: the bone's radius }
export function toeChain(i) {
  const m = MTS[i], out = [];
  let p = [m.h[0], m.h[1] + 0.0005, m.h[2] + m.rh * 0.95];
  const spread = (i - 1.2) * 0.06;
  for (const [j, l] of TOE_LEN[i].entries()) {
    const pitch = -0.12 - j * 0.12 + (j === 0 ? 0.18 : 0) - (i && j === 1 ? 0.1 : 0);
    const d = [Math.sin(spread), Math.sin(pitch), Math.cos(spread)], dl = Math.hypot(...d), u = d.map((v) => v / dl);
    const q = [p[0] + u[0] * l, p[1] + u[1] * l, p[2] + u[2] * l];
    out.push({ p, q, u, rr: m.rh * (0.95 - j * 0.12) * (i ? 1.05 : 1.08) });
    p = [q[0] + u[0] * 0.0006, q[1] + u[1] * 0.0006, q[2] + u[2] * 0.0006];
  }
  return out;
}

// The bones of the foot (left side, s = -1 mirrors), standing flat: the ankle bone (talus) with its
// domed top held in the mortise of the shin bones, its neck and round head; the heel bone
// (calcaneus) under it, long, with the big tuber behind, the shelf on the inside (sustentaculum
// tali) and the little pulley on the outside (peroneal trochlea); the boat-shaped navicular, the
// cuboid, the three wedge-shaped cuneiforms; five metatarsals (the first short and thick, the
// fifth with its knob sticking out behind); the toe bones; and the two little sesamoid bones under
// the big toe's ball.
export function footBones(s, { ankleJ }) {
  const X = (x, y, z) => [s * x, y, z];
  const ellA = (c, dir, r, roll = 0, o = {}) => ell(c, r, { m: alongDir([s * dir[0], dir[1], dir[2]], roll), blend: 0.0015, ...o });
  const ax = Math.abs(ankleJ[0]), ay = ankleJ[1];
  const fo = [];
  // ---- talus ----
  // the dome (trochlea), wider in front, with a shallow groove along its top
  fo.push(ellA(X(ax, ay - 0.0092, 0.0005), [0, 1, 0], [0.0112, 0.0092, 0.0142], 0, { blend: 0.002 }));
  fo.push(ell(X(ax, ay - 0.0068, 0.008), [0.0118, 0.0062, 0.0075], { blend: 0.003 }));
  fo.push(cone(X(ax, ay + 0.0012, -0.012), X(ax, ay + 0.0012, 0.012), 0.0021, 0.0021, { sub: true, blend: 0.002 }));
  // the lateral process under the outer ankle knob, the small posterior process behind
  fo.push(ell(X(ax + 0.0102, ay - 0.0145, -0.002), [0.0042, 0.0055, 0.0062], { blend: 0.003 }));
  fo.push(cone(X(ax + 0.001, ay - 0.0135, -0.0125), X(ax + 0.002, ay - 0.0158, -0.0168), 0.0034, 0.0022, { blend: 0.003 }));
  // the neck, forward and in, and the round head that turns in the navicular's cup
  const th = [ax - 0.0075, ay - 0.0158, 0.0262];
  fo.push(cone(X(ax - 0.0018, ay - 0.0118, 0.009), X(th[0] + 0.0012, th[1] + 0.0008, th[2] - 0.006), 0.0074, 0.0068, { blend: 0.003 }));
  fo.push(ellA(X(...th), [0.25, 0.25, 1], [0.0082, 0.0068, 0.0086], 0, { blend: 0.002 }));
  // ---- calcaneus ----
  // its body as one run from the tuber at the back to the flat face for the cuboid in front; radii
  // [up, outside, down, inside]
  const cs = (x, y, z, u, l, d, m) => ({ p: X(x, y, z), r: [u, l, d, m] });
  fo.push(sweep([
    cs(ax + 0.0045, 0.0158, -0.0388, 0.0098, 0.0082, 0.0102, 0.0082),
    cs(ax + 0.0045, 0.0168, -0.0322, 0.0112, 0.0088, 0.0118, 0.0088),
    cs(ax + 0.005, 0.0178, -0.0215, 0.0102, 0.0092, 0.0118, 0.0082),
    cs(ax + 0.0065, 0.0182, -0.0085, 0.0088, 0.009, 0.0108, 0.0072),
    cs(ax + 0.0098, 0.0178, 0.0045, 0.0078, 0.0084, 0.0088, 0.0068),
    cs(ax + 0.0138, 0.0168, 0.0138, 0.0068, 0.0075, 0.0072, 0.0066),
  ], { front: [0, 1, 0], lat: [s, 0, 0], blend: 0.003, steps: 7, round: 0.0042 }));
  // the tuber's two feet underneath (where the plantar fascia and the short sole muscles start)
  fo.push(ell(X(ax - 0.0012, 0.0062, -0.0335), [0.0055, 0.0045, 0.0078], { blend: 0.004 }));
  fo.push(ell(X(ax + 0.0098, 0.0068, -0.0335), [0.0042, 0.004, 0.0065], { blend: 0.004 }));
  // the shelf on the inside that holds up the talus's neck, grooved below for the big toe's long flexor
  fo.push(ell(X(ax - 0.0085, ay - 0.0218, -0.0018), [0.0058, 0.0032, 0.0072], { blend: 0.0035 }));
  fo.push(cone(X(ax - 0.0108, ay - 0.0262, -0.012), X(ax - 0.0098, ay - 0.0272, 0.008), 0.0016, 0.0016, { sub: true, blend: 0.0015 }));
  // the peroneal trochlea on the outside, between the two peroneal tendons
  fo.push(ell(X(ax + 0.0158, 0.0175, -0.0045), [0.0022, 0.0028, 0.0042], { blend: 0.0025 }));
  // (the talus sits on the calcaneus's three facets: room carved between them)
  fo.push(ell(X(ax + 0.001, ay - 0.0212, -0.0035), [0.0035, 0.0018, 0.008], { sub: true, blend: 0.0015 }));
  // ---- navicular, cuboid, cuneiforms ----
  const nv = [ax - 0.0085, 0.0272, 0.0392];
  fo.push(ellA(X(...nv), [0.15, 1, 0], [0.0098, 0.0085, 0.0052], 0, { blend: 0.002 }));
  fo.push(ell(X(nv[0] - 0.0095, nv[1] - 0.0052, nv[2] - 0.0022), [0.0042, 0.0042, 0.0045], { blend: 0.0035 })); // (its tuberosity, tibialis posterior)
  fo.push(ell(X(th[0], th[1] + 0.0002, th[2] + 0.0006), [0.0084, 0.007, 0.0086], { sub: true, blend: 0.0012 })); // (its cup for the talus's head)
  fo.push(ell(X(ax + 0.0145, 0.0172, 0.0302), [0.0084, 0.0078, 0.0094], { blend: 0.002 }));
  fo.push(cone(X(ax + 0.0235, 0.0075, 0.03), X(ax + 0.008, 0.0085, 0.039), 0.0018, 0.0018, { sub: true, blend: 0.0012 })); // (the groove under it for peroneus longus)
  const cun = [[ax - 0.0182, 0.0218, 0.0512, [0.0058, 0.0098, 0.0082]], [ax - 0.0082, 0.0258, 0.0492, [0.0052, 0.0072, 0.0068]], [ax + 0.0015, 0.0242, 0.0502, [0.0054, 0.0078, 0.0076]]];
  for (const [x, y, z, r] of cun) fo.push(ellA(X(x, y, z), [0, 1, 0.05], r, 0, { blend: 0.0015 }));
  // ---- metatarsals: base (tall, wedge), shaft (slim, arched), head (round) ----
  const mts = MTS;
  for (const m of mts) {
    const b = m.b, h = m.h, L = (t) => [b[0] + (h[0] - b[0]) * t, b[1] + (h[1] - b[1]) * t + 0.0022 * Math.sin(Math.PI * t), b[2] + (h[2] - b[2]) * t];
    fo.push(sweep([
      { p: X(...L(0)), r: [m.rb * 1.35, m.rb, m.rb * 1.25, m.rb] },
      { p: X(...L(0.12)), r: [m.rb * 1.05, m.rb * 0.85, m.rb * 1.05, m.rb * 0.85] },
      { p: X(...L(0.35)), r: [m.rs, m.rs * 0.95, m.rs, m.rs * 0.95] },
      { p: X(...L(0.7)), r: [m.rs * 1.02, m.rs * 0.95, m.rs, m.rs * 0.95] },
      { p: X(...L(0.92)), r: [m.rh * 0.95, m.rh * 0.9, m.rh, m.rh * 0.9] },
    ], { front: [0, 1, 0], lat: [s, 0, 0], blend: 0.0018, steps: 5, round: m.rb * 0.6 }));
    fo.push(ellA(X(...L(1)), [0, 1, 0.3], [m.rh * 0.98, m.rh * 1.12, m.rh * 1.02], 0, { blend: 0.0015 }));
  }
  // the fifth's knob (tuberosity) sticking out behind and outside: peroneus brevis lands here
  fo.push(cone(X(0.0712, 0.0158, 0.0425), X(0.0782, 0.0128, 0.0362), 0.0042, 0.0032, { blend: 0.003 }));
  // the big toe's two sesamoids, in the tendon of flexor hallucis brevis under the ball
  fo.push(ell(X(0.0222, 0.0042, 0.0975), [0.0026, 0.0024, 0.0034], { blend: 0.001 }));
  fo.push(ell(X(0.0292, 0.0042, 0.0975), [0.0026, 0.0024, 0.0034], { blend: 0.001 }));
  // ---- toes: each bone with a broad base, a waisted shaft and a pulley-shaped head; the end bone
  // with its flat rough tuft under the nail ----
  const toeLen = TOE_LEN;
  for (const [i, m] of mts.entries()) {
    let p = [m.h[0], m.h[1] + 0.0005, m.h[2] + m.rh * 0.95];
    const spread = (i - 1.2) * 0.06;
    for (const [j, l] of toeLen[i].entries()) {
      const pitch = -0.12 - j * 0.12 + (j === 0 ? 0.18 : 0) - (i && j === 1 ? 0.1 : 0);
      const d = [Math.sin(spread), Math.sin(pitch), Math.cos(spread)];
      const dl = Math.hypot(...d), u = d.map((v) => v / dl);
      const q = [p[0] + u[0] * l, p[1] + u[1] * l, p[2] + u[2] * l];
      const rr = m.rh * (0.95 - j * 0.12) * (i ? 1.05 : 1.08);
      const last = j === toeLen[i].length - 1;
      const at = (t) => [p[0] + u[0] * l * t, p[1] + u[1] * l * t, p[2] + u[2] * l * t];
      fo.push(sweep([
        { p: X(...at(0.03)), r: [rr * 1.08, rr * 1.15, rr * 1.02, rr * 1.15] },
        { p: X(...at(0.45)), r: [rr * 0.72, rr * 0.78, rr * 0.7, rr * 0.78] },
        { p: X(...at(0.97)), r: last ? [rr * 0.55, rr * 0.75, rr * 0.5, rr * 0.75] : [rr * 0.85, rr * 0.95, rr * 0.85, rr * 0.95] },
      ], { front: [0, 1, 0], lat: [s, 0, 0], blend: 0.0012, steps: 4, round: rr * 0.45 }));
      p = [q[0] + u[0] * 0.0006, q[1] + u[1] * 0.0006, q[2] + u[2] * 0.0006];
    }
  }
  // ---- cartilage: the talus's dome and head, under the shin's mortise ----
  const cart = [
    ellA(X(ax, ay - 0.0088, 0.0005), [0, 1, 0], [0.0105, 0.0102, 0.0135], 0, { blend: 0.0015 }),
    ellA(X(th[0] - 0.0005, th[1], th[2] + 0.0008), [0.25, 0.25, 1], [0.0076, 0.0062, 0.0085], 0, { blend: 0.0015 }),
  ];
  return { foot: fo, cart };
}

// The hip bone (os coxae) of one side, left side drawn (s = -1 mirrors): three bones grown into
// one. The ilium: the broad thin wing, its thick S-curved crest from the back point (PSIS) round to
// the front point (ASIS), the knob below that (AIIS), the rough ear-shaped face where it meets the
// sacrum. The ischium: down and back from the socket to the sitting bone (ischial tuberosity), with
// its spine reaching in behind. The pubis: forward and in to the joint in the middle (symphysis).
// Between the pubis and ischium the big oval hole (obturator foramen); behind, the two sciatic
// notches. All three meet in the deep cup the femur's ball turns in (acetabulum), which faces out,
// down and a little forward, its rim broken below by a notch.
export function hipBone(s, { acet }) {
  const X = (x, y, z) => [s * x, y, z];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const nrm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
  const ellA = (c, dir, r, roll = 0, o = {}) => ell(c, r, { m: alongDir([s * dir[0], dir[1], dir[2]], roll), blend: 0.0015, ...o });
  const A = [Math.abs(acet[0]), acet[1], acet[2]];
  const hb = [];
  // ---- ilium: the wing as a run of slices along the crest, each slice from the crest down to
  // the thick body above the socket ----
  const crest = [[0.0215, 0.548, -0.044], [0.034, 0.566, -0.0445], [0.05, 0.5745, -0.039], [0.066, 0.578, -0.0285], [0.0795, 0.5765, -0.0135], [0.0882, 0.5705, 0.0035], [0.0905, 0.5605, 0.0195], [0.0862, 0.5465, 0.0325], [0.0832, 0.5385, 0.0365]];
  const low = [[0.0262, 0.5235, -0.0375], [0.034, 0.5175, -0.0335], [0.0435, 0.5125, -0.026], [0.0515, 0.5085, -0.0175], [0.0578, 0.5065, -0.0085], [0.0618, 0.5055, 0.0015], [0.0652, 0.5055, 0.0115], [0.0688, 0.5085, 0.0195], [0.0725, 0.5125, 0.0245]];
  const thick = [0.0058, 0.0046, 0.0032, 0.0026, 0.0024, 0.0024, 0.0026, 0.003, 0.0034];
  for (const l of low) l[1] -= 0.006; // (the slices end inside the thick body over the socket)
  hb.push(sweep(crest.map((c, i) => {
    const l = low[i], m = [(c[0] + l[0]) / 2, (c[1] + l[1]) / 2, (c[2] + l[2]) / 2], d = sub(c, l), h = Math.hypot(...d) / 2;
    return { p: X(...m), r: [thick[i], h, thick[i] * 1.15, h], lat: nrm([s * d[0], d[1], d[2]]) };
  }), { front: [s, 0, -0.3], lat: [0, 1, 0], blend: 0.003, steps: 6, round: 0.0025 }));
  // the crest: a thick rim with an outer lip, swelling at the tubercle of the crest
  const cr = (i) => X(...crest[i]);
  for (let i = 0; i < crest.length - 1; i++) {
    const r0 = i === 4 ? 0.0042 : 0.0034 + (i < 2 ? 0.0012 : 0), r1 = i === 3 ? 0.0042 : 0.0034 + (i < 1 ? 0.0012 : 0);
    hb.push(cone(cr(i), cr(i + 1), r0, r1, { blend: 0.0025 }));
  }
  // ASIS (front point, where sartorius starts and the inguinal ligament holds), the notch below it,
  // and AIIS (rectus femoris); PSIS at the back (the dimples above the buttocks)
  hb.push(ellA(X(0.0838, 0.5375, 0.0372), [0.2, 1, 0.4], [0.0042, 0.0058, 0.0045], 0, { blend: 0.003 }));
  hb.push(ellA(X(0.0742, 0.5175, 0.0285), [0, 1, 0.2], [0.0038, 0.0058, 0.0042], 0, { blend: 0.0045 }));
  hb.push(ellA(X(0.0218, 0.5395, -0.0465), [0, 1, -0.3], [0.0045, 0.0085, 0.0048], 0, { blend: 0.004 }));
  // the thick ear-shaped face against the sacrum (auricular surface) and the rough area above it
  hb.push(ellA(X(0.0262, 0.5285, -0.034), [0, 1, -0.5], [0.0062, 0.0115, 0.0075], 0, { blend: 0.005 }));
  // the body of the ilium above the socket, and the thick bar inside running from the sacrum to the
  // pubis (arcuate line), the rim of the true pelvis
  hb.push(ell(X(A[0] - 0.0025, A[1] + 0.022, A[2] - 0.006), [0.0105, 0.0125, 0.0115], { blend: 0.006 }));
  hb.push(sweep([
    { p: X(0.0255, 0.5175, -0.0315), r: [0.0042, 0.0042, 0.0042, 0.0042] },
    { p: X(0.0395, 0.5015, -0.0165), r: [0.0042, 0.0042, 0.0042, 0.0042] },
    { p: X(0.0485, 0.4935, 0.0045), r: [0.0045, 0.0045, 0.0045, 0.0045] },
    { p: X(0.0455, 0.4885, 0.0235), r: [0.0048, 0.0048, 0.0048, 0.0048] },
  ], { front: [0, 1, 0], lat: [s, 0, 0], blend: 0.005, steps: 6, round: 0.003 }));
  // ---- the socket ----
  const n = nrm([s * 1, -0.62, 0.45]); // (which way the cup opens)
  const Ac = X(...A);
  hb.push(ell([Ac[0] - n[0] * 0.0045, Ac[1] - n[1] * 0.0045, Ac[2] - n[2] * 0.0045], [0.0205, 0.0205, 0.0205], { blend: 0.005 }));
  hb.push(ell(Ac, [0.0152, 0.0152, 0.0152], { sub: true, blend: 0.0012 }));
  hb.push(ell([Ac[0] + n[0] * 0.0205, Ac[1] + n[1] * 0.0205, Ac[2] + n[2] * 0.0205], [0.0185, 0.0185, 0.0185], { sub: true, blend: 0.0028 }));
  // the notch in the rim below (where the transverse ligament bridges it) and the rough pit
  // inside the cup (acetabular fossa) where the round ligament starts
  hb.push(ell([Ac[0] + s * 0.004, Ac[1] - 0.0155, Ac[2] + 0.002], [0.0052, 0.0055, 0.0058], { sub: true, blend: 0.002 }));
  hb.push(ell([Ac[0] - n[0] * 0.012, Ac[1] - n[1] * 0.012 - 0.004, Ac[2] - n[2] * 0.012], [0.0068, 0.0068, 0.0068], { sub: true, blend: 0.002 }));
  // ---- pubis ----
  // superior ramus, triangular, with the sharp pectineal line on top, to the pubic tubercle and the
  // body; the oval face of the symphysis; the inferior ramus down and out to meet the ischium's
  hb.push(sweep([
    { p: X(0.0548, 0.4885, 0.0262), r: [0.0068, 0.0062, 0.0066, 0.0062], h: [0.0012] },
    { p: X(0.0395, 0.4805, 0.0378), r: [0.0052, 0.0048, 0.0052, 0.0048], h: [0.0012] },
    { p: X(0.0225, 0.4745, 0.0448), r: [0.0052, 0.0048, 0.0052, 0.0048], h: [0.0008] },
    { p: X(0.0105, 0.4692, 0.0462), r: [0.0058, 0.0062, 0.0058, 0.006], h: [0] },
  ], { front: [0, 1, 0], lat: [0, 0, 1], ridges: [{ a: -0.4, w: 0.35 }], blend: 0.0035, steps: 6, round: 0.003 }));
  hb.push(ell(X(0.0208, 0.4765, 0.0498), [0.0028, 0.0028, 0.0028], { blend: 0.002 }));
  hb.push(ellA(X(0.0068, 0.4625, 0.0448), [0, 1, -0.15], [0.0042, 0.0118, 0.0068], 0, { blend: 0.004 }));
  hb.push(sweep([
    { p: X(0.0085, 0.4555, 0.0425), r: [0.0028, 0.0052, 0.0028, 0.0052] },
    { p: X(0.0168, 0.4445, 0.0322), r: [0.0026, 0.0048, 0.0026, 0.0048] },
    { p: X(0.0262, 0.4362, 0.0152), r: [0.0028, 0.0052, 0.0028, 0.0052] },
  ], { front: [s, 0, 0], lat: [0, 1, 0], blend: 0.003, steps: 5, round: 0.0022 }));
  // ---- ischium ----
  // its body from the socket down and back, the sitting bone (big rough knob, hamstrings and
  // adductor magnus start here), the spine reaching in behind (between the two sciatic notches),
  // and the ramus forward to meet the pubis's
  hb.push(sweep([
    { p: X(A[0] - 0.003, A[1] - 0.008, A[2] - 0.0135), r: [0.0078, 0.0075, 0.0078, 0.0072] },
    { p: X(A[0] - 0.0075, A[1] - 0.0255, A[2] - 0.0218), r: [0.0062, 0.0062, 0.0062, 0.0058] },
    { p: X(A[0] - 0.0125, A[1] - 0.0385, A[2] - 0.0232), r: [0.0072, 0.0074, 0.0078, 0.0068] },
  ], { front: [0, 0, 1], lat: [s, 0, 0], blend: 0.004, steps: 6, round: 0.004 }));
  hb.push(ellA(X(A[0] - 0.0115, A[1] - 0.0405, A[2] - 0.0245), [0.1, 1, -0.6], [0.0082, 0.0108, 0.0078], 0, { blend: 0.004 }));
  hb.push(cone(X(A[0] - 0.0125, A[1] - 0.0115, A[2] - 0.0255), X(A[0] - 0.0225, A[1] - 0.0135, A[2] - 0.0305), 0.0036, 0.0016, { blend: 0.003 }));
  hb.push(sweep([
    { p: X(A[0] - 0.0195, A[1] - 0.0455, A[2] - 0.0175), r: [0.0032, 0.0055, 0.0032, 0.0055] },
    { p: X(A[0] - 0.0315, A[1] - 0.0445, A[2] - 0.0025), r: [0.0028, 0.0052, 0.0028, 0.0052] },
    { p: X(0.0262, 0.4362, 0.0152), r: [0.0028, 0.0052, 0.0028, 0.0052] },
  ], { front: [s, 0, 0], lat: [0, 1, 0], blend: 0.003, steps: 5, round: 0.0022 }));
  // ---- the socket's cartilage: a horseshoe-shaped shell lining the cup (open below, at the pit) ----
  const cart = [
    ell(Ac, [0.0153, 0.0153, 0.0153], { blend: 0.001 }),
    ell(Ac, [0.0146, 0.0146, 0.0146], { sub: true, blend: 0.0006 }),
    ell([Ac[0] + n[0] * 0.0205, Ac[1] + n[1] * 0.0205, Ac[2] + n[2] * 0.0205], [0.0182, 0.0182, 0.0182], { sub: true, blend: 0.002 }),
    ell([Ac[0] - n[0] * 0.012, Ac[1] - n[1] * 0.012 - 0.004, Ac[2] - n[2] * 0.012], [0.0078, 0.0078, 0.0078], { sub: true, blend: 0.0015 }),
  ];
  return { bone: hb, cart };
}
