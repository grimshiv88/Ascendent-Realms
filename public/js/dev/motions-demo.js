// Demonstration motions for the body studio (studio.js): each is (body, t seconds, scene) and
// poses the body (and its props) for that moment
import * as THREE from 'three';
import { poseOf, applyPose, mixPose, reach, gripHold, fitGrip, phase, track, ease, clamp01 } from '../characters/body/motion.js';
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
    if (body._belt) body._belt.belt.visible = false;
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
    const leverGrip = fitGrip(body, 'left', 0.011);
    const fingers = mixPose(mixPose(HAND.relaxed, HAND.reach, phase(t, 0.5, 0.9)), poseOf({ hands: { left: leverGrip.spec } }), gripW);
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
      const g = gripHold(body, 'left', handle.at, handle.axis, V(0, -0.55, 1), 0.011);
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
const SWORD = { id: 'iron_sword', blade: 0.8, grip: 0.17, gripR: 0.017 };

// A belt round the body's waist, measured off the body itself (so it fits every build), carried by
// the hips. The scabbard hangs from it on the left hip by a leather frog. Returns { belt, hanger }
// where hanger is the frog's place on the belt, in the hips bone's space.
function beltFor(body) {
  if (body._belt) return body._belt;
  applyPose(body, poseOf({}));
  const hips = body.bones.hips;
  const hp = hips.getWorldPosition(new THREE.Vector3());
  const k = body.scale;
  const y = hp.y + 0.065 * k;
  // the body's outline at that height: the furthest skin (or cloth) all round, in 48 slices
  const N = 48, R = new Array(N).fill(0);
  let cz = 0, cn = 0;
  const v = new THREE.Vector3();
  const names = body.skeleton.bones.map((b) => b.name);
  const pts = [];
  for (const [name, mesh] of Object.entries(body.meshes)) {
    if (name === 'face' || name === 'hair' || name === 'head') continue;
    const P = mesh.geometry.attributes.position, SI = mesh.geometry.attributes.skinIndex, SW = mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(mesh.matrixWorld);
      if (Math.abs(v.y - y) > 0.012 * k) continue;
      // (not the arms or hands hanging beside the hips)
      let best = 0, bw = -1;
      for (let j = 0; j < 4; j++) { const w = SW.getComponent(i, j); if (w > bw) { bw = w; best = SI.getComponent(i, j); } }
      if (/Arm|Hand|Thumb|Index|Middle|Ring|Little/.test(names[best])) continue;
      pts.push(v.clone()); cz += v.z; cn++;
    }
  }
  cz /= cn || 1;
  for (const q of pts) {
    const a = Math.atan2(q.x, q.z - cz), i = ((Math.round((a / (Math.PI * 2)) * N) % N) + N) % N;
    R[i] = Math.max(R[i], Math.hypot(q.x, q.z - cz));
  }
  // fill gaps and smooth the outline (a belt is pulled taut over hollows)
  for (let i = 0; i < N; i++) if (!R[i]) R[i] = Math.max(R[(i + N - 1) % N], R[(i + 1) % N]);
  for (let it = 0; it < 3; it++) { const c = R.slice(); for (let i = 0; i < N; i++) R[i] = Math.max(c[i], (c[(i + N - 1) % N] + c[i] * 2 + c[(i + 1) % N]) / 4); }
  const at = (a, out = 0) => { const f = ((a / (Math.PI * 2)) * N % N + N) % N, i = Math.floor(f), t = f - i; const r = R[i] * (1 - t) + R[(i + 1) % N] * t + out; return new THREE.Vector3(Math.sin(a) * r, y, cz + Math.cos(a) * r); };
  // the strap: a band 4 cm tall, 5 mm thick, standing just off the body
  const H = 0.04 * k, T = 0.005 * k, gap = 0.004 * k, M = 96;
  const pos = [], idx = [];
  for (let i = 0; i <= M; i++) {
    const a = (i / M) * Math.PI * 2;
    const inner = at(a, gap), outer = at(a, gap + T);
    for (const [p, dy] of [[inner, -H / 2], [outer, -H / 2], [outer, H / 2], [inner, H / 2]]) pos.push(p.x, p.y + dy, p.z);
  }
  for (let i = 0; i < M; i++) for (let j = 0; j < 4; j++) {
    const a = i * 4 + j, b = i * 4 + (j + 1) % 4, c = a + 4, d = b + 4;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const leather = new THREE.MeshStandardMaterial({ color: '#2e1f14', roughness: 0.62 });
  const brass = new THREE.MeshStandardMaterial({ color: '#b08a3c', roughness: 0.35, metalness: 0.9 });
  const belt = new THREE.Group();
  belt.add(new THREE.Mesh(geo, leather));
  // a buckle at the front
  const front = at(0, gap + T);
  const buckle = new THREE.Mesh(new THREE.TorusGeometry(0.024 * k, 0.004 * k, 6, 4), brass);
  buckle.rotation.z = Math.PI / 4; buckle.scale.set(1.25, 1, 1);
  buckle.position.copy(front).add(new THREE.Vector3(0, 0, 0.002 * k));
  belt.add(buckle);
  // the frog: a loop of leather on the left hip, a little forward of the side, holding the scabbard
  const fa = 1.05; // radians round from the front towards the left
  const frogAt = at(fa, gap + T + 0.006 * k);
  const frog = new THREE.Mesh(new THREE.BoxGeometry(0.045 * k, 0.075 * k, 0.008 * k), leather);
  frog.position.copy(frogAt).add(new THREE.Vector3(0, -0.03 * k, 0));
  frog.rotation.y = fa;
  belt.add(frog);
  belt.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  hips.attach(belt);
  // the hanger, in the hips' space: where the scabbard's throat sits, and which way is out from the body
  const toLocal = new THREE.Matrix4().copy(hips.matrixWorld).invert();
  const out = new THREE.Vector3(Math.sin(fa), 0, Math.cos(fa));
  const hang = frogAt.clone().addScaledVector(out, 0.022 * k).add(new THREE.Vector3(0, -0.055 * k, 0)).applyMatrix4(toLocal);
  const hipsQ = hips.getWorldQuaternion(new THREE.Quaternion()).invert();
  body._belt = { belt, hang, out: out.applyQuaternion(hipsQ), fa };
  return body._belt;
}

