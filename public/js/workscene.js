// The work scene: when the player merges, forges or brews, their own character acts out the job
// at a work station (see world/work.js) in a small window over the game, then the result shows.
import * as THREE from 'three';
import { makeStage } from './characters/stage.js';
import { buildCharacter } from './characters/model.js';
import { wearGear } from './characters/gear.js';
import { buildWork } from './world/work.js';

let running = null;
// kind: 'smith' | 'brew'; opts go to buildWork (pieces, result, ore). Calls onDone when it ends or
// is skipped. Returns a function that stops it.
export function playWork(kind, character, worn, opts = {}, onDone = () => {}) {
  running?.();
  const el = document.createElement('div');
  el.className = 'work-scene';
  el.innerHTML = `<div class="work-box"><canvas></canvas><p class="work-step"></p>
    <button type="button" class="link-button work-skip">Skip ›</button></div>`;
  document.body.appendChild(el);
  const canvas = el.querySelector('canvas'), label = el.querySelector('.work-step');
  let stage;
  try { stage = makeStage(canvas); } catch { el.remove(); onDone(); return () => {}; }
  const { renderer, scene, camera, resize } = stage;
  scene.background = new THREE.Color('#1a130c');
  // the player, wearing their armour but with their hands free for the work
  const body = buildCharacter({ race: character.race, form: character.form, stage: character.stage || 0, look: character.look });
  wearGear(body, { ...worn, weapon: null, shield: null });
  const h = body.userData.height || 1.8;
  const work = buildWork(kind === 'brew' ? 'brew' : 'smith', { ...opts, top: 1.0, scale: Math.min(1.3, Math.max(0.6, h / 1.8)) });
  if (kind === 'brew') {
    // a work bench to brew on
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 0.7), new THREE.MeshStandardMaterial({ color: '#5a3e26', roughness: 0.85 }));
    bench.position.set(0, 0.5, -0.05);
    bench.receiveShadow = true;
    work.group.add(bench);
  }
  work.group.add(body);
  scene.add(work.group);
  // bigger bodies stand a little further back
  const s = Math.max(1, h / 1.8);
  camera.position.set(0.4, 3.4 * s, 4.6 * s);
  camera.lookAt(0, 0.8, -0.2);
  resize();
  const t0 = performance.now();
  let ended = false;
  function stop() {
    if (ended) return;
    ended = true;
    renderer.setAnimationLoop(null);
    work.dispose();
    renderer.dispose();
    el.remove();
    running = null;
    onDone();
  }
  renderer.setAnimationLoop(() => {
    const t = (performance.now() - t0) / 1000;
    const text = work.play(body, t, { once: true });
    if (text != null && label.textContent !== text) label.textContent = text;
    renderer.render(scene, camera);
    if (t > work.length + 0.6) stop();
  });
  el.querySelector('.work-skip').addEventListener('click', stop);
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') stop(); });
  running = stop;
  return stop;
}
