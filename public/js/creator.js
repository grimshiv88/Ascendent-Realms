// Character creation: Player or Monster → race → class → look, with a live 3D preview.
import * as THREE from 'three';
import { buildCharacter, animateCharacter } from './characters/model.js';
import { makeStage } from './characters/stage.js';
import {
  RACES, CLASSES, MAIN_STATS, STAT_NAMES, APPEARANCE, startingStats, derivedStats,
} from './data/game-data.mjs';

const STEPS = ['Path', 'Race', 'Class', 'Look'];
const SHORT = { str: 'STR', agi: 'AGI', dex: 'DEX', sta: 'STA', int: 'INT' };

export function openCreator(root, { username, onCreate }) {
  const choice = { side: null, race: null, cls: null, form: 'monster', look: {} };
  let step = 0;

  root.innerHTML = `
    <div class="creator">
      <div class="creator-preview">
        <canvas></canvas>
        <div class="form-toggle hidden" role="group" aria-label="Form">
          <button type="button" data-form="monster">Monster form</button>
          <button type="button" data-form="humanoid">Humanoid form</button>
        </div>
        <p class="drag-hint">Drag to turn</p>
      </div>
      <div class="creator-panel">
        <p class="creator-name">${escapeHtml(username)}</p>
        <ol class="steps"></ol>
        <div class="step-body"></div>
        <p class="error" role="alert"></p>
        <div class="creator-nav">
          <button type="button" class="link-button" data-nav="back">Back</button>
          <button type="button" class="gold-button" data-nav="next">Next</button>
        </div>
      </div>
    </div>`;

  const $ = (sel) => root.querySelector(sel);
  const canvas = $('canvas');
  const { renderer, scene, camera, resize } = makeStage(canvas);
  scene.background = null;
  let model = null;
  let turn = 0.4;

  function showModel() {
    if (model) scene.remove(model);
    model = null;
    if (!choice.race) return;
    const isMonster = RACES[choice.race].side === 'monster';
    model = buildCharacter({ race: choice.race, form: isMonster ? choice.form : 'humanoid', look: choice.look });
    scene.add(model);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const h = Math.max(size.y, 0.4);
    const reach = Math.max(h, size.x * 0.8, size.z * 0.8);
    camera.position.set(0, h * 0.6, reach * 2.2 + 0.5);
    camera.lookAt(0, h * 0.48, 0);
    $('.form-toggle').classList.toggle('hidden', !isMonster);
    root.querySelectorAll('[data-form]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.form === choice.form)));
  }

  root.querySelectorAll('[data-form]').forEach((b) => {
    b.addEventListener('click', () => { choice.form = b.dataset.form; showModel(); });
  });

  // Drag to turn the preview
  let dragX = null;
  canvas.addEventListener('pointerdown', (e) => { dragX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (dragX === null) return;
    turn += (e.clientX - dragX) * 0.01;
    dragX = e.clientX;
  });
  canvas.addEventListener('pointerup', () => { dragX = null; });

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime();
    if (model) {
      model.rotation.y = turn;
      animateCharacter(model, t, 0);
    }
    renderer.render(scene, camera);
  });
  const onResize = () => resize();
  window.addEventListener('resize', onResize);
  resize();

  function statBars(stats, bonus = {}) {
    return `<dl class="stat-bars">${MAIN_STATS.map((k) => `
      <div><dt>${STAT_NAMES[k]}</dt>
      <dd><span class="bar"><span style="width:${Math.min(100, (stats[k] / 22) * 100)}%"></span></span>
      <b>${stats[k]}</b>${bonus[k] ? `<em>+${bonus[k]}</em>` : ''}</dd></div>`).join('')}</dl>`;
  }

  function renderStep() {
    $('.steps').innerHTML = STEPS.map((s, i) => `<li class="${i === step ? 'current' : i < step ? 'done' : ''}">${s}</li>`).join('');
    $('.error').textContent = '';
    const body = $('.step-body');
    const next = $('[data-nav=next]');
    $('[data-nav=back]').style.visibility = step === 0 ? 'hidden' : 'visible';
    next.textContent = step === STEPS.length - 1 ? 'Begin your journey' : 'Next';

    if (step === 0) {
      body.innerHTML = `
        <h2>Choose your path</h2>
        <div class="path-cards">
          <button type="button" class="path-card" data-side="player"><b>Player</b><span>Elf, Dwarf, Hobbit, Giant or Beastkin. Start in the central forest.</span></button>
          <button type="button" class="path-card" data-side="monster"><b>Monster</b><span>Goblin, Slime, Fairy, Lizardman, Naga or Dragonewt. Grow and evolve.</span></button>
        </div>`;
      body.querySelectorAll('[data-side]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.side === choice.side));
        b.addEventListener('click', () => {
          if (choice.side !== b.dataset.side) { choice.side = b.dataset.side; choice.race = null; choice.look = {}; showModel(); }
          step = 1;
          renderStep();
        });
      });
    }

    if (step === 1) {
      const races = Object.entries(RACES).filter(([, r]) => r.side === choice.side);
      if (!choice.race) { choice.race = races[0][0]; showModel(); }
      const r = RACES[choice.race];
      body.innerHTML = `
        <h2>Choose your race</h2>
        <div class="chip-row">${races.map(([id, x]) => `<button type="button" class="chip" data-race="${id}" aria-pressed="${id === choice.race}">${x.name}</button>`).join('')}</div>
        <p class="blurb">${r.blurb}</p>
        <p class="facts">Element: <b>${r.element}</b> · Starts in: <b>${r.home}</b>${r.side === 'monster' ? ` · Levels up: <b>${r.expMult === 1 ? 'easiest' : `${Math.round((r.expMult - 1) * 100)}% slower`}</b>` : ''}</p>
        ${statBars(r.stats)}
        <p class="facts">Total base points: <b>50</b></p>`;
      body.querySelectorAll('[data-race]').forEach((b) => b.addEventListener('click', () => {
        choice.race = b.dataset.race;
        choice.look = {};
        showModel();
        renderStep();
      }));
    }

    if (step === 2) {
      const stats = choice.cls ? startingStats(choice.race, choice.cls) : RACES[choice.race].stats;
      const d = derivedStats(stats, 1);
      body.innerHTML = `
        <h2>Choose your class</h2>
        <div class="chip-row">${Object.entries(CLASSES).map(([id, c]) => `<button type="button" class="chip" data-cls="${id}" aria-pressed="${id === choice.cls}">${c.name}</button>`).join('')}</div>
        <p class="blurb">${choice.cls ? CLASSES[choice.cls].blurb : 'Your class adds 10 bonus points and decides your class quests.'}</p>
        ${statBars(stats, choice.cls ? CLASSES[choice.cls].bonus : {})}
        <dl class="derived">${[['HP', d.hp], ['SP', d.sp], ['ATK', d.atk], ['MATK', d.matk], ['DEF', d.def], ['MDEF', d.mdef]]
          .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
      body.querySelectorAll('[data-cls]').forEach((b) => b.addEventListener('click', () => { choice.cls = b.dataset.cls; renderStep(); }));
    }

    if (step === 3) {
      const pal = APPEARANCE[choice.race];
      const look = choice.look;
      const swatches = (key, label) => `
        <fieldset class="swatches"><legend>${label}</legend>
        ${pal[key].map((hex) => `<button type="button" style="--c:${hex}" data-key="${key}" data-hex="${hex}" aria-label="${label} ${hex}" aria-pressed="${(look[key] || pal[key][0]) === hex}"></button>`).join('')}
        </fieldset>`;
      const accentLabel = { slime: 'Glow', fairy: 'Wings and hair', lizardman: 'Belly scales', naga: 'Belly and hood', dragonewt: 'Belly scales' }[choice.race] || 'Hair or fur';
      body.innerHTML = `
        <h2>Adjust your look</h2>
        ${swatches('skin', choice.race === 'slime' ? 'Gel colour' : 'Skin, scales or fur')}
        ${swatches('accent', accentLabel)}
        ${swatches('eyes', 'Eyes')}
        <label class="size-slider">Body size <span>${Math.round((look.size || 1) * 100)}%</span>
          <input type="range" min="90" max="110" step="1" value="${Math.round((look.size || 1) * 100)}"></label>`;
      body.querySelectorAll('[data-hex]').forEach((b) => b.addEventListener('click', () => {
        look[b.dataset.key] = b.dataset.hex;
        showModel();
        renderStep();
      }));
      const slider = body.querySelector('input[type=range]');
      slider.addEventListener('input', () => {
        look.size = Number(slider.value) / 100;
        body.querySelector('.size-slider span').textContent = `${slider.value}%`;
        showModel();
      });
    }
  }

  $('[data-nav=back]').addEventListener('click', () => { step = Math.max(0, step - 1); renderStep(); });
  $('[data-nav=next]').addEventListener('click', async () => {
    const err = $('.error');
    if (step === 0 && !choice.side) { err.textContent = 'Choose Player or Monster.'; return; }
    if (step === 2 && !choice.cls) { err.textContent = 'Choose a class.'; return; }
    if (step < STEPS.length - 1) { step += 1; renderStep(); return; }
    const button = $('[data-nav=next]');
    button.disabled = true;
    try {
      await onCreate({ ...choice, form: RACES[choice.race].side === 'monster' ? choice.form : 'humanoid' });
    } catch (e) {
      err.textContent = e.message;
    } finally {
      button.disabled = false;
    }
  });

  renderStep();

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
