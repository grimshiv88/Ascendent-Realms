// Sculpted body parts: a smooth humanoid with muscles, hands and feet, plus hair, ears and the
// clothing pieces used by the evolution outfits. Everything is in metres (1 unit = 1 metre).
import * as THREE from 'three';

const SPHERE = new THREE.SphereGeometry(1, 28, 20);
const CONE = new THREE.ConeGeometry(1, 1, 14);
const UP = new THREE.Vector3(0, 1, 0);

export function ellipsoid(rx, ry, rz, mat) {
  const m = new THREE.Mesh(SPHERE, mat);
  m.scale.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

// A cone whose base sits at `from` and whose tip points along `dir` for `len` metres.
function spike(from, dir, len, r, mat) {
  const m = new THREE.Mesh(CONE, mat);
  m.scale.set(r, len, r);
  const d = dir.clone().normalize();
  m.quaternion.setFromUnitVectors(UP, d);
  m.position.copy(from).addScaledVector(d, len / 2);
  m.castShadow = true;
  return m;
}

// Small seeded random numbers, so a character looks the same every time it is built.
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const matCache = new Map();
export function clothMat(hex, { metal = false, rough = 0.9 } = {}) {
  const key = `${hex}|${metal}|${rough}`;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({
      color: hex, roughness: metal ? 0.32 : rough, metalness: metal ? 0.85 : 0, side: THREE.DoubleSide,
    }));
  }
  return matCache.get(key);
}

// A smooth limb (lathe) hanging down from y=0 to y=-len, with a muscle bulge and rounded ends.
function limbGeo(len, r1, r2, { bulge = 0, at = 0.35, width = 0.28 } = {}) {
  const pts = [];
  const c1 = r1 * 0.5;
  const c2 = r2 * 0.5;
  for (let i = 0; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(r2 * Math.sin(a), 0.0004), -len - c2 * Math.cos(a)));
  }
  const n = 16;
  for (let i = 1; i < n; i++) {
    const k = 1 - i / n;
    const r = r1 + (r2 - r1) * k + r1 * bulge * Math.exp(-(((k - at) / width) ** 2)) * Math.sin(Math.PI * k);
    pts.push(new THREE.Vector2(r, -len * k));
  }
  for (let i = 4; i >= 0; i--) {
    const a = (i / 4) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(r1 * Math.sin(a), 0.0004), c1 * Math.cos(a)));
  }
  return new THREE.LatheGeometry(pts, 22);
}

function limb(len, r1, r2, mat, opts) {
  const joint = new THREE.Group();
  const mesh = new THREE.Mesh(limbGeo(len, r1, r2, opts), mat);
  mesh.castShadow = true;
  if (opts?.flat) mesh.scale.z = opts.flat;
  joint.add(mesh);
  const end = new THREE.Group();
  end.position.y = -len;
  joint.add(end);
  return { joint, end, mesh };
}

// The torso profile: [height as a share of the torso length, radius as a share of body height].
function torsoProfile(m, cb, belly) {
  return [
    [-0.16, 0.0005], [-0.12, 0.055], [-0.02, 0.08 + belly * 0.01], [0.22, 0.071 - m * 0.003 + belly * 0.022],
    [0.45, 0.077 + m * 0.004 + belly * 0.014], [0.66, (0.085 + m * 0.012) * cb], [0.82, (0.091 + m * 0.016) * cb],
    [0.93, (0.086 + m * 0.014) * cb], [1.0, 0.058 * cb], [1.05, 0.034], [1.075, 0.0005],
  ];
}

// The torso as one smooth shape: hips, waist, ribcage and shoulders, wider for muscular bodies.
function torsoGeo(H, tl, b, prof) {
  const pts = prof.map(([k, r]) => new THREE.Vector2(r * H * b, k * tl));
  return new THREE.LatheGeometry(new THREE.SplineCurve(pts).getPoints(48), 32);
}

// A hand: palm, four fingers and a thumb, gently curled. Points down from the wrist.
function hand(H, b, mat, { scale = 1, claws = null, fingerLen = 1 } = {}) {
  const g = new THREE.Group();
  const s = H * scale;
  const palm = ellipsoid(s * 0.027 * b, s * 0.036, s * 0.013 * b, mat);
  palm.position.y = -s * 0.03;
  g.add(palm);
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * s * 0.0135 * b;
    const len = s * 0.036 * fingerLen * (i === 0 || i === 3 ? 0.85 : 1);
    const f = limb(len * 0.55, s * 0.0062 * b, s * 0.0055 * b, mat);
    f.joint.position.set(x, -s * 0.058, s * 0.002);
    f.joint.rotation.x = 0.25;
    const tip = limb(len * 0.5, s * 0.0055 * b, s * 0.0045 * b, mat);
    tip.joint.rotation.x = 0.45;
    f.end.add(tip.joint);
    if (claws) {
      const c = new THREE.Mesh(CONE, claws);
      c.scale.set(s * 0.004, s * 0.014, s * 0.004);
      c.rotation.x = Math.PI;
      c.position.y = -s * 0.008;
      tip.end.add(c);
    }
    g.add(f.joint);
  }
  const thumb = limb(s * 0.03, s * 0.0075 * b, s * 0.0055 * b, mat);
  thumb.joint.position.set(s * 0.022 * b, -s * 0.03, s * 0.008);
  thumb.joint.rotation.set(0.5, 0, 0.55);
  g.add(thumb.joint);
  return g;
}

