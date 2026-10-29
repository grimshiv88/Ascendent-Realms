// The card shown in the sky over a city's shrine after someone's Ceremony of Revealing: their
// name, race and new class, glowing high above the plaza for everyone in the city to see.
import * as THREE from 'three';
import { RACES, CLASSES } from '../data/game-data.mjs';

export function skyCard(entry) {
  const W = 1024, H = 600;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  // the card: dark parchment in a gold frame, with a soft light round it
  g.shadowColor = 'rgba(255, 210, 120, 0.9)'; g.shadowBlur = 40;
  g.fillStyle = 'rgba(28, 20, 12, 0.92)';
  roundRect(g, 40, 40, W - 80, H - 80, 36); g.fill();
  g.shadowBlur = 0;
  g.lineWidth = 10; g.strokeStyle = '#e8c060'; roundRect(g, 40, 40, W - 80, H - 80, 36); g.stroke();
  g.lineWidth = 3; g.strokeStyle = 'rgba(232, 192, 96, 0.6)'; roundRect(g, 62, 62, W - 124, H - 124, 26); g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#e8c060'; g.font = '600 40px Cinzel, Georgia, serif';
  g.fillText('✦ Ceremony of Revealing ✦', W / 2, 120);
  g.fillStyle = '#fff4d8'; g.font = '700 92px Cinzel, Georgia, serif';
  g.fillText(entry.name, W / 2, 245, W - 160);
  g.fillStyle = '#d8c8a8'; g.font = '500 48px Cinzel, Georgia, serif';
  g.fillText(RACES[entry.race]?.name || entry.race, W / 2, 345);
  g.fillStyle = '#ffd77a'; g.font = '700 64px Cinzel, Georgia, serif';
  g.fillText(CLASSES[entry.cls]?.name || entry.cls, W / 2, 440);
  g.fillStyle = 'rgba(216, 200, 168, 0.8)'; g.font = 'italic 32px Georgia, serif';
  g.fillText('has come of age', W / 2, 505);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  sprite.scale.set(30, 30 * H / W, 1);
  const group = new THREE.Group();
  group.add(sprite);
  // a beam of light from the shrine up to the card
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 2.2, 1, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd77a', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  group.add(beam);
  return {
    group,
    // the card floats `height` metres over the shrine, swaying gently
    update(t, height) {
      sprite.position.y = height + Math.sin(t * 0.8) * 0.8;
      beam.scale.y = height - 9;
      beam.position.y = (height - 9) / 2;
      beam.material.opacity = 0.14 + Math.sin(t * 2) * 0.04;
    },
    dispose() { tex.dispose(); sprite.material.dispose(); beam.geometry.dispose(); beam.material.dispose(); },
  };
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
