// Townsfolk, guards and monsters cost the most to draw, so the world keeps a list of them and,
// a few times a second, hides the far ones and lets only the near ones cast shadows.
// bakeCharacter() also joins a finished character's still parts (same joint, same material) into
// one mesh each, so a person costs a few draw calls instead of eighty.
import * as THREE from 'three';

const crowd = new Set();
export const SEE_FAR = 75;   // townsfolk further than this are not drawn
export const SHADOW_FAR = 22; // and only those this close cast shadows

let seeFar = SEE_FAR; // (lower on phones: see world/quality.js crowdFar)
export function setCrowdFar(m) { seeFar = m || SEE_FAR; }

export function joinCrowd(body) { crowd.add(body); return body; }

// A townsperson or guard who is only built when you come near, and taken apart again when you go
// far away, so a big city doesn't hold the bodies of everyone in it at once (on a phone that
// filled the memory and the page crashed). `make()` builds and dresses the body; `height` is about
// how tall they stand, until they are built. Until then the holder has no rig, and isShown() is false.
export function lazyCharacter(make, height = 1.8) {
  const holder = new THREE.Group();
  const stand = new THREE.Group(); // stands in for the body (children[0]) until it is built
  stand.visible = false;
  holder.add(stand);
  holder.userData.height = height;
  holder.userData.make = make;
  return joinCrowd(holder);
}
// bodies built per update (about ten times a second): one at a time, so no single frame pays for
// several (three at once made walking through a city hitch each time new townsfolk came into view)
const BUILD_EACH = 1;
const KEEP = 1.4;     // a built body is kept until it is this many times further than the drawing distance

function build(holder) {
  const real = bakeCharacter(holder.userData.make());
  holder.remove(holder.children[0]);
  holder.add(real);
  holder.children.unshift(holder.children.pop()); // the body is always children[0]
  holder.userData.rig = real.userData.rig;
  holder.userData.height = real.userData.height;
  holder.userData.lodShadow = undefined;
}
function unbuild(holder) {
  const real = holder.children[0];
  real.traverse((o) => {
    if (o.isSkinnedMesh) { o.skeleton?.dispose(); return; } // (the sculpted body's shape is shared)
    if (o.isMesh) o.geometry?.dispose();
  });
  const stand = new THREE.Group();
  stand.visible = false;
  holder.remove(real);
  holder.add(stand);
  holder.children.unshift(holder.children.pop());
  delete holder.userData.rig;
}

// Hide or show each one by its distance from (x, y, z), the camera. `buildEach` is how many new
// bodies may be built this time (behind the loading clouds every one in view is built at once)
export function updateCrowd(x, y, z, scene, buildEach = BUILD_EACH) {
  const p = new THREE.Vector3();
  let built = 0;
  for (const b of crowd) {
    let top = b;
    while (top.parent) top = top.parent;
    if (top !== scene) { if (b.userData.inWorld) crowd.delete(b); continue; } // left the world (or not in yet)
    b.userData.inWorld = true;
    b.getWorldPosition(p);
    const d = Math.hypot(p.x - x, p.y - y, p.z - z) / Math.max(1, (b.userData.height || 1.8) / 2.2);
    const far = b.userData.seeFar ? Math.max(b.userData.seeFar, seeFar) : seeFar;
    let show = d < far;
    if (b.userData.make) {
      if (b.userData.rig && d > far * KEEP + 10) unbuild(b);
      else if (show && !b.userData.rig) { if (built < buildEach) { build(b); built++; } else show = false; }
      if (!b.userData.rig) continue;
    }
    const inner = b.children[0];
    if (inner && inner.visible !== show) inner.visible = show;
    const shadow = show && d < SHADOW_FAR;
    if (b.userData.lodShadow !== shadow) {
      b.userData.lodShadow = shadow;
      b.traverse((o) => { if (o.isMesh) o.castShadow = shadow; });
    }
  }
}
export const isShown = (b) => b.children[0]?.visible !== false && (!b.userData.make || !!b.userData.rig);

// Join the still parts of a dressed character. Parts the animation changes on their own (a slime's
// body, an aura) are left as they are. Call it after the gear is on, and only for characters whose
// gear never changes (townsfolk, guards, shopkeepers).
export function bakeCharacter(body) {
  const rig = body.userData.rig;
  const keep = new Set();
  for (const k of ['body', 'core', 'aura']) rig?.[k]?.traverse((o) => keep.add(o));
  for (const w of rig?.wings || []) w.traverse((o) => keep.add(o));
  const groups = new Map(); // parent -> material -> meshes
  body.traverse((o) => {
    if (!o.isMesh || !o.visible || o.isSkinnedMesh || keep.has(o) || Array.isArray(o.material) || !o.parent || o.children.length) return;
    let byMat = groups.get(o.parent);
    if (!byMat) groups.set(o.parent, (byMat = new Map()));
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(o);
  });
  for (const [parent, byMat] of groups) {
    for (const [mat, list] of byMat) {
      if (list.length < 2) continue;
      const geos = list.map((m) => {
        m.updateMatrix();
        const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone());
        for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
        g.applyMatrix4(m.matrix);
        return g;
      });
      const merged = joinGeometries(geos, !!mat.map);
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      for (const m of list) parent.remove(m);
      parent.add(mesh);
    }
  }
  return body;
}

function joinGeometries(geos, withUv) {
  let n = 0;
  for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = withUv ? new Float32Array(n * 2) : null;
  let at = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, at * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, at * 3);
    if (uv && g.attributes.uv) uv.set(g.attributes.uv.array, at * 2);
    at += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}
