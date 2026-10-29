// Builds every race's 3D body from simple shapes, at real-world size (1 unit = 1 metre).
// Monster races have two forms: 'monster' (their creature body) and 'humanoid' (a person-shaped
// body that keeps the monster's look). `stage` 0–5 is the evolution stage: each one makes the
// body clearly bigger and adds new parts. `growth` 0–1 is the small growth between evolutions.
import * as THREE from 'three';
import { childSize } from '../data/birth.mjs';
import { APPEARANCE } from '../data/game-data.mjs';
import { hasSculpt, sculptedRig } from './sculpt.js';
import {
  sculptedHumanoid, goblinHead, pointedEars, hair, raggedSkirt, flap, belt, wraps, chestStrap,
  furMantle, toothNecklace, warPaint, spikedCrown,
} from './anatomy.js';

const TAU = Math.PI * 2;

// ---------- materials ----------

function makeMaterials(raceId, look, stage) {
  const pal = APPEARANCE[raceId];
  const skinHex = look.skin || pal.skin[0];
  const accentHex = look.accent || pal.accent[0];
  const eyeHex = look.eyes || pal.eyes[0];
  const slime = raceId === 'slime';
  const glow = 0.15 + stage * 0.12;
  return {
    skin: new THREE.MeshStandardMaterial({
      color: skinHex, roughness: slime ? 0.15 : 0.72, metalness: slime ? 0.05 : 0.02,
      transparent: slime, opacity: slime ? 0.72 : 1,
    }),
    belly: new THREE.MeshStandardMaterial({ color: new THREE.Color(skinHex).lerp(new THREE.Color(accentHex), 0.35), roughness: 0.75 }),
    accent: new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ color: new THREE.Color(skinHex).multiplyScalar(0.45), roughness: 0.8 }),
    bone: new THREE.MeshStandardMaterial({ color: '#e9e0c8', roughness: 0.55 }),
    cloth: new THREE.MeshStandardMaterial({ color: '#5a4630', roughness: 0.9 }),
    metal: new THREE.MeshStandardMaterial({ color: stage >= 4 ? '#d9a93a' : '#8f949c', roughness: 0.35, metalness: 0.8 }),
    eye: new THREE.MeshStandardMaterial({ color: eyeHex, emissive: eyeHex, emissiveIntensity: 0.6 + stage * 0.25, roughness: 0.2 }),
    pupil: new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.3 }),
    glow: new THREE.MeshStandardMaterial({ color: eyeHex, emissive: eyeHex, emissiveIntensity: glow * 3, transparent: true, opacity: 0.85 }),
    wing: new THREE.MeshStandardMaterial({
      color: raceId === 'fairy' ? accentHex : new THREE.Color(skinHex).multiplyScalar(0.7),
      emissive: raceId === 'fairy' ? accentHex : '#000000', emissiveIntensity: raceId === 'fairy' ? 0.35 + stage * 0.1 : 0,
      transparent: true, opacity: raceId === 'fairy' ? 0.55 : 0.92, side: THREE.DoubleSide, roughness: 0.5,
    }),
    slimeCore: new THREE.MeshStandardMaterial({ color: accentHex, emissive: eyeHex, emissiveIntensity: 0.3 + stage * 0.2, roughness: 0.3 }),
  };
}

// ---------- shape helpers ----------

const SPHERE = new THREE.SphereGeometry(1, 28, 20);
const CONE = new THREE.ConeGeometry(1, 1, 18);

function ellipsoid(rx, ry, rz, mat) {
  const m = new THREE.Mesh(SPHERE, mat);
  m.scale.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

function cone(r, h, mat) {
  const m = new THREE.Mesh(CONE, mat);
  m.scale.set(r, h, r);
  m.castShadow = true;
  return m;
}

// A limb segment hanging down from its joint: returns the segment and the joint at its far end.
function segment(len, r1, r2, mat) {
  const joint = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, 18), mat);
  body.position.y = -len / 2;
  body.castShadow = true;
  joint.add(body);
  const knob = ellipsoid(r2 * 1.02, r2 * 1.02, r2 * 1.02, mat);
  knob.position.y = -len;
  joint.add(knob);
  const end = new THREE.Group();
  end.position.y = -len;
  joint.add(end);
  return { joint, end };
}

// A curved horn: a chain of shrinking cones bending back.
function horn(len, r, bend, mat) {
  const g = new THREE.Group();
  let parent = g;
  const n = 4;
  for (let i = 0; i < n; i++) {
    const k = 1 - i / n;
    const piece = new THREE.Group();
    const c = cone(r * k, len / n * 1.15, mat);
    c.position.y = len / n / 2;
    piece.add(c);
    piece.rotation.x = i === 0 ? 0 : -bend;
    if (i > 0) piece.position.y = len / n;
    parent.add(piece);
    parent = piece;
  }
  return g;
}

// A tapering tail made of linked segments, hanging back along -Z.
function tail(len, r, mat, { segments = 7, droop = 0.12, tip = null } = {}) {
  const root = new THREE.Group();
  let parent = root;
  const parts = [];
  for (let i = 0; i < segments; i++) {
    const k = 1 - i / segments;
    const piece = new THREE.Group();
    const l = len / segments;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * k, r * (k - 1 / segments) + 0.004, l * 1.08, 14), mat);
    m.rotation.x = Math.PI / 2;
    m.position.z = -l / 2;
    m.castShadow = true;
    piece.add(m);
    if (i > 0) piece.position.z = -l;
    piece.rotation.x = -droop;
    parent.add(piece);
    parts.push(piece);
    parent = piece;
  }
  if (tip) parent.add(tip);
  root.userData.parts = parts;
  return root;
}

// A wing shape: bat-like for dragons, rounded for fairies.
function wing(span, mat, kind) {
  const s = new THREE.Shape();
  if (kind === 'fairy') {
    s.moveTo(0, 0);
    s.bezierCurveTo(span * 0.3, span * 0.9, span * 1.0, span * 0.8, span * 0.9, span * 0.25);
    s.bezierCurveTo(span * 0.8, 0, span * 0.4, -span * 0.1, 0, 0);
    s.moveTo(0, 0);
  } else {
    s.moveTo(0, 0);
    s.lineTo(span * 0.35, span * 0.55);
    s.lineTo(span * 1.0, span * 0.45);
    s.quadraticCurveTo(span * 0.85, span * 0.2, span * 0.9, -span * 0.05);
    s.quadraticCurveTo(span * 0.68, 0.0, span * 0.62, -span * 0.25);
    s.quadraticCurveTo(span * 0.45, -span * 0.12, span * 0.32, -span * 0.38);
    s.quadraticCurveTo(span * 0.2, -span * 0.12, 0, -span * 0.15);
    s.lineTo(0, 0);
  }
  const m = new THREE.Mesh(new THREE.ShapeGeometry(s, 16), mat);
  m.castShadow = true;
  const g = new THREE.Group();
  g.add(m);
  if (kind !== 'fairy') {
    // finger bones along the leading edges
    const boneMat = new THREE.MeshStandardMaterial({ color: mat.color.clone().multiplyScalar(0.6), roughness: 0.6 });
    for (const [x, y] of [[0.35, 0.55], [1.0, 0.45], [0.9, -0.05], [0.62, -0.25]]) {
      const len = Math.hypot(x, y) * span;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(span * 0.012, span * 0.02, len, 6), boneMat);
      b.position.set((x * span) / 2, (y * span) / 2, 0.002);
      b.rotation.z = -Math.atan2(x, y);
      g.add(b);
    }
  }
  return g;
}

