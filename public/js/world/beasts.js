// The bodies of the great beasts (data/beasts.mjs): dragons with four legs and two great wings,
// wyverns whose wings are their front legs, and the Spirit King of the lake, a crowned giant of
// living water. Built from simple shapes, in metres, standing on the ground at y = 0.
import * as THREE from 'three';

const mats = new Map();
function mat(color, o = {}) {
  const k = `${color}|${JSON.stringify(o)}`;
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o }));
  return mats.get(k);
}
function mesh(geo, m, parent, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  parent.add(o);
  return o;
}
// a bone (a tapered cylinder) from a to b, in its parent's space
function bone(parent, a, b, r0, r1, m) {
  const d = new THREE.Vector3().subVectors(b, a);
  const o = mesh(new THREE.CylinderGeometry(r1, r0, d.length(), 7), m, parent);
  o.position.copy(a).addScaledVector(d, 0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return o;
}

export function buildBeast(def) {
  return def.shape === 'spirit' ? buildSpirit(def) : buildDragon(def);
}

// ---------- dragons and wyverns ----------
function buildDragon(def) {
  const L = def.len, C = def.colors, wyvern = def.shape === 'wyvern';
  const scales = mat(C.scales, { roughness: 0.55, metalness: 0.15 });
  const belly = mat(C.belly, { roughness: 0.6 });
  const horn = mat(C.horn, { roughness: 0.4 });
  const spine = mat(C.spine, { roughness: 0.5 });
  const eyeM = new THREE.MeshStandardMaterial({ color: C.eye, emissive: C.eye, emissiveIntensity: 2.5 });
  const wingM = new THREE.MeshStandardMaterial({ color: C.wing, roughness: 0.8, side: THREE.DoubleSide, transparent: true, opacity: 0.94 });

  const root = new THREE.Group();
  const y0 = L * (wyvern ? 0.15 : 0.17);
  const beast = new THREE.Group(); beast.position.y = y0; root.add(beast);
  // the body: a long barrel, paler underneath
  const bw = L * (wyvern ? 0.06 : 0.075), bh = L * (wyvern ? 0.06 : 0.07), bl = L * (wyvern ? 0.15 : 0.17);
  const body = mesh(new THREE.SphereGeometry(1, 16, 12), scales, beast); body.scale.set(bw, bh, bl);
  const under = mesh(new THREE.SphereGeometry(1, 14, 10), belly, beast, 0, -bh * 0.28, 0); under.scale.set(bw * 0.86, bh * 0.78, bl * 0.92);
  // spines down the back
  const spike = (parent, s, z, y) => { const c = mesh(new THREE.ConeGeometry(s * 0.35, s, 5), spine, parent, 0, y, z); c.rotation.x = -0.5; return c; };
  for (let i = -3; i <= 3; i++) spike(beast, L * 0.022 * (1 - Math.abs(i) * 0.1), (i / 3) * bl * 0.8, bh * 0.95);

  // the neck: a chain of joints rising forward to the head
  const neck = [];
  const nSeg = wyvern ? 4 : 5, segL = L * (wyvern ? 0.045 : 0.05);
  let parent = new THREE.Group(); parent.position.set(0, bh * 0.35, bl * 0.85); beast.add(parent);
  const neckBase = parent;
  for (let i = 0; i < nSeg; i++) {
    const g = new THREE.Group();
    g.position.z = i === 0 ? 0 : segL;
    g.rotation.x = i < 2 ? -0.32 : 0.12;
    parent.add(g);
    const r = L * (wyvern ? 0.026 : 0.032) * (1 - i * 0.08);
    const s = mesh(new THREE.SphereGeometry(1, 10, 8), scales, g, 0, 0, segL * 0.5); s.scale.set(r, r, segL * 0.85);
    spike(g, L * 0.015, segL * 0.5, r * 0.9);
    neck.push(g);
    parent = g;
  }
  // the head, with a jaw that opens, horns swept back and burning eyes
  const head = new THREE.Group(); head.position.z = segL; head.rotation.x = 0.25; parent.add(head);
  const hs = L * (wyvern ? 0.04 : 0.045);
  const skull = mesh(new THREE.BoxGeometry(hs * 1.3, hs, hs * 1.6), scales, head, 0, hs * 0.15, hs * 0.5);
  const snout = mesh(new THREE.BoxGeometry(hs * 0.9, hs * 0.6, hs * 1.4), scales, head, 0, hs * 0.05, hs * 1.7);
  void skull; void snout;
  const jaw = new THREE.Group(); jaw.position.set(0, -hs * 0.3, hs * 0.1); head.add(jaw);
  mesh(new THREE.BoxGeometry(hs * 0.85, hs * 0.28, hs * 2.3), belly, jaw, 0, -hs * 0.05, hs * 1.15);
  for (const s of [-1, 1]) {
    const h1 = mesh(new THREE.ConeGeometry(hs * 0.18, hs * 1.6, 6), horn, head, s * hs * 0.45, hs * 0.75, -hs * 0.3);
    h1.rotation.set(-1.9, 0, s * -0.25);
    const h2 = mesh(new THREE.ConeGeometry(hs * 0.1, hs * 0.8, 5), horn, head, s * hs * 0.6, hs * 0.35, -hs * 0.1);
    h2.rotation.set(-1.7, 0, s * -0.7);
    mesh(new THREE.SphereGeometry(hs * 0.14, 8, 6), eyeM, head, s * hs * 0.58, hs * 0.38, hs * 0.75);
    for (let k = 0; k < 3; k++) { const t = mesh(new THREE.ConeGeometry(hs * 0.06, hs * 0.22, 4), mat('#f4eee0'), head, s * hs * 0.38, -hs * 0.28, hs * (1.4 + k * 0.4)); t.rotation.x = Math.PI; }
  }
  const mouth = new THREE.Object3D(); mouth.position.set(0, -hs * 0.2, hs * 2.5); head.add(mouth);

  // the tail, tapering to a spade
  const tail = [];
  parent = new THREE.Group(); parent.position.set(0, bh * 0.1, -bl * 0.9); parent.rotation.y = Math.PI; beast.add(parent);
  const tSeg = 9, tL = L * (wyvern ? 0.06 : 0.055);
  for (let i = 0; i < tSeg; i++) {
    const g = new THREE.Group();
    g.position.z = i === 0 ? 0 : tL;
    g.rotation.x = i === 0 ? 0.15 : 0.03;
    parent.add(g);
    const r = L * 0.04 * (1 - i / (tSeg + 1));
    const s = mesh(new THREE.SphereGeometry(1, 9, 7), scales, g, 0, 0, tL * 0.5); s.scale.set(r, r * 0.9, tL * 0.62);
    if (i % 2 === 0) spike(g, L * 0.014 * (1 - i / tSeg), tL * 0.5, r * 0.85).rotation.x = 0.5;
    tail.push(g);
    parent = g;
  }
  const spade = mesh(new THREE.ConeGeometry(L * 0.025, L * 0.05, 4), spine, parent, 0, 0, tL + L * 0.02);
  spade.rotation.x = Math.PI / 2; spade.scale.set(1.4, 1, 0.3);

  // the wings: a long arm to the wrist, fingers fanning back, and the skin stretched between
  const wings = [];
  const S = L * (wyvern ? 0.62 : 0.56);
  for (const side of [1, -1]) {
    const g = new THREE.Group();
    g.position.set(side * bw * 0.7, bh * 0.55, wyvern ? bl * 0.5 : bl * 0.35);
    beast.add(g);
    const inner = new THREE.Group(); inner.scale.x = side; g.add(inner);
    const P = (x, back) => new THREE.Vector3(x * S, 0, -back * S);
    const wrist = P(0.42, -0.08);
    const tips = [P(1, 0.1), P(0.82, 0.42), P(0.56, 0.6), P(0.3, 0.62)];
    bone(inner, P(0, 0), wrist, S * 0.035, S * 0.025, scales);
    for (const tp of tips) bone(inner, wrist, tp, S * 0.016, S * 0.005, scales);
    mesh(new THREE.ConeGeometry(S * 0.02, S * 0.09, 5), horn, inner, wrist.x, wrist.y, wrist.z + S * 0.04).rotation.x = Math.PI / 2;
    const shape = new THREE.Shape();
    const pts = [[0, 0], [0.42, -0.08], [1, 0.1], [0.82, 0.42], [0.56, 0.6], [0.3, 0.62], [0.04, 0.42]];
    pts.forEach(([x, b], i) => (i ? shape.lineTo(x * S, b * S) : shape.moveTo(x * S, b * S)));
    const skin = new THREE.Mesh(new THREE.ShapeGeometry(shape), wingM);
    skin.rotation.x = -Math.PI / 2; // (the shape's y runs back along the body)
    skin.castShadow = true;
    inner.add(skin);
    wings.push({ g, side });
  }

  // legs: four on a dragon; a wyvern stands on its two hind legs
  const legs = [];
  const legL = y0 - bh * 0.4;
  for (const [z, front] of wyvern ? [[-bl * 0.35, false]] : [[bl * 0.55, true], [-bl * 0.45, false]]) {
    for (const side of [1, -1]) {
      const hip = new THREE.Group(); hip.position.set(side * bw * 0.75, -bh * 0.4, z); beast.add(hip);
      const thick = L * (front ? 0.022 : wyvern ? 0.03 : 0.028);
      const th = mesh(new THREE.CylinderGeometry(thick, thick * 0.8, legL * 0.55, 8), scales, hip, 0, -legL * 0.27, 0);
      void th;
      const knee = new THREE.Group(); knee.position.y = -legL * 0.52; hip.add(knee);
      knee.rotation.x = front ? 0.2 : -0.3;
      mesh(new THREE.CylinderGeometry(thick * 0.75, thick * 0.6, legL * 0.5, 7), scales, knee, 0, -legL * 0.24, 0);
      const foot = new THREE.Group(); foot.position.y = -legL * 0.48; knee.add(foot);
      for (const a of [-0.4, 0, 0.4]) { const c = mesh(new THREE.ConeGeometry(thick * 0.25, thick * 1.6, 5), horn, foot, Math.sin(a) * thick, 0, Math.cos(a) * thick * 0.9); c.rotation.x = Math.PI / 2 + 0.3; c.rotation.y = a; }
      legs.push({ hip, knee, front, side });
    }
  }

  // the King of the Wild Dragons: scales full of stars, wings like a nebula, a crown and a halo of stars
  let cosmic = null;
  if (def.cosmic) {
    wingM.emissive = new THREE.Color('#7a2ad0'); wingM.emissiveIntensity = 0.55;
    scales.emissive = new THREE.Color('#2a1a60'); scales.emissiveIntensity = 0.35;
    const starM = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const starG = new THREE.SphereGeometry(L * 0.0035, 5, 4);
    const sprinkle = (parent, n, at) => { for (let i = 0; i < n; i++) mesh(starG, starM, parent, ...at()).castShadow = false; };
    // (on the body's skin, and over each wing)
    sprinkle(beast, 70, () => { const a = Math.random() * 6.28, b = Math.random() * 2 - 1, r = Math.sqrt(1 - b * b); return [Math.cos(a) * r * bw * 1.01, Math.sin(a) * r * bh * 1.01, b * bl]; });
    for (const w of wings) {
      const inner = w.g.children[0];
      sprinkle(inner, 60, () => { const x = 0.05 + Math.random() * 0.75, b = Math.random() * 0.55 * (1 - x * 0.4); return [x * S, 0.02, -b * S]; });
    }
    // a crown of pale starlight horns
    const crownM = new THREE.MeshStandardMaterial({ color: '#fff4d0', emissive: '#e8c8ff', emissiveIntensity: 1.4, metalness: 0.6, roughness: 0.3 });
    const ring = mesh(new THREE.TorusGeometry(hs * 0.55, hs * 0.07, 6, 18), crownM, head, 0, hs * 0.75, hs * 0.1); ring.rotation.x = Math.PI / 2 - 0.2;
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const c = mesh(new THREE.ConeGeometry(hs * 0.08, hs * (i % 2 ? 0.45 : 0.75), 5), crownM, head, Math.cos(a) * hs * 0.55, hs * 1.05, hs * 0.1 + Math.sin(a) * hs * 0.55); c.rotation.x = -0.2; }
    // the halo: stars that circle above his back, and a light that colours the land below him
    const halo = new THREE.Group(); halo.position.set(0, bh * 2.2, 0); beast.add(halo);
    const orbM = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#c8a0ff', emissiveIntensity: 3 });
    const orbs = [];
    for (let i = 0; i < 9; i++) { const o = mesh(new THREE.SphereGeometry(L * 0.012, 8, 6), orbM, halo); o.castShadow = false; orbs.push(o); }
    const light = new THREE.PointLight('#a060ff', 60, L * 4, 1.4); light.position.y = bh * 1.5; beast.add(light);
    cosmic = { halo, orbs, light, r: bw * 2.2, wingM };
  }

  root.traverse((o) => { if (o.isMesh) o.receiveShadow = false; });
  root.userData.beast = { shape: def.shape, beast, body, neck, neckBase, head, jaw, mouth, tail, wings, legs, y0, L, cosmic };
  root.userData.height = y0 + bh + L * 0.12;
  return root;
}

