// Town houses in the style of the old towns in fantasy stories: a stone footing, plastered walls
// held in dark timber frames, upper floors that jut out over the street, steep tiled roofs with
// dormers, gables and chimneys, shuttered windows with flower boxes, and a little tiled roof over
// the door. Each house is built from a seed, so the houses in a row all differ a little but a
// house always looks the same. The front faces +z; the middle of the ground floor is (0, 0, 0).
import * as THREE from 'three';

// ---------- textures, drawn in code ----------

function rng(seed) {
  let s = (typeof seed === 'number' ? seed : [...String(seed)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const grey = (v, a = 1) => `rgba(${v},${v},${v},${a})`;
let TEX = null;
function textures() {
  if (TEX) return TEX;
  const R = rng(11);
  TEX = {
    // clay roof tiles in rows, each row overlapping the one below (light, so a colour tints them)
    tiles: canvasTex(256, (g, S) => {
      g.fillStyle = grey(70); g.fillRect(0, 0, S, S);
      const rows = 8, cols = 8, th = S / rows, tw = S / cols;
      for (let r = rows - 1; r >= 0; r--) {
        for (let c = -1; c <= cols; c++) {
          const x = c * tw + (r % 2) * tw / 2, y = r * th;
          const v = 200 + Math.floor(R() * 50);
          const gr = g.createLinearGradient(0, y, 0, y + th);
          gr.addColorStop(0, grey(v - 70)); gr.addColorStop(0.18, grey(v)); gr.addColorStop(1, grey(v - 25));
          g.fillStyle = gr;
          g.beginPath();
          g.moveTo(x + 1.5, y + th + 2);
          g.lineTo(x + 1.5, y + 5);
          g.quadraticCurveTo(x + tw / 2, y - 3, x + tw - 1.5, y + 5);
          g.lineTo(x + tw - 1.5, y + th + 2);
          g.closePath(); g.fill();
          g.fillStyle = grey(255, 0.12); g.fillRect(x + tw * 0.3, y + 5, tw * 0.18, th - 6); // the shine down a curved tile
        }
      }
    }),
    // smooth lime plaster with soft stains
    plaster: canvasTex(256, (g, S) => {
      g.fillStyle = grey(242); g.fillRect(0, 0, S, S);
      for (let i = 0; i < 40; i++) {
        const x = R() * S, y = R() * S, r = 10 + R() * 40;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, grey(R() < 0.5 ? 200 : 255, 0.18)); gr.addColorStop(1, grey(220, 0));
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      for (let i = 0; i < 5000; i++) { g.fillStyle = grey(R() < 0.5 ? 150 : 255, 0.08); g.fillRect(R() * S, R() * S, 1.5, 1.5); }
    }),
    // cut stone blocks in courses
    stone: canvasTex(256, (g, S) => {
      g.fillStyle = grey(120); g.fillRect(0, 0, S, S);
      const ch = S / 6;
      for (let r = 0; r < 6; r++) {
        let x = -R() * 40;
        while (x < S) {
          const bw = 38 + R() * 46, v = 185 + Math.floor(R() * 55);
          g.fillStyle = grey(v); g.fillRect(x + 2, r * ch + 2, bw - 4, ch - 4);
          g.fillStyle = grey(255, 0.15); g.fillRect(x + 2, r * ch + 2, bw - 4, 3);
          g.fillStyle = grey(0, 0.15); g.fillRect(x + 2, r * ch + ch - 5, bw - 4, 3);
          for (let k = 0; k < 30; k++) { g.fillStyle = grey(R() < 0.5 ? 90 : 255, 0.12); g.fillRect(x + 2 + R() * (bw - 4), r * ch + 2 + R() * (ch - 4), 2, 2); }
          x += bw;
        }
      }
    }),
    // cobbles, set in sand
    cobble: canvasTex(256, (g, S) => {
      g.fillStyle = grey(150); g.fillRect(0, 0, S, S);
      const n = 10, c = S / n;
      for (let r = 0; r < n; r++) for (let k = -1; k <= n; k++) {
        const x = (k + (r % 2) * 0.5) * c + (R() - 0.5) * 3, y = r * c + (R() - 0.5) * 3, v = 195 + Math.floor(R() * 45);
        const gr = g.createRadialGradient(x + c * 0.4, y + c * 0.35, 1, x + c / 2, y + c / 2, c * 0.6);
        gr.addColorStop(0, grey(Math.min(255, v + 15))); gr.addColorStop(1, grey(v - 25));
        g.fillStyle = gr;
        g.beginPath(); g.ellipse(x + c / 2, y + c / 2, c * 0.45, c * 0.42, R() * 3, 0, Math.PI * 2); g.fill();
      }
    }),
    // planks with grain, for doors and shutters
    wood: canvasTex(128, (g, S) => {
      const pw = S / 4;
      for (let p = 0; p < 4; p++) {
        const v = 170 + Math.floor(R() * 50);
        g.fillStyle = grey(v); g.fillRect(p * pw, 0, pw, S);
        for (let k = 0; k < 14; k++) { g.strokeStyle = grey(v - 40 - R() * 40, 0.5); g.lineWidth = 1; g.beginPath(); const x = p * pw + R() * pw; g.moveTo(x, 0); g.bezierCurveTo(x + 3, S / 3, x - 3, S * 2 / 3, x + R() * 2, S); g.stroke(); }
        g.fillStyle = grey(40, 0.8); g.fillRect(p * pw, 0, 2, S);
      }
    }),
  };
  return TEX;
}

// ---------- materials (shared, so a whole city merges into a few meshes) ----------

const MATS = new Map();
function mat(kind, color) {
  const k = `${kind}|${color}`;
  if (MATS.has(k)) return MATS.get(k);
  const T = textures();
  let m;
  if (kind === 'glass') m = new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.1, emissive: '#f0b060', emissiveIntensity: 0.06 });
  else if (kind === 'plain') m = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  else m = new THREE.MeshStandardMaterial({ color, map: T[kind], roughness: kind === 'tiles' ? 0.7 : 0.92 });
  MATS.set(k, m);
  return m;
}

// UVs from position, so a texture keeps its real size on any box (one repeat every `size` metres)
function project(geo, size) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); } else if (ax >= az) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u / size; uv[i * 2 + 1] = v / size;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
const TEX_SIZE = { tiles: 2, plaster: 3, stone: 2.2, wood: 1.2, cobble: 1.6 };
function sizeFor(m) { for (const [k, s] of Object.entries(TEX_SIZE)) if (m.map === TEX?.[k]) return s; return 1; }
// a box of w × h × d with its middle at (x, y, z), added to `g`
// small parts (window frames, braces, rails) are marked as detail: the city stops drawing them far away
let DETAIL = false;
const detail = (f) => { const was = DETAIL; DETAIL = true; f(); DETAIL = was; };
function box(g, w, h, d, m, x, y, z, rot = null) {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (m.map) project(geo, sizeFor(m));
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  if (rot) mesh.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  if (DETAIL) mesh.userData.detail = true;
  g.add(mesh);
  return mesh;
}
// a flat triangle (a gable end) in the x-y plane, facing +z
function triangle(g, half, rise, m) {
  const geo = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, rise)]));
  if (m.map) project(geo, sizeFor(m));
  const mesh = new THREE.Mesh(geo, m);
  g.add(mesh);
  return mesh;
}

