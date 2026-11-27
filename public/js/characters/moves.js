// Melee combos and swimming for the jointed bodies (anatomy.js rigs: arms with shoulder/elbow,
// legs with hip/knee/ankle, a spine, hips and a head).
//
// Combos: clicking again soon after a hit chains into the next swing of the combo.
//   hit 1: Overhead Cut (drawn in world.js), hit 2: Cross Cut (a flat sweep, catches more foes),
//   hit 3: Piercing Lunge (a step and a thrust, the hardest hit). Then it starts again.
//   Bare hands: Jab, Cross (the other fist), Uppercut.
// Swimming: moving through deep water is a front crawl (lying in the water, arms over and under,
// legs kicking); staying still you tread water upright, arms sculling and legs circling.
import * as THREE from 'three';

const L = THREE.MathUtils.lerp;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
// 0 -> 1 between a and b
const seg = (k, a, b) => ease((k - a) / (b - a));

export const COMBO_WINDOW = 0.7; // seconds after a swing ends that the next click still chains
export const COMBOS = {
  blade: [
    null,
    { name: 'Overhead Cut', mult: 1, time: 1 },
    { name: 'Cross Cut', mult: 1.15, time: 1, arc: 1.5, hits: 1 },
    { name: 'Piercing Lunge', mult: 1.45, time: 1.25, reach: 1.3 },
  ],
  fist: [
    null,
    { name: 'Jab', mult: 1, time: 1 },
    { name: 'Cross', mult: 1.15, time: 1 },
    { name: 'Uppercut', mult: 1.45, time: 1.2, reach: 1.1 },
  ],
};

// mix a joint's angle from where the walk left it towards `to` by weight w
const mix = (rot, axis, to, w) => { rot[axis] = L(rot[axis], to, w); };

