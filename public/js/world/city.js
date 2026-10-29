// The Central City at the heart of the map, owned by no one: a walled town on levelled ground
// round the main waystone, with the city's own shops (run by bots), a tavern and the Main Guild
// Hall. Villages are smaller: a waystone with a few houses and a tavern.
import * as THREE from 'three';
import { heightAt, CITY_R } from '../data/world-layout.mjs';
import { MARKETS, ITEMS } from '../data/items.mjs';
import { buildSpawn, textTexture } from './spawn.js';
import { buildCharacter, animateCharacter } from '../characters/model.js';
import { wearGear } from '../characters/gear.js';
import { mergeStill } from './merge.js';
import { cityHouses, CASTLE_SPOT, familyOf, PARENT_JOBS, ACADEMY_NAME, townName, seeded } from '../data/birth.mjs';

const PLAZA_R = 34;

// The buildings on the plaza: [shop id, angle (0 = east, going round towards south), width, depth, height, wall colour, roof colour]
const CITY_SHOPS = [
  ['guild', -Math.PI / 2, 18, 12, 9, '#cdbf9e', '#5a2a24'],
  ['city_potions', -Math.PI / 2 + 0.95, 8, 7, 5, '#d8cdb0', '#3a6a3a'],
  ['city_smith', 0.2, 9, 8, 5, '#9a8e7e', '#3a3632'],
  ['city_armoury', 0.95, 9, 8, 5.5, '#b0a690', '#4a4a5a'],
  ['city_tailor', -2.3, 8, 7, 5, '#e0d4c0', '#7a3a5a'],
  ['city_food', 2.1, 10, 8, 5, '#e2d2a8', '#8a5a2a'],
  ['tavern', -Math.PI / 2 - 1.4, 12, 9, 7, '#c8b48e', '#6a3a1e'],
  // where children train at the school of their choice before the Ceremony
  ['academy', 2.75, 12, 9, 7, '#e4dcc8', '#2a4a7a'],
];
// The walls: the outer fortress wall, the moat inside it, then the inner wall. Only two gates (north
// and south), each with a bridge over the moat that can be raised to shut the inner gate.
export const INNER_R = 96;
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
function house(w, d, h, wall, roof, label) {
  const g = new THREE.Group();
  const wallMat = matOf(wall, 0.9);
  const roofMat = matOf(roof, 0.8);
  const trim = matOf('#4a3424', 0.9);
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  body.position.y = h / 2;
  g.add(body);
  // a closed pitched roof along the width: a ridge on top, sloping down over the front and back,
  // with the gable ends filled in in the wall's colour
  const rise = d * 0.42, eave = 0.35;
  const tri = new THREE.Shape([new THREE.Vector2(-d / 2 - eave, 0), new THREE.Vector2(d / 2 + eave, 0), new THREE.Vector2(0, rise)]);
  const roofGeo = new THREE.ExtrudeGeometry(tri, { depth: w + 0.6, bevelEnabled: false });
  roofGeo.translate(0, 0, -(w + 0.6) / 2);
  roofGeo.rotateY(Math.PI / 2);
  const r = new THREE.Mesh(roofGeo, roofMat);
  r.position.y = h - 0.05;
  g.add(r);
  for (const side of [-1, 1]) {
    const end = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, rise * (d / 2) / (d / 2 + eave))])).rotateY(side * Math.PI / 2), wallMat);
    end.position.set(side * (w / 2 + 0.01), h - 0.05, 0);
    g.add(end);
  }
  // door and windows on the front (+z)
  // the door swings on its left side; it opens when someone comes to it (see openDoors)
  const hinge = new THREE.Group();
  hinge.position.set(-0.7, 0, d / 2 + 0.05);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.12), trim);
  door.position.set(0.7, 1.2, 0);
  door.userData.moves = true;
  hinge.add(door);
  const dark = new THREE.Mesh(new THREE.BoxGeometry(1.36, 2.36, 0.02), matOf('#140e08', 1));
  dark.position.set(0, 1.18, d / 2 + 0.005); // the dark doorway behind it
  g.add(hinge, dark);
  g.userData.door = hinge;
  const glass = matOf('#ffe0a0', 1, { emissive: '#c08030', emissiveIntensity: 0.6 });
  for (const x of [-w / 3, w / 3]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.1), glass);
    win.position.set(x, h * 0.55, d / 2 + 0.05);
    g.add(win);
  }
  if (label) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w - 1, 6), 0.9, 0.1), trim);
    board.position.set(0, Math.min(h - 0.6, 3.4), d / 2 + 0.12);
    const text = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w - 1.2, 5.8), 0.8), new THREE.MeshBasicMaterial({ map: textTexture(label), transparent: true }));
    text.position.set(0, board.position.y, d / 2 + 0.18);
    g.add(board, text);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// Doors that swing open while someone is near them (you, for now). Their places are worked out