// ---------- parts ----------

// A pitched roof whose ridge runs along x for `len` metres over walls `span` deep (z), sitting on
// y = 0. `ends` lists which gable ends (-1 west, 1 east) get a wall. Returns the ridge's height.
function gableRoof(g, len, span, pitch, o) {
  const { eave = 0.55, over = 0.3, ends = [-1, 1], roofM, wallM, timberM, attic = true } = o;
  const t = Math.tan(pitch);
  const ridge = (span / 2) * t;
  const D = span / 2 + eave, L = D / Math.cos(pitch);
  for (const s of [1, -1]) {
    const side = new THREE.Group();
    side.rotation.y = s > 0 ? 0 : Math.PI;
    g.add(side);
    const slab = box(side, len + over * 2, 0.16, L, roofM, 0, ridge - (D / 2) * t + 0.1, D / 2, [pitch]);
    // dark boards along the gable edges and the eave
    for (const e of [-1, 1]) box(slab, 0.1, 0.34, L, timberM, e * (len / 2 + over), -0.06, 0);
    box(slab, len + over * 2 + 0.1, 0.26, 0.1, timberM, 0, -0.08, L / 2);
  }
  // the ridge cap
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, len + over * 2 + 0.1, 8), roofM);
  project(cap.geometry, 1);
  cap.rotation.z = Math.PI / 2;
  cap.position.y = ridge + 0.2;
  g.add(cap);
  // the gable ends: plaster in a timber frame, with a small attic window
  for (const e of ends) {
    const end = new THREE.Group();
    end.position.x = e * len / 2;
    end.rotation.y = e * Math.PI / 2;
    g.add(end);
    triangle(end, span / 2, ridge, wallM);
    box(end, span, 0.22, 0.12, timberM, 0, 0.11, 0.04);
    box(end, 0.2, ridge - 0.2, 0.12, timberM, 0, ridge / 2, 0.04);
    for (const k of [-1, 1]) {
      const len2 = Math.hypot(span / 4, ridge * 0.5);
      box(end, 0.16, len2, 0.1, timberM, k * span / 8, ridge * 0.25 + 0.1, 0.05, [0, 0, k * Math.atan2(span / 4, ridge * 0.5)]);
    }
    if (attic && ridge > 1.6) {
      box(end, 0.8, 0.8, 0.1, timberM, 0, ridge * 0.42, 0.05);
      box(end, 0.6, 0.6, 0.1, mat('glass', '#2c3644'), 0, ridge * 0.42, 0.08);
    }
  }
  return ridge;
}

