// Many small still meshes (a city's houses and walls) drawn as a few big ones: one mesh for each
// material, so the city costs a handful of draw calls instead of thousands.
import * as THREE from 'three';

// Replace every mesh under `group` with one merged mesh per material. Only for meshes that never
// move on their own and have no textures (a mesh marked userData.moves, like a door, stays as it is).
export function mergeStill(group) {
  group.updateMatrixWorld(true);
  const toLocal = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const byMat = new Map();
  const meshes = [];
  group.traverse((o) => { if (o.isMesh && !o.material.map && !Array.isArray(o.material) && !o.userData.moves) meshes.push(o); });
  for (const m of meshes) {
    const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone());
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toLocal, m.matrixWorld));
    if (!byMat.has(m.material)) byMat.set(m.material, []);
    byMat.get(m.material).push(geo);
    m.parent.remove(m);
  }
  // empty groups left behind
  const empty = [];
  group.traverse((o) => { if (o !== group && !o.isMesh && !o.children.length) empty.push(o); });
  for (const o of empty) o.parent?.remove(o);
  for (const [mat, geos] of byMat) {
    let n = 0;
    for (const g of geos) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    let at = 0;
    for (const g of geos) {
      pos.set(g.attributes.position.array, at * 3);
      if (g.attributes.normal) nor.set(g.attributes.normal.array, at * 3);
      at += g.attributes.position.count;
      g.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
