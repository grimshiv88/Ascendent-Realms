// Moving a sculpted body (build.js): poses for the whole body and for each hand, arms that reach for
// a point (two-bone IK: the shoulder and elbow work out how to put the hand there), and easing.
// Every bone's rest (rotation 0) is standing straight, arms hanging, palms to the thighs, fingers
// straight and together. Signs, for a bone at rest: rotation x < 0 swings a limb forward (an arm up
// in front, a thigh forward), x > 0 bends a knee back or leans the spine forward; for the forearm,
// x < 0 bends the elbow.
import * as THREE from 'three';

const FINGERS = ['Index', 'Middle', 'Ring', 'Little'];
const SEGS = ['Proximal', 'Intermediate', 'Distal'];
const FAN = { Index: -1, Middle: -0.3, Ring: 0.35, Little: 1 }; // which way each finger spreads (front -)
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

// ---- hands ----
// curl: each finger 0 (straight) .. 1 (fully curled); spread: radians apart; thumb: [across the palm
// 0..1, bend 0..1]; stretch: the knuckles bend back a little (a hand spread wide)
// thumbTo: where the thumb's tip goes, found on the fingers once they are bent: points along
// finger segments [finger, segment, how far along], averaged; out: how far in front of them; dir:
// the way the tip lies (from one finger towards another)
export const HANDS = {
  rest: { curl: [0.12, 0.16, 0.2, 0.25], spread: 0.03, thumb: [0.3, 0.15] },
  relaxed: { curl: [0.26, 0.32, 0.38, 0.45], spread: 0.05, thumb: [0.4, 0.25], thumbTo: { at: [['Index', 'Intermediate', 0.15]], out: 0.02, dir: ['Index', 'Ring'] } },
  open: { curl: [0, 0, 0, 0], spread: 0.16, thumb: [0, 0], stretch: 1 },
  flat: { curl: [0, 0, 0, 0], spread: 0.0, thumb: [0.15, 0] },
  fist: { curl: [1, 1, 1, 1], spread: 0, thumb: [0.9, 0.7], thumbTo: { at: [['Index', 'Intermediate', 0.6], ['Middle', 'Intermediate', 0.35]], out: 0.011, dir: ['Index', 'Middle'] } },
  // round a grip (a sword's hilt, a door's handle): the fingers wrap, the thumb closes over them
  grip: { curl: [0.72, 0.76, 0.8, 0.85], spread: 0, thumb: [0.8, 0.5], thumbTo: { at: [['Index', 'Intermediate', 0.45], ['Middle', 'Intermediate', 0.1]], out: 0.012, dir: ['Index', 'Middle'] } },
  // loosely closed, for running
  runHand: { curl: [0.5, 0.56, 0.62, 0.68], spread: 0, thumb: [0.6, 0.35] },
  // half open, about to take hold of something
  reach: { curl: [0.22, 0.25, 0.28, 0.32], spread: 0.1, thumb: [0.2, 0.05] },
  point: { curl: [0, 1, 1, 1], spread: 0, thumb: [0.9, 0.7], thumbTo: { at: [['Middle', 'Intermediate', 0.55]], out: 0.011, dir: ['Middle', 'Ring'] } },
  pinch: { curl: [0.5, 0.45, 0.55, 0.62], spread: 0.04, thumb: [0.7, 0.3], thumbTo: { at: [['Index', 'Distal', 0.75]], out: 0.004, dir: ['Index', 'Middle'] } },
};
// how far each joint of a finger bends at full curl (knuckle, middle, last)
const BEND = [1.45, 1.65, 1.05];

