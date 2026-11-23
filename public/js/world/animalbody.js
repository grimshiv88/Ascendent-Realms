// The animals' bodies: built from simple shapes at their real size, with jointed legs that walk,
// trot and gallop, necks that bend down to graze, ears and tails that twitch, and a body that falls
// onto its side when it dies. The look of each kind is in data/animals.mjs.
import * as THREE from 'three';

const mats = new Map();
function mat(color, rough = 0.92) {
  const k = `${color}|${rough}`;
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 }));
  return mats.get(k);
}
const EYE = () => mat('#120c08', 0.3);

function mesh(geo, m, parent, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  parent.add(o);
  return o;
}
const sphere = (r, seg = 14) => new THREE.SphereGeometry(r, seg, Math.max(8, seg - 4));
// a limb hanging down from its joint: `len` long, thicker at the top
function limb(rTop, rBot, len) {
  const g = new THREE.CylinderGeometry(rBot, rTop, len, 9);
  g.translate(0, -len / 2, 0);
  return g;
}
// a curved horn or antler beam along points (in the head's frame)
function tube(points, r, parent, m) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const g = new THREE.TubeGeometry(curve, 12, r, 6, false);
  return mesh(g, m, parent);
}

// ---------- the head ----------
function buildHead(a, parent, T) {
  const head = new THREE.Group();
  parent.add(head);
  const hs = T * (a.shape === 'quad' ? 0.085 : 0.1) * (a.ears === 'round' ? 1.25 : 1);
  const faceM = mat(a.face || a.coat);
  const skull = mesh(sphere(hs), faceM, head);
  skull.scale.set(0.9, 0.95, 1.1);
  const snout = a.snout || (a.ears === 'horse' || a.ears === 'donkey' ? 1.5 : a.ears === 'cow' ? 1.1 : 1);
  const ml = hs * 1.9 * snout;
  const muzzle = mesh(new THREE.CylinderGeometry(hs * 0.42, hs * 0.72, ml, 10), faceM, head);
  muzzle.rotation.x = Math.PI / 2 + 0.38;
  muzzle.position.set(0, -hs * 0.35, ml / 2 + hs * 0.25);
  // the nose, darker
  const tipZ = hs * 0.25 + ml * 0.97, tipY = -hs * 0.35 - Math.sin(0.38) * ml / 2 - hs * 0.1;
  mesh(sphere(hs * 0.42, 10), mat(a.ears === 'cow' ? '#c89a8a' : a.dark, 0.6), head, 0, tipY + hs * 0.1, tipZ).scale.set(1, 0.8, 0.6);
  if (a.blaze) mesh(new THREE.BoxGeometry(hs * 0.25, hs * 0.05, ml * 0.9), mat('#f4f0e8'), muzzle, 0, 0, 0).position.set(0, 0, hs * 0.5);
  // eyes, at the sides
  for (const s of [-1, 1]) mesh(sphere(hs * 0.13, 8), EYE(), head, s * hs * 0.72, hs * 0.2, hs * 0.45);
  // ears
  const earM = mat(a.coat), inM = mat('#c8a090');
  const ear = { deer: [0.5, 0.95, 0.9], horse: [0.28, 0.75, 0.5], donkey: [0.38, 1.6, 0.6], cow: [0.45, 0.6, 1.7], goat: [0.3, 0.7, 1.3], fox: [0.4, 0.8, 0.3], round: [0.35, 0.35, 0.2], small: [0.3, 0.45, 1.4] }[a.ears] || [0.3, 0.6, 1];
  const ears = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group();
    e.position.set(s * hs * 0.55, hs * 0.65, -hs * 0.15);
    e.rotation.z = -s * ear[2];
    head.add(e);
    const cone = mesh(new THREE.ConeGeometry(hs * ear[0], hs * ear[1] * 1.6, 8), earM, e, 0, hs * ear[1] * 0.8, 0);
    cone.scale.z = 0.45;
    mesh(new THREE.ConeGeometry(hs * ear[0] * 0.6, hs * ear[1] * 1.2, 6), inM, cone, 0, -hs * 0.05, hs * 0.08).scale.z = 0.3;
    ears.push(e);
  }
  // horns and antlers
  const hornM = mat(a.horns === 'antlers' || a.horns === 'palms' ? '#c8b494' : '#6a5a48', 0.7);
  const H = hs;
  for (const s of [-1, 1]) {
    if (a.horns === 'antlers') {
      tube([[s * H * 0.35, H * 0.7, -H * 0.1], [s * H * 1.1, H * 2.4, -H * 0.6], [s * H * 1.6, H * 4.2, -H * 0.4], [s * H * 1.4, H * 5.4, H * 0.3]], H * 0.1, head, hornM);
      for (const [k, len] of [[0.35, 1.4], [0.6, 1.6], [0.85, 1.2]]) {
        const y = H * (0.7 + k * 4.4), x = s * H * (0.35 + k * 1.2), z = -H * (0.1 + k * 0.4);
        tube([[x, y, z], [x + s * H * 0.2, y + H * len * 0.6, z + H * len * 0.8], [x + s * H * 0.3, y + H * len, z + H * len * 0.9]], H * 0.07, head, hornM);
      }
    } else if (a.horns === 'palms') {
      tube([[s * H * 0.4, H * 0.6, -H * 0.1], [s * H * 1.6, H * 1.4, -H * 0.3], [s * H * 2.4, H * 1.8, -H * 0.2]], H * 0.13, head, hornM);
      const palm = mesh(new THREE.CylinderGeometry(H * 1.6, H * 1.4, H * 0.12, 14, 1, false, 0, Math.PI), hornM, head, s * H * 2.6, H * 2.2, -H * 0.1);
      palm.rotation.set(Math.PI / 2, 0, s * 1.1);
    } else if (a.horns === 'spikes') {
      tube([[s * H * 0.3, H * 0.6, -H * 0.1], [s * H * 0.5, H * 2.4, -H * 0.9], [s * H * 0.35, H * 3.6, -H * 1.1]], H * 0.09, head, hornM);
    } else if (a.horns === 'sweep') {
      tube([[s * H * 0.3, H * 0.6, 0], [s * H * 0.6, H * 2.4, -H * 1.4], [s * H * 0.7, H * 2.6, -H * 3.2], [s * H * 0.6, H * 1.2, -H * 4.2]], H * 0.2, head, hornM);
    } else if (a.horns === 'curve') {
      tube([[s * H * 0.3, H * 0.6, 0], [s * H * 0.55, H * 1.6, -H * 0.8], [s * H * 0.7, H * 1.5, -H * 1.9]], H * 0.13, head, hornM);
    } else if (a.horns === 'short') {
      tube([[s * H * 0.5, H * 0.55, -H * 0.1], [s * H * 1.2, H * 0.8, -H * 0.1], [s * H * 1.45, H * 1.4, H * 0.1]], H * 0.12, head, mat('#d8d0bc', 0.6));
    }
  }
  if (a.beard) mesh(new THREE.ConeGeometry(hs * 0.22, hs * 0.9, 6), mat(a.dark), head, 0, -hs * 0.95, ml * 0.75).rotation.x = Math.PI;
  return { head, ears, hs };
}

