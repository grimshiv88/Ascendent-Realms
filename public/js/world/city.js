// The Central City at the heart of the map, owned by no one: a walled town on levelled ground
// round the main waystone, with the city's own shops (run by bots), a tavern and the Main Guild
// Hall. Villages are smaller: a waystone with a few houses and a tavern.
import * as THREE from 'three';
import { heightAt, CITY_R } from '../data/world-layout.mjs';
import { MARKETS, ITEMS } from '../data/items.mjs';
import { moneyWords } from '../data/money.mjs';
import { buildSpawn, textTexture } from './spawn.js';
import { buildCharacter, animateCharacter, bodyHeight } from '../characters/model.js';
import { lazyCharacter, isShown } from '../characters/crowd.js';
import { wearGear } from '../characters/gear.js';
import { mergeStill, showDetail } from './merge.js';
import { buildHouse, buildTower, buildShack, paved, pavedGeometry, TOWN_TONES } from './houses.js';
import { marketStall, twoFacedSign } from './farms.js';
import { cityHouses, CASTLE_SPOT, ACADEMIES, ACADEMY_W, ACADEMY_D, SCHOOLS, familyOf, PARENT_JOBS, townName, seeded } from '../data/birth.mjs';
import { TIERS, TOP_Y, TERRACE, INNER_R, ROAD_ANGLES, ROAD_HALF, RAMPS, RAMP_IN, RAMP_OUT, RAMP_WALL, ringY, rampAt, alongRoad, cityLift } from '../data/citylevels.mjs';
import { cityPlan, PLAZA_R, GUILD_SPOT, RING_ROADS, ESTATE_ID, BANK_ID, tierY, RACE_HOME, homeFootprint } from '../data/citylayout.mjs';

export { PLAZA_R, INNER_R };
// the look of the city's own buildings: [wall, roof, awning or banner colour]
const SHOP_LOOK = {
  guild: ['#cdbf9e', '#5a2a24', '#7a1a1a'], city_potions: ['#d8cdb0', '#3a6a3a', '#3a7a4a'], city_tailor: ['#e0d4c0', '#7a3a5a', '#7a3a6a'],
  city_food: ['#e2d2a8', '#8a5a2a', '#c8782a'], tavern: ['#c8b48e', '#6a3a1e', '#8a4a1e'], city_smith: ['#9a8e7e', '#3a3632', '#4a4a4a'],
  city_armoury: ['#b0a690', '#4a4a5a', '#2a4a7a'], furniture_common: ['#e4d6b8', '#7a4a2a', '#6a4a2a'], furniture_noble: ['#efe8da', '#2e3e5e', '#8a6a1a'],
  furniture_dump: ['#7a6a52', '#5a4a3a', '#6a5a3a'], [ESTATE_ID]: ['#e8e0cc', '#2a4a3a', '#1e5a3a'],
  [BANK_ID]: ['#ece6d6', '#3a3a4a', '#b8902a'],
};
export const ESTATE_NAME = 'Real Estate Office';
import { BANK_NAME } from '../data/economy.mjs';

// The walls: the outer fortress wall, the moat inside it, then the inner wall. Only two gates (north
// and south), each with a bridge over the moat that can be raised to shut the inner gate.
export const MOAT = [INNER_R + 0.8, CITY_R - 1]; // right up to both walls: no strip of land to stand on
export const GATE_ANGLES = [0, Math.PI]; // the gates, along the south-north street (angle as sin = x, cos = z)
const GATE_HALF = 5; // metres either side of a gate's middle
export const VILLAGE_WALL = 54; // a village's wooden wall (inside its safe zone)
export const GUILD_NAME = 'Main Guild Hall';
export const DARK_GUILD_NAME = 'Dark Guild Hall';

// Each city is built in its land's own style: the Central City of the Heartland in pale stone, and
// the Monster Cities in the stone, colours and trimmings of their continents
const STYLES = {
  heart: { paving: '#a39a88', street: '#8e8676', wall: '#8f8676', lamp: ['#ffe2a0', '#ffb84a'],
    tones: [['#d2c4a4', '#7a3a24'], ['#c4b494', '#4a5a6a'], ['#dccfb2', '#6a4a2a'], ['#b8a888', '#3a4a3a']],
    guards: ['dwarf', 'elf', 'giant', 'beastkin', 'hobbit', 'elf', 'dwarf', 'beastkin'], gear: { weapon: 'iron_spear', head: 'knight_helm', body: 'knight_plate' } },
  // Dragon Peaks: black basalt and red tiles, lit by pools of lava
  peaks: { paving: '#3a3230', street: '#2a2422', wall: '#3c3430', lamp: ['#ff8a3a', '#ff4a0a'], decor: 'lava',
    tones: [['#4a3e38', '#8a2a1a'], ['#3e3430', '#6a1a10'], ['#54463e', '#a03a1a']], guards: ['dragonewt'], gear: { weapon: 'wyrm_glaive', head: 'horned_helm', body: 'drake_plate' } },
  // Ashen Wastes: sun-baked mud brick, bone spikes and hide awnings
  wastes: { paving: '#b08a5a', street: '#9a7a4e', wall: '#a0784a', lamp: ['#ffc070', '#ff8a2a'], decor: 'bones',
    tones: [['#c49a62', '#6a4a2a'], ['#b88a52', '#5a3a22'], ['#d0a870', '#7a5232']], guards: ['goblin', 'slime'], gear: { weapon: 'tusk_spear', head: 'bone_mask', body: 'scale_mail' } },
  // The Fae Isles: white stone under violet and sea-green roofs, with floating crystals
  fae: { paving: '#d8e4e0', street: '#c4d4d0', wall: '#e8eef0', lamp: ['#d8b0ff', '#a060ff'], decor: 'crystals',
    tones: [['#f0f0f8', '#8a5ac8'], ['#e6f2ee', '#3aa89a'], ['#f4eef8', '#c060a8']], guards: ['fairy'], gear: { weapon: 'spirit_totem', head: 'warlord_crown', body: 'shaman_mantle' } },
  // Mirefall: dark timber on stilts, reed roofs, moss and green lanterns
  mire: { paving: '#5a5a3a', street: '#4a4a30', wall: '#5a4a2e', lamp: ['#b0ffa0', '#40c060'], decor: 'reeds',
    tones: [['#7a6a48', '#4a6a3a'], ['#6a5a3c', '#5a7a3a'], ['#82704c', '#3a5a2e']], guards: ['lizardman', 'naga'], gear: { weapon: 'tusk_spear', head: 'horned_helm', body: 'scale_mail' } },
};

// materials shared by colour, so a city's houses can be merged into a few meshes
const MATS = new Map();
const matOf = (color, roughness = 0.9, extra = null) => {
  const k = `${color}|${roughness}|${extra ? JSON.stringify(extra) : ''}`;
  if (!MATS.has(k)) MATS.set(k, new THREE.MeshStandardMaterial({ color, roughness, ...(extra || {}) }));
  return MATS.get(k);
};
// The city's stone walls (terraces, ramps, the gates between the rings): laid blocks of stone,
// not flat grey. stoneBox is a box whose faces show the blocks at their true size (about 1.2 m
// by 0.6 m a block) however big the box is.
let stoneTex = null;
function stoneTexture() {
  if (stoneTex) return stoneTex;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  let sd = 7;
  const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  g.fillStyle = '#6a6a6a'; g.fillRect(0, 0, 256, 256); // the mortar
  const rows = 4, bh = 256 / rows, bw = 128;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? bw / 2 : 0;
    for (let x = -bw; x < 256 + bw; x += bw) {
      const v = 200 + Math.floor(rnd() * 50);
      g.fillStyle = `rgb(${v},${v},${Math.floor(v * 0.97)})`;
      g.fillRect(x + off + 3, r * bh + 3, bw - 6, bh - 6);
      // a little wear on each block
      for (let k = 0; k < 14; k++) { const w = 150 + Math.floor(rnd() * 60); g.fillStyle = `rgba(${w},${w},${w},0.35)`; g.fillRect(x + off + 3 + rnd() * (bw - 14), r * bh + 3 + rnd() * (bh - 12), 4 + rnd() * 8, 3 + rnd() * 6); }
    }
  }
  stoneTex = new THREE.CanvasTexture(c);
  stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping;
  stoneTex.colorSpace = THREE.SRGBColorSpace;
  return stoneTex;
}
const STONE_MATS = new Map();
const stoneWallMat = (color) => {
  if (!STONE_MATS.has(color)) STONE_MATS.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.95, map: stoneTexture() }));
  return STONE_MATS.get(color);
};
function stoneBox(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  // faces in order: +x, -x (d by h), +y, -y (w by d), +z, -z (w by h); one texture is 2.4 m by 2.4 m
  const size = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * size[f][0] / 2.4, uv.getY(i) * size[f][1] / 2.4); }
  return geo;
}
// A guard in the city's armour, built only when you come near (see lazyCharacter)
const lazyGuard = (race, gear) => lazyCharacter(() => { const b = buildCharacter({ race, form: 'humanoid', look: {} }); wearGear(b, gear); return b; }, bodyHeight(race, 'humanoid'));

// A building in the town style (see world/houses.js): w wide, d deep, about h high (3.1 m a storey)
function house(w, d, h, wall, roof, label, opts = {}) {
  return buildHouse({ w, d, floors: Math.max(1, Math.round(h / 3.1)), wall, roof, seed: opts.seed ?? `${w}:${d}:${h}:${label}`, labelTex: label ? textTexture(label) : null, ...opts });
}

// Doors that swing open while someone is near them (you, for now). Their places are worked out
// the first time, once the buildings stand where they will stay.
function doorKeeper() {
  const doors = [];
  const v = new THREE.Vector3();
  return {
    add(b) { if (b.userData.door) doors.push({ hinge: b.userData.door, x: null, z: null, y: 0, open: 0, held: 0 }); },
    // where each door's middle is in the world, worked out once the buildings stand in place
    place(d) { d.hinge.updateWorldMatrix(true, false); d.hinge.localToWorld(v.set((d.hinge.userData.w || 1.3) / 2, 1, 0)); d.x = v.x; d.y = v.y; d.z = v.z; },
    // the doors near (x, z), to click or tap
    near(x, z, r) { const out = []; for (const d of doors) { if (d.x === null) this.place(d); if (Math.abs(d.x - x) < r && Math.abs(d.z - z) < r) out.push(d); } return out; },
    // doors further than `far` aren't drawn (like the window frames): each door is a piece of its
    // own, and a city's hundreds of doors were a thousand draw calls. Far off, a doorway is a few dots.
    lod(you, far) {
      for (const d of doors) {
        if (d.x === null) this.place(d);
        const show = Math.hypot(you.x - d.x, you.z - d.z) < far;
        if (d.hinge.visible !== show) d.hinge.visible = show;
      }
    },
    // click a door: it swings open and stays open a while (click again to shut it)
    toggle(d, t) { if (d.open > 0.6) { d.held = 0; d.keepShut = true; } else { d.held = t + 8; d.keepShut = false; } },
    update(you, t = 0) {
      if (!you) return;
      for (const d of doors) {
        if (d.x === null) this.place(d);
        const last = d.last; d.last = t; d.lastWas = last;
        const dx = you.x - d.x, dz = you.z - d.z;
        const near = Math.abs(dx) < 4 && Math.abs(dz) < 4 && Math.hypot(dx, dz) < 3.4; // (it starts to open a few steps before you reach it)
        if (!near) d.keepShut = false; // shut by a click: it stays shut till you walk away
        const want = (near && !d.keepShut) || d.held > t ? 1.35 : 0;
        if (Math.abs(want - d.open) < 0.005) continue;
        // a smooth swing on its hinges, the same speed however fast the game draws (about half a second)
        const dt = Math.min(0.1, Math.max(0, t - (d.lastWas ?? t)));
        d.open += (want - d.open) * (1 - Math.exp(-dt * 9));
        if (Math.abs(want - d.open) < 0.01) d.open = want;
        d.hinge.rotation.y = d.open;
      }
    },
  };
}