// The rotations of one hand's finger bones for a hand pose (a name from HANDS, or a pose object)
export function handPose(side, spec, out = {}) {
  const H = typeof spec === 'string' ? HANDS[spec] : spec;
  const s = side === 'left' ? 1 : -1;
  FINGERS.forEach((f, i) => {
    const c = H.curl[i];
    SEGS.forEach((seg, j) => {
      // knuckles straighten a hair past flat when the hand is stretched open
      const a = c * BEND[j] - (H.stretch && j < 2 ? 0.08 : 0);
      const q = new THREE.Quaternion().setFromAxisAngle(Z, -s * a);
      if (j === 0) q.premultiply(new THREE.Quaternion().setFromAxisAngle(X, FAN[f] * H.spread));
      out[`${side}${f}${seg}`] = q;
    });
  });
  // the thumb: it swings across in front of the palm, then its two joints fold towards the palm
  const [across, bend] = H.thumb;
  const tdir = new THREE.Vector3(-s * 0.32, -0.86, 0.4).normalize();
  const palm = new THREE.Vector3(-s, 0, 0);
  const fold = new THREE.Vector3().crossVectors(tdir, palm).normalize();
  out[`${side}ThumbMetacarpal`] = new THREE.Quaternion().setFromAxisAngle(Y, -s * across * 0.75)
    .multiply(new THREE.Quaternion().setFromAxisAngle(fold, across * 0.35));
  out[`${side}ThumbProximal`] = new THREE.Quaternion().setFromAxisAngle(fold, bend * 0.7);
  out[`${side}ThumbDistal`] = new THREE.Quaternion().setFromAxisAngle(fold, bend * 0.9);
  return out;
}

// ---- whole-body poses ----
// A pose: { boneName: [x, y, z] (radians) or a Quaternion }, plus optional `move: [x, y, z]` (how
// far the hips move from where they stand, in metres) and `hands: { left, right }` (hand poses).
export function poseOf(spec = {}) {
  const out = { q: {}, hips: spec.move ? new THREE.Vector3(...spec.move) : new THREE.Vector3(), hands: {} };
  for (const [k, v] of Object.entries(spec)) {
    if (k === 'move' || k === 'hands') continue;
    out.q[k] = v.isQuaternion ? v.clone() : new THREE.Quaternion().setFromEuler(new THREE.Euler(...v));
  }
  for (const [side, h] of Object.entries(spec.hands || {})) {
    handPose(side, h, out.q);
    out.hands[side] = [[typeof h === 'string' ? HANDS[h] : h, 1]];
  }
  return out;
}
// a blend of two poses (t: 0 is a, 1 is b)
export function mixPose(a, b, t) {
  const out = { q: {}, hips: a.hips.clone().lerp(b.hips, t), hands: {} };
  const I = new THREE.Quaternion();
  for (const k of new Set([...Object.keys(a.q), ...Object.keys(b.q)])) out.q[k] = (a.q[k] || I).clone().slerp(b.q[k] || I, t);
  // the hands' thumb targets are blended too (see placeThumb)
  for (const side of ['left', 'right']) {
    const list = [...(a.hands?.[side] || [[null, 1]]).map(([h, w]) => [h, w * (1 - t)]), ...(b.hands?.[side] || [[null, 1]]).map(([h, w]) => [h, w * t])];
    if (list.some(([h, w]) => h?.thumbTo && w > 0)) out.hands[side] = list;
  }
  return out;
}
// layer b on top of a: b's rotations are added to a's (for breathing, a nod, a lean)
export function addPose(a, b, w = 1) {
  const out = { q: { ...a.q }, hips: a.hips.clone().addScaledVector(b.hips, w), hands: a.hands };
  const I = new THREE.Quaternion();
  for (const [k, q] of Object.entries(b.q)) out.q[k] = (a.q[k] || I).clone().multiply(I.clone().slerp(q, w));
  return out;
}
// put a body in a pose (bones the pose leaves out go back to rest)
export function applyPose(body, pose) {
  for (const [name, bone] of Object.entries(body.bones)) {
    const q = pose.q[name];
    if (q) bone.quaternion.copy(q); else bone.quaternion.identity();
  }
  const hips = body.bones.hips;
  if (!hips.userData.rest) hips.userData.rest = hips.position.clone();
  hips.position.copy(hips.userData.rest).addScaledVector(pose.hips, 1 / body.scale);
  body.root.updateMatrixWorld(true);
  for (const [side, list] of Object.entries(pose.hands || {})) if (list) placeThumb(body, side, list);
}

