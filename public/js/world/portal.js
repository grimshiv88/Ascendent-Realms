// A portal stone: a ring of standing stones around a swirling disc of light, raised on a round dais
import * as THREE from 'three';
import { heightAt } from '../data/world-layout.mjs';

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
  const light = new THREE.PointLight('#a77bff', 6, 14, 1.6);
  light.position.y = 2.2;
  group.add(light);
  return {
    group,
    update(t) {
      disc.rotation.z = t * 1.4;
      beam.material.opacity = 0.13 + Math.sin(t * 2.2) * 0.04;
      light.intensity = 6 + Math.sin(t * 3) * 1.5;
    },
  };
}