function addEyes(head, r, mats, { spacing = 0.42, forward = 0.82, height = 0.12, size = 0.17, slit = false } = {}) {
  for (const side of [-1, 1]) {
    const eye = ellipsoid(r * size, r * size, r * size * 0.7, mats.eye);
    eye.position.set(side * r * spacing, r * height, r * forward);
    head.add(eye);
    const pupil = ellipsoid(r * size * (slit ? 0.22 : 0.5), r * size * (slit ? 0.8 : 0.5), r * size * 0.3, mats.pupil);
    pupil.position.set(side * r * spacing, r * height, r * forward + r * size * 0.62);
    head.add(pupil);
  }
}

// ---------- the humanoid body (all player races, and the humanoid form of monsters) ----------

function humanoid(P, mats) {
  // Player races mostly wear boots, so no bare toes unless the race asks for them
  return sculptedHumanoid({ toes: false, muscle: 0.3, ...P }, mats);
}

// Face and head features used by several races
function headFeatures(rig, mats, f) {
  const { head, headR: r } = rig;
  if (f.snout) {
    const len = r * f.snout;
    const snout = ellipsoid(r * (f.snoutWide || 0.48), r * 0.42, len, f.snoutMat || mats.skin);
    snout.position.set(0, -r * 0.18, r * 0.55 + len * 0.55);
    head.add(snout);
    const nose = ellipsoid(r * 0.13, r * 0.09, r * 0.09, mats.dark);
    nose.position.set(0, -r * 0.05, r * 0.55 + len * 1.45);
    head.add(nose);
    if (f.jaw) {
      const jaw = ellipsoid(r * 0.42, r * 0.2, len * 0.9, mats.belly);
      jaw.position.set(0, -r * 0.45, r * 0.5 + len * 0.5);
      head.add(jaw);
    }
  }
  if (f.nose) {
    const nose = cone(r * 0.14, r * f.nose, mats.skin);
    nose.rotation.x = Math.PI / 2.4;
    nose.position.set(0, -r * 0.05, r * 0.95);
    head.add(nose);
  }
  addEyes(head, r, mats, f.eyes || {});
  if (f.brow) {
    const brow = ellipsoid(r * 0.75, r * 0.14, r * 0.3, mats.skin);
    brow.position.set(0, r * 0.35, r * 0.72);
    head.add(brow);
  }
  if (f.ears) {
    for (const side of [-1, 1]) {
      let ear;
      if (f.ears === 'elf') {
        ear = cone(r * 0.16, r * 1.0, mats.skin);
        ear.rotation.z = side * -1.15;
        ear.rotation.x = -0.35;
        ear.position.set(side * r * 1.15, r * 0.25, -r * 0.1);
      } else if (f.ears === 'goblin') {
        ear = cone(r * 0.32, r * 1.3, mats.skin);
        ear.scale.z *= 0.35;
        ear.rotation.z = side * -1.35;
        ear.position.set(side * r * 1.35, r * 0.15, -r * 0.05);
      } else if (f.ears === 'wolf') {
        ear = cone(r * 0.28, r * 0.6, mats.skin);
        ear.scale.z *= 0.5;
        ear.rotation.z = side * -0.3;
        ear.position.set(side * r * 0.55, r * 1.0, -r * 0.15);
      } else {
        ear = ellipsoid(r * 0.14, r * 0.22, r * 0.1, mats.skin);
        ear.position.set(side * r * 0.95, r * 0.05, 0);
      }
      head.add(ear);
    }
  }
  if (f.hair === 'long' || f.hair === 'curly' || f.hair === 'crest') {
    const cap = ellipsoid(r * 0.97, r * 0.8, r * 1.02, mats.accent);
    cap.position.set(0, r * 0.3, -r * 0.08);
    head.add(cap);
    if (f.hair === 'long') {
      const fall = ellipsoid(r * 0.75, r * 1.5, r * 0.35, mats.accent);
      fall.position.set(0, -r * 0.7, -r * 0.7);
      head.add(fall);
    }
    if (f.hair === 'curly') {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU;
        const c = ellipsoid(r * 0.28, r * 0.28, r * 0.28, mats.accent);
        c.position.set(Math.cos(a) * r * 0.75, r * 0.45 + Math.sin(a * 2) * r * 0.1, Math.sin(a) * r * 0.75 - r * 0.1);
        head.add(c);
      }
    }
  }
  if (f.beard) {
    const beard = cone(r * 0.75, r * 1.9, mats.accent);
    beard.name = 'beard';
    beard.rotation.x = Math.PI;
    beard.position.set(0, -r * 1.25, r * 0.55);
    head.add(beard);
    const stache = ellipsoid(r * 0.55, r * 0.14, r * 0.2, mats.accent);
    stache.position.set(0, -r * 0.3, r * 0.92);
    head.add(stache);
  }
  if (f.tusks) {
    for (const side of [-1, 1]) {
      const t = cone(r * 0.09, r * 0.45, mats.bone);
      t.position.set(side * r * 0.32, -r * 0.42, r * 0.85);
      t.rotation.z = side * 0.2;
      head.add(t);
    }
  }
  if (f.fangs) {
    for (const side of [-1, 1]) {
      const t = cone(r * 0.05, r * 0.22, mats.bone);
      t.rotation.x = Math.PI;
      t.position.set(side * r * 0.18, -r * 0.55, r * 0.5 + (f.snout || 0) * r * 0.9);
      head.add(t);
    }
  }
}

// ---------- evolution parts, added on top of any body ----------

function spineSpikes(parent, count, from, to, size, mat) {
  for (let i = 0; i < count; i++) {
    const k = i / Math.max(count - 1, 1);
    const s = cone(size * 0.35, size * (1 - Math.abs(k - 0.4) * 0.8), mat);
    s.position.set(0, from.y + (to.y - from.y) * k, from.z + (to.z - from.z) * k);
    s.rotation.x = -0.5;
    parent.add(s);
  }
}

function crown(head, r, mats, points = 5) {
  const g = new THREE.Group();
  const band = new THREE.Mesh(new THREE.TorusGeometry(r * 0.75, r * 0.07, 8, 32), mats.metal);
  band.rotation.x = Math.PI / 2;
  g.add(band);
  for (let i = 0; i < points; i++) {
    const a = (i / points) * TAU;
    const p = cone(r * 0.1, r * 0.4, mats.metal);
    p.position.set(Math.cos(a) * r * 0.75, r * 0.2, Math.sin(a) * r * 0.75);
    g.add(p);
  }
  g.position.y = r * 0.75;
  head.add(g);
}

function cape(rig, H, mats, color) {
  const geo = new THREE.PlaneGeometry(H * 0.32, H * 0.55, 6, 8);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, -Math.pow((pos.getY(i) / (H * 0.55) - 0.5) * -1, 2) * H * 0.08);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.8 }));
  // hang from the top of the back, behind the chest
  m.position.set(0, H * 0.29 * 0.95 - H * 0.55 / 2, -(rig.backZ ?? H * 0.1));
  m.castShadow = true;
  rig.spine.add(m);
  return m;
}

function shoulderPads(rig, H, mats) {
  for (const a of rig.arms) {
    const k = rig.padScale || 1;
    const pad = ellipsoid(H * 0.075 * k, H * 0.045 * k, H * 0.07 * k, mats.metal);
    pad.position.set(a.side * H * 0.012 * (k - 1), H * 0.02 * k, 0);
    a.shoulder.parent.add(pad);
  }
}