// ---------- four legs ----------
function buildQuad(a, root) {
  const L = a.len, T = a.tall, g = a.girth || 1;
  const legLen = T * (a.legs || 0.55);
  const depth = (T - legLen) * 1.15;
  const r = depth / 2;
  const torsoY = legLen + r * 0.7;
  const W = r * g * 0.92; // half the body's width
  const coat = mat(a.coat), belly = mat(a.belly), dark = mat(a.dark);
  const pose = new THREE.Group(); // turned onto its side when it dies
  root.add(pose);
  const body = new THREE.Group();
  body.position.y = torsoY;
  pose.add(body);
  const span = Math.max(0.02, L * 0.6 - 2 * r);
  const torso = mesh(new THREE.CapsuleGeometry(r, span, 6, 14), a.wool ? mat(a.coat, 1) : coat, body);
  torso.rotation.x = Math.PI / 2;
  torso.scale.set(g * 0.92, 1, 1);
  // chest and haunches, so it isn't a plain tube
  const chest = mesh(sphere(r * 1.05), a.shag ? mat(a.dark) : coat, body, 0, r * 0.08, L * 0.22);
  chest.scale.set(g * 0.92, a.shag ? 1.3 : 1, 1);
  for (const s of [-1, 1]) mesh(sphere(r * 0.72), coat, body, s * W * 0.45, r * 0.05, -L * 0.2).scale.set(0.8, 1.05, 1.1);
  mesh(sphere(r * 0.9), belly, body, 0, -r * 0.35, 0).scale.set(g * 0.85, 0.6, span / r * 0.5 + 1);
  if (a.hump) mesh(sphere(T * a.hump * 0.55), coat, body, 0, r * 0.85, a.ears === 'cow' ? L * 0.15 : 0).scale.set(0.9, 1, 1.4);
  if (a.wool) for (let i = 0; i < 14; i++) {
    const t = i / 14 * Math.PI * 2, k = (i % 3) / 3;
    mesh(sphere(r * 0.42, 8), mat(a.coat, 1), body, Math.cos(t) * W * 0.8, Math.sin(t) * r * 0.7 + r * 0.1, (k - 0.33) * L * 0.5);
  }
  if (a.patches) for (const [x, y, z, s] of [[1, 0.3, 0.12, 0.8], [-1, 0.1, -0.12, 0.85], [1, -0.1, -0.22, 0.6], [-1, 0.45, 0.2, 0.7], [0, 1, -0.05, 0.7]]) {
    const p = mesh(sphere(r * s, 10), mat(a.patches), body, x * W * 0.72, y * r * 0.75, z * L);
    p.scale.set(x ? 0.42 : 1.1, x ? 1 : 0.38, 1.2);
  }
  if (a.udder) mesh(sphere(r * 0.32), mat('#e8b4a8', 0.7), body, 0, -r * 0.85, -L * 0.12);
  // legs: each a thigh and a shin, with a hoof (or paw)
  const legs = [];
  const thick = Math.max(0.016, T * 0.045) * (g > 1.2 ? 1.2 : 1);
  for (const [fx, fz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const front = fz > 0;
    const hip = new THREE.Group();
    const hipY = torsoY - r * 0.05; // the thigh starts inside the body, so it grows out of it
    hip.position.set(fx * W * 0.6, hipY, fz * L * (front ? 0.24 : 0.22));
    pose.add(hip);
    const up = hipY * 0.52, low = hipY - up;
    mesh(limb(thick * (front ? 1.9 : 2.6), thick, up), coat, hip);
    const knee = new THREE.Group();
    knee.position.y = -up;
    hip.add(knee);
    mesh(limb(thick, thick * 0.75, low - thick * 1.2), a.shape === 'quad' && a.ears === 'fox' ? dark : coat, knee);
    const hoof = mesh(new THREE.CylinderGeometry(thick * 0.85, thick * 1.05, thick * 1.4, 8), mat(a.hooves || a.dark, 0.6), knee, 0, -low + thick * 0.7, thick * 0.15);
    hoof.scale.z = a.ears === 'round' ? 1.8 : 1.15;
    legs.push({ hip, knee, front, side: fx, base: 0 });
  }
  // neck and head
  const neckLen = (a.neck || 0.4) * T * 0.7;
  const tilt = 0.95 - (a.neckUp || 0) - (a.ears === 'horse' ? 0.2 : 0);
  const neck = new THREE.Group();
  neck.position.set(0, torsoY + r * 0.35, L * 0.27);
  neck.rotation.x = tilt;
  pose.add(neck);
  mesh(limb(r * 0.62 * (a.shag ? 1.4 : 1), r * 0.48, neckLen + r * 0.3), coat, neck, 0, neckLen + r * 0.15, 0);
  if (a.mane) {
    const mane = mesh(new THREE.BoxGeometry(r * 0.16, neckLen * 1.05, r * 0.35), mat(a.dark, 1), neck, 0, neckLen * 0.5, -r * 0.42);
    mane.rotation.x = 0.05;
  }
  const hd = buildHead(a, neck, T);
  hd.head.position.y = neckLen;
  hd.head.rotation.x = -tilt + 0.15;
  // tail
  const tail = new THREE.Group();
  tail.position.set(0, torsoY + r * 0.45, -L * 0.3);
  pose.add(tail);
  const tm = mat(a.tail === 'long' || a.tail === 'tuft' ? a.dark : a.coat, 1);
  if (a.tail === 'long') { mesh(limb(r * 0.2, r * 0.1, T * 0.55), tm, tail).rotation.x = 0; tail.rotation.x = -0.35; }
  else if (a.tail === 'tuft') { mesh(limb(r * 0.05, r * 0.04, T * 0.45), mat(a.coat), tail); mesh(sphere(r * 0.12, 8), tm, tail, 0, -T * 0.47, 0).scale.y = 2; tail.rotation.x = -0.15; }
  else if (a.tail === 'brush') { const b = mesh(new THREE.CapsuleGeometry(r * 0.3, L * 0.4, 4, 8), tm, tail, 0, -L * 0.25, 0); mesh(sphere(r * 0.25, 8), mat('#f4f0e8'), b, 0, -L * 0.25, 0); tail.rotation.x = -1.0; }
  else if (a.tail === 'short') { mesh(new THREE.ConeGeometry(r * 0.18, r * 0.6, 8), mat(a.belly), tail, 0, -r * 0.2, 0).rotation.x = Math.PI; tail.rotation.x = -0.5; }
  else mesh(sphere(r * 0.12, 8), tm, tail);
  return { pose, body, legs, neck, tilt, head: hd.head, ears: hd.ears, tail, torsoY, W, legLen, stride: legLen * 1.5 };
}

// ---------- a rabbit or hare ----------
function buildHopper(a, root) {
  const L = a.len, T = a.tall;
  const coat = mat(a.coat), belly = mat(a.belly);
  const pose = new THREE.Group(); root.add(pose);
  const body = new THREE.Group(); pose.add(body);
  const r = T * 0.42;
  body.position.y = r * 1.05;
  mesh(sphere(r), coat, body, 0, 0, -L * 0.1).scale.set(0.95, 1, 1.25);
  mesh(sphere(r * 0.75), coat, body, 0, r * 0.15, L * 0.18);
  mesh(sphere(r * 0.7), belly, body, 0, -r * 0.3, L * 0.05).scale.set(0.8, 0.6, 1.2);
  // big folded hind legs and long feet
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * r * 0.55, r * 0.75, -L * 0.18); pose.add(hip);
    mesh(sphere(r * 0.55), coat, hip, 0, -r * 0.2, 0).scale.set(0.6, 1, 1.2);
    const knee = new THREE.Group(); knee.position.set(0, -r * 0.6, -r * 0.1); hip.add(knee);
    mesh(new THREE.BoxGeometry(r * 0.28, r * 0.18, L * 0.38), mat(a.belly), knee, 0, -r * 0.1, L * 0.1);
    legs.push({ hip, knee, front: false, side: s });
    const fh = new THREE.Group(); fh.position.set(s * r * 0.35, r * 0.75, L * 0.22); pose.add(fh);
    mesh(limb(r * 0.14, r * 0.1, r * 0.8), coat, fh);
    const fk = new THREE.Group(); fk.position.y = -r * 0.8; fh.add(fk);
    legs.push({ hip: fh, knee: fk, front: true, side: s });
  }
  const neck = new THREE.Group(); neck.position.set(0, r * 1.55, L * 0.3); neck.rotation.x = 0.4; pose.add(neck);
  const head = new THREE.Group(); neck.add(head); head.rotation.x = -0.4;
  const hs = r * 0.55;
  mesh(sphere(hs), coat, head).scale.set(0.85, 0.9, 1.2);
  mesh(sphere(hs * 0.45, 8), mat('#d8a8a0', 0.5), head, 0, -hs * 0.15, hs * 1.1);
  for (const s of [-1, 1]) mesh(sphere(hs * 0.18, 8), EYE(), head, s * hs * 0.7, hs * 0.2, hs * 0.5);
  const ears = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(s * hs * 0.35, hs * 0.7, -hs * 0.3); e.rotation.set(-0.35, 0, -s * 0.18); head.add(e);
    const c = mesh(new THREE.CapsuleGeometry(hs * 0.28, hs * (a.ears === 'long' ? 2.4 : 1.5), 4, 8), coat, e, 0, hs * 1.3, 0);
    c.scale.z = 0.4;
    mesh(new THREE.CapsuleGeometry(hs * 0.16, hs * 2, 4, 6), mat('#d8b0a0'), c, 0, 0, hs * 0.06).scale.z = 0.3;
    if (a.dark) mesh(sphere(hs * 0.2, 6), mat(a.dark), c, 0, hs * 1.4, 0).scale.z = 0.4;
    ears.push(e);
  }
  const tail = new THREE.Group(); tail.position.set(0, r * 1.25, -L * 0.42); pose.add(tail);
  mesh(sphere(r * 0.28, 10), mat('#f4f0ea', 1), tail);
  return { pose, body, legs, neck, tilt: 0.4, head, ears, tail, torsoY: r * 1.05, W: r * 0.95, legLen: r, stride: L * 1.6, hop: true };
}

