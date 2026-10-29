// Standing, walking and running for the sculpted bodies: a breathing idle, a walk and a run, as
// whole-body poses (see motion.js). Each stride is worked out joint by joint as a person moves: the
// heel lands with the leg reaching forward, the knee gives a little as the weight comes on, the leg
// passes under the body, the heel lifts and the toes push off, then the knee folds high as the foot
// swings through. The hips are set at the height that keeps the standing foot on the ground, so feet
// never sink or float; they also sway, tilt and turn with each step, and the shoulders and arms
// turn against them.
import { poseOf, mixPose } from './motion.js';

const TAU = Math.PI * 2;
// a smooth bump around time c (of a cycle 0..1, wrapping round), w wide
const bump = (p, c, w) => { let d = p - c; d -= Math.round(d); return Math.exp(-(d * d) / (2 * w * w)); };
const wrap = (p) => p - Math.floor(p);

// how each gait moves. stance: the part of a stride a foot is on the ground; reach / push: how far
// the thigh swings forward and back (radians); lift: the knee's bend as the foot swings through
const GAITS = {
  walk: { stance: 0.6, reach: 0.38, push: 0.24, load: 0.16, lift: 0.95, toe: 0.32, lean: 0.03, bob: 0.018, sway: 0.022, turn: 0.07, tilt: 0.045, arms: 0.32, elbow: 0.22, elbowSwing: 0.18, hand: 0.35 },
  run: { stance: 0.38, reach: 0.62, push: 0.42, load: 0.42, lift: 1.75, toe: 0.45, lean: 0.17, bob: 0.045, sway: 0.012, turn: 0.13, tilt: 0.06, arms: 0.62, elbow: 1.35, elbowSwing: 0.3, hand: 0.62 },
};

// The pose of one leg at stride phase p (0 = heel down): [thigh, knee, foot] bend about x
function leg(G, p) {
  // stance and swing take different shares of the stride: warp so the thigh's swing is a smooth wave
  const s = G.stance;
  const q = p < s ? (p / s) * 0.5 : 0.5 + ((p - s) / (1 - s)) * 0.5;
  const thigh = -(G.reach - G.push) / 2 - ((G.reach + G.push) / 2) * Math.cos(TAU * q);
  // the knee: a give as the weight lands, nearly straight under the body, then folding up through
  // the swing and reaching out straight again before the heel lands
  const knee = 0.04 + G.load * bump(p, 0.12 * s / 0.6, 0.06) + G.lift * bump(p, s + (1 - s) * 0.32, 0.12 * (1 - s) / 0.4);
  // the foot stays flat on the ground while it stands, rolls onto the toes to push off, and lifts its
  // toes to clear the ground as it swings
  const flat = -(thigh + knee);
  const roll = G.toe * bump(p, s - 0.02, 0.06) - 0.3 * bump(p, s + (1 - s) * 0.5, 0.14) - 0.1 * bump(p, 0, 0.04);
  const onGround = p < s ? 1 : 0;
  return [thigh, knee, flat * (onGround ? 1 : 0.55) + roll];
}

// how far below the hip the foot's sole is, for a leg bent [thigh, knee, foot]: the lower of the
// heel and the ball of the foot
function drop(L, [a, k, f]) {
  const ankle = L.thigh * Math.cos(a) + L.shin * Math.cos(a + k);
  const g = a + k + f; // the foot's pitch (toes down +)
  return ankle + L.ankle * Math.cos(g) + Math.max(L.foot * Math.sin(g), -L.heel * Math.sin(g));
}
function lengths(body) {
  if (body._legs) return body._legs;
  const P = Object.fromEntries(body.plan.bones.map((b) => [b.name, b.pos]));
  const d = (a, b) => Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1], P[a][2] - P[b][2]);
  const k = body.scale;
  body._legs = { thigh: d('leftUpperLeg', 'leftLowerLeg') * k, shin: d('leftLowerLeg', 'leftFoot') * k, ankle: P.leftFoot[1] * k, foot: (P.leftToes[2] - P.leftFoot[2]) * k, heel: 0.04 * k };
  return body._legs;
}

// The body's pose at stride phase `phase` (0..1, one full stride: both feet) for a speed: 0 standing,
// 1 walking, 2 running (and anything between). t: the time, for breathing.
export function gaitPose(body, phase, speed, t = 0) {
  const L = lengths(body);
  const still = idlePose(body, t);
  if (speed <= 0.02) return still;
  const walk = stridePose(body, L, GAITS.walk, phase, t);
  if (speed <= 1) return mixPose(still, walk, Math.min(1, speed * 1.4));
  const run = stridePose(body, L, GAITS.run, phase, t);
  return mixPose(walk, run, Math.min(1, speed - 1));
}

