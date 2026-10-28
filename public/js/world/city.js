// The Central City at the heart of the map, owned by no one: a walled town on levelled ground
// round the main waystone, with the city's own shops (run by bots), a tavern and the Main Guild
// Hall. Villages are smaller: a waystone with a few houses and a tavern.
import * as THREE from 'three';
import { heightAt, CITY_R } from '../data/world-layout.mjs';
import { MARKETS, ITEMS } from '../data/items.mjs';
import { buildSpawn, textTexture } from './spawn.js';
import { buildCharacter, animateCharacter } from '../characters/model.js';
import { wearGear } from '../characters/gear.js';

const PLAZA_R = 34;

// The buildings on the plaza: [shop id, angle (0 = east, going round towards south), width, depth, height, wall colour, roof colour]
const CITY_SHOPS = [
  ['guild', -Math.PI / 2, 18, 12, 9, '#cdbf9e', '#5a2a24'],
  ['city_potions', -Math.PI / 2 + 0.95, 8, 7, 5, '#d8cdb0', '#3a6a3a'],
  ['city_smith', -Math.PI / 2 + 1.8, 9, 8, 5, '#9a8e7e', '#3a3632'],
  ['city_armoury', -Math.PI / 2 + 2.65, 9, 8, 5.5, '#b0a690', '#4a4a5a'],
  ['city_tailor', Math.PI / 2 + 0.6, 8, 7, 5, '#e0d4c0', '#7a3a5a'],
  ['city_food', Math.PI / 2 - 0.4, 10, 8, 5, '#e2d2a8', '#8a5a2a'],
  ['tavern', -Math.PI / 2 - 1.4, 12, 9, 7, '#c8b48e', '#6a3a1e'],
];
export const GUILD_NAME = 'Main Guild Hall';

function house(w, d, h, wall, roof, label) {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: wall, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: roof, roughness: 0.8 });
  const trim = new THREE.MeshStandardMaterial({ color: '#4a3424', roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  body.position.y = h / 2;
  g.add(body);
  // a pitched roof along the width
  const roofGeo = new THREE.CylinderGeometry(0.01, d * 0.72, w + 0.6, 4, 1);
  roofGeo.rotateZ(Math.PI / 2);
  roofGeo.rotateX(Math.PI / 4);
  const r = new THREE.Mesh(roofGeo, roofMat);
  r.scale.set(1, 0.55, 1);
  r.position.y = h + d * 0.2;
  g.add(r);
  // door and windows on the front (+z)
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.12), trim);
  door.position.set(0, 1.2, d / 2 + 0.05);
  g.add(door);
  const glass = new THREE.MeshStandardMaterial({ color: '#ffe0a0', emissive: '#c08030', emissiveIntensity: 0.6 });
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