// how the sword lies in the hand: the hand's pose relative to the sword's, for a hold at `along`
// metres down the grip from the guard with the palm facing `palmLocal` (in the sword's space)
function holdOf(body, side, swordPos, swordQ, along, palmLocal) {
  const dir = V(0, 0, 1).applyQuaternion(swordQ);
  const g = gripHold(body, side, swordPos.clone().addScaledVector(dir, -along), dir, palmLocal.clone().applyQuaternion(swordQ), SWORD.gripR);
  return g;
}
// put the sword where a hand holds it (the inverse of holdOf)
function swordFromHand(body, side, along, palmLocal) {
  // the hold for a sword at the origin, unturned
  const g = holdOf(body, side, V(0, 0, 0), new THREE.Quaternion(), along, palmLocal);
  const hb = body.bones[`${side}Hand`];
  const hq = hb.getWorldQuaternion(new THREE.Quaternion()), hp = hb.getWorldPosition(new THREE.Vector3());
  const q = hq.clone().multiply(g.quat.clone().invert());
  const p = hp.clone().sub(g.pos.clone().applyQuaternion(q));
  return { pos: p, quat: q };
}
// a point on a curve from a through c (pulled towards it) to b
const bend = (a, c, b, t) => a.clone().multiplyScalar((1 - t) * (1 - t)).addScaledVector(c, 2 * t * (1 - t)).addScaledVector(b, t * t);

