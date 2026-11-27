// Being born: nobody chooses their race or class. A new life begins at random (see data/birth.mjs),
// and this screen shows who you were born as: your race, your family, your Unique Skill and your
// stats, with your child self turning slowly beside it.
import * as THREE from 'three';
import { buildCharacter, animateCharacter } from './characters/model.js';
import { makeStage } from './characters/stage.js';
import { RACES, CLASSES, MAIN_STATS, STAT_NAMES } from './data/game-data.mjs';
import { PARENT_JOBS, BORN_AGE, CEREMONY_AGE } from './data/birth.mjs';
import { uniqueAbility } from './data/unique.mjs';
import { PLACES } from './data/world-layout.mjs';
import { bornTier } from './data/citypass.mjs';
import { moneyWords } from './data/money.mjs';

export function openCreator(root, { username, onBorn, onEnter }) {
  root.innerHTML = `
    <div class="creator">
      <div class="creator-preview">
        <canvas></canvas>
        <p class="drag-hint">Drag to turn</p>
      </div>
      <div class="creator-panel">
        <p class="creator-name">${escapeHtml(username)}</p>
        <div class="step-body"></div>
        <p class="error" role="alert"></p>
        <div class="creator-nav"><span></span><button type="button" class="gold-button" data-born>Be born</button></div>
      </div>
    </div>`;

  const $ = (sel) => root.querySelector(sel);
  const canvas = $('canvas');
  const { renderer, scene, camera, resize } = makeStage(canvas);
  scene.background = null;
  let model = null, turn = 0.4, born = null;

  function showModel(c) {
    if (model) scene.remove(model);
    model = buildCharacter({ race: c.race, form: c.form, look: c.look, age: BORN_AGE });
    scene.add(model);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const h = Math.max(size.y, 0.3);
    const reach = Math.max(h, size.x * 0.8, size.z * 0.8);
    camera.position.set(0, h * 0.6, reach * 2.2 + 0.4);
    camera.lookAt(0, h * 0.48, 0);
  }

  let dragX = null;
  canvas.addEventListener('pointerdown', (e) => { dragX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (dragX === null) return; turn += (e.clientX - dragX) * 0.01; dragX = e.clientX; });
  canvas.addEventListener('pointerup', () => { dragX = null; });
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    if (model) { model.rotation.y = turn; animateCharacter(model, clock.getElapsedTime(), 0); }
    renderer.render(scene, camera);
  });
  const onResize = () => resize();
  window.addEventListener('resize', onResize);
  resize();

  const statBars = (stats) => `<dl class="stat-bars">${MAIN_STATS.map((k) => `
    <div><dt>${STAT_NAMES[k]}</dt><dd><span class="bar"><span style="width:${Math.min(100, (stats[k] / 22) * 100)}%"></span></span><b>${stats[k]}</b></dd></div>`).join('')}</dl>`;

  function render() {
    const body = $('.step-body');
    if (!born) {
      body.innerHTML = `
        <h2>A new life</h2>
        <p class="blurb">Nobody chooses who they are born as. You will come into the world as a child of ${BORN_AGE}, in a family of one of the races, in their city.</p>
        <p class="blurb">You will see your stats and your Unique Skill from the start. Train at a school to lean towards the class you want, and at ${CEREMONY_AGE} the Ceremony of Revealing will tell you what you have become.</p>`;
      return;
    }
    const c = born;
    const f = c.child.family;
    const city = PLACES.find((p) => p.id === f.city)?.name || 'the city';
    const u = uniqueAbility(c);
    body.innerHTML = `
      <h2>You are born</h2>
      <p class="blurb">A ${escapeHtml(RACES[c.race].name)} child of ${BORN_AGE}, in ${escapeHtml(city)}.</p>
      <p class="facts">${{ noble: '<b>Lucky!</b> Your family is a noble house: you grow up in a manor in the Noble Quarter.', dump: '<b>Unlucky.</b> Your family lives in a shack in the Dump, down by the city walls.', common: 'Your family lives in a town house in the Common Quarter.' }[bornTier(c)] || ''}</p>
      <p class="facts">Your family gives you <b>${escapeHtml(moneyWords(c.coins || 0))}</b> to start with.</p>
      <p class="facts">Your parents: ${f.parents.map((p) => `<b>${escapeHtml(p.name)}</b>, ${escapeHtml(PARENT_JOBS[p.job]?.name || p.job)}`).join(' · ')}</p>
      <p class="facts">Element: <b>${escapeHtml(c.elements.join(', '))}</b></p>
      <p class="facts">Unique Skill: <b>${escapeHtml(c.uniqueSkill.name)}</b> (${escapeHtml(u.rank)}-Rank)${u.fit && CLASSES[u.fit] ? ` · suits a <b>${escapeHtml(CLASSES[u.fit].name)}</b>` : ''}</p>
      <p class="facts">${escapeHtml(u.text)}</p>
      ${statBars(c.stats)}
      <p class="facts">${escapeHtml(RACES[c.race].blurb)}</p>`;
  }

  const button = $('[data-born]');
  button.addEventListener('click', async () => {
    const err = $('.error');
    err.textContent = '';
    button.disabled = true;
    try {
      if (!born) {
        born = await onBorn();
        showModel(born);
        button.textContent = 'Open your eyes';
        render();
      } else await onEnter(born);
    } catch (e) {
      err.textContent = e.message;
    } finally {
      button.disabled = false;
    }
  });
  render();

  return {
    close() {
      renderer.setAnimationLoop(null);
      renderer.dispose();
      window.removeEventListener('resize', onResize);
      root.innerHTML = '';
    },
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