// Raise a building 0.6 m on wooden stilts (Mirefall's mud): posts at its corners and along its
// sides, down into the ground, so it never looks as if it floats
const STILT = new THREE.CylinderGeometry(0.14, 0.18, 1.1, 6);
const STILT_MAT = new THREE.MeshStandardMaterial({ color: '#3a2e1e', roughness: 1 });
function stilts(b, w, d) {
  b.position.y = 0.6;
  for (let x = -w / 2 + 0.3; x <= w / 2 - 0.29; x += (w - 0.6) / Math.max(1, Math.round((w - 0.6) / 2.5))) {
    for (const z of [-d / 2 + 0.3, d / 2 - 0.3]) { const p = new THREE.Mesh(STILT, STILT_MAT); p.position.set(x, -0.5, z); b.add(p); }
  }
  for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) for (let z = -d / 2 + 2.8; z < d / 2 - 2.5; z += 2.5) { const p = new THREE.Mesh(STILT, STILT_MAT); p.position.set(x, -0.5, z); b.add(p); }
}

// Solid circles along a rectangle's edges, so you can't walk through a building
function boxColliders(x, z, w, d, rot, out, height = 6) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const put = (lx, lz) => out.push({ x: x + lx * c + lz * s, z: z - lx * s + lz * c, r: 1.1, kind: 'wall', height });
  for (let lx = -w / 2; lx <= w / 2 + 0.01; lx += 1.8) { put(lx, -d / 2 + 0.6); put(lx, d / 2 - 0.6); }
  for (let lz = -d / 2; lz <= d / 2 + 0.01; lz += 1.8) { put(-w / 2 + 0.6, lz); put(w / 2 - 0.6, lz); }
}

// A building at angle `a` on a ring of radius `r` round (0, 0), its door facing the middle.
// Returns the door's spot (in the group's space) for the shop's E key.
// A building's steps and porch floors (to stand on) and its columns (solid), turned into the
// world's: `pads` gets { x, z, rot, w, d, top } (top above the city's ground), `solid` the columns.
// (bx, bz): the building's middle in the world; y: how high it stands above the city's ground
function fixtures(b, bx, bz, rot, y, solid, pads) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const turn = (lx, lz) => [bx + lx * c + lz * s, bz - lx * s + lz * c];
  for (const p of b.userData.pads || []) { const [x, z] = turn(p.x, p.z); pads.push({ x, z, rot, w: p.w, d: p.d, top: y + p.top }); }
  for (const p of b.userData.posts || []) { const [x, z] = turn(p.x, p.z); solid.push({ x, z, r: p.r, kind: 'wall', height: p.height }); }
}
// the highest pad under (x, z), above the city's ground; undefined if none
function padAt(pads, x, z) {
  let top;
  for (const p of pads) {
    const dx = x - p.x, dz = z - p.z, c = Math.cos(p.rot), s = Math.sin(p.rot);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    if (Math.abs(lx) <= p.w / 2 && Math.abs(lz) <= p.d / 2 && (top === undefined || p.top > top)) top = p.top;
  }
  return top;
}

// put a building with its middle at (x, z) and its door facing (fx, fz); returns the spot in front of the door
function placeAt(g, b, x, z, fx, fz, d) {
  b.position.set(x, 0, z);
  b.rotation.y = Math.atan2(fx, fz);
  g.add(b);
  return { x: x + fx * (d / 2 + 1.6), z: z + fz * (d / 2 + 1.6), rot: b.rotation.y, bx: x, bz: z };
}
function placeFacing(g, b, a, r, d) {
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  b.position.set(x, 0, z);
  b.rotation.y = Math.atan2(-x, -z);
  g.add(b);
  return { x: x - Math.cos(a) * (d / 2 + 1.6), z: z - Math.sin(a) * (d / 2 + 1.6), rot: b.rotation.y, bx: x, bz: z };
}

// The gates between the rings: where a ramp climbs through a terrace wall, two stone towers stand
// on the ramp's walls with an arch between them, the name of the ring above on it (both sides) and
// an iron portcullis drawn up into the arch. Returns { k, tier, name, a, line } (line: how far out
// along the road the gate stands; going in past it means going up into `tier`).
export const GATE_AT = TERRACE + 1; // the gate's line, this far out from the higher ring's edge
const GATE_LOOK = { iron: new THREE.MeshStandardMaterial({ color: '#2e2c2a', roughness: 0.5, metalness: 0.6 }) };
function cityGate(fixed, R, T, line, stoneMat, capMat, cx, cz) {
  const gg = new THREE.Group();
  const y = (rampAt(Math.sin(R.a) * line, Math.cos(R.a) * line)?.y ?? ringY(line)) - TOP_Y;
  gg.position.set(Math.sin(R.a) * line, y, Math.cos(R.a) * line);
  gg.rotation.y = R.a;
  const add = (geo, m, x, yy, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, yy, z); o.castShadow = true; o.receiveShadow = true; gg.add(o); return o; };
  const span = ROAD_HALF + RAMP_WALL / 2, H = 7.5;
  // the towers on the walls, with battlements
  for (const sx of [-1, 1]) {
    add(stoneBox(RAMP_WALL + 0.4, H, 3), stoneMat, sx * span, H / 2 - 1, 0);
    for (const dz of [-1, 1]) for (const dx of [-1, 1]) add(stoneBox(0.9, 0.8, 0.9), stoneMat, sx * span + dx * 1.4, H - 0.6, dz * 1.05);
  }
  // the arch over the road, and the portcullis drawn up into it
  add(new THREE.BoxGeometry(ROAD_HALF * 2, 1.6, 2.6), capMat, 0, H - 2.2, 0);
  for (let x = -ROAD_HALF + 0.4; x <= ROAD_HALF - 0.39; x += 0.8) add(new THREE.BoxGeometry(0.12, 1.0, 0.12), GATE_LOOK.iron, x, H - 3.4, 0);
  add(new THREE.BoxGeometry(ROAD_HALF * 2 - 0.4, 0.12, 0.14), GATE_LOOK.iron, 0, H - 3.85, 0);
  // the ring's name, over the arch on both faces
  const tex = GATE_LOOK[T.id] ??= textTexture(T.name);
  for (const side of [1, -1]) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.2), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    sign.position.set(0, H - 2.2, side * 1.32);
    sign.rotation.y = side > 0 ? 0 : Math.PI;
    gg.add(sign);
  }
  fixed.add(gg);
  return { k: R.k, tier: T.id, name: T.name, a: R.a, road: R.road, line };
}

// how far a city's small details (window frames, rails) are drawn: less on phones (quality.js)
let DETAIL_FAR = 90;
export function setCityDetail(m) { DETAIL_FAR = m || 90; }
const detailFar = () => DETAIL_FAR;

