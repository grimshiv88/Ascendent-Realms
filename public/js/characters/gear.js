// Draws equipped weapons and armour on a character built by model.js.
import * as THREE from 'three';
import { ITEMS } from '../data/items.mjs';

const cache = new Map();
function mat(color, metal, props) {
  const k = `${color}|${metal}`;
  if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial(props || { color, roughness: metal ? 0.3 : 0.85, metalness: metal ? 0.85 : 0 }));
  return cache.get(k);
}
const mesh = (geo, m, setup) => {
  const o = new THREE.Mesh(geo, m);
  o.castShadow = true;
  setup?.(o);
  return o;
};

// ---------- weapons ----------
// Metals and woods, shaded for the world's sky reflections
const METALS = {
  steel: ['#d6dbe2', 1, 0.22], iron: ['#9ea4ac', 1, 0.38], rust: ['#8a5636', 0.55, 0.75], dark: ['#2c3038', 1, 0.3],
  gold: ['#e0b85a', 1, 0.25], bone: ['#e6dcc2', 0, 0.45], leather: ['#3a2418', 0, 0.8], wood: ['#6b4a2e', 0, 0.75],
  darkwood: ['#3e2a1c', 0, 0.7], cloth: ['#7a2a22', 0, 0.9],
  copper: ['#c0703a', 1, 0.35], diamond: ['#e8f6ff', 0.6, 0.05], orichalcum: ['#e0783a', 1, 0.2],
};
// a piece made of another metal (copper, diamond, orichalcum) draws its steel parts in that metal
let swap = null;
function metal(name, plus = 0) {
  if (swap && (name === 'steel' || name === 'iron' || name === 'rust')) name = swap;
  const [color, metalness, roughness] = METALS[name];
  const c = new THREE.Color(color);
  if (plus >= 5 && metalness > 0.5 && name !== 'gold') c.lerp(new THREE.Color('#f2dc9a'), 0.25);
  return mat(`#${c.getHexString()}|${metalness}|${roughness}`, null, { color: c, metalness, roughness });
}
function glow(color, strength = 2) {
  return mat(`glow|${color}|${strength}`, null, { color, emissive: color, emissiveIntensity: strength, roughness: 0.15, metalness: 0.1 });
}