// ---------- the Spirit King ----------
function buildSpirit(def) {
  const C = def.colors, H = def.height || 9;
  const water = new THREE.MeshStandardMaterial({ color: C.body, emissive: C.glow, emissiveIntensity: 0.55, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.72 });
  const deep = new THREE.MeshStandardMaterial({ color: '#2a8aa8', emissive: '#4ac0e0', emissiveIntensity: 0.4, roughness: 0.1, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
  const gold = mat(C.crown, { metalness: 0.8, roughness: 0.25 });
  const glow = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: C.glow, emissiveIntensity: 3 });
  const root = new THREE.Group();
  const beast = new THREE.Group(); root.add(beast);
  // a robe of falling water, a broad chest, and a head crowned in gold and pearl
  const robe = mesh(new THREE.CylinderGeometry(H * 0.09, H * 0.24, H * 0.62, 20, 1, true), deep, beast, 0, H * 0.31, 0);
  void robe;
  const chest = mesh(new THREE.SphereGeometry(1, 16, 12), water, beast, 0, H * 0.66, 0); chest.scale.set(H * 0.11, H * 0.12, H * 0.08);
  const head = new THREE.Group(); head.position.y = H * 0.83; beast.add(head);
  mesh(new THREE.SphereGeometry(H * 0.065, 16, 12), water, head);
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(H * 0.011, 8, 6), glow, head, s * H * 0.024, H * 0.008, H * 0.055);
  // a beard of flowing water
  const beard = mesh(new THREE.ConeGeometry(H * 0.04, H * 0.12, 10), water, head, 0, -H * 0.08, H * 0.03); beard.rotation.x = Math.PI;
  const crown = new THREE.Group(); crown.position.y = H * 0.06; head.add(crown);
  mesh(new THREE.TorusGeometry(H * 0.055, H * 0.008, 8, 24), gold, crown).rotation.x = Math.PI / 2;
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; mesh(new THREE.ConeGeometry(H * 0.01, H * 0.05, 5), gold, crown, Math.sin(a) * H * 0.055, H * 0.025, Math.cos(a) * H * 0.055); }
  mesh(new THREE.SphereGeometry(H * 0.014, 10, 8), glow, crown, 0, H * 0.012, H * 0.058);
  // arms, held out over the water
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * H * 0.12, H * 0.72, 0); beast.add(sh);
    sh.rotation.z = s * 0.5;
    bone(sh, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -H * 0.2, H * 0.04), H * 0.03, H * 0.022, water);
    const hand = mesh(new THREE.SphereGeometry(H * 0.03, 10, 8), water, sh, 0, -H * 0.21, H * 0.05);
    arms.push({ sh, hand, side: s });
  }
  // orbs of water circling him, and rings spreading on the lake round his feet
  const orbs = [];
  for (let i = 0; i < 4; i++) { const o = mesh(new THREE.SphereGeometry(H * 0.025, 10, 8), glow, root, 0, H * 0.5, 0); orbs.push(o); }
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), new THREE.MeshBasicMaterial({ color: C.glow, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
    r.rotation.x = -Math.PI / 2; r.position.y = 0.05; root.add(r); rings.push(r);
  }
  const light = new THREE.PointLight(C.glow, 30, 45, 1.6); light.position.y = H * 0.6; root.add(light);
  const mouth = new THREE.Object3D(); arms[1].hand.add(mouth);
  root.userData.beast = { shape: 'spirit', beast, head, arms, orbs, rings, light, mouth, H };
  root.userData.height = H;
  return root;
}

