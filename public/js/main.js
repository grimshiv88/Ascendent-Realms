// Front door flow: intro → title docks → Choose → Sign Up / Sign In → clouds → next screen.
import { startIntro } from './intro.js';
import * as api from './api.js';
import { paintCloudBanks } from './clouds.js';
import { openCreator } from './creator.js';
import { startWorld } from './world/world.js';
import { renderHud, renderStatus, HELP_HTML } from './status.js';

paintCloudBanks();

const $ = (id) => document.getElementById(id);
const panels = ['choose', 'signup', 'signin'];

function show(panelId) {
  for (const id of panels) $(id).classList.toggle('hidden', id !== panelId);
  $(panelId).querySelector('input')?.focus();
}

const intro = startIntro($('scene'), {
  onFlash() {
    const flash = $('flash');
    flash.classList.remove('on');
    void flash.offsetWidth; // restart the animation
    flash.classList.add('on');
  },
  onTitle() {
    $('title').classList.remove('hidden');
    $('title').classList.add('reveal');
  },
  onDone() {
    $('title').classList.remove('reveal');
    $('title').classList.add('docked');
    setTimeout(() => show('choose'), 900);
    removeSkip();
  },
});

// Click or press a key during the intro to skip it
const skip = () => intro.skip();
function removeSkip() {
  window.removeEventListener('pointerdown', skip);
  window.removeEventListener('keydown', skip);
}
window.addEventListener('pointerdown', skip);
window.addEventListener('keydown', skip);

document.querySelectorAll('[data-go]').forEach((el) => {
  el.addEventListener('click', () => show(el.dataset.go));
});

api.isPreviewMode().then((on) => $('preview-note').classList.toggle('hidden', !on));

// Clouds roll in from both sides, the next screen loads behind them, then they roll away.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function cloudTransition(loadNext) {
  const clouds = $('clouds');
  clouds.classList.add('closed');
  await wait(1300);
  await Promise.all([loadNext(), wait(1200)]);
  clouds.classList.remove('closed');
}

// After signing in: character creation for a new account, otherwise straight into the world.
function enterRealm({ account }) {
  return cloudTransition(async () => {
    intro.stop();
    $('scene').classList.add('hidden');
    $('ui').classList.add('hidden');
    if (account.character) startGame(account.character);
    else openCreation(account.username);
  });
}

let creator = null;
function openCreation(username) {
  $('creator-root').classList.remove('hidden');
  creator = openCreator($('creator-root'), {
    username,
    async onCreate(choice) {
      const { character } = await api.createCharacter(choice);
      await cloudTransition(async () => {
        creator.close();
        $('creator-root').classList.add('hidden');
        startGame(character);
      });
    },
  });
}

let world = null;
function startGame(character) {
  $('game').classList.remove('hidden');
  const overlay = $('overlay');
  const openPanel = (name) => {
    if (!overlay.classList.contains('hidden') && overlay.dataset.panel === name) { overlay.classList.add('hidden'); return; }
    overlay.dataset.panel = name;
    if (name === 'status') renderStatus(overlay, character);
    else overlay.innerHTML = HELP_HTML;
    overlay.classList.remove('hidden');
  };
  renderHud($('hud'), character);
  $('hud').addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]');
    if (b) openPanel(b.dataset.open);
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-close]')) overlay.classList.add('hidden');
  });
  world = startWorld($('world'), character, {
    onSaveLocation: (loc) => { character.location = { ...character.location, ...loc }; api.saveLocation(loc).catch(() => {}); },
    onKey(e) {
      if (e.code === 'KeyC') openPanel('status');
      if (e.code === 'KeyH') openPanel('help');
      if (e.code === 'Escape') overlay.classList.add('hidden');
    },
  });
  openPanel('help');
}

function wireForm(formId, action) {
  const form = $(formId);
  const error = form.querySelector('.error');
  const button = form.querySelector('button[type=submit]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.textContent = '';
    button.disabled = true;
    try {
      const result = await action(Object.fromEntries(new FormData(form)));
      form.reset();
      form.querySelectorAll('.reveal[aria-pressed="true"]').forEach((b) => b.click());
      await enterRealm(result);
    } catch (err) {
      error.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  });
}

// Eye buttons show or hide the password while typing
document.querySelectorAll('.reveal').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const input = btn.previousElementSibling;
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    btn.setAttribute('aria-pressed', String(!showing));
    btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  });
});

wireForm('signup-form', ({ confirm, ...fields }) => {
  if (fields.password !== confirm) throw new Error('The two passwords don\'t match.');
  return api.signUp(fields);
});
wireForm('signin-form', api.signIn);

