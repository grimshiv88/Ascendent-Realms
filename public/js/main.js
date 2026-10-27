// Front door flow: intro → title docks → Choose → Sign Up / Sign In → clouds → next screen.
import { startIntro } from './intro.js';
import * as api from './api.js';
import { paintCloudBanks } from './clouds.js';

paintCloudBanks();

const $ = (id) => document.getElementById(id);
const panels = ['choose', 'signup', 'signin', 'arrival'];

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

function enterRealm({ account, isNew }) {
  return cloudTransition(async () => {
    $('title').classList.add('hidden');
    const heading = $('arrival-heading');
    const text = $('arrival-text');
    if (!account.character) {
      heading.textContent = isNew ? `Welcome, ${account.username}` : `Welcome back, ${account.username}`;
      text.textContent = 'Next you will choose to be a Player or a Monster, then your race and class. Character creation is the next part being built.';
    } else {
      heading.textContent = `Welcome back, ${account.username}`;
      text.textContent = `Returning you to ${account.character.location || 'where you last saved'}.`;
    }
    show('arrival');
  });
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
      await enterRealm(result);
    } catch (err) {
      error.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  });
}

wireForm('signup-form', api.signUp);
wireForm('signin-form', api.signIn);

$('signout').addEventListener('click', () =>
  cloudTransition(async () => {
    await api.signOut();
    $('title').classList.remove('hidden');
    show('choose');
  }),
);