// The thumb, once the fingers are bent: its tip laid where the hand pose says (over the curled
// fingers of a fist, against the index's tip in a pinch), its joints bending to get there
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
function jointAt(body, side, finger, seg, t) {
  const b = body.bones[`${side}${finger}${seg}`];
  const p = b.getWorldPosition(new THREE.Vector3());
  let next;
  if (seg === 'Distal') {
    const prev = body.bones[`${side}${finger}Intermediate`].getWorldPosition(_v);
    next = p.clone().add(new THREE.Vector3(0, -1, 0).applyQuaternion(worldQuat(b)).multiplyScalar(p.distanceTo(prev) * 0.85));
  } else next = body.bones[`${side}${finger}${SEGS[SEGS.indexOf(seg) + 1]}`].getWorldPosition(new THREE.Vector3());
  return p.lerp(next, t);
}
function thumbTip(body, side) {
  const d = body.bones[`${side}ThumbDistal`], pr = body.bones[`${side}ThumbProximal`];
  const p = d.getWorldPosition(new THREE.Vector3());
  const len = p.distanceTo(pr.getWorldPosition(_v)) * 0.8;
  const s = side === 'left' ? 1 : -1;
  const dir = new THREE.Vector3(-s * 0.32, -0.86, 0.4).normalize().applyQuaternion(worldQuat(d));
  return { tip: p.clone().addScaledVector(dir, len), dir, len };
}
function placeThumb(body, side, list) {
  const now = thumbTip(body, side);
  const hand = body.bones[`${side}Hand`];
  // the middle of the palm, to tell "in front of the fingers" from "behind"
  const palm = jointAt(body, side, 'Middle', 'Proximal', 0).lerp(hand.getWorldPosition(_w), 0.45);
  const target = new THREE.Vector3(), dir = new THREE.Vector3();
  let total = 0;
  for (const [H, w] of list) {
    if (w <= 0) continue;
    total += w;
    if (!H?.thumbTo) { target.addScaledVector(now.tip, w); dir.addScaledVector(now.dir, w); continue; }
    const T = H.thumbTo;
    const p = new THREE.Vector3();
    for (const [f, seg, t] of T.at) p.add(jointAt(body, side, f, seg, t));
    p.multiplyScalar(1 / T.at.length);
    p.addScaledVector(p.clone().sub(palm).normalize(), T.out);
    const d = jointAt(body, side, T.dir[1], 'Intermediate', 0.5).sub(jointAt(body, side, T.dir[0], 'Intermediate', 0.5)).normalize();
    target.addScaledVector(p, w); dir.addScaledVector(d, w);
  }
  if (!total) return;
  target.multiplyScalar(1 / total); dir.normalize();
  // the last joint sits a tip's length back from the target; the first two bones reach it
  const joint = target.clone().addScaledVector(dir, -now.len);
  reach(body, side, joint, { upper: 'ThumbMetacarpal', lower: 'ThumbProximal', end: 'ThumbDistal' });
  const t2 = thumbTip(body, side);
  turnWorld(body.bones[`${side}ThumbDistal`], new THREE.Quaternion().setFromUnitVectors(t2.dir, target.clone().sub(t2.tip.clone().addScaledVector(t2.dir, -t2.len)).normalize()));
}