// Move a beast's body. `o`: { air (in flight), speed, open (mouth open / casting), dead (seconds) }
export function animateBeast(root, t, o = {}) {
  const B = root.userData.beast;
  if (!B) return;
  if (B.shape === 'spirit') {
    B.beast.position.y = Math.sin(t * 1.1) * 0.25;
    B.beast.rotation.z = 0;
    for (const a of B.arms) {
      a.sh.rotation.x = o.open ? -1.4 : -0.2 + Math.sin(t * 0.8 + a.side) * 0.1;
      a.sh.rotation.z = a.side * (o.open ? 0.2 : 0.5);
    }
    B.orbs.forEach((orb, i) => { const a = t * 0.9 + (i / B.orbs.length) * Math.PI * 2; orb.position.set(Math.cos(a) * B.H * 0.28, B.H * (0.45 + Math.sin(t * 1.7 + i) * 0.08), Math.sin(a) * B.H * 0.28); });
    B.rings.forEach((r, i) => { const k = ((t * 0.35 + i / B.rings.length) % 1); r.scale.setScalar(1 + k * B.H * 0.9); r.material.opacity = 0.45 * (1 - k); });
    B.light.intensity = 26 + Math.sin(t * 2.3) * 5;
    if (o.dead) { const k = Math.min(1, o.dead / 3); B.beast.position.y = -k * B.H; B.light.intensity *= 1 - k; }
    return;
  }
  const { beast, neck, head, jaw, tail, wings, legs, y0, shape, cosmic } = B;
  if (cosmic) {
    cosmic.halo.visible = !o.dead;
    cosmic.orbs.forEach((orb, i) => { const a = t * 0.7 + (i / cosmic.orbs.length) * Math.PI * 2; orb.position.set(Math.cos(a) * cosmic.r, Math.sin(t * 1.3 + i * 2) * cosmic.r * 0.15, Math.sin(a) * cosmic.r); });
    cosmic.light.intensity = o.dead ? Math.max(0, 60 - o.dead * 20) : 50 + Math.sin(t * 1.7) * 12 + (o.glow || 0) * 300;
    cosmic.wingM.emissiveIntensity = 0.45 + Math.sin(t * 0.8) * 0.15 + (o.glow || 0) * 2;
  }
  if (o.dead) {
    // fallen on its side, wings spread on the ground
    const k = Math.min(1, o.dead / 1.2);
    beast.rotation.z = k * 1.35; beast.rotation.x = 0;
    beast.position.y = y0 * (1 - k * 0.55);
    for (const w of wings) { w.g.rotation.set(0, w.side * 1.25 * k, w.side * 0.35 * k); }
    for (const l of legs) { l.hip.rotation.x = 0.4 * k; l.knee.rotation.x = 0.5 * k; }
    jaw.rotation.x = 0.35 * k;
    neck.forEach((g, i) => { g.rotation.y = 0.15 * k; if (i > 1) g.rotation.x = 0.15 * k; });
    return;
  }
  const flying = o.air > 0.8;
  // wings beat while it flies (slower as it glides), and fold along its sides on the ground
  const rate = shape === 'wyvern' ? 4.4 : 3.4;
  const beat = Math.sin(t * rate);
  for (const w of wings) {
    if (flying) { w.g.rotation.set(0, 0, w.side * (beat * 0.62 + 0.12)); }
    else { w.g.rotation.set(0, w.side * 1.25, w.side * 0.35); } // (swept back along its sides)
  }
  beast.position.y = y0 + (flying ? -beat * y0 * 0.05 : 0);
  beast.rotation.x = flying ? (o.pitch || 0) : 0;
  beast.rotation.z = flying ? (o.bank || 0) : 0;
  // the tail sways, the neck snakes a little
  tail.forEach((g, i) => { g.rotation.y = Math.sin(t * 1.4 - i * 0.55) * 0.09; });
  neck.forEach((g, i) => { g.rotation.y = Math.sin(t * 0.9 - i * 0.4) * 0.04; });
  head.rotation.x = 0.25 + (o.open ? -0.15 : 0);
  jaw.rotation.x = o.open ? 0.55 + Math.sin(t * 30) * 0.04 : 0.04;
  // legs tucked back in flight; a stride when it walks
  const step = Math.sin(t * (2 + (o.speed || 0) * 0.4));
  for (const l of legs) {
    if (flying) { l.hip.rotation.x = l.front ? 0.9 : 1.1; l.knee.rotation.x = l.front ? -1.2 : 0.6; }
    else { const s = (o.speed || 0) > 0.3 ? step * 0.45 * l.side * (l.front ? 1 : -1) : 0; l.hip.rotation.x = s; l.knee.rotation.x = l.front ? 0.2 : -0.3; }
  }
}