export function buildCity(place, opts = {}) {
  const S = STYLES[place.style] || STYLES.heart;
  const monster = !!place.monster;
  const centre = buildSpawn(place, { market: false, lanterns: false });
  const g = centre.group;
  const cx = place.x, cz = place.z;
  const solid = [...centre.solid];
  const shops = [];
  const doors = doorKeeper();
  const pads = [];

  // how high (x, z) stands above the plaza (the rings drop away from Castle Hill)
  const top = heightAt(cx, cz);
  // (inside the inner wall exactly, ramps included: the land is drawn lower under a ramp's high end)
  const yAt = (x, z) => (Math.hypot(x, z) < INNER_R ? cityLift(x, z) - TOP_Y : heightAt(cx + x, cz + z) - top);
  const ringRel = (id) => tierY(id) - TOP_Y;
  const plan = cityPlan();

  // the paved plaza on Castle Hill
  const paving = paved(PLAZA_R + 6, 0, S.paving, true, 5);
  paving.position.y = 0.03;
  g.add(paving);
  // the four main roads, from the plaza down to the inner wall, up and down the ramps on the way
  // (the north road starts in the Noble Quarter: the castle stands at its top)
  for (const [name, ra] of Object.entries(ROAD_ANGLES)) {
    const from = name === 'north' ? TIERS[0].r1 + TERRACE : PLAZA_R + 4, to = INNER_R - 1;
    const pos = [], idx = [];
    const n = Math.ceil((to - from) / 2);
    for (let i = 0; i <= n; i++) {
      const along = from + (to - from) * (i / n);
      for (const lat of [-ROAD_HALF, ROAD_HALF]) {
        const x = Math.sin(ra) * along + Math.cos(ra) * lat, z = Math.cos(ra) * along - Math.sin(ra) * lat;
        pos.push(x, yAt(Math.sin(ra) * along, Math.cos(ra) * along) + 0.03, z);
      }
      if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    if (geo.attributes.normal.getY(0) < 0) { geo.setIndex(idx.map((v, i) => idx[i - (i % 3) + [0, 2, 1][i % 3]])); geo.computeVertexNormals(); }
    g.add(pavedGeometry(geo, S.street, 3));
  }
  // the ring roads, and the Dump's dirt track
  for (const R of RING_ROADS) {
    const geo = new THREE.RingGeometry(R.r - R.w / 2, R.r + R.w / 2, 160, 1);
    geo.rotateX(-Math.PI / 2);
    const m = pavedGeometry(geo, R.dirt ? '#7a6a52' : S.street, 2);
    if (R.dirt) m.material = new THREE.MeshStandardMaterial({ color: '#76664c', roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 }); // packed earth, no cobbles
    m.position.y = ringRel(R.tier) + 0.025;
    g.add(m);
  }

  // the ground of each ring: one flat, solid floor per ring at its exact level, from the foot of
  // the terrace wall below it out to under the next wall (the land itself is sunk out of sight
  // inside the inner wall, so its coarse slopes never poke out over the streets as grass). Where a
  // ramp is cut down into a ring, the floor leaves a gap for it (the ramp's road and walls fill it).
  g.add(ringFloors(S, monster, ringRel));

  // buildings and walls never move: they are merged into a few meshes at the end
  const fixed = new THREE.Group();
  g.add(fixed);
  const stoneMat = stoneWallMat(S.wall);
  const capMat = matOf(monster ? S.tones[0][0] : '#a8a090', 0.95);

  // ---------- the terrace walls holding up each ring, and the ramps through them ----------
  const rampBands = []; // for deckAt: the walkway on top of each terrace wall
  const wallBase = heightAt(cx, cz); // the city's own height (Castle Hill's) in the world
  const innerGates = []; // the gates between the rings (see cityGate)
  for (let k = 0; k < TIERS.length - 1; k++) {
    const b = TIERS[k].r1, up = TIERS[k].y - TOP_Y, low = TIERS[k + 1].y - TOP_Y;
    const face = b + TERRACE;
    const seg = 3;
    const n = Math.round((2 * Math.PI * face) / seg);
    const ramps = RAMPS.filter((R) => R.k === k);
    const gap = (a, r, w) => ramps.some((R) => { const { along, lat } = alongRoad(Math.sin(a) * r, Math.cos(a) * r, R.a); return along > 0 && Math.abs(lat) < w; });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (gap(a, face, ROAD_HALF + 0.5)) continue;
      // the face of the wall, from the lower ring up past the higher one (a parapet), and the walk on top
      const h = up - low + 1.1;
      const w = new THREE.Mesh(stoneBox(seg + 0.25, h + 0.6, 1.2), stoneMat);
      w.position.set(Math.sin(a) * (face - 0.4), low - 0.6 + (h + 0.6) / 2, Math.cos(a) * (face - 0.4));
      w.rotation.y = a;
      fixed.add(w);
      if (!gap(a, b - 1, ROAD_HALF + 0.5)) {
        const walk = new THREE.Mesh(new THREE.BoxGeometry(seg * (b - 1.5) / face + 0.3, 0.3, TERRACE + 1.5), capMat);
        walk.position.set(Math.sin(a) * (b + TERRACE / 2 - 1.75), up - 0.12, Math.cos(a) * (b + TERRACE / 2 - 1.75));
        walk.rotation.y = a;
        fixed.add(walk);
      }
      if (i % 2 === 0) { const m = new THREE.Mesh(stoneBox(1.3, 0.6, 1.2), stoneMat); m.position.set(Math.sin(a) * (face - 0.4), up + 1.4, Math.cos(a) * (face - 0.4)); m.rotation.y = a; fixed.add(m); }
      // solid all along (two to a stretch, so nobody small slips between them and up the bank), up
      // to a little over the battlements: too high to jump over, but you can fly over it
      for (const da of [0, seg / 2 / face]) if (!gap(a + da, face, ROAD_HALF + RAMP_WALL + 0.5)) solid.push({ x: cx + Math.sin(a + da) * (face + 0.2), z: cz + Math.cos(a + da) * (face + 0.2), r: 1.0, kind: 'wall', y: wallBase + low - 1, height: up - low + 3.2 });
    }
    rampBands.push({ r0: b - 3.5, r1: face, y: up });
    // the ramps: a road climbing between two stone walls, cut into the higher ring and built out
    // over the lower one
    for (const R of ramps) {
      const lo = b - RAMP_IN, hi = b + TERRACE + RAMP_OUT;
      // the gate into the higher ring, where the ramp climbs through the terrace wall
      innerGates.push(cityGate(fixed, R, TIERS[k], b + GATE_AT, stoneMat, capMat, cx, cz));
      for (const side of [-1, 1]) {
        const lat = side * (ROAD_HALF + RAMP_WALL / 2);
        for (let along = lo; along < hi; along += 2) {
          const mid = along + 1, rY = (rampAt(Math.sin(R.a) * mid, Math.cos(R.a) * mid)?.y ?? ringY(mid)) - TOP_Y, gY = ringY(mid) - TOP_Y;
          const top2 = Math.max(rY, gY) + 0.9, bot = Math.min(rY, gY) - 0.6;
          const x = Math.sin(R.a) * mid + Math.cos(R.a) * lat, z = Math.cos(R.a) * mid - Math.sin(R.a) * lat;
          const w = new THREE.Mesh(stoneBox(RAMP_WALL, top2 - bot, 2.05), stoneMat);
          w.position.set(x, (top2 + bot) / 2, z);
          w.rotation.y = R.a;
          fixed.add(w);
        }
        // the wall is solid right through, ends and all: a row of posts every metre along the
        // road's edge, through the middle and along the outer edge (nobody walks into it, or
        // sinks into it from its open end)
        for (let along = lo + 0.5; along < hi; along += 1) {
          for (const L of [ROAD_HALF + 0.5, ROAD_HALF + 1.6, ROAD_HALF + 2.7, ROAD_HALF + RAMP_WALL - 0.2]) {
            solid.push({ x: cx + Math.sin(R.a) * along + Math.cos(R.a) * L * side, z: cz + Math.cos(R.a) * along - Math.sin(R.a) * L * side, r: 0.75, kind: 'wall', height: 3 });
          }
        }
      }
    }
  }

  // ---------- the buildings ----------
  // put one up: its middle at (x, z) on its ring, its door facing (fx, fz)
  const raise = (b, x, z, fx, fz, w, d, y) => {
    doors.add(b);
    if (S.decor === 'reeds') stilts(b, w, d); // up on stilts above the mud
    const at = placeAt(fixed, b, x, z, fx, fz, d);
    b.position.y += y;
    boxColliders(cx + at.bx, cz + at.bz, w, d, at.rot, solid, b.userData.height);
    fixtures(b, cx + at.bx, cz + at.bz, at.rot, b.position.y, solid, pads);
    return at;
  };
  const shopName = (id) => (id === 'guild' ? (monster ? DARK_GUILD_NAME : GUILD_NAME) : id === ESTATE_ID ? ESTATE_NAME : id === BANK_ID ? BANK_NAME : MARKETS[id].name);
  // the Main Guild Hall on Castle Hill, with its bell tower
  {
    const { x, z, w, d, h } = GUILD_SPOT, len = Math.hypot(x, z), fx = -x / len, fz = -z / len;
    const [wall0, roof0, accent] = SHOP_LOOK.guild;
    const [wall, roof] = monster ? S.tones[0] : [wall0, roof0];
    const b = house(w, d, h, wall, roof, shopName('guild'), { style: 'guild', accent });
    const at = raise(b, x, z, fx, fz, w, d, 0);
    shops.push({ id: 'guild', name: shopName('guild'), x: cx + at.x, z: cz + at.z, building: true });
    const tower = buildTower({ size: 3.6, height: 16, wall: monster ? S.tones[0][0] : '#d8ccb0', roof });
    tower.position.set(x - fx * (d / 2 - 1.5), 0, z - fz * (d / 2 - 1.5));
    fixed.add(tower);
    solid.push({ x: cx + tower.position.x, z: cz + tower.position.z, r: 2.6, kind: 'wall', height: 16 });
  }
  // the city's shops, the Real Estate office and the furniture shops
  plan.shops.forEach((p, i) => {
    const [wall0, roof0, accent] = SHOP_LOOK[p.id];
    const [wall, roof] = monster ? S.tones[i % S.tones.length] : [wall0, roof0];
    const b = house(p.w, p.d, p.h, wall, roof, shopName(p.id), { style: p.id === ESTATE_ID || p.id === BANK_ID ? 'guild' : 'shop', accent });
    const at = raise(b, p.x, p.z, p.fx, p.fz, p.w, p.d, ringRel(p.tier));
    shops.push({ id: p.id, name: shopName(p.id), x: cx + at.x, z: cz + at.z, building: true });
  });
  // the Academies, each with its class's roof colour; children go in to register and train
  ACADEMIES.forEach(({ school, x, z, fx, fz, tier }, i) => {
    const name = SCHOOLS[school].academy;
    const wall = monster ? S.tones[(i + 3) % S.tones.length][0] : '#e4dcc8';
    const b = house(ACADEMY_W, ACADEMY_D, 6.5, wall, SCHOOLS[school].roof, name, { style: 'academy', doorX: 0 });
    const at = raise(b, x, z, fx, fz, ACADEMY_W, ACADEMY_D, ringRel(tier));
    shops.push({ id: `academy_${school}`, name, school, x: cx + at.x, z: cz + at.z, building: true });
  });
  const open = quarters(g, S, solid, cx, cz, plan, ringRel);

  // the Emperors' Castle on top of Castle Hill, north of the plaza: a great keep with four towers
  // (only the Central City has it)
  const CASTLE = monster ? { x: 1e6, z: 1e6 } : { ...CASTLE_SPOT, w: 30, d: 24 };
  let castleGrounds = null;
  if (!monster) {
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#9a9284', roughness: 0.95 });
    const roofMat = new THREE.MeshStandardMaterial({ color: '#3a3e5a', roughness: 0.8 });
    const k = new THREE.Group();
    const keep = new THREE.Mesh(new THREE.BoxGeometry(CASTLE.w, 16, CASTLE.d), stoneMat);
    keep.position.y = 8;
    k.add(keep);
    // battlements along the top
    for (let x = -CASTLE.w / 2 + 1; x <= CASTLE.w / 2 - 1; x += 2.2) for (const z of [-CASTLE.d / 2, CASTLE.d / 2]) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 0.8), stoneMat); m.position.set(x, 16.7, z); k.add(m); }
    for (let z = -CASTLE.d / 2 + 1; z <= CASTLE.d / 2 - 1; z += 2.2) for (const x of [-CASTLE.w / 2, CASTLE.w / 2]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 1.1), stoneMat); m.position.set(x, 16.7, z); k.add(m); }
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 24, 14), stoneMat);
      t.position.set(x * CASTLE.w / 2, 12, z * CASTLE.d / 2);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(4, 7, 14), roofMat);
      cone.position.set(x * CASTLE.w / 2, 27.5, z * CASTLE.d / 2);
      k.add(t, cone);
    }
    // the great door, a sign over it and banners either side (on the side facing the plaza)
    const doorMat = new THREE.MeshStandardMaterial({ color: '#4a2e1a', roughness: 0.8 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 0.4), doorMat);
    door.position.set(0, 3 + STEP_UP, CASTLE.d / 2 + 0.1);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.2), new THREE.MeshBasicMaterial({ map: textTexture("The Emperors' Castle"), transparent: true }));
    sign.position.set(0, 7.4 + STEP_UP, CASTLE.d / 2 + 0.25);
    k.add(door, sign);
    for (const sx of [-4, 4]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, 5, 0.1), new THREE.MeshStandardMaterial({ color: '#7a1a1a' })); b.position.set(sx, 7, CASTLE.d / 2 + 0.2); k.add(b); }
    k.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    // turn it so the door faces the middle of the city
    const rot = Math.atan2(-CASTLE.x, -CASTLE.z);
    k.position.set(CASTLE.x, heightAt(cx + CASTLE.x, cz + CASTLE.z) - heightAt(cx, cz), CASTLE.z);
    k.rotation.y = rot;
    g.add(k);
    boxColliders(cx + CASTLE.x, cz + CASTLE.z, CASTLE.w + 2, CASTLE.d + 2, rot, solid);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const lx = x * CASTLE.w / 2, lz = z * CASTLE.d / 2;
      solid.push({ x: cx + CASTLE.x + lx * Math.cos(rot) + lz * Math.sin(rot), z: cz + CASTLE.z - lx * Math.sin(rot) + lz * Math.cos(rot), r: 3.6, kind: 'wall', height: 24 });
    }
    const out = CASTLE.d / 2 + 2.2;
    shops.push({ id: 'castle', name: "The Emperors' Castle", x: cx + CASTLE.x + out * Math.sin(rot), z: cz + CASTLE.z + out * Math.cos(rot), building: true });
    castleGrounds = buildCastleGrounds(k, CASTLE, rot, cx, cz, solid, S);
  }

  // the houses of the townsfolk: shacks in the Dump, town houses in the Common Quarter, manors
  // in the Noble Quarter; and the houses standing empty, for sale (a sign in front says so, or
  // whose they are once bought: see setOwners)
  const tones = monster ? S.tones : TOWN_TONES;
  const houses = cityHouses(place.id);
  // the folk of each home: its size (storeys and door) suits them (RACE_HOME)
  const homeAt = opts.home?.city === place.id ? opts.home.house : -1;
  const homeRace = (h) => (h.i === homeAt ? opts.home.race : S.guards[h.i % S.guards.length]);
  const putHome = (h, key) => {
    const [wall, roof] = tones[(h.i * 7 + Math.floor(h.i / 3) + (key === 'sale' ? 3 : 0)) % tones.length];
    const size = key === 'sale' ? 1 : RACE_HOME[homeRace(h)] ?? 1, k = homeFootprint(size);
    const w = h.w * k, d = h.d * k, doorX = h.doorX * k;
    const hb = h.style === 'shack' ? buildShack({ w, d, seed: `${place.id}:${key}${h.i}`, doorX, size })
      : buildHouse({ w, d, floors: h.floors, wall: h.style === 'manor' && !monster ? '#ece4d4' : wall, roof, seed: `${place.id}:${key}${h.i}`, doorX, over: 0.1, style: h.style === 'manor' ? 'manor' : 'house', size });
    raise(hb, h.x, h.z, h.fx, h.fz, w, d, ringRel(h.tier));
    if (h.tilt) hb.rotation.y += h.tilt;
    if (h.style === 'manor') garden(fixed, h, ringRel(h.tier), solid, cx, cz);
  };
  for (const h of houses) if (!h.gone) putHome(h, ''); // (a 'gone' house gave its place to the Mages' Academy)
  const saleSigns = new Map();
  for (const h of plan.sale) {
    putHome(h, 'sale');
    const out = h.d / 2 + 2.2, side = (h.doorX > 0 ? -1 : 1) * Math.max(h.w / 2 - 1.1, Math.abs(h.doorX) + 1.9); // (beside the door, never in front of it)
    const sx = h.x + h.fx * out + h.fz * side, sz = h.z + h.fz * out - h.fx * side;
    saleSigns.set(h.id, houseSign(g, fixed, sx, ringRel(h.tier), sz, h.rot, solid, cx, cz));
  }
  // the junk piled up in the Dump
  for (const j of plan.junk) junkPile(fixed, j, ringRel('dump'), solid, cx, cz);

  // the walls: outer fortress wall, moat, inner wall (see walls())
  const wallMat = matOf(S.wall, 0.95);
  // (they stand at the city's foot, the Dump's level)
  const foot = yAt(0, INNER_R + 6), lowFixed = new THREE.Group(), lowLive = new THREE.Group();
  lowFixed.position.y = foot; lowLive.position.y = foot;
  fixed.add(lowFixed); g.add(lowLive);
  const bridges = walls(lowFixed, lowLive, S, wallMat, cx, cz, solid);
  mergeStill(fixed, { cell: 120 }); // the city is big: coarse cells keep the draw calls down

  // street lamps round the plaza
  const lampMat = new THREE.MeshStandardMaterial({ color: S.lamp[0], emissive: S.lamp[1], emissiveIntensity: 1.6 });
  const iron = new THREE.MeshStandardMaterial({ color: '#2e2a26', roughness: 0.6, metalness: 0.4 });
  for (let i = 0; i < 16; i++) {
    const a = ((i + 0.5) / 16) * Math.PI * 2; // between the shop doors
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3, 6), iron);
    pole.position.set(Math.cos(a) * (PLAZA_R - 2), 1.5, Math.sin(a) * (PLAZA_R - 2));
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), lampMat);
    lamp.position.set(pole.position.x, 3.1, pole.position.z);
    g.add(pole, lamp);
    solid.push({ x: cx + pole.position.x, z: cz + pole.position.z, r: 0.15, kind: 'wall', height: 3.3 });
  }

  // two guards at each gate, in plate with spears, who check everyone's ID on the way in
  const guards = [];
  const guardRaces = S.guards;
  const guardGear = Object.fromEntries(Object.entries(S.gear).map(([k, id]) => [k, ITEMS[id]]));
  const gates = [];
  for (const [k, a] of GATE_ANGLES.entries()) {
    const ox = Math.sin(a), oz = Math.cos(a); // outward
    gates.push({ x: cx + ox * CITY_R, z: cz + oz * CITY_R, a });
    for (const side of [-1, 1]) {
      const race = guardRaces[(k * 2 + (side > 0 ? 1 : 0)) % guardRaces.length];
      const body = lazyGuard(race, guardGear);
      const r = CITY_R + 3.5, lat = side * 3.4;
      const x = ox * r + oz * lat, z = oz * r - ox * lat;
      body.position.set(x, heightAt(cx + x, cz + z) - heightAt(cx, cz), z);
      body.rotation.y = a; // facing out, towards those coming in
      g.add(body);
      guards.push(body);
      solid.push({ x: cx + x, z: cz + z, r: 0.6, kind: 'wall', height: 2 });
    }
  }
  // two guards at each gate between the rings, on the higher side, who read your City Pass on the
  // way in (see data/citypass.mjs); they stand at the road's edges and leave the middle open
  innerGates.forEach((G, n) => {
    for (const side of [-1, 1]) {
      const race = guardRaces[(n * 2 + (side > 0 ? 1 : 0) + 1) % guardRaces.length];
      const body = lazyGuard(race, guardGear);
      const along = G.line - 1.6, lat = side * (ROAD_HALF - 0.7);
      const x = Math.sin(G.a) * along + Math.cos(G.a) * lat, z = Math.cos(G.a) * along - Math.sin(G.a) * lat;
      body.position.set(x, yAt(x, z), z);
      body.rotation.y = G.a; // facing out, down the ramp, towards those coming up
      g.add(body);
      guards.push(body);
      solid.push({ x: cx + x, z: cz + z, r: 0.5, kind: 'wall', height: 2 });
    }
  });

  // townsfolk: families at their doors, and merchants and businessmen round the plaza
  const npcs = [];
  const addNpc = (race, x, z, faceA, info) => {
    const body = lazyCharacter(() => {
      const b = buildCharacter({ race, form: 'humanoid', look: info.look || {} });
      if (info.small) b.scale.setScalar(0.58);
      return b;
    }, bodyHeight(race, 'humanoid') * (info.small ? 0.58 : 1));
    body.position.set(x, heightAt(cx + x, cz + z) - heightAt(cx, cz), z);
    body.rotation.y = faceA;
    g.add(body);
    // your own parents carry a sign over their heads, so you can find them in a crowd
    if (info.mine) { const sign = parentSign(); sign.position.y = (body.userData.height || 1.8) + 0.55; body.add(sign); }
    const npc = { ...info, x: cx + x, z: cz + z };
    npcs.push(npc);
    // townsfolk stroll about near their spot: parents in front of their house, traders round the plaza
    walkers.push({ body, npc, hx: x, hy: body.position.y, hz: z, range: info.still ? 0.4 : info.range ?? (info.kind === 'parent' ? 2.6 : info.kind === 'child' ? 7 : 5), tx: x, tz: z, wait: 1 + rnd2() * 4, talk: 0 });
  };
  const walkers = [];
  let seed2 = 7;
  const rnd2 = () => { seed2 = (seed2 * 16807) % 2147483647; return seed2 / 2147483647; };
  let lastT = null;
  // A Ceremony at the shrine: the townsfolk come to the plaza and stand in a ring round the shrine
  // to watch the child's card be revealed, then go home. Those far off come in from the plaza's edge
  // (and go back that way), so nobody walks through the houses.
  let gathering = false;
  const EDGE = PLAZA_R - 6;
  const gather = (on) => {
    if (on === gathering) return;
    gathering = on;
    walkers.forEach((w, i) => {
      if (w.npc.kind === 'teacher' || w.npc.kind === 'stall') return;
      const a = (i * 2.399963) % (Math.PI * 2), r = 9.5 + (i % 3) * 1.3;
      if (on) {
        w.slot = { x: Math.cos(a) * r, z: Math.sin(a) * r };
        if (Math.hypot(w.body.position.x, w.body.position.z) > EDGE + 2) { w.body.position.set(Math.cos(a) * EDGE, yAt(Math.cos(a) * EDGE, Math.sin(a) * EDGE), Math.sin(a) * EDGE); w.away = true; }
        w.tx = w.slot.x; w.tz = w.slot.z; w.wait = (i % 7) * 0.4;
      } else if (w.slot) {
        if (w.away) { w.tx = Math.cos(a) * EDGE; w.tz = Math.sin(a) * EDGE; } else { w.tx = w.hx; w.tz = w.hz; }
        w.slot = null; w.wait = (i % 5) * 0.5;
      }
    });
  };
  function walkFolk(t, you, blocked) {
    const dt = lastT === null ? 0 : Math.min(0.1, t - lastT);
    lastT = t;
    for (const w of walkers) {
      const b = w.body;
      let speed = 0;
      if (w.slot && Math.hypot(w.tx - b.position.x, w.tz - b.position.z) < 0.15) {
        // in the ring: watch the shrine
        const want = Math.atan2(-b.position.x, -b.position.z);
        b.rotation.y += Math.atan2(Math.sin(want - b.rotation.y), Math.cos(want - b.rotation.y)) * Math.min(1, dt * 4);
      } else if (!w.slot && w.away && !gathering && Math.hypot(w.tx - b.position.x, w.tz - b.position.z) < 0.15) {
        // back at the plaza's edge: home again
        b.position.set(w.hx, w.hy, w.hz); w.tx = w.hx; w.tz = w.hz; w.away = false;
        w.npc.x = cx + w.hx; w.npc.z = cz + w.hz;
      } else if (w.npc.talkUntil && w.npc.talkUntil > t) {
        // talking: stop and face whoever spoke to them
        if (you) b.rotation.y = Math.atan2(you.x - cx - b.position.x, you.z - cz - b.position.z);
      } else if (w.wait > 0) w.wait -= dt;
      else {
        const dx = w.tx - b.position.x, dz = w.tz - b.position.z, d = Math.hypot(dx, dz);
        if (d < 0.15 && (w.slot || w.away)) speed = 0;
        else if (d < 0.15) {
          w.wait = 2 + rnd2() * 6;
          // the next spot: somewhere near home, never further from the middle than home (not into a house)
          for (let k = 0; k < 6; k++) {
            const a = rnd2() * Math.PI * 2, r = w.range * Math.sqrt(rnd2());
            const nx = w.hx + Math.cos(a) * r, nz = w.hz + Math.sin(a) * r, nd = Math.hypot(nx, nz);
            // (and on the same ring: never over a terrace wall, never into the shrine)
            if (nd > 11 && Math.abs(yAt(nx, nz) - w.hy) < 0.3) { w.tx = nx; w.tz = nz; break; }
          }
        } else {
          speed = w.slot || w.away ? 1.6 : 1.1;
          const step = Math.min(d, speed * dt);
          const nx = b.position.x + (dx / d) * step, nz = b.position.z + (dz / d) * step;
          // people are solid: wait for you to step aside, and turn back from a wall
          if (you && Math.hypot(cx + nx - you.x, cz + nz - you.z) < 0.75) { speed = 0; w.wait = 0.5; }
          else if (blocked?.(cx + nx, cz + nz, 0.28)) { speed = 0; if (!w.slot && !w.away) { w.tx = b.position.x; w.tz = b.position.z; } }
          else { b.position.x = nx; b.position.z = nz; }
        }
        if (speed) {
          const want = Math.atan2(dx, dz);
          b.rotation.y += Math.atan2(Math.sin(want - b.rotation.y), Math.cos(want - b.rotation.y)) * Math.min(1, dt * 6);
          w.npc.x = cx + b.position.x; w.npc.z = cz + b.position.z;
        }
      }
      if (isShown(b)) animateCharacter(b, t, speed ? 0.9 : 0); // (not the far ones nobody sees)
    }
  }
  for (const h of houses) {
    if (h.i !== homeAt && h.i % 12) continue;
    const race = homeRace(h);
    const fam = familyOf(place.id, h.i, race);
    const out = h.d / 2 + 1.4;
    fam.parents.forEach((p, j) => {
      if (h.i === homeAt && opts.home.dead?.includes(j)) return; // passed away of old age
      const side = j ? 1.1 : -1.1;
      addNpc(race, h.x + (h.door?.x || 0) + h.fx * out - h.fz * side, h.z + (h.door?.z || 0) + h.fz * out + h.fx * side, h.rot, { kind: 'parent', name: p.name, job: p.job, mine: h.i === homeAt, house: h.i });
    });
  }
  // children playing in the playground
  open.kids.forEach(([x, z], i) => {
    const race = S.guards[(i * 3 + 1) % S.guards.length];
    addNpc(race, x, z, i, { kind: 'child', name: townName(monster ? 'monster' : 'player', seeded(`${place.id}:kid${i}`)), small: true });
  });
  const rnd = seeded(place.id);
  const side = monster ? 'monster' : 'player';
  [['merchant', 'Merchant'], ['businessman', 'Businessman'], ['merchant', 'Merchant'], ['businessman', 'Businessman'], ['merchant', 'Cloth Merchant'], ['merchant', 'Fruit Seller']].forEach(([kind, title], i) => {
    const a = (i / 6) * Math.PI * 2 + 0.3, r = PLAZA_R - 7;
    addNpc(S.guards[i % S.guards.length], Math.cos(a) * r, Math.sin(a) * r, Math.atan2(Math.cos(a), Math.sin(a)), { kind, title, name: townName(side, rnd) });
  });

  // ---------- the markets: stalls along the main roads, each with its seller, and shoppers ----------
  const STALL_LOOK = {
    stall_bread: [['#f0e2c0', '#b8782a'], ['#d8a85a', '#c89048', '#e8c890']], stall_greens: [['#e8d8a8', '#4a8a3a'], ['#e07020', '#6aa04a', '#c83a2a', '#e0b030']],
    stall_grill: [['#f0e4cc', '#a83a2a'], ['#8a4a2a', '#a85a3a', '#e8d0a0']], stall_drinks: [['#e8f0f0', '#2a7a8a'], ['#6ac8d0', '#e8a040', '#f0f0e0']],
    stall_cloth: [['#efe4d4', '#7a3a6a'], ['#c84a5a', '#4a6aa8', '#e8d8b0', '#6a8a4a']], stall_tools: [['#d8d0c0', '#4a4a4a'], ['#6a5a4a', '#8a8a8a', '#4a3a2a']],
    stall_herbs: [['#e8f0d8', '#3a6a3a'], ['#4a8a3a', '#8ac85a', '#c8d890']], stall_soup: [['#d8c8a8', '#8a5a2a'], ['#8a6a3a', '#c8a060', '#5a4a3a']],
    stall_sweets: [['#f8e8d8', '#c8506a'], ['#8a5a2a', '#c8a050', '#6a2a4a']], stall_roast: [['#f0e0c8', '#8a3a1a'], ['#9a5a2a', '#b8703a', '#e0c090']],
    stall_scrap: [['#a89a80', '#6a5a4a'], ['#7a5a3a', '#5a5a5a', '#8a6a4a', '#6a4a3a']],
  };
  const vendorRnd = seeded(`${place.id}:market`);
  // the stalls and the Dump's dirt patches never move: merged at the end like the houses (unmerged,
  // the market stalls alone were thousands of draw calls, and the game lagged in the city)
  const market = new THREE.Group();
  g.add(market);
  plan.stalls.forEach((st, i) => {
    const [colors, goods] = STALL_LOOK[st.id] || STALL_LOOK.stall_greens;
    const { group: sg, solid: parts } = marketStall(MARKETS[st.id].name, colors, goods);
    const y = ringRel(st.tier);
    sg.position.set(st.x, y, st.z); sg.rotation.y = st.rot;
    market.add(sg);
    const c = Math.cos(st.rot), sn = Math.sin(st.rot);
    const local = (lx, lz) => ({ x: st.x + lx * c + lz * sn, z: st.z - lx * sn + lz * c });
    for (const [lx, lz, r, height] of parts) { const w = local(lx, lz); solid.push({ x: cx + w.x, z: cz + w.z, r, kind: 'wall', height }); }
    // the seller behind the counter (talk to them to buy), and a shopper or two in front
    const v = local(0, -0.45);
    addNpc(S.guards[(i * 5 + 2) % S.guards.length], v.x, v.z, st.rot, { kind: 'stall', market: st.id, title: MARKETS[st.id].name, name: townName(side, vendorRnd), still: true });
    for (let k = 0; k < (i % 3 === 0 ? 2 : 1); k++) {
      const q = local((k ? 1 : -1) * 0.9, 2.1 + vendorRnd() * 0.8);
      addNpc(S.guards[(i * 3 + k + 4) % S.guards.length], q.x, q.z, st.rot + Math.PI, { kind: 'shopper', name: townName(side, vendorRnd), range: 5 });
    }
  });
  // a sign at each end of Market Street, where it meets the south road
  {
    const r = plan.marketStreet.r + plan.marketStreet.w / 2 + 1.2, y = ringRel('common');
    const postMat = matOf('#5a3e26', 1);
    for (const dir of [-1, 1]) {
      const a = dir * (11.5 / r);
      const at = new THREE.Group(); at.position.set(Math.sin(a) * r, y, Math.cos(a) * r); at.rotation.y = a + Math.PI / 2; market.add(at);
      for (const x of [-1.25, 1.25]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.4, 0.14), postMat); p.position.set(x, 1.7, 0); at.add(p); }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 0.16), postMat); bar.position.set(0, 3.42, 0); at.add(bar);
      const board = twoFacedSign('Market Street', 2.4, 0.55); board.position.set(0, 3.0, 0); at.add(board);
      for (const x of [-1.25, 1.25]) { const w = { x: at.position.x + Math.cos(at.rotation.y) * x, z: at.position.z - Math.sin(at.rotation.y) * x }; solid.push({ x: cx + w.x, z: cz + w.z, r: 0.15, kind: 'wall', height: 3.4 }); }
    }
  }
  // ---------- life in the Dump: children playing in the dirt, folk lying or sitting about ----------
  const dirtMat = matOf('#6e5e46', 1, { polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -24 });
  const ballMats = ['#c8402a', '#3a6ab0', '#d8b030'].map((col) => matOf(col, 0.6));
  plan.yards.forEach((Y) => {
    const y = ringRel(Y.tier);
    const patch = new THREE.Mesh(new THREE.CircleGeometry(3.2, 16), dirtMat);
    patch.rotation.x = -Math.PI / 2; patch.position.set(Y.x, y + 0.03, Y.z); market.add(patch);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), ballMats[Y.seed % 3]);
    ball.position.set(Y.x + 0.8, y + 0.16, Y.z - 0.5); ball.castShadow = true; market.add(ball);
    for (let k = 0; k < Y.kids; k++) {
      const a = (k / Y.kids) * Math.PI * 2 + Y.seed;
      const x = Y.x + Math.cos(a) * 1.8, z = Y.z + Math.sin(a) * 1.8;
      addNpc(S.guards[(Y.seed * 3 + k) % S.guards.length], x, z, a + Math.PI, { kind: 'child', name: townName(side, vendorRnd), small: true, range: 3 });
    }
  });
  const blanketMats = ['#6a5a48', '#7a4a3a', '#5a5a4a', '#8a7a5a'].map((col) => matOf(col, 1, { polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -24 }));
  plan.idlers.forEach((I) => {
    const y = ringRel(I.tier);
    const race = S.guards[(I.seed * 7 + 3) % S.guards.length];
    const H = bodyHeight(race, 'humanoid');
    const face = I.a + Math.PI / 2 + (I.seed % 2 ? 0.4 : -0.4);
    const at = new THREE.Group(); at.position.set(I.x, y, I.z); at.rotation.y = face; g.add(at);
    const blanket = new THREE.Mesh(new THREE.PlaneGeometry(I.pose === 'lying' ? 1.1 : 1.2, I.pose === 'lying' ? H + 0.3 : 1.2), blanketMats[I.seed % 4]);
    blanket.rotation.x = -Math.PI / 2; blanket.position.set(0, 0.03, I.pose === 'lying' ? -H / 2 : 0.2); at.add(blanket);
    // built only when you come near (like all townsfolk)
    const body = lazyCharacter(() => {
      const b = buildCharacter({ race, form: 'humanoid', look: {} });
      const h = b.userData.height || H;
      if (I.pose === 'lying') {
        // flat on their back on an old blanket, asleep
        b.rotation.x = -Math.PI / 2; b.position.y = 0.14;
      } else {
        // sitting on the ground, legs out in front
        const leg = b.userData.rig?.legs?.[0];
        for (const l of b.userData.rig?.legs || []) l.hip.rotation.x = -Math.PI / 2;
        b.position.y = Math.max(-(leg?.thighLen ?? h * 0.25) - (leg?.shinLen ?? h * 0.25) + 0.08, -h * 0.6);
      }
      return b;
    }, H);
    at.add(body);
    solid.push({ x: cx + I.x, z: cz + I.z, r: 0.5, kind: 'wall', height: 0.5 });
    npcs.push({ kind: 'idler', name: townName(side, vendorRnd), pose: I.pose, x: cx + I.x, z: cz + I.z });
  });
  mergeStill(market, { cell: 120 });
  // ---------- the checkpoint: the waystone in the Dump where you rise again after a death ----------
  {
    const C = plan.checkpoint, y = ringRel(C.tier);
    const cp = new THREE.Group(); cp.position.set(C.x, y, C.z); g.add(cp);
    const stoneM = matOf('#8a857a', 0.9), runeM = new THREE.MeshStandardMaterial({ color: '#f5c84c', emissive: '#f5a81c', emissiveIntensity: 1.6, roughness: 0.3 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.3, 16), stoneM); base.position.y = 0.15; cp.add(base);
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.6, 0.5), stoneM); pillar.position.y = 1.6; cp.add(pillar);
    for (const sd of [1, -1]) { const r = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 1.4), runeM); r.position.set(0, 1.7, sd * 0.26); if (sd < 0) r.rotation.y = Math.PI; cp.add(r); }
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), runeM); gem.position.y = 3.15; cp.add(gem);
    cp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.45), new THREE.MeshBasicMaterial({ map: textTexture('Checkpoint', { board: true }) }));
    board.position.set(0, 0.75, 0.9); cp.rotation.y = C.rot; cp.add(board);
    const back = board.clone(); back.rotation.y = Math.PI; back.position.z = 0.88; cp.add(back);
    solid.push({ x: cx + C.x, z: cz + C.z, r: 1.4, kind: 'wall', height: 3, step: false });
  }
  const glow = decorate(g, S, cx, cz, solid);
  let detailAt = -1;
  const update = (t, you, blocked) => {
    centre.update?.(t);
    if (you && t - detailAt > 0.5) { detailAt = t; showDetail(fixed, you.x, you.z, detailFar()); doors.lod(you, detailFar() + 20); for (const sg of saleSigns.values()) sg.lod(you, detailFar()); }
    doors.update(you, t);
    for (const b of guards) if (isShown(b)) animateCharacter(b, t, 0);
    walkFolk(t, you, blocked);
    for (const b of bridges) b.update();
    castleGrounds?.update(t, you);
    glow?.(t);
  };
  // raise or lower the bridges over the moat (raised, they shut the inner gates)
  const setRaised = (up, colliders) => { for (const b of bridges) b.raise(up, colliders); };
  // walking on a lowered bridge: its deck, to stand on
  const cityY = heightAt(cx, cz);
  const deckAt = (x, z) => {
    for (const b of bridges) { const y = b.deckAt(x, z); if (y !== undefined) return y; }
    const top = castleGrounds?.topAt(x, z);
    if (top !== undefined) return top;
    const pad = padAt(pads, x, z);
    if (pad !== undefined) return cityY + pad;
    // the walk along the top of a terrace wall, and the ramps (exact, not as the land is drawn)
    const dx = x - cx, dz = z - cz, r = Math.hypot(dx, dz);
    if (r > INNER_R) return undefined;
    const on = rampAt(dx, dz);
    if (on) return cityY + on.y - TOP_Y;
    for (const B of rampBands) if (r > B.r0 && r < B.r1 && !rampAt(dx, dz, RAMP_WALL)) return cityY + B.y;
    return undefined;
  };
  // in the moat's water (and not on a bridge)
  const inMoat = (x, z) => { const d = Math.hypot(x - cx, z - cz); return d > MOAT[0] && d < MOAT[1] && deckAt(x, z) === undefined; };

  // pulled out of the moat: onto the middle of the nearest bridge, the same way along it
  const rescue = (x, z) => {
    const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
    const ga = GATE_ANGLES.reduce((b, a) => (Math.sin(a) * dx + Math.cos(a) * dz > Math.sin(b) * dx + Math.cos(b) * dz ? a : b));
    return { x: cx + Math.sin(ga) * d, z: cz + Math.cos(ga) * d };
  };

  // the houses for sale: show who owns each (`owners`: house id -> owner's name)
  const setOwners = (owners) => { for (const [id, sign] of saleSigns) sign.set(owners?.[id] || null, plan.sale.find((h) => h.id === id)); };
  setOwners({});
  return { group: g, update, gather, shops, solid, gates, innerGates, npcs, setRaised, deckAt, inMoat, rescue, setOwners, doors, centre: { x: cx, z: cz }, checkpoint: { x: cx + plan.checkpoint.x + plan.checkpoint.fx * 3.4, z: cz + plan.checkpoint.z + plan.checkpoint.fz * 3.4 } };
}

