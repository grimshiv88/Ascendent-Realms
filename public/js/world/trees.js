// Real trees, grown branch by branch: a trunk that splits into limbs, limbs into branches,
// branches into twigs, and real leaves on the twigs (sprigs of leaves, needles or hanging willow
// strands, cut out of one shared picture). Every tree sways in the wind: the trunk bends a little,
// the branches more, and every leaf flutters on its own; gusts come and go, and each tree catches
// them at its own moment, so a forest moves like one.
// Each kind is one geometry (bark and leaves together, one material) drawn many times at once.
import * as THREE from 'three';

// ---------- the wind (shared by every tree and the grass) ----------
export const WIND = { uTime: { value: 0 }, uWind: { value: 1 }, uWindDir: { value: new THREE.Vector2(0.8, 0.6).normalize() } };
// called every frame with the clock's time; the wind rises and falls by itself over a few minutes
export function tickWind(t) {
  WIND.uTime.value = t;
  WIND.uWind.value = 0.75 + 0.35 * Math.sin(t * 0.021) + 0.2 * Math.sin(t * 0.057 + 1.3);
  const a = 0.65 + 0.35 * Math.sin(t * 0.004);
  WIND.uWindDir.value.set(Math.cos(a), Math.sin(a));
}
// Teach a material to sway: aSway (metres the vertex moves in a full gust) and aFlutter (1 on
// leaves) come with the geometry; the wind is turned into each tree's own frame (trees are turned
// and scaled at random), so the whole forest leans the same way
export function windy(mat) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, WIND);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aSway;
attribute float aFlutter;
uniform float uTime;
uniform float uWind;
uniform vec2 uWindDir;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
#ifdef USE_INSTANCING
  vec3 ip = instanceMatrix[3].xyz; mat3 im = mat3(instanceMatrix);
#else
  vec3 ip = vec3(0.0); mat3 im = mat3(1.0);
