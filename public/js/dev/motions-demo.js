// Demonstration motions for the body studio (studio.js): each is (body, t seconds, scene) and
// poses the body (and its props) for that moment
import * as THREE from 'three';
import { poseOf, applyPose, mixPose, reach, gripHold, phase, track, ease, clamp01 } from '../characters/body/motion.js';
import { weaponModel } from '../characters/gear.js';
import { gaitPose, idlePose } from '../characters/body/gait.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const props = new Map();
function prop(scene, name, make) {
  if (!props.has(name)) { const o = make(); scene.add(o); props.set(name, o); }
  for (const [n, o] of props) o.visible = n === name || o.userData.keep;
  return props.get(name);
}

// standing at ease: weight even, arms hanging just off the thighs, hands relaxed
const HAND = Object.fromEntries(['relaxed', 'reach', 'grip', 'fist', 'open'].map((h) => [h, poseOf({ hands: { left: h } })]));
const STAND = { leftUpperArm: [0, 0, 0.06], rightUpperArm: [0, 0, -0.06], leftLowerArm: [-0.12, 0, 0], rightLowerArm: [-0.12, 0, 0], hands: { left: 'relaxed', right: 'relaxed' } };

// Feet: planted where they stand, or swung in an arc to a new place (a step)
function footPath(from, to, t, lift = 0.07) {
  const k = ease.inOut(clamp01(t));
  const p = from.clone().lerp(to, k);
  p.y += Math.sin(Math.PI * clamp01(t)) * lift;
  return p;
}
const FLAT = new THREE.Quaternion();
function plant(body, side, at, toe = 0) {
  // the knee bends forward (towards +z), the foot stays flat (or rolls onto its toes)
  const knee = body.bones[`${side}LowerLeg`].getWorldPosition(new THREE.Vector3()).add(V(0, 0, 0.5));
  const q = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), toe);
  reach(body, side, at, { upper: 'UpperLeg', lower: 'LowerLeg', end: 'Foot', pole: knee, hand: toe ? q : FLAT });
}
// where the feet stand at rest
function feetAtRest(body) {
  const out = {};
  for (const side of ['left', 'right']) out[side] = body.bones[`${side}Foot`].getWorldPosition(new THREE.Vector3());
  return out;
}

// put the given hands' finger poses into a body pose
function withHands(pose, hands) {
  for (const [side, w] of Object.entries(hands)) {
    for (const [k, q] of Object.entries(w.q)) if (k.startsWith(side)) pose.q[k] = q;
    if (w.hands[side]) pose.hands[side] = w.hands[side]; else delete pose.hands[side];
  }
  return pose;
}
const HANDS_OF = (side) => Object.fromEntries(['relaxed', 'reach', 'grip', 'fist', 'open', 'point', 'pinch'].map((h) => [h, poseOf({ hands: { [side]: h } })]));
const LH = HANDS_OF('left'), RH = HANDS_OF('right');
// the fingers going from one hand pose to the next: [[time, name], ...]
function handsAt(H, keys, t) {
  let i = 0;
  while (i < keys.length - 1 && t >= keys[i + 1][0]) i++;
  const [t0, a] = keys[i], next = keys[i + 1];
  if (!next) return H[a];
  const [t1, b] = next, dur = Math.min(0.18, t1 - t0);
  return mixPose(H[a], H[b], phase(t, t1 - dur, t1, b === 'grip' || b === 'fist' ? ease.snap : ease.inOut));
}