// The rings' floors (see buildCity): grassy lawns on Castle Hill, in the Noble and the Common
// Quarter, packed earth in the Dump. Built as one polar grid per ring, about 1.5 m a cell round,
// with the cells over a ramp cut left out.
const FLOOR_LOOK = { castle: '#5f7d38', noble: '#5a7a34', common: '#667a3c', dump: '#6e5e46' };
let floorTex = null;
function floorTexture() {
  if (floorTex) return floorTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(128, 128);
  let sd = 9;
  const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  for (let i = 0; i < 128 * 128; i++) { const v = 205 + rnd() * 50; img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v * 0.97; img.data[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  floorTex = new THREE.CanvasTexture(c);
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.colorSpace = THREE.SRGBColorSpace;
  return floorTex;
}
function ringFloors(S, monster, ringRel) {
  const group = new THREE.Group();
  const cut = (k, x, z) => RAMPS.some((R) => {
    if (R.k !== k) return false;
    const { along, lat } = alongRoad(x, z, R.a), b = TIERS[k].r1;
    return Math.abs(lat) < ROAD_HALF + RAMP_WALL / 2 && along > b - RAMP_IN - 0.5 && along < b + TERRACE + 1;
  });
  TIERS.forEach((T, k) => {
    const r0 = k === 0 ? 0.5 : TIERS[k - 1].r1 + TERRACE - 0.8;
    const r1 = k === TIERS.length - 1 ? INNER_R + 0.6 : T.r1 + TERRACE - 0.6;
    // rows: every 2 m near the terrace (where the ramps cut in), wider apart elsewhere
    const rows = [r0];
    const fine = k < TIERS.length - 1 ? T.r1 - RAMP_IN - 1 : Infinity;
    while (rows[rows.length - 1] < r1 - 0.01) { const last = rows[rows.length - 1]; rows.push(Math.min(r1, last + (last >= fine - 0.01 ? 2 : Math.max(4, Math.min(12, fine - last))))); }
    const n = Math.ceil((2 * Math.PI * r1) / 1.5);
    const pos = [], uv = [], idx = [];
    const y = ringRel(T.id);
    for (const r of rows) for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, x = Math.sin(a) * r, z = Math.cos(a) * r; pos.push(x, y, z); uv.push(x / 6, z / 6); }
    for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < n; i++) {
      const am = ((i + 0.5) / n) * Math.PI * 2, rm = (rows[j] + rows[j + 1]) / 2;
      if (cut(k, Math.sin(am) * rm, Math.cos(am) * rm)) continue;
      const a = j * (n + 1) + i, b2 = a + 1, c = a + n + 1, d = c + 1;
      idx.push(a, b2, c, b2, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    if (geo.attributes.normal.getY(0) < 0) { for (let q = 0; q < idx.length; q += 3) [idx[q + 1], idx[q + 2]] = [idx[q + 2], idx[q + 1]]; geo.setIndex(idx); geo.computeVertexNormals(); }
    const color = monster && T.id !== 'dump' ? (S.ground || FLOOR_LOOK[T.id]) : FLOOR_LOOK[T.id];
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, map: floorTexture(), roughness: 1, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 4 }));
    m.receiveShadow = true;
    group.add(m);
  });
  return group;
}

