// Work animations: someone acting out their job at a work station, step by step. The same stations
// are used by the shopkeepers inside the town buildings (who loop their work for ever) and by the
// player's own character in the work scene that plays when they merge, forge or brew.
//
// A station is built round its worker: the worker stands at z = WORKER_Z facing -z, and the station's
// things sit along x in front of them. Kinds:
//   smith  - takes the pieces, heats them in the forge, pours the metal into a mould, hammers the
//            new piece on the anvil (merging; `ore: true` starts from ore instead, for forging)
//   juice  - the barkeeper picks fruit, presses it, and pours a cup of fresh juice
//   brew   - a potion maker adds a herb, stirs the cauldron and fills a bottle
//   cook   - a cook stirs the pot and ladles a bowl of food
//   sew    - a tailor sews a cloth and folds it onto the pile
//   polish - an armourer polishes a helmet until it shines
import * as THREE from 'three';
import { GlowLight } from './lightpool.js';
import { animateCharacter } from '../characters/model.js';
import { weaponModel } from '../characters/gear.js';

const lerp = THREE.MathUtils.lerp;
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const ease = (k) => k * k * (3 - 2 * k);
export const WORKER_Z = 0.8;
const HOT = new THREE.Color('#ff6a18');

// ---------- small helpers for the things on a station ----------
function kit(group) {
  const mats = [];
  const mat = (color, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra }); mats.push(m); return m; };
  const add = (parent, geo, m, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = true; o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const box = (w, h, d, m, x, y, z, parent = group) => add(parent, new THREE.BoxGeometry(w, h, d), m, x, y + h / 2, z);
  const cyl = (r1, r2, h, m, x, y, z, parent = group, n = 14) => add(parent, new THREE.CylinderGeometry(r1, r2, h, n), m, x, y + h / 2, z);
  const ball = (r, m, x, y, z, parent = group) => add(parent, new THREE.SphereGeometry(r, 12, 10), m, x, y, z);
  return { mats, mat, add, box, cyl, ball };
}
// Make every mesh in `obj` able to glow red-hot: its materials are copied so nothing else glows
function glowable(obj) {
  const list = [];
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    list.push({ m: o.material, base: o.material.emissive ? o.material.emissive.clone() : null });
  });
  return (a) => {
    for (const { m, base } of list) {
      if (!base) continue;
      m.emissive.copy(base).lerp(HOT, a);
      m.emissiveIntensity = 1 + a * 1.5;
    }
  };
}
// A thin glowing stream of liquid between two points (in the station's space)
function stream(group, color) {
  const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, transparent: true, opacity: 0.9 });
  const o = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1, 8), m);
  o.visible = false;
  group.add(o);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  return {
    mesh: o,
    set(from, to, color2) {
      a.copy(from); b.copy(to);
      const len = a.distanceTo(b);
      if (len < 0.01) { o.visible = false; return; }
      o.visible = true;
      o.position.copy(a).add(b).multiplyScalar(0.5);
      o.scale.set(1, len, 1);
      o.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
      if (color2) { m.color.set(color2); m.emissive.set(color2); }
    },
    hide() { o.visible = false; },
  };
}
// A puff of sparks (or bubbles, or a sparkle) at a spot, played by `burst(t)` then `tick(t)`
function sparks(group, color, n = 18, size = 0.04) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color, size, transparent: true, depthWrite: false });
  const pts = new THREE.Points(geo, m);
  pts.visible = false;
  pts.frustumCulled = false;
  group.add(pts);
  const vel = Array.from({ length: n }, () => new THREE.Vector3());
  let at = null, from = -1;
  return {
    burst(spot, t, spread = 1.6, rise = 1.4) {
      at = spot.clone(); from = t;
      for (const v of vel) v.set((Math.random() - 0.5) * spread, Math.random() * rise + 0.4, (Math.random() - 0.5) * spread);
    },
    tick(t, life = 0.5, gravity = 4) {
      const dt = t - from;
      if (!at || dt < 0 || dt > life) { pts.visible = false; return; }
      pts.visible = true;
      m.opacity = 1 - dt / life;
      for (let i = 0; i < n; i++) {
        pos[i * 3] = at.x + vel[i].x * dt;
        pos[i * 3 + 1] = at.y + vel[i].y * dt - gravity * dt * dt * 0.5;
        pos[i * 3 + 2] = at.z + vel[i].z * dt;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
// A piece of gear to work on: the weapon's own model, or a simple shape for armour
function pieceProp(item, plus = 0, mat) {
  if (!item) return weaponModel({ id: 'iron_sword' }, 0);
  if (item.kind === 'weapon') return weaponModel(item, plus);
  const g = new THREE.Group();
  const m = mat(item.look?.color || '#8f949c', item.look?.metal ? { metalness: 0.8, roughness: 0.35 } : {});
  const shape = {
    head: () => new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    body: () => new THREE.BoxGeometry(0.42, 0.5, 0.14),
    legs: () => new THREE.BoxGeometry(0.34, 0.55, 0.1),
    feet: () => new THREE.BoxGeometry(0.16, 0.14, 0.3),
    shield: () => new THREE.CylinderGeometry(0.26, 0.26, 0.04, item.def >= 15 ? 4 : 20),
  }[item.slot] || (() => new THREE.BoxGeometry(0.3, 0.3, 0.1));
  const o = new THREE.Mesh(shape(), m);
  o.castShadow = true;
  if (item.slot === 'shield') o.rotation.x = Math.PI / 2;
  g.add(o);
  return g;
}

// ---------- posing the worker ----------
const arms = (w) => w.userData.rig?.arms || [];
function poseArms(w, right, left = right, elbow = -0.25) {
  const [r, l] = arms(w);
  if (r) { r.shoulder.rotation.x = right; r.elbow.rotation.x = elbow; }
  if (l) { l.shoulder.rotation.x = left; l.elbow.rotation.x = elbow; }
}
// where a held thing goes: the worker's hand, or (bodies without arms) a spot in front of them
function handOf(w, i = 0) {
  const a = arms(w)[i];
  if (a) return a.hand;
  if (!w.userData.fakeHands) {
    w.userData.fakeHands = [0, 1].map((k) => {
      const o = new THREE.Object3D();
      o.position.set(k ? -0.25 : 0.25, (w.userData.height || 1.6) * 0.55, 0.45);
      w.add(o);
      return o;
    });
  }
  return w.userData.fakeHands[i];
}

// ---------- the stations ----------
// Each returns { steps, reset, tick } where steps are { d (seconds), walk (x to walk to),
// text, pose(worker, k), act(k, t) }.
function smithStation(K, group, opts) {
  const { mat, box, cyl } = K;
  const stone = mat('#6e675e'), soot = mat('#2a2622'), wood = mat('#5a3e26'), steel = mat('#4a4c52', { metalness: 0.85, roughness: 0.4 });
  // the forge on the left, with its glowing coals and fire
  const FX = -1.7, AX = 0, MX = 1.7;
  box(1.2, 0.85, 0.95, stone, FX, 0, -0.35);
  box(1.3, 0.12, 1.05, soot, FX, 0.85, -0.35);
  const coals = box(0.8, 0.06, 0.6, mat('#ff6a18', { emissive: '#ff4a08', emissiveIntensity: 2 }), FX, 0.95, -0.35);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 8), mat('#ff8a20', { emissive: '#ff5a08', emissiveIntensity: 2.5, transparent: true, opacity: 0.85 }));
  flame.position.set(FX, 1.18, -0.4);
  group.add(flame);
  box(1.1, 1.6, 0.5, stone, FX, 1.7, -0.7); // the hood and chimney
  const fire = new GlowLight('#ff8a40', 10, 7, 1.6);
  fire.position.set(FX, 1.5, 0.2);
  group.add(fire);
  // the anvil in the middle, on its stump
  cyl(0.24, 0.28, 0.5, wood, AX, 0, -0.25);
  box(0.75, 0.2, 0.3, steel, AX, 0.5, -0.25);
  box(0.25, 0.08, 0.2, steel, AX + 0.45, 0.62, -0.25);
  const anvilTop = new THREE.Vector3(AX, 0.72, -0.25);
  // the mould on its table on the right; its channel glows when the metal goes in
  box(1, 0.7, 0.7, wood, MX, 0, -0.3);
  box(0.8, 0.14, 0.42, mat('#3a3632'), MX, 0.7, -0.3);
  const channel = box(0.62, 0.02, 0.08, mat('#1a1816', { emissive: '#000000' }), MX, 0.84, -0.3);
  const mouldTop = new THREE.Vector3(MX, 0.86, -0.3);
  // the hammer leans against the anvil until it's needed
  const hammer = new THREE.Group();
  K.add(hammer, new THREE.CylinderGeometry(0.02, 0.02, 0.42, 6), wood, 0, 0, 0.2).rotation.x = Math.PI / 2;
  K.add(hammer, new THREE.BoxGeometry(0.1, 0.1, 0.18), steel, 0, 0, 0.42).rotation.y = Math.PI / 2;
  // a crucible for the molten metal
  const crucible = new THREE.Group();
  K.add(crucible, new THREE.CylinderGeometry(0.11, 0.08, 0.16, 12), mat('#3a3430'), 0, 0, 0.12);
  const molten = K.add(crucible, new THREE.CylinderGeometry(0.095, 0.095, 0.02, 12), mat('#ff8a20', { emissive: '#ff6a10', emissiveIntensity: 2.2 }), 0, 0.07, 0.12);
  crucible.visible = false;
  const pour = stream(group, '#ff8a20');
  const fly = sparks(group, '#ffc060');

  // the pieces going in (two pieces, or two lumps of ore) and the piece that comes out
  const ins = (opts.ore ? [0, 1].map(() => {
    const g = new THREE.Group();
    const lump = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09, 0), mat(opts.oreColor || '#5a5a60', { roughness: 0.6, metalness: 0.4 }));
    lump.castShadow = true;
    g.add(lump);
    return g;
  }) : [opts.pieces?.[0], opts.pieces?.[1]].map((p) => pieceProp(p?.item, p?.plus, mat)));
  const inGlow = ins.map(glowable);
  const out = pieceProp(opts.result?.item, opts.result?.plus, mat);
  const outGlow = glowable(out);
  const scaleOf = opts.scale || 1;
  const lay = (o, spot, i = 0) => { group.add(o); o.position.copy(spot).add(new THREE.Vector3(0, 0.02, (i - 0.5) * 0.12)); o.rotation.set(0, Math.PI / 2, -Math.PI / 2); o.scale.setScalar(scaleOf); };
  const hold = (w, o, i = 0, tilt = -0.85) => { handOf(w, i).add(o); o.position.set(0, -0.06, 0); o.rotation.set(tilt, 0, 0); o.scale.setScalar(scaleOf); };
  const wp = new THREE.Vector3();
  let worker = null;
  let lastStrike = -1;

  function reset() {
    ins.forEach((o, i) => { lay(o, anvilTop, i); o.visible = true; inGlow[i](0); });
    out.visible = false; outGlow(1);
    crucible.visible = false; molten.material.emissiveIntensity = 2.2;
    pour.hide();
    channel.material.emissive.set('#000000');
    group.add(hammer); hammer.position.set(AX + 0.3, 0.25, 0.05); hammer.rotation.set(-1.2, 0, 0);
    lastStrike = -1;
  }
  const steps = [
    { d: 1.3, text: opts.ore ? 'Takes the ore' : 'Takes the two pieces', pose: (w, k) => poseArms(w, -0.9 * Math.sin(k * Math.PI) - 0.3 * k, -0.9 * Math.sin(k * Math.PI) - 0.3 * k),
      act: (k) => { if (k > 0.5 && worker) ins.forEach((o, i) => { if (o.parent === group) hold(worker, o, i, 0.5); }); } },
    { d: 1.1, walk: FX, pose: (w) => poseArms(w, -0.5, -0.5) },
    { d: 2.6, text: 'Into the fire', pose: (w, k) => poseArms(w, -0.9 - Math.sin(k * 9) * 0.04, -0.9 + Math.sin(k * 9) * 0.04),
      act: (k, t) => { inGlow.forEach((f) => f(ease(clamp01(k * 1.3)))); flame.scale.setScalar(1 + Math.sin(t * 20) * 0.08 + k * 0.5); fire.intensity = 10 + k * 8; } },
    { d: 1.1, text: opts.ore ? 'The ore melts' : 'The metal melts', pose: (w) => poseArms(w, -0.9, -0.9),
      act: (k) => {
        ins.forEach((o) => o.scale.setScalar(scaleOf * (1 - ease(k))));
        if (worker && crucible.parent !== handOf(worker, 0)) { handOf(worker, 0).add(crucible); crucible.position.set(0, -0.08, 0); crucible.rotation.set(-0.3, 0, 0); }
        crucible.visible = true; crucible.scale.setScalar(Math.max(0.01, ease(k)));
        if (k >= 1) ins.forEach((o) => { o.visible = false; });
      } },
    { d: 1.3, walk: MX, pose: (w) => poseArms(w, -0.6, -0.15) },
    { d: 2.3, text: 'Poured into the mould', pose: (w, k) => poseArms(w, -1.0 - ease(clamp01(k * 3)) * 0.2, -0.15),
      act: (k) => {
        crucible.rotation.z = ease(clamp01(k * 2.5)) * 1.7;
        if (k > 0.25 && k < 0.92) {
          crucible.getWorldPosition(wp); group.worldToLocal(wp);
          pour.set(wp, mouldTop);
        } else pour.hide();
        channel.material.emissive.copy(HOT).multiplyScalar(ease(clamp01((k - 0.25) * 1.6)) * 2);
        molten.material.emissiveIntensity = 2.2 * (1 - clamp01((k - 0.4) * 2));
      } },
    { d: 1.3, text: 'It sets in the mould', pose: (w) => poseArms(w, -0.2, -0.15),
      act: (k) => {
        pour.hide(); crucible.visible = false;
        if (!out.visible) { lay(out, mouldTop); out.visible = true; }
        out.position.y = mouldTop.y + 0.02 + ease(k) * 0.12;
        channel.material.emissive.copy(HOT).multiplyScalar(2 * (1 - k));
      } },
    { d: 0.6, pose: (w, k) => poseArms(w, -0.9 * Math.sin(k * Math.PI), -0.15), act: (k) => { if (k > 0.5 && worker && out.parent === group) hold(worker, out, 1); } },
    { d: 1.2, walk: AX, pose: (w) => poseArms(w, -0.15, -0.6) },
    { d: 2.8, text: 'Hammered into shape', pose: (w, k) => {
        const beat = (k * 4) % 1; // four blows
        poseArms(w, beat < 0.55 ? lerp(-0.6, -2.3, ease(beat / 0.55)) : lerp(-2.3, -0.75, ease((beat - 0.55) / 0.45)), -0.75);
      },
      act: (k, t) => {
        if (worker && hammer.parent !== handOf(worker, 0)) { handOf(worker, 0).add(hammer); hammer.position.set(0, -0.06, 0); hammer.rotation.set(-0.6, 0, 0); }
        if (out.parent !== group) lay(out, anvilTop, 0.5);
        const n = Math.floor(k * 4 - 0.05 + 0.45);
        if (n > lastStrike && n > 0 && n <= 4) { lastStrike = n; fly.burst(anvilTop.clone().add(new THREE.Vector3(0, 0.06, 0)), t); }
        outGlow(1 - ease(k));
      } },
    { d: 1.8, text: opts.doneText || 'Done!', pose: (w, k) => poseArms(w, -0.2, -0.25 - ease(clamp01(k * 2)) * 1.9),
      act: (k) => {
        if (hammer.parent !== group) { group.add(hammer); hammer.position.set(AX + 0.3, 0.25, 0.05); hammer.rotation.set(-1.2, 0, 0); }
        if (worker && out.parent === group && k > 0.1) hold(worker, out, 1, -1.6);
      } },
  ];
  return { steps, reset, tick: (t) => { fly.tick(t); flame.scale.y = 1 + Math.sin(t * 17) * 0.12; }, setWorker: (w) => { worker = w; }, top: 0 };
}