// A bare foot with toes, pointing forward (+Z) from the ankle.
function foot(H, b, mat, { scale = 1, toes = true, claws = null } = {}) {
  const g = new THREE.Group();
  const s = H * scale;
  const sole = ellipsoid(s * 0.032 * b, s * 0.028, s * 0.065, mat);
  sole.position.set(0, -s * 0.012, s * 0.03);
  g.add(sole);
  const heel = ellipsoid(s * 0.026 * b, s * 0.028, s * 0.03, mat);
  heel.position.set(0, -s * 0.012, -s * 0.012);
  g.add(heel);
  if (toes) {
    for (let i = 0; i < 5; i++) {
      const big = i === 0 ? 1.35 : 1 - i * 0.06;
      const t = ellipsoid(s * 0.0085 * big * b, s * 0.008 * big, s * 0.016 * big, mat);
      t.position.set((i - 1.6) * s * 0.0125 * b, -s * 0.021, s * 0.092 - i * s * 0.004);
      g.add(t);
      if (claws) {
        const c = new THREE.Mesh(CONE, claws);
        c.scale.set(s * 0.004, s * 0.012, s * 0.004);
        c.rotation.x = Math.PI / 2;
        c.position.set(t.position.x, t.position.y, t.position.z + s * 0.016);
        g.add(c);
      }
    }
  }
  return g;
}

