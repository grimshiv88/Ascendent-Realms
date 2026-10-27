// Draws equipped weapons and armour on a character built by model.js.
import * as THREE from 'three';

const cache = new Map();
function mat(color, metal) {
  const k = `${color}|${metal}`;
  if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color, roughness: metal ? 0.3 : 0.85, metalness: metal ? 0.85 : 0 }));
  return cache.get(k);
}
const mesh = (geo, m, setup) => {
  const o = new THREE.Mesh(geo, m);
  o.castShadow = true;
  setup?.(o);
  return o;
};

// A weapon model in the hand's space: the grip at the fist, the business end pointing forward (+z).
export function weaponModel(item, plus = 0) {
  const g = new THREE.Group();
  const wood = mat('#6b4a2e');
  const steel = mat(plus >= 5 ? '#e8d48a' : '#c8ccd2', true);
  const dark = mat('#2a2622', true);
  const grip = (len) => mesh(new THREE.CylinderGeometry(0.018, 0.02, len, 8), mat('#3a2418'), (o) => { o.rotation.x = Math.PI / 2; o.position.z = len / 2 - 0.06; });
  switch (item.type) {
    case 'dagger':
      g.add(grip(0.12));
      g.add(mesh(new THREE.BoxGeometry(0.1, 0.02, 0.025), dark, (o) => { o.position.z = 0.07; }));
      g.add(mesh(new THREE.ConeGeometry(0.022, 0.3, 4), steel, (o) => { o.rotation.x = Math.PI / 2; o.position.z = 0.23; o.scale.x = 1.8; }));
      break;
    case 'axe':
      g.add(mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.75, 8), wood, (o) => { o.rotation.x = Math.PI / 2; o.position.z = 0.27; }));
      g.add(mesh(new THREE.BoxGeometry(0.02, 0.2, 0.16), steel, (o) => { o.position.set(0, 0.08, 0.58); }));
      break;
    case 'mace':
      g.add(mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.6, 8), wood, (o) => { o.rotation.x = Math.PI / 2; o.position.z = 0.2; }));
      g.add(mesh(new THREE.IcosahedronGeometry(0.09, 0), steel, (o) => { o.position.z = 0.52; }));
      break;
    case 'staff':
      g.add(mesh(new THREE.CylinderGeometry(0.02, 0.026, 1.5, 8), wood, (o) => { o.rotation.x = Math.PI / 2; o.position.z = 0.45; }));
      g.add(mesh(new THREE.OctahedronGeometry(0.07, 0), new THREE.MeshStandardMaterial({ color: '#8fd8ff', emissive: '#3aa0ff', emissiveIntensity: 1.5 }), (o) => { o.position.z = 1.22; }));
      break;
    case 'club':
      g.add(mesh(new THREE.CylinderGeometry(0.06, 0.025, 0.75, 8), wood, (o) => { o.rotation.x = Math.PI / 2; o.position.z = 0.3; }));
      break;
    default: // sword
      g.add(grip(0.2));
      g.add(mesh(new THREE.BoxGeometry(0.2, 0.03, 0.035), dark, (o) => { o.position.z = 0.1; }));
      g.add(mesh(new THREE.BoxGeometry(0.055, 0.012, 0.8), steel, (o) => { o.position.z = 0.52; }));
      g.add(mesh(new THREE.ConeGeometry(0.028, 0.1, 4), steel, (o) => { o.rotation.x = Math.PI / 2; o.position.z = 0.97; o.scale.z = 0.25; }));
  }
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
    w.rotation.x = 0.25;
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