// A blade outline (x across, y along) extruded with a bevelled edge, laid along +z
function blade(len, width, m, { tip = 0.16, taper = 0.85, curve = 0, notch = 0, thick = 0.006, single = false } = {}) {
  const s = new THREE.Shape();
  const bend = (y) => curve * (y / len) ** 2;
  const steps = 8;
  const left = [], right = [];
  for (let i = 0; i <= steps; i++) {
    const y = (len * (1 - tip)) * (i / steps);
    const w = width / 2 * (1 - (1 - taper) * (i / steps));
    const jag = notch && i > 0 && i < steps && i % 2 ? notch : 0;
    left.push([-w + bend(y) - jag, y]);
    right.push([(single ? w * 0.35 : w) + bend(y) + jag * 0.5, y]);
  }
  s.moveTo(...left[0]);
  for (const p of left.slice(1)) s.lineTo(...p);
  s.quadraticCurveTo(-width * 0.2 + bend(len * 0.96), len * 0.96, bend(len), len);
  s.quadraticCurveTo(width * 0.3 + bend(len * 0.92), len * 0.92, ...right[steps]);
  for (const p of right.slice(0, -1).reverse()) s.lineTo(...p);
  const geo = new THREE.ExtrudeGeometry(s, { depth: thick * 0.4, bevelEnabled: true, bevelThickness: thick, bevelSize: Math.min(width * 0.18, 0.012), bevelSegments: 2, curveSegments: 6 });
  geo.translate(0, 0, -thick * 0.2);
  return mesh(geo, m, (o) => { o.rotation.x = Math.PI / 2; });
}
// A straight groove down the middle of each face of a blade
function fuller(len, width, at, depth) {
  const g = new THREE.Group();
  for (const side of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(width, 0.0015, len), metal('dark'), (o) => { o.position.set(0, side * depth, at + len / 2); }));
  return g;
}
// A leather-wrapped grip from z=-len to 0 with ridges where the strap crosses
function grip(len, r, m = metal('leather')) {
  const pts = [];
  const n = Math.round(len / 0.018);
  for (let i = 0; i <= n; i++) pts.push(new THREE.Vector2(r * (i % 2 ? 1.12 : 0.96), (i / n) * len));
  return mesh(new THREE.LatheGeometry(pts, 10), m, (o) => { o.rotation.x = Math.PI / 2; o.position.z = -len; });
}
const pommel = (z, r, m) => mesh(new THREE.SphereGeometry(r, 14, 10), m, (o) => { o.position.z = z; o.scale.z = 0.8; });
function guard(width, m, { wing = 0, gem = null } = {}) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(width, 0.022, 0.03), m));
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.SphereGeometry(0.016, 10, 8), m, (o) => { o.position.set(s * width / 2, 0, wing * 0.4); }));
    if (wing) g.add(mesh(new THREE.ConeGeometry(0.012, wing, 6), m, (o) => { o.position.set(s * width / 2, 0, wing * 0.2 + 0.01); o.rotation.x = Math.PI / 2; }));
  }
  if (gem) g.add(mesh(new THREE.OctahedronGeometry(0.02, 0), glow(gem, 1.2), (o) => { o.scale.set(1, 0.6, 1.3); }));
  return g;
}
function haft(len, r, m, from = -0.15) {
  return mesh(new THREE.CylinderGeometry(r * 0.9, r, len, 10), m, (o) => { o.rotation.x = Math.PI / 2; o.position.z = from + len / 2; });
}
// An axe head on the haft at z, facing +x; double gives a second blade
function axeHead(z, size, m, { double = false, beard = 0.4 } = {}) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(0, -size * 0.18);
  s.lineTo(size * 0.55, -size * 0.3 - size * beard * 0.5);
  s.quadraticCurveTo(size * 0.82, 0, size * 0.55, size * 0.42);
  s.lineTo(0, size * 0.2);
  s.lineTo(0, -size * 0.18);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 2 });
  geo.translate(0, 0, -0.003);
  // the flat of the blade faces the same way as a sword's
  for (const side of double ? [1, -1] : [1]) {
    g.add(mesh(geo, m, (o) => { o.rotation.x = Math.PI / 2; o.scale.x = side; o.position.z = -size * 0.02; }));
  }
  g.add(mesh(new THREE.BoxGeometry(0.05, 0.05, size * 0.45), m));
  if (!double) g.add(mesh(new THREE.BoxGeometry(0.06, 0.04, size * 0.16), m, (o) => { o.position.x = -0.05; }));
  g.position.z = z;
  // stand the blade up so its edge leads the swing (forward and down), not flat like a wall ornament
  g.rotation.z = -Math.PI / 2;
  return g;
}