export const MOTIONS = {
  // Opening a door: step in, reach for the handle, take hold, press it down, push the door open
  // while stepping through, let go
  door(body, t, scene) {
    const door = prop(scene, 'door', makeDoor);
    applyPose(body, poseOf({}));
    const rest = body._feet ||= feetAtRest(body);
    // the door: pushed open from 1.6 s to 2.7 s; its lever pressed down from 1.15 s to 1.45 s, and
    // let up again as it swings
    const open = phase(t, 1.55, 2.75, ease.inOut) * 0.95;
    const lever = phase(t, 1.12, 1.42, ease.inOut) * 0.55 * (1 - phase(t, 2.45, 2.8));
    door.userData.set(open, lever);
    door.updateMatrixWorld(true);
    const handle = door.userData.grip(); // { at, axis } of the lever, in the world

    // the body: one step in towards the door, a second step following it through
    const stepL = phase(t, 0.3, 0.95);
    const stepR = phase(t, 1.75, 2.5);
    const move = V(0.012 * Math.sin(Math.PI * stepL), -0.018 * Math.sin(Math.PI * stepL) - 0.012 * stepL, 0.16 * stepL + 0.26 * stepR - 0.012 * stepR);
    move.y -= 0.018 * Math.sin(Math.PI * stepR);
    const lean = 0.06 * stepL + 0.05 * phase(t, 1.5, 2.2) - 0.07 * phase(t, 2.5, 3.1);
    const reachW = phase(t, 0.45, 1.05, ease.inOut) * (1 - phase(t, 2.65, 3.2, ease.inOut));
    const gripW = phase(t, 0.92, 1.1, ease.snap) * (1 - phase(t, 2.62, 2.85));
    const base = poseOf({ ...STAND,
      spine: [lean * 0.6, -0.08 * reachW, 0], chest: [lean * 0.5, -0.1 * reachW, 0], upperChest: [lean * 0.3, -0.05 * reachW, 0],
      neck: [-lean * 0.4, 0.06 * reachW, 0], head: [0.12 * reachW - lean * 0.3, 0.1 * reachW, 0],
      // the free arm swings a little with the steps
      rightUpperArm: [0.12 * Math.sin(Math.PI * stepL) - 0.15 * Math.sin(Math.PI * stepR), 0, -0.07], rightLowerArm: [-0.2, 0, 0],
      move: [move.x, move.y, move.z] });
    // the left hand opens as it reaches, closes round the lever, and lets go
    const fingers = mixPose(mixPose(HAND.relaxed, HAND.reach, phase(t, 0.5, 0.9)), HAND.grip, gripW);
    const pose = mixPose(base, base, 0);
    for (const [k, q] of Object.entries(fingers.q)) pose.q[k] = q;
    if (fingers.hands.left) pose.hands.left = fingers.hands.left;
    applyPose(body, pose);
    // feet: the left steps in first, the right follows through the doorway
    const lTo = rest.left.clone().add(V(0.02, 0, 0.36)), rTo = rest.right.clone().add(V(-0.01, 0, 0.42));
    plant(body, 'left', footPath(rest.left, lTo, stepL), 0);
    plant(body, 'right', footPath(rest.right, rTo, stepR));
    // the left hand: from hanging, up to the handle, holding it while the door swings
    if (reachW > 0) {
      const g = gripHold(body, 'left', handle.at, handle.axis, V(0, -0.55, 1));
      const hb = body.bones.leftHand;
      const now = hb.getWorldPosition(new THREE.Vector3()), nowQ = hb.getWorldQuaternion(new THREE.Quaternion());
      // on the way there the hand comes from a little below and to the side of the handle
      const approach = g.pos.clone().add(V(0.03, -0.06, -0.08).multiplyScalar(1 - phase(t, 0.7, 1.0)));
      const target = now.clone().lerp(approach, reachW);
      const shoulder = body.bones.leftUpperArm.getWorldPosition(new THREE.Vector3());
      reach(body, 'left', target, { pole: shoulder.clone().add(V(0.4, -0.5, -0.4)), hand: nowQ.clone().slerp(g.quat, reachW) });
    }
  },
};

// The sword's frame: z along the blade (towards the tip), y the flat's normal; the grip runs from
// the guard (z 0) back to the pommel
function frame(z, yHint) {
  const Z = z.clone().normalize();
  const Yv = yHint.clone().addScaledVector(Z, -yHint.dot(Z)).normalize();
  const Xv = new THREE.Vector3().crossVectors(Yv, Z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(Xv, Yv, Z));
}
const SWORD = { id: 'iron_sword', blade: 0.8, grip: 0.17 };