// A window on a wall facing +z at (x, y) (its middle), with a frame, cross bars, a sill and,
// if wanted, open shutters and a box of flowers
function windowAt(g, x, y, ww, wh, o) {
  const { glassM } = o;
  box(g, ww, wh, 0.06, glassM, x, y, 0.01);
  detail(() => windowParts(g, x, y, ww, wh, o));
}
function windowParts(g, x, y, ww, wh, o) {
  const { frameM, shutterM = null, flowers = null, arch = false } = o;
  const f = 0.11;
  box(g, ww + f * 2, f, 0.14, frameM, x, y + wh / 2 + f / 2, 0.05);
  box(g, ww + f * 2, f, 0.14, frameM, x, y - wh / 2 - f / 2, 0.05);
  box(g, f, wh, 0.14, frameM, x - ww / 2 - f / 2, y, 0.05);
  box(g, f, wh, 0.14, frameM, x + ww / 2 + f / 2, y, 0.05);
  box(g, 0.06, wh, 0.1, frameM, x, y, 0.05);
  box(g, ww, 0.06, 0.1, frameM, x, y + wh * 0.18, 0.05);
  box(g, ww + 0.4, 0.09, 0.3, frameM, x, y - wh / 2 - f - 0.04, 0.12); // the sill
  if (arch) box(g, ww + 0.5, 0.22, 0.18, frameM, x, y + wh / 2 + 0.2, 0.06); // a heavy lintel
  if (shutterM) {
    for (const s of [-1, 1]) {
      const sx = x + s * (ww / 2 + f + ww / 4 + 0.02);
      box(g, ww / 2, wh + f, 0.06, shutterM, sx, y, 0.05);
      box(g, ww / 2 - 0.06, 0.07, 0.04, frameM, sx, y + wh * 0.3, 0.1);
      box(g, ww / 2 - 0.06, 0.07, 0.04, frameM, sx, y - wh * 0.3, 0.1);
    }
  }
  if (flowers) {
    const by = y - wh / 2 - f - 0.25;
    box(g, ww + 0.3, 0.3, 0.32, o.boxM, x, by, 0.24);
    const leaf = mat('plain', '#3f6a2a');
    const bloom = mat('plain', flowers);
    for (let i = 0; i < 6; i++) {
      const fx = x - ww / 2 + (i + 0.5) * (ww / 6);
      const lf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), leaf);
      lf.position.set(fx, by + 0.2, 0.24 + ((i % 2) - 0.5) * 0.08);
      lf.userData.detail = true;
      g.add(lf);
      const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), bloom);
      fl.position.set(fx + 0.04, by + 0.3, 0.3 - (i % 2) * 0.06);
      fl.userData.detail = true;
      g.add(fl);
    }
  }
}