function aura(root, radius, height, mat) {
  const g = new THREE.Group();
  const n = 10;
  for (let i = 0; i < n; i++) {
    const s = ellipsoid(radius * 0.022, radius * 0.022, radius * 0.022, mat);
    const a = (i / n) * TAU;
    s.position.set(Math.cos(a) * radius, height * (0.2 + (i % 4) * 0.2), Math.sin(a) * radius);
    g.add(s);
  }
  g.userData.spin = true;
  root.add(g);
  return g;
}

// ---------- monster bodies ----------

function quadruped(P, mats) {
  // A lizard or dragon on four legs. P.length is nose to tail tip.
  const L = P.length;
  const root = new THREE.Group();
  const rig = { root, legs: [] };
  const bodyH = L * 0.13;
  const torso = new THREE.Group();
  torso.position.y = bodyH * 1.6 * (P.legHeight || 1);
  root.add(torso);
  rig.torso = torso;
  const body = ellipsoid(L * 0.09 * P.bulk, bodyH * 0.75, L * 0.22, mats.skin);
  torso.add(body);
  const belly = ellipsoid(L * 0.075 * P.bulk, bodyH * 0.55, L * 0.2, mats.belly);
  belly.position.y = -bodyH * 0.25;
  torso.add(belly);

  const neck = new THREE.Group();
  neck.position.set(0, bodyH * 0.2, L * 0.2);
  neck.rotation.x = -(P.neckRaise || 0.3);
  torso.add(neck);
  const neckMesh = ellipsoid(L * 0.05 * P.bulk, L * 0.05, L * (P.neckLen || 0.09), mats.skin);
  neckMesh.position.z = L * (P.neckLen || 0.09) * 0.8;
  neck.add(neckMesh);
  const head = new THREE.Group();
  head.position.z = L * (P.neckLen || 0.09) * 1.7;
  head.rotation.x = (P.neckRaise || 0.3) * 0.9;
  neck.add(head);
  rig.head = head;
  const r = L * 0.055;
  rig.headR = r;
  head.add(ellipsoid(r * 0.95, r * 0.8, r, mats.skin));
  const snout = ellipsoid(r * 0.55, r * 0.42, r * 1.1, mats.skin);
  snout.position.set(0, -r * 0.15, r * 1.2);
  head.add(snout);
  const jaw = ellipsoid(r * 0.48, r * 0.2, r * 1.0, mats.belly);
  jaw.position.set(0, -r * 0.48, r * 1.0);
  head.add(jaw);
  addEyes(head, r, mats, { spacing: 0.5, forward: 0.55, height: 0.3, size: 0.22, slit: true });

  for (const [fz, side] of [[1, -1], [1, 1], [-1, -1], [-1, 1]]) {
    const hip = new THREE.Group();
    hip.position.set(side * L * 0.085 * P.bulk, -bodyH * 0.2, fz * L * 0.14);
    torso.add(hip);
    const upper = segment(bodyH * 0.9 * (P.legHeight || 1), L * 0.03 * P.bulk, L * 0.022 * P.bulk, mats.skin);
    upper.joint.rotation.z = side * (P.sprawl ?? 0.6);
    hip.add(upper.joint);
    const lower = segment(bodyH * 0.8 * (P.legHeight || 1), L * 0.022 * P.bulk, L * 0.018 * P.bulk, mats.skin);
    lower.joint.rotation.z = -side * (P.sprawl ?? 0.6) * 1.15;
    upper.end.add(lower.joint);
    const foot = ellipsoid(L * 0.025, L * 0.012, L * 0.04, mats.skin);
    foot.position.z = L * 0.015;
    lower.end.add(foot);
    rig.legs.push({ hip: upper.joint, front: fz > 0, side });
  }
  const t = tail(L * 0.45, L * 0.06 * P.bulk, mats.skin, { segments: 8, droop: 0.06 });
  t.position.set(0, 0, -L * 0.2);
  torso.add(t);
  rig.tail = t;
  return rig;
}

function serpent(P, mats) {
  // A giant snake: a long body lying in S-curves with the front raised.
  const L = P.length;
  const R = L * 0.035 * P.bulk;
  const root = new THREE.Group();
  const rig = { root, parts: [] };
  const n = 24;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const raised = k < 0.22 ? (0.22 - k) / 0.22 : 0;
    pts.push(new THREE.Vector3(Math.sin(k * 9) * L * 0.07 * (k > 0.2 ? 1 : k * 5), R + raised * raised * L * 0.2, L * 0.25 - k * L * 0.6));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, 120, 1, 16, false);
  // taper the tube toward the tail
  const pos = geo.attributes.position;
  const center = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const seg = Math.floor(i / 17);
    const k = seg / 120;
    curve.getPointAt(Math.min(k, 1), center);
    const v = new THREE.Vector3().fromBufferAttribute(pos, i).sub(center);
    const radius = R * (k < 0.1 ? 0.75 + k * 2.5 : 1 - (k - 0.1) * 1.0) * (1 + Math.sin(k * 3) * 0.08);
    v.normalize().multiplyScalar(Math.max(radius, R * 0.08));
    pos.setXYZ(i, center.x + v.x, center.y + v.y, center.z + v.z);
  }
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, mats.skin);
  body.castShadow = true;
  root.add(body);
  rig.body = body;

  const head = new THREE.Group();
  const p0 = curve.getPointAt(0);
  head.position.copy(p0);
  head.position.z += R * 0.6;
  root.add(head);
  rig.head = head;
  const r = R * 1.5;
  rig.headR = r;
  head.add(ellipsoid(r * 0.8, r * 0.5, r * 1.1, mats.skin));
  const jaw = ellipsoid(r * 0.65, r * 0.18, r * 0.95, mats.belly);
  jaw.position.set(0, -r * 0.32, r * 0.1);
  head.add(jaw);
  addEyes(head, r, mats, { spacing: 0.55, forward: 0.55, height: 0.3, size: 0.2, slit: true });
  for (const side of [-1, 1]) {
    const f = cone(r * 0.04, r * 0.4, mats.bone);
    f.rotation.x = Math.PI;
    f.position.set(side * r * 0.25, -r * 0.4, r * 0.8);
    head.add(f);
  }
  if (P.hood) {
    const hood = ellipsoid(r * P.hood, r * P.hood * 0.9, r * 0.12, mats.belly);
    hood.position.set(0, -r * 0.2, -r * 0.9);
    head.add(hood);
  }
  return rig;
}

function blob(P, mats, stage) {
  const S = P.size;
  const root = new THREE.Group();
  const rig = { root };
  const body = ellipsoid(S * 0.55, S * 0.42, S * 0.55, mats.skin);
  body.position.y = S * 0.38;
  root.add(body);
  rig.body = body;
  const top = ellipsoid(S * 0.32, S * 0.3, S * 0.32, mats.skin);
  top.position.y = S * 0.68;
  root.add(top);
  const core = ellipsoid(S * 0.13, S * 0.13, S * 0.13, mats.slimeCore);
  core.position.y = S * 0.42;
  root.add(core);
  rig.core = core;
  const head = new THREE.Group();
  head.position.set(0, S * 0.5, S * 0.25);
  root.add(head);
  rig.head = head;
  rig.headR = S * 0.3;
  const eyeCount = stage >= 3 ? 4 : 2;
  for (let i = 0; i < eyeCount; i++) {
    const row = i < 2 ? 0 : 1;
    const side = i % 2 ? 1 : -1;
    const e = ellipsoid(S * 0.07, S * 0.09, S * 0.04, mats.eye);
    e.position.set(side * S * (row ? 0.22 : 0.14), S * (row ? 0.15 : 0.05), S * (row ? 0.22 : 0.28));
    head.add(e);
    const p = ellipsoid(S * 0.035, S * 0.05, S * 0.02, mats.pupil);
    p.position.copy(e.position);
    p.position.z += S * 0.035;
    head.add(p);
  }
  return rig;
}