MOTIONS.drawSword = function (body, t, scene) {
  const kit = prop(scene, 'sword', () => makeSwordKit());
  const { sword, sheath } = kit.userData;
  applyPose(body, poseOf({}));
  const rest = body._feet ||= feetAtRest(body);
  const hips = body.bones.hips;
  // where the scabbard hangs: from the belt on the left hip, its mouth to the front, the tip down and
  // back. While drawing, the left hand turns its mouth forward and lifts its tip, to free the blade.
  const pull = phase(t, 0.85, 1.45) * (1 - phase(t, 1.85, 2.4));
  const twist = 0.3 * phase(t, 0.3, 0.8) - 0.55 * phase(t, 0.95, 1.6) + 0.25 * phase(t, 1.7, 2.3);
  const stance = phase(t, 1.5, 2.2);
  const crouch = 0.035 * stance + 0.02 * Math.sin(Math.PI * phase(t, 0.3, 1.0, ease.linear));
  const look = phase(t, 0.3, 0.7) * (1 - phase(t, 1.2, 1.7));
  const base = poseOf({ ...STAND,
    spine: [0.05 * look, twist * 0.35, 0], chest: [0.06 * look, twist * 0.35, 0], upperChest: [0.02, twist * 0.2, 0],
    neck: [0.15 * look, -twist * 0.3, 0], head: [0.25 * look, -twist * 0.35, 0],
    move: [0.02 * stance, -crouch, -0.05 * stance] });
  const lh = handsAt(LH, [[0, 'relaxed'], [0.62, 'grip'], [1.62, 'open'], [1.95, 'grip']], t);
  const rh = handsAt(RH, [[0, 'relaxed'], [0.45, 'reach'], [0.72, 'grip']], t);
  applyPose(body, withHands(base, { left: lh, right: rh }));
  // feet: the right foot draws back into a stance as the blade comes round
  plant(body, 'left', rest.left.clone().add(V(0.01, 0, 0.06 * stance)));
  plant(body, 'right', footPath(rest.right, rest.right.clone().add(V(-0.08, 0, -0.2)), stance, 0.04));
  body.root.updateMatrixWorld(true);

  // the scabbard, hung from the hips
  const hq = hips.getWorldQuaternion(new THREE.Quaternion()), hp = hips.getWorldPosition(new THREE.Vector3());
  const mouthLocal = V(0.19, -0.03, 0.06 - 0.16 * pull);
  const down = V(0.1, -0.78, -0.6).normalize().applyAxisAngle(V(1, 0, 0), 0.5 * pull).applyAxisAngle(V(0, 1, 0), -0.25 * pull);
  const sq = frame(down, V(1, 0, 0.1)).premultiply(hq);
  const mouth = mouthLocal.clone().applyQuaternion(hq).add(hp);
  sheath.position.copy(mouth); sheath.quaternion.copy(sq);
  const axis = V(0, 0, 1).applyQuaternion(sq); // into the scabbard
  // the sword: sheathed, then slid out along the scabbard, then swung up into a guard in front
  const slide = phase(t, 0.85, 1.55, ease.inOut) * (SWORD.blade + 0.02);
  const out = phase(t, 1.5, 2.15, ease.inOut);
  const sheathedAt = mouth.clone().addScaledVector(axis, -slide);
  const chest = body.bones.chest.getWorldPosition(new THREE.Vector3());
  const guardAt = chest.clone().add(V(0.01, -0.2, 0.4)); // the hands, low in front of the body
  const guardQ = frame(V(0.02, 0.62, 1), V(1, 0, 0));
  // once clear, the tip sweeps out round the left side to the front (turning about the upright),
  // then settles into the guard
  const sweep = phase(t, 1.45, 1.95, ease.inOut);
  const swordQ = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), -Math.PI * 0.85 * sweep).multiply(sq).slerp(guardQ, phase(t, 1.7, 2.2));
  // the guard's path bends up and out on its way round
  const swordAt = sheathedAt.clone().lerp(guardAt.clone().addScaledVector(V(0, 0, 1).applyQuaternion(guardQ), -0.06), out).add(V(-0.05, 0.12, 0.05).multiplyScalar(Math.sin(Math.PI * out)));
  const along = V(0, 0, 1).applyQuaternion(swordQ);
  const flat = V(0, 1, 0).applyQuaternion(swordQ);
  // the right hand: up to the hilt, then holding it wherever it goes
  const reachR = phase(t, 0.3, 0.72, ease.inOut);
  const rShoulder = body.bones.rightUpperArm.getWorldPosition(new THREE.Vector3());
  if (reachR > 0) {
    const gR = gripHold(body, 'right', swordAt.clone().addScaledVector(along, -0.045), along, flat.clone().multiplyScalar(-1).lerp(V(0, -1, 0), 0.0));
    const hb = body.bones.rightHand;
    const now = hb.getWorldPosition(new THREE.Vector3()), nowQ = hb.getWorldQuaternion(new THREE.Quaternion());
    reach(body, 'right', now.lerp(gR.pos, reachR), { pole: rShoulder.clone().add(V(-0.5, -0.3, -0.5)), hand: nowQ.slerp(gR.quat, reachR) });
  }
  // the sword follows the right hand once it holds it (so the two never drift apart)
  if (t > 0.72) {
    const hb = body.bones.rightHand;
    const hq2 = hb.getWorldQuaternion(new THREE.Quaternion()), hp2 = hb.getWorldPosition(new THREE.Vector3());
    const g0 = gripHold(body, 'right', V(0, 0, 0), along, flat.clone().multiplyScalar(-1));
    // the grip point relative to the hand, from the hold worked out above
    const rel = g0.pos.clone().multiplyScalar(-1).applyQuaternion(g0.quat.clone().invert());
    const gripPt = rel.applyQuaternion(hq2).add(hp2);
    const q = hq2.clone().multiply(g0.quat.clone().invert()).multiply(swordQ);
    sword.quaternion.copy(q);
    sword.position.copy(gripPt).addScaledVector(V(0, 0, 1).applyQuaternion(q), 0.045);
  } else {
    sword.quaternion.copy(swordQ);
    sword.position.copy(swordAt);
  }
  // the left hand: on the scabbard by its mouth while the blade comes out, then onto the grip
  // below the right hand
  const onSheath = phase(t, 0.3, 0.62) * (1 - phase(t, 1.55, 1.75));
  const onGrip = phase(t, 1.75, 2.15);
  const lShoulder = body.bones.leftUpperArm.getWorldPosition(new THREE.Vector3());
  const hbL = body.bones.leftHand;
  const nowL = hbL.getWorldPosition(new THREE.Vector3()), nowLQ = hbL.getWorldQuaternion(new THREE.Quaternion());
  if (onGrip > 0) {
    const sAlong = V(0, 0, 1).applyQuaternion(sword.quaternion), sFlat = V(0, 1, 0).applyQuaternion(sword.quaternion);
    const gL = gripHold(body, 'left', sword.position.clone().addScaledVector(sAlong, -0.135), sAlong, sFlat);
    reach(body, 'left', nowL.lerp(gL.pos, onGrip), { pole: lShoulder.clone().add(V(0.5, -0.3, -0.4)), hand: nowLQ.slerp(gL.quat, onGrip) });
  } else if (onSheath > 0) {
    const gL = gripHold(body, 'left', mouth.clone().addScaledVector(axis, 0.05), axis.clone().multiplyScalar(-1), V(0, 0, 0).sub(V(1, 0, 0)));
    reach(body, 'left', nowL.lerp(gL.pos, onSheath), { pole: lShoulder.clone().add(V(0.5, -0.2, -0.5)), hand: nowLQ.slerp(gL.quat, onSheath) });
  }
};