/*
 The humanoid body used by every two-legged character. Returns a rig the animator understands.
 P.height     standing height in metres
 P.bulk       overall thickness (1 = average)
 P.muscle     0 (skinny) to 1 (heavily muscled): grows the chest, shoulders, arms and legs and adds muscle shapes
 P.belly      0–1 belly size
 P.chestBroad extra shoulder width
 P.headScale  head size (1 = human proportion)
 P.hunch      forward lean of the spine, in radians
 P.legFrac / P.armFrac  limb lengths as a share of height
 P.handScale, P.toes, P.claws, P.digitigrade, P.bigFeet, P.bellyPlate, P.lowerMat, P.footMat, P.noSkull
*/
export function sculptedHumanoid(P, mats) {
  const H = P.height;
  const b = P.bulk ?? 1;
  const m = P.muscle ?? 0.25;
  const cb = P.chestBroad ?? 1;
  const skin = mats.skin;
  const lower = P.lowerMat || skin;
  const clawMat = P.claws ? mats.bone : null;
  const root = new THREE.Group();
  const rig = { root, H, bulk: b, muscle: m, muscleParts: [] };

  const legLen = H * (P.legFrac ?? 0.47);
  const hips = new THREE.Group();
  hips.position.y = legLen;
  root.add(hips);
  rig.hips = hips;

  const pelvis = ellipsoid(H * 0.084 * b, H * 0.062, H * 0.062 * b, lower);
  pelvis.position.y = -H * 0.005;
  hips.add(pelvis);
  rig.pelvis = pelvis;

  const spine = new THREE.Group();
  spine.position.y = H * 0.02;
  spine.rotation.x = P.hunch || 0;
  hips.add(spine);
  rig.spine = spine;

  const tl = H * 0.29;
  rig.torsoLen = tl;
  const depth = 0.64 + m * 0.06;
  const prof = torsoProfile(m, cb, P.belly || 0);
  const torso = new THREE.Mesh(torsoGeo(H, tl, b, prof), skin);
  torso.scale.z = depth;
  torso.castShadow = true;
  spine.add(torso);
  rig.chest = torso;
  const rAt = (k) => {
    // radius of the torso at height k (share of the torso length)
    let i = 1;
    while (i < prof.length - 1 && prof[i][0] < k) i++;
    const [k0, r0] = prof[i - 1];
    const [k1, r1] = prof[i];
    return THREE.MathUtils.lerp(r0, r1, THREE.MathUtils.clamp((k - k0) / (k1 - k0), 0, 1)) * H * b;
  };

  // belly (also what a shirt is built from)
  const bellyR = rAt(0.35);
  const belly = ellipsoid(bellyR * 0.8, tl * 0.22, bellyR * depth * (0.95 + (P.belly || 0) * 0.5), skin);
  belly.position.set(0, tl * 0.3, (P.belly || 0) * bellyR * 0.25);
  spine.add(belly);
  rig.belly = belly;

  const detail = (mesh) => { spine.add(mesh); rig.muscleParts.push(mesh); return mesh; };
  if (P.bellyPlate) {
    const plate = ellipsoid(H * 0.06 * b, tl * 0.48, H * 0.03, mats.belly);
    plate.position.set(0, tl * 0.5, rAt(0.5) * depth * 0.72);
    detail(plate);
  }
  if (m > 0.15) {
    const chestR = rAt(0.8);
    const front = chestR * depth;
    const k = 0.5 + m * 0.5;
    for (const side of [-1, 1]) {
      // chest muscles
      const pec = ellipsoid(chestR * 0.52 * k, tl * 0.13 * k, front * 0.22, skin);
      pec.position.set(side * chestR * 0.38, tl * 0.76, front * 0.76);
      pec.rotation.z = side * 0.18;
      detail(pec);
      // the slope from the neck to the shoulders
      const trap = ellipsoid(chestR * 0.3, tl * 0.055 * k, front * 0.36, skin);
      trap.position.set(side * chestR * 0.34, tl * 0.95, -front * 0.12);
      trap.rotation.z = side * -0.45;
      detail(trap);
      // back muscles
      const lat = ellipsoid(chestR * 0.42, tl * 0.22, front * 0.32 * k, skin);
      lat.position.set(side * chestR * 0.45, tl * 0.62, -front * 0.55);
      detail(lat);
    }
    if (m > 0.35 && !P.bellyPlate) {
      const waistR = rAt(0.35);
      const s = (m - 0.2) * 1.1;
      for (let row = 0; row < 3; row++) {
        for (const side of [-1, 1]) {
          const ab = ellipsoid(waistR * 0.24, tl * 0.055, waistR * 0.03 * s, skin);
          ab.position.set(side * waistR * 0.24, tl * (0.2 + row * 0.12), waistR * depth * 0.93 + (P.belly || 0) * waistR * 0.2);
          detail(ab);
        }
      }
    }
  }

  const neck = new THREE.Group();
  neck.position.y = tl * 1.0;
  spine.add(neck);
  rig.neck = neck;
  const neckR = H * 0.028 * b * (1 + m * 0.4);
  const neckMesh = new THREE.Mesh(limbGeo(H * 0.06, neckR * 1.15, neckR, {}), skin);
  neckMesh.rotation.x = Math.PI;
  neckMesh.position.y = -H * 0.01;
  neck.add(neckMesh);

  const headR = H * 0.07 * (P.headScale ?? 1);
  const head = new THREE.Group();
  head.position.set(0, H * 0.045 + headR * 0.78, headR * 0.08);
  neck.add(head);
  rig.head = head;
  rig.headR = headR;
  if (!P.noSkull) head.add(ellipsoid(headR * 0.92, headR, headR * 0.98, skin));

  // arms
  const armLen = H * (P.armFrac ?? 0.37);
  const shoulderX = rAt(0.9) * 0.97;
  rig.arms = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * shoulderX, tl * 0.88, 0);
    spine.add(shoulder);
    const delt = ellipsoid(H * 0.033 * b * (1 + m * 0.4), H * 0.037 * b * (1 + m * 0.3), H * 0.033 * b * (1 + m * 0.35), skin);
    delt.position.set(-side * H * 0.004, H * 0.002, 0);
    shoulder.add(delt);
    const upLen = armLen * 0.47;
    const upper = limb(upLen, H * 0.028 * b * (1 + m * 0.35), H * 0.021 * b * (1 + m * 0.2), skin, { bulge: 0.08 + m * 0.25, at: 0.45 });
    upper.joint.rotation.z = side * 0.1;
    shoulder.add(upper.joint);
    if (m > 0.3) {
      const bicep = ellipsoid(H * 0.018 * b * (0.6 + m), upLen * 0.26, H * 0.02 * b * (0.6 + m), skin);
      bicep.position.set(0, -upLen * 0.48, H * 0.012 * b);
      upper.joint.add(bicep);
    }
    const foreLen = armLen * 0.43;
    const fore = limb(foreLen, H * 0.024 * b * (1 + m * 0.35), H * 0.016 * b * (1 + m * 0.15), skin, { bulge: 0.1 + m * 0.22, at: 0.25 });
    fore.joint.rotation.x = -0.18;
    upper.end.add(fore.joint);
    const elbow = ellipsoid(H * 0.021 * b * (1 + m * 0.25), H * 0.022 * b, H * 0.021 * b * (1 + m * 0.25), skin);
    upper.end.add(elbow);
    const h = hand(H, b * (1 + m * 0.15), skin, { scale: P.handScale ?? 1, claws: clawMat, fingerLen: P.fingerLen ?? 1 });
    h.rotation.y = side * -0.3;
    fore.end.add(h);
    rig.arms.push({ shoulder: upper.joint, elbow: fore.joint, elbow0: -0.18, hand: fore.end, side, len: upLen, foreLen });
  }

  // legs
  rig.legs = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * H * 0.046 * b, -H * 0.01, 0);
    hips.add(hip);
    const digi = P.digitigrade;
    const thighLen = legLen * (digi ? 0.42 : 0.5);
    const shinLen = legLen * (digi ? 0.4 : 0.47);
    const thigh = limb(thighLen, H * 0.045 * b * (1 + m * 0.22), H * 0.029 * b * (1 + m * 0.1), lower, { bulge: 0.08 + m * 0.16, at: 0.35 });
    hip.add(thigh.joint);
    const knee = ellipsoid(H * 0.028 * b, H * 0.03 * b, H * 0.03 * b, lower);
    thigh.end.add(knee);
    const shin = limb(shinLen, H * 0.029 * b * (1 + m * 0.15), H * 0.018 * b, lower, { bulge: 0.15 + m * 0.28, at: 0.28 });
    thigh.end.add(shin.joint);
    let ankle = shin.end;
    if (digi) {
      thigh.joint.rotation.x = -0.35;
      shin.joint.rotation.x = 0.75;
      const meta = limb(legLen * 0.2, H * 0.024 * b, H * 0.02 * b, lower);
      meta.joint.rotation.x = -0.4;
      shin.end.add(meta.joint);
      ankle = meta.end;
    }
    const f = foot(H, b * (P.bigFeet || 1), P.footMat || skin, { scale: P.footScale ?? 1, toes: P.toes ?? true, claws: clawMat });
    ankle.add(f);
    rig.legs.push({ hip: thigh.joint, knee: shin.joint, ankle, side, digi, shinLen, thighLen });
  }

  root.userData.height = H;
  return rig;
}

