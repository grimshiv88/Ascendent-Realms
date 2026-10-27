// Designer gallery: every race and form, lined up from the starting body to the last evolution.
import * as THREE from 'three';
import { buildCharacter, animateCharacter } from './characters/model.js';
import { RACES, EVOLUTIONS, EVOLUTION_LEVELS, ADVANCEMENTS } from './data/game-data.mjs';
import { makeStage } from './characters/stage.js';

const canvas = document.getElementById('c');
const { renderer, scene, camera, resize } = makeStage(canvas);

const params = new URLSearchParams(location.search);
let race = params.get('race') || 'lizardman';
let form = params.get('form') || 'monster';
let lineup = new THREE.Group();
scene.add(lineup);

function rebuild() {
  scene.remove(lineup);
  lineup = new THREE.Group();
  const isMonster = RACES[race].side === 'monster';
  const names = isMonster ? EVOLUTIONS[race] : ADVANCEMENTS.swordsman;
  const chars = names.map((_, stage) => buildCharacter({ race, form: isMonster ? form : 'humanoid', stage }));
  // spread them out so each has room
  let x = 0;
  const xs = [];
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  chars.forEach((c, i) => {
    c.updateMatrixWorld(true);
    box.setFromObject(c).getSize(size);
    c.userData.box = size.clone();
    const w = Math.max(Math.max(size.x, size.z) * 0.8, 0.6);
    if (i > 0) x += w / 2;
    xs.push(x);
    x += w / 2 + 0.4;
  });
  const mid = (xs[0] + xs[xs.length - 1]) / 2;
  chars.forEach((c, i) => { c.position.x = xs[i] - mid; c.rotation.y = -0.5; lineup.add(c); });
  scene.add(lineup);
  const tallest = Math.max(...chars.map((c) => c.userData.box.y));
  const width = xs[xs.length - 1] - xs[0] + 2;
  const dist = Math.max(width / (2 * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect), tallest * 1.6) * 1.05;
  camera.position.set(0, tallest * 0.6, dist);
  camera.lookAt(0, tallest * 0.42, 0);

  const labels = document.getElementById('labels');
  labels.style.gridTemplateColumns = `repeat(${names.length}, 1fr)`;
  labels.innerHTML = names.map((n, i) => `<div><b>${n}</b>Level ${EVOLUTION_LEVELS[i]}</div>`).join('');
  if (!isMonster) labels.insertAdjacentHTML('beforeend', '');

  document.getElementById('forms').style.display = isMonster ? '' : 'none';
  for (const b of document.querySelectorAll('[data-race]')) b.setAttribute('aria-pressed', String(b.dataset.race === race));
  for (const b of document.querySelectorAll('[data-form]')) b.setAttribute('aria-pressed', String(b.dataset.form === form));
}

const raceBox = document.getElementById('races');
for (const [id, r] of Object.entries(RACES)) {
  const b = document.createElement('button');
  b.textContent = r.name;
  b.dataset.race = id;
  b.onclick = () => { race = id; rebuild(); };
  raceBox.appendChild(b);
}
for (const [id, label] of [['monster', 'Monster form'], ['humanoid', 'Humanoid form']]) {
  const b = document.createElement('button');
  b.textContent = label;
  b.dataset.form = id;
  b.onclick = () => { form = id; rebuild(); };
  document.getElementById('forms').appendChild(b);
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = e.clientX; });
window.addEventListener('pointerup', () => { drag = null; });
window.addEventListener('pointermove', (e) => {
  if (drag === null) return;
  const dx = e.clientX - drag;
  drag = e.clientX;
  lineup.children.forEach((c) => { c.rotation.y += dx * 0.01; });
});

window.addEventListener('resize', () => { resize(); rebuild(); });
resize();
rebuild();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  lineup.children.forEach((c) => animateCharacter(c, t, 0));
  renderer.render(scene, camera);
});