// A weapon model in the hand's space: the grip at the fist, the business end pointing forward (+z).
export function weaponModel(item, plus = 0) {
  const own = item.id || item.entry?.id;
  swap = item.metal || ITEMS[own]?.metal || null;
  try { return shapeWeapon(item, own, plus); } finally { swap = null; }
}
function shapeWeapon(item, own, plus) {
  const g = new THREE.Group();
  const id = item.model || ITEMS[own]?.model || own;
  switch (id) {
    case 'wooden_club': {
      const pts = [];
      for (let i = 0; i <= 12; i++) { const k = i / 12; pts.push(new THREE.Vector2(0.022 + k * k * 0.05 + (i % 3 === 1 ? 0.006 : 0), k * 0.7)); }
      pts.push(new THREE.Vector2(0, 0.72));
      g.add(mesh(new THREE.LatheGeometry(pts, 9), metal('wood'), (o) => { o.rotation.x = Math.PI / 2; o.position.z = -0.12; }));
      g.add(grip(0.12, 0.024, metal('leather')));
      break;
    }
    case 'rusty_sword':
      g.add(grip(0.15, 0.017), pommel(-0.16, 0.024, metal('iron')), guard(0.15, metal('iron')));
      g.add(blade(0.68, 0.055, metal('rust', plus), { notch: 0.004, taper: 0.9 }));
      break;
    case 'iron_dagger':
      g.add(grip(0.1, 0.015, metal('dark')), pommel(-0.11, 0.018, metal('dark')), guard(0.09, metal('dark')));
      g.add(blade(0.3, 0.045, metal('steel', plus), { curve: 0.035, tip: 0.3, taper: 0.7, single: true }));
      break;
    case 'iron_sword':
      g.add(grip(0.17, 0.017), pommel(-0.18, 0.026, metal('iron')), guard(0.2, metal('iron'), { wing: 0.03 }));
      g.add(blade(0.8, 0.052, metal('iron', plus)), fuller(0.5, 0.012, 0.03, 0.0075));
      break;
    case 'steel_sword':
      g.add(grip(0.22, 0.017, metal('leather')), pommel(-0.23, 0.028, metal('steel')), guard(0.24, metal('steel'), { wing: 0.05 }));
      g.add(blade(0.92, 0.05, metal('steel', plus), { taper: 0.75 }), fuller(0.62, 0.012, 0.03, 0.0075));
      break;
    case 'knight_blade':
      g.add(grip(0.22, 0.018, metal('dark')), pommel(-0.235, 0.03, metal('gold')), guard(0.3, metal('gold'), { wing: 0.08, gem: '#3a8cff' }));
      g.add(blade(1.0, 0.064, metal('steel', plus), { taper: 0.8, tip: 0.12 }), fuller(0.7, 0.016, 0.03, 0.008));
      g.add(mesh(new THREE.OctahedronGeometry(0.018, 0), glow('#3a8cff', 1.5), (o) => { o.position.z = -0.27; }));
      break;
    case 'dragonbone_sword': {
      g.add(grip(0.24, 0.02, metal('leather')), pommel(-0.26, 0.032, metal('bone')));
      for (const s of [-1, 1]) g.add(mesh(new THREE.ConeGeometry(0.02, 0.14, 7), metal('bone'), (o) => { o.position.set(s * 0.07, 0, -0.02); o.rotation.set(-Math.PI / 2, 0, s * -0.9); }));
      g.add(blade(1.1, 0.12, metal('bone', plus), { curve: 0.08, notch: 0.012, taper: 0.7, tip: 0.2, thick: 0.01 }));
      g.add(mesh(new THREE.BoxGeometry(0.008, 0.002, 0.8), glow('#ff4a2a', 1.6), (o) => { o.position.set(0.012, 0.012, 0.42); }));
      break;
    }
    case 'hand_axe':
      g.add(haft(0.62, 0.017, metal('wood')), grip(0.14, 0.019));
      g.add(axeHead(0.4, 0.2, metal('iron', plus)));
      break;
    case 'war_axe':
      g.add(haft(1.0, 0.02, metal('darkwood'), -0.2), grip(0.2, 0.022));
      g.add(axeHead(0.68, 0.32, metal('steel', plus), { double: true }));
      g.add(mesh(new THREE.ConeGeometry(0.02, 0.1, 6), metal('steel'), (o) => { o.rotation.x = Math.PI / 2; o.position.z = 0.85; }));
      break;
    case 'iron_spear':
      g.add(haft(1.7, 0.017, metal('wood'), -0.55), grip(0.18, 0.019));
      // a leaf-shaped head, flat like a blade
      g.add(mesh(new THREE.OctahedronGeometry(0.06, 0), metal('iron', plus), (o) => { o.position.z = 1.24; o.scale.set(0.7, 0.18, 2.6); }));
      g.add(mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.08, 8), metal('dark'), (o) => { o.rotation.x = Math.PI / 2; o.position.z = 1.12; }));
      break;
    case 'steel_glaive': {
      g.add(haft(1.8, 0.019, metal('darkwood'), -0.6), grip(0.2, 0.021));
      const head = blade(0.5, 0.075, metal('steel', plus), { curve: 0.07, taper: 0.6, tip: 0.25, single: true });
      head.position.z += 1.2;
      g.add(head);
      g.add(mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.09, 8), metal('steel'), (o) => { o.rotation.x = Math.PI / 2; o.position.z = 1.18; }));
      break;
    }
    case 'iron_mace':
      g.add(haft(0.6, 0.018, metal('dark')), grip(0.15, 0.02));
      g.add(mesh(new THREE.SphereGeometry(0.05, 16, 12), metal('iron', plus), (o) => { o.position.z = 0.48; }));
      for (let i = 0; i < 6; i++) {
        g.add(mesh(new THREE.BoxGeometry(0.008, 0.06, 0.13), metal('iron', plus), (o) => {
          const a = (i / 6) * Math.PI * 2;
          o.position.set(Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0.48);
          o.rotation.z = a + Math.PI / 2;
        }));
      }
      g.add(mesh(new THREE.ConeGeometry(0.02, 0.07, 6), metal('iron'), (o) => { o.rotation.x = Math.PI / 2; o.position.z = 0.57; }));
      break;
    case 'crystal_staff': {
      g.add(haft(1.5, 0.018, metal('dark'), -0.6), grip(0.2, 0.021, metal('cloth')));
      for (let i = 0; i < 3; i++) g.add(mesh(new THREE.TorusGeometry(0.1, 0.01, 6, 20, Math.PI * 1.2), metal('gold'), (o) => { o.position.z = 0.98; o.rotation.set(Math.PI / 2, (i / 3) * Math.PI * 2, 0); }));
      g.add(mesh(new THREE.OctahedronGeometry(0.11, 0), glow('#8a6aff', 2.2), (o) => { o.position.z = 1.0; o.scale.set(0.7, 0.7, 1.4); }));
      break;
    }
    case 'oak_staff':
    default: {
      if (item.type === 'staff' || id === 'oak_staff') {
        const pts = [];
        for (let i = 0; i <= 16; i++) pts.push(new THREE.Vector2(0.02 + (i % 4 === 2 ? 0.005 : 0) + (i > 13 ? (i - 13) * 0.01 : 0), (i / 16) * 1.45));
        g.add(mesh(new THREE.LatheGeometry(pts, 8), metal('wood'), (o) => { o.rotation.x = Math.PI / 2; o.position.z = -0.6; }));
        for (let i = 0; i < 3; i++) g.add(mesh(new THREE.ConeGeometry(0.012, 0.16, 5), metal('wood'), (o) => { const a = (i / 3) * Math.PI * 2; o.position.set(Math.cos(a) * 0.035, Math.sin(a) * 0.035, 0.9); o.rotation.set(Math.PI / 2 - Math.sin(a) * 0.25, 0, 0); o.rotation.y = Math.cos(a) * 0.25; }));
        g.add(mesh(new THREE.IcosahedronGeometry(0.065, 0), glow('#5ab8ff', 1.8), (o) => { o.position.z = 0.92; }));
      } else {
        g.add(grip(0.17, 0.017), pommel(-0.18, 0.026, metal('iron')), guard(0.2, metal('iron')));
        g.add(blade(0.8, 0.052, metal('iron', plus)));
      }
    }
  }
  if (plus >= 7) g.add(mesh(new THREE.SphereGeometry(0.03, 8, 6), glow('#ffd76a', 2), (o) => { o.position.z = 0.02; }));
  return g;
}