// ---------- clothing ----------

const OUTFITS = {
  elf:       { shirt: '#3f6b3a', trousers: '#4a3a28', boots: '#2e2318', skirt: true },
  dwarf:     { shirt: '#7a2e22', trousers: '#4a3a2a', boots: '#2a2018', skirt: true },
  hobbit:    { shirt: '#c9a24a', trousers: '#5a4a2a', boots: null },
  giant:     { shirt: '#6b5a42', trousers: '#4a3e30', boots: '#3a2e22', skirt: true },
  beastkin:  { shirt: '#4a3626', trousers: '#3a3a3a', boots: null, skirt: true },
  goblin:    { shirt: '#5a4630', trousers: null, boots: null },
  fairy:     { shirt: '#6fae6a', trousers: null, boots: null, skirt: true },
  lizardman: { shirt: null, trousers: null, boots: null, skirt: true, skirtColor: '#6a4a2a' },
  naga:      { shirt: '#3a2a5a', trousers: null, boots: null, skirt: true },
  dragonewt: { shirt: null, trousers: null, boots: null, skirt: true, skirtColor: '#8f949c', metal: true },
};

function clothMat(hex, metal) {
  return new THREE.MeshStandardMaterial({ color: hex, roughness: metal ? 0.35 : 0.88, metalness: metal ? 0.75 : 0 });
}

function dress(rig, raceId) {
  const o = OUTFITS[raceId];
  if (!o || !rig.belly) return;
  const { H, bulk, torsoLen } = rig;
  if (o.shirt) {
    const shirt = clothMat(o.shirt);
    for (const part of [rig.chest, rig.belly]) {
      const c = new THREE.Mesh(part.geometry, shirt);
      c.scale.copy(part.scale).multiplyScalar(1.07);
      c.position.copy(part.position);
      c.castShadow = true;
      part.parent.add(c);
    }
    // muscle shapes sit under the shirt
    for (const part of rig.muscleParts || []) part.visible = false;
    rig.shirt = true;
    for (const a of rig.arms) {
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.047 * bulk, H * 0.042 * bulk, a.len * 0.6, 14), shirt);
      sleeve.position.y = -a.len * 0.28;
      sleeve.castShadow = true;
      a.shoulder.add(sleeve);
    }
  }
  if (o.trousers) {
    const pants = clothMat(o.trousers);
    const p = new THREE.Mesh(rig.pelvis.geometry, pants);
    p.scale.copy(rig.pelvis.scale).multiplyScalar(1.06);
    rig.pelvis.parent.add(p);
    for (const leg of rig.legs) {
      leg.hip.traverse((obj) => { if (obj.isMesh && obj.material.name !== 'boot') obj.material = pants; });
    }
  }
  if (o.boots) {
    const boot = clothMat(o.boots);
    boot.name = 'boot';
    for (const leg of rig.legs) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.044 * bulk, H * 0.036 * bulk, leg.shinLen * 0.55, 14), boot);
      b.position.y = -leg.shinLen * 0.75;
      b.castShadow = true;
      leg.knee.add(b);
    }
  }
  if (o.skirt) {
    const mat = clothMat(o.skirtColor || o.shirt || '#5a4630', o.metal);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.11 * bulk, H * 0.135 * bulk, H * 0.13, 20, 1, true), mat);
    skirt.material.side = THREE.DoubleSide;
    skirt.position.y = -H * 0.045;
    skirt.castShadow = true;
    rig.hips.add(skirt);
  }
  const belt = new THREE.Mesh(new THREE.TorusGeometry(H * 0.105 * bulk, H * 0.012, 8, 28), clothMat('#2a1e14'));
  belt.rotation.x = Math.PI / 2;
  belt.position.y = H * 0.025;
  belt.scale.z = 0.78;
  rig.hips.add(belt);
  const buckle = ellipsoid(H * 0.016, H * 0.014, H * 0.006, clothMat('#c9a24a', true));
  buckle.position.set(0, H * 0.025, H * 0.08 * bulk);
  rig.hips.add(buckle);
}

// ---------- race definitions ----------

const PLAYER_RACES = ['elf', 'dwarf', 'hobbit', 'giant', 'beastkin'];

// ---------- monster evolutions ----------
// Evolutions change the body itself, like the Goblin line: the posture straightens, the body gets
// taller and more muscular, the hair grows, and the clothing gets richer. The last stage wears a crown.

// The Goblin line, stage by stage (h = monster-form height, hh = humanoid-form height, in metres).
// Each evolution is clearly bigger than the one before.
const GOBLIN_STAGES = [
  { // Goblin: small, skinny and crouched, bald, huge ears, a rag skirt and a strap
    h: 1.0, hh: 1.55, bulk: 0.85, muscle: 0.05, belly: 0.3, head: 1.7, hunch: 0.22, bend: 0.6, spread: 0.12, arm: 0.45, leg: 0.4,
    ears: 1.6, nose: 0.5, hand: 1.25, fingers: 1.3, hair: null,
    outfit: { skirt: { color: '#5b5a34', height: 0.1, tears: 0.9 }, strap: '#4a3424' },
  },
  { // Hobgoblin: taller and lean with shaggy hair, a red skirt and cloth wraps
    h: 1.55, hh: 1.9, bulk: 0.88, muscle: 0.45, head: 1.2, hunch: 0.14, bend: 0.2, arm: 0.42, leg: 0.45,
    ears: 1.3, nose: 0.38, hand: 1.15, fingers: 1.1, hair: { volume: 1, length: 0.8, spiky: 1.3, swept: true },
    outfit: { skirt: { color: '#7d2a20', height: 0.15 }, belt: { color: '#4a2a1a' }, wraps: { color: '#6b2f22' } },
  },
  { // Goblin Chieftain: muscular, war paint, fur mantle, fang necklace and a skull on the belt
    h: 1.9, hh: 2.1, bulk: 1.0, muscle: 0.75, head: 1.02, hunch: 0.08, bend: 0.12, arm: 0.4, leg: 0.46,
    ears: 1.2, nose: 0.34, hand: 1.1, hair: { volume: 1.1, length: 2.2, spiky: 1.2, swept: true },
    outfit: {
      skirt: { color: '#7a2a1e', height: 0.18 }, belt: { color: '#4a2a1a', buckle: 'skull' },
      wraps: { color: '#6b2f22', legs: false }, fur: '#6a4a32', necklace: true, paint: '#8a2418',
    },
  },
  { // Goblin Lord: tall and upright, long hair, a purple loincloth with a gold buckle
    h: 2.25, hh: 2.3, bulk: 1.02, muscle: 0.85, head: 0.92, hunch: 0.03, bend: 0.05, arm: 0.39, leg: 0.48,
    ears: 1.1, nose: 0.3, hand: 1.05, hair: { volume: 1.1, length: 3.2, swept: true },
    outfit: {
      skirt: { color: '#2e2234', height: 0.12 }, front: { color: '#43304f', length: 0.3 }, back: { color: '#43304f', length: 0.2 },
      belt: { color: '#3a2418', buckle: 'gold' },
    },
  },
  { // Ogre Lord: a huge, heavy body, small head, tusks and a darker, greyer skin
    h: 2.65, hh: 2.55, bulk: 1.42, muscle: 1.0, belly: 0.2, chestBroad: 1.12, head: 0.92, hunch: 0.12, bend: 0.08, arm: 0.41, leg: 0.42,
    ears: 0.75, broadNose: true, tusks: true, hand: 1.15, hair: { volume: 0.8, length: 0.5, spiky: 0.7, swept: true },
    skinShift: ['#6b7559', 0.4],
    outfit: { skirt: { color: '#2a2018', height: 0.2, tears: 0.3 }, front: { color: '#2a2018', length: 0.32 }, belt: { color: '#5a3a22', thick: 1.8 } },
  },
  { // Goblin Emperor: the tallest, lean and powerful, long flowing hair, a spiked gold crown,
    // black loincloth with gold trim, brighter skin
    h: 2.85, hh: 2.75, bulk: 1.08, muscle: 0.95, head: 0.84, hunch: 0, bend: 0, arm: 0.39, leg: 0.5,
    ears: 1.15, nose: 0.3, hand: 1.0, hair: { volume: 1.2, length: 5, swept: true },
    skinShift: ['#7aa83c', 0.25],
    outfit: {
      skirt: { color: '#1d1a20', height: 0.1 }, front: { color: '#1d1a20', length: 0.4, trim: '#c99a3a' },
      back: { color: '#1d1a20', length: 0.3, trim: '#c99a3a' }, belt: { color: '#2a1e14', buckle: 'gold' }, crown: true,
    },
  },
];