#endif
  float ph = dot(ip.xz, vec2(0.071, 0.053));
  // a gust rolls across the land in the wind's direction, so neighbours lean one after another
  float roll = dot(ip.xz, uWindDir) * 0.045;
  float gust = 0.55 + 0.45 * sin(uTime * 0.6 - roll) * sin(uTime * 0.23 - roll * 0.7 + ph);
  float s2 = max(dot(im[0], im[0]), 1e-4);
  vec3 wd = transpose(im) * vec3(uWindDir.x, 0.0, uWindDir.y) / s2;
  float sway = aSway * uWind;
  transformed += wd * sway * (gust + 0.22 * sin(uTime * 1.9 + ph * 5.0 + position.y * 0.25));
  // (the side-to-side rocking a tree does across the wind)
  transformed += vec3(-wd.z, 0.0, wd.x) * sway * 0.25 * sin(uTime * 1.3 + ph * 3.0);
  transformed.y -= sway * gust * 0.08 * aFlutter;
  float fl = aFlutter * uWind * (0.35 + gust);
  transformed += fl * 0.045 * vec3(sin(uTime * 7.1 + position.x * 3.7 + ph * 9.0), 0.7 * sin(uTime * 9.3 + position.z * 4.1), cos(uTime * 6.3 + position.y * 3.3 + ph * 7.0));
}`);
  };
  // (a leaf seen from behind is lit like its front: otherwise half of every crown turns black)
  const fs = THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', '');
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => { prev(sh, r); sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', fs); };
  mat.customProgramCacheKey = () => 'windy';
  return mat;
}

// ---------- the picture: bark on the left half, four kinds of leaves on the right ----------
// (drawn once, light grey and white, and coloured per tree by its vertex colours)
const LEAF_UV = { broad: [0.5, 0], willow: [0.75, 0], needle: [0.5, 0.5], round: [0.75, 0.5] }; // (the picture is flipped: its top is v = 1)
let atlas = null;
export function treeAtlas() {
  if (atlas) return atlas;
  const W = 1024, H = 512, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const r = rng(11);
  // bark: grey ridges running up the trunk, with furrows and a little moss
  g.fillStyle = '#a8a39c'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) {
    const x = r() * 512, w = 3 + r() * 10, y = r() * 512, h = 40 + r() * 160;
    g.fillStyle = `rgba(${40 + r() * 30},${36 + r() * 26},${30 + r() * 20},${0.25 + r() * 0.4})`;
    g.beginPath(); g.ellipse(x, y, w * 0.5, h * 0.5, (r() - 0.5) * 0.08, 0, Math.PI * 2); g.fill();
    for (const dy of [0, 512, -512]) { g.beginPath(); g.ellipse(x, y + dy, w * 0.5, h * 0.5, 0, 0, Math.PI * 2); g.fill(); } // (tiles up and down)
  }
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(235,230,220,${r() * 0.18})`; g.fillRect(r() * 512, r() * 512, 1 + r() * 3, 4 + r() * 18); }
  // leaves: a sprig in each quarter of the right half (each 256 x 256)
  const sprig = (ox, oy, draw) => { g.save(); g.translate(ox, oy); draw(); g.restore(); };
  const leaf = (x, y, ang, len, wid, tone) => {
    g.save(); g.translate(x, y); g.rotate(ang);
    const grd = g.createLinearGradient(-wid, 0, wid, 0);
    grd.addColorStop(0, `hsl(80,25%,${tone - 10}%)`); grd.addColorStop(0.5, `hsl(80,20%,${tone + 6}%)`); grd.addColorStop(1, `hsl(80,25%,${tone - 6}%)`);
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(wid, -len * 0.25, wid * 0.8, -len * 0.75, 0, -len); g.bezierCurveTo(-wid * 0.8, -len * 0.75, -wid, -len * 0.25, 0, 0); g.fill();
    g.strokeStyle = `hsla(80,20%,${tone - 22}%,0.55)`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -len * 0.95); g.stroke();
    for (let k = 1; k < 5; k++) { g.lineWidth = 0.6; g.beginPath(); g.moveTo(0, -len * k / 5.5); g.lineTo(wid * 0.6, -len * (k / 5.5 + 0.1)); g.moveTo(0, -len * k / 5.5); g.lineTo(-wid * 0.6, -len * (k / 5.5 + 0.1)); g.stroke(); }
    g.restore();
  };
  const stem = (pts, w) => { g.strokeStyle = '#6b5a48'; g.lineWidth = w; g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.stroke(); };
  // broad leaves (oak, bush, sapling): a forked twig with about a dozen leaves
  sprig(512, 256, () => {
    stem([[128, 252], [124, 160], [128, 60]], 4); stem([[124, 170], [70, 100]], 3); stem([[126, 140], [190, 80]], 3);
    const L = [[128, 60, 0], [70, 100, -0.5], [190, 80, 0.55]];
    for (const [x, y, a] of L) for (let k = 0; k < 4; k++) { const t = k / 4; leaf(x + Math.sin(a) * -40 * t, y + Math.cos(a) * 40 * t, a + (k % 2 ? 0.9 : -0.9) * (k ? 1 : 0), 52 - k * 4, 19, 74 + r() * 12); }
    for (let k = 0; k < 6; k++) leaf(126 + (k % 2 ? 6 : -6), 230 - k * 28, (k % 2 ? 1.1 : -1.1), 46, 17, 72 + r() * 12);
  });
  // willow: long drooping strands of narrow leaves
  sprig(768, 256, () => {
    for (const x of [70, 128, 186]) {
      stem([[x, 0], [x + 6, 120], [x - 4, 250]], 2.5);
      for (let k = 0; k < 14; k++) leaf(x + (k % 2 ? 4 : -4), 12 + k * 17, Math.PI + (k % 2 ? 0.45 : -0.45), 34, 7, 74 + r() * 12);
    }
  });
  // needles (pines): a flat spray of fine needles on both sides of each twig
  sprig(512, 0, () => {
    const twig = (x0, y0, x1, y1) => {
      stem([[x0, y0], [x1, y1]], 3);
      const n = 34;
      for (let k = 0; k < n; k++) {
        const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, a = Math.atan2(y1 - y0, x1 - x0);
        for (const s of [-1, 1]) {
          g.strokeStyle = `hsl(110,18%,${66 + r() * 16}%)`; g.lineWidth = 2;
          const b = a + s * (0.9 + r() * 0.3) - 0.35 * s * t, l = 26 * (1 - t * 0.5);
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(b) * l, y + Math.sin(b) * l); g.stroke();
        }
      }
    };
    twig(128, 252, 128, 8); twig(128, 180, 40, 80); twig(128, 140, 216, 50);
  });
  // round leaves (the glowing fae trees): soft rounded leaves in clusters
  sprig(768, 0, () => {
    stem([[128, 252], [128, 40]], 3);
    for (let k = 0; k < 16; k++) { const a = r() * Math.PI * 2, d = 20 + r() * 80; leaf(128 + Math.cos(a) * d * 0.8, 150 - Math.sin(a) * d, (r() - 0.5) * 2.4, 40, 22, 80 + r() * 10); }
  });
  const tex = new THREE.CanvasTexture(c);
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  atlas = tex;
  return tex;
}
// the tree material (bark and leaves in one; the leaves' outlines are cut out by alpha) and its
// shadow, which cuts out the same leaves and sways the same way
export function treeMaterials(opts = {}) {
  const map = treeAtlas();
  const mat = windy(new THREE.MeshStandardMaterial({ map, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, ...opts }));
  const depth = windy(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.45, side: THREE.DoubleSide }));
  return { mat, depth };
}

