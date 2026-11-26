// Glow lights (campfires, lamps, portals, a fairy's glow, a dragon's fire...) and the few real
// lights that draw them.
//
// Every real light in the scene costs every lit pixel on screen, and three.js rebuilds the
// shaders of every material whenever the NUMBER of lights changes. Campfires, lamps and glowing
// monsters come and go as you walk, so with real lights the whole game hitched each time one
// streamed in or out. Instead, each of those is a GlowLight (it places and colours a light, but
// draws nothing by itself), and a fixed pool of real lights is handed, every frame, to the glow
// lights nearest the camera. The count of real lights never changes, so nothing is rebuilt.
import * as THREE from 'three';

const glows = new Set(); // WeakRefs: a glow light thrown away with its campfire is forgotten
const v = new THREE.Vector3();

// Made and used like a THREE.PointLight: new GlowLight(color, intensity, distance, decay)
export class GlowLight extends THREE.Object3D {
  constructor(color = 0xffffff, intensity = 1, distance = 0, decay = 2) {
    super();
    this.isGlowLight = true;
    this.type = 'GlowLight';
    this.color = new THREE.Color(color);
    this.intensity = intensity;
    this.distance = distance;
    this.decay = decay;
    this.castShadow = false;
    glows.add(new WeakRef(this));
  }
  copy(source, recursive) {
    super.copy(source, recursive);
    this.color.copy(source.color);
    this.intensity = source.intensity;
    this.distance = source.distance;
    this.decay = source.decay;
    return this;
  }
  dispose() {}
}

// the glow light is in `scene` and nothing above it is hidden
function shown(o, scene) {
  for (let p = o; p; p = p.parent) {
    if (!p.visible) return false;
    if (p === scene) return true;
  }
  return false;
}

// `count` real lights, added to the scene, that follow the nearest glow lights. pool.setSize(n)
// changes how many there are (only when the graphics setting changes: that one change rebuilds the
// shaders once).
export function lightPool(scene, camera, count = 8) {
  const lights = [], slots = [];
  const grow = (n) => {
    while (lights.length < n) {
      const l = new THREE.PointLight(0xffffff, 0, 1, 2);
      l.matrixAutoUpdate = false;
      scene.add(l);
      lights.push(l);
      slots.push({ src: null, fade: 0 });
    }
    while (lights.length > n) { scene.remove(lights.pop()); slots.pop(); }
  };
  grow(count);
  let last = 0;
  const wanted = [];
  const pick = [];
  scene.onBeforeRender = () => {
    // (the scene's positions are up to date here: three.js has just updated them for this frame)
    const now = performance.now();
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    const cam = camera.getWorldPosition(v);
    wanted.length = 0;
    for (const ref of glows) {
      const g = ref.deref();
      if (!g) { glows.delete(ref); continue; }
      if (g.intensity <= 0 || !shown(g, scene)) continue;
      const e = g.matrixWorld.elements;
      const d = Math.hypot(e[12] - cam.x, e[13] - cam.y, e[14] - cam.z);
      const reach = g.distance > 0 ? g.distance : 60;
      if (d > reach + 80) continue; // too far to light anything you can make out
      wanted.push({ g, score: d - reach * 0.5 });
    }
    wanted.sort((a, b) => a.score - b.score);
    if (wanted.length > lights.length) wanted.length = lights.length;
    pick.length = 0;
    for (const w of wanted) pick.push(w.g);
    // a light keeps its slot while it's still among the nearest, so lights don't jump about; one
    // that drops out fades away and a new one fades in
    const count = lights.length;
    for (let i = 0; i < count; i++) {
      const s = slots[i];
      if (s.src && (!pick.includes(s.src) || !s.src.parent)) s.leaving = true;
      else if (s.src) { s.leaving = false; pick.splice(pick.indexOf(s.src), 1); }
    }
    for (let i = 0; i < count && pick.length; i++) {
      const s = slots[i];
      if (!s.src) { s.src = pick.shift(); s.fade = 0; s.leaving = false; }
    }
    for (let i = 0; i < count; i++) {
      const s = slots[i], l = lights[i];
      if (!s.src) { l.intensity = 0; continue; }
      s.fade = s.leaving ? s.fade - dt * 5 : Math.min(1, s.fade + dt * 4);
      if (s.fade <= 0) { s.src = null; l.intensity = 0; continue; }
      const g = s.src, e = g.matrixWorld.elements;
      l.color.copy(g.color);
      l.intensity = g.intensity * s.fade;
      l.distance = g.distance;
      l.decay = g.decay;
      l.matrixWorld.makeTranslation(e[12], e[13], e[14]);
    }
  };
  return {
    lights,
    setSize(n) { grow(Math.max(1, n)); },
  };
}