// The open ground of the Common Quarter: the lots kept for Businessmen's shops on the market
// street, and the children's playground by the west road (see data/citylayout.mjs). Each is laid
// out in its own space, turned to face the ring road.
function quarters(g, S, solid, cx, cz, plan, ringRel) {
  const wood = matOf('#7a5a3a', 0.9), dark = matOf('#4a3424', 0.9), sand = matOf('#cdb88a', 1), rope = matOf('#c8b48a', 0.9);
  // a spot in its own space (x along the street, z out towards it), turned onto the ring
  const space = (p) => {
    const sg = new THREE.Group();
    sg.position.set(p.x, ringRel(p.tier), p.z);
    sg.rotation.y = Math.atan2(Math.sin(p.a), Math.cos(p.a));
    g.add(sg);
    const c = Math.cos(sg.rotation.y), sn = Math.sin(sg.rotation.y);
    const world = (lx, lz) => ({ x: p.x + lx * c + lz * sn, z: p.z - lx * sn + lz * c });
    const add = (geo, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = true; o.receiveShadow = true; sg.add(o); return o; };
    const put = (lx, lz, r, height) => { const w = world(lx, lz); solid.push({ x: cx + w.x, z: cz + w.z, r, kind: 'wall', height }); };
    const flat = (w, d, m, x, z, y = 0.025, layer = 7) => {
      const lm = matOf('#' + m.color.getHexString(), m.roughness, { polygonOffset: true, polygonOffsetFactor: -layer, polygonOffsetUnits: -4 * layer });
      const o = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lm); o.rotation.x = -Math.PI / 2; o.position.set(x, y, z); o.receiveShadow = true; sg.add(o); return o;
    };
    // a signpost: a wooden board hung beside its post, the name on both faces
    const sign = (text, x, z, ry) => {
      const sp = new THREE.Group();
      sp.position.set(x, 0, z); sp.rotation.y = ry; sg.add(sp);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.5, 6), dark);
      post.position.set(-1.38, 1.25, 0); sp.add(post);
      put(x - 1.38 * Math.cos(ry), z + 1.38 * Math.sin(ry), 0.25, 2.5);
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.72, 0.06), wood);
      back.position.set(0, 2, 0); sp.add(back);
      const tex = textTexture(text, { board: true });
      for (const side of [1, -1]) {
        const face = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.62), new THREE.MeshBasicMaterial({ map: tex }));
        face.position.set(0, 2, side * 0.035); face.rotation.y = side > 0 ? 0 : Math.PI; sp.add(face);
      }
    };
    return { sg, world, add, put, flat, sign };
  };
  // Shop lots: marked out with corner stones and a sign, waiting for a Businessman
  for (const L of plan.lots) {
    const { sg, add, sign } = space(L);
    const lot = paved(L.size, L.size, S.paving, false, 7); lot.position.set(0, 0.022, 0); sg.add(lot);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(0.5, 0.5, 0.5), dark, sx * L.size / 2, 0.25, sz * L.size / 2);
    sign('Shop lot: for Businessmen', 0, L.size / 2 + 1, 0);
  }
  // the playground: a sandpit, swings, a see-saw and a slide
  const P = plan.playground;
  const { add, put, flat, sign, world } = space(P);
  flat(P.w, P.d, matOf('#7fa24a', 1), 0, 0, 0.02);
  flat(5, 5, sand, -4.5, -1.5, 0.03, 8);
  for (const sx of [-1.6, 1.6]) for (const sz of [-1, 1]) {
    const leg = add(new THREE.CylinderGeometry(0.07, 0.07, 3, 6), wood, 4 + sx, 1.45, -1 + sz * 0.7);
    leg.rotation.x = -sz * 0.22;
  }
  add(new THREE.BoxGeometry(4.2, 0.12, 0.12), wood, 4, 2.9, -1);
  for (const sx of [-0.8, 0.8]) {
    for (const rx of [-0.25, 0.25]) add(new THREE.CylinderGeometry(0.015, 0.015, 2.2, 4), rope, 4 + sx + rx, 1.8, -1);
    add(new THREE.BoxGeometry(0.6, 0.06, 0.3), dark, 4 + sx, 0.7, -1);
  }
  put(4, -1, 1.6, 3);
  const plank = add(new THREE.BoxGeometry(4, 0.1, 0.35), wood, -4, 0.55, 3); plank.rotation.z = 0.12;
  add(new THREE.BoxGeometry(0.4, 0.5, 0.4), dark, -4, 0.25, 3);
  const slide = add(new THREE.BoxGeometry(0.9, 0.08, 3.4), matOf('#c8503a', 0.6), 0.5, 1.1, -1.5); slide.rotation.x = 0.5;
  add(new THREE.BoxGeometry(1.2, 2.2, 1.2), wood, 0.5, 1.1, -3.6);
  put(0.5, -2.6, 1.4, 2.2);
  sign('Playground', 0, P.d / 2 + 1, 0);
  const kids = [[-4.5, -1.5], [-3, 0], [4, 1], [0, 2], [-2, 3], [2, 3.5]].map(([lx, lz]) => { const w = world(lx, lz); return [w.x, w.z]; });
  return { kids };
}

