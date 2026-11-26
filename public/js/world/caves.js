// Caves: a rocky dome you can walk into through one opening, lit by glowing crystals.
// At the back a shaft leads down into the cave's depths (see depths.js).
import * as THREE from 'three';
import { GlowLight } from './lightpool.js';

const R = 14;        // inner radius in metres
const OPENING = 1.0; // width of the entrance, radians
const DOOR_W = R * Math.sin(OPENING / 2), DOOR_H = 5; // the doorway's half width and height (metres)

export function buildCave(place) {
  const g = new THREE.Group();
  g.position.set(place.x, place.y - 0.3, place.z);
  // the opening faces `facing` (0 = south, +z); the shell is built with its gap toward local −x
  g.rotation.y = place.facing + Math.PI / 2;

  const rockMat = new THREE.MeshStandardMaterial({ color: '#5a5048', roughness: 1, flatShading: true, side: THREE.DoubleSide });
  rockMat.shadowSide = THREE.BackSide; // (both sides casting made the dome shadow itself in stripes)
  // a whole dome, with only an arched doorway cut low in its front (a gap from floor to top let the
  // sky show through the roof)
  const full = new THREE.SphereGeometry(R, 72, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  let p = full.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * 0.9) * Math.cos(z * 0.8) + Math.sin(y * 1.3 + x * 0.4) * 0.6;
    const k = 1 + n * 0.07;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  const flat = full.toNonIndexed(), fp = flat.attributes.position.array, keep = [];
  for (let t = 0; t < fp.length; t += 9) {
    const cx = (fp[t] + fp[t + 3] + fp[t + 6]) / 3, cy = (fp[t + 1] + fp[t + 4] + fp[t + 7]) / 3 * 0.62, cz = (fp[t + 2] + fp[t + 5] + fp[t + 8]) / 3;
    if (cx < 0 && (cz / DOOR_W) ** 2 + (cy / DOOR_H) ** 2 < 1) continue; // (in the doorway)
    for (let j = 0; j < 9; j++) keep.push(fp[t + j]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
  const shell = new THREE.Mesh(geo, rockMat);
  shell.scale.y = 0.62;
  shell.castShadow = true;
  shell.receiveShadow = true;
  g.add(shell);

  // boulders piled around the outside so it reads as a rocky hill, and an arch over the entrance
  const boulder = new THREE.IcosahedronGeometry(1, 1);
  const lumps = []; // [x, z, r] of everything solid besides the walls (local)
  for (let i = 0; i < 14; i++) {
    const a = OPENING / 2 + 0.25 + (i / 14) * (Math.PI * 2 - OPENING - 0.5);
    const b = new THREE.Mesh(boulder, rockMat);
    const s = 3 + ((i * 37) % 5);
    b.scale.set(s, s * 0.8, s);
    b.position.set(-Math.cos(a) * (R + 1), s * 0.3, Math.sin(a) * (R + 1));
    b.rotation.set(i, i * 2, i * 3);
    b.castShadow = true;
    g.add(b);
    lumps.push([-Math.cos(a) * (R + 1 + s * 0.4), Math.sin(a) * (R + 1 + s * 0.4), s * 0.6]); // (kept out of the dome inside)
  }
  // a short rock tunnel through the doorway, with an arch round its outer end
  const DOOR_IN = -Math.sqrt(R * R - (DOOR_H / 0.62) ** 2) + 0.8, DOOR_OUT = -R - 1.5;
  const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(DOOR_W + 0.4, DOOR_W + 0.4, DOOR_IN - DOOR_OUT, 24, 1, true, 0, Math.PI), rockMat);
  tunnel.rotation.z = Math.PI / 2; // (its round side up, running along x)
  tunnel.scale.x = (DOOR_H + 0.4) / (DOOR_W + 0.4); // (a little wider than the cut, so its ragged edge is hidden)
  tunnel.position.set((DOOR_IN + DOOR_OUT) / 2, 0, 0);
  tunnel.receiveShadow = true;
  g.add(tunnel);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(DOOR_W + 0.6, 1.3, 8, 20, Math.PI), rockMat);
  arch.position.set(DOOR_OUT, 0, 0);
  arch.rotation.y = Math.PI / 2;
  arch.scale.y = DOOR_H / DOOR_W;
  arch.castShadow = true;
  g.add(arch);
  // the arch's feet, each side of the way in
  for (const side of [-1, 1]) lumps.push([arch.position.x, side * (DOOR_W + 0.6), 1.5]);

  // glowing crystals inside
  const crystalMat = new THREE.MeshStandardMaterial({ color: '#8fd8ff', emissive: '#3aa0ff', emissiveIntensity: 1.6, roughness: 0.2 });
  for (let i = 0; i < 9; i++) {
    const a = 1 + i * 0.6;
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), crystalMat);
    c.scale.set(1, 2.2 + (i % 3), 1);
    c.position.set(-Math.cos(a) * (R - 2.5), 0.6, Math.sin(a) * (R - 2.5));
    c.rotation.z = (i % 2 ? 1 : -1) * 0.3;
    g.add(c);
    lumps.push([c.position.x, c.position.z, 0.55]);
  }
  const glow = new GlowLight('#6ac0ff', 30, 26, 1.5);
  glow.position.set(3, 4, 0);
  g.add(glow);

  // the way down: a dark shaft ringed with rocks at the back of the dome
  const shaft = new THREE.Group();
  shaft.add(new THREE.Mesh(new THREE.CircleGeometry(1.8, 24), new THREE.MeshBasicMaterial({ color: '#030303' })));
  shaft.children[0].rotation.x = -Math.PI / 2;
  shaft.children[0].position.y = 0.32;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const b = new THREE.Mesh(boulder, rockMat);
    b.scale.setScalar(0.45 + (i % 3) * 0.12);
    b.position.set(Math.cos(a) * 2.1, 0.3, Math.sin(a) * 2.1);
    shaft.add(b);
  }
  shaft.position.set(R * 0.5, 0, 0);
  g.add(shaft);

  // walls you can't walk through, with a gap at the entrance
  g.updateMatrixWorld(true);
  const solid = [];
  const v = new THREE.Vector3();
  const steps = 40;
  for (let i = 0; i < steps; i++) {
    const a = OPENING / 2 + 0.1 + (i / (steps - 1)) * (Math.PI * 2 - OPENING - 0.2);
    v.set(-Math.cos(a) * (R + 0.6), 0, Math.sin(a) * (R + 0.6)).applyMatrix4(g.matrixWorld);
    solid.push({ x: v.x, z: v.z, r: 1.4, kind: 'wall', height: 9 });
  }
  // the boulders outside, the arch's feet and the crystals are solid too
  for (const [x, z, r] of lumps) {
    v.set(x, 0, z).applyMatrix4(g.matrixWorld);
    solid.push({ x: v.x, z: v.z, r, kind: 'wall', height: 9 });
  }
  const hole = new THREE.Vector3(R * 0.5, 0, 0).applyMatrix4(g.matrixWorld);
  // guards stand just outside the opening, facing out
  const guardSpots = [-3, 0, 3].map((side) => {
    const p = new THREE.Vector3(-R - 5, 0, side).applyMatrix4(g.matrixWorld);
    return { x: p.x, z: p.z, heading: place.facing };
  });
  // just inside the entrance: where you come back up
  const mouth = new THREE.Vector3(-R * 0.4, 0, 0).applyMatrix4(g.matrixWorld);
  return {
    group: g, solid, inside: (x, z) => Math.hypot(x - place.x, z - place.z) < R,
    // keep the camera inside the dome while you are in it, so it never looks through the rock
    clampCam(v) {
      const dx = v.x - place.x, dz = v.z - place.z, d = Math.hypot(dx, dz), max = R - 2;
      if (d > max) { v.x = place.x + (dx / d) * max; v.z = place.z + (dz / d) * max; }
      const r = Math.min(d, max);
      v.y = Math.min(v.y, g.position.y + 0.62 * Math.sqrt(R * R - r * r) * 0.93 - 0.6);
      return v;
    },
    hole: { x: hole.x, z: hole.z }, guardSpots, mouth: { x: mouth.x, z: mouth.z, heading: place.facing },
  };
}