// ---------- a bird ----------
function buildBird(a, root) {
  const L = a.len, T = a.tall;
  const coat = mat(a.coat), belly = mat(a.belly);
  const pose = new THREE.Group(); root.add(pose);
  const legLen = T * (a.longNeck ? 0.28 : 0.34);
  const r = L * 0.3;
  const body = new THREE.Group(); body.position.y = legLen + r * 0.8; pose.add(body);
  mesh(sphere(r), coat, body).scale.set(0.85, 0.85, 1.35);
  mesh(sphere(r * 0.85), belly, body, 0, -r * 0.22, r * 0.25).scale.set(0.8, 0.75, 1.1);
  // wings folded at the sides
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(s * r * 0.72, r * 0.2, r * 0.2); body.add(w);
    mesh(sphere(r * 0.75, 10), mat(a.coat, 0.85), w, 0, 0, -r * 0.45).scale.set(0.25, 0.6, 1.4);
    wings.push(w);
  }
  if (a.fan) {
    const fan = mesh(new THREE.CylinderGeometry(r * 1.6, r * 1.6, r * 0.08, 16, 1, false, -Math.PI / 2, Math.PI), mat(a.coat), body, 0, r * 0.5, -r * 1.1);
    fan.rotation.x = Math.PI / 2 - 0.25;
  } else mesh(new THREE.ConeGeometry(r * 0.45, r * 1.1, 8), mat(a.coat), body, 0, r * 0.35, -r * 1.35).rotation.x = -Math.PI / 2 - 0.5;
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * r * 0.35, legLen, 0); pose.add(hip);
    mesh(limb(L * 0.03, L * 0.02, legLen * 0.5), mat(a.dark, 0.6), hip);
    const knee = new THREE.Group(); knee.position.y = -legLen * 0.5; hip.add(knee);
    mesh(limb(L * 0.02, L * 0.018, legLen * 0.5), mat(a.dark, 0.6), knee);
    for (const k of [-0.5, 0, 0.5]) { const toe = mesh(new THREE.BoxGeometry(L * 0.012, L * 0.01, L * 0.12), mat(a.dark, 0.6), knee, 0, -legLen * 0.5, L * 0.04); toe.rotation.y = k; }
    legs.push({ hip, knee, front: true, side: s });
  }
  const neckLen = T * (a.longNeck ? 0.4 : 0.22);
  const neck = new THREE.Group(); neck.position.set(0, legLen + r * 1.2, r * 0.9); neck.rotation.x = 0.25; pose.add(neck);
  mesh(limb(r * 0.32, r * 0.26, neckLen), mat(a.head || a.coat), neck, 0, neckLen, 0);
  const head = new THREE.Group(); head.position.y = neckLen; head.rotation.x = -0.25; neck.add(head);
  const hs = r * (a.longNeck ? 0.38 : 0.45);
  mesh(sphere(hs, 10), mat(a.head || a.coat), head);
  const beak = mesh(new THREE.ConeGeometry(hs * (a.water ? 0.5 : 0.35), hs * (a.water ? 1.8 : 1.1), 8), mat(a.beak, 0.5), head, 0, -hs * 0.1, hs * 1.2);
  beak.rotation.x = Math.PI / 2;
  if (a.water) beak.scale.x = 1.5;
  for (const s of [-1, 1]) mesh(sphere(hs * 0.18, 6), EYE(), head, s * hs * 0.75, hs * 0.2, hs * 0.35);
  if (a.comb) {
    mesh(new THREE.BoxGeometry(hs * 0.18, hs * 0.6, hs * 1.1), mat('#c81e1e', 0.6), head, 0, hs * 0.9, hs * 0.1);
    mesh(sphere(hs * 0.25, 6), mat('#c81e1e', 0.6), head, 0, -hs * 0.85, hs * 0.75).scale.y = 1.6;
  }
  return { pose, body, legs, neck, tilt: 0.25, head, ears: [], wings, tail: new THREE.Group(), torsoY: legLen + r * 0.8, W: r * 0.85, legLen, stride: legLen * 2, bird: true };
}