// A manor's garden: a low hedge round its sides and back, with trimmed trees at the front corners
function garden(fixed, h, y, solid, cx, cz) {
  const hedge = matOf('#3e6a32', 1), trunk = matOf('#5a4030', 0.9), leaf = matOf('#4a7a3a', 1);
  const g = new THREE.Group();
  g.position.set(h.x, y, h.z);
  g.rotation.y = h.rot;
  fixed.add(g);
  const W = h.w + 5, D = h.d + 5, c = Math.cos(h.rot), s = Math.sin(h.rot);
  const run = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 1.1, 0.7), hedge);
    m.position.set((x0 + x1) / 2, 0.55, (z0 + z1) / 2);
    m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
    g.add(m);
    for (let t = 0; t <= len; t += 1.6) {
      const lx = x0 + (x1 - x0) * (t / len), lz = z0 + (z1 - z0) * (t / len);
      solid.push({ x: cx + h.x + lx * c + lz * s, z: cz + h.z - lx * s + lz * c, r: 0.5, kind: 'wall', height: 1.1, step: false });
    }
  };
  run(-W / 2, -D / 2, W / 2, -D / 2);
  run(-W / 2, -D / 2, -W / 2, D / 2 - 1);
  run(W / 2, -D / 2, W / 2, D / 2 - 1);
  for (const sx of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.6, 6), trunk);
    t.position.set(sx * (W / 2 - 1), 0.8, D / 2 - 1.5);
    const b = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), leaf);
    b.position.set(sx * (W / 2 - 1), 2.3, D / 2 - 1.5);
    g.add(t, b);
    solid.push({ x: cx + h.x + sx * (W / 2 - 1) * c + (D / 2 - 1.5) * s, z: cz + h.z - sx * (W / 2 - 1) * s + (D / 2 - 1.5) * c, r: 0.4, kind: 'wall', height: 3 });
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}

// The board in front of a house for sale: "For sale" and its price, or, once bought, whose it is.
// Returns { set(owner, house) }.
// The posts and board go in `fixed` (merged with the houses); only the two painted faces stay
// pieces of their own, and they are drawn only near (see lod).
function houseSign(g, fixed, x, y, z, rot, solid, cx, cz) {
  const sp = new THREE.Group(), words = new THREE.Group();
  for (const o of [sp, words]) { o.position.set(x, y, z); o.rotation.y = rot; }
  fixed.add(sp); g.add(words);
  // two posts at the ends, the board hung between them, so nothing ever covers the words
  const W = 2.3, BH = 0.7, Y = 1.55;
  for (const px of [-W / 2 - 0.08, W / 2 + 0.08]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.1, 6), matOf('#4a3424', 0.9));
    post.position.set(px, 1.05, 0);
    sp.add(post);
    const at = new THREE.Vector3(px, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    solid.push({ x: cx + x + at.x, z: cz + z + at.z, r: 0.22, kind: 'wall', height: 2.1 });
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.08, 0.08), matOf('#4a3424', 0.9));
  bar.position.y = 2.05;
  sp.add(bar);
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, BH, 0.06), matOf('#7a5a3a', 0.9));
  board.position.y = Y;
  sp.add(board);
  const faces = [1, -1].map((side) => {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.06, BH - 0.06), new THREE.MeshBasicMaterial());
    f.position.set(0, Y, side * 0.04); f.rotation.y = side > 0 ? 0 : Math.PI;
    words.add(f);
    return f;
  });
  let shown = undefined;
  return {
    // the words can only be read close up: further than `far` they aren't drawn
    lod(you, far) { const show = Math.hypot(you.x - cx - x, you.z - cz - z) < far; if (words.visible !== show) words.visible = show; },
    set(owner, house) {
      const text = owner ? `Home of ${owner}` : `For sale · ${moneyWords(house.price)}`;
      if (text === shown) return;
      shown = text;
      const tex = textTexture(text, { board: true });
      for (const f of faces) { f.material.map?.dispose(); f.material.map = tex; f.material.needsUpdate = true; }
    },
  };
}

// A pile of junk in the Dump: broken crates, an old barrel, planks, a cart wheel
function junkPile(fixed, j, y, solid, cx, cz) {
  const R = seeded(`junk${j.seed}`);
  const woods = ['#6a5038', '#5a4430', '#7a5c3e'].map((c) => matOf(c, 1)), rust = matOf('#7a4a2a', 0.8);
  const g = new THREE.Group();
  g.position.set(j.x, y, j.z);
  g.rotation.y = R() * 6;
  fixed.add(g);
  const k = j.size;
  for (let i = 0; i < 3 + Math.floor(R() * 3); i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.6 * k, 0.5 * k, 0.6 * k), woods[i % 3]);
    c.position.set((R() - 0.5) * 1.4 * k, 0.25 * k + (i > 2 ? 0.5 * k : 0), (R() - 0.5) * 1.4 * k);
    c.rotation.set((R() - 0.5) * 0.4, R() * 3, (R() - 0.5) * 0.4);
    g.add(c);
  }
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * k, 0.32 * k, 0.8 * k, 10), rust);
  barrel.position.set(0.9 * k, 0.32 * k, -0.4 * k); barrel.rotation.z = Math.PI / 2; barrel.rotation.y = R() * 3;
  g.add(barrel);
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(2 * k, 0.05, 0.22), woods[(i + 1) % 3]);
    p.position.set((R() - 0.5) * k, 0.1 + i * 0.06, (R() - 0.5) * k); p.rotation.set(0, R() * 3, (R() - 0.5) * 0.3);
    g.add(p);
  }
  if (R() < 0.5) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 5, 12), woods[0]); w.position.set(-0.8 * k, 0.5, 0.6 * k); w.rotation.set(0.3, R() * 3, 0.2); g.add(w); }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  solid.push({ x: cx + j.x, z: cz + j.z, r: 1.1 * k, kind: 'wall', height: 1.2 * k, y: undefined });
}