// a face of the house: a group whose x runs along the wall and +z looks out of it
function faceOf(g, x, z, rotY) { const f = new THREE.Group(); f.position.set(x, 0, z); f.rotation.y = rotY; g.add(f); return f; }

const SHUTTERS = ['#3f6a4a', '#3a5a7a', '#7a3a2e', '#5a4a3a', '#2f4f5f', '#6a5a2a'];
const FLOWERS = ['#d8344a', '#e86aa0', '#f2c440', '#f08a30', '#b05ad0', '#ffffff'];
const DOORS = ['#6a4026', '#4a2e1c', '#3a4a5a', '#5a2a22', '#3f5a3a'];

// Build a house: w wide (x), d deep (z), `floors` storeys. `wall` and `roof` are colours.
// Returns the group, with userData.door (the hinge the door swings on) and userData.height.
export function buildHouse({ w, d, floors = 2, wall = '#efe6d2', roof = '#b5532e', seed = 1, label = null, labelTex = null, doorX = null, over = 0.3, pitch = null }) {
  const R = rng(seed);
  const g = new THREE.Group();
  const timberM = mat('plain', '#3b281a');
  const stoneM = mat('stone', '#c9c2b4');
  const footM = mat('stone', '#a49c8e');
  const plasterM = mat('plaster', wall);
  const roofM = mat('tiles', roof);
  const glassM = mat('glass', '#2c3644');
  const frameM = R() < 0.5 ? timberM : mat('plain', '#e8e0d0');
  const shutterM = mat('wood', SHUTTERS[Math.floor(R() * SHUTTERS.length)]);
  const boxM = mat('wood', '#6a4a30');
  const flowers = FLOWERS[Math.floor(R() * FLOWERS.length)];
  const FH = 3.1, PL = 0.5;
  const stoneGround = floors > 1 && R() < 0.45;
  const jetty = floors > 1 ? 0.4 : 0;
  const pitchA = pitch ?? 0.82 + R() * 0.22;

  // the stone footing, and the ground floor
  box(g, w + 0.24, PL, d + 0.24, footM, 0, PL / 2, 0);
  box(g, w, FH, d, stoneGround ? stoneM : plasterM, 0, PL + FH / 2, 0);
  if (!stoneGround) {
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, 0.24, FH, 0.24, timberM, cx * (w / 2 - 0.1), PL + FH / 2, cz * (d / 2 - 0.1));
    for (const s of [-1, 1]) box(g, w + 0.04, 0.2, 0.08, timberM, 0, PL + 0.1, s * (d / 2 + 0.02)); // the sill beam
  }

  // the upper floors, jutting out front and back over carved brackets
  const dU = d + jetty * 2;
  for (let f = 1; f < floors; f++) {
    const y = PL + FH * f;
    box(g, w + 0.12, 0.3, dU + 0.12, timberM, 0, y + 0.15, 0);
    box(g, w, FH - 0.3, dU, plasterM, 0, y + 0.3 + (FH - 0.3) / 2, 0);
    if (f === 1) {
      const n = Math.max(2, Math.round(w / 1.4));
      for (let i = 0; i <= n; i++) {
        const bx = -w / 2 + 0.15 + (i * (w - 0.3)) / n;
        detail(() => { for (const s of [-1, 1]) box(g, 0.16, 0.5, jetty + 0.05, timberM, bx, y - 0.2, s * (d / 2 + jetty / 2), [s * -0.5]); });
      }
    }
  }
  const top = PL + FH * floors;
  const dTop = floors > 1 ? dU : d;

  // each face of each floor: timber framing between the windows
  const doorAt = doorX ?? (w >= 8 && R() < 0.5 ? 0 : (R() < 0.5 ? -1 : 1) * (w / 2 - 1.5));
  for (let f = 0; f < floors; f++) {
    const y0 = PL + FH * f + (f ? 0.3 : 0), h = FH - (f ? 0.3 : 0);
    const dd = f ? dU : d;
    const timbered = f > 0 || !stoneGround;
    for (const [fx, fz, rot, fw, front] of [[0, dd / 2, 0, w, true], [0, -dd / 2, Math.PI, w, false], [w / 2, 0, Math.PI / 2, dd, false], [-w / 2, 0, -Math.PI / 2, dd, false]]) {
      const F = faceOf(g, fx, fz, rot);
      const side = Math.abs(rot) === Math.PI / 2;
      const bays = side ? Math.max(1, Math.round(fw / 3.2)) : Math.max(1, Math.round(fw / 2.2));
      const bw = fw / bays;
      if (timbered) {
        box(F, fw, 0.16, 0.08, timberM, 0, y0 + h - 0.08, 0.03);
        box(F, fw, 0.14, 0.08, timberM, 0, y0 + 0.95, 0.03);
        for (let i = 0; i <= bays; i++) box(F, 0.18, h, 0.08, timberM, -fw / 2 + i * bw, y0 + h / 2, 0.03);
      }
      for (let i = 0; i < bays; i++) {
        const bx = -fw / 2 + (i + 0.5) * bw;
        const isDoor = f === 0 && front && Math.abs(bx - doorAt) < bw / 2;
        if (isDoor) continue;
        if (side) {
          // the sides: a narrow window on upper floors, crossed braces below
          if (f > 0 && timbered && (i + f) % 2 === 0) windowAt(F, bx, y0 + 1.75, 0.7, 1.05, { frameM, glassM });
          else if (timbered) {
            const bh = 0.95 - 0.1, bl = Math.hypot(bw - 0.2, bh);
            detail(() => box(F, 0.12, bl, 0.07, timberM, bx, y0 + 0.5, 0.035, [0, 0, Math.atan2(bw - 0.2, bh)]));
          }
          continue;
        }
        if (timbered) {
          // the braces under the windows, as in old timber houses
          for (const k of [-1, 1]) detail(() => box(F, 0.11, Math.hypot(bw / 2 - 0.1, 0.85), 0.06, timberM, bx + k * bw / 4, y0 + 0.5, 0.035, [0, 0, k * Math.atan2(bw / 2 - 0.1, 0.85)]));
        }
        const ww = Math.min(1.15, bw - 0.9), wh = f ? 1.35 : 1.25;
        windowAt(F, bx, y0 + 1.75, ww, wh, { frameM: stoneGround && !f ? stoneM : frameM, glassM, shutterM: front && bw > 1.9 ? shutterM : null, flowers: front && f > 0 && R() < 0.6 ? flowers : null, boxM, arch: stoneGround && !f });
      }
    }
  }

  // the front door: a frame, a lintel, two stone steps and a little tiled roof on brackets
  const F = faceOf(g, 0, d / 2, 0);
  const dw = 1.3, dh = 2.3;
  box(F, dw + 0.3, 0.22, 0.16, timberM, doorAt, PL + dh + 0.11, 0.07);
  for (const s of [-1, 1]) box(F, 0.15, dh, 0.16, timberM, doorAt + s * (dw / 2 + 0.075), PL + dh / 2, 0.07);
  box(F, dw, dh, 0.02, mat('plain', '#140e08'), doorAt, PL + dh / 2, 0.005);
  box(F, 1.9, 0.25, 0.5, footM, doorAt, 0.125, 0.25 + 0.12 + 0.5);
  box(F, 1.9, 0.5, 0.5, footM, doorAt, 0.25, 0.25 + 0.12);
  const canopy = new THREE.Group();
  canopy.position.set(doorAt, PL + dh + 0.55, 0);
  F.add(canopy);
  box(canopy, dw + 1, 0.12, 1.15, roofM, 0, 0, 0.55, [0.42]);
  for (const s of [-1, 1]) box(canopy, 0.1, 0.9, 0.1, timberM, s * (dw / 2 + 0.3), -0.35, 0.35, [0.75]);
  const hinge = new THREE.Group();
  hinge.position.set(doorAt - dw / 2, PL, d / 2 + 0.05);
  const leaf = new THREE.Mesh(project(new THREE.BoxGeometry(dw, dh, 0.1), 1.2), mat('wood', DOORS[Math.floor(R() * DOORS.length)]));
  leaf.position.set(dw / 2, dh / 2, 0);
  leaf.userData.moves = true;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), mat('plain', '#c8a040'));
  knob.position.set(dw / 2 - 0.15, 0, 0.07);
  leaf.add(knob);
  hinge.add(leaf);
  g.add(hinge);
  g.userData.door = hinge;

  // a balcony on some houses, over the street
  if (floors > 1 && w >= 7 && R() < 0.35) {
    const bwid = Math.min(w - 1.5, 4.6), y = PL + FH + 0.3, z = dU / 2;
    box(g, bwid, 0.14, 1.1, timberM, 0, y - 0.07, z + 0.55);
    const rail = mat('plain', '#4a3020');
    DETAIL = true;
    box(g, bwid, 0.08, 0.08, rail, 0, y + 1, z + 1.06);
    for (const s of [-1, 1]) box(g, 0.08, 0.08, 1.1, rail, s * bwid / 2, y + 1, z + 0.55);
    for (let i = 0; i <= Math.round(bwid / 0.28); i++) box(g, 0.05, 1, 0.05, rail, -bwid / 2 + i * (bwid / Math.round(bwid / 0.28)), y + 0.5, z + 1.06);
    for (const s of [-1, 1]) box(g, 0.12, 0.9, 0.12, timberM, s * (bwid / 2 - 0.2), y - 0.45, z + 0.5, [-0.7]);
    DETAIL = false;
  }

  // the roof: the main gable along the street, a gable to the front or dormers, and a chimney
  const roofG = new THREE.Group();
  roofG.position.y = top;
  g.add(roofG);
  const ridge = gableRoof(roofG, w, dTop, pitchA, { over, roofM, wallM: plasterM, timberM });
  const cross = w >= 7.5 && R() < 0.5;
  if (cross) {
    // a front gable, as on the grander houses
    const cw = Math.min(w * 0.46, 4.2), len = dTop / 2;
    const cg = new THREE.Group();
    cg.position.set((R() < 0.5 ? 0 : (R() < 0.5 ? -1 : 1) * (w / 2 - cw / 2 - 0.4)), top, dTop / 2 - len / 2);
    cg.rotation.y = Math.PI / 2;
    roofG.parent.add(cg);
    const cr = gableRoof(cg, len, cw, pitchA + 0.08, { over: 0.25, eave: 0.4, ends: [-1], roofM, wallM: plasterM, timberM, attic: false });
    // a window in the gable, with a little balcony rail
    const gf = faceOf(g, cg.position.x, dTop / 2, 0);
    windowAt(gf, 0, top + Math.min(cr * 0.38, 1.2) + 0.2, Math.min(cw * 0.32, 1), Math.min(cr * 0.5, 1.3), { frameM, glassM, arch: true });
  } else if (ridge > 2) {
    // dormers poking out of the front slope
    const n = w >= 8 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const dx = n === 1 ? 0 : (i ? 1 : -1) * w / 4.5;
      const zf = dTop / 2 - 0.9, ys = top + 0.9 * Math.tan(pitchA);
      const dg = new THREE.Group();
      dg.position.set(dx, 0, 0);
      g.add(dg);
      box(dg, 1.5, 1.5, 2.2, plasterM, 0, ys + 0.6, zf - 1.1);
      for (const s of [-1, 1]) box(dg, 0.12, 1.5, 0.12, timberM, s * 0.72, ys + 0.6, zf);
      const dw2 = new THREE.Group();
      dw2.position.set(0, 0, zf);
      dg.add(dw2);
      windowAt(dw2, 0, ys + 0.65, 0.75, 0.85, { frameM, glassM });
      const dr = new THREE.Group();
      dr.position.set(0, ys + 1.35, zf - 1.1);
      dr.rotation.y = Math.PI / 2;
      dg.add(dr);
      gableRoof(dr, 2.3, 1.5, pitchA + 0.1, { over: 0.15, eave: 0.25, ends: [-1], roofM, wallM: plasterM, timberM, attic: false });
    }
  }
  if (R() < 0.85) {
    const cx = (R() < 0.5 ? -1 : 1) * (w / 2 - 0.9), cz = -dTop / 4 + (R() - 0.5);
    const ch = ridge + 1.1;
    box(g, 0.85, ch + 1, 0.85, stoneM, cx, top - 0.5 + (ch + 1) / 2, cz);
    box(g, 1.05, 0.18, 1.05, footM, cx, top + ch + 0.5, cz);
    for (const s of [-1, 1]) box(g, 0.14, 0.3, 0.14, footM, cx + s * 0.25, top + ch + 0.74, cz);
  }

  // a shop's name board over the door
  if (label || labelTex) {
    const bwid = Math.min(w - 1, 6);
    const sign = faceOf(g, 0, d / 2, 0);
    box(sign, bwid + 0.2, 0.95, 0.12, timberM, 0, PL + FH - 0.2, 0.12);
    const text = new THREE.Mesh(new THREE.PlaneGeometry(bwid, 0.8), new THREE.MeshBasicMaterial({ map: labelTex, transparent: true }));
    text.position.set(0, PL + FH - 0.2, 0.19);
    sign.add(text);
  }

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.height = top + ridge;
  return g;
}