// the first time, once the buildings stand where they will stay.
function doorKeeper() {
  const doors = [];
  const v = new THREE.Vector3();
  return {
    add(b) { if (b.userData.door) doors.push({ hinge: b.userData.door, x: null, z: null, open: 0 }); },
    update(you) {
      if (!you) return;
      for (const d of doors) {
        if (d.x === null) { d.hinge.updateWorldMatrix(true, false); d.hinge.getWorldPosition(v); d.x = v.x + 0.7; d.z = v.z; }
        const want = Math.abs(you.x - d.x) < 3 && Math.abs(you.z - d.z) < 3 && Math.hypot(you.x - d.x, you.z - d.z) < 3 ? 1.35 : 0;
        if (Math.abs(want - d.open) < 0.005) continue;
        d.open += (want - d.open) * 0.12;
        d.hinge.rotation.y = d.open;
      }
    },
  };
}

// Solid circles along a rectangle's edges, so you can't walk through a building
function boxColliders(x, z, w, d, rot, out) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const put = (lx, lz) => out.push({ x: x + lx * c + lz * s, z: z - lx * s + lz * c, r: 1.1, kind: 'wall', height: 6 });
  for (let lx = -w / 2; lx <= w / 2 + 0.01; lx += 1.8) { put(lx, -d / 2 + 0.6); put(lx, d / 2 - 0.6); }
  for (let lz = -d / 2; lz <= d / 2 + 0.01; lz += 1.8) { put(-w / 2 + 0.6, lz); put(w / 2 - 0.6, lz); }
}

// A building at angle `a` on a ring of radius `r` round (0, 0), its door facing the middle.
// Returns the door's spot (in the group's space) for the shop's E key.
function placeFacing(g, b, a, r, d) {
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  b.position.set(x, 0, z);
  b.rotation.y = Math.atan2(-x, -z);
  g.add(b);
  return { x: x - Math.cos(a) * (d / 2 + 1.6), z: z - Math.sin(a) * (d / 2 + 1.6), rot: b.rotation.y, bx: x, bz: z };
}