// The Emperors' Castle grounds: a curtain wall round the keep with a gate (its portcullis rises as
// you come), a wall-walk on top for archers with stairs up to it, guards at the gate and on the
// walls, a paved path from the gate, and steps up to the great door. Built in the keep's own space
// (`k`, turned by `rot`). Returns { topAt(x, z): what you stand on there (the wall-walk, the
// stairs, the steps), update }.
const STEP_UP = 1.2; // the keep's door stands this high, up a flight of steps
const YARD = { x0: -21, x1: 21, z0: -17, z1: 23, h: 6, gate: 3.2 };
function buildCastleGrounds(k, C, rot, cx, cz, solid, S) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const ox = cx + C.x, oz = cz + C.z;
  const base = heightAt(ox, oz);
  const toWorld = (lx, lz) => ({ x: ox + lx * c + lz * s, z: oz - lx * s + lz * c });
  const toLocal = (x, z) => { const dx = x - ox, dz = z - oz; return { lx: dx * c - dz * s, lz: dx * s + dz * c }; };
  const stone = matOf('#8a8274', 0.95), dark = matOf('#6a6458', 0.95), paving = matOf('#a49a86', 0.95);
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; k.add(o); return o; };
  const put = (lx, lz, r, height, y = base) => { const w = toWorld(lx, lz); solid.push({ x: w.x, z: w.z, r, kind: 'wall', height, y }); };
  const { x0, x1, z0, z1, h, gate } = YARD;
  // the curtain wall, with merlons along its outer edge to shoot from behind
  const wallRun = (ax, az, bx, bz, outX, outZ) => {
    const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
    const w = add(new THREE.BoxGeometry(len + 1.6, h, 1.6), stone, (ax + bx) / 2, h / 2, (az + bz) / 2);
    w.rotation.y = Math.atan2(-uz, ux);
    for (let t = 0.6; t < len; t += 1.8) {
      const m = add(new THREE.BoxGeometry(0.9, 1, 0.4), stone, ax + ux * t + outX * 0.6, h + 0.5, az + uz * t + outZ * 0.6);
      m.rotation.y = w.rotation.y;
    }
    for (let t = 0; t <= len; t += 1.4) put(ax + ux * t, az + uz * t, 1.0, h);
  };
  wallRun(x0, z0, x1, z0, 0, -1);           // back
  wallRun(x0, z0, x0, z1, -1, 0);           // sides
  wallRun(x1, z0, x1, z1, 1, 0);
  wallRun(x0, z1, -gate, z1, 0, 1);         // front, either side of the gate
  wallRun(gate, z1, x1, z1, 0, 1);
  // the walk over the gate, and the gatehouse arch above it
  add(new THREE.BoxGeometry(gate * 2, 1.2, 1.6), stone, 0, h - 0.6, z1);
  for (const sx of [-1, 1]) { add(new THREE.BoxGeometry(1.4, h + 3, 2.4), dark, sx * (gate + 0.7), (h + 3) / 2, z1); put(sx * (gate + 0.7), z1, 1.3, h + 3); }
  const crest = add(new THREE.BoxGeometry(gate * 2 + 2.8, 1.4, 0.6), dark, 0, h + 2.3, z1 + 0.9);
  crest.receiveShadow = true;
  // round towers at the corners
  for (const [tx, tz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
    add(new THREE.CylinderGeometry(2.4, 2.7, h + 3, 12), stone, tx, (h + 3) / 2, tz);
    add(new THREE.ConeGeometry(3, 3.2, 12), matOf('#3a3e5a', 0.8), tx, h + 4.6, tz);
    put(tx, tz, 2.7, h + 3);
  }
  // the portcullis: iron bars that rise into the arch while anyone is near the gate
  const port = new THREE.Group();
  const iron = matOf('#2e2c2a', 0.5, { metalness: 0.6 });
  for (let x = -gate + 0.3; x <= gate - 0.2; x += 0.55) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, h - 1.2, 0.1), iron); b.position.set(x, (h - 1.2) / 2, 0); port.add(b); }
  for (const y of [1, 2.4, 3.8]) { const b = new THREE.Mesh(new THREE.BoxGeometry(gate * 2, 0.1, 0.1), iron); b.position.set(0, y, 0); port.add(b); }
  port.position.set(0, 0, z1 + 0.6);
  k.add(port);
  let lift = 0;
  // the paved path from the gate to the steps, and the steps up to the great door
  const path = add(new THREE.BoxGeometry(5, 0.06, z1 - C.d / 2 - 7), paving, 0, 0.03, (z1 + C.d / 2 + 7) / 2);
  path.castShadow = false;
  const landing = { z0: C.d / 2, z1: C.d / 2 + 3.6 }, stepsTo = landing.z1 + 3.6, nSteps = 6;
  add(new THREE.BoxGeometry(9, STEP_UP, landing.z1 - landing.z0), stone, 0, STEP_UP / 2, (landing.z0 + landing.z1) / 2);
  for (let i = 0; i < nSteps; i++) {
    const top = STEP_UP * (nSteps - i) / nSteps, zz = landing.z1 + (i + 0.5) * (stepsTo - landing.z1) / nSteps;
    add(new THREE.BoxGeometry(7, top, (stepsTo - landing.z1) / nSteps), stone, 0, top / 2, zz);
  }
  // stone stairs up the inside of the front wall to the wall-walk (the right side, coming in)
  const st = { x0: 8, x1: 19, z0: z1 - 2.6, z1: z1 - 0.8, n: 14 };
  for (let i = 0; i < st.n; i++) {
    const top = h * (i + 1) / st.n, xx = st.x0 + (i + 0.5) * (st.x1 - st.x0) / st.n;
    add(new THREE.BoxGeometry((st.x1 - st.x0) / st.n, top, st.z1 - st.z0), dark, xx, top / 2, (st.z0 + st.z1) / 2);
  }
  // guards: two at the gate and archers up on the walls
  const guards = [];
  const gearOf = Object.fromEntries(Object.entries(S.gear).map(([key, id]) => [key, ITEMS[id]]));
  const guard = (lx, lz, y, face, race) => {
    const b = lazyGuard(race, gearOf);
    b.position.set(lx, y, lz); b.rotation.y = face;
    k.add(b); guards.push(b);
    if (!y) put(lx, lz, 0.6, 2);
  };
  guard(-gate - 1.6, z1 + 2, 0, 0, 'dwarf'); guard(gate + 1.6, z1 + 2, 0, 0, 'elf');
  guard(-12, z1, h, 0, 'elf'); guard(12, z1, h, 0, 'beastkin'); guard(x0, 4, h, -Math.PI / 2, 'elf'); guard(x1, 4, h, Math.PI / 2, 'hobbit'); guard(0, z0, h, Math.PI, 'elf');
  // what you stand on: the wall-walk (1.6 m wide on top of the walls), the stairs and the steps
  const onWall = (lx, lz) => (Math.abs(lz - z0) < 0.8 || Math.abs(lz - z1) < 0.8) && lx > x0 - 0.8 && lx < x1 + 0.8
    || (Math.abs(lx - x0) < 0.8 || Math.abs(lx - x1) < 0.8) && lz > z0 - 0.8 && lz < z1 + 0.8;
  return {
    topAt(x, z) {
      const { lx, lz } = toLocal(x, z);
      if (lx < x0 - 3 || lx > x1 + 3 || lz < z0 - 3 || lz > z1 + 3) return undefined;
      if (onWall(lx, lz)) return base + h;
      if (lx > st.x0 && lx < st.x1 && lz > st.z0 && lz < st.z1) return base + h * Math.min(st.n, Math.floor((lx - st.x0) / (st.x1 - st.x0) * st.n) + 1) / st.n;
      if (Math.abs(lx) < 4.5 && lz > landing.z0 && lz <= landing.z1) return base + STEP_UP;
      if (Math.abs(lx) < 3.5 && lz > landing.z1 && lz < stepsTo) return base + STEP_UP * (nSteps - Math.floor((lz - landing.z1) / (stepsTo - landing.z1) * nSteps)) / nSteps;
      return undefined;
    },
    update(t, you) {
      for (const b of guards) if (isShown(b)) animateCharacter(b, t, 0);
      const g = toWorld(0, z1);
      const near = you && Math.hypot(you.x - g.x, you.z - g.z) < 9;
      lift += ((near ? h - 1.4 : 0) - lift) * 0.05;
      port.position.y = lift;
    },
  };
}

// The outer fortress wall at CITY_R with two great gates, the moat inside it, and the inner wall at
// INNER_R with a gate behind each bridge. Returns the bridges, which can be raised.
function walls(g, live, S, wallMat, cx, cz, solid) {
  const angleOff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const inGate = (a, R) => GATE_ANGLES.some((ga) => angleOff(a, ga) < GATE_HALF / R);
  const ring = (R, height, thick) => {
    const seg = 4;
    const n = Math.round((2 * Math.PI * R) / seg);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (inGate(a, R)) continue;
      const x = Math.sin(a) * R, z = Math.cos(a) * R;
      const w = new THREE.Mesh(new THREE.BoxGeometry(seg + 0.3, height, thick), wallMat);
      w.position.set(x, height / 2, z);
      w.rotation.y = a;
      w.castShadow = true; w.receiveShadow = true;
      g.add(w);
      // battlements along the top
      if (i % 2 === 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, thick), wallMat); m.position.set(x, height + 0.55, z); m.rotation.y = a; g.add(m); }
      solid.push({ x: cx + x, z: cz + z, r: thick, kind: 'wall', height }, { x: cx + Math.sin(a + 1 / R) * R, z: cz + Math.cos(a + 1 / R) * R, r: thick, kind: 'wall', height });
    }
    // a tower either side of each gate
    for (const ga of GATE_ANGLES) {
      for (const side of [-1, 1]) {
        const a = ga + side * ((GATE_HALF + 1.8) / R);
        const t = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.6, height + 4, 12), wallMat);
        t.position.set(Math.sin(a) * R, (height + 4) / 2, Math.cos(a) * R);
        const top = new THREE.Mesh(new THREE.ConeGeometry(2.9, 3, 12), matOf(S.tones[0][1], 0.8));
        top.position.set(t.position.x, height + 5.5, t.position.z);
        t.castShadow = true;
        g.add(t, top);
        solid.push({ x: cx + t.position.x, z: cz + t.position.z, r: 2.6, kind: 'wall', height: height + 4 });
      }
      // the arch over the gate
      const arch = new THREE.Mesh(new THREE.BoxGeometry(GATE_HALF * 2 + 1, 2, thick + 0.4), wallMat);
      arch.position.set(Math.sin(ga) * R, height - 1, Math.cos(ga) * R);
      arch.rotation.y = ga;
      g.add(arch);
    }
  };
  ring(CITY_R, 9, 2);       // the outer fortress wall
  ring(INNER_R, 7, 1.6);    // the inner wall

  // the moat: water between stone banks, all the way round between the walls
  const [m0, m1] = MOAT;
  const water = new THREE.Mesh(new THREE.RingGeometry(m0, m1, 128, 1), new THREE.MeshStandardMaterial({ color: '#2a5a7a', roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.88 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.05;
  live.add(water);
  const bank = matOf('#6a665e', 0.95);
  for (const R of [m0, m1]) {
    const kerb = new THREE.Mesh(new THREE.TorusGeometry(R, 0.25, 4, 160), bank);
    kerb.rotation.x = -Math.PI / 2;
    kerb.position.y = 0.12;
    g.add(kerb);
  }
  // the moat is deep: anyone who falls in is pulled out by the watch, or drowns if they don't
  // belong in the city (see inMoat and world.js)

  // the bridges: hinged at the inner gate; raised, they stand up and shut it
  const wood = new THREE.MeshStandardMaterial({ color: '#6a4a2a', roughness: 0.9 });
  const ironMat = new THREE.MeshStandardMaterial({ color: '#3a3a40', metalness: 0.7, roughness: 0.5 });
  const len = CITY_R - INNER_R - 1;
  return GATE_ANGLES.map((ga) => {
    const hinge = new THREE.Group();
    hinge.position.set(Math.sin(ga) * (INNER_R + 0.6), 0.2, Math.cos(ga) * (INNER_R + 0.6));
    hinge.rotation.y = ga;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(GATE_HALF * 2 - 1, 0.35, len), wood);
    deck.position.z = len / 2;
    deck.castShadow = true; deck.receiveShadow = true;
    hinge.add(deck);
    for (const sx of [-1, 1]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, len, 6), ironMat); ch.rotation.x = Math.PI / 2; ch.position.set(sx * (GATE_HALF - 0.8), 0.3, len / 2); hinge.add(ch); }
    live.add(hinge);
    // when raised: solid across the gap, so nobody gets in (or out)
    const block = [];
    for (let s2 = -GATE_HALF + 1; s2 <= GATE_HALF - 1; s2 += 1.6) block.push({ x: cx + Math.sin(ga) * (INNER_R + 1) + Math.cos(ga) * s2, z: cz + Math.cos(ga) * (INNER_R + 1) - Math.sin(ga) * s2, r: 1, kind: 'wall', height: 8 });
    let up = false, tilt = 0;
    const baseY = heightAt(cx + Math.sin(ga) * (INNER_R + 6), cz + Math.cos(ga) * (INNER_R + 6));
    return {
      // the top of the deck under (x, z), if it is lowered and you are on it
      deckAt(x, z) {
        if (up) return undefined;
        const dx = x - cx, dz = z - cz;
        const along = dx * Math.sin(ga) + dz * Math.cos(ga), lat = dx * Math.cos(ga) - dz * Math.sin(ga);
        return along > INNER_R - 0.5 && along < INNER_R + 0.6 + len + 0.5 && Math.abs(lat) < GATE_HALF - 0.4 ? baseY + 0.2 + 0.175 : undefined;
      },
      // `colliders` is the world's store: the gap is made solid while the bridge is up
      raise(v, colliders) {
        if (!!v === up) return;
        up = !!v;
        if (up) colliders?.add(block); else colliders?.remove(block);
      },
      update() {
        const want = up ? -Math.PI / 2 : 0;
        tilt += Math.max(-0.02, Math.min(0.02, want - tilt));
        hinge.rotation.x = tilt;
      },
    };
  });
}

