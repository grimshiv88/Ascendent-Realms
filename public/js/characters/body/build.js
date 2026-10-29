// Makes a living body from a plan: three.js bones and skinned meshes from the sculpted data, with
// skin colours painted on (lips, nails, a little warmth on the cheeks, knees and knuckles).
// Sculpting is slow, so each plan is sculpted once and its meshes shared by every body like it.
import * as THREE from 'three';
import { humanoidPlan } from './humanoid.js';
import { sculpt } from './sculptor.js';
import { faceTextures } from './face.js';

const cache = new Map();

export function sculptedBody(opts = {}, quality = 'high', hair = 'short', outfit = null) {
  const key = JSON.stringify(opts) + '|' + quality + '|' + hair + '|' + JSON.stringify(outfit);
  if (!cache.has(key)) {
    const plan = humanoidPlan(opts);
    const data = sculpt(plan, quality, { hair, outfit });
    cache.set(key, { plan, data, geos: {} });
  }
  return cache.get(key);
}

// A new body: { root, bones: {name: Bone}, skeleton, meshes, plan }.
// skin: the skin colour. Bones start in the rest pose (arms hanging, fingers straight).
export function makeBody(opts = {}, { quality = 'high', skin = '#e9c6a8', lips = null, nails = null, face = {}, hair = 'short', hairColor = '#3a2a22', outfit = null } = {}) {
  const made = sculptedBody(opts, quality, hair, outfit);
  const { plan, data } = made;
  const k = opts.height ? opts.height / plan.top : 1;
  const root = new THREE.Group();
  const scaler = new THREE.Group();
  scaler.scale.setScalar(k);
  root.add(scaler);
  // bones in the sculpting pose, to bind the skin
  const bones = {};
  const list = plan.bones.map((b) => {
    const bone = new THREE.Bone();
    bone.name = b.name;
    bones[b.name] = bone;
    return bone;
  });
  const byName = Object.fromEntries(plan.bones.map((b) => [b.name, b]));
  plan.bones.forEach((b, i) => {
    const bone = list[i];
    if (b.parent) {
      const p = byName[b.parent];
      bone.position.set(b.pos[0] - p.pos[0], b.pos[1] - p.pos[1], b.pos[2] - p.pos[2]);
      bones[b.parent].add(bone);
    } else {
      bone.position.set(...b.pos);
      scaler.add(bone);
    }
    if (b.bind) bone.rotation.set(...b.bind);
  });
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(list);
  const mat = skinMaterial(skin);
  const meshes = {};
  const colours = paint(skin, lips, nails, data.hair ? hairColor : null, hairColor);
  for (const [name, part] of Object.entries(data.parts)) {
    const gk = name + skin + hairColor;
    let geo = made.geos[gk];
    if (!geo) {
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(part.positions, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(part.normals, 3));
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(part.skinIndex, 4));
      geo.setAttribute('skinWeight', new THREE.BufferAttribute(part.skinWeight, 4));
      geo.setAttribute('color', new THREE.BufferAttribute(colourPoints(part, colours, plan), 3));
      if (part.lines) { geo.setAttribute('lines', new THREE.BufferAttribute(part.lines, 4)); geo.setAttribute('lines2', new THREE.BufferAttribute(part.lines2, 4)); }
      geo.setIndex(new THREE.BufferAttribute(part.indices, 1));
      geo.computeBoundingSphere();
      made.geos[gk] = geo;
    }
    const mesh = new THREE.SkinnedMesh(geo, name === 'body' ? mat : part.lines ? mat.hand : mat.fine);
    mesh.name = name;
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scaler.add(mesh);
    mesh.updateMatrixWorld(true);
    mesh.bind(skeleton, mesh.matrixWorld);
    meshes[name] = mesh;
  }
  // clothes
  for (const [name, part] of Object.entries(data.clothes || {})) {
    const gk = 'cloth:' + name;
    if (!made.geos[gk]) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(part.positions, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(part.normals, 3));
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(part.skinIndex, 4));
      geo.setAttribute('skinWeight', new THREE.BufferAttribute(part.skinWeight, 4));
      geo.setIndex(new THREE.BufferAttribute(part.indices, 1));
      geo.computeBoundingSphere();
      made.geos[gk] = geo;
    }
    const mesh = new THREE.SkinnedMesh(made.geos[gk], clothMaterial(part.cloth, part.colour));
    mesh.name = name;
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scaler.add(mesh);
    mesh.updateMatrixWorld(true);
    mesh.bind(skeleton, mesh.matrixWorld);
    meshes[name] = mesh;
  }
  // the painted face
  const F = data.face;
  if (!made.geos.face) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(F.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(F.normals, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(F.uvs, 2));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(F.skinIndex, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(F.skinWeight, 4));
    geo.setIndex(new THREE.BufferAttribute(F.indices, 1));
    geo.computeBoundingSphere();
    made.geos.face = geo;
  }
  const tex = faceTextures(F.area, face);
  const faceMat = new THREE.MeshStandardMaterial({ map: tex.open, transparent: true, depthWrite: false, roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });
  const faceMesh = new THREE.SkinnedMesh(made.geos.face, faceMat);
  faceMesh.name = 'face';
  faceMesh.frustumCulled = false;
  faceMesh.renderOrder = 1;
  scaler.add(faceMesh);
  faceMesh.updateMatrixWorld(true);
  faceMesh.bind(skeleton, faceMesh.matrixWorld);
  meshes.face = faceMesh;
  const blink = (shut) => { faceMat.map = shut ? tex.shut : tex.open; };

  // hair
  if (data.hair) {
    const hk = 'hair' + hairColor;
    if (!made.geos[hk]) made.geos[hk] = hairGeometry(data.hair, hairColor, plan);
    const hairMesh = new THREE.SkinnedMesh(made.geos[hk], hairMaterial());
    hairMesh.name = 'hair';
    hairMesh.castShadow = true; hairMesh.receiveShadow = true;
    hairMesh.frustumCulled = false;
    scaler.add(hairMesh);
    hairMesh.updateMatrixWorld(true);
    hairMesh.bind(skeleton, hairMesh.matrixWorld);
    meshes.hair = hairMesh;
  }

  // now stand at rest: arms down, fingers straight
  for (const b of list) b.rotation.set(0, 0, 0);
  root.userData.height = plan.top * k;
  return { root, bones, skeleton, meshes, plan, scale: k, blink };
}