export function buildCity(place) {
  const centre = buildSpawn(place, { market: false, lanterns: false });
  const g = centre.group;
  const cx = place.x, cz = place.z;
  const solid = [];
  const shops = [];

  // the paved plaza
  const paving = new THREE.Mesh(new THREE.CircleGeometry(PLAZA_R + 10, 64), new THREE.MeshStandardMaterial({ color: '#a39a88', roughness: 0.95 }));
  paving.rotation.x = -Math.PI / 2;
  paving.position.y = 0.03;
  paving.receiveShadow = true;
  g.add(paving);
  // streets out to the four gates
  const streetMat = new THREE.MeshStandardMaterial({ color: '#8e8676', roughness: 0.95 });
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
  for (const [id, a, w, d, h, wall, roof] of CITY_SHOPS) {
    const name = id === 'guild' ? GUILD_NAME : MARKETS[id].name;
    const b = house(w, d, h, wall, roof, name);
    const at = placeFacing(g, b, a, PLAZA_R + d / 2 + 4, d);
    boxColliders(cx + at.bx, cz + at.bz, w, d, at.rot, solid);
    shops.push({ id, name, x: cx + at.x, z: cz + at.z, building: true });
  }
  // the Guild Hall gets a bell tower and banners
  const guildAt = shops.find((s) => s.id === 'guild');
  const tower = new THREE.Mesh(new THREE.BoxGeometry(3, 15, 3), new THREE.MeshStandardMaterial({ color: '#bfb08e', roughness: 0.9 }));
  tower.position.set(guildAt.x - cx, 7.5, guildAt.z - cz - 14);
  tower.castShadow = true;
  g.add(tower);

  // the Emperors' Castle in the north-east of the city: a great keep with four towers
  const CASTLE = { x: 52, z: -52, w: 30, d: 24 };
  {
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
    door.position.set(0, 3, CASTLE.d / 2 + 0.1);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.2), new THREE.MeshBasicMaterial({ map: textTexture("The Emperors' Castle"), transparent: true }));
    sign.position.set(0, 7.4, CASTLE.d / 2 + 0.25);
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
  }

  // houses of the townsfolk on an outer ring, between the streets
  const tones = [['#d2c4a4', '#7a3a24'], ['#c4b494', '#4a5a6a'], ['#dccfb2', '#6a4a2a'], ['#b8a888', '#3a4a3a']];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2 + Math.PI / 20;
    if (Math.abs(Math.sin(a * 2)) < 0.25) continue; // keep the streets clear
    const r0 = 68 + (i % 2) * 14;
    if (Math.hypot(Math.cos(a) * r0 - CASTLE.x, Math.sin(a) * r0 - CASTLE.z) < 26) continue; // the castle stands here
    const [wall, roof] = tones[i % tones.length];
    const w = 7 + (i % 3), d = 6 + (i % 2), h = 4 + (i % 3) * 0.8;
    const r = 68 + (i % 2) * 14;
    const at = placeFacing(g, house(w, d, h, wall, roof, null), a, r, d);
    boxColliders(cx + at.bx, cz + at.bz, w, d, at.rot, solid);
  }

  // the city wall, with a gate on each street
  const wallMat = new THREE.MeshStandardMaterial({ color: '#8f8676', roughness: 0.95 });
  const seg = 4;
  const n = Math.round((2 * Math.PI * CITY_R) / seg);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const inGate = [0, 1, 2, 3].some((k) => Math.abs(Math.atan2(Math.sin(a - (k * Math.PI) / 2), Math.cos(a - (k * Math.PI) / 2))) < 5 / CITY_R);
    if (inGate) continue;
    const x = Math.sin(a) * CITY_R, z = Math.cos(a) * CITY_R;
    const w = new THREE.Mesh(new THREE.BoxGeometry(seg + 0.3, 6, 1.6), wallMat);
    w.position.set(x, 3, z);
    w.rotation.y = a;
    w.castShadow = true; w.receiveShadow = true;
    g.add(w);
    solid.push({ x: cx + x, z: cz + z, r: 1.6, kind: 'wall', height: 6 }, { x: cx + Math.sin(a + 1 / CITY_R) * CITY_R, z: cz + Math.cos(a + 1 / CITY_R) * CITY_R, r: 1.6, kind: 'wall', height: 6 });
  }
  // gate towers
  for (let k = 0; k < 4; k++) {
    for (const side of [-1, 1]) {
      const a = (k * Math.PI) / 2 + side * (6 / CITY_R);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 9, 10), wallMat);
      t.position.set(Math.sin(a) * CITY_R, 4.5, Math.cos(a) * CITY_R);
      t.castShadow = true;
      g.add(t);
      solid.push({ x: cx + t.position.x, z: cz + t.position.z, r: 2.4, kind: 'wall', height: 9 });
    }
  }

  // street lamps round the plaza
  const lampMat = new THREE.MeshStandardMaterial({ color: '#ffe2a0', emissive: '#ffb84a', emissiveIntensity: 1.6 });
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
  const guardRaces = ['dwarf', 'elf', 'giant', 'beastkin', 'hobbit', 'elf', 'dwarf', 'beastkin'];
  const gates = [];
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const ox = Math.sin(a), oz = Math.cos(a); // outward
    gates.push({ x: cx + ox * CITY_R, z: cz + oz * CITY_R, a });
    for (const side of [-1, 1]) {
      const race = guardRaces[k * 2 + (side > 0 ? 1 : 0)];
      const body = buildCharacter({ race, form: 'humanoid', look: {} });
      wearGear(body, { weapon: ITEMS.iron_spear, head: ITEMS.knight_helm, body: ITEMS.knight_plate });
      const r = CITY_R + 3.5, lat = side * 3.4;
      const x = ox * r + oz * lat, z = oz * r - ox * lat;
      body.position.set(x, heightAt(cx + x, cz + z) - heightAt(cx, cz), z);
      body.rotation.y = a; // facing out, towards those coming in
      g.add(body);
      guards.push(body);
      solid.push({ x: cx + x, z: cz + z, r: 0.6, kind: 'wall', height: 2 });
    }
  }
  const update = (t) => {
    centre.update?.(t);
    for (const b of guards) animateCharacter(b, t, 0);
  };

  return { group: g, update, shops, solid, gates, centre: { x: cx, z: cz } };
}

// A village: the waystone with a few cottages round it and a tavern
export function buildVillage(place) {
  const centre = buildSpawn(place);
  const g = centre.group;
  const cx = place.x, cz = place.z, baseY = heightAt(cx, cz);
  const solid = [];
  const shops = centre.market ? [{ ...centre.market, name: MARKETS[centre.market.id].name }] : [];
  const spots = [[-0.6, 30, 'tavern'], [0.9, 32], [1.9, 28], [2.8, 34], [3.9, 30], [5.0, 33]];
  for (const [a, r, id] of spots) {
    const tavern = id === 'tavern';
    const w = tavern ? 11 : 7, d = tavern ? 8 : 6, h = tavern ? 6 : 4;
    const b = house(w, d, h, tavern ? '#c8b48e' : '#d0c2a2', tavern ? '#6a3a1e' : '#5a4a3a', tavern ? `${place.name} Tavern` : null);
    const at = placeFacing(g, b, a, r, d);
    b.position.y = heightAt(cx + at.bx, cz + at.bz) - baseY;
    boxColliders(cx + at.bx, cz + at.bz, w, d, at.rot, solid);
    if (tavern) shops.push({ id: 'tavern', name: `${place.name} Tavern`, x: cx + at.x, z: cz + at.z, building: true });
  }
  return { group: g, update: centre.update, shops, solid, market: centre.market };
}