// What makes each Monster City its own: lava pools in the Peaks, bone spikes in the Wastes, floating
// crystals on the Fae Isles, reeds and stilt-posts in Mirefall. Returns an animation, if any.
function decorate(g, S, cx, cz, solid) {
  const baseY = heightAt(cx, cz);
  const at = (a, r) => ({ x: Math.cos(a) * r, z: Math.sin(a) * r });
  const glowMat = (c, e, k = 2) => new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: k, roughness: 0.4 });
  if (S.decor === 'lava') {
    const lava = glowMat('#ff7a1a', '#ff4a00', 2.4), rock = new THREE.MeshStandardMaterial({ color: '#1e1a1a', roughness: 0.9 });
    const pools = [];
    for (let i = 0; i < 6; i++) {
      const p = at((i / 6) * Math.PI * 2 + 0.5, 22);
      const pool = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20), lava);
      pool.rotation.x = -Math.PI / 2; pool.position.set(p.x, 0.06, p.z);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.35, 6, 20), rock);
      rim.rotation.x = -Math.PI / 2; rim.position.set(p.x, 0.15, p.z);
      g.add(pool, rim); pools.push(pool);
      solid.push({ x: cx + p.x, z: cz + p.z, r: 2.5, kind: 'wall', height: 1 });
    }
    for (let i = 0; i < 14; i++) {
      const p = at((i / 14) * Math.PI * 2 + 0.22, INNER_R - 3.5); // just inside the inner wall, clear of the roads
      const spike = new THREE.Mesh(new THREE.ConeGeometry(1.2, 6 + (i % 4) * 2, 5), rock);
      spike.position.set(p.x, heightAt(cx + p.x, cz + p.z) - baseY + 3, p.z);
      g.add(spike);
      solid.push({ x: cx + p.x, z: cz + p.z, r: 1.1, kind: 'wall', height: 8 });
    }
    return (t) => { lava.emissiveIntensity = 2 + Math.sin(t * 1.7) * 0.6; };
  }
  if (S.decor === 'bones') {
    const bone = new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.7 });
    const n = 48;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if ([0, 1, 2, 3].some((k) => Math.abs(Math.atan2(Math.sin(a - (k * Math.PI) / 2), Math.cos(a - (k * Math.PI) / 2))) < 0.08)) continue;
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.35, 3, 6), bone);
      tusk.position.set(Math.sin(a) * (CITY_R - 1.5), 6.8 + heightAt(cx + Math.sin(a) * (CITY_R - 1.5), cz + Math.cos(a) * (CITY_R - 1.5)) - baseY, Math.cos(a) * (CITY_R - 1.5));
      tusk.rotation.x = 0.4 * Math.cos(a); tusk.rotation.z = -0.4 * Math.sin(a);
      g.add(tusk);
    }
    // great tusks arching over the plaza
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const t = new THREE.Mesh(new THREE.TorusGeometry(6, 0.6, 8, 20, Math.PI * 0.8), bone);
      const p = at(a, PLAZA_R - 6);
      t.position.set(p.x, 0, p.z); t.rotation.y = -a;
      g.add(t);
      solid.push({ x: cx + p.x + Math.cos(a) * 6, z: cz + p.z + Math.sin(a) * 6, r: 0.8, kind: 'wall', height: 4 }); // its foot
    }
    return null;
  }
  if (S.decor === 'crystals') {
    const cr = glowMat('#c8a0ff', '#8a50ff', 1.8), cr2 = glowMat('#90fff0', '#20c0b0', 1.8);
    const floats = [];
    for (let i = 0; i < 10; i++) {
      const p = at((i / 10) * Math.PI * 2 + 0.3, 20 + (i % 2) * 6);
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), i % 2 ? cr : cr2);
      c.scale.set(1, 2, 1); c.position.set(p.x, 5, p.z);
      g.add(c); floats.push(c);
    }
    return (t) => floats.forEach((c, i) => { c.position.y = 5 + Math.sin(t * 1.2 + i) * 0.6; c.rotation.y = t * 0.5 + i; });
  }
  if (S.decor === 'reeds') {
    const reed = new THREE.MeshStandardMaterial({ color: '#7a8a4a', roughness: 1 });
    const post = new THREE.MeshStandardMaterial({ color: '#3a2e1e', roughness: 1 });
    for (let i = 0; i < 80; i++) {
      const p = at(Math.random() * Math.PI * 2, PLAZA_R + 14 + Math.random() * 50);
      if (Math.abs(Math.sin(Math.atan2(p.z, p.x) * 2)) < 0.25) continue;
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.6 + Math.random(), 4), reed);
      r.position.set(p.x, heightAt(cx + p.x, cz + p.z) - baseY + 0.8, p.z);
      g.add(r);
    }
    for (let i = 0; i < 24; i++) {
      const p = at((i / 24) * Math.PI * 2, PLAZA_R + 2);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.4, 6), post);
      m.position.set(p.x, 1.2, p.z);
      g.add(m);
    }
    return null;
  }
  return null;
}

// A village: the waystone with a few cottages round it and a tavern
export function buildVillage(place) {
  const centre = buildSpawn(place);
  const g = centre.group;
  const cx = place.x, cz = place.z, baseY = heightAt(cx, cz);
  const solid = [...centre.solid];
  const doors = doorKeeper();
  const pads = [];
  const shops = centre.market ? [{ ...centre.market, name: MARKETS[centre.market.id].name }] : [];
  if (centre.kiosk) shops.push(centre.kiosk);
  // (kept off the north-south street between the gates: each at least 10 m to the side of it)
  const spots = [[-0.6, 30, 'tavern'], [0.05, 33], [0.7, 30], [2.45, 32], [3.14, 30], [3.83, 33]];
  for (const [a, r, id] of spots) {
    const tavern = id === 'tavern';
    const w = tavern ? 11 : 7, d = tavern ? 8 : 6, h = tavern ? 6 : 4;
    const b = house(w, d, h, tavern ? '#c8b48e' : '#d0c2a2', tavern ? '#6a3a1e' : '#5a4a3a', tavern ? `${place.name} Tavern` : null, { seed: `${place.id}:${a}` });
    doors.add(b);
    const at = placeFacing(g, b, a, r, d);
    b.position.y = heightAt(cx + at.bx, cz + at.bz) - baseY;
    boxColliders(cx + at.bx, cz + at.bz, w, d, at.rot, solid, b.userData.height);
    fixtures(b, cx + at.bx, cz + at.bz, at.rot, b.position.y, solid, pads);
    if (tavern) shops.push({ id: 'tavern', name: `${place.name} Tavern`, x: cx + at.x, z: cz + at.z, building: true });
  }
  // a tall wooden wall of sharpened logs all round, with a gate north and south, a watchtower beside
  // each gate, and two guards outside it
  const fixed = new THREE.Group();
  g.add(fixed);
  const logMat = matOf('#6a4a2c', 0.95), tipMat = matOf('#8a6a44', 0.9);
  const guards = [];
  const gearOf = { weapon: ITEMS.iron_spear, head: ITEMS.knight_helm, body: ITEMS.knight_plate };
  const R = VILLAGE_WALL;
  const n = Math.round((2 * Math.PI * R) / 0.55);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (GATE_ANGLES.some((ga) => Math.abs(Math.atan2(Math.sin(a - ga), Math.cos(a - ga))) < 3.2 / R)) continue;
    const x = Math.sin(a) * R, z = Math.cos(a) * R, y = heightAt(cx + x, cz + z) - baseY;
    const hgt = 5.2 + ((i * 7) % 5) * 0.12;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.29, hgt, 6), logMat);
    log.position.set(x, y + hgt / 2 - 0.3, z);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.6, 6), tipMat);
    tip.position.set(x, y + hgt - 0.3 + 0.3, z);
    fixed.add(log, tip);
    if (i % 2 === 0) solid.push({ x: cx + x, z: cz + z, r: 0.62, kind: 'wall', height: hgt, y: baseY + y });
  }
  for (const ga of GATE_ANGLES) {
    const ox = Math.sin(ga), oz = Math.cos(ga), sx = Math.cos(ga), sz = -Math.sin(ga);
    for (const side of [-1, 1]) {
      // a watchtower each side of the gate: four posts, a platform and a little roof
      const tx = ox * R + sx * side * 4.6, tz = oz * R + sz * side * 4.6, ty = heightAt(cx + tx, cz + tz) - baseY;
      for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 7.5, 6), logMat); post.position.set(tx + px, ty + 3.75 - 0.3, tz + pz); fixed.add(post); }
      const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 2.6), logMat); deck.position.set(tx, ty + 5.4, tz); fixed.add(deck);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.4, 4), tipMat); roof.position.set(tx, ty + 8, tz); roof.rotation.y = Math.PI / 4; fixed.add(roof);
      solid.push({ x: cx + tx, z: cz + tz, r: 1.5, kind: 'wall', height: 8, y: baseY + ty });
      // a guard outside the gate
      const gx = ox * (R + 2.2) + sx * side * 2.2, gz = oz * (R + 2.2) + sz * side * 2.2;
      const b = lazyGuard(['dwarf', 'elf', 'beastkin', 'hobbit'][(guards.length + place.id.length) % 4], gearOf);
      b.position.set(gx, heightAt(cx + gx, cz + gz) - baseY, gz);
      b.rotation.y = ga;
      g.add(b); guards.push(b);
      solid.push({ x: cx + gx, z: cz + gz, r: 0.55, kind: 'wall', height: 2 });
    }
    // a beam across the top of the gateway
    const beam = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.5, 0.5), logMat);
    beam.position.set(ox * R, heightAt(cx + ox * R, cz + oz * R) - baseY + 5.2, oz * R); beam.rotation.y = ga;
    fixed.add(beam);
  }
  mergeStill(fixed);
  const deckAt = (x, z) => { const pad = padAt(pads, x, z); return pad === undefined ? undefined : baseY + pad; };
  return { group: g, update: (t, you) => { centre.update(t); doors.update(you, t); for (const b of guards) if (isShown(b)) animateCharacter(b, t, 0); }, shops, solid, market: centre.market, deckAt, doors };
}

// The sign over your parents' heads: a heart and "Your parent", always facing you
let signTex = null;
function parentSign() {
  if (!signTex) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(30, 20, 14, 0.72)';
    x.beginPath(); x.roundRect(4, 8, 248, 48, 22); x.fill();
    x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#ff7a8a'; x.fillText('\u2665', 44, 33);
    x.fillStyle = '#ffe9c8'; x.fillText('Your parent', 142, 33);
    signTex = new THREE.CanvasTexture(c);
    signTex.colorSpace = THREE.SRGBColorSpace;
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTex, depthTest: false, transparent: true }));
  s.scale.set(1.6, 0.4, 1);
  s.renderOrder = 10;
  return s;
}