// ---------- heads, ears and hair ----------

// A leaf-shaped pointed ear, flat face forward, pointing out to the side.
function leafEar(len, mat, innerMat) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.22);
  s.quadraticCurveTo(0.45, -0.25, 1, 0.32);
  s.quadraticCurveTo(0.5, 0.28, 0, 0.3);
  s.lineTo(0, -0.22);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.03, bevelSegments: 2, curveSegments: 10 });
  geo.translate(0, 0, -0.025);
  const g = new THREE.Group();
  const ear = new THREE.Mesh(geo, mat);
  ear.castShadow = true;
  g.add(ear);
  const inner = new THREE.Mesh(new THREE.ShapeGeometry(s, 10), innerMat);
  inner.scale.set(0.72, 0.62, 1);
  inner.position.set(0.08, 0.02, 0.058);
  g.add(inner);
  g.scale.setScalar(len);
  return g;
}

export function pointedEars(head, r, mats, { size = 1, lift = 0.35, sweep = 0.35, y = 0.05, x = 0.82 } = {}) {
  const inner = new THREE.MeshStandardMaterial({ color: mats.skin.color.clone().lerp(new THREE.Color('#7a3a30'), 0.35), roughness: 0.8, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const g = new THREE.Group();
    g.scale.x = side;
    g.position.set(side * r * x, r * y, -r * 0.05);
    const ear = leafEar(r * size, mats.skin, inner);
    ear.rotation.set(0, sweep, lift);
    g.add(ear);
    head.add(g);
  }
}

// Messy hair made of clumps, plus long strands down the back when `length` is above 0.
// `swept` brushes everything up and back off the face, like the goblin-line sculpts.
export function hair(head, r, baseMat, { volume = 1, length = 0, seed = 7, spiky = 1, fringe = true, swept = false } = {}) {
  const rand = seeded(seed);
  const mat = new THREE.MeshStandardMaterial({ color: baseMat.color.clone().multiplyScalar(0.7), roughness: 0.95 });
  const g = new THREE.Group();
  // swept hair starts higher, leaving the forehead clear
  const cap = swept ? ellipsoid(r * 0.95, r * 0.88, r * 0.98, mat) : ellipsoid(r * 0.98, r * 0.96, r * 1.04, mat);
  cap.position.set(0, r * (swept ? 0.26 : 0.16), -r * (swept ? 0.2 : 0.1));
  g.add(cap);
  const clumps = Math.round(34 * volume);
  for (let i = 0; i < clumps; i++) {
    const az = rand() * Math.PI * 2;
    const el = 0.15 + rand() * 1.2;
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    if (dir.z > 0.45 && dir.y < 0.75 && !fringe) continue;
    if (dir.z > 0.55 && dir.y < 0.45) continue; // keep the face clear
    if (swept && dir.z > 0.2 && dir.y < 0.35) continue; // and the temples
    const base = dir.clone().multiplyScalar(r * 0.88).add(new THREE.Vector3(0, r * (swept ? 0.22 : 0.14), -r * (swept ? 0.16 : 0.08)));
    const out = dir.clone().lerp(new THREE.Vector3(dir.x * 0.5, -0.7, -1), 0.5 + rand() * 0.2);
    if (swept) out.copy(dir).lerp(new THREE.Vector3(dir.x * 0.4, 0.45, -1), 0.7); // spikes brushed up and back
    else if (dir.z > 0.3) out.lerp(new THREE.Vector3(dir.x * 0.6, -0.6, 0.8), 0.5); // fringe falls forward over the brow
    g.add(spike(base, out, r * (0.4 + rand() * 0.4) * spiky, r * (0.2 + rand() * 0.08), mat));
  }
  if (length > 0) {
    const n = Math.round(22 * volume);
    for (let i = 0; i < n; i++) {
      const az = Math.PI * (0.55 + rand() * 0.9); // the back half of the head
      const base = new THREE.Vector3(Math.sin(az) * r * 0.85, r * (0.1 + rand() * 0.35), Math.cos(az) * r * 0.85 - r * 0.08);
      const dir = new THREE.Vector3(Math.sin(az) * 0.25, -1, -0.28 + Math.cos(az) * 0.1);
      g.add(spike(base, dir, r * length * (0.75 + rand() * 0.4), r * (0.13 + rand() * 0.06), mat));
    }
    if (length > 3) {
      // long hair also falls forward over both shoulders
      for (const side of [-1, 1]) {
        for (let i = 0; i < 5; i++) {
          const base = new THREE.Vector3(side * r * (0.72 + rand() * 0.12), r * (0.05 + rand() * 0.2), -r * (rand() * 0.2));
          const dir = new THREE.Vector3(side * 0.55, -1, 0.5);
          g.add(spike(base, dir, r * length * (0.45 + rand() * 0.2), r * 0.13, mat));
        }
      }
    }
  }
  // hair throws no shadow, so the face isn't striped by the clumps above it
  g.traverse((o) => { o.castShadow = false; });
  head.add(g);
  return g;
}

// The goblin-line face: cranium, jaw, angry brow, hooked nose, glowing eyes.
export function goblinHead(rig, mats, f) {
  const { head, headR: r } = rig;
  const skin = mats.skin;
  const k = f.refine || 0; // 0: the little goblin's face; 1: long, strong and nearly human
  const L = THREE.MathUtils.lerp;
  const cranium = ellipsoid(r * 0.9 * (f.craniumW || 1), r * 0.95, r * 1.0, skin);
  cranium.position.set(0, r * 0.1, -r * 0.06);
  head.add(cranium);
  const jaw = ellipsoid(r * L(0.68, 0.62, k) * (f.jawW || 1), r * L(0.52, 0.6, k), r * 0.72, skin);
  jaw.position.set(0, -r * L(0.36, 0.42, k), r * 0.16);
  head.add(jaw);
  const chin = ellipsoid(r * L(0.3, 0.34, k) * (f.jawW || 1), r * 0.22, r * 0.25, skin);
  chin.position.set(0, -r * L(0.7, 0.86, k), r * L(0.55, 0.5, k));
  head.add(chin);
  for (const side of [-1, 1]) {
    // round goblin cheeks become high, flat cheekbones
    const cheek = ellipsoid(r * L(0.28, 0.2, k), r * L(0.2, 0.1, k), r * L(0.28, 0.16, k), skin);
    cheek.position.set(side * r * L(0.42, 0.44, k), r * L(-0.1, -0.02, k), r * L(0.52, 0.66, k));
    cheek.rotation.z = side * 0.3 * k;
    head.add(cheek);
    // the jaw line from ear to chin
    if (k > 0) {
      const jl = ellipsoid(r * 0.1, r * 0.34, r * 0.12, skin);
      jl.position.set(side * r * 0.42, -r * 0.5, r * 0.36);
      jl.rotation.set(0.5, 0, side * 0.6);
      head.add(jl);
    }
    // a heavy brow, angled down toward the nose for the scowl
    const brow = ellipsoid(r * 0.3, r * 0.1 * (f.browH || 1) * (1 + k * 0.25), r * 0.2, skin);
    brow.position.set(side * r * 0.28, r * L(0.26, 0.24, k), r * L(0.78, 0.82, k));
    brow.rotation.z = side * L(0.38, 0.22, k);
    head.add(brow);
    // eye in a shadowed socket, narrower as the face matures
    const es = (f.eyeSize || 1) * L(1, 0.8, k);
    const socket = ellipsoid(r * 0.19, r * L(0.12, 0.1, k), r * 0.08, mats.dark);
    socket.position.set(side * r * 0.29, r * 0.1, r * 0.8);
    head.add(socket);
    const eye = ellipsoid(r * 0.135 * es, r * 0.09 * es * L(1, 0.75, k), r * 0.06, mats.eye);
    eye.position.set(side * r * 0.29, r * 0.1, r * 0.845);
    eye.rotation.z = side * 0.18;
    head.add(eye);
    const pupil = ellipsoid(r * 0.035 * es, r * 0.06 * es * L(1, 0.8, k), r * 0.02, mats.pupil);
    pupil.position.set(side * r * 0.27, r * 0.1, r * 0.9);
    head.add(pupil);
  }
  // nose: long and hooked for the small goblin, long and straight later, broad for ogres
  if (f.broadNose) {
    const nose = ellipsoid(r * 0.2, r * 0.16, r * 0.18, skin);
    nose.position.set(0, -r * 0.08, r * 0.95);
    head.add(nose);
    const bridge = ellipsoid(r * 0.1, r * 0.2, r * 0.1, skin);
    bridge.position.set(0, r * 0.08, r * 0.88);
    head.add(bridge);
  } else if (k > 0.4) {
    const bridge = ellipsoid(r * 0.075, r * 0.3, r * 0.1, skin);
    bridge.position.set(0, -r * 0.02, r * 0.92);
    bridge.rotation.x = -0.28;
    head.add(bridge);
    const tip = ellipsoid(r * 0.085, r * 0.08, r * 0.09, skin);
    tip.position.set(0, -r * 0.26, r * 1.02);
    head.add(tip);
    for (const side of [-1, 1]) {
      const wing = ellipsoid(r * 0.06, r * 0.05, r * 0.06, skin);
      wing.position.set(side * r * 0.08, -r * 0.27, r * 0.95);
      head.add(wing);
    }
  } else {
    const nose = new THREE.Mesh(CONE, skin);
    nose.scale.set(r * 0.11, r * (f.noseLen || 0.4), r * 0.11);
    nose.rotation.x = Math.PI / 2 + 0.55;
    nose.position.set(0, -r * 0.05, r * 0.98);
    head.add(nose);
    const bridge = ellipsoid(r * 0.09, r * 0.22, r * 0.1, skin);
    bridge.position.set(0, r * 0.05, r * 0.88);
    head.add(bridge);
  }
  // a downturned mouth
  const my = -r * L(0.46, 0.52, k);
  const mouth = ellipsoid(r * L(0.24, 0.2, k), r * 0.025, r * 0.05, mats.pupil);
  mouth.position.set(0, my, r * L(0.84, 0.86, k));
  head.add(mouth);
  for (const side of [-1, 1]) {
    const corner = ellipsoid(r * 0.06, r * 0.022, r * 0.04, mats.pupil);
    corner.position.set(side * r * L(0.24, 0.2, k), my - r * 0.04, r * 0.8);
    corner.rotation.z = side * 0.5;
    head.add(corner);
  }
  if (f.tusks) {
    for (const side of [-1, 1]) {
      head.add(spike(new THREE.Vector3(side * r * 0.2, my - r * 0.04, r * 0.82), new THREE.Vector3(side * 0.15, 1, 0.15), r * 0.26, r * 0.055, mats.bone));
    }
  }
  if (f.fangs) {
    for (const side of [-1, 1]) {
      head.add(spike(new THREE.Vector3(side * r * 0.11, my + r * 0.02, r * 0.86), new THREE.Vector3(0, -1, 0.1), r * 0.1 * L(1, 0.7, k), r * 0.03, mats.bone));
    }
  }
}

// ---------- clothing pieces ----------

// A wrap-around cloth skirt with a torn, uneven hem.
export function raggedSkirt(rig, { color, height, flare = 1.25, seed = 3, tears = 0.5, mat }) {
  const { H, bulk: b } = rig;
  const top = H * 0.087 * b;
  const geo = new THREE.CylinderGeometry(top, top * flare, height, 36, 3, true);
  const pos = geo.attributes.position;
  const rand = seeded(seed);
  const cuts = Array.from({ length: 37 }, () => rand());
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const k = (height / 2 - y) / height; // 0 at the waist, 1 at the hem
    if (k > 0.3) {
      const a = Math.atan2(pos.getZ(i), pos.getX(i));
      const idx = Math.round(((a + Math.PI) / (Math.PI * 2)) * 36);
      const zig = (idx % 2 ? 1 : 0.35) * cuts[idx] * tears;
      pos.setY(i, y + zig * height * (k - 0.3) * 1.2);
    }
  }
  geo.computeVertexNormals();
  const skirt = new THREE.Mesh(geo, mat || clothMat(color));
  skirt.position.y = -height / 2 + H * 0.03;
  skirt.scale.z = 0.8;
  skirt.castShadow = true;
  rig.hips.add(skirt);
  return skirt;
}