// the hand opening and closing: open wide, a fist, pointing, a pinch, a grip, and relaxed again
MOTIONS.hands = function (body, t, scene) {
  prop(scene, 'none', () => new THREE.Group());
  const fingers = handsAt(LH, [[0, 'relaxed'], [0.7, 'open'], [1.5, 'fist'], [2.3, 'open'], [3.1, 'point'], [3.9, 'pinch'], [4.7, 'grip'], [5.5, 'relaxed']].map(([k, h]) => [k, h]), t);
  const pose = poseOf({ ...STAND, leftUpperArm: [-1.25, 0, 0.25], leftLowerArm: [-0.75, 0.0, 0], leftHand: [0, -0.4, 0] });
  applyPose(body, withHands(pose, { left: fingers }));
};

// standing, then walking, then running, then slowing to a stop (on the spot)
MOTIONS.gait = function (body, t, scene, speedOverride) {
  prop(scene, 'none', () => new THREE.Group());
  const speed = speedOverride ?? track([[0, 0], [1, 0], [2, 1], [5, 1], [6, 2], [9, 2], [10.5, 0], [12, 0]], t);
  // the stride's phase runs faster the faster the body goes (steps per second)
  body._gait ||= { phase: 0, t: 0 };
  const g = body._gait;
  if (t < g.t) { g.phase = 0; g.t = 0; }
  const step = 1 / 30;
  while (g.t < t) { const sp = speedOverride ?? track([[0, 0], [1, 0], [2, 1], [5, 1], [6, 2], [9, 2], [10.5, 0], [12, 0]], g.t); g.phase += step * (sp <= 1 ? 0.95 * sp : 0.95 + (sp - 1) * 0.45); g.t += step; }
  applyPose(body, gaitPose(body, g.phase, speed, t));
};