// The same pattern for the other monster races' humanoid forms, relative to their stage-0 body.
const MONSTER_TIERS = [
  { h: 1.0, muscle: 0.1, bulk: 0.92, hunch: 0.12, outfit: 'rag' },
  { h: 1.2, muscle: 0.4, bulk: 0.97, hunch: 0.06, outfit: 'wrap' },
  { h: 1.36, muscle: 0.65, bulk: 1.02, hunch: 0.03, outfit: 'tribal' },
  { h: 1.52, muscle: 0.82, bulk: 1.04, hunch: 0, outfit: 'lord' },
  { h: 1.7, muscle: 1.0, bulk: 1.35, hunch: 0.08, belly: 0.25, chestBroad: 1.12, outfit: 'brute' },
  { h: 1.85, muscle: 0.92, bulk: 1.08, hunch: 0, outfit: 'emperor' },
];

const RACE_CLOTH = {
  lizardman: { rag: '#5a4a2e', cloth: '#6a4a2a', lord: '#2e4a3a', fur: '#4a3a2a' },
  naga: { rag: '#4a3a5a', cloth: '#3a2a5a', lord: '#5a2a4a', fur: '#3a3040' },
  dragonewt: { rag: '#4a3a2a', cloth: '#7a2a1e', lord: '#2a2a3a', fur: '#3a2a22' },
  slime: { rag: '#3a5a7a', cloth: '#2a4a6a', lord: '#4a2a6a', fur: '#e8e8f0' },
};

function tierOutfit(name, c) {
  switch (name) {
    case 'rag': return { skirt: { color: c.rag, height: 0.1, tears: 0.9 }, strap: '#4a3424' };
    case 'wrap': return { skirt: { color: c.cloth, height: 0.15 }, belt: { color: '#4a2a1a' }, wraps: { color: c.cloth } };
    case 'tribal': return { skirt: { color: c.cloth, height: 0.18 }, belt: { color: '#4a2a1a', buckle: 'skull' }, fur: c.fur, necklace: true };
    case 'lord': return {
      skirt: { color: '#2a2228', height: 0.12 }, front: { color: c.lord, length: 0.24 }, back: { color: c.lord, length: 0.2 },
      belt: { color: '#3a2418', buckle: 'gold' },
    };
    case 'brute': return { skirt: { color: '#2a2018', height: 0.2, tears: 0.3 }, front: { color: '#2a2018', length: 0.32 }, belt: { color: '#5a3a22', thick: 1.8 } };
    default: return {
      skirt: { color: '#1d1a20', height: 0.1 }, front: { color: '#1d1a20', length: 0.4, trim: '#c99a3a' },
      back: { color: '#1d1a20', length: 0.3, trim: '#c99a3a' }, belt: { color: '#2a1e14', buckle: 'gold' }, crown: true,
    };
  }
}

// Put an evolution outfit on a sculpted body.
function wearOutfit(rig, m, o, seed) {
  const H = rig.H;
  if (o.skirt) raggedSkirt(rig, { color: o.skirt.color, height: H * o.skirt.height, tears: o.skirt.tears ?? 0.55, seed });
  if (o.front) flap(rig, { color: o.front.color, length: H * o.front.length, trim: o.front.trim, seed: seed + 1 });
  if (o.back) flap(rig, { color: o.back.color, length: H * o.back.length, trim: o.back.trim, back: true, seed: seed + 2 });
  if (o.belt) belt(rig, m, o.belt);
  if (o.wraps) wraps(rig, o.wraps);
  if (o.strap) chestStrap(rig, o.strap);
  if (o.fur) furMantle(rig, o.fur);
  if (o.necklace) toothNecklace(rig, m);
  if (o.paint) warPaint(rig, o.paint);
}

function shiftSkin(m, [hex, amount]) {
  m.skin.color.lerp(new THREE.Color(hex), amount);
  m.dark.color.copy(m.skin.color).multiplyScalar(0.45);
}

// A monster's humanoid form for the non-goblin races: the race's own body, grown by the tier.
function tieredHumanoid(m, stage, base) {
  const t = MONSTER_TIERS[stage] || MONSTER_TIERS[0];
  const rig = sculptedHumanoid({
    ...base, height: base.height * t.h, bulk: (base.bulk ?? 1) * t.bulk, muscle: t.muscle, belly: t.belly || 0,
    chestBroad: t.chestBroad || 1, hunch: (base.hunch || 0) + t.hunch, toes: base.toes ?? true,
  }, m);
  rig.tier = t;
  return rig;
}

// ---------- race definitions ----------

// Player races grow only a little with each advancement; monsters grow a lot (built into their
// bodies above for humanoid forms, and by scaling for creature forms). `growth` 0–1 is the
// small growth every 10 levels between evolutions.
function scaleFor(race, form, stage, growth, sculpted) {
  if (PLAYER_RACES.includes(race)) return 1 + stage * 0.02 + growth * 0.01;
  if (sculpted) return 1 + growth * 0.04;
  return 1 + stage * 0.2 + growth * 0.06;
}

