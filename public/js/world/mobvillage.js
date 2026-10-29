// What a monster village looks like: a ring of rough huts in the race's colours, a fence of
// sharpened stakes, a fire in the middle and the village chest beside it, locked until every
// monster of the village is beaten.
import * as THREE from 'three';
import { heightAt } from '../data/world-layout.mjs';
import { textTexture } from './spawn.js';
import { villageName, sizeOf } from '../data/mobvillages.mjs';

const LOOKS = {
  goblin: { wall: '#6b5a3c', roof: '#4a3b22', banner: '#5a8a2a' },
  slime: { wall: '#5d7f8c', roof: '#3b6170', banner: '#6fb8e8' },
  fairy: { wall: '#a77fbf', roof: '#5e8c4a', banner: '#e6b3ff' },
  lizardman: { wall: '#6e7a4a', roof: '#4a5a2e', banner: '#3a8a6a' },
  naga: { wall: '#4b6b7a', roof: '#2e4a5a', banner: '#4ac0c0' },
  dragonewt: { wall: '#7a4a3a', roof: '#3a2a2a', banner: '#d0502a' },
};
const HUT_R = 2.6;

export function buildMobVillage(v) {
  const L = LOOKS[v.race] || LOOKS.goblin;
  const g = new THREE.Group();
  const baseY = heightAt(v.x, v.z);
  g.position.set(v.x, baseY, v.z);
  const solid = [];
  const wall = new THREE.MeshStandardMaterial({ color: L.wall, roughness: 0.95 });
  const roof = new THREE.MeshStandardMaterial({ color: L.roof, roughness: 0.9 });
  const wood = new THREE.MeshStandardMaterial({ color: '#5a3d22', roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1a120a', roughness: 1 });
  const at = (x, z) => heightAt(v.x + x, v.z + z) - baseY;

  // the huts, in a ring with their doors to the fire
  const SZ = sizeOf(v);
  const huts = SZ.huts;
  for (let i = 0; i < huts; i++) {
    const a = (i / huts) * Math.PI * 2 + 0.4;
    const x = Math.cos(a) * SZ.ring, z = Math.sin(a) * SZ.ring;
    const hut = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(HUT_R, HUT_R * 1.08, 2.4, 10), wall);
    body.position.y = 1.2;
    const top = new THREE.Mesh(new THREE.ConeGeometry(HUT_R * 1.35, 2.4, 10), roof);
    top.position.y = 3.6;
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.7), dark);
    door.position.set(0, 0.85, HUT_R * 1.04 + 0.02);
    hut.add(body, top, door);
    hut.position.set(x, at(x, z), z);
    hut.rotation.y = Math.atan2(-x, -z);
    g.add(hut);
    solid.push({ x: v.x + x, z: v.z + z, r: HUT_R, kind: 'hut' });
  }
  // a fence of stakes, open on two sides
  const stake = new THREE.CylinderGeometry(0.12, 0.16, 2, 5);
  const stakes = Math.round(SZ.fence * 3);
  for (let i = 0; i < stakes; i++) {
    const a = (i / stakes) * Math.PI * 2;
    if (Math.abs(Math.sin(a)) < 0.12) continue; // the ways in, east and west
    const x = Math.cos(a) * SZ.fence, z = Math.sin(a) * SZ.fence;
    const s = new THREE.Mesh(stake, wood);
    s.position.set(x, at(x, z) + 0.9, z);
    s.rotation.z = Math.cos(a) * 0.15; s.rotation.x = -Math.sin(a) * 0.15;
    g.add(s);
  }
  // the fire, with a banner by it
  const logs = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1, 0.3, 8), wood);
  logs.position.y = at(0, 0) + 0.15;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.3, 7), new THREE.MeshBasicMaterial({ color: '#ff9a3a', transparent: true, opacity: 0.85 }));
  flame.position.y = at(0, 0) + 0.9;
  const fireLight = new THREE.PointLight('#ff9a3a', 2, 18, 1.5);
  fireLight.position.y = at(0, 0) + 1.5;
  g.add(logs, flame, fireLight);
  solid.push({ x: v.x, z: v.z, r: 1, kind: 'fire' });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 6), wood);
  pole.position.set(-3, at(-3, -2) + 2.5, -2);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), new THREE.MeshStandardMaterial({ color: L.banner, side: THREE.DoubleSide }));
  flag.position.set(-2.2, at(-3, -2) + 4.4, -2);
  g.add(pole, flag);
  // the name, over the fire
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(villageName(v)), depthWrite: false }));
  sign.scale.set(6, 1.5, 1);
  sign.position.set(0, at(0, 0) + 7, 0);
  g.add(sign);

  // the chest, locked while any of the village is left standing
  const cx = 2.6, cz = 1.2;
  const chestG = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: '#c9a64a', metalness: 0.8, roughness: 0.35 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.7, 0.8), wood);
  box.position.y = 0.35;
  const lid = new THREE.Group();
  const lidMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.3, 12, 1, false, 0, Math.PI), wood);
  lidMesh.rotation.z = Math.PI / 2;
  lid.add(lidMesh);
  lid.position.set(0, 0.7, 0);
  for (const s of [-0.5, 0.5]) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.74, 0.84), gold); band.position.set(s, 0.36, 0); chestG.add(band); }
  const glow = new THREE.PointLight('#ffd76a', 0, 6, 1.5);
  glow.position.y = 1.2;
  chestG.add(box, lid, glow);
  chestG.position.set(cx, at(cx, cz), cz);
  g.add(chestG);
  const chest = { x: v.x + cx, z: v.z + cz, r: 0.9, kind: 'chest', village: v.id, open: false, unlocked: false, height: 1.2 };
  solid.push(chest);

  // where the folk stand: around the fire and by the huts
  const homes = v.folk.map((f, i) => {
    const a = (i / v.folk.length) * Math.PI * 2;
    const r = i === v.folk.length - 1 ? 4 : 6 + (i % 3) * (SZ.ring - 4) / 3;
    return { x: v.x + Math.cos(a) * r, z: v.z + Math.sin(a) * r };
  });

  return {
    group: g, solid, chest, homes,
    unlock() { chest.unlocked = true; },
    openChest() { chest.open = true; glow.intensity = 0; lid.rotation.x = -1.9; },
    update(t) {
      flame.scale.y = 1 + Math.sin(t * 9) * 0.12;
      fireLight.intensity = 1.8 + Math.sin(t * 7) * 0.4;
      flag.rotation.y = Math.sin(t * 1.7) * 0.25;
      if (chest.unlocked && !chest.open) glow.intensity = 3 + Math.sin(t * 4) * 1.2;
    },
    dispose() {
      g.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose?.(); o.material?.dispose?.(); });
    },
  };
}