// putting it away: the draw played backwards, a little slower where the tip finds the scabbard
MOTIONS.sheatheSword = function (body, t, scene) {
  const T = 2.6;
  const u = T - t;
  MOTIONS.drawSword(body, u < 1.45 ? u : u, scene);
};

function makeSwordKit() {
  const g = new THREE.Group();
  const sword = weaponModel({ id: SWORD.id });
  g.add(sword);
  // the scabbard: dark leather over wood, flattened, narrowing to an iron-shod tip, with an iron
  // throat at the mouth
  const sheath = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({ color: '#3a2618', roughness: 0.7 });
  const iron = new THREE.MeshStandardMaterial({ color: '#7a7a80', roughness: 0.35, metalness: 0.85 });
  const L = SWORD.blade + 0.03;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.02, L, 16, 1), leather);
  body.rotation.x = Math.PI / 2; body.position.z = L / 2; body.scale.set(1, 1, 0.42);
  sheath.add(body);
  const throat = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.036, 0.05, 16), iron);
  throat.rotation.x = Math.PI / 2; throat.position.z = 0.025; throat.scale.set(1, 1, 0.46);
  sheath.add(throat);
  const chape = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.012, 0.07, 14), iron);
  chape.rotation.x = Math.PI / 2; chape.position.z = L - 0.03; chape.scale.set(1, 1, 0.46);
  sheath.add(chape);
  g.add(sheath);
  g.userData = { sword, sheath };
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// A plain wooden door in a frame, hinged on the body's right, with a lever handle on the left
function makeDoor() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#6a4a30', roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: '#3a281a', roughness: 0.85 });
  const iron = new THREE.MeshStandardMaterial({ color: '#2a2a2c', roughness: 0.4, metalness: 0.8 });
  const W = 0.92, H = 2.05, Z0 = 0.62, HX = -0.48; // the hinge's x
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, H + 0.12, 0.16), dark);
    post.position.set(s * (W / 2 + 0.06) - 0.02, H / 2, Z0);
    g.add(post);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(W + 0.24, 0.12, 0.16), dark);
  lintel.position.set(-0.02, H + 0.06, Z0);
  g.add(lintel);
  for (const s of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1.2, H + 0.6, 0.14), new THREE.MeshStandardMaterial({ color: '#b8ab98', roughness: 0.95 }));
    wall.position.set(s * (W / 2 + 0.12 + 0.6) - 0.02, (H + 0.6) / 2, Z0);
    g.add(wall);
  }
  const hinge = new THREE.Group();
  hinge.position.set(HX, 0, Z0);
  g.add(hinge);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, H - 0.02, 0.045), wood);
  leaf.position.set(W / 2, H / 2, 0);
  hinge.add(leaf);
  for (let i = 0; i < 5; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.004, H - 0.1, 0.05), dark);
    plank.position.set((i + 1) * W / 6, H / 2, 0);
    hinge.add(plank);
  }
  // the lever: a round rose on the door, a short neck, and a bar towards the hinge
  const knob = new THREE.Group();
  knob.position.set(W - 0.1, 1.0, -0.03);
  hinge.add(knob);
  const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 20), iron);
  rose.rotation.x = Math.PI / 2;
  knob.add(rose);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.055, 10), iron);
  neck.rotation.x = Math.PI / 2; neck.position.z = -0.03;
  knob.add(neck);
  const leverG = new THREE.Group();
  leverG.position.z = -0.055;
  knob.add(leverG);
  const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.11, 4, 10), iron);
  bar.rotation.z = Math.PI / 2; bar.position.x = -0.06;
  leverG.add(bar);
  g.userData.set = (open, press) => { hinge.rotation.y = -open; leverG.rotation.z = press; };
  g.userData.grip = () => {
    const at = new THREE.Vector3(-0.065, 0, 0).applyMatrix4(leverG.matrixWorld);
    const end = new THREE.Vector3(-0.12, 0, 0).applyMatrix4(leverG.matrixWorld);
    return { at, axis: end.sub(at).normalize() };
  };
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