// The sculpted Dwarf's clothes get richer with each evolution
const DWARF_CLOTHES = [
  { tunic: '#3d5a44', sleeves: '#cdb98f', trousers: '#4a3a2a', belt: '#3a2818', metal: '#a8a08a' },
  { tunic: '#2f4a6a', sleeves: '#d6c7a0', trousers: '#3e3428', belt: '#3a2818', metal: '#b8b0a0' },
  { tunic: '#6a2222', sleeves: '#e0d4b0', trousers: '#3a2e24', belt: '#2e1e12', metal: '#c9a24a' },
  { tunic: '#1e1e24', sleeves: '#7a2a2a', trousers: '#2a2420', belt: '#1a120c', metal: '#d9b44a' },
  { tunic: '#4a2a6a', sleeves: '#e8dcc0', trousers: '#2a2230', belt: '#2a1a10', metal: '#e0c050' },
  { tunic: '#e8e0cc', sleeves: '#c9a24a', trousers: '#3a3430', belt: '#5a3a1e', metal: '#ffd76a' },
];
function dwarfColors(m, stage) {
  const c = DWARF_CLOTHES[Math.min(5, stage)];
  return { skin: `#${m.skin.color.getHexString()}`, hair: `#${m.accent.color.getHexString()}`, boots: '#2a2018', leather: '#5a3a1e', eyes: '#111111', ...c };
}

// The True Dragon's scales follow the chosen colour; the Ancient Dragon darkens, with gold horns
function dragonColors(m, stage) {
  const scales = m.skin.color.clone();
  if (stage >= 5) scales.lerp(new THREE.Color('#1a1214'), 0.45);
  const hex = (c) => `#${c.getHexString()}`;
  return {
    scales: hex(scales), belly: hex(m.belly.color.clone().lerp(new THREE.Color('#e0b070'), 0.4)),
    wing: hex(scales.clone().multiplyScalar(0.62)), horn: stage >= 5 ? '#d9a93a' : '#e6dcc4', claw: '#1a1414',
  };
}
// the sculpted True Dragon's height, horns included
const DRAGON_HEIGHT = [0, 0, 0, 0, 2.9, 3.3];

const BUILDERS = {
  elf(m, stage) {
    const rig = humanoid({ height: 1.95, bulk: 0.88, legFrac: 0.5, headScale: 0.95, armFrac: 0.37 }, m);
    headFeatures(rig, m, { ears: 'elf', hair: 'long', eyes: { size: 0.2, spacing: 0.4 } });
    barkMarkings(rig, m, 1.95);
    return rig;
  },
  dwarf(m, stage) {
    if (hasSculpt('dwarf')) return sculptedRig('dwarf', 1.35, dwarfColors(m, stage), m, stage);
    const rig = humanoid({ height: 1.35, bulk: 1.45, muscle: 0.55, legFrac: 0.38, headScale: 1.25, armFrac: 0.38, chestBroad: 1.15 }, m);
    headFeatures(rig, m, { ears: 'round', beard: true, brow: true, nose: 0.4, eyes: { size: 0.13, spacing: 0.38, height: 0.05 } });
    return rig;
  },
  hobbit(m) {
    const rig = humanoid({ height: 1.05, bulk: 1.1, muscle: 0.1, belly: 0.4, legFrac: 0.4, headScale: 1.35, armFrac: 0.34, bigFeet: 1.6, toes: true, footScale: 1.2 }, m);
    headFeatures(rig, m, { ears: 'elf', hair: 'curly', eyes: { size: 0.19, spacing: 0.4 } });
    return rig;
  },
  giant(m) {
    const rig = humanoid({ height: 4.0, bulk: 1.35, muscle: 0.7, legFrac: 0.44, headScale: 0.85, armFrac: 0.42, chestBroad: 1.2, hunch: 0.12 }, m);
    headFeatures(rig, m, { ears: 'round', tusks: true, brow: true, nose: 0.35, eyes: { size: 0.11, spacing: 0.36, height: 0.05 } });
    rockPlates(rig, m, 4.0);
    return rig;
  },
  beastkin(m) {
    const rig = humanoid({ height: 2.0, bulk: 1.05, muscle: 0.5, legFrac: 0.48, headScale: 1.0, armFrac: 0.38, digitigrade: true, claws: true, toes: true }, m);
    headFeatures(rig, m, { ears: 'wolf', snout: 0.9, jaw: true, fangs: true, eyes: { size: 0.15, spacing: 0.45, height: 0.25, forward: 0.75 } });
    const t = tail(0.75, 0.09, m.accent, { segments: 6, droop: -0.22 });
    t.position.set(0, 0, -0.12);
    rig.hips.add(t);
    rig.tail = t;
    return rig;
  },

  goblin(m, stage, form) {
    const s = GOBLIN_STAGES[stage] || GOBLIN_STAGES[0];
    const human = form === 'humanoid';
    if (s.skinShift) shiftSkin(m, s.skinShift);
    const rig = sculptedHumanoid({
      height: human ? s.hh : s.h, bulk: s.bulk, muscle: s.muscle, belly: s.belly || 0, chestBroad: s.chestBroad || 1,
      headScale: human ? 1 + (s.head - 1) * 0.35 : s.head, hunch: human ? s.hunch * 0.25 : s.hunch,
      armFrac: human ? Math.min(s.arm, 0.39) : s.arm, legFrac: human ? Math.max(s.leg, 0.47) : s.leg,
      handScale: human ? 1 : s.hand, fingerLen: human ? 1 : s.fingers || 1, toes: true, noSkull: true, footScale: human ? 1.05 : 1.25,
    }, m);
    goblinHead(rig, m, {
      noseLen: (s.nose || 0.3) * (human ? 0.7 : 1), broadNose: s.broadNose, tusks: s.tusks, fangs: !s.tusks,
      jawW: s.broadNose ? 1.25 : 1, eyeSize: stage === 0 && !human ? 1.25 : 1,
      refine: human ? 1 : Math.min(1, stage * 0.5), // later stages get a longer, stronger, more human face
    });
    pointedEars(rig.head, rig.headR, m, { size: s.ears * (human ? 0.75 : 1), lift: stage === 0 ? 0.25 : 0.4, sweep: 0.3 });
    if (s.hair) hair(rig.head, rig.headR, m.accent, { ...s.hair, seed: 20 + stage });
    wearOutfit(rig, m, s.outfit, 30 + stage);
    if (s.outfit.crown) spikedCrown(rig.head, rig.headR);
    const bend = human ? s.bend * 0.2 : s.bend;
    if (bend > 0) bendKnees(rig, bend);
    if (s.spread && !human) for (const leg of rig.legs) leg.hip.parent.rotation.z = leg.side * s.spread;
    rig.sculpted = true;
    return rig;
  },
  slime(m, stage, form) {
    if (form === 'monster') return blob({ size: 0.75 }, m, stage);
    const rig = tieredHumanoid(m, stage, { height: 1.7, bulk: 1.0, legFrac: 0.47, headScale: 1.05, armFrac: 0.37, toes: false });
    headFeatures(rig, m, { eyes: { size: 0.2, spacing: 0.38 } });
    const core = ellipsoid(0.09 * (1 + stage * 0.12), 0.09 * (1 + stage * 0.12), 0.09 * (1 + stage * 0.12), m.slimeCore);
    core.position.y = rig.torsoLen * 0.7;
    rig.spine.add(core);
    rig.core = core;
    // dripping gel on the head instead of hair, longer with each evolution
    const r = rig.headR;
    for (let i = 0; i < 8 + stage * 3; i++) {
      const a = (i / (8 + stage * 3)) * Math.PI * 1.6 + Math.PI * 0.7;
      const d = ellipsoid(r * 0.16, r * (0.3 + stage * 0.08), r * 0.16, m.skin);
      d.position.set(Math.sin(a) * r * 0.86, -r * (0.05 + stage * 0.04), Math.cos(a) * r * 0.86 - r * 0.05);
      rig.head.add(d);
    }
    rig.sculpted = true;
    return rig;
  },
  fairy(m, stage, form) {
    const H = form === 'humanoid' ? 1.6 : 0.3;
    const rig = humanoid({ height: H, bulk: 0.8, muscle: 0.05, legFrac: 0.5, headScale: form === 'humanoid' ? 1.0 : 1.5, armFrac: 0.36 }, m);
    headFeatures(rig, m, { ears: 'elf', hair: 'long', eyes: { size: 0.22, spacing: 0.4 } });
    const pairs = stage >= 2 ? 2 : 1;
    rig.wings = [];
    for (let p = 0; p < pairs; p++) {
      for (const side of [-1, 1]) {
        const w = wing(H * (0.55 - p * 0.15) * (1 + stage * 0.08), m.wing, 'fairy');
        w.position.set(side * H * 0.03, H * 0.2 - p * H * 0.12, -H * 0.07);
        w.rotation.set(0, side * 0.5, side > 0 ? -0.2 - p * 0.6 : Math.PI + 0.2 + p * 0.6);
        if (side < 0) w.scale.y = -1;
        rig.spine.add(w);
        rig.wings.push(w);
      }
    }
    const light = new THREE.PointLight(m.eye.color, form === 'humanoid' ? 0.6 : 0.3, H * 6);
    light.position.y = H * 0.6;
    rig.root.add(light);
    rig.hovers = true;
    rig.dressed = true;
    return rig;
  },
  lizardman(m, stage, form) {
    if (form === 'monster') {
      return quadruped({ length: 2.4, bulk: 1.0, neckRaise: 0.15, neckLen: 0.06, legHeight: 0.8, sprawl: 0.75 }, m);
    }
    const rig = tieredHumanoid(m, stage, { height: 2.0, bulk: 1.1, legFrac: 0.46, headScale: 1.0, armFrac: 0.38, digitigrade: true, claws: true, bellyPlate: true });
    headFeatures(rig, m, { snout: 1.2, snoutWide: 0.45, jaw: true, fangs: true, eyes: { size: 0.16, spacing: 0.5, height: 0.3, forward: 0.65, slit: true } });
    // a head frill that grows with each evolution
    if (stage >= 1) spineSpikes(rig.head, 3 + stage, new THREE.Vector3(0, rig.headR * 0.95, rig.headR * 0.3), new THREE.Vector3(0, rig.headR * 0.5, -rig.headR * 0.9), rig.headR * (0.3 + stage * 0.1), m.accent);
    const t = tail(1.3 * (1 + stage * 0.08), 0.13 * (1 + stage * 0.06), m.skin, { segments: 8, droop: 0.1 });
    t.position.set(0, -0.05, -0.1);
    t.rotation.x = -0.25;
    rig.hips.add(t);
    rig.tail = t;
    rig.sculpted = true;
    return rig;
  },
  naga(m, stage, form) {
    if (form === 'monster') return serpent({ length: 6, bulk: 1, hood: 1.3 + stage * 0.08 }, m);
    const rig = tieredHumanoid(m, stage, { height: 1.9, bulk: 0.92, legFrac: 0.48, headScale: 1.0, armFrac: 0.37, bellyPlate: true });
    headFeatures(rig, m, { snout: 0.45, snoutWide: 0.6, fangs: true, eyes: { size: 0.17, spacing: 0.45, height: 0.15, slit: true } });
    // the hood behind the head widens with each evolution
    const hood = ellipsoid(rig.headR * (1.4 + stage * 0.15), rig.headR * (1.5 + stage * 0.12), rig.headR * 0.12, m.belly);
    hood.position.set(0, -rig.headR * 0.1, -rig.headR * 0.75);
    rig.head.add(hood);
    const t = tail(0.9 * (1 + stage * 0.1), 0.08, m.skin, { segments: 7, droop: 0.25 });
    t.position.set(0, 0, -0.1);
    rig.hips.add(t);
    rig.tail = t;
    rig.sculpted = true;
    return rig;
  },
  dragonewt(m, stage, form) {
    if (form === 'humanoid' && stage >= 4 && hasSculpt('dragon')) return sculptedRig('dragon', DRAGON_HEIGHT[stage], dragonColors(m, stage), m, stage);
    let rig;
    if (form === 'monster') {
      rig = quadruped({ length: 3.0, bulk: 1.1, neckRaise: 0.55, neckLen: 0.12, legHeight: 1.25, sprawl: 0.25 }, m);
      wingsOn(rig.torso, 1.1 + stage * 0.15, new THREE.Vector3(0, 3.0 * 0.07, 3.0 * 0.06), m, rig);
      hornsOn(rig.head, rig.headR, 1 + stage * 0.25, m);
    } else {
      rig = tieredHumanoid(m, stage, { height: 1.9, bulk: 1.05, legFrac: 0.47, headScale: 1.0, armFrac: 0.38, digitigrade: true, claws: true, bellyPlate: true });
      headFeatures(rig, m, { snout: 0.95, snoutWide: 0.5, jaw: true, fangs: true, eyes: { size: 0.16, spacing: 0.5, height: 0.3, forward: 0.65, slit: true } });
      hornsOn(rig.head, rig.headR, 1 + stage * 0.25, m);
      wingsOn(rig.spine, (0.8 + stage * 0.15) * rig.H / 1.9, new THREE.Vector3(0, rig.torsoLen * 0.85, -rig.H * 0.06), m, rig);
      const t = tail(1.2 * (1 + stage * 0.08), 0.12, m.skin, { segments: 8, droop: 0.12 });
      t.position.set(0, -0.05, -0.1);
      rig.hips.add(t);
      rig.tail = t;
      rig.sculpted = true;
    }
    return rig;
  },
};

