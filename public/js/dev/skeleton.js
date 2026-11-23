// A test stage for the skeletons (for development; not part of the game): meshes every bone of a
// skeleton from skeleton.js, hangs it on its joints, and shows it from any side.
import * as THREE from 'three';
import { meshField } from '../characters/body/mesher.js';
import { shapeBox } from '../characters/body/sdf.js';
import { goblinSkeleton } from '../characters/body/skeleton.js';
import { goblinMuscles } from '../characters/body/muscles.js';
import { goblinVessels } from '../characters/body/veins.js';
import { goblinArmJoints, goblinLegJoints } from '../characters/body/joints.js';
import { goblinOrgans } from '../characters/body/organs.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#26262a');
scene.add(new THREE.HemisphereLight('#fff8ee', '#3a3632', 1.1));
const key = new THREE.DirectionalLight('#ffffff', 2.2); key.position.set(1.5, 2.5, 2.5); scene.add(key);
const rim = new THREE.DirectionalLight('#b8c8ff', 0.9); rim.position.set(-2, 1.5, -2.5); scene.add(rim);
const fill = new THREE.DirectionalLight('#ffffff', 0.5); fill.position.set(-2, 0.5, 2); scene.add(fill);
const MATS = {
  bone: new THREE.MeshStandardMaterial({ color: '#e8dcc2', roughness: 0.62 }),
  cartilage: new THREE.MeshStandardMaterial({ color: '#a9c3d4', roughness: 0.4, transparent: true, opacity: 0.85 }),
  tooth: new THREE.MeshStandardMaterial({ color: '#fbf7ec', roughness: 0.3 }),
  muscle: new THREE.MeshStandardMaterial({ color: '#b5453a', roughness: 0.48 }),
  tendon: new THREE.MeshStandardMaterial({ color: '#e9e4da', roughness: 0.3 }),
  artery: new THREE.MeshStandardMaterial({ color: '#d02a2e', roughness: 0.32, emissive: '#3a0606' }),
  vein: new THREE.MeshStandardMaterial({ color: '#3d62c4', roughness: 0.32, emissive: '#060c26' }),
  capsule: new THREE.MeshStandardMaterial({ color: '#efe9dc', roughness: 0.35, transparent: true, opacity: 0.32, depthWrite: false }),
  heart: new THREE.MeshStandardMaterial({ color: '#9a2c2a', roughness: 0.42 }),
  lung: new THREE.MeshStandardMaterial({ color: '#e5a0a2', roughness: 0.7 }),
  airway: new THREE.MeshStandardMaterial({ color: '#d9b3aa', roughness: 0.5 }),
  liver: new THREE.MeshStandardMaterial({ color: '#7a2c22', roughness: 0.38 }),
  gall: new THREE.MeshStandardMaterial({ color: '#5d8a3e', roughness: 0.3 }),
  gut: new THREE.MeshStandardMaterial({ color: '#e2a28c', roughness: 0.45 }),
  colon: new THREE.MeshStandardMaterial({ color: '#c99079', roughness: 0.5 }),
  spleen: new THREE.MeshStandardMaterial({ color: '#6c2c48', roughness: 0.4 }),
  pancreas: new THREE.MeshStandardMaterial({ color: '#e6c98e', roughness: 0.6 }),
  kidney: new THREE.MeshStandardMaterial({ color: '#8c3628', roughness: 0.4 }),
  adrenal: new THREE.MeshStandardMaterial({ color: '#d9a447', roughness: 0.55 }),
  bladder: new THREE.MeshStandardMaterial({ color: '#e8cfae', roughness: 0.45 }),
};
const grid = new THREE.GridHelper(2, 20, '#55555c', '#3a3a40'); scene.add(grid);