// ---- reaching ----
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion();
const worldQuat = (o, q = new THREE.Quaternion()) => o.getWorldQuaternion(q);
// turn `bone` (in world space) by the world rotation r
function turnWorld(bone, r) {
  const g = worldQuat(bone);
  const parent = worldQuat(bone.parent, _pq);
  bone.quaternion.copy(parent.invert().multiply(r.multiply(g)));
  bone.updateMatrixWorld(true);
}
// Two-bone IK: move the upper and lower bones so that `end` (a child of lower) is at `target`
// (world), the middle joint bending towards `pole` (world). hand: a world rotation for the end bone.
export function reach(body, side, target, { pole = null, hand = null, upper = 'UpperArm', lower = 'LowerArm', end = 'Hand' } = {}) {
  const U = body.bones[side + upper], L = body.bones[side + lower], E = body.bones[side + end];
  U.getWorldPosition(_a); L.getWorldPosition(_b); E.getWorldPosition(_c);
  const lab = _a.distanceTo(_b), lbc = _b.distanceTo(_c);
  const toT = new THREE.Vector3().subVectors(target, _a);
  const dist = Math.min(Math.max(toT.length(), Math.abs(lab - lbc) + 1e-4), lab + lbc - 1e-4);
  const dir = toT.normalize();
  // where the elbow (or knee) should be: on the circle the two lengths allow, nearest the pole
  const cosA = (lab * lab + dist * dist - lbc * lbc) / (2 * lab * dist);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const p = pole ? new THREE.Vector3().subVectors(pole, _a) : new THREE.Vector3().subVectors(_b, _a);
  const bendDir = p.addScaledVector(dir, -p.dot(dir));
  if (bendDir.lengthSq() < 1e-8) bendDir.set(0, 0, -1);
  bendDir.normalize();
  const mid = new THREE.Vector3().copy(_a).addScaledVector(dir, lab * cosA).addScaledVector(bendDir, lab * sinA);
  // aim the upper bone at the elbow, then the lower at the target
  turnWorld(U, _q.setFromUnitVectors(_b.clone().sub(_a).normalize(), mid.clone().sub(_a).normalize()));
  L.getWorldPosition(_b); E.getWorldPosition(_c);
  const goal = _a.clone().addScaledVector(dir, dist);
  turnWorld(L, _q.setFromUnitVectors(_c.clone().sub(_b).normalize(), goal.sub(_b).normalize()));
  if (hand) {
    // the end bone takes the given world rotation; part of its twist is shared with the forearm, as
    // a real forearm turns (so the wrist never wrings)
    const lw = worldQuat(L);
    const local = lw.clone().invert().multiply(hand);
    const axis = new THREE.Vector3(0, -1, 0);
    const twist = twistAbout(local, axis);
    const share = new THREE.Quaternion().slerp(twist, 0.6);
    L.quaternion.multiply(share);
    L.updateMatrixWorld(true);
    E.quaternion.copy(worldQuat(L).invert().multiply(hand));
    E.updateMatrixWorld(true);
  }
}
// the part of rotation q that turns about `axis`
function twistAbout(q, axis) {
  const r = new THREE.Vector3(q.x, q.y, q.z);
  const p = axis.clone().multiplyScalar(r.dot(axis));
  const t = new THREE.Quaternion(p.x, p.y, p.z, q.w);
  if (t.lengthSq() < 1e-10) return new THREE.Quaternion();
  return t.normalize();
}

// ---- timing ----
export const ease = {
  linear: (t) => t,
  inOut: (t) => t * t * (3 - 2 * t),
  out: (t) => 1 - (1 - t) * (1 - t),
  in: (t) => t * t,
  // overshoots a little and settles, like a hand snapping shut
  snap: (t) => { const s = 1.6; t -= 1; return t * t * ((s + 1) * t + s) + 1; },
};
export const clamp01 = (t) => Math.min(1, Math.max(0, t));
// how far through the stretch from t0 to t1 time t is (0 before, 1 after), eased
export const phase = (t, t0, t1, e = ease.inOut) => e(clamp01((t - t0) / (t1 - t0)));
// Keyframes: [[time, value], ...] where a value is a number, a Vector3 or a pose; returns the value
// at time t, eased between keys
export function track(keys, t, e = ease.inOut) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, a] = keys[i - 1], [t1, b] = keys[i];
      const k = e((t - t0) / (t1 - t0));
      if (typeof a === 'number') return a + (b - a) * k;
      if (a.isVector3) return a.clone().lerp(b, k);
      if (a.isQuaternion) return a.clone().slerp(b, k);
      return mixPose(a, b, k);
    }
  }
  return keys[keys.length - 1][1];
}