// A hanging cloth panel (front or back of a loincloth), curved to the body, torn at the bottom.
export function flap(rig, { color, length, width, back = false, trim = null, seed = 5, tears = 0.35 }) {
  const { H, bulk: b } = rig;
  const w = width ?? H * 0.095 * b;
  const geo = new THREE.PlaneGeometry(w, length, 8, 10);
  geo.translate(0, -length / 2, 0);
  const pos = geo.attributes.position;
  const rand = seeded(seed);
  const cuts = Array.from({ length: 9 }, () => rand());
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const k = -y / length;
    const col = Math.round((x / w + 0.5) * 8);
    let ny = y;
    if (k > 0.98) ny = y + cuts[col] * length * tears * (col % 2 ? 1 : 0.4);
    const nx = x * (1 - k * 0.18);
    const nz = -((nx / w) ** 2) * w * 0.9 + k * H * 0.012;
    pos.setXYZ(i, nx, ny, nz);
  }
  geo.computeVertexNormals();
  const g = new THREE.Group();
  const panel = new THREE.Mesh(geo, clothMat(color));
  panel.castShadow = true;
  g.add(panel);
  if (trim) {
    const edge = new THREE.Mesh(geo, clothMat(trim, { metal: true }));
    edge.scale.set(1.1, 1.03, 1);
    edge.position.z = -0.004;
    g.add(edge);
  }
  g.position.set(0, H * 0.035, (back ? -1 : 1) * H * 0.064 * b);
  if (back) g.rotation.y = Math.PI;
  rig.hips.add(g);
  return g;
}