export function buildCity(place, opts = {}) {
  const S = STYLES[place.style] || STYLES.heart;
  const monster = !!place.monster;
  const centre = buildSpawn(place, { market: false, lanterns: false });
  const g = centre.group;
  const cx = place.x, cz = place.z;
  const solid = [...centre.solid];
  const shops = [];
  const doors = doorKeeper();

  // the paved plaza
  const paving = new THREE.Mesh(new THREE.CircleGeometry(PLAZA_R + 10, 64), new THREE.MeshStandardMaterial({ color: S.paving, roughness: 0.95 }));
  paving.rotation.x = -Math.PI / 2;
  paving.position.y = 0.03;
  paving.receiveShadow = true;
  g.add(paving);
  // streets out to the four gates
  const streetMat = new THREE.MeshStandardMaterial({ color: S.street, roughness: 0.95 });
  for (let i = 0; i < 4; i++) {
    const st = new THREE.Mesh(new THREE.PlaneGeometry(7, CITY_R - PLAZA_R), streetMat);
    st.rotation.x = -Math.PI / 2;
    st.rotation.z = (i * Math.PI) / 2;
    const a = (i * Math.PI) / 2, mid = (CITY_R + PLAZA_R) / 2;
    st.position.set(Math.sin(a) * mid, 0.02, Math.cos(a) * mid);
    st.receiveShadow = true;
    g.add(st);
  }

  // the shops round the plaza
  CITY_SHOPS.forEach(([id, a, w, d, h, wall0, roof0], i) => {
    const [wall, roof] = monster ? S.tones[i % S.tones.length] : [wall0, roof0];
    const name = id === 'guild' ? (monster ? DARK_GUILD_NAME : GUILD_NAME) : id === 'academy' ? ACADEMY_NAME : MARKETS[id].name;
    const b = house(w, d, h, wall, roof, name);
    doors.add(b);
    if (S.decor === 'reeds') b.position.y = 0.6; // up on stilts above the mud
    const at = placeFacing(g, b, a, PLAZA_R + d / 2 + 4, d);
    boxColliders(cx + at.bx, cz + at.bz, w, d, at.rot, solid);
    shops.push({ id, name, x: cx + at.x, z: cz + at.z, building: id !== 'academy' });
  });
  // the Guild Hall gets a bell tower and banners
  const guildAt = shops.find((s) => s.id === 'guild');
  const tower = new THREE.Mesh(new THREE.BoxGeometry(3, 15, 3), new THREE.MeshStandardMaterial({ color: monster ? S.tones[0][0] : '#bfb08e', roughness: 0.9 }));
  tower.position.set(guildAt.x - cx, 7.5, guildAt.z - cz - 14);
  tower.castShadow = true;
  g.add(tower);

  // the Emperors' Castle in the east of the city: a great keep with four towers
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

  // the houses of the townsfolk, where every newborn's family lives (see data/birth.mjs)
  // (houses and walls never move: they are merged into a few meshes at the end)
  const fixed = new THREE.Group();
  g.add(fixed);
  const tones = S.tones;
  const houses = cityHouses(place.id);
  for (const h of houses) {
    const [wall, roof] = tones[h.i % tones.length];
    const hb = house(h.w, h.d, h.h, wall, roof, null);
    doors.add(hb);
    const at = placeFacing(fixed, hb, h.a, h.r, h.d);
    if (S.decor === 'reeds') hb.position.y = 0.6;
    boxColliders(cx + at.bx, cz + at.bz, h.w, h.d, at.rot, solid);
  }

  // the walls: outer fortress wall, moat, inner wall (see walls())
  const wallMat = matOf(S.wall, 0.95);
  const bridges = walls(fixed, g, S, wallMat, cx, cz, solid);
  mergeStill(fixed);

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
      const body = buildCharacter({ race, form: 'humanoid', look: {} });
      wearGear(body, guardGear);
      const r = CITY_R + 3.5, lat = side * 3.4;
      const x = ox * r + oz * lat, z = oz * r - ox * lat;
      body.position.set(x, heightAt(cx + x, cz + z) - heightAt(cx, cz), z);
      body.rotation.y = a; // facing out, towards those coming in
      g.add(body);
      guards.push(body);
      solid.push({ x: cx + x, z: cz + z, r: 0.6, kind: 'wall', height: 2 });
    }
  }
  // townsfolk: families at their doors, and merchants and businessmen round the plaza
  const npcs = [];
  const addNpc = (race, x, z, faceA, info) => {
    const body = buildCharacter({ race, form: 'humanoid', look: info.look || {} });
    body.position.set(x, heightAt(cx + x, cz + z) - heightAt(cx, cz) + (S.decor === 'reeds' ? 0.6 : 0), z);
    body.rotation.y = faceA;
    g.add(body);
    const npc = { ...info, x: cx + x, z: cz + z };
    npcs.push(npc);
    // townsfolk stroll about near their spot: parents in front of their house, traders round the plaza
    walkers.push({ body, npc, hx: x, hz: z, range: info.kind === 'parent' ? 2.6 : 5, tx: x, tz: z, wait: 1 + rnd2() * 4, talk: 0 });
  };
  const walkers = [];
  let seed2 = 7;
  const rnd2 = () => { seed2 = (seed2 * 16807) % 2147483647; return seed2 / 2147483647; };
  let lastT = null;
  function walkFolk(t, you) {
    const dt = lastT === null ? 0 : Math.min(0.1, t - lastT);
    lastT = t;
    for (const w of walkers) {
      const b = w.body;
      let speed = 0;
      if (w.npc.talkUntil && w.npc.talkUntil > t) {
        // talking: stop and face whoever spoke to them
        if (you) b.rotation.y = Math.atan2(you.x - cx - b.position.x, you.z - cz - b.position.z);
      } else if (w.wait > 0) w.wait -= dt;
      else {
        const dx = w.tx - b.position.x, dz = w.tz - b.position.z, d = Math.hypot(dx, dz);
        if (d < 0.15) {
          w.wait = 2 + rnd2() * 6;
          // the next spot: somewhere near home, never further from the middle than home (not into a house)
          for (let k = 0; k < 6; k++) {
            const a = rnd2() * Math.PI * 2, r = w.range * Math.sqrt(rnd2());
            const nx = w.hx + Math.cos(a) * r, nz = w.hz + Math.sin(a) * r, nd = Math.hypot(nx, nz);
            if (nd <= Math.hypot(w.hx, w.hz) + 0.2 && nd > 11) { w.tx = nx; w.tz = nz; break; }
          }
        } else {
          speed = 1.1;
          const step = Math.min(d, speed * dt);
          b.position.x += (dx / d) * step; b.position.z += (dz / d) * step;
          const want = Math.atan2(dx, dz);
          b.rotation.y += Math.atan2(Math.sin(want - b.rotation.y), Math.cos(want - b.rotation.y)) * Math.min(1, dt * 6);
          w.npc.x = cx + b.position.x; w.npc.z = cz + b.position.z;
        }
      }
      animateCharacter(b, t, speed ? 0.9 : 0);
    }
  }
  const homeAt = opts.home?.city === place.id ? opts.home.house : -1;
  for (const h of houses) {
    if (h.i !== homeAt && h.i % 6) continue;
    const race = h.i === homeAt ? opts.home.race : S.guards[h.i % S.guards.length];
    const fam = familyOf(place.id, h.i, race);
    const k = (h.r - h.d / 2 - 1.4) / h.r;
    fam.parents.forEach((p, j) => {
      const side = j ? 1.1 : -1.1, ox = Math.cos(h.a), oz = Math.sin(h.a);
      addNpc(race, h.x * k - oz * side, h.z * k + ox * side, Math.atan2(-h.x, -h.z), { kind: 'parent', name: p.name, job: p.job, mine: h.i === homeAt, house: h.i });
    });
  }
  const rnd = seeded(place.id);
  const side = monster ? 'monster' : 'player';
  [['merchant', 'Merchant'], ['businessman', 'Businessman'], ['merchant', 'Merchant'], ['businessman', 'Businessman'], ['merchant', 'Cloth Merchant'], ['merchant', 'Fruit Seller']].forEach(([kind, title], i) => {
    const a = (i / 6) * Math.PI * 2 + 0.3, r = PLAZA_R - 7;
    addNpc(S.guards[i % S.guards.length], Math.cos(a) * r, Math.sin(a) * r, Math.atan2(Math.cos(a), Math.sin(a)), { kind, title, name: townName(side, rnd) });
  });

  const glow = decorate(g, S, cx, cz, solid);
  const update = (t, you) => {
    centre.update?.(t);
    doors.update(you);
    for (const b of guards) animateCharacter(b, t, 0);
    walkFolk(t, you);
    for (const b of bridges) b.update();
    castleGrounds?.update(t, you);
    glow?.(t);
  };
  // raise or lower the bridges over the moat (raised, they shut the inner gates)
  const setRaised = (up, colliders) => { for (const b of bridges) b.raise(up, colliders); };
  // walking on a lowered bridge: its deck, to stand on
  const deckAt = (x, z) => { for (const b of bridges) { const y = b.deckAt(x, z); if (y !== undefined) return y; } return castleGrounds?.topAt(x, z); };
  // in the moat's water (and not on a bridge)
  const inMoat = (x, z) => { const d = Math.hypot(x - cx, z - cz); return d > MOAT[0] && d < MOAT[1] && deckAt(x, z) === undefined; };

  // pulled out of the moat: onto the middle of the nearest bridge, the same way along it
  const rescue = (x, z) => {
    const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
    const ga = GATE_ANGLES.reduce((b, a) => (Math.sin(a) * dx + Math.cos(a) * dz > Math.sin(b) * dx + Math.cos(b) * dz ? a : b));
    return { x: cx + Math.sin(ga) * d, z: cz + Math.cos(ga) * d };
  };

  return { group: g, update, shops, solid, gates, npcs, setRaised, deckAt, inMoat, rescue, centre: { x: cx, z: cz } };
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
    const b = buildCharacter({ race, form: 'humanoid', look: {} });
    wearGear(b, gearOf);
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
      for (const b of guards) animateCharacter(b, t, 0);
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
    const baseY = heightAt(cx, cz);
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
      const p = at((i / 14) * Math.PI * 2, 100 + (i % 3) * 3);
      const spike = new THREE.Mesh(new THREE.ConeGeometry(1.2, 6 + (i % 4) * 2, 5), rock);
      spike.position.set(p.x, heightAt(cx + p.x, cz + p.z) - baseY + 3, p.z);
      g.add(spike);
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
      tusk.position.set(Math.sin(a) * (CITY_R - 1.5), 6.8, Math.cos(a) * (CITY_R - 1.5));
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
  const shops = centre.market ? [{ ...centre.market, name: MARKETS[centre.market.id].name }] : [];
  const spots = [[-0.6, 30, 'tavern'], [0.9, 32], [1.9, 28], [2.8, 34], [3.9, 30], [5.0, 33]];
  for (const [a, r, id] of spots) {
    const tavern = id === 'tavern';
    const w = tavern ? 11 : 7, d = tavern ? 8 : 6, h = tavern ? 6 : 4;
    const b = house(w, d, h, tavern ? '#c8b48e' : '#d0c2a2', tavern ? '#6a3a1e' : '#5a4a3a', tavern ? `${place.name} Tavern` : null);
    doors.add(b);
    const at = placeFacing(g, b, a, r, d);
    b.position.y = heightAt(cx + at.bx, cz + at.bz) - baseY;
    boxColliders(cx + at.bx, cz + at.bz, w, d, at.rot, solid);
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
      const b = buildCharacter({ race: ['dwarf', 'elf', 'beastkin', 'hobbit'][(guards.length + place.id.length) % 4], form: 'humanoid', look: {} });
      wearGear(b, gearOf);
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
  return { group: g, update: (t, you) => { centre.update(t); doors.update(you); for (const b of guards) animateCharacter(b, t, 0); }, shops, solid, market: centre.market };
}
