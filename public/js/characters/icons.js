// Pictures of items for the shop and the bag: each item is modelled in 3D, lit like a showcase
// and rendered once into an image. Items without a model keep their emoji.
import * as THREE from 'three';
import { ITEMS } from '../data/items.mjs';
import { weaponModel, wearGear } from './gear.js';
import { buildCharacter } from './model.js';

const SIZE = 256;
let renderer = null, scene = null, camera = null;
const cache = new Map();

function setup() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(SIZE, SIZE, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(28, 1, 0.01, 50);

  // A studio for reflections: a dark room with a few bright panels, so metal shows highlights
  const studio = new THREE.Scene();
  studio.background = new THREE.Color('#36404e');
  const panel = (color, intensity, pos, w, h) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.copy(pos);
    m.lookAt(0, 0, 0);
    studio.add(m);
  };
  panel('#ffffff', 8, new THREE.Vector3(3, 4, 3), 5, 3);
  panel('#ffffff', 4, new THREE.Vector3(0, 0, 5), 6, 2);
  panel('#9fc8ff', 3, new THREE.Vector3(-4, 2, -2), 3, 3);
  panel('#ffd9a0', 2.5, new THREE.Vector3(0, -3, 4), 5, 1);
  panel('#ffffff', 2, new THREE.Vector3(-2, 5, 4), 2, 2);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio, 0.02).texture;

  scene.add(new THREE.HemisphereLight('#dbe8ff', '#1a1410', 0.8));
  const key = new THREE.DirectionalLight('#ffffff', 2.2);
  key.position.set(2, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#6aa8ff', 2.5);
  rim.position.set(-3, 1, -3);
  scene.add(rim);
}