// A breath (fire, frost, storm or water) from a beast's mouth: a cone of light pointing along +z,
// `len` metres long. Point it with lookAt.
const BREATH = {
  fire: ['#ffb030', '#ff5a10'], frost: ['#e8fbff', '#6ad0ff'], storm: ['#f4f8ff', '#7ab8ff'], water: ['#e0fcff', '#40c0e8'], cosmic: ['#fff0ff', '#9a40ff'],
};
export function makeBreath(kind, len = 16, width = 3) {
  const [c1, c2] = BREATH[kind] || BREATH.fire;
  const g = new THREE.Group();
  const cone = (r, l, color, op) => {
    const geo = new THREE.ConeGeometry(r, l, 18, 1, true);
    geo.rotateX(-Math.PI / 2); geo.translate(0, 0, l / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    g.add(m);
    return m;
  };
  const outer = cone(width, len, c2, 0.55), inner = cone(width * 0.45, len * 0.85, c1, 0.8);
  const light = new THREE.PointLight(c2, 40, len * 2.2, 1.5); light.position.z = len * 0.4; g.add(light);
  g.userData.tick = (t) => {
    outer.scale.set(1 + Math.sin(t * 40) * 0.08, 1 + Math.cos(t * 37) * 0.08, 1);
    inner.rotation.z = t * 9;
    light.intensity = 32 + Math.sin(t * 50) * 10;
  };
  g.userData.dispose = () => g.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return g;
}

// A lake of lava in a volcano's crater (`r` metres across), glowing and slowly churning
export function buildLavaLake(r) {
  const g = new THREE.Group();
  const lava = new THREE.MeshStandardMaterial({ color: '#ff6a1a', emissive: '#ff3a00', emissiveIntensity: 2.2, roughness: 0.6 });
  const crust = new THREE.MeshStandardMaterial({ color: '#2a1a14', roughness: 1 });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(r, 48), lava);
  pool.rotation.x = -Math.PI / 2; g.add(pool);
  // dark crusts drifting on it
  const crusts = [];
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Mesh(new THREE.CircleGeometry(r * (0.05 + Math.random() * 0.08), 7), crust);
    c.rotation.x = -Math.PI / 2; c.position.y = 0.3;
    const a = Math.random() * 6.28, d = Math.random() * r * 0.8;
    c.userData.o = { a, d, s: (Math.random() - 0.5) * 0.02 };
    g.add(c); crusts.push(c);
  }
  const light = new THREE.PointLight('#ff5a1a', 400, r * 4, 1.2); light.position.y = r * 0.3; g.add(light);
  g.userData.tick = (t) => {
    lava.emissiveIntensity = 2 + Math.sin(t * 0.9) * 0.4;
    for (const c of crusts) { const o = c.userData.o; const a = o.a + t * o.s; c.position.x = Math.cos(a) * o.d; c.position.z = Math.sin(a) * o.d; }
    light.intensity = 380 + Math.sin(t * 1.3) * 60;
  };
  return g;
}