function armourMat(item, plus) {
  const c = new THREE.Color(item.look?.color || '#777');
  if (plus >= 5) c.lerp(new THREE.Color('#e8c860'), 0.35);
  return mat(`#${c.getHexString()}`, !!item.look?.metal);
}

// Put the worn items on the character. `worn` is { weapon, head, body, legs, feet, shield }.
export function wearGear(character, worn) {
  const rig = character.userData.rig;
  // take off whatever was drawn before
  const old = [];
  rig.root.traverse((o) => { if (o.userData.gear) old.push(o); });
  for (const o of old) o.parent.remove(o);
  if (rig.muscleParts) for (const m of rig.muscleParts) m.visible = !rig.shirt;
  if (!rig.arms || !rig.legs) return; // creature bodies (slimes, serpents, beasts) don't show gear
  const H = rig.H || character.userData.height;
  const tag = (o) => { o.userData.gear = true; return o; };
  const scale = H / 1.8;

  if (worn.weapon) {
    const w = tag(weaponModel(worn.weapon, worn.weapon.plus));
    w.scale.setScalar(Math.max(0.55, scale));
    w.position.y = -H * 0.045;
    // a spear or staff stands up from the fist; a blade sits so that, with the arm in its ready pose
    // (see world.js), it points straight ahead, and it follows the arm through an overhead slash
    const type = worn.weapon.type || ITEMS[worn.weapon.id || worn.weapon.entry?.id]?.type;
    w.userData.weapon = type || 'blade';
    w.rotation.x = type === 'spear' || type === 'staff' ? -0.85 : 1.2;
    // a sword or dagger is held as a fighter holds it: edge up and down (not lying flat), the point
    // raised a little in front, ready to cut
    if (type === 'sword' || type === 'dagger') w.rotation.set(0.7, 0, Math.PI / 2);
    rig.arms[0].hand.add(w);
  }
  if (worn.shield) {
    const m = armourMat(worn.shield, worn.shield.plus);
    const big = worn.shield.def >= 15;
    const s = tag(mesh(new THREE.CylinderGeometry(H * (big ? 0.2 : 0.14), H * (big ? 0.2 : 0.14), H * 0.02, big ? 4 : 24), m, (o) => {
      o.rotation.z = Math.PI / 2;
      o.position.set(H * 0.03, -rig.arms[1].foreLen * 0.5, 0);
      if (big) o.scale.set(1, 1, 1.5);
    }));
    rig.arms[1].elbow.add(s);
  }
  if (worn.body) {
    const m = armourMat(worn.body, worn.body.plus);
    const plate = tag(new THREE.Mesh(rig.chest.geometry, m));
    plate.scale.copy(rig.chest.scale).multiplyScalar(rig.shirt ? 1.11 : 1.07);
    plate.castShadow = true;
    rig.chest.parent.add(plate);
    for (const p of rig.muscleParts || []) p.visible = false;
    for (const a of rig.arms) {
      const pad = tag(mesh(new THREE.SphereGeometry(H * 0.045, 16, 10), m));
      pad.scale.y = 0.75;
      pad.position.y = H * 0.012;
      a.shoulder.parent.add(pad);
    }
    if (worn.body.look?.robe) {
      const robe = tag(mesh(new THREE.CylinderGeometry(H * 0.1, H * 0.16, H * 0.4, 20, 1, true), m));
      robe.material = m.clone();
      robe.material.side = THREE.DoubleSide;
      robe.position.y = -H * 0.17;
      rig.hips.add(robe);
    }
  }
  if (worn.head) {
    const m = armourMat(worn.head, worn.head.plus);
    const r = rig.headR;
    if (worn.head.look?.hat) {
      const brim = tag(mesh(new THREE.CylinderGeometry(r * 1.5, r * 1.5, r * 0.08, 24), m, (o) => { o.position.y = r * 0.55; }));
      const cone = tag(mesh(new THREE.ConeGeometry(r * 0.85, r * 1.9, 20), m, (o) => { o.position.y = r * 1.4; o.rotation.x = -0.15; }));
      rig.head.add(brim, cone);
    } else {
      const helm = tag(mesh(new THREE.SphereGeometry(r * 1.08, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), m, (o) => { o.position.y = r * 0.08; }));
      rig.head.add(helm);
      if (worn.head.look?.metal) {
        const guard = tag(mesh(new THREE.BoxGeometry(r * 0.12, r * 0.6, r * 0.12), m, (o) => { o.position.set(0, -r * 0.05, r * 1.0); }));
        rig.head.add(guard);
      }
    }
  }
  if (worn.legs) {
    const m = armourMat(worn.legs, worn.legs.plus);
    for (const l of rig.legs) {
      const thigh = tag(mesh(new THREE.CylinderGeometry(H * 0.052, H * 0.04, l.thighLen * 0.9, 14), m, (o) => { o.position.y = -l.thighLen * 0.48; }));
      l.hip.add(thigh);
      const shin = tag(mesh(new THREE.CylinderGeometry(H * 0.037, H * 0.03, l.shinLen * 0.6, 14), m, (o) => { o.position.y = -l.shinLen * 0.35; }));
      l.knee.add(shin);
    }
  }
  if (worn.feet) {
    const m = armourMat(worn.feet, worn.feet.plus);
    for (const l of rig.legs) {
      const boot = tag(mesh(new THREE.CylinderGeometry(H * 0.034, H * 0.03, l.shinLen * 0.4, 14), m, (o) => { o.position.y = -l.shinLen * 0.8; }));
      l.knee.add(boot);
      const toe = tag(mesh(new THREE.SphereGeometry(1, 14, 8), m, (o) => { o.scale.set(H * 0.036, H * 0.03, H * 0.075); o.position.set(0, -l.shinLen - H * 0.01, H * 0.03); }));
      l.knee.add(toe);
    }
  }
}