const std = (color, metalness = 0, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
const m = (geo, material, fn) => { const o = new THREE.Mesh(geo, material); fn?.(o); return o; };

function armourLook(it) {
  const metal = !!it.look?.metal;
  return std(it.look?.color || '#777', metal ? 1 : 0, metal ? 0.3 : 0.85);
}

function armourModel(it) {
  const g = new THREE.Group();
  const look = armourLook(it);
  const trim = std('#d9b45a', 1, 0.25);
  const leather = std('#3a2418', 0, 0.8);
  switch (it.slot) {
    case 'head':
      if (it.look?.hat) {
        g.add(m(new THREE.CylinderGeometry(0.5, 0.5, 0.03, 32), look));
        g.add(m(new THREE.ConeGeometry(0.24, 0.75, 24), look, (o) => { o.position.set(0.04, 0.37, 0); o.rotation.z = -0.25; }));
        g.add(m(new THREE.TorusGeometry(0.23, 0.025, 8, 30), std('#c8a040', 1, 0.3), (o) => { o.rotation.x = Math.PI / 2; o.position.y = 0.04; }));
      } else {
        const cap = it.id === 'leather_cap';
        g.add(m(new THREE.SphereGeometry(0.3, 32, 16, 0, Math.PI * 2, 0, cap ? Math.PI * 0.45 : Math.PI * 0.6), look, (o) => { o.material.side = THREE.DoubleSide; }));
        g.add(m(new THREE.TorusGeometry(cap ? 0.29 : 0.27, 0.025, 8, 32), cap ? leather : look, (o) => { o.rotation.x = Math.PI / 2; o.position.y = cap ? 0.05 : -0.09; }));
        if (!cap) {
          g.add(m(new THREE.BoxGeometry(0.04, 0.24, 0.04), look, (o) => { o.position.set(0, -0.12, 0.28); }));
          for (const s of [-1, 1]) g.add(m(new THREE.BoxGeometry(0.03, 0.2, 0.14), look, (o) => { o.position.set(s * 0.27, -0.16, 0.08); o.rotation.y = s * 0.3; }));
          g.add(m(new THREE.BoxGeometry(0.03, 0.06, 0.55), look, (o) => { o.position.y = 0.3; }));
        }
        if (it.id === 'knight_helm') {
          for (let i = 0; i < 5; i++) g.add(m(new THREE.ConeGeometry(0.04, 0.16, 6), trim, (o) => { const a = (i - 2) * 0.35; o.position.set(Math.sin(a) * 0.26, 0.2, Math.cos(a) * 0.12); }));
          g.add(m(new THREE.SphereGeometry(0.12, 12, 8), std('#b8282a', 0, 0.9), (o) => { o.scale.set(0.5, 1.4, 2.2); o.position.set(0, 0.38, -0.12); }));
        }
      }
      g.rotation.y = -0.5;
      break;
    case 'body': {
      const robe = it.look?.robe;
      const pts = robe
        ? [[0.2, 0.55], [0.32, 0.45], [0.3, 0.2], [0.26, 0], [0.34, -0.4], [0.42, -0.75]]
        : [[0.16, 0.5], [0.33, 0.42], [0.36, 0.2], [0.3, -0.05], [0.27, -0.25], [0.3, -0.32]];
      const geo = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 32);
      g.add(m(geo, look, (o) => { o.scale.z = 0.7; o.material.side = THREE.DoubleSide; }));
      for (const s of [-1, 1]) g.add(m(new THREE.SphereGeometry(0.15, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), look, (o) => { o.position.set(s * 0.36, 0.4, 0); o.rotation.z = -s * 0.5; o.scale.set(1, 0.8, 0.9); }));
      if (!robe) g.add(m(new THREE.TorusGeometry(0.27, 0.025, 8, 32), it.look?.metal ? trim : leather, (o) => { o.rotation.x = Math.PI / 2; o.scale.y = 0.7; o.position.y = -0.22; }));
      else g.add(m(new THREE.TorusGeometry(0.26, 0.02, 8, 32), trim, (o) => { o.rotation.x = Math.PI / 2; o.scale.y = 0.7; }));
      g.rotation.y = -0.45;
      break;
    }
    case 'legs':
      g.add(m(new THREE.TorusGeometry(0.22, 0.04, 8, 28), leather, (o) => { o.rotation.x = Math.PI / 2; o.scale.y = 0.7; o.position.y = 0.42; }));
      for (const s of [-1, 1]) {
        g.add(m(new THREE.CylinderGeometry(0.12, 0.09, 0.5, 20), look, (o) => { o.position.set(s * 0.12, 0.15, 0); }));
        g.add(m(new THREE.CylinderGeometry(0.09, 0.07, 0.42, 20), look, (o) => { o.position.set(s * 0.12, -0.32, 0); }));
        if (it.look?.metal) g.add(m(new THREE.SphereGeometry(0.085, 14, 10), look, (o) => { o.position.set(s * 0.12, -0.1, 0.05); }));
      }
      g.rotation.y = -0.4;
      break;
    case 'feet':
      for (const s of [-1, 1]) {
        g.add(m(new THREE.CylinderGeometry(0.1, 0.09, 0.36, 20), look, (o) => { o.position.set(s * 0.15, 0.1, 0); }));
        g.add(m(new THREE.SphereGeometry(1, 20, 12), look, (o) => { o.scale.set(0.1, 0.08, 0.2); o.position.set(s * 0.15, -0.1, 0.08); }));
        g.add(m(new THREE.TorusGeometry(0.095, 0.015, 6, 20), it.look?.metal ? trim : leather, (o) => { o.rotation.x = Math.PI / 2; o.position.set(s * 0.15, 0.24, 0); }));
      }
      g.rotation.y = -0.6;
      break;
    case 'shield': {
      const tower = it.id === 'tower_shield';
      if (tower) {
        g.add(m(new THREE.BoxGeometry(0.6, 0.95, 0.05), look));
        g.add(m(new THREE.BoxGeometry(0.66, 0.05, 0.07), trim, (o) => { o.position.y = 0.47; }));
        g.add(m(new THREE.BoxGeometry(0.66, 0.05, 0.07), trim, (o) => { o.position.y = -0.47; }));
        g.add(m(new THREE.BoxGeometry(0.08, 0.6, 0.02), trim, (o) => { o.position.z = 0.035; }));
        g.add(m(new THREE.BoxGeometry(0.4, 0.08, 0.02), trim, (o) => { o.position.set(0, 0.1, 0.035); }));
      } else {
        const wood = it.id === 'wooden_shield';
        g.add(m(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 40), look, (o) => { o.rotation.x = Math.PI / 2; }));
        g.add(m(new THREE.TorusGeometry(0.42, 0.03, 8, 40), std('#6a6e74', 1, 0.4)));
        g.add(m(new THREE.SphereGeometry(0.1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), std('#9ea4ac', 1, 0.3), (o) => { o.rotation.x = Math.PI / 2; o.position.z = 0.02; }));
        if (wood) for (let i = -2; i <= 2; i++) g.add(m(new THREE.BoxGeometry(0.008, 0.8 - Math.abs(i) * 0.12, 0.01), std('#3a2414', 0, 0.9), (o) => { o.position.set(i * 0.16, 0, 0.028); }));
      }
      g.rotation.y = -0.45;
      break;
    }
  }
  return g;
}