// The second and third hits of a combo; `k` runs 0 -> 1 through the swing, `ready` is the weapon
// arm's [shoulder, elbow] at rest. (The first hit is the plain swing in world.js.)
export function poseCombo(rig, step, k, armed, ready = [0, -0.3]) {
  const arm = rig.arms?.[0], off = rig.arms?.[1];
  const H = rig.root.userData.height || 1.7;
  if (!arm) { rig.root.position.z = Math.sin(clamp01(k) * Math.PI) * H * (step === 3 ? 0.35 : 0.25); return; }
  const legF = rig.legs?.find((l) => l.side > 0), legB = rig.legs?.find((l) => l.side < 0); // left leg leads
  if (armed && step === 2) {
    // Cross Cut: wind the blade out to the right, then sweep it flat across in front, ending on the left
    const wind = seg(k, 0, 0.3), cut = seg(k, 0.3, 0.62), back = seg(k, 0.72, 1);
    const on = wind * (1 - back);
    const twist = L(L(0, -0.95, wind), 0.95, cut);
    if (rig.spine) rig.spine.rotation.y = twist * (1 - back);
    arm.shoulder.rotation.x = L(L(ready[0], -0.75, wind), -0.95, cut) * (1 - back) + ready[0] * back;
    arm.shoulder.rotation.z = L(L(arm.shoulder.rotation.z, arm.side * 0.75, wind), -arm.side * 0.4, cut) * (1 - back) + arm.shoulder.rotation.z * back;
    arm.elbow.rotation.x = L(L(ready[1], -0.95, wind), -0.55, cut) * (1 - back) + ready[1] * back;
    if (off) { mix(off.shoulder.rotation, 'x', -0.6, on); mix(off.shoulder.rotation, 'z', off.side * 0.5, on); mix(off.elbow.rotation, 'x', -1.1, on); }
    // feet set wide, knees soft
    for (const l of rig.legs || []) { mix(l.hip.rotation, 'z', l.side * 0.12, on); mix(l.knee.rotation, 'x', 0.35, on); mix(l.hip.rotation, 'x', -0.2, on); }
    if (rig.hips) rig.hips.position.y -= H * 0.025 * on;
    return;
  }
  if (armed && step === 3) {
    // Piercing Lunge: draw the blade back to the hip, step in hard on the left foot, drive it straight ahead
    const draw = seg(k, 0, 0.3), go = seg(k, 0.3, 0.5), back = seg(k, 0.68, 1);
    const lunge = go * (1 - back), on = Math.max(draw, go) * (1 - back);
    if (rig.spine) {
      rig.spine.rotation.y = L(L(0, -0.55, draw), 0.3, go) * (1 - back);
      rig.spine.rotation.x += 0.28 * lunge;
    }
    arm.shoulder.rotation.x = L(L(ready[0], 0.3, draw), -1.5, go) * (1 - back) + ready[0] * back;
    arm.shoulder.rotation.z = L(arm.shoulder.rotation.z, arm.side * 0.15, on);
    arm.elbow.rotation.x = L(L(ready[1], -1.55, draw), -0.05, go) * (1 - back) + ready[1] * back;
    if (off) { mix(off.shoulder.rotation, 'x', L(-0.9, 0.5, go), on); mix(off.elbow.rotation, 'x', -0.4, on); mix(off.shoulder.rotation, 'z', off.side * 0.35, on); }
    if (legF) { mix(legF.hip.rotation, 'x', L(-0.2, -0.95, go), on); mix(legF.knee.rotation, 'x', L(0.4, 1.05, go), on); }
    if (legB) { mix(legB.hip.rotation, 'x', L(0.1, 0.5, go), on); mix(legB.knee.rotation, 'x', 0.25, on); }
    if (rig.hips) rig.hips.position.y -= H * 0.07 * lunge;
    rig.root.position.z = H * 0.22 * lunge;
    return;
  }
  // bare hands: the second hit is a cross with the other fist, the third an uppercut
  if (step === 2) {
    const p = Math.sin(clamp01(k) * Math.PI);
    const fist = off || arm;
    fist.shoulder.rotation.x = -1.5 * p;
    fist.elbow.rotation.x = -1.2 * (1 - p);
    mix(arm.shoulder.rotation, 'x', -0.7, p); mix(arm.elbow.rotation, 'x', -1.7, p); // guard up
    if (rig.spine) rig.spine.rotation.y = 0.45 * p;
    return;
  }
  const dip = seg(k, 0, 0.3), up = seg(k, 0.3, 0.55), back = seg(k, 0.7, 1);
  const on = Math.max(dip, up) * (1 - back);
  arm.shoulder.rotation.x = L(L(0, 0.35, dip), -2.0, up) * (1 - back);
  arm.elbow.rotation.x = L(L(-0.3, -1.9, dip), -1.3, up) * (1 - back);
  if (off) { mix(off.shoulder.rotation, 'x', -0.7, on); mix(off.elbow.rotation, 'x', -1.7, on); }
  if (rig.spine) { rig.spine.rotation.y = L(-0.3, 0.25, up) * on; rig.spine.rotation.x += L(0.15, -0.12, up) * on; }
  for (const l of rig.legs || []) mix(l.knee.rotation, 'x', L(0.7, 0.15, up), on);
  if (rig.hips) rig.hips.position.y -= H * L(0.05, -0.01, up) * on;
}