function barkMarkings(rig, m, H) {
  for (let i = 0; i < 5; i++) {
    const line = ellipsoid(H * 0.004, H * 0.05, H * 0.004, m.dark);
    line.position.set((i - 2) * H * 0.018, H * 0.2 + (i % 2) * H * 0.02, H * 0.08);
    line.rotation.z = (i - 2) * 0.2;
    rig.spine.add(line);
  }
}

function rockPlates(rig, m, H) {
  for (let i = 0; i < 4; i++) {
    const p = ellipsoid(H * 0.05, H * 0.035, H * 0.02, m.dark);
    p.position.set((i % 2 ? 1 : -1) * H * 0.06, H * 0.12 + i * H * 0.04, -H * 0.075);
    p.rotation.y = 0.3;
    rig.spine.add(p);
  }
}

function bendKnees(rig, amount) {
  for (const leg of rig.legs) {
    leg.hip.rotation.x = -amount;
    leg.knee.rotation.x = amount * 1.6;
  }
  // lower the hips so the feet stay on the ground
  const drop = (leg) => leg.thighLen * (1 - Math.cos(amount)) + leg.shinLen * (1 - Math.cos(amount * 0.6));
  rig.hips.position.y -= drop(rig.legs[0]);
  rig.restBend = amount;
}

function hornsOn(head, r, size, m) {
  for (const side of [-1, 1]) {
    const h = horn(r * 1.1 * size, r * 0.16 * size, 0.35, m.bone);
    h.position.set(side * r * 0.45, r * 0.6, -r * 0.2);
    h.rotation.set(-0.9, 0, side * -0.35);
    head.add(h);
  }
}

function wingsOn(parent, span, at, m, rig) {
  rig.wings = rig.wings || [];
  for (const side of [-1, 1]) {
    const w = wing(span, m.wing, 'dragon');
    w.position.set(side * 0.08, at.y, at.z);
    w.rotation.set(0.25, side * 0.35, side > 0 ? 0.35 : Math.PI - 0.35);
    if (side < 0) w.scale.y = -1;
    parent.add(w);
    rig.wings.push(w);
  }
}