// Glass bottles with glowing liquid, bread, herbs and berries
function foodModel(it) {
  const g = new THREE.Group();
  const glass = std('#dfeaf2', 0, 0.05, { transparent: true, opacity: 0.35 });
  const cork = std('#8a6a44', 0, 0.9);
  const bottle = (liquid, { big = false, tall = false } = {}) => {
    const r = big ? 0.3 : 0.24;
    const body = tall
      ? [[0.001, -0.4], [0.14, -0.38], [0.15, 0.2], [0.07, 0.3], [0.06, 0.42]]
      : [[0.001, -0.3], [r * 0.7, -0.28], [r, -0.05], [r * 0.7, 0.18], [0.07, 0.28], [0.06, 0.42]];
    g.add(m(new THREE.LatheGeometry(body.map(([a, b]) => new THREE.Vector2(a, b)), 32), glass));
    const fill = tall ? [[0.001, -0.37], [0.125, -0.35], [0.13, 0.12], [0.001, 0.12]] : [[0.001, -0.27], [r * 0.66, -0.25], [r * 0.93, -0.05], [r * 0.6, 0.12], [0.001, 0.12]];
    g.add(m(new THREE.LatheGeometry(fill.map(([a, b]) => new THREE.Vector2(a, b)), 32), std(liquid, 0, 0.2, { emissive: liquid, emissiveIntensity: 0.9 })));
    g.add(m(new THREE.CylinderGeometry(0.065, 0.055, 0.1, 14), cork, (o) => { o.position.y = 0.46; }));
    if (big || tall) g.add(m(new THREE.TorusGeometry(0.07, 0.015, 6, 20), std('#d9b45a', 1, 0.25), (o) => { o.rotation.x = Math.PI / 2; o.position.y = 0.36; }));
  };
  switch (it.id) {
    case 'potion': bottle('#e0262a'); break;
    case 'big_potion': bottle('#ff3a3a', { big: true }); break;
    case 'sp_potion': bottle('#2a7aff'); break;
    case 'sp_booster': bottle('#3ae0ff', { tall: true }); break;
    case 'bread':
      g.add(m(new THREE.SphereGeometry(1, 24, 16), std('#b87a3a', 0, 0.8), (o) => { o.scale.set(0.45, 0.2, 0.25); }));
      for (let i = -1; i <= 1; i++) g.add(m(new THREE.BoxGeometry(0.03, 0.02, 0.3), std('#e8c890', 0, 0.9), (o) => { o.position.set(i * 0.15, 0.19, 0); o.rotation.y = 0.5; }));
      g.rotation.set(0.35, -0.4, 0);
      break;
    case 'herb':
      for (let i = 0; i < 7; i++) g.add(m(new THREE.SphereGeometry(1, 12, 8), std('#4a9a3a', 0, 0.7), (o) => { const a = (i / 7) * Math.PI * 2; o.scale.set(0.06, 0.02, 0.22); o.position.set(Math.cos(a) * 0.12, 0.1 + (i % 2) * 0.05, Math.sin(a) * 0.12); o.rotation.y = -a + Math.PI / 2; o.rotation.x = 0.5; }));
      g.add(m(new THREE.CylinderGeometry(0.012, 0.015, 0.4, 6), std('#5a7a2a', 0, 0.8), (o) => { o.position.y = -0.1; }));
      break;
    case 'berries':
      for (let i = 0; i < 9; i++) g.add(m(new THREE.SphereGeometry(0.08, 14, 10), std('#3a3a8a', 0, 0.35), (o) => { o.position.set(Math.cos(i * 2.4) * (0.05 + i * 0.012), (i % 3) * 0.06, Math.sin(i * 2.4) * (0.05 + i * 0.012)); }));
      break;
    case 'torch':
      g.add(m(new THREE.CylinderGeometry(0.04, 0.05, 0.8, 8), std('#5a3a22', 0, 0.9)));
      g.add(m(new THREE.CylinderGeometry(0.07, 0.06, 0.14, 10), std('#3a2a1a', 0, 0.9), (o) => { o.position.y = 0.4; }));
      g.add(m(new THREE.ConeGeometry(0.09, 0.3, 10), std('#ffb347', 0, 0.3, { emissive: '#ff7a1a', emissiveIntensity: 2.5 }), (o) => { o.position.y = 0.6; }));
      g.rotation.z = -0.4;
      break;
    default: return null;
  }
  return g;
}