// ---------- how many leaves (from the graphics quality) ----------
// 1 draws every leaf; less draws fewer, bigger sprigs, so a crown stays as full but cheaper to draw
let leafDetail = 1;
export function setLeafDetail(d) { leafDetail = Math.max(0.3, Math.min(1, d)); }
export const getLeafDetail = () => leafDetail;
// the lighter build for trees further off: the thin twigs (hidden in the leaves from there) are left
// out, the bark is less round and there are fewer, bigger sprigs
let lite = false;
export function grownLite(fn) { lite = true; try { return fn(); } finally { lite = false; } }

// ---------- growing a tree ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

class Builder {
  constructor() { this.p = []; this.n = []; this.c = []; this.uv = []; this.fl = []; this.col = new THREE.Color(); }
  vert(p, n, u, v, color, flutter) { this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.uv.push(u, v); this.c.push(color.r, color.g, color.b); this.fl.push(flutter); }
  // a tapering bark tube along points, radius r0 to r1, `sides` round
  tube(pts, r0, r1, sides, color) {
    if (lite) {
      if ((typeof r0 === 'function' ? r0(0) : r0) < 0.09) return;
      sides = Math.max(3, Math.ceil(sides / 2));
      if (pts.length > 3) pts = pts.filter((p, i) => i % 2 === 0 || i === pts.length - 1);
    }
    const N = pts.length, rings = [];
    let t = pts[1].clone().sub(pts[0]).normalize();
    let nrm = Math.abs(t.y) < 0.9 ? V(0, 1, 0).cross(t).normalize() : V(1, 0, 0).cross(t).normalize();
    let len = 0;
    for (let i = 0; i < N; i++) {
      if (i) len += pts[i].distanceTo(pts[i - 1]);
      const ti = pts[Math.min(N - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
      nrm = nrm.clone().sub(ti.clone().multiplyScalar(nrm.dot(ti))).normalize(); // (carried along without twisting)
      const bin = ti.clone().cross(nrm);
      const r = typeof r0 === 'function' ? r0(i / (N - 1)) : r0 + (r1 - r0) * (i / (N - 1));
      rings.push({ c: pts[i], nrm: nrm.clone(), bin, r, v: len / (Math.PI * 2 * Math.max(0.05, r0 === r1 ? r0 : (typeof r0 === 'function' ? r0(0) : r0))) * 0.5 });
    }
    const col = new THREE.Color(color);
    const at = (ring, k) => { const a = (k / sides) * Math.PI * 2, d = ring.nrm.clone().multiplyScalar(Math.cos(a)).add(ring.bin.clone().multiplyScalar(Math.sin(a))); return [ring.c.clone().add(d.clone().multiplyScalar(ring.r)), d]; };
    for (let i = 0; i < N - 1; i++) for (let k = 0; k < sides; k++) {
      const A = rings[i], B = rings[i + 1];
      const [p00, n00] = at(A, k), [p01, n01] = at(A, k + 1), [p10, n10] = at(B, k), [p11, n11] = at(B, k + 1);
      const u0 = 0.01 + 0.48 * (k / sides), u1 = 0.01 + 0.48 * ((k + 1) / sides);
      this.vert(p00, n00, u0, A.v, col, 0); this.vert(p10, n10, u0, B.v, col, 0); this.vert(p11, n11, u1, B.v, col, 0);
      this.vert(p00, n00, u0, A.v, col, 0); this.vert(p11, n11, u1, B.v, col, 0); this.vert(p01, n01, u1, A.v, col, 0);
    }
  }
  // one leaf card: a sprig of leaves (from `kind`'s quarter of the picture) w wide, h long, its
  // stem at `base` pointing along `up`, lit as if it faced `light` (so a crown looks round, not flat)
  card(base, up, side, w, h, kind, color, light) {
    this.k = (this.k || 0) + 1;
    const detail = lite ? Math.max(0.22, leafDetail * 0.4) : leafDetail;
    if (detail < 1) { if ((this.k * 0.6180339887) % 1 > detail) return; const g = 1 / Math.sqrt(detail) * 0.9 + 0.1; w *= g; h *= g; }
    const [u0, v0] = LEAF_UV[kind], U = up.clone().normalize(), S = side.clone().sub(U.clone().multiplyScalar(side.dot(U))).normalize();
    const a = base.clone().add(S.clone().multiplyScalar(-w / 2)), b = base.clone().add(S.clone().multiplyScalar(w / 2));
    const c = b.clone().add(U.clone().multiplyScalar(h)), d = a.clone().add(U.clone().multiplyScalar(h));
    const n = light.clone().normalize();
    const e = 0.004;
    const uv = [[u0 + e, v0 + e], [u0 + 0.25 - e, v0 + e], [u0 + 0.25 - e, v0 + 0.5 - e], [u0 + e, v0 + 0.5 - e]];
    const P = [a, b, c, d];
    for (const i of [0, 1, 2, 0, 2, 3]) this.vert(P[i], n, uv[i][0], uv[i][1], color, 1);
  }
  // finish: how far each part may sway — nothing at the root, more up the trunk, most at the tips
  // of the branches (by height and by distance out from the trunk)
  geometry(height, spread, bend = 0.035) {
    const g = new THREE.BufferGeometry(), n = this.p.length / 3, sway = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const y = this.p[i * 3 + 1], r = Math.hypot(this.p[i * 3], this.p[i * 3 + 2]);
      const h = Math.max(0, y) / height, o = Math.min(1.5, r / Math.max(0.5, spread));
      sway[i] = (h * h * 0.7 + o * o * 0.45 * Math.min(1, h * 2) + this.fl[i] * 0.15) * height * bend;
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aFlutter', new THREE.Float32BufferAttribute(this.fl, 1));
    g.setAttribute('aSway', new THREE.BufferAttribute(sway, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// turn direction d by angle `a` away from itself, toward azimuth `az` round it
function tilt(d, a, az) {
  const D = d.clone().normalize();
  const p = Math.abs(D.y) < 0.95 ? V(0, 1, 0).cross(D).normalize() : V(1, 0, 0).cross(D).normalize();
  const q = D.clone().cross(p);
  const off = p.multiplyScalar(Math.cos(az)).add(q.multiplyScalar(Math.sin(az)));
  return D.multiplyScalar(Math.cos(a)).add(off.multiplyScalar(Math.sin(a))).normalize();
}
// a bending path from `from` along `dir`, len long, curving toward the sky by `up` (negative:
// drooping) and wandering by `wob`
function path(from, dir, len, segs, up, wob, r) {
  const pts = [from.clone()];
  let d = dir.clone().normalize(), p = from.clone();
  for (let i = 0; i < segs; i++) {
    d = d.add(V(0, up / segs, 0)).add(V((r() - 0.5) * wob, (r() - 0.5) * wob * 0.5, (r() - 0.5) * wob)).normalize();
    p = p.clone().add(d.clone().multiplyScalar(len / segs));
    pts.push(p);
  }
  return pts;
}
const along = (pts, t) => {
  const f = t * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f));
  return { p: pts[i].clone().lerp(pts[i + 1], f - i), d: pts[i + 1].clone().sub(pts[i]).normalize() };
};

// A branching tree from a plan: per level how many children, how long (fraction of the parent),
// at what angle, how thick, how many sides, how much it bends, and where the leaves go
function grow(B, plan, r, crown) {
  const leafy = (pts, lv, tint) => {
    const L = plan.leaves; if (!L || lv < L.from) return;
    const n = L.per[lv - L.from] ?? L.per[L.per.length - 1];
    for (let k = 0; k < n; k++) {
      const t = L.start + (1 - L.start) * (n > 1 ? k / (n - 1) : 1) * (0.85 + r() * 0.15);
      const { p, d } = along(pts, Math.min(1, t));
      const out = p.clone().sub(crown).setY(0).normalize();
      let up;
      if (L.hang) up = V(0, -1, 0).add(V((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3));
      else up = tilt(d.clone().lerp(V(0, L.lift ?? 0.5, 0), 0.4), 0.3 + r() * 1.0, r() * Math.PI * 2);
      const side = V(r() - 0.5, (r() - 0.5) * (L.flat ? 0.1 : 1), r() - 0.5);
      const light = p.clone().sub(crown).normalize().lerp(V(0, 1, 0), 0.35);
      const s = L.size * (0.75 + r() * 0.5);
      const col = B.col.set(L.color).offsetHSL((r() - 0.5) * 0.04, (r() - 0.5) * 0.1, (r() - 0.5) * 0.12 + (p.y - crown.y) * 0.004);
      if (L.snow && r() < L.snow) col.lerp(new THREE.Color('#f2f5f8'), 0.75);
      B.card(p, up, side.lengthSq() < 1e-4 ? out : side, s * (L.wide ?? 1), s * (L.long ?? 1), L.kind, col.clone(), light);
    }
  };
  const level = (from, dir, len, rad, lv) => {
    const P = plan.levels[lv];
    const pts = path(from, dir, len, P.segs, P.up, P.wob, r);
    B.tube(pts, rad, rad * P.taper, P.sides, plan.bark);
    leafy(pts, lv);
    const next = plan.levels[lv + 1];
    if (!next) return;
    const n = Math.round(P.kids[0] + r() * (P.kids[1] - P.kids[0]));
    for (let k = 0; k < n; k++) {
      const t = P.at[0] + (P.at[1] - P.at[0]) * (n > 1 ? k / (n - 1) : 0.5) + (r() - 0.5) * 0.06;
      const { p, d } = along(pts, Math.min(0.98, t));
      const az = k * 2.39996 + r() * 0.8;
      const dd = tilt(d, P.angle[0] + r() * (P.angle[1] - P.angle[0]), az);
      level(p, dd, len * next.len * (1 - t * (P.shorten ?? 0.3)) * (0.8 + r() * 0.4), Math.max(0.012, rad * (1 - t * (1 - P.taper)) * next.thick), lv + 1);
    }
  };
  level(V(0, 0, 0), plan.lean ?? V(0, 1, 0), plan.height, plan.radius, 0);
}

// ---------- the kinds ----------
const BARK = '#a08468';
export function oakTree(seed = 1) {
  const B = new Builder(), r = rng(seed);
  // a short thick bole that flares at the foot, then splits into spreading limbs
  grow(B, {
    bark: BARK, height: 4.4, radius: 0.62, lean: V(0.04, 1, 0.02),
    levels: [
      { segs: 6, up: 0.1, wob: 0.12, taper: 0.62, sides: 10, kids: [4, 5], at: [0.62, 0.95], angle: [0.55, 0.95], shorten: 0 },
      { len: 1.05, thick: 0.62, segs: 5, up: 0.35, wob: 0.3, taper: 0.45, sides: 7, kids: [3, 4], at: [0.3, 0.95], angle: [0.5, 0.9] },
      { len: 0.55, thick: 0.62, segs: 4, up: 0.25, wob: 0.4, taper: 0.4, sides: 5, kids: [2, 3], at: [0.35, 0.95], angle: [0.6, 1.0] },
      { len: 0.55, thick: 0.6, segs: 3, up: 0.2, wob: 0.5, taper: 0.4, sides: 4 },
    ],
    leaves: { from: 2, per: [6, 9], start: 0.25, size: 1.35, kind: 'broad', color: '#86b552' },
  }, r, V(0, 8, 0));
  // the flare of the roots at the foot
  for (let k = 0; k < 5; k++) { const a = k * 1.26 + r() * 0.4; B.tube([V(Math.cos(a) * 0.3, 0.9, Math.sin(a) * 0.3), V(Math.cos(a) * 0.8, 0.25, Math.sin(a) * 0.8), V(Math.cos(a) * 1.25, -0.15, Math.sin(a) * 1.25)], 0.28, 0.08, 6, BARK); }
  return B.geometry(10, 4);
}
export function pineTree(snowy = false, seed = 2) {
  const B = new Builder(), r = rng(seed), H = 15.5;
  const trunk = path(V(0, 0, 0), V(0.01, 1, 0), H, 10, 0, 0.02, r);
  B.tube(trunk, (t) => 0.42 * (1 - t) + 0.03 + (t < 0.05 ? (0.05 - t) * 4 : 0), 0, 9, '#957a64');
  // whorls of branches, long and drooping low down, short and lifting at the top
  for (let y = 2.2; y < H - 0.6; y += 0.68 + r() * 0.2) {
    const h = y / H, n = 6 + Math.round(r() * 2), L = 0.5 + 3.4 * Math.pow(1 - h, 1.1);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + y * 1.7 + r() * 0.5;
      const d = V(Math.cos(a), 0.12 + h * 0.4 - (1 - h) * 0.2, Math.sin(a));
      const pts = path(along(trunk, h).p, d, L, 3, -0.25 * (1 - h), 0.15, r);
      B.tube(pts, 0.035 + 0.07 * (1 - h), 0.012, 3, '#957a64');
      // needle sprays along the branch, lying flat and overlapping, with side shoots
      const per = 3 + Math.round(L * 2.3);
      for (let j = 0; j < per; j++) {
        const t = 0.15 + 0.85 * (j / per), q = along(pts, t);
        for (const s of [-1, 1, 0]) {
          const dir = s ? tilt(q.d, 0.8, s > 0 ? 0 : Math.PI).setY(q.d.y * 0.5 + 0.04) : q.d.clone();
          const side = V(0, 1, 0).cross(dir).normalize();
          const col = B.col.set('#74a062').offsetHSL((r() - 0.5) * 0.03, 0, (r() - 0.5) * 0.08 + h * 0.06);
          if (snowy && r() < 0.6) col.lerp(new THREE.Color('#eef2f5'), 0.7 + r() * 0.2);
          const light = q.p.clone().setY(0).normalize().lerp(V(0, 1, 0), 0.45);
          const flatUp = V(0, 0.18 + r() * 0.15, 0);
          const sz = (1.15 + r() * 0.45) * (0.65 + (1 - h) * 0.55);
          B.card(q.p.clone().add(flatUp.clone().multiplyScalar(0.3)), dir, side.add(V(0, 0.25 * (r() - 0.5), 0)), sz * 0.9, sz * 1.1, 'needle', col.clone(), light);
        }
      }
    }
  }
  // the leader at the very top
  for (let k = 0; k < 4; k++) { const a = k * 1.57; const col = B.col.set(snowy ? '#e8eef2' : '#7aa466'); B.card(V(0, H - 1.2, 0), V(Math.cos(a) * 0.3, 1, Math.sin(a) * 0.3), V(-Math.sin(a), 0, Math.cos(a)), 0.9, 1.6, 'needle', col.clone(), V(Math.cos(a), 0.6, Math.sin(a))); }
  return B.geometry(H, 3, 0.022);
}
export function youngTree(seed = 3) {
  const B = new Builder(), r = rng(seed);
  grow(B, {
    bark: '#a89078', height: 2.5, radius: 0.09, lean: V(0.05, 1, 0),
    levels: [
      { segs: 5, up: 0.1, wob: 0.15, taper: 0.3, sides: 6, kids: [5, 6], at: [0.35, 0.95], angle: [0.5, 0.9] },
      { len: 0.42, thick: 0.6, segs: 3, up: 0.3, wob: 0.4, taper: 0.4, sides: 4, kids: [1, 2], at: [0.5, 0.9], angle: [0.5, 0.8] },
      { len: 0.5, thick: 0.6, segs: 2, up: 0.2, wob: 0.5, taper: 0.4, sides: 3 },
    ],
    leaves: { from: 0, per: [4, 5, 4], start: 0.5, size: 0.62, kind: 'broad', color: '#8cba56' },
  }, r, V(0, 2.2, 0));
  return B.geometry(3.2, 1.2, 0.06);
}
export function greatTree(seed = 4) {
  const B = new Builder(), r = rng(seed), bark = '#937a64';
  // the vast trunk, 24 m, and seven buttress roots (where the ground blocks you: see scenery.js)
  const trunk = path(V(0, 0, 0), V(0, 1, 0), 25, 10, 0, 0.03, r);
  B.tube(trunk, (t) => 3.2 - 1.6 * t + (t < 0.1 ? (0.1 - t) * 10 : 0), 0, 18, bark);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    B.tube([V(Math.cos(a) * 1.5, 5, Math.sin(a) * 1.5), V(Math.cos(a) * 3, 2.2, Math.sin(a) * 3), V(Math.cos(a) * 4.4, 0.7, Math.sin(a) * 4.4), V(Math.cos(a) * 5.6, -0.3, Math.sin(a) * 5.6)], 1.25, 0.28, 8, bark);
  }
  // great limbs from the crown of the trunk, then branches and twigs
  B._mark = B.p.length;
  for (let k = 0; k < 7; k++) {
    const a = k * 2.39996 + r() * 0.3, y = 19 + r() * 6;
    grow(B, {
      bark, height: 10 + r() * 3, radius: 0.95,
      lean: V(Math.cos(a), 0.65 + r() * 0.3, Math.sin(a)),
      levels: [
        { segs: 6, up: 0.3, wob: 0.15, taper: 0.4, sides: 9, kids: [4, 5], at: [0.3, 0.95], angle: [0.5, 0.9] },
        { len: 0.5, thick: 0.6, segs: 4, up: 0.3, wob: 0.3, taper: 0.4, sides: 6, kids: [3, 4], at: [0.3, 0.95], angle: [0.6, 1.0] },
        { len: 0.5, thick: 0.6, segs: 3, up: 0.2, wob: 0.4, taper: 0.4, sides: 4 },
      ],
      leaves: { from: 1, per: [5, 9], start: 0.2, size: 2.6, kind: 'broad', color: '#74a54a' },
    }, r, V(-Math.cos(a) * 1.2, 32 - y, -Math.sin(a) * 1.2)); // (the crown's middle, seen from where this limb starts)
    // (grow() starts at the ground: lift this limb's vertices up onto the trunk)
    shiftFrom(B, V(Math.cos(a) * 1.2, y, Math.sin(a) * 1.2));
  }
  return B.geometry(40, 14, 0.012);
}
// move every vertex added since the last mark by `by` (to graft a grown limb onto a trunk)
function shiftFrom(B, by) {
  const start = B._mark ?? 0;
  for (let i = start; i < B.p.length; i += 3) { B.p[i] += by.x; B.p[i + 1] += by.y; B.p[i + 2] += by.z; }
  B._mark = B.p.length;
}
export function swampTree(seed = 5) {
  const B = new Builder(), r = rng(seed), bark = '#857a64';
  // a fat, fluted trunk on stilt roots, arching limbs, and curtains of hanging leaves
  B.tube(path(V(0, 0, 0), V(0, 1, 0), 6.5, 6, 0, 0.1, r), (t) => 1.0 - 0.55 * t, 0, 12, bark);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + r() * 0.3; B.tube([V(Math.cos(a) * 0.6, 2.2, Math.sin(a) * 0.6), V(Math.cos(a) * 1.4, 1.0, Math.sin(a) * 1.4), V(Math.cos(a) * 2.0, -0.2, Math.sin(a) * 2.0)], 0.28, 0.1, 6, bark); }
  B._mark = B.p.length;
  for (let k = 0; k < 6; k++) {
    const a = k * 1.05 + r() * 0.4;
    grow(B, {
      bark, height: 4 + r() * 1.5, radius: 0.3, lean: V(Math.cos(a), 0.7, Math.sin(a)),
      levels: [
        { segs: 5, up: -0.5, wob: 0.2, taper: 0.4, sides: 6, kids: [3, 4], at: [0.3, 0.95], angle: [0.5, 0.9] },
        { len: 0.5, thick: 0.55, segs: 4, up: -0.6, wob: 0.3, taper: 0.4, sides: 4 },
      ],
      leaves: { from: 0, per: [6, 7], start: 0.3, size: 1.7, kind: 'willow', color: '#a2b86a', hang: true, wide: 0.75, long: 1.4 },
    }, r, V(0, 1.4, 0));
    shiftFrom(B, V(0, 5.6, 0));
  }
  return B.geometry(9, 5, 0.03);
}
export function glowTree(seed = 6) {
  const B = new Builder(), r = rng(seed);
  grow(B, {
    bark: '#e4dece', height: 6.5, radius: 0.32, lean: V(0.08, 1, -0.04),
    levels: [
      { segs: 7, up: 0.05, wob: 0.18, taper: 0.4, sides: 8, kids: [4, 5], at: [0.5, 0.95], angle: [0.4, 0.8] },
      { len: 0.55, thick: 0.6, segs: 4, up: 0.4, wob: 0.3, taper: 0.4, sides: 5, kids: [3, 3], at: [0.35, 0.95], angle: [0.5, 0.9] },
      { len: 0.5, thick: 0.6, segs: 3, up: 0.3, wob: 0.4, taper: 0.4, sides: 4 },
    ],
    leaves: { from: 1, per: [4, 7], start: 0.3, size: 1.15, kind: 'round', color: '#7fe0c0' },
  }, r, V(0, 8.5, 0));
  return B.geometry(11, 3.5);
}
export function deadTree(seed = 7) {
  const B = new Builder(), r = rng(seed);
  grow(B, {
    bark: '#b8b0a2', height: 3.6, radius: 0.32, lean: V(0.08, 1, 0.05),
    levels: [
      { segs: 5, up: 0, wob: 0.2, taper: 0.5, sides: 7, kids: [3, 4], at: [0.55, 0.95], angle: [0.5, 1.0], shorten: 0 },
      { len: 0.75, thick: 0.6, segs: 4, up: 0.1, wob: 0.6, taper: 0.35, sides: 5, kids: [2, 3], at: [0.3, 0.9], angle: [0.6, 1.1] },
      { len: 0.5, thick: 0.6, segs: 3, up: 0, wob: 0.8, taper: 0.3, sides: 3 },
    ],
  }, r, V(0, 4, 0));
  return B.geometry(5.5, 2.5, 0.02);
}
export function berryBush(seed = 8) {
  const B = new Builder(), r = rng(seed);
  for (let k = 0; k < 6; k++) {
    const a = k * 1.05 + r() * 0.5;
    grow(B, {
      bark: '#9a826c', height: 0.9 + r() * 0.3, radius: 0.04, lean: V(Math.cos(a) * 0.6, 1, Math.sin(a) * 0.6),
      levels: [
        { segs: 3, up: 0.2, wob: 0.3, taper: 0.4, sides: 4, kids: [2, 3], at: [0.3, 0.9], angle: [0.6, 1.1] },
        { len: 0.55, thick: 0.6, segs: 2, up: 0.2, wob: 0.4, taper: 0.4, sides: 3 },
      ],
      leaves: { from: 0, per: [5, 4], start: 0.25, size: 0.55, kind: 'broad', color: '#7cab50' },
    }, r, V(0, 0.6, 0));
  }
  // the berries: little dark balls among the leaves
  const ball = new THREE.IcosahedronGeometry(0.055, 0), bp = ball.attributes.position, bn = ball.attributes.normal;
  const berry = new THREE.Color('#3a2a8a');
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = 0.25 + r() * 0.45, c = V(Math.cos(a) * d, 0.35 + r() * 0.6, Math.sin(a) * d);
    for (let j = 0; j < bp.count; j++) B.vert(V(bp.getX(j), bp.getY(j), bp.getZ(j)).add(c), V(bn.getX(j), bn.getY(j), bn.getZ(j)), 0.2, 0.5, berry, 0.6);
  }
  return B.geometry(1.4, 0.9, 0.05);
}