// The Star Throne: the King of the Wild Dragons' peak. Rune stones float in a ring round the top and
// a pillar of starlight rises into the sky (seen from far away).
export function buildStarThrone(r = 40) {
  const g = new THREE.Group();
  const stoneM = new THREE.MeshStandardMaterial({ color: '#2a2440', roughness: 0.8 });
  const runeM = new THREE.MeshBasicMaterial({ color: '#c8a0ff' });
  const stones = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const s = new THREE.Group(); s.position.set(Math.cos(a) * r, 6, Math.sin(a) * r); s.rotation.y = -a; g.add(s);
    mesh(new THREE.BoxGeometry(2.2, 6, 1.2), stoneM, s);
    for (let k = 0; k < 3; k++) { const m = mesh(new THREE.PlaneGeometry(1, 0.5), runeM, s, 0, -1.5 + k * 1.5, 0.61); m.castShadow = false; m.rotation.z = k * 0.6; }
    stones.push(s);
  }
  const beamM = new THREE.MeshBasicMaterial({ color: '#b080ff', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(3, 6, 900, 16, 1, true), beamM); beam.position.y = 450; g.add(beam);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.6, 900, 10, 1, true), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })); core.position.y = 450; g.add(core);
  const light = new THREE.PointLight('#a070ff', 80, 140, 1.2); light.position.y = 10; g.add(light);
  g.userData.tick = (t) => {
    stones.forEach((s, i) => { s.position.y = 6 + Math.sin(t * 0.6 + i) * 1.2; s.rotation.x = Math.sin(t * 0.4 + i) * 0.1; });
    g.rotation.y = t * 0.05;
    beamM.opacity = 0.18 + Math.sin(t * 1.3) * 0.05;
  };
  return g;
}