// colours for the towns of the Heartland: warm plaster and clay or slate roofs
export const TOWN_TONES = [
  ['#f1e8d4', '#b5532e'], ['#ece0c4', '#a8452a'], ['#f4eee2', '#4d6280'], ['#e6d6b4', '#8a4a2a'],
  ['#efe4cc', '#c2683a'], ['#e9e2d6', '#5a4a40'], ['#f3e3c2', '#9a3e28'], ['#e4dccb', '#3f566e'],
];

// a flat paved street or square of w × d (x, z), lying on y = 0, in cobbles of this colour
export function paved(w, d, color, round = false) {
  const geo = round ? new THREE.CircleGeometry(w, 64) : new THREE.PlaneGeometry(w, d);
  geo.rotateX(-Math.PI / 2);
  project(geo, TEX_SIZE.cobble);
  const m = new THREE.Mesh(geo, mat('cobble', color));
  m.receiveShadow = true;
  return m;
}

// A square stone tower with an open belfry and a steep pointed roof, its foot at (0, 0, 0)
export function buildTower({ size = 3.6, height = 16, wall = '#d8ccb0', roof = '#5a2a24' }) {
  const g = new THREE.Group();
  const stoneM = mat('stone', wall), roofM = mat('tiles', roof), timberM = mat('plain', '#3b281a');
  box(g, size + 0.4, 0.8, size + 0.4, mat('stone', '#a49c8e'), 0, 0.4, 0);
  box(g, size, height - 3, size, stoneM, 0, (height - 3) / 2, 0);
  // the belfry: four corner piers with the bell hanging between them
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, 0.6, 2.6, 0.6, stoneM, x * (size / 2 - 0.3), height - 1.7, z * (size / 2 - 0.3));
  box(g, size + 0.3, 0.35, size + 0.3, stoneM, 0, height - 0.25, 0);
  box(g, size + 0.2, 0.25, size + 0.2, stoneM, 0, height - 3, 0);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.7, 1, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#b08a3a', metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide }));
  bell.position.y = height - 1.4;
  g.add(bell);
  box(g, size - 0.4, 0.18, 0.18, timberM, 0, height - 0.75, 0);
  // slit windows down the shaft
  for (let y = 3; y < height - 4; y += 3.2) for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const f = faceOf(g, Math.sin(r) * size / 2, Math.cos(r) * size / 2, r);
    box(f, 0.32, 1.1, 0.06, mat('plain', '#1a140e'), 0, y, 0.01);
  }
  const spire = new THREE.Mesh(new THREE.ConeGeometry(size * 0.8, size * 2.2, 4, 1), roofM);
  project(spire.geometry, 2);
  spire.rotation.y = Math.PI / 4;
  spire.position.y = height + size * 1.1 - 0.1;
  g.add(spire);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 5), mat('plain', '#c8a040'));
  tip.position.y = height + size * 2.2 + 0.5;
  g.add(tip);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
