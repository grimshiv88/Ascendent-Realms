// Caves: a rocky dome you can walk into through one opening, lit by glowing crystals.
import * as THREE from 'three';

const R = 14;        // inner radius in metres
const OPENING = 1.0; // width of the entrance, radians

export function buildCave(place) {
  const g = new THREE.Group();
  g.position.set(place.x, place.y - 0.3, place.z);
  // the opening faces `facing` (0 = south, +z); the shell is built with its gap toward local −x
  g.rotation.y = place.facing + Math.PI / 2;

  const rockMat = new THREE.MeshStandardMaterial({ color: '#5a5048', roughness: 1, flatShading: true, side: THREE.DoubleSide });
  const geo = new THREE.SphereGeometry(R, 40, 14, OPENING / 2, Math.PI * 2 - OPENING, 0, Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * 0.9) * Math.cos(z * 0.8) + Math.sin(y * 1.3 + x * 0.4) * 0.6;
    const k = 1 + n * 0.07;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  geo.computeVertexNormals();
  const shell = new THREE.Mesh(geo, rockMat);
  shell.scale.y = 0.62;
  shell.castShadow = true;
  shell.receiveShadow = true;
  g.add(shell);

  // boulders piled around the outside so it reads as a rocky hill, and an arch over the entrance
  const boulder = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 14; i++) {
    const a = OPENING / 2 + 0.25 + (i / 14) * (Math.PI * 2 - OPENING - 0.5);
    const b = new THREE.Mesh(boulder, rockMat);
    const s = 3 + ((i * 37) % 5);
    b.scale.set(s, s * 0.8, s);
    b.position.set(-Math.cos(a) * (R + 1), s * 0.3, Math.sin(a) * (R + 1));
    b.rotation.set(i, i * 2, i * 3);
    b.castShadow = true;
    g.add(b);
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(R * Math.sin(OPENING / 2) + 1.2, 1.4, 8, 16, Math.PI), rockMat);
  arch.position.set(-R * Math.cos(OPENING / 2) - 0.5, 0, 0);
  arch.rotation.y = Math.PI / 2;
  arch.scale.y = 0.9;
  g.add(arch);

  // glowing crystals inside
  const crystalMat = new THREE.MeshStandardMaterial({ color: '#8fd8ff', emissive: '#3aa0ff', emissiveIntensity: 1.6, roughness: 0.2 });
  for (let i = 0; i < 9; i++) {
    const a = 1 + i * 0.6;
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), crystalMat);
    c.scale.set(1, 2.2 + (i % 3), 1);
    c.position.set(-Math.cos(a) * (R - 2.5), 0.6, Math.sin(a) * (R - 2.5));
    c.rotation.z = (i % 2 ? 1 : -1) * 0.3;
    g.add(c);
  }
  const glow = new THREE.PointLight('#6ac0ff', 30, 26, 1.5);
  glow.position.set(3, 4, 0);
  g.add(glow);

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
  return { group: g, solid, inside: (x, z) => Math.hypot(x - place.x, z - place.z) < R };
}