// Starfall: a falling star (a burning rock and its trail) and the ring of light on the ground where it
// will strike. `land(t)` from 0 (just called) to 1 (it strikes).
export function makeStarfall(radius = 4.5) {
  const g = new THREE.Group();
  const ringM = new THREE.MeshBasicMaterial({ color: '#c080ff', transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.85, radius, 32), ringM); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.3; g.add(ring);
  const rock = new THREE.Group(); g.add(rock);
  const rockM = new THREE.MeshStandardMaterial({ color: '#fff0ff', emissive: '#c080ff', emissiveIntensity: 3 });
  rock.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 0), rockM));
  const trailGeo = new THREE.ConeGeometry(1.1, 14, 10, 1, true); trailGeo.translate(0, 7, 0);
  const trailM = new THREE.MeshBasicMaterial({ color: '#a060ff', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
  rock.add(new THREE.Mesh(trailGeo, trailM));
  const flashM = new THREE.MeshBasicMaterial({ color: '#f0d8ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const flash = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 10), flashM); flash.visible = false; g.add(flash);
  g.userData.tick = (k, t) => {
    ringM.opacity = 0.35 + Math.sin(t * 14) * 0.25;
    rock.visible = k < 1; rock.position.set(-(1 - k) * 30, (1 - k) * 90, 0); rock.rotation.z = 0.32;
    if (k >= 1) { const e = Math.min(1, (k - 1) * 3); flash.visible = true; flash.scale.setScalar(0.4 + e); flashM.opacity = 0.8 * (1 - e); ring.visible = false; }
  };
  g.userData.dispose = () => g.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return g;
}

// The Supernova: a ball of starlight that swells round the King while he gathers it, then bursts.
// `k` from 0 to 1 while it gathers, then 1 to 2 as it bursts outwards.
export function makeNova(radius = 45) {
  const m = new THREE.MeshBasicMaterial({ color: '#e8c8ff', transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const s = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), m);
  const light = new THREE.PointLight('#c090ff', 0, radius * 3, 1.2); s.add(light);
  s.userData.tick = (k, t) => {
    if (k < 1) { s.scale.setScalar(4 + k * 8 + Math.sin(t * 20) * 0.5); m.opacity = 0.2 + k * 0.4; light.intensity = 100 + k * 400; }
    else { const e = Math.min(1, k - 1); s.scale.setScalar(12 + e * radius); m.opacity = 0.7 * (1 - e); light.intensity = 900 * (1 - e); }
  };
  s.userData.dispose = () => { s.geometry.dispose(); m.dispose(); };
  return s;
}