// A belt around the hips, with an optional gold buckle or bone skull.
export function belt(rig, mats, { color = '#3a2818', buckle = null, thick = 1 }) {
  const { H, bulk: b } = rig;
  const band = new THREE.Mesh(new THREE.TorusGeometry(H * 0.087 * b, H * 0.009 * thick, 8, 36), clothMat(color, { rough: 0.7 }));
  band.rotation.x = Math.PI / 2;
  band.scale.y = 0.76;
  band.position.y = H * 0.035;
  rig.hips.add(band);
  const front = H * 0.066 * b;
  if (buckle === 'gold') {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.022, H * 0.012, H * 0.026, 3), clothMat('#c99a3a', { metal: true }));
    plate.rotation.set(Math.PI / 2, 0, Math.PI);
    plate.position.set(0, H * 0.03, front + H * 0.004);
    plate.scale.z = 0.4;
    rig.hips.add(plate);
  } else if (buckle === 'skull') {
    const s = ellipsoid(H * 0.016, H * 0.018, H * 0.012, mats.bone);
    s.position.set(0, H * 0.028, front + H * 0.006);
    rig.hips.add(s);
    for (const side of [-1, 1]) {
      const eye = ellipsoid(H * 0.004, H * 0.005, H * 0.003, mats.pupil);
      eye.position.set(side * H * 0.006, H * 0.031, front + H * 0.017);
      rig.hips.add(eye);
    }
    for (const side of [-1, 1]) {
      const hornB = spike(new THREE.Vector3(side * H * 0.012, H * 0.038, front + H * 0.004), new THREE.Vector3(side, 0.8, 0), H * 0.016, H * 0.004, mats.bone);
      rig.hips.add(hornB);
    }
  }
}

