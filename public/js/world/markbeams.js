// A pillar of light up to the sky over each place you marked on the world map (mapview.js), in the
// mark's colour, so you can see from far away where to go. It grows wider with distance so it never
// thins to nothing, and close by your mark's name floats over the spot. Only you see your own marks.
import * as THREE from 'three';
import { surfaceAt } from '../data/world-layout.mjs';

const HEIGHT = 900;      // metres: up into the clouds
const SEEN_TO = 30000;   // beams further away than this are not drawn
const NAME_TO = 250;     // the name shows within this distance

function nameSprite(text, colour) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.font = '700 46px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 9; g.strokeStyle = 'rgba(0, 0, 0, 0.85)'; g.strokeText(text, 256, 48);
  g.fillStyle = colour; g.fillText(text, 256, 48);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(8, 1.5, 1);
  return s;
}

// `hidden()`: true while you are indoors or underground, where the sky can't be seen
export function createMarkBeams(scene, hidden = () => false) {
  const root = new THREE.Group();
  root.name = 'mark-beams';
  scene.add(root);
  const shown = new Map(); // mark id -> { key, group, dispose }
  const geo = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true);
  geo.translate(0, 0.5, 0); // grows up from the ground

  function build(m) {
    const colour = new THREE.Color(m.colour || '#ffd23f');
    const group = new THREE.Group();
    const at = surfaceAt(m.x, m.z);
    group.position.set(m.x, (Number.isFinite(at) ? at : 0) - 2, m.z);
    const glow = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
    const core = new THREE.MeshBasicMaterial({ color: colour.clone().lerp(new THREE.Color('#ffffff'), 0.2), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
    const outer = new THREE.Mesh(geo, glow), inner = new THREE.Mesh(geo, core);
    outer.frustumCulled = inner.frustumCulled = false;
    const sprite = nameSprite(m.name || 'Marked place', `#${colour.getHexString()}`);
    sprite.position.y = 9;
    group.add(outer, inner, sprite);
    // every frame: wider the further you are (so it stays a few pixels wide), softly pulsing
    outer.onBeforeRender = (r, s, cam) => {
      const d = Math.hypot(cam.position.x - m.x, cam.position.z - m.z);
      const far = d > SEEN_TO || hidden();
      const t = performance.now() / 1000;
      const w = Math.max(0.9, d * 0.0035);
      outer.scale.set(w, HEIGHT, w);
      inner.scale.set(w * 0.35, HEIGHT, w * 0.35);
      // (faded out rather than hidden, so this keeps running and brings it back)
      glow.opacity = far ? 0 : 0.3 + Math.sin(t * 2) * 0.06;
      core.opacity = far ? 0 : 0.4 + Math.sin(t * 2 + 1) * 0.1;
      sprite.visible = !far && d < NAME_TO;
      sprite.position.y = 9 + Math.sin(t * 1.6) * 0.4;
    };
    return {
      group,
      dispose() { glow.dispose(); core.dispose(); sprite.material.map.dispose(); sprite.material.dispose(); },
    };
  }

  return {
    // the marks as they stand now: new ones get a beam, removed ones lose theirs
    set(list = []) {
      const want = new Map(list.map((m) => [m.id, m]));
      for (const [id, b] of shown) {
        const m = want.get(id);
        if (!m || b.key !== `${m.x},${m.z},${m.name},${m.colour}`) { root.remove(b.group); b.dispose(); shown.delete(id); }
      }
      for (const m of list) {
        if (shown.has(m.id) || !Number.isFinite(m.x) || !Number.isFinite(m.z)) continue;
        const b = build(m);
        b.key = `${m.x},${m.z},${m.name},${m.colour}`;
        root.add(b.group);
        shown.set(m.id, b);
      }
    },
  };
}