// ---------- swimming ----------
// Pose `body` (a character from buildCharacter) swimming at feet position (x, feetY, z) facing
// `heading`. The game floats you with your feet 0.7 of your height under the surface; `moving` is
// how fast you swim (0 = treading water). Call after animateCharacter each frame.
const TAU = Math.PI * 2;
export function poseSwim(body, x, feetY, z, heading, t, moving, upright = false) {
  const rig = body.userData.rig;
  const H = rig.root.userData.height || 1.7;
  const S = (rig.swim ??= { p: 0, last: t, a: 0 });
  const dt = Math.max(0, Math.min(0.1, t - S.last));
  S.last = t;
  S.a += (Math.min(1, moving * 1.5) - S.a) * (1 - Math.exp(-dt * 4)); // 0 treading -> 1 crawling
  const a = upright ? 0 : S.a, tr = 1 - a;
  S.p += dt * (2.4 + Math.min(moving, 2) * 1.6) * a + dt * 2.6 * tr;
  const p = S.p;
  if (rig.arms && rig.legs) {
    for (const arm of rig.arms) {
      // crawl: each arm goes round, under the body (the pull) and back over the water; the arms take turns
      const ph = ((p + (arm.side > 0 ? Math.PI : 0)) % TAU + TAU) % TAU;
      const cx = ph - Math.PI; // -pi overhead -> 0 at the hip (underwater) -> +pi back over the top
      const over = Math.max(0, Math.sin(cx)); // in the air, recovering
      const cz = arm.side * (0.12 + 0.45 * over);
      const ce = -(0.15 + 1.1 * over) - 0.35 * Math.max(0, Math.sin(-cx)) * (cx > -1.6 ? 1 : 0.3);
      // treading: arms out to the sides just under the surface, sweeping forward and back
      const sc = Math.sin(t * 2.6 + (arm.side > 0 ? Math.PI : 0));
      const tx = -0.55 + 0.35 * sc, tz = arm.side * (0.95 + 0.15 * sc), te = -0.75;
      arm.shoulder.rotation.x = L(tx, cx, a);
      arm.shoulder.rotation.z = L(tz, cz, a);
      if (arm.elbow) arm.elbow.rotation.x = L(te, ce, a);
    }
    for (const leg of rig.legs) {
      // crawl: a quick flutter kick from the hips, toes pointed; treading: slow circling (eggbeater)
      const k = Math.sin(p * 3 + (leg.side > 0 ? 0 : Math.PI));
      const r = Math.sin(t * 3.2 + (leg.side > 0 ? 0 : Math.PI));
      const r2 = Math.cos(t * 3.2 + (leg.side > 0 ? 0 : Math.PI));
      leg.hip.rotation.x = L(-0.75 + 0.3 * r, 0.05 + 0.32 * k, a);
      leg.hip.rotation.z = L(leg.side * (0.3 + 0.08 * r2), leg.side * 0.04, a);
      leg.knee.rotation.x = L(1.15 + 0.35 * r2, 0.2 + 0.3 * Math.max(0, -k), a);
      if (leg.ankle) { leg.ankle0 ??= leg.ankle.rotation.x; leg.ankle.rotation.x = leg.ankle0 + L(-0.35, 0.75, a); }
    }
    if (rig.spine) {
      rig.spine.rotation.y = 0.12 * Math.sin(p) * a;
      rig.spine.rotation.x = (rig.spineX0 ?? 0) + L(0.05, -0.08, a);
    }
    if (rig.hips) { rig.baseHipY ??= rig.hips.position.y; rig.hips.position.y = rig.baseHipY; rig.hips.rotation.y = 0; rig.hips.rotation.z = 0; }
    // lying in the water the head lifts to see ahead, and turns aside for a breath now and then
    if (rig.head) {
      rig.headX0 ??= rig.head.rotation.x;
      rig.head.rotation.x = rig.headX0 - 0.95 * a;
      rig.head.rotation.y = 0.5 * a * Math.max(0, Math.sin(p)) ** 6;
    }
  }
  // a tail trails out behind along the water instead of sticking up into the air
  if (rig.tail) { rig.tail.userData.x0 ??= rig.tail.rotation.x; rig.tail.rotation.x = rig.tail.userData.x0 - 1.45 * a; }
  // the whole body: tipped forward to lie along the water when swimming, rolling with each stroke,
  // and bobbing gently; turned about the hips so you stay where you are
  const pitch = L(0.1, 1.38, a);
  const roll = 0.3 * Math.sin(p) * a;
  body.rotation.order = 'YXZ';
  body.rotation.set(pitch, heading, roll);
  const water = feetY + H * 0.7;
  const hipY = water - H * L(0.22, 0.05, a) + Math.sin(t * 1.9) * H * 0.018 * tr + Math.sin(p * 2) * H * 0.01 * a;
  const hip = H * 0.5;
  const fwd = hip * Math.sin(pitch);
  body.position.set(x - Math.sin(heading) * fwd, hipY - hip * Math.cos(pitch), z - Math.cos(heading) * fwd);
}

// back to normal after swimming: nothing left tipped over
export function endSwim(body) {
  const rig = body.userData.rig;
  body.rotation.x = 0;
  if (rig.head) rig.head.rotation.y = 0;
  if (rig.tail && rig.tail.userData.x0 !== undefined) rig.tail.rotation.x = rig.tail.userData.x0;
  for (const l of rig.legs || []) l.hip.rotation.z = 0;
  if (rig.swim) rig.swim.a = 0;
}