// The whole animal, facing +z, feet on y = 0
export function buildAnimal(a) {
  const root = new THREE.Group();
  const parts = a.shape === 'bird' ? buildBird(a, root) : a.shape === 'hopper' ? buildHopper(a, root) : buildQuad(a, root);
  parts.phase = Math.random() * 10;
  parts.seed = Math.random() * 100;
  parts.last = null;
  root.userData.beast = parts;
  root.userData.height = a.shape === 'quad' ? a.tall * 1.12 : a.tall;
  return root;
}

// Walk, trot, gallop or hop at `speed` m/s; graze, look about and swish the tail when still.
export function animateAnimal(root, t, speed = 0) {
  const p = root.userData.beast;
  if (!p || p.dying) return;
  const dt = p.last === null ? 0 : Math.min(0.1, t - p.last);
  p.last = t;
  p.phase += dt * (speed / p.stride) * Math.PI * 2;
  const ph = p.phase;
  const run = speed > p.stride * 2.4;
  const amp = Math.min(0.85, speed * 0.12 + (speed > 0.05 ? 0.25 : 0));
  if (p.hop) {
    // a hop: hind legs kick, the body lifts and pitches
    const k = speed > 0.1 ? Math.abs(Math.sin(ph)) : 0;
    p.pose.position.y = k * p.torsoY * 0.9;
    p.pose.rotation.x = speed > 0.1 ? Math.cos(ph) * 0.25 : 0;
    for (const l of p.legs) l.hip.rotation.x = l.front ? -k * 0.6 : k * 0.9;
  } else {
    for (let i = 0; i < p.legs.length; i++) {
      const l = p.legs[i];
      // walking: one foot after another round the body; galloping: front pair, then hind pair
      const off = p.bird ? (l.side > 0 ? Math.PI : 0)
        : run ? (l.front ? 0 : Math.PI) + (l.side > 0 ? 0.6 : 0)
          : [Math.PI * 0.5, Math.PI * 1.5, 0, Math.PI][i];
      const s = Math.sin(ph + off), c = Math.cos(ph + off);
      l.hip.rotation.x = -s * amp * (p.bird ? 0.9 : 0.75);
      l.knee.rotation.x = Math.max(0, c) * amp * (l.front ? 1.3 : 0.9) * (p.bird ? -1 : 1);
    }
    p.body.position.y = p.torsoY + (speed > 0.05 ? Math.abs(Math.sin(ph * (run ? 1 : 2))) * p.legLen * (run ? 0.08 : 0.03) : 0);
    p.pose.rotation.x = run ? Math.sin(ph) * 0.06 : 0;
  }
  // grazing (head down to the grass) now and then while standing; a bird pecks
  const still = speed < 0.05;
  const g = still ? Math.min(1, Math.max(0, Math.sin(t * 0.35 + p.seed) * 2.2 - 0.9)) : 0;
  p.graze = (p.graze || 0) + (g - (p.graze || 0)) * Math.min(1, dt * 3);
  const peck = p.bird && still ? Math.max(0, Math.sin(t * 5 + p.seed)) * 0.6 * p.graze : 0;
  p.neck.rotation.x = p.tilt + p.graze * (p.bird ? 0.9 : 1.25) + peck + (p.bird && !still ? Math.sin(ph * 2) * 0.15 : 0);
  p.neck.rotation.y = still ? Math.sin(t * 0.5 + p.seed * 2) * 0.25 * (1 - p.graze) : 0;
  for (let i = 0; i < p.ears.length; i++) p.ears[i].rotation.x = Math.sin(t * 7 + i + p.seed) > 0.96 ? -0.3 : 0;
  p.tail.rotation.z = Math.sin(t * 2.2 + p.seed) * 0.3;
  if (p.wings) for (const w of p.wings) w.rotation.z = speed > 3.5 ? Math.sin(t * 25) * 0.8 * (w.position.x > 0 ? -1 : 1) : 0;
}

// Fallen: it rolls onto its side (k from 0 to 1), legs stiff
export function lieDown(root, k) {
  const p = root.userData.beast;
  if (!p) return;
  p.dying = true;
  const e = 1 - (1 - Math.min(1, k)) ** 3;
  p.pose.rotation.set(0, 0, e * Math.PI / 2);
  p.pose.position.set(e * p.torsoY * 0.95, e * p.W * 0.95, 0);
  for (const l of p.legs) { l.hip.rotation.x = (l.front ? -0.3 : 0.3) * e; l.knee.rotation.x = 0.1 * e; }
  p.neck.rotation.x = p.tilt + 0.4 * e;
}
