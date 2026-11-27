// Drawing the wonders of the realm (see data/wonders.mjs): one great sight in every land.
// Each is built when you come within a few kilometres (they are big enough to see from far off),
// merged into a few meshes, with solid circles round its base so you can't walk through it.
import * as THREE from 'three';
import { heightAt } from '../data/world-layout.mjs';
import { mergeStill } from './merge.js';
import { GlowLight } from './lightpool.js';

const M = new Map();
const mat = (color, r = 0.85, m = 0) => { const k = `${color}${r}${m}`; if (!M.has(k)) M.set(k, new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m, flatShading: true })); return M.get(k); };
const glow = (color, k = 1.6, opacity = 1) => { const key = `g${color}${k}${opacity}`; if (!M.has(key)) M.set(key, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.4, transparent: opacity < 1, opacity })); return M.get(key); };

// a little random that is the same every time for the same wonder
const rng = (seed) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };

export function buildWonder(w) {
  const g = new THREE.Group();
  const solid = [];
  // the ground under it: the lowest of a few points round it, so it never floats
  let base = Infinity;
  for (let i = 0; i < 9; i++) { const a = (i / 8) * Math.PI * 2, r = i ? w.r * 0.6 : 0; base = Math.min(base, heightAt(w.x + Math.cos(a) * r, w.z + Math.sin(a) * r)); }
  const R = rng(w.id.length * 7919 + w.x);
  const put = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  const hard = (x, z, r, h = 200, y = 0) => { if (r <= 5) { solid.push({ x: w.x + x, z: w.z + z, r, kind: 'rock', y: base + y - 2, height: h }); return; } const n = Math.ceil((Math.PI * 2 * r) / 3); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; solid.push({ x: w.x + x + Math.cos(a) * (r - 1.8), z: w.z + z + Math.sin(a) * (r - 1.8), r: 1.8, kind: 'rock', y: base + y - 2, height: h }); } };
  const light = (x, y, z, c, p, d) => { const l = new GlowLight(c, p, d, 1.3); l.position.set(x, y, z); g.add(l); };

  switch (w.look) {
    case 'tree': { // the Elder Tree: a vast trunk with roots like walls, and a crown of glowing leaves
      const bark = mat('#5a4430', 0.95), leaf = mat('#3f7a34', 0.9), shine = glow('#c8ffb0', 0.9);
      put(new THREE.CylinderGeometry(9, 16, 80, 14), bark, 0, 38, 0);
      put(new THREE.CylinderGeometry(5, 9, 40, 12), bark, 0, 96, 0);
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + R() * 0.3; put(new THREE.CylinderGeometry(1.2, 3.8, 30, 7), bark, Math.cos(a) * 20, 3, Math.sin(a) * 20, 0, -a, Math.PI / 2 - 0.25).rotation.order = 'YXZ'; hard(Math.cos(a) * 22, Math.sin(a) * 22, 3.5, 10); }
      hard(0, 0, 16);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; put(new THREE.CylinderGeometry(1.5, 3, 40, 7), bark, Math.cos(a) * 16, 92, Math.sin(a) * 16, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); }
      for (let i = 0; i < 22; i++) {
        const a = R() * Math.PI * 2, d = 10 + R() * 34, y = 95 + R() * 40;
        put(new THREE.IcosahedronGeometry(14 + R() * 10, 1), leaf, Math.cos(a) * d, y, Math.sin(a) * d, R(), R(), R(), 1, 0.7, 1);
      }
      for (let i = 0; i < 40; i++) { const a = R() * Math.PI * 2, d = 14 + R() * 40; put(new THREE.SphereGeometry(1.2, 6, 4), shine, Math.cos(a) * d, 84 + R() * 30, Math.sin(a) * d); }
      light(0, 60, 0, '#b8ffa0', 120, 160);
      break;
    }
    case 'bones': { // the first dragon's bones: a spine 150 m long, arching ribs, a horned skull
      const bone = mat('#e8dcc2', 0.75), ash = mat('#3a3434', 1);
      put(new THREE.CylinderGeometry(70, 80, 3, 20), ash, 0, -0.5, 0);
      const L = 150;
      for (let i = 0; i < 40; i++) {
        const t = i / 39, z = -L / 2 + t * L, y = 6 + Math.sin(t * Math.PI) * 14 - (t > 0.8 ? (t - 0.8) * 40 : 0);
        put(new THREE.DodecahedronGeometry(3.6 - t * 1.8, 0), bone, Math.sin(t * 5) * 4, Math.max(1, y), z);
        if (t > 0.15 && t < 0.6 && i % 2 === 0) for (const s of [-1, 1]) put(new THREE.TorusGeometry(20 - Math.abs(t - 0.37) * 40, 1.5, 6, 12, Math.PI * 0.85), bone, Math.sin(t * 5) * 4, Math.max(1, y) - 12, z, 0, s > 0 ? 0 : Math.PI, s * 0.2);
      }
      hard(0, -L / 2 - 4, 5, 16);
      const sx = 4, sz = -L / 2 - 10;
      put(new THREE.SphereGeometry(9, 12, 8), bone, sx, 7, sz, 0, 0, 0, 1, 0.75, 1.7);
      put(new THREE.BoxGeometry(10, 3, 18), bone, sx, 2, sz - 8, 0.15);
      for (const s of [-1, 1]) {
        put(new THREE.ConeGeometry(2, 22, 8), bone, sx + s * 6, 16, sz + 8, -0.9, 0, -s * 0.4);
        put(new THREE.SphereGeometry(1.6, 8, 6), glow('#ff6020', 1.8), sx + s * 4, 9, sz - 6);
        // the wing bones, spread on the ash
        for (let k = 0; k < 4; k++) put(new THREE.CylinderGeometry(0.7, 1, 40 + k * 6, 6), bone, s * (25 + k * 4), 1, -20 + k * 8, Math.PI / 2, 0, s * (1.1 + k * 0.25));
      }
      light(sx, 10, sz, '#ff6a20', 60, 60);
      break;
    }
    case 'skull': { // the Titan's Skull: a mountain of rock in the shape of a skull, green fire in its eyes
      const rock = mat('#9a6a4a', 1), dark = mat('#3a2a20', 1), eye = glow('#7aff40', 2.2);
      put(new THREE.SphereGeometry(32, 16, 12), rock, 0, 30, 0, 0, 0, 0, 1, 0.95, 1.1);
      put(new THREE.BoxGeometry(40, 18, 30), rock, 0, 6, 16);
      for (const s of [-1, 1]) {
        put(new THREE.SphereGeometry(8, 10, 8), dark, s * 12, 34, 28, 0, 0, 0, 1, 1, 0.5);
        put(new THREE.SphereGeometry(4, 10, 8), eye, s * 12, 34, 30);
        light(s * 12, 34, 36, '#7aff40', 90, 90);
      }
      put(new THREE.ConeGeometry(5, 10, 3), dark, 0, 22, 33, Math.PI, 0, 0);
      for (let i = -3; i <= 3; i++) put(new THREE.BoxGeometry(3.4, 7, 3), mat('#e0d0b0', 0.9), i * 4.6, 12, 31);
      for (let i = 0; i < 16; i++) { const a = R() * Math.PI * 2, d = 40 + R() * 30; put(new THREE.DodecahedronGeometry(3 + R() * 6, 0), rock, Math.cos(a) * d, 1, Math.sin(a) * d, R(), R(), R()); }
      hard(0, 0, 34); hard(0, 18, 20, 30);
      break;
    }
    case 'isle': { // the Moonwell Isle: a rock floating in the air, a tree of light on it and a waterfall of light
      const rock = mat('#6a6478', 1), grass = mat('#5a9a5a', 0.9), fall = glow('#b8d8ff', 1.4, 0.55), star = glow('#f4eaff', 2.4);
      const Y = 70;
      put(new THREE.ConeGeometry(36, 60, 9), rock, 0, Y - 30, 0, Math.PI, 0, 0);
      put(new THREE.CylinderGeometry(36, 36, 4, 9), grass, 0, Y + 2, 0);
      put(new THREE.CylinderGeometry(1.6, 2.6, 22, 8), mat('#e8e0f0', 0.7), 0, Y + 15, 0);
      put(new THREE.IcosahedronGeometry(10, 1), glow('#d8b0ff', 0.8), 0, Y + 30, 0);
      put(new THREE.BoxGeometry(8, Y + 4, 2), fall, 30, Y / 2, 12, 0, 0.4, 0);
      put(new THREE.CylinderGeometry(14, 14, 1, 16), glow('#b8d8ff', 1, 0.5), 33, 1, 16);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; put(new THREE.OctahedronGeometry(3, 0), star, Math.cos(a) * 46, Y + 8 + Math.sin(i) * 6, Math.sin(a) * 46, 0, 0, 0, 0.6, 1.8, 0.6); }
      light(0, Y + 30, 0, '#d0a8ff', 120, 150);
      break;
    }
    case 'colossus': { // the Sunken Colossus: a giant stone king's head and hand above the swamp
      const stone = mat('#7a8a76', 1), moss = mat('#4a6a3a', 1), gold = mat('#c8a040', 0.4, 0.6);
      put(new THREE.SphereGeometry(22, 14, 12), stone, 0, 16, 0, 0.15, 0.3, 0.1, 1, 1.15, 1);
      put(new THREE.BoxGeometry(22, 10, 16), stone, 0, 0, 14, 0.15, 0.3, 0.1);
      put(new THREE.CylinderGeometry(20, 24, 12, 10), gold, 0, 40, 0, 0.15, 0.3, 0.1); // the crown
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; put(new THREE.ConeGeometry(3, 10, 6), gold, Math.cos(a) * 20, 50, Math.sin(a) * 20, 0.15, 0, 0.1); }
      for (const s of [-1, 1]) put(new THREE.SphereGeometry(3, 8, 6), glow('#c8ff6a', 1.6), s * 8 + 4, 22, 19);
      put(new THREE.SphereGeometry(30, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), moss, 0, -6, 0, 0, 0, 0, 1, 0.3, 1);
      // the hand, reaching up out of the water a little way off
      const hx = 50, hz = 22;
      put(new THREE.BoxGeometry(14, 30, 10), stone, hx, 10, hz, 0, 0.5, 0.2);
      for (let i = 0; i < 4; i++) put(new THREE.CylinderGeometry(1.8, 2.2, 16, 7), stone, hx - 6 + i * 4, 30, hz, 0, 0.5, -0.3 + i * 0.2);
      put(new THREE.CylinderGeometry(2, 2.4, 12, 7), stone, hx + 9, 20, hz - 2, 0, 0.5, -0.9);
      hard(0, 0, 22); hard(hx, hz, 8);
      light(4, 24, 26, '#c8ff6a', 60, 60);
      break;
    }
    case 'ice': { // the Frozen Heart: towers of glowing ice round a heart of blue light
      const ice = glow('#9ad8ff', 0.45, 0.85), deep = glow('#3a9aff', 1.2), snow = mat('#f2f6fa', 0.9);
      put(new THREE.CylinderGeometry(55, 60, 3, 18), snow, 0, -0.5, 0);
      put(new THREE.OctahedronGeometry(10, 0), deep, 0, 20, 0, 0, 0, 0, 1, 1.6, 1);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + R() * 0.3, d = i < 5 ? 14 : 22 + R() * 20, h = i < 5 ? 70 + R() * 30 : 25 + R() * 30;
        put(new THREE.CylinderGeometry(0, 6 + R() * 4, h, 6), ice, Math.cos(a) * d, h / 2 - 2, Math.sin(a) * d, (R() - 0.5) * 0.4, R(), (R() - 0.5) * 0.4);
        hard(Math.cos(a) * d, Math.sin(a) * d, 5);
      }
      light(0, 22, 0, '#60b8ff', 120, 120);
      break;
    }
    case 'pyramid': { // the Sun Pyramid: a great stepped pyramid with a golden cap, and obelisks round it
      const sand = mat('#d8b878', 1), gold = mat('#f0c040', 0.3, 0.8);
      for (let i = 0; i < 9; i++) { const s = 130 - i * 14; put(new THREE.BoxGeometry(s, 10, s), sand, 0, 5 + i * 10, 0); }
      put(new THREE.ConeGeometry(8, 12, 4), gold, 0, 96, 0, 0, Math.PI / 4, 0);
      put(new THREE.BoxGeometry(14, 18, 4), mat('#6a5030', 1), 0, 9, 65);
      put(new THREE.SphereGeometry(2, 10, 8), glow('#ffd060', 2.2), 0, 104, 0);
      for (const [x, z] of [[-90, 90], [90, 90], [-90, -90], [90, -90]]) { put(new THREE.CylinderGeometry(1.5, 3.5, 34, 4), sand, x, 17, z, 0, Math.PI / 4, 0); put(new THREE.ConeGeometry(1.6, 4, 4), gold, x, 36, z, 0, Math.PI / 4, 0); hard(x, z, 3.5, 40); }
      for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; hard(Math.cos(a) * 58, Math.sin(a) * 58, 5, 100); }
      light(0, 100, 0, '#ffd070', 120, 140);
      break;
    }
  }
  mergeStill(g);
  g.position.set(w.x, base, w.z);
  return { group: g, solid };
}
