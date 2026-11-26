// A portal stone: a ring of standing stones around a swirling disc of light, raised on a round dais
import * as THREE from 'three';
import { GlowLight } from './lightpool.js';
import { heightAt } from '../data/world-layout.mjs';
import { ITEMS } from '../data/items.mjs';
import { buildCharacter, animateCharacter } from '../characters/model.js';
import { joinCrowd, bakeCharacter } from '../characters/crowd.js';
import { wearGear } from '../characters/gear.js';

// Each portal stands inside a closed stone hall with one door (facing south) and two guards
// outside it. The guards are of the land's own people.
const HALL = 7.5; // half the hall's width
const HALL_H = 6.5;
const GUARDS = {
  heart: [['dwarf', 'elf'], { weapon: 'iron_spear', head: 'knight_helm', body: 'knight_plate' }],
  peaks: [['dragonewt', 'dragonewt'], { weapon: 'wyrm_glaive', head: 'horned_helm', body: 'drake_plate' }],
  warrens: [['goblin', 'goblin'], { weapon: 'tusk_spear', head: 'bone_mask', body: 'scale_mail' }],
  fae: [['fairy', 'fairy'], { weapon: 'spirit_totem', head: 'warlord_crown', body: 'shaman_mantle' }],
  mire: [['lizardman', 'naga'], { weapon: 'tusk_spear', head: 'horned_helm', body: 'scale_mail' }],
};
const hallMat = new THREE.MeshStandardMaterial({ color: '#6e6a62', roughness: 0.95 });
const roofMat = new THREE.MeshStandardMaterial({ color: '#3a3448', roughness: 0.85 });
const lampMat = new THREE.MeshStandardMaterial({ color: '#d8c0ff', emissive: '#a77bff', emissiveIntensity: 1.4 });

const stoneMat = new THREE.MeshStandardMaterial({ color: '#7d7a72', roughness: 0.92 });
const runeMat = new THREE.MeshStandardMaterial({ color: '#2a1d4a', emissive: '#9a6bff', emissiveIntensity: 1.6 });

function swirlTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(190,150,255,0.9)'); grad.addColorStop(1, 'rgba(90,40,200,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    for (let a = 0; a < 7; a += 0.1) { const r = a * 8; const x = 64 + Math.cos(a + i * Math.PI / 2) * r, y = 64 + Math.sin(a + i * Math.PI / 2) * r; a ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }
  return new THREE.CanvasTexture(c);
}
let swirl = null;

export function buildPortal(p) {
  const group = new THREE.Group();
  const y = heightAt(p.x, p.z);
  group.position.set(p.x, y, p.z);
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 0.6, 24), stoneMat);
  dais.position.y = -0.15;
  group.add(dais);
  // six standing stones, each with a glowing rune
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.2, 0.7), stoneMat);
    st.position.set(Math.cos(a) * 3.6, 1.9, Math.sin(a) * 3.6);
    st.rotation.y = -a; // its local +x now points away from the middle
    group.add(st);
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.6), runeMat);
    rune.position.set(-0.26, 0.3, 0);
    rune.rotation.y = -Math.PI / 2; // facing the middle
    st.add(rune);
  }
  // a swirling pool of light on the dais, and a column of light rising from it
  swirl ||= swirlTexture();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.6, 40), new THREE.MeshBasicMaterial({ map: swirl, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.18;
  group.add(disc);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 7, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#9a6bff', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  beam.position.y = 3.9;
  group.add(beam);
  const light = new GlowLight('#a77bff', 6, 14, 1.6);
  light.position.y = 2.2;
  group.add(light);

  // the hall: four walls (a doorway in the south one), a roof with an opening over the beam
  const solid = [];
  const put = (lx, lz, r, height = HALL_H) => solid.push({ x: p.x + lx, z: p.z + lz, r, kind: 'wall', height, y });
  const wall = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, HALL_H, d), hallMat); m.position.set(x, HALL_H / 2 - 0.2, z); m.castShadow = true; m.receiveShadow = true; group.add(m); };
  const door = 1.8; // half the doorway's width
  wall(HALL * 2 + 0.8, 0.8, 0, -HALL); wall(0.8, HALL * 2, -HALL, 0); wall(0.8, HALL * 2, HALL, 0);
  wall(HALL - door, 0.8, -(HALL + door) / 2, HALL); wall(HALL - door, 0.8, (HALL + door) / 2, HALL);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(door * 2, HALL_H - 3.4, 0.8), hallMat);
  lintel.position.set(0, 3.4 + (HALL_H - 3.4) / 2 - 0.2, HALL);
  group.add(lintel);
  for (let t = -HALL; t <= HALL; t += 1.2) {
    put(t, -HALL, 0.6); put(-HALL, t, 0.6); put(HALL, t, 0.6);
    if (Math.abs(t) > door + 0.3) put(t, HALL, 0.6);
  }
  const hole = 2.4;
  for (const [w, d, x, z] of [[HALL * 2 + 1.6, HALL - hole, 0, -(HALL + hole) / 2], [HALL * 2 + 1.6, HALL - hole, 0, (HALL + hole) / 2], [HALL - hole, hole * 2, -(HALL + hole) / 2, 0], [HALL - hole, hole * 2, (HALL + hole) / 2, 0]]) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d + 0.8), roofMat);
    roof.position.set(x, HALL_H - 0.2, z); roof.castShadow = true;
    group.add(roof);
  }
  // lamps on the inside walls, and a name over the door
  for (const [lx, lz] of [[-HALL + 0.5, -3], [HALL - 0.5, -3], [-HALL + 0.5, 3], [HALL - 0.5, 3]]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.35, 0.25), lampMat);
    l.position.set(lx, 2.6, lz);
    group.add(l);
  }
  const inLight = new GlowLight('#e0d0ff', 5, 16, 1.4);
  inLight.position.set(0, 4.5, 0);
  group.add(inLight);
  // two guards outside the door, of the land's own people
  const [races, gear] = GUARDS[p.region] || GUARDS.heart;
  const guardGear = Object.fromEntries(Object.entries(gear).filter(([, id]) => ITEMS[id]).map(([k, id]) => [k, ITEMS[id]]));
  const guards = [-1, 1].map((side, i) => {
    const b = buildCharacter({ race: races[i], form: 'humanoid', look: {} });
    wearGear(b, guardGear);
    joinCrowd(bakeCharacter(b));
    b.position.set(side * (door + 1.2), heightAt(p.x + side * (door + 1.2), p.z + HALL + 1.4) - y, HALL + 1.4);
    group.add(b);
    put(side * (door + 1.2), HALL + 1.4, 0.6, 2);
    return b;
  });
  return {
    group,
    solid,
    update(t) {
      for (const b of guards) animateCharacter(b, t, 0);
      disc.rotation.z = t * 1.4;
      beam.material.opacity = 0.13 + Math.sin(t * 2.2) * 0.04;
      light.intensity = 6 + Math.sin(t * 3) * 1.5;
    },
  };
}