// Cloth wraps around the forearms and shins.
export function wraps(rig, { color, arms = true, legs = true }) {
  const { H, bulk: b, muscle: m } = rig;
  const mat = clothMat(color);
  const ring = (parent, r, y, n, gap) => {
    for (let i = 0; i < n; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(r, H * 0.005, 6, 18), mat);
      t.rotation.x = Math.PI / 2 + (i % 2 ? 0.12 : -0.12);
      t.position.y = y - i * gap;
      parent.add(t);
    }
  };
  if (arms) for (const a of rig.arms) ring(a.elbow, H * 0.019 * b * (1 + m * 0.2), -a.foreLen * 0.6, 4, H * 0.012);
  if (legs) for (const l of rig.legs) ring(l.knee, H * 0.022 * b, -l.shinLen * 0.55, 5, H * 0.014);
}

// A strap from one shoulder across the chest.
export function chestStrap(rig, color) {
  const { H, bulk: b, torsoLen: tl } = rig;
  const strap = new THREE.Mesh(new THREE.TorusGeometry(H * 0.085 * b, H * 0.008, 6, 32), clothMat(color));
  strap.scale.set(1.05, 1.0, 0.7);
  strap.rotation.set(Math.PI / 2, 0.75, 0);
  strap.position.y = tl * 0.62;
  rig.spine.add(strap);
}