let skel = null;
// withMuscles: lay the muscles on; withVessels: the blood vessels (they need the muscles to lie on,
// which are then built whether shown or not); pose: joint angles to use instead of the stance
function build(make = goblinSkeleton, posed = true, withMuscles = false, withVessels = false, pose = null, withJoints = true, filter = null, withOrgans = false) {
  if (skel) scene.remove(skel.root);
  const S = make(), t0 = performance.now();
  if (pose) S.pose = { ...S.pose, ...pose };
  const mus = withMuscles || withVessels ? goblinMuscles(S, { posed }) : [];
  if (withVessels) S.parts.push(...goblinVessels(S, mus, { posed }));
  if (withMuscles) S.parts.push(...mus);
  if (withJoints) S.parts.push(...goblinArmJoints(S, { posed }), ...goblinLegJoints(S, { posed }));
  if (withOrgans) S.parts.push(...goblinOrgans(S));
  const nodes = {}, root = new THREE.Group();
  for (const j of S.joints) {
    const o = new THREE.Object3D(); o.name = j.name;
    const par = j.parent ? S.joints.find((q) => q.name === j.parent).pos : [0, 0, 0];
    o.position.set(j.pos[0] - par[0], j.pos[1] - par[1], j.pos[2] - par[2]);
    if (posed && S.pose[j.name]) o.rotation.set(...S.pose[j.name]);
    (j.parent ? nodes[j.parent] : root).add(o); nodes[j.name] = o;
  }
  let tris = 0;
  const keep = filter ? new RegExp(filter) : null;
  for (const p of S.parts) {
    if (!p.shapes.length || (keep && !keep.test(p.name))) continue;
    const box = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    for (const s of p.shapes) if (!s.sub) { const b = shapeBox(s); for (let i = 0; i < 3; i++) { box[i] = Math.min(box[i], b[i]); box[i + 3] = Math.max(box[i + 3], b[i + 3]); } }
    const m = meshField(p.shapes, box, p.cell);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
    g.setIndex(new THREE.BufferAttribute(m.indices, 1));
    const jp = p.joint ? S.joints.find((q) => q.name === p.joint).pos : null;
    if (jp) g.translate(-jp[0], -jp[1], -jp[2]);
    tris += m.indices.length / 3;
    const mesh = new THREE.Mesh(g, MATS[p.mat]); mesh.name = p.name;
    (p.joint ? nodes[p.joint] : root).add(mesh);
  }
  scene.add(root); root.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(root);
  if (!keep) root.position.y -= bb.min.y; // (stand it on the floor; a part shown alone stays where it is in the body)
  root.updateMatrixWorld(true);
  bb.setFromObject(root);
  skel = { root, nodes, S, bb };
  return { ms: Math.round(performance.now() - t0), tris, height: +(bb.max.y - bb.min.y).toFixed(3), size: bb.getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(3)) };
}
// side: 'front', 'back', 'left' (the body's left), 'right', or [x,y,z] for a free view; an
// orthographic camera (true proportions) framing the whole skeleton, or `frame` [cx, cy, half-height]
function view(side = 'front', frame = null) {
  const bb = skel.bb, c = bb.getCenter(new THREE.Vector3());
  const half = frame ? frame[2] : (bb.max.y - bb.min.y) * 0.56;
  const asp = innerWidth / innerHeight;
  const cam = new THREE.OrthographicCamera(-half * asp, half * asp, half, -half, 0.01, 20);
  const cx = frame ? frame[0] : c.x, cy = frame ? frame[1] : c.y, cz = frame && frame[3] !== undefined ? frame[3] : c.z;
  const dir = { front: [0, 0, 1], back: [0, 0, -1], left: [1, 0, 0], right: [-1, 0, 0] }[side] || side;
  const d = new THREE.Vector3(...dir).normalize().multiplyScalar(5);
  cam.position.set(cx + d.x, cy + d.y, cz + d.z); cam.lookAt(cx, cy, cz);
  key.position.copy(cam.position).add(new THREE.Vector3(1.2, 2, 0).applyQuaternion(cam.quaternion));
  renderer.render(scene, cam);
}
// only: show just the meshes whose names match (a RegExp source), or everything when empty
function only(re) { const r = re ? new RegExp(re) : null; skel.root.traverse((o) => { if (o.isMesh) o.visible = !r || r.test(o.name); }); grid.visible = !r; }
window.__skel = { build, view, only, get skel() { return skel; } };