// one stride of a gait
function stridePose(body, L, G, phase, t) {
  const pl = wrap(phase), pr = wrap(phase + 0.5);
  const l = leg(G, pl), r = leg(G, pr);
  // the hips sit as high as the standing leg allows, so the foot on the ground stays on it
  const stand = L.thigh + L.shin + L.ankle;
  const lowest = Math.max(drop(L, l), drop(L, r));
  const y = lowest - stand;
  // hips sway over the standing foot, the free side dips, and they turn with the leg that swings
  const side = Math.sin(TAU * pl);
  const swing = Math.cos(TAU * (pl - 0.1));
  const breathe = Math.sin(t * 1.6) * 0.012;
  const spec = {
    move: [G.sway * side, y, 0],
    hips: [G.lean * 0.5, G.turn * swing, -G.tilt * side],
    spine: [G.lean * 0.3 + breathe * 0.3, -G.turn * swing * 0.45, G.tilt * side * 0.5],
    chest: [G.lean * 0.25 + breathe, -G.turn * swing * 0.45, G.tilt * side * 0.4],
    upperChest: [-breathe * 0.5, -G.turn * swing * 0.25, 0],
    neck: [-G.lean * 0.4, 0, 0],
    head: [-G.lean * 0.3 + 0.02 * Math.sin(TAU * pl * 2), G.turn * swing * 0.2, G.tilt * side * 0.15],
    leftUpperLeg: [l[0], 0, 0], leftLowerLeg: [l[1], 0, 0], leftFoot: [l[2], 0, 0], leftToes: [-0.4 * bump(pl, G.stance - 0.04, 0.05), 0, 0],
    rightUpperLeg: [r[0], 0, 0], rightLowerLeg: [r[1], 0, 0], rightFoot: [r[2], 0, 0], rightToes: [-0.4 * bump(pr, G.stance - 0.04, 0.05), 0, 0],
    hands: { left: G.hand > 0.5 ? 'runHand' : 'relaxed', right: G.hand > 0.5 ? 'runHand' : 'relaxed' },
  };
  // arms swing against the legs: the left arm forward as the right leg goes forward
  for (const [side2, other] of [['left', r], ['right', l]]) {
    const s = side2 === 'left' ? 1 : -1;
    const arm = other[0] * (G.arms / ((G.reach + G.push) / 2)) * 0.9 + 0.04; // forward is -
    spec[`${side2}UpperArm`] = [arm, 0, s * (0.07 + G.lean * 0.3)];
    spec[`${side2}LowerArm`] = [-(G.elbow + G.elbowSwing * Math.max(0, -arm) / G.arms), s * -0.1, 0];
    spec[`${side2}Hand`] = [0.05, s * 0.15, 0];
    spec[`${side2}Shoulder`] = [0, 0, s * 0.03 * -arm];
  }
  return poseOf(spec);
}

// Standing still: breathing in and out, the weight drifting a little from foot to foot, hands loose
export function idlePose(body, t = 0) {
  const b = Math.sin(t * 1.55);          // a breath every four seconds or so
  const drift = Math.sin(t * 0.37) * 0.6 + Math.sin(t * 0.23 + 1) * 0.4;
  return poseOf({
    move: [0.008 * drift, -0.004 - 0.002 * b, 0],
    hips: [0, 0.015 * drift, 0.012 * drift],
    spine: [0.01, -0.01 * drift, -0.008 * drift],
    chest: [-0.012 * b, 0, -0.004 * drift],
    upperChest: [-0.01 * b, 0, 0],
    neck: [0.01 * b, 0, 0],
    head: [0.02 + 0.01 * Math.sin(t * 0.5), 0.03 * Math.sin(t * 0.21), 0],
    leftShoulder: [0, 0, 0.012 * (b + 1)], rightShoulder: [0, 0, -0.012 * (b + 1)],
    leftUpperArm: [0.02, 0, 0.07 + 0.01 * b], rightUpperArm: [0.02, 0, -0.07 - 0.01 * b],
    leftLowerArm: [-0.14, -0.1, 0], rightLowerArm: [-0.14, 0.1, 0],
    leftHand: [0.03, 0.1, 0], rightHand: [0.03, -0.1, 0],
    leftUpperLeg: [0, 0, 0.015 - 0.012 * drift], rightUpperLeg: [0, 0, -0.015 - 0.012 * drift],
    leftFoot: [0, 0, -0.015 + 0.012 * drift], rightFoot: [0, 0, 0.015 + 0.012 * drift],
    hands: { left: 'rest', right: 'rest' },
  });
}
