// Many small still meshes (a city's houses and walls) drawn as a few big ones: one mesh for each
// material, so the city costs a handful of draw calls instead of thousands.
import * as THREE from 'three';

// Replace every mesh under `group` with merged meshes, one per material. Only for meshes that never
// move on their own: a mesh marked userData.moves (like a door) keeps its own place, but its parts
// are joined into it. Textured meshes keep their UVs.
// `cell` (metres): also split by squares of the ground this size, so far squares are skipped by
// the camera and by the sun's shadow. Meshes marked userData.detail (window frames, rails) go in
// meshes of their own marked userData.detailFar, which showDetail() hides beyond a distance.
// On a phone or tablet the small details (window frames, braces, rails) are not built at all: in a
// big city they were more than half of the houses' memory, and an iPhone closes a page that uses
// too much. They were only drawn within 50 m there anyway.
let leanDetail = false;
export function setLeanDetail(on) { leanDetail = !!on; }

export function mergeStill(group, { cell = 0 } = {}) {
  group.updateMatrixWorld(true);
  const toLocal = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();
  const movers = [];
  const meshes = [];
  const walk = (o, isDetail) => {
    for (const c of [...o.children]) {
      if (c.userData.moves) { movers.push(c); continue; }
      const det = isDetail || !!c.userData.detail;
      if (c.isMesh && !Array.isArray(c.material) && !c.isSkinnedMesh && !c.userData.rig) meshes.push([c, det]);
      if (!c.userData.rig) walk(c, det);
    }
  };
  walk(group, false);
  const tmp = new THREE.Vector3();
  for (const [m, det] of meshes) {
    if (det && leanDetail) { m.parent.remove(m); continue; }
    const geo = toFlat(m.geometry);
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toLocal, m.matrixWorld));
    let key = '';
    if (cell) {
      geo.computeBoundingSphere();
      tmp.copy(geo.boundingSphere.center);
      key = `${Math.floor(tmp.x / cell)},${Math.floor(tmp.z / cell)}`;
    }
    const look = sharedLook(m.material);
    const k = `${look.mat.uuid}|${key}|${det ? 1 : 0}`;
    if (!buckets.has(k)) buckets.set(k, { mat: look.mat, det, geos: [], tints: look.tint ? [] : null });
    const b = buckets.get(k);
    b.geos.push(geo);
    b.tints?.push(look.tint);
    m.parent.remove(m);
  }
  // empty groups left behind
  const empty = [];
  group.traverse((o) => { if (o !== group && !o.isMesh && !o.children.length && !o.userData.keep) empty.push(o); });
  for (const o of empty) o.parent?.remove(o);
  for (const { mat, det, geos, tints } of buckets.values()) {
    const mesh = new THREE.Mesh(join(geos, !!mat.map, tints), mat);
    mesh.castShadow = !det; mesh.receiveShadow = true;
    if (det) mesh.userData.detailFar = true;
    else if (cell) mesh.userData.cellFar = true; // a whole patch of the city: hidden when far (showDetail)
    group.add(mesh);
  }
  for (const mv of movers) joinInto(mv);
  return group;
}

// Join the parts of a moving piece (a door leaf and its knob) into it
function joinInto(mover) {
  const parts = [];
  mover.traverse((o) => { if (o !== mover && o.isMesh && !Array.isArray(o.material)) parts.push(o); });
  if (!parts.length) return;
  mover.updateMatrixWorld(true);
  const toLocal = new THREE.Matrix4().copy(mover.matrixWorld).invert();
  const byMat = new Map();
  for (const m of parts) {
    const geo = toFlat(m.geometry);
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toLocal, m.matrixWorld));
    if (!byMat.has(m.material)) byMat.set(m.material, []);
    byMat.get(m.material).push(geo);
    m.parent.remove(m);
  }
  for (const [mat, geos] of byMat) {
    const mesh = new THREE.Mesh(join(geos, !!mat.map), mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mover.add(mesh);
  }
}

// Show the detail meshes under `group` only when (x, z) is within `far` metres of them
// cellFar: the city's patches (cells) further than this aren't drawn at all (quality.js)
export function showDetail(group, x, z, far = 90, cellFar = Infinity) {
  const p = new THREE.Vector3();
  for (const m of group.children) {
    const lim = m.userData.detailFar ? far : m.userData.cellFar ? cellFar : 0;
    if (!lim) continue;
    const s = m.geometry.boundingSphere;
    p.copy(s.center).applyMatrix4(group.matrixWorld);
    m.visible = Math.hypot(p.x - x, p.z - z) - s.radius < lim;
  }
}

function toFlat(g) {
  const out = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(out.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') out.deleteAttribute(k);
  return out;
}

// Houses come in many colours of the same few materials (plaster, timber, tiles, stone...). One
// mesh per colour per square of ground made a city about a thousand draw calls, so plain colours
// share one white material each and the colour goes on the corners of the shapes (vertex colours).
// Glowing, see-through or changing materials keep their own.
const shared = new Map();
function sharedLook(m) {
  if (!m.isMeshStandardMaterial || m.vertexColors || m.transparent || m.userData.own || (m.emissive && m.emissive.getHex() !== 0)) return { mat: m, tint: null };
  const key = [m.type, m.map?.uuid, m.normalMap?.uuid, m.roughnessMap?.uuid, m.roughness, m.metalness, m.side, m.flatShading, m.alphaTest,
    m.polygonOffset, m.polygonOffsetFactor, m.polygonOffsetUnits, m.depthWrite].join('|');
  let s = shared.get(key);
  if (!s) { s = m.clone(); s.color.set(0xffffff); s.vertexColors = true; shared.set(key, s); }
  return { mat: s, tint: m.color };
}

function join(geos, withUv, tints = null) {
  let n = 0;
  for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  const uv = withUv ? new Float32Array(n * 2) : null;
  const col = tints ? new Float32Array(n * 3) : null;
  let at = 0;
  geos.forEach((g, i) => {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, at * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, at * 3);
    if (uv && g.attributes.uv) uv.set(g.attributes.uv.array, at * 2);
    if (col) { const t = tints[i]; for (let v = at; v < at + c; v++) { col[v * 3] = t.r; col[v * 3 + 1] = t.g; col[v * 3 + 2] = t.b; } }
    at += c;
    g.dispose();
  });
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uv) merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
  merged.computeBoundingSphere();
  return merged;
}