// Skin: soft, slightly glossy, warm where light passes through. The head and hands are drawn a
// hair in front of the body where they overlap it (their seams sit under the skin).
const skinMats = new Map();
function skinMaterial(hex) {
  if (skinMats.has(hex)) return skinMats.get(hex);
  const base = { color: '#ffffff', vertexColors: true, roughness: 0.58, metalness: 0 };
  const mat = new THREE.MeshStandardMaterial(base);
  mat.fine = new THREE.MeshStandardMaterial({ ...base, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  for (const m of [mat, mat.fine]) m.onBeforeCompile = wrapLight;
  mat.hand = new THREE.MeshStandardMaterial({ ...base, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  mat.hand.onBeforeCompile = (sh) => { wrapLight(sh); handSkin(sh); };
  mat.hand.customProgramCacheKey = () => 'hand-skin';
  skinMats.set(hex, mat);
  return mat;
}
// light that wraps a little round the edge of a shape, as it does through skin
function wrapLight(shader) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <lights_fragment_begin>',
    '#include <lights_fragment_begin>\n',
  ).replace(
    'vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;',
    'vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse * 1.12 + diffuseColor.rgb * vec3(0.11, 0.035, 0.02);',
  );
}

// The skin of the hands, drawn finely: creases across the fingers at each joint (crisp on the palm's
// side, loose wrinkles over the knuckles), the three big lines of the palm, and the ridges of the
// fingertips, fading out when too fine to see. (The lines' places come from sculptor.js handLines.)
function handSkin(sh) {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec4 lines;\nattribute vec4 lines2;\nvarying vec4 vLines;\nvarying vec4 vLines2;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLines = lines;\nvLines2 = lines2;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
varying vec4 vLines;
varying vec4 vLines2;
// a line of width w (in the units of d) where d is 0, smoothed over a pixel
float lineAt(float d, float w) { float f = fwidth(d) + 1e-6; return 1.0 - smoothstep(w * 0.5, w * 0.5 + f, abs(d)); }
// how much a pattern that repeats every p (in the units of d) can still be seen
float seen(float d, float p) { return 1.0 - smoothstep(p * 0.35, p * 0.8, fwidth(d)); }`)
    .replace('#include <color_fragment>', `#include <color_fragment>
{
  float x = vLines.x, palm = vLines.y, lat = vLines.z, pad = vLines.w;
  float finger = vLines2.x, u = vLines2.y, v = vLines2.z;
  float onPalm = smoothstep(0.05, 0.45, palm), onBack = smoothstep(0.05, 0.5, -palm);
  // (only where every corner of the triangle agrees it is on a finger, or on the palm)
  float onFinger = smoothstep(0.97, 1.0, finger), offFinger = 1.0 - smoothstep(0.0, 0.03, finger);
  float mark = 0.0;
  // across each joint: a deep crease and a fainter one beside it on the palm's side
  mark += onFinger * onPalm * max(lineAt(x, 0.0006), 0.55 * lineAt(abs(x) - 0.0012, 0.0004));
  // over the knuckles: two or three wrinkles, bowed round the joint and shorter at its sides
  float bow = abs(x) + 30.0 * lat * lat;
  float rings = lineAt(fract(bow / 0.0009 + 0.5) - 0.5, 0.3) * seen(bow, 0.0009);
  mark += onFinger * onBack * 0.5 * rings * (1.0 - smoothstep(0.0018, 0.003, abs(bow))) * (1.0 - smoothstep(0.0045, 0.0065, abs(lat)));
  // the fingertip's ridges: loops round the middle of the pad
  float r = length(vec2(pad, lat));
  float ridges = 0.5 + 0.5 * cos(r * 6.2832 / 0.00046);
  mark += onFinger * onPalm * 0.3 * smoothstep(0.5, 1.0, ridges) * seen(r, 0.00046) * (1.0 - smoothstep(0.006, 0.0085, r));
  // the palm: the heart line, the head line and the life line round the thumb's mound
  float heart = u - (0.8 + 0.07 * smoothstep(1.0, -0.6, v));
  float head = u - (0.71 - 0.16 * clamp((v + 1.0) / 1.6, 0.0, 1.0));
  float life = v - (-0.35 - 0.65 * sqrt(max(0.0, 1.0 - pow((0.72 - u) / 0.64, 2.0))));
  float palmLines = lineAt(heart, 0.012) * smoothstep(-0.7, -0.5, v) * (1.0 - smoothstep(0.85, 1.0, v));
  palmLines = max(palmLines, lineAt(head, 0.011) * (1.0 - smoothstep(0.45, 0.65, v)) * smoothstep(-1.0, -0.85, v));
  palmLines = max(palmLines, lineAt(life, 0.025) * smoothstep(0.06, 0.14, u) * (1.0 - smoothstep(0.66, 0.74, u)));
  mark += offFinger * onPalm * palmLines;
  mark = clamp(mark, 0.0, 1.0);
  diffuseColor.rgb *= 1.0 - mark * vec3(0.26, 0.32, 0.32);
}`);
}

function paint(skin, lips, nails, hair, furHex) {
  const s = new THREE.Color(skin);
  const hsl = {}; s.getHSL(hsl);
  return {
    skin: s,
    lips: lips ? new THREE.Color(lips) : s.clone().lerp(new THREE.Color('#c0605a'), 0.38),
    nail: nails ? new THREE.Color(nails) : s.clone().lerp(new THREE.Color('#f4d8d0'), 0.5),
    claw: new THREE.Color('#2a2420'),
    fur: new THREE.Color(furHex || '#5a4030'),
    tusk: new THREE.Color('#e8dfc8'),
    warm: s.clone().lerp(new THREE.Color('#e07868'), 0.22),
    pale: s.clone().lerp(new THREE.Color('#fff4ec'), 0.18),
    hair: hair ? new THREE.Color(hair).multiplyScalar(0.7) : null,
  };
}

// a colour for each point: lips and nails by the shape they belong to, then a few soft tints
function colourPoints(part, C, plan) {
  const n = part.positions.length / 3;
  const out = new Float32Array(n * 3);
  const head = plan.headO, hd = plan.hd;
  const c = new THREE.Color();
  for (let v = 0; v < n; v++) {
    const x = part.positions[v * 3], y = part.positions[v * 3 + 1], z = part.positions[v * 3 + 2];
    c.copy(C.skin);
    const t = part.tint[v];
    if (t === 1) c.copy(C.lips);
    else if (t === 2) c.copy(C.nail);
    else if (t === 3) c.copy(C.claw);
    else if (t === 4) {
      // fur: the hair's colour, lighter at the tips, with a fine streaking
      // (strands run downwards: the streaks change round the body, not along a strand)
      const a = Math.atan2(x, z - head[2]);
      const streak = 0.5 + 0.5 * Math.sin(a * 90 + Math.sin(y * 40) * 2) * Math.sin(a * 37 + 1.3);
      c.copy(C.fur).multiplyScalar(0.72 + 0.4 * streak);
    } else if (t === 5) c.copy(C.tusk);
    else {
      // cheeks
      for (const s of [-1, 1]) {
        const d = Math.hypot((x - s * 0.043 * hd) / 0.022, (y - head[1] - 0.04 * hd) / 0.014, (z - head[2] - 0.07 * hd) / 0.03);
        if (d < 1) c.lerp(C.warm, (1 - d) * 0.5);
      }
      // the tip of the nose and the ears
      const dn = Math.hypot(x / 0.01, (y - head[1] - 0.038 * hd) / 0.01, (z - head[2] - 0.1 * hd) / 0.012);
      if (dn < 1) c.lerp(C.warm, (1 - dn) * 0.35);
      if (Math.abs(x) > 0.07 * hd && Math.abs(y - head[1] - 0.06 * hd) < 0.05 && Math.abs(z - head[2]) < 0.05) c.lerp(C.warm, 0.25);
      // under the hair, the scalp takes the hair's colour (so no gaps show between the locks)
      // (but not on ears that stand out from the side of the head)
      if (C.hair && Math.abs(x) < 0.088 * hd) {
        const rx = x / hd, ry = (y - head[1]) / hd, rz = (z - head[2] + 0.01 * hd) / hd;
        const front = rz / (Math.hypot(rx, rz) || 1);
        const line = front > 0 ? 0.07 + 0.045 * smoothstep(0.2, 0.85, front) : 0.07 - 0.075 * smoothstep(0, -0.9, front);
        const k = smoothstep(line - 0.006, line + 0.006, ry) * (1 - smoothstep(0.076, 0.088, Math.abs(rx)));
        if (k > 0) c.lerp(C.hair, k);
      }
    }
    out[v * 3] = c.r; out[v * 3 + 1] = c.g; out[v * 3 + 2] = c.b;
  }
  return out;
}

// Cloth: rough and matt, with a fine weave (linen, wool) or a soft sheen (leather)
const CLOTH = { linen: { roughness: 0.92, weave: 1 }, wool: { roughness: 0.95, weave: 0.7 }, leather: { roughness: 0.55, weave: 0 } };
const clothMats = new Map();
function clothMaterial(cloth, hex) {
  const key = cloth + hex;
  if (!clothMats.has(key)) {
    const C = CLOTH[cloth] || CLOTH.linen;
    const mat = new THREE.MeshStandardMaterial({ color: hex, roughness: C.roughness, metalness: 0 });
    if (C.weave) mat.onBeforeCompile = (sh) => weave(sh, C.weave);
    clothMats.set(key, mat);
  }
  return clothMats.get(key);
}
// a fine woven pattern, worked out from where the point sits on the body (so it needs no texture)
function weave(shader, k) {
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;');
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;')
    .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 q = vRest * 900.0;
      float w = 0.5 + 0.25 * (sin(q.x + q.z) * sin(q.y * 1.3) + sin(q.y - q.x * 0.7) * sin(q.z * 1.1));
      diffuseColor.rgb *= 1.0 - ${(0.09).toFixed(2)} * ${k.toFixed(2)} * w;`);
}

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Hair: darker at the roots and on the inner layers, lighter towards the tips, with the bright
// "ring" of shine around the crown that anime hair has
let hairMat = null;
function hairMaterial() {
  if (!hairMat) hairMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05 });
  return hairMat;
}
function hairGeometry(H, hex, plan) {
  const base = new THREE.Color(hex);
  const dark = base.clone().multiplyScalar(0.55), light = base.clone().lerp(new THREE.Color('#ffffff'), 0.12), shine = base.clone().lerp(new THREE.Color('#fff6e8'), 0.42);
  const n = H.positions.length / 3;
  const col = new Float32Array(n * 3);
  const ringY = plan.headO[1] + 0.135 * plan.hd;
  const c = new THREE.Color();
  for (let v = 0; v < n; v++) {
    const t = H.along[v], layer = H.layer[v];
    c.copy(dark).lerp(light, Math.min(1, t * 1.4 + layer * 0.12));
    const y = H.positions[v * 3 + 1], z = H.positions[v * 3 + 2] - plan.headO[2];
    const ring = Math.max(0, 1 - Math.abs(y - ringY) / (0.012 * plan.hd)) * (z > -0.04 ? 1 : 0.4);
    if (ring > 0) c.lerp(shine, ring * 0.7);
    col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(H.positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(H.normals, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(H.skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(H.skinWeight, 4));
  geo.setIndex(new THREE.BufferAttribute(H.indices, 1));
  geo.computeBoundingSphere();
  return geo;
}