// A fur mantle over one shoulder and the upper back.
export function furMantle(rig, color, seed = 11) {
  const { H, bulk: b, torsoLen: tl } = rig;
  const rand = seeded(seed);
  const mat = clothMat(color, { rough: 1 });
  const g = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const a = -0.3 + rand() * 2.4; // around the left shoulder and back
    const x = -Math.cos(a) * H * 0.085 * b;
    const z = -Math.sin(a) * H * 0.052 * b;
    const base = new THREE.Vector3(x, tl * (0.88 + rand() * 0.1), z);
    const dir = new THREE.Vector3(x * 4, -1.2, z * 4 - 0.2);
    g.add(spike(base, dir, H * (0.05 + rand() * 0.04), H * 0.022, mat));
  }
  const pad = ellipsoid(H * 0.06 * b, H * 0.03, H * 0.055 * b, mat);
  pad.position.set(-H * 0.06 * b, tl * 0.95, 0);
  g.add(pad);
  rig.spine.add(g);
}

// A cord necklace of fangs, resting on the collarbones and dipping onto the chest.
export function toothNecklace(rig, mats) {
  const { H, bulk: b, torsoLen: tl, muscle: m } = rig;
  const r = H * 0.07 * b * (1 + m * 0.2);
  const g = new THREE.Group();
  g.position.set(0, tl * 0.98, 0);
  g.rotation.x = 0.6;
  const cord = new THREE.Mesh(new THREE.TorusGeometry(r, H * 0.003, 6, 28), clothMat('#2a1a10'));
  cord.rotation.x = Math.PI / 2;
  cord.scale.y = 0.8;
  g.add(cord);
  for (let i = 0; i < 7; i++) {
    const a = Math.PI / 2 + (i - 3) * 0.28;
    const p = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r * 0.8);
    g.add(spike(p, new THREE.Vector3(0, -1, -0.5), H * (i === 3 ? 0.03 : 0.022), H * 0.005, mats.bone));
  }
  rig.spine.add(g);
}

// Red war paint: streaks across the face and bands on the arms.
export function warPaint(rig, color) {
  const { head, headR: r, H } = rig;
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  for (const side of [-1, 1]) {
    const s = ellipsoid(r * 0.035, r * 0.28, r * 0.03, mat);
    s.position.set(side * r * 0.45, -r * 0.08, r * 0.66);
    s.rotation.set(-0.5, side * 0.6, side * 0.25);
    head.add(s);
  }
  const forehead = ellipsoid(r * 0.04, r * 0.2, r * 0.03, mat);
  forehead.position.set(0, r * 0.45, r * 0.85);
  forehead.rotation.x = -0.4;
  head.add(forehead);
  for (const a of rig.arms) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(H * 0.026 * rig.bulk * (1 + rig.muscle * 0.33), H * 0.004, 6, 20), mat);
    band.rotation.x = Math.PI / 2;
    band.position.y = -a.len * 0.35;
    a.shoulder.add(band);
  }
}

// A tall spiked gold crown.
export function spikedCrown(head, r, { color = '#c99a3a', gem = '#2a1a3a', points = 7 } = {}) {
  const gold = clothMat(color, { metal: true });
  const g = new THREE.Group();
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r * 0.82, r * 0.22, 32, 1, true), gold);
  g.add(band);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.84, r * 0.035, 6, 32), gold);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -r * 0.1;
  g.add(rim);
  for (let i = 0; i < points; i++) {
    const a = Math.PI / 2 + ((i - (points - 1) / 2) / points) * Math.PI * 1.7;
    const front = 1 - Math.abs(i - (points - 1) / 2) / points;
    const len = r * (0.35 + front * 0.55);
    const base = new THREE.Vector3(Math.cos(a) * r * 0.84, r * 0.08, Math.sin(a) * r * 0.84);
    g.add(spike(base, new THREE.Vector3(Math.cos(a) * 0.25, 1, Math.sin(a) * 0.25), len, r * 0.11, gold));
  }
  const stone = ellipsoid(r * 0.08, r * 0.1, r * 0.04, new THREE.MeshStandardMaterial({ color: gem, roughness: 0.15, metalness: 0.3 }));
  stone.position.set(0, 0, r * 0.86);
  g.add(stone);
  g.position.set(0, r * 0.62, -r * 0.05);
  g.rotation.x = -0.12;
  head.add(g);
  return g;
}