// Stations on a shop counter: `top` is the counter's height
function counterStation(kind, K, group, opts) {
  const { mat, box, cyl, ball, add } = K;
  const top = opts.top ?? 1.13;
  const fx = sparks(group, kind === 'polish' ? '#ffffff' : kind === 'brew' ? '#9aff9a' : '#ffffff', 14, kind === 'polish' ? 0.05 : 0.035);
  const wp = new THREE.Vector3();
  let worker = null, loop = -1, sparkleAt = -1;
  const holdIn = (o, i = 0, tilt = -0.6) => { if (!worker) return; handOf(worker, i).add(o); o.position.set(0, -0.08, 0.02); o.rotation.set(tilt, 0, 0); };
  const putOn = (o, x, z = 0, y = top) => { group.add(o); o.position.set(x, y, z); o.rotation.set(0, 0, 0); };
  const cup = (r, h, color) => {
    const g = new THREE.Group();
    K.add(g, new THREE.CylinderGeometry(r, r * 0.85, h, 14, 1, true), mat(color, { transparent: true, opacity: 0.55, side: THREE.DoubleSide }), 0, h / 2, 0);
    K.add(g, new THREE.CircleGeometry(r * 0.85, 14), mat(color), 0, 0.005, 0).rotation.x = -Math.PI / 2;
    const fill = K.add(g, new THREE.CylinderGeometry(r * 0.92, r * 0.85, 1, 14), mat('#ffffff', { emissiveIntensity: 0.3 }), 0, 0, 0);
    fill.visible = false;
    g.userData.fill = (k, color2) => { fill.visible = k > 0.01; fill.scale.y = Math.max(0.001, k * h * 0.85); fill.position.y = (k * h * 0.85) / 2 + 0.005; if (color2) { fill.material.color.set(color2); fill.material.emissive.set(color2); } };
    return g;
  };
  const liquid = stream(group, '#ff9a1a');
  let steps = [], reset = () => {}, tick = () => {};

  if (kind === 'juice') {
    // fruit basket, a press with a crank, a jug, and the cup for the customer. All the drinks are
    // fresh fruit juices.
    const FRUITS = [['#ff9a1a', '#ffb030', 'Orange'], ['#d8282a', '#f2d36b', 'Apple'], ['#6a2a8a', '#7a2a6a', 'Grape'], ['#b0182a', '#c8203a', 'Pomegranate'], ['#f2d040', '#f6e070', 'Mango']];
    const basket = cyl(0.2, 0.16, 0.14, mat('#8a6a3a'), -0.9, top, -0.05);
    for (let i = 0; i < 5; i++) ball(0.05, mat(FRUITS[i][0]), -0.9 + Math.cos(i * 1.3) * 0.1, top + 0.17, -0.05 + Math.sin(i * 1.3) * 0.1);
    const press = new THREE.Group(); putOn(press, 0, -0.1);
    K.add(press, new THREE.CylinderGeometry(0.12, 0.12, 0.3, 14), mat('#7a5a34'), 0, 0.15, 0);
    K.add(press, new THREE.BoxGeometry(0.06, 0.04, 0.12), mat('#5a5a60', { metalness: 0.7 }), 0, 0.12, 0.15);
    const crank = new THREE.Group(); crank.position.set(0, 0.36, 0); press.add(crank);
    K.add(crank, new THREE.BoxGeometry(0.28, 0.03, 0.03), mat('#3a3a3e', { metalness: 0.7 }), 0.14, 0, 0);
    K.add(crank, new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6), mat('#6b4a2e'), 0.27, 0.05, 0);
    const jug = cup(0.07, 0.18, '#d8e8f0'); putOn(jug, 0, 0.12);
    const glass = cup(0.05, 0.12, '#e8f4f8');
    const fruit = ball(0.055, mat('#ff9a1a'), 0, 0, 0, group);
    const spout = new THREE.Vector3(0, top + 0.12, 0.19);
    let f = FRUITS[0];
    reset = () => {
      loop++;
      f = FRUITS[loop % FRUITS.length];
      fruit.material.color.set(f[0]); fruit.visible = false; fruit.scale.setScalar(1);
      putOn(jug, 0, 0.12); jug.userData.fill(0, f[1]);
      putOn(glass, 0.85, 0.05); glass.userData.fill(0, f[1]); glass.visible = true;
      liquid.hide(); crank.rotation.y = 0;
    };
    steps = [
      { d: 0.8, walk: -0.9, pose: (w) => poseArms(w, -0.15) },
      { d: 1.0, text: 'Picks fresh fruit', pose: (w, k) => poseArms(w, -1.2 * Math.sin(k * Math.PI), -0.15), act: (k) => { if (k > 0.5 && !fruit.visible) { holdIn(fruit); fruit.visible = true; } } },
      { d: 0.8, walk: 0, pose: (w) => poseArms(w, -0.6, -0.15) },
      { d: 0.8, text: () => `Into the press: ${f[2]}`, pose: (w, k) => poseArms(w, -0.6 - 0.6 * Math.sin(k * Math.PI), -0.15),
        act: (k) => { if (k > 0.5) { putOn(fruit, 0, -0.1, top + 0.32); fruit.scale.setScalar(Math.max(0.01, 1 - (k - 0.5) * 2)); } } },
      { d: 2.0, text: 'Turns the press', pose: (w, k) => { const a = k * Math.PI * 6; poseArms(w, -1.2 + Math.sin(a) * 0.25, -0.2); },
        act: (k) => { fruit.visible = false; crank.rotation.y = -k * Math.PI * 6; liquid.set(spout, new THREE.Vector3(0, top + 0.03, 0.12), f[1]); jug.userData.fill(ease(k) * 0.8); } },
      { d: 0.5, pose: (w, k) => poseArms(w, -1.1 * Math.sin(k * Math.PI)), act: (k) => { liquid.hide(); if (k > 0.5 && jug.parent === group) holdIn(jug, 0, -0.3); } },
      { d: 0.8, walk: 0.85, pose: (w) => poseArms(w, -0.7, -0.15) },
      { d: 1.6, text: () => `Pours a ${f[2]} juice`, pose: (w, k) => poseArms(w, -1.15, -0.15),
        act: (k) => {
          jug.rotation.z = ease(clamp01(k * 3)) * 1.4;
          if (k > 0.25 && k < 0.9) { jug.getWorldPosition(wp); group.worldToLocal(wp); liquid.set(wp.add(new THREE.Vector3(0, 0.08, 0)), new THREE.Vector3(0.85, top + 0.05, 0.05)); } else liquid.hide();
          glass.userData.fill(ease(clamp01((k - 0.25) / 0.65)) * 0.9); jug.userData.fill(0.8 * (1 - ease(clamp01((k - 0.25) / 0.65))));
        } },
      { d: 1.2, text: 'Fresh juice, served', pose: (w, k) => poseArms(w, -0.8 * Math.sin(k * Math.PI)),
        act: (k) => { liquid.hide(); if (jug.parent !== group) putOn(jug, 0, 0.12); glass.position.z = 0.05 - ease(k) * 0.3; } },
      { d: 0.8, walk: 0, pose: (w) => poseArms(w, -0.15) },
    ];
  } else if (kind === 'brew' || kind === 'cook') {
    // a cauldron (or cooking pot) with bubbles; a herb (or vegetables) goes in, then it's stirred and poured
    const brew = kind === 'brew';
    const COLORS = brew ? ['#e0262a', '#2a7aff', '#5ad04a', '#c84ae0'] : ['#c87a2a', '#e0b040', '#a8501a'];
    const pot = new THREE.Group(); putOn(pot, 0, -0.1);
    K.add(pot, new THREE.CylinderGeometry(0.2, 0.16, 0.24, 16), mat('#2e2a26', { metalness: 0.6, roughness: 0.45 }), 0, 0.12, 0);
    const soup = K.add(pot, new THREE.CylinderGeometry(0.18, 0.18, 0.02, 16), mat(COLORS[0], { emissive: COLORS[0], emissiveIntensity: brew ? 0.6 : 0.15 }), 0, 0.22, 0);
    const spoon = new THREE.Group();
    K.add(spoon, new THREE.CylinderGeometry(0.012, 0.012, 0.4, 6), mat('#6b4a2e'), 0, 0, 0.18).rotation.x = Math.PI / 2;
    K.add(spoon, new THREE.SphereGeometry(0.035, 8, 6), mat('#6b4a2e'), 0, 0, 0.38);
    putOn(spoon, 0.28, -0.1, top + 0.02);
    const herbs = cyl(0.12, 0.1, 0.08, mat('#7a5a34'), -0.75, top, -0.05);
    for (let i = 0; i < 4; i++) ball(0.04, mat(brew ? '#3a8a3a' : ['#e05a2a', '#e8d040', '#5aa04a', '#c8a070'][i]), -0.75 + Math.cos(i * 1.7) * 0.06, top + 0.1, -0.05 + Math.sin(i * 1.7) * 0.06);
    const bit = ball(0.04, mat(brew ? '#3a8a3a' : '#e05a2a'), 0, 0, 0, group);
    const vessel = brew ? (() => {
      const g = new THREE.Group();
      K.add(g, new THREE.SphereGeometry(0.06, 12, 10), mat('#d8eef8', { transparent: true, opacity: 0.5 }), 0, 0.06, 0);
      K.add(g, new THREE.CylinderGeometry(0.02, 0.025, 0.06, 8), mat('#d8eef8', { transparent: true, opacity: 0.5 }), 0, 0.14, 0);
      const fill = K.add(g, new THREE.SphereGeometry(0.052, 12, 10), mat('#ffffff', { emissiveIntensity: 0.6 }), 0, 0.06, 0);
      const cork = K.add(g, new THREE.CylinderGeometry(0.022, 0.022, 0.03, 8), mat('#a07a4a'), 0, 0.18, 0);
      g.userData.fill = (k, c) => { fill.visible = k > 0.01; fill.scale.setScalar(Math.max(0.01, k)); if (c) { fill.material.color.set(c); fill.material.emissive.set(c); } };
      g.userData.cork = cork;
      return g;
    })() : cup(0.09, 0.07, '#d8c8a8');
    let c = COLORS[0];
    reset = () => {
      loop++; c = COLORS[loop % COLORS.length];
      soup.material.color.set(c); soup.material.emissive.set(c);
      bit.visible = false; bit.scale.setScalar(1);
      putOn(vessel, 0.75, 0.05); vessel.userData.fill(0, c); if (vessel.userData.cork) vessel.userData.cork.visible = false;
      putOn(spoon, 0.28, -0.1, top + 0.02); spoon.rotation.set(0, 0, 0);
      liquid.hide();
    };
    const potTop = new THREE.Vector3(0, top + 0.24, -0.1);
    let lastBubble = -1;
    steps = [
      { d: 0.8, walk: -0.75, pose: (w) => poseArms(w, -0.15) },
      { d: 0.9, text: brew ? 'Picks a herb' : 'Takes the vegetables', pose: (w, k) => poseArms(w, -1.1 * Math.sin(k * Math.PI), -0.15), act: (k) => { if (k > 0.5 && !bit.visible) { holdIn(bit); bit.visible = true; } } },
      { d: 0.8, walk: 0, pose: (w) => poseArms(w, -0.7, -0.15) },
      { d: 0.7, text: brew ? 'Drops it in the cauldron' : 'Into the pot', pose: (w, k) => poseArms(w, -0.7 - 0.5 * Math.sin(k * Math.PI), -0.15),
        act: (k) => { if (k > 0.5) { putOn(bit, 0, -0.1, top + 0.3 - (k - 0.5) * 0.2); bit.scale.setScalar(Math.max(0.01, 1 - (k - 0.5) * 2)); } } },
      { d: 2.4, text: brew ? 'Stirs the brew' : 'Stirs the pot', pose: (w, k) => { const a = k * Math.PI * 8; poseArms(w, -1.0 + Math.sin(a) * 0.15, -0.2); },
        act: (k, t) => {
          bit.visible = false;
          if (spoon.parent === group) holdIn(spoon, 0, -1.2);
          spoon.rotation.z = Math.sin(k * Math.PI * 8) * 0.4;
          if (t - lastBubble > 0.35) { lastBubble = t; fx.burst(potTop, t, 0.25, 0.4); }
        } },
      { d: 0.7, pose: (w, k) => poseArms(w, -1.0 * Math.sin(k * Math.PI)), act: (k) => { if (k > 0.5 && spoon.parent !== group) putOn(spoon, 0.28, -0.1, top + 0.02); } },
      { d: 0.6, walk: 0.75, pose: (w) => poseArms(w, -0.2) },
      { d: 0.6, pose: (w, k) => poseArms(w, -1.1 * Math.sin(k * Math.PI)), act: (k) => { if (k > 0.5 && vessel.parent === group) holdIn(vessel, 0, -0.2); } },
      { d: 0.6, walk: 0.1, pose: (w) => poseArms(w, -0.8) },
      { d: 1.8, text: brew ? 'Fills a bottle' : 'Ladles a bowl', pose: (w, k) => poseArms(w, -1.15, -0.15),
        act: (k) => {
          if (k < 0.8) liquid.set(potTop.clone().add(new THREE.Vector3(0.05, 0.12, 0.1)), (vessel.getWorldPosition(wp), group.worldToLocal(wp)).add(new THREE.Vector3(0, 0.08, 0)), c); else liquid.hide();
          vessel.userData.fill(ease(clamp01(k / 0.8)) * 0.95);
        } },
      { d: 1.4, text: brew ? 'Corks it, done!' : 'Served hot!', pose: (w, k) => poseArms(w, -0.6 - ease(clamp01(k * 2)) * 1.3),
        act: (k) => { liquid.hide(); if (vessel.userData.cork && k > 0.2) vessel.userData.cork.visible = true; if (k > 0.6 && sparkleAt < 0) { sparkleAt = 1; } } },
      { d: 0.8, walk: 0, pose: (w) => poseArms(w, -0.6), act: (k) => { if (k > 0.9) putOn(vessel, 0.75, 0.05); sparkleAt = -1; } },
    ];
    tick = (t) => { soup.position.y = 0.22 + Math.sin(t * 6) * 0.004; };
  } else if (kind === 'sew' || kind === 'polish') {
    // a tailor sewing a length of cloth; an armourer polishing a helmet
    const sew = kind === 'sew';
    const COLORS = sew ? ['#7a2a5a', '#2a5a7a', '#d8b060', '#3a6a3a', '#a02a2a'] : ['#9aa0a8', '#c0c6ce', '#d9c27a'];
    const work = new THREE.Group(); putOn(work, 0, -0.05);
    const piece = sew ? K.add(work, new THREE.BoxGeometry(0.5, 0.012, 0.36), mat(COLORS[0]), 0, 0.006, 0)
      : K.add(work, new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(COLORS[0], { metalness: 0.85, roughness: 0.45 }), 0, 0, 0);
    const tool = new THREE.Group();
    if (sew) K.add(tool, new THREE.CylinderGeometry(0.004, 0.004, 0.08, 4), mat('#e0e0e8', { metalness: 0.9 }), 0, 0, 0.06).rotation.x = Math.PI / 2;
    else K.add(tool, new THREE.BoxGeometry(0.1, 0.03, 0.08), mat('#e8e0c8'), 0, 0, 0.05);
    const pile = [];
    let c = COLORS[0];
    reset = () => {
      loop++; c = COLORS[loop % COLORS.length];
      piece.material.color.set(c); piece.scale.set(1, 1, 1); work.visible = true; putOn(work, 0, -0.05);
      if (!sew) { piece.material.roughness = 0.6; piece.material.emissive.set('#000000'); }
      if (sew && pile.length > 4) { for (const p of pile) group.remove(p); pile.length = 0; }
    };
    steps = [
      { d: 0.7, pose: (w, k) => poseArms(w, -1.0 * k, -0.15), act: () => { if (worker && tool.parent !== handOf(worker, 0)) holdIn(tool, 0, -1.2); } },
      { d: 3.2, text: sew ? 'Sews the seams' : 'Polishes the steel', pose: (w, k) => {
          if (sew) poseArms(w, -1.0 + Math.abs(Math.sin(k * Math.PI * 9)) * 0.25, -0.9);
          else { const a = k * Math.PI * 10; poseArms(w, -1.05 + Math.sin(a) * 0.12, -0.9); const r = arms(w)[0]; if (r) r.shoulder.rotation.z = -0.15 + Math.cos(a) * 0.12; }
        },
        act: (k, t) => {
          if (!sew) { piece.material.roughness = lerp(0.6, 0.15, k); if (k > 0.9 && sparkleAt < loop) { sparkleAt = loop; fx.burst(new THREE.Vector3(0, top + 0.18, -0.05), t, 0.4, 0.3); } }
          else work.position.x = Math.sin(k * Math.PI * 2) * 0.03;
        } },
      { d: 1.2, text: sew ? 'Folds the cloth' : 'Holds it up to the light', pose: (w, k) => poseArms(w, sew ? -1.0 : -0.9 - ease(k) * 0.9, sew ? -1.0 : -0.9 - ease(k) * 0.9),
        act: (k) => {
          if (sew) { piece.scale.set(1 - ease(k) * 0.5, 1 + ease(k) * 3, 1 - ease(k) * 0.5); }
          else if (work.parent === group && worker) { handOf(worker, 0).add(work); work.position.set(0, -0.1, 0.08); work.rotation.set(0, 0, 0); if (!sew) piece.material.emissive.set('#3a3a3a'); }
        } },
      { d: 0.9, walk: sew ? 0.8 : 0, pose: (w) => poseArms(w, -0.7, -0.7) },
      { d: 0.8, text: sew ? 'Onto the pile' : 'Ready for sale', pose: (w, k) => poseArms(w, -0.9 * Math.sin(k * Math.PI)),
        act: (k) => {
          if (k > 0.5 && sew && work.visible) {
            const folded = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.04, 0.18), piece.material.clone());
            folded.castShadow = true;
            folded.position.set(0.8, top + 0.02 + pile.length * 0.042, 0.05);
            group.add(folded); pile.push(folded);
            work.visible = false;
          } else if (k > 0.5 && !sew) putOn(work, 0, -0.05);
        } },
      { d: 0.9, walk: 0, pose: (w) => poseArms(w, -0.15) },
    ];
  }
  return { steps, reset, tick: (t) => { fx.tick(t, 0.8, kind === 'polish' ? 0.5 : 1); tick(t); }, setWorker: (w) => { worker = w; }, top };
}