function modelFor(it, plus) {
  if (it.kind === 'weapon') {
    const pivot = new THREE.Group();
    const w = weaponModel(it, plus);
    // stand the weapon up and lean it across the picture
    w.rotation.x = -Math.PI / 2;
    pivot.add(w);
    pivot.rotation.set(0.25, 0.5, -Math.PI / 4);
    return pivot;
  }
  if (it.kind === 'armour') return armourModel(it);
  if (it.kind === 'food' || it.id === 'torch') return foodModel(it);
  return null;
}

// The item's 3D model on its own (for display stands), or null when it has none
export function itemModel(id, plus = 0) {
  const it = ITEMS[id];
  return it ? modelFor(it, plus) : null;
}

// Returns an image URL for the item, or null when it has no model
export function itemIcon(id, plus = 0) {
  const it = ITEMS[id];
  if (!it) return null;
  const key = `${id}|${plus >= 5 ? 5 : 0}`;
  if (cache.has(key)) return cache.get(key);
  let url = null;
  try {
    if (!renderer) setup();
    const obj = modelFor(it, plus);
    if (obj) {
      const holder = new THREE.Group();
      holder.add(obj);
      scene.add(holder);
      // fit the model in the frame
      const box = new THREE.Box3().setFromObject(holder);
      const centre = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      holder.position.sub(centre);
      const d = Math.max(size.x, size.y) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.08 + size.z / 2;
      camera.position.set(0, 0, d);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      url = renderer.domElement.toDataURL('image/png');
      scene.remove(holder);
    }
  } catch {
    url = null; // no WebGL: the emoji stays
  }
  cache.set(key, url);
  return url;
}

// Fill every <img data-icon="id" data-plus="n"> inside `root`, a few per frame so the window opens at once
export function fillIcons(root) {
  const imgs = [...root.querySelectorAll('img[data-icon]:not([src])')];
  const step = () => {
    const t0 = performance.now();
    while (imgs.length && performance.now() - t0 < 12) {
      const img = imgs.shift();
      const url = itemIcon(img.dataset.icon, Number(img.dataset.plus || 0));
      if (url) { img.src = url; img.nextElementSibling?.classList.add('hidden'); }
      else img.remove();
    }
    if (imgs.length) requestAnimationFrame(step);
  };
  step();
}

// A photo of a character for their ID card: head and shoulders, in their gear
export function characterPortrait(c, worn = {}) {
  try {
    if (!renderer) setup();
    const body = buildCharacter({ race: c.race, form: c.form, stage: c.stage || 0, look: c.look });
    wearGear(body, worn);
    const holder = new THREE.Group();
    holder.add(body);
    body.rotation.y = 0.35;
    scene.add(holder);
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(body);
    const h = box.max.y - box.min.y;
    // frame the top 45% of the body
    const top = box.max.y, cy = top - h * 0.2, span = h * 0.44;
    const d = span / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.position.set(0, cy, d + (box.max.z - box.min.z) / 2);
    camera.lookAt(0, cy, 0);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    scene.remove(holder);
    return url;
  } catch {
    return null;
  }
}