// ---- holding things ----
// Where a hand must be, and how turned, to hold a bar (a hilt, a handle) running along `axis`
// through `at` (world), the palm facing `palm` (roughly; it is squared to the bar). The thumb's
// side of the fist points along `axis`. Returns { pos, quat } for the hand bone, for reach().
// radius: the bar's (with it, the hand sits where a grip fitted to that bar rings round it; see fitGrip)
export function gripHold(body, side, at, axis, palm, radius = 0) {
  const s = side === 'left' ? 1 : -1;
  const Zw = axis.clone().normalize();                      // the hand's z: thumb side, along the bar
  const P = palm.clone().addScaledVector(Zw, -palm.dot(Zw)).normalize(); // the palm's facing
  const Xw = P.clone().multiplyScalar(-s);                  // the hand's x: the back of the hand (+s), palm is -s
  const Yw = new THREE.Vector3().crossVectors(Zw, Xw);      // y = z × x
  const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(Xw, Yw, Zw));
  // the bar lies across the curled fingers, in front of the palm and down by the middle knuckles
  const k = body.scale;
  const off = (radius ? fitGrip(body, side, radius).centre.clone() : new THREE.Vector3(-s * 0.026, -0.078, 0.004)).multiplyScalar(k).applyQuaternion(quat);
  return { pos: at.clone().sub(off), quat };
}

// A grip that fits a bar of radius `radius` (metres, in the world): the fingers curl just as far as
// it takes to close round it, and the bar's middle is where the curled fingers ring round. Found
// by trying the curl on the body's own hand (each race's fingers are their own length). Returns
// { spec (a hand pose), centre (the bar's middle, in the hand bone's own space) }.
export function fitGrip(body, side, radius) {
  const key = `${side}:${radius.toFixed(4)}`;
  body._grips ||= {};
  if (body._grips[key]) return body._grips[key];
  const hand = body.bones[`${side}Hand`];
  const names = Object.keys(handPose(side, 'grip'));
  const saved = names.map((n) => body.bones[n].quaternion.clone());
  const inv = new THREE.Matrix4();
  const local = (name, t = 0) => {
    const b = body.bones[name];
    const p = b.getWorldPosition(new THREE.Vector3());
    if (t) {
      // past the last joint: the fingertip, a little shorter than the bone before it
      const prev = body.bones[name.replace('Distal', 'Intermediate')].getWorldPosition(new THREE.Vector3());
      p.add(new THREE.Vector3(0, -1, 0).applyQuaternion(b.getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(p.distanceTo(prev) * t));
    }
    return p.applyMatrix4(inv);
  };
  const scale = hand.getWorldScale(new THREE.Vector3()).x;
  const r = radius / scale, fingerR = 0.0085;
  const G = HANDS.grip;
  const measure = (f) => {
    const spec = { ...G, curl: G.curl.map((c) => c * f) };
    const q = handPose(side, spec);
    for (const n of names) body.bones[n].quaternion.copy(q[n]);
    hand.updateMatrixWorld(true);
    inv.copy(hand.matrixWorld).invert();
    // the ring the middle and ring fingers make: the circle through knuckle, middle joint and tip
    const ring = ['Middle', 'Ring'].map((F) => circle(local(`${side}${F}Proximal`), local(`${side}${F}Intermediate`), local(`${side}${F}Distal`, 0.85)));
    const centre = ring[0].c.clone().lerp(ring[1].c, 0.5);
    const inner = (ring[0].r + ring[1].r) / 2 - fingerR;
    return { spec, centre, inner };
  };
  // more curl, a smaller ring: find the curl whose ring just holds the bar
  let lo = 0.55, hi = 1.25, best = measure(1);
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2, m = measure(mid);
    best = m;
    if (m.inner > r) lo = mid; else hi = mid;
  }
  names.forEach((n, i) => body.bones[n].quaternion.copy(saved[i]));
  hand.updateMatrixWorld(true);
  return (body._grips[key] = { spec: best.spec, centre: best.centre });
}
// the circle through three points: its middle and radius
function circle(a, b, c) {
  const ab = b.clone().sub(a), ac = c.clone().sub(a);
  const n = new THREE.Vector3().crossVectors(ab, ac);
  const d = 2 * n.lengthSq();
  if (d < 1e-12) return { c: a.clone().lerp(c, 0.5), r: a.distanceTo(c) / 2 };
  const o = new THREE.Vector3().crossVectors(n, ab).multiplyScalar(ac.lengthSq())
    .add(new THREE.Vector3().crossVectors(ac, n).multiplyScalar(ab.lengthSq())).multiplyScalar(1 / d);
  return { c: a.clone().add(o), r: o.length() };
}