// Build a station of `kind`. Returns { group, length, play(worker, t), step(t) }: put the worker
// in `group` and call play every frame. With `once`, the work stops at the end instead of looping.
export function buildWork(kind, opts = {}) {
  const group = new THREE.Group();
  const K = kit(group);
  const st = kind === 'smith' ? smithStation(K, group, opts) : counterStation(kind, K, group, opts);
  const { steps } = st;
  // where the worker is at the start and end of each step
  let x = 0;
  for (const s of steps) { s.from = x; if (s.walk != null) x = s.walk; s.to = x; }
  const length = steps.reduce((n, s) => n + s.d, 0);
  let cycle = -1, idx = -1;

  // the step at time t: { step, k, text }
  function at(t) {
    let rest = t % length;
    for (let i = 0; i < steps.length; i++) { if (rest < steps[i].d) return { i, k: rest / steps[i].d }; rest -= steps[i].d; }
    return { i: steps.length - 1, k: 1 };
  }
  function play(worker, t, { once = false } = {}) {
    st.setWorker(worker);
    const done = once && t >= length;
    const tt = done ? length - 1e-4 : t;
    const c = Math.floor(tt / length);
    let { i, k } = at(tt);
    if (done) k = 1;
    if (c !== cycle) { cycle = c; idx = -1; st.reset(); }
    // catch up on any steps skipped since the last frame
    for (let j = idx + 1; j < i; j++) steps[j].act?.(1, t);
    idx = i;
    const s = steps[i];
    const walking = s.walk != null && !done;
    const wx = lerp(s.from, s.to, s.walk != null ? ease(k) : 1);
    worker.position.set(wx, 0, WORKER_Z);
    animateCharacter(worker, t, walking ? 1 : 0);
    worker.rotation.y = walking && Math.abs(s.to - s.from) > 0.05 ? (s.to > s.from ? Math.PI / 2 : -Math.PI / 2) : Math.PI;
    s.pose?.(worker, k);
    s.act?.(k, t);
    st.tick(t);
    return typeof s.text === 'function' ? s.text() : s.text || null;
  }
  return { group, length, play, top: st.top, dispose() { group.traverse((o) => { o.geometry?.dispose(); }); for (const m of K.mats) m.dispose(); } };
}