// What each stage adds on top of the body.
function applyEvolution(rig, raceId, form, stage, m) {
  const r = rig.headR || 0.1;
  if (PLAYER_RACES.includes(raceId)) {
    // Player races advance their class instead of evolving: gear and aura change, not the body
    if (stage <= 0) return;
    if (stage >= 1) shoulderPads(rig, rig.root.userData.height, m);
    if (stage >= 3) rig.aura = aura(rig.root, rig.root.userData.height * 0.45, rig.root.userData.height, m.glow);
    if (stage >= 4) cape(rig, rig.root.userData.height, m, stage >= 5 ? '#d9a93a' : '#6a1a1a');
    if (stage >= 5) crown(rig.head, r, m, 7);
    return;
  }
  if (raceId === 'goblin') return; // the Goblin line is built stage by stage
  if (rig.tier) {
    // humanoid forms of the other monster races
    wearOutfit(rig, m, tierOutfit(rig.tier.outfit, RACE_CLOTH[raceId]), 40 + stage);
    if (stage >= 5) spikedCrown(rig.head, r);
    return;
  }
  if (raceId === 'fairy') {
    if (stage >= 3) rig.aura = aura(rig.root, rig.root.userData.height * 0.45, rig.root.userData.height, m.glow);
    if (stage >= 4) crown(rig.head, r, m, 5 + stage);
    return;
  }
  // creature forms: a ridge that grows, horns from the second evolution, a crown at the last
  if (stage <= 0) return;
  const size = r * (0.3 + stage * 0.1);
  if (rig.torso) spineSpikes(rig.torso, 3 + stage * 2, new THREE.Vector3(0, r * 1.3, r * 3), new THREE.Vector3(0, r * 1.0, -r * 3), size, m.accent);
  if (rig.body && raceId === 'naga') spineSpikes(rig.head, 2 + stage, new THREE.Vector3(0, r * 0.5, 0), new THREE.Vector3(0, r * 0.3, -r * 0.9), size, m.accent);
  if (stage >= 2 && raceId === 'lizardman') hornsOn(rig.head, r, 0.4 + stage * 0.15, m);
  if (stage >= 3 && raceId === 'slime' && rig.core) rig.core.scale.multiplyScalar(1 + stage * 0.15);
  if (stage >= 5) spikedCrown(rig.head, r * (raceId === 'slime' ? 0.9 : 1));
}

// ---------- public API ----------

export function bodyHeight(raceId, form) {
  const table = {
    elf: 1.95, dwarf: 1.35, hobbit: 1.05, giant: 4.0, beastkin: 2.0,
    goblin: form === 'humanoid' ? 1.55 : 1.0, slime: form === 'humanoid' ? 1.7 : 0.75,
    fairy: form === 'humanoid' ? 1.6 : 0.3, lizardman: form === 'humanoid' ? 2.0 : 0.7,
    naga: form === 'humanoid' ? 1.9 : 1.4, dragonewt: form === 'humanoid' ? 1.9 : 1.6,
  };
  return table[raceId] || 1.8;
}

// `age` is set for a child (4 to 7): a smaller body, and no beard yet
export function buildCharacter({ race, form = 'monster', stage = 0, growth = 0, look = {}, age = null }) {
  const mats = makeMaterials(race, look, stage);
  const rig = BUILDERS[race](mats, stage, form);
  rig.race = race;
  rig.form = form;
  if (!rig.root.userData.height) rig.root.userData.height = bodyHeight(race, form);
  const baseHeight = rig.root.userData.height;
  if (rig.arms && !rig.sculpt && (PLAYER_RACES.includes(race) || rig.dressed)) dress(rig, race);
  applyEvolution(rig, race, form, stage, mats);
  const size = scaleFor(race, form, stage, growth, !!rig.sculpted) * (look.size || 1) * (age != null ? childSize(age) : 1);
  if (age != null) rig.root.traverse((o) => { if (/beard/i.test(o.name)) o.visible = false; });
  const wrapper = new THREE.Group();
  wrapper.add(rig.root);
  wrapper.scale.setScalar(size);
  wrapper.userData.rig = rig;
  wrapper.userData.height = baseHeight * size;
  wrapper.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return wrapper;
}

// Idle and walk animation. `speed` is 0 when standing, 1 when walking, 2 when running.
export function animateCharacter(character, t, speed = 0) {
  const rig = character.userData.rig;
  const swing = Math.min(speed, 2) * 0.45;
  const cycle = t * (4 + speed * 2.5);
  if (rig.legs && rig.arms) {
    const bend = rig.restBend || 0;
    for (const leg of rig.legs) {
      const ph = leg.side > 0 ? 0 : Math.PI;
      leg.hip.rotation.x = -bend + Math.sin(cycle + ph) * swing + (leg.digi ? -0.35 : 0);
      leg.knee.rotation.x = bend * 1.6 + Math.max(0, -Math.sin(cycle + ph)) * swing * 1.4 + (leg.digi ? 0.75 : 0);
    }
    for (const arm of rig.arms) {
      const ph = arm.side > 0 ? Math.PI : 0;
      arm.shoulder.rotation.x = Math.sin(cycle + ph) * swing * 0.8;
      arm.shoulder.rotation.z = arm.side * (0.12 - (rig.armRest || 0) + Math.sin(t * 1.5) * 0.02);
    }
    rig.hips.position.y += 0; // keep height
    if (rig.spine) rig.spine.rotation.y = Math.sin(cycle) * swing * 0.1;
    if (rig.chest) rig.chest.scale.y = rig.chest.scale.y; // breathing is subtle; skip
  }
  if (rig.torso && rig.legs) {
    for (const leg of rig.legs) {
      const ph = (leg.front ? 0 : Math.PI) + (leg.side > 0 ? Math.PI : 0);
      leg.hip.rotation.x = Math.sin(cycle + ph) * swing * 0.9;
    }
    rig.torso.rotation.y = Math.sin(cycle) * swing * 0.12;
  }
  if (rig.tail) {
    rig.tail.userData.parts.forEach((p, i) => { p.rotation.y = Math.sin(t * 2 + i * 0.6) * (0.06 + swing * 0.1); });
  }
  if (rig.wings) {
    const flap = rig.hovers ? Math.sin(t * 28) * 0.5 : Math.sin(t * 1.6) * 0.06;
    rig.wings.forEach((w, i) => { w.rotation.y = (i % 2 ? 1 : -1) * (0.5 + flap); });
  }
  if (rig.wingBones) {
    // sculpted wings breathe in and out a little, and beat while running
    const beat = Math.sin(t * 1.4) * 0.05 + Math.sin(t * 9) * Math.max(0, speed - 1) * 0.12;
    rig.wingBones.forEach((w, i) => { w.rotation.y = (i ? -1 : 1) * beat; });
  }
  if (rig.hovers) rig.root.position.y = (rig.root.userData.height < 1 ? 0.25 : 0.15) + Math.sin(t * 2.2) * 0.04;
  if (rig.body && rig.core) {
    // slime wobble
    rig.body.scale.set(0.41 + Math.sin(t * 3) * 0.015, 0.315 - Math.sin(t * 3) * 0.015, 0.41 + Math.sin(t * 3) * 0.015);
  }
  if (rig.aura) rig.aura.rotation.y = t * 0.6;
}