// Drawing a sword from the left hip: the left hand takes the scabbard by its throat and the right
// hand comes across in front of the body to the hilt; the left hand draws the scabbard back as the
// right pulls the blade out forward along it; once the point is free the blade swings out to the
// left and round to the front, and the left hand joins the right on the grip.
MOTIONS.drawSword = function (body, t, scene) {
  const kit = prop(scene, 'sword', () => makeSwordKit());
  const { sword, sheath } = kit.userData;
  const B = beltFor(body);
  B.belt.visible = true;
  const rest = body._feet ||= feetAtRest(body);
  const k = body.scale;
  // fingers fitted to the hilt and to the scabbard's throat
  const gripS = fitGrip(body, 'right', SWORD.gripR), gripL = fitGrip(body, 'left', SWORD.gripR), throatL = fitGrip(body, 'left', 0.021);
  const L = { ...LH, hilt: poseOf({ hands: { left: gripL.spec } }), throat: poseOf({ hands: { left: throatL.spec } }) };
  const R = { ...RH, hilt: poseOf({ hands: { right: gripS.spec } }) };

  const turn = 0.3 * phase(t, 0.25, 0.8) + 0.18 * phase(t, 0.85, 1.4) - 0.48 * phase(t, 1.45, 2.15); // the trunk turns left to reach, then squares up
  const look = phase(t, 0.15, 0.55) * (1 - phase(t, 1.25, 1.8));
  const stance = phase(t, 1.5, 2.2);
  const crouch = 0.03 * stance + 0.018 * Math.sin(Math.PI * phase(t, 0.3, 1.2, ease.linear));
  const lean = 0.06 * Math.sin(Math.PI * phase(t, 0.3, 1.5, ease.linear));
  const base = poseOf({ ...STAND,
    hips: [0, turn * 0.25, 0], spine: [lean * 0.5, turn * 0.3, 0], chest: [lean * 0.4, turn * 0.3, 0], upperChest: [0.02, turn * 0.2, 0],
    neck: [0.12 * look, -turn * 0.35, 0], head: [0.28 * look, -turn * 0.4, 0],
    move: [0.015 * stance, -crouch, -0.04 * stance] });
  const lh = handsAt(L, [[0, 'relaxed'], [0.3, 'reach'], [0.55, 'throat'], [1.55, 'open'], [1.92, 'hilt']], t);
  const rh = handsAt(R, [[0, 'relaxed'], [0.35, 'reach'], [0.74, 'hilt']], t);
  applyPose(body, withHands(base, { left: lh, right: rh }));
  plant(body, 'left', rest.left.clone().add(V(0.01, 0, 0.05 * stance)));
  plant(body, 'right', footPath(rest.right, rest.right.clone().add(V(-0.07, 0, -0.2)), stance, 0.04));
  body.root.updateMatrixWorld(true);

  // the scabbard: its throat in the frog, its tip down and back. The left hand draws it back a
  // little and lifts its tip (so the blade comes out forwards), then lets it hang again.
  const hips = body.bones.hips;
  const hq = hips.getWorldQuaternion(new THREE.Quaternion());
  const pull = phase(t, 0.8, 1.4) * (1 - phase(t, 1.6, 2.2));
  const into = V(0.2, -0.72, -0.66).normalize().applyAxisAngle(V(0, 0, 1), -0.1 * pull).applyQuaternion(hq);
  const mouth = B.hang.clone().applyMatrix4(hips.matrixWorld).addScaledVector(into, 0.08 * pull * k);
  const sheathQ = frame(into, V(1, 0, 0.15).applyQuaternion(hq));
  sheath.position.copy(mouth); sheath.quaternion.copy(sheathQ);
  // the hand holds the hilt with its knuckles up and out: the palm's facing, in the sword's own space
  // (the palm faces the blade's flat, so the edge lines up with the knuckles, as a sword is held)
  const palmLocal = V(0, 1, 0);
  const sheathed = { pos: mouth.clone(), quat: sheathQ };

  // the right hand: across in front of the belly (never through it) to the hilt
  const rShoulder = body.bones.rightUpperArm.getWorldPosition(new THREE.Vector3());
  const lShoulder = body.bones.leftUpperArm.getWorldPosition(new THREE.Vector3());
  const chest = body.bones.chest.getWorldPosition(new THREE.Vector3());
  const fwd = V(0, 0, 1).applyQuaternion(body.bones.spine.getWorldQuaternion(new THREE.Quaternion()));
  const slide = phase(t, 0.82, 1.45, ease.inOut) * (SWORD.blade + 0.04);
  const swing = phase(t, 1.42, 2.05, ease.inOut);
  // the sword's way: out along the scabbard, then the point swings out to the left and round to the front
  const outAt = mouth.clone().addScaledVector(into, -slide);
  const guardAt = body.bones.upperChest.getWorldPosition(new THREE.Vector3()).add(V(-0.03, -0.24, 0).multiplyScalar(k)).addScaledVector(fwd, 0.42 * k);
  const guardQ = frame(V(0, 0.7, 1).applyQuaternion(hips.getWorldQuaternion(new THREE.Quaternion())), V(1, 0, 0).applyQuaternion(hq));
  const sideQ = frame(V(1, 0.1, 0.35).applyQuaternion(hq), V(0, 1, 0));
  let swordQ = sheathQ.clone();
  if (swing > 0) swordQ = swing < 0.5 ? sheathQ.clone().slerp(sideQ, swing * 2) : sideQ.clone().slerp(guardQ, swing * 2 - 1);
  const swordAt = bend(outAt, outAt.clone().lerp(guardAt, 0.5).add(V(0.12, 0.1, 0.08).multiplyScalar(k)), guardAt, swing);
  if (swing <= 0) swordAt.copy(outAt);

  const reachR = phase(t, 0.3, 0.74, ease.inOut);
  if (reachR > 0) {
    const g = holdOf(body, 'right', swordAt, swordQ, 0.05, palmLocal);
    const hb = body.bones.rightHand;
    const now = hb.getWorldPosition(new THREE.Vector3()), nowQ = hb.getWorldQuaternion(new THREE.Quaternion());
    // on the way: a curve bowed out in front of the body
    const via = now.clone().lerp(g.pos, 0.5).addScaledVector(fwd, 0.2 * k).add(V(0, 0.03, 0));
    const p = reachR < 1 ? bend(now, via, g.pos, reachR) : g.pos;
    reach(body, 'right', p, { pole: rShoulder.clone().add(V(-0.45, -0.25, 0.25).multiplyScalar(k)), hand: nowQ.slerp(g.quat, ease.inOut(reachR)) });
  }
  // the sword: in the scabbard until the hand has it, then wherever the hand takes it
  const S = t > 0.74 ? swordFromHand(body, 'right', 0.05, palmLocal) : sheathed;
  sword.position.copy(S.pos); sword.quaternion.copy(S.quat);

  // the left hand: on the scabbard's throat, thumb towards the mouth; then onto the grip below the right
  const onSheath = phase(t, 0.25, 0.58) * (1 - phase(t, 1.5, 1.7));
  const onGrip = phase(t, 1.7, 2.1);
  const hbL = body.bones.leftHand;
  const nowL = hbL.getWorldPosition(new THREE.Vector3()), nowLQ = hbL.getWorldQuaternion(new THREE.Quaternion());
  if (onGrip > 0) {
    const g = holdOf(body, 'left', S.pos, S.quat, 0.05 + 0.085, palmLocal);
    const via = nowL.clone().lerp(g.pos, 0.5).addScaledVector(fwd, 0.12 * k);
    reach(body, 'left', onGrip < 1 ? bend(nowL, via, g.pos, onGrip) : g.pos, { pole: lShoulder.clone().add(V(0.45, -0.3, 0.1).multiplyScalar(k)), hand: nowLQ.slerp(g.quat, onGrip) });
  } else if (onSheath > 0) {
    const out = into.clone().multiplyScalar(-1);
    const g = gripHold(body, 'left', mouth.clone().addScaledVector(into, 0.06 * k), out, V(-0.6, -0.8, 0).applyQuaternion(hq), 0.021);
    reach(body, 'left', nowL.lerp(g.pos, onSheath), { pole: lShoulder.clone().add(V(0.5, -0.2, -0.3).multiplyScalar(k)), hand: nowLQ.slerp(g.quat, onSheath) });
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
