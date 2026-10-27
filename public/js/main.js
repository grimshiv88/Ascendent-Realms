// Front door flow: intro → title docks → Choose → Sign Up / Sign In → clouds → next screen.
import { startIntro } from './intro.js';
import * as api from './api.js';
import { paintCloudBanks } from './clouds.js';
import { openCreator } from './creator.js';
import { startWorld } from './world/world.js';
import { renderMap, createMinimap } from './mapview.js';
import { renderHud, renderStatus, renderSettings, toggleMenu, HELP_HTML } from './status.js';
import { createProgress } from './progress.js';
import { renderBag, renderShop, renderSmith, tabsHtml } from './bag.js';
import { renderQuests } from './quests.js';
import { renderLand } from './landui.js';
import { makeStage } from './characters/stage.js';
import { buildCharacter, animateCharacter } from './characters/model.js';
import { wearGear } from './characters/gear.js';
import { fillIcons } from './characters/icons.js';

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

// Stay signed in: if this browser remembers an account, offer to go straight back in
api.resume().then((r) => {
  if (!r?.account) return;
  $('welcome-name').textContent = r.account.character?.name || r.account.username;
  $('welcome-back').classList.remove('hidden');
  $('continue-btn').addEventListener('click', () => enterRealm(r));
  $('signout-btn').addEventListener('click', async () => { await api.signOut(); $('welcome-back').classList.add('hidden'); });
});

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
const settings = (() => {
  try { return { camera: 'free', ...JSON.parse(localStorage.getItem('ar-settings') || '{}') }; } catch { return { camera: 'free' }; }
})();
const saveSettings = () => { try { localStorage.setItem('ar-settings', JSON.stringify(settings)); } catch { /* private window */ } };
const FIST = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7.5a1.5 1.5 0 0 1 3 0V10m0-3.2a1.5 1.5 0 0 1 3 0V10m0-2.6a1.5 1.5 0 0 1 3 0V11m0-1.4a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a6 6 0 0 1-6-6v-2.2a2 2 0 0 1 2.4-2l1.6.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SWORD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4l-9.5 9.5M20 4h-4l-8 8m12-8v4l-8 8M6.5 13.5l4 4M8 15l-4 4m0 0l1 1m-1-1l-1-1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function startGame(character) {
  $('game').classList.remove('hidden');
  const overlay = $('overlay');
  const ui = { selected: null, pending: {}, pick: [], shopMsg: '', smithMsg: '', questMsg: '', plot: null, landChoice: 'house', landMsg: '', landBusy: false };
  let hudQueued = false;

  const game = createProgress(character, {
    save: (p) => api.saveProgress(p).catch(() => {}),
    onChange(what) {
      // HP ticks often while resting, so the HUD redraws at most once a frame
      if (!hudQueued) { hudQueued = true; requestAnimationFrame(() => { hudQueued = false; drawHud(); }); }
      if (what === 'gear') world?.refreshGear();
      if (what !== 'hp' && what !== 'fatigue' && !overlay.classList.contains('hidden')) drawPanel();
    },
    onEvent(type, data) {
      if (type === 'level') { world?.say(`Level ${data}!`, 'exp'); showArea(`Level ${data}! New Stat Points and a purse of coins.`); }
      if (type === 'bag-full') world?.say('Your bag is full', 'hurt');
    },
  });

  // Land: L shows the grid of plots around you; tap one to see it in the Land window
  function toggleLand() {
    const on = !world.landMode;
    world.setLandMode(on);
    if (on) {
      api.landList().then((r) => world.setLands(r.plots || [])).catch(() => {});
      showArea('Land: tap a square to see it. Green is for sale, gold is yours. Press L to leave.');
    } else {
      showArea('Left the land grid.');
    }
  }
  async function landAction(call, okText) {
    ui.landBusy = true; drawPanel();
    try {
      await game.saveNow(); // so the server charges from your latest coins
      const r = await call();
      game.setCoins(r.coins);
      world.setLands(r.plots);
      ui.plot = world.selectPlot({ ix: ui.plot.ix, iz: ui.plot.iz });
      ui.landMsg = okText;
    } catch (err) {
      ui.landMsg = err.message;
    }
    ui.landBusy = false;
    drawPanel();
  }

  const here = () => world?.position() || { x: character.location?.x || 0, z: character.location?.z || 0 };
  const questReady = (title) => { showArea(`${title}: done! Open Quests (Q) to claim the reward.`); world?.say('Quest ready', 'exp'); };

  function drawHud() {
    renderHud($('hud'), character, game.stats());
    const btn = $('attack-btn');
    const armed = !!game.weapon();
    btn.innerHTML = armed ? SWORD : FIST;
    btn.setAttribute('aria-label', armed ? `Attack with ${game.weapon().name}` : 'Punch');
    btn.classList.toggle('armed', armed);
  }

  function drawPanel() {
    const name = overlay.dataset.panel;
    if (name === 'status') renderStatus(overlay, character, ui.pending, game.stats());
    else if (name === 'bag') { renderBag(overlay, game, ui.selected); preview.mount(overlay.querySelector('[data-preview]')); }
    else if (name === 'shop') renderShop(overlay, game, ui.shopMsg);
    else if (name === 'smith') renderSmith(overlay, game, ui.pick, ui.smithMsg);
    else if (name === 'quests') renderQuests(overlay, game, tabsHtml, ui.questMsg);
    else if (name === 'map') renderMap(overlay, () => world?.position(), (character.quests || []).filter((q) => q.accepted && q.type === 'explore' && !q.have).map((q) => ({ ...q.place, label: q.title.replace('Explore: ', '') })));
    else if (name === 'settings') renderSettings(overlay, settings, api.deviceAccounts(), api.cloudSaves());
    else if (name === 'land' && ui.plot) renderLand(overlay, ui.plot, game, { choice: ui.landChoice, message: ui.landMsg, busy: ui.landBusy });
    else overlay.innerHTML = HELP_HTML;
    if (name !== 'bag') preview.unmount();
    if (name === 'bag' || name === 'shop') fillIcons(overlay);
  }
  const openPanel = (name) => {
    if (!overlay.classList.contains('hidden') && overlay.dataset.panel === name) { closePanel(); return; }
    overlay.dataset.panel = name;
    ui.shopMsg = ''; ui.smithMsg = ''; ui.questMsg = '';
    drawPanel();
    overlay.classList.remove('hidden');
  };
  const closePanel = () => { overlay.classList.add('hidden'); preview.unmount(); };

  // Your character in the bag, turning slowly, wearing what you have on
  const preview = (() => {
    const canvas = document.createElement('canvas');
    canvas.className = 'bag-canvas';
    let stage = null, model = null, key = '';
    const build = () => {
      const worn = game.worn();
      const k = JSON.stringify(Object.entries(worn).map(([s, g]) => [s, g.entry.uid, g.plus]));
      if (model && k === key) return;
      key = k;
      if (model) stage.scene.remove(model);
      model = buildCharacter({ race: character.race, form: character.form, stage: character.stage || 0, look: character.look });
      wearGear(model, worn);
      stage.scene.add(model);
      const h = model.userData.height;
      stage.camera.position.set(0, h * 0.6, h * 2.6 + 0.6);
      stage.camera.lookAt(0, h * 0.48, 0);
    };
    return {
      mount(el) {
        if (!el) return;
        el.append(canvas);
        stage ||= makeStage(canvas);
        stage.resize();
        build();
        stage.renderer.setAnimationLoop((ms) => {
          model.rotation.y = ms / 2400;
          animateCharacter(model, ms / 1000, 0);
          stage.renderer.render(stage.scene, stage.camera);
        });
      },
      unmount() { stage?.renderer.setAnimationLoop(null); canvas.remove(); },
    };
  })();

  drawHud();
  $('hud').addEventListener('click', (e) => {
    if (e.target.closest('[data-menu]')) { toggleMenu(); drawHud(); return; }
    const b = e.target.closest('[data-open]');
    if (b) { toggleMenu(false); drawHud(); if (b.dataset.open === 'land') toggleLand(); else openPanel(b.dataset.open); }
  });
  $('attack-btn').classList.remove('hidden');
  $('attack-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); world?.attack(); });

  const SHOP_SAYS = { ok: 'Bought. It is in your bag.', locked: 'You need a higher level for that.', coins: 'Not enough coins.', full: 'Your bag is full.' };
  const SMITH_SAYS = { ok: 'Merged! The item is stronger.', class: 'Only a Blacksmith can merge.', pick: 'Pick two items.', kind: 'Those two are different kinds.', max: 'That item is already at its strongest.' };
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-close]')) { closePanel(); return; }
    const t = (attr) => e.target.closest(`[${attr}]`)?.getAttribute(attr);
    let v;
    if ((v = t('data-open')) != null) { overlay.dataset.panel = ''; openPanel(v); return; }
    if ((v = t('data-quest-accept')) != null) { game.questAccept(Number(v)); ui.questMsg = 'Quest accepted.'; drawPanel(); return; }
    if ((v = t('data-quest-drop')) != null) { game.questDrop(Number(v), here()); ui.questMsg = 'Quest given up. A new one has appeared.'; drawPanel(); return; }
    if ((v = t('data-quest-claim')) != null) {
      const r = game.questClaim(Number(v), here());
      if (r) { ui.questMsg = `Quest complete: +${r.exp} EXP, +${r.coins} G${r.item ? `, ${r.item.replace(/_/g, ' ')}` : ''}.`; world?.say('Quest complete!', 'exp'); }
      drawPanel(); return;
    }
    if ((v = t('data-land-pick')) != null) { ui.landChoice = v; ui.landMsg = ''; drawPanel(); return; }
    if (t('data-land-buy') != null) { landAction(() => api.landBuy(ui.plot.ix, ui.plot.iz, ui.landChoice), 'The land is yours!'); return; }
    if (t('data-land-change') != null) { landAction(() => api.landPurpose(ui.plot.ix, ui.plot.iz, ui.landChoice), 'Purpose changed.'); return; }
    if (t('data-land-prepare') != null) { landAction(() => api.landPrepare(ui.plot.ix, ui.plot.iz), 'Cleared and levelled. Ready to build on.'); return; }
    if (t('data-signout') != null) { game.saveNow(); world?.stop(); api.signOut().then(() => location.reload()); return; }
    if (t('data-torch') != null) { closePanel(); world?.placeTorch(); return; }
    if ((v = t('data-camera')) != null) { settings.camera = v; saveSettings(); world?.setCameraMode(v); drawPanel(); return; }
    if ((v = t('data-add')) != null) { ui.pending[v] = (ui.pending[v] || 0) + 1; drawPanel(); return; }
    if (t('data-confirm-points') != null) { game.spendPoints(ui.pending); ui.pending = {}; drawPanel(); return; }
    if (t('data-reset-points') != null) { ui.pending = {}; drawPanel(); return; }
    if ((v = t('data-equip')) != null) { game.equip(v); return; }
    if ((v = t('data-use')) != null) { game.use(v); if (!game.entry(v)) ui.selected = null; drawPanel(); return; }
    if ((v = t('data-drop')) != null) { game.removeItem(v, 1); if (!game.entry(v)) ui.selected = null; return; }
    if ((v = t('data-craft')) != null) { game.craft(game.recipes.find((r) => r.makes === v)); return; }
    if ((v = t('data-item')) != null) { ui.selected = ui.selected === v ? null : v; drawPanel(); return; }
    if ((v = t('data-buy')) != null) { ui.shopMsg = SHOP_SAYS[game.buy(v)]; drawPanel(); return; }
    if ((v = t('data-sell')) != null) { const e2 = game.entry(v); const price = e2 && game.sellPrice(e2); game.sell(v); ui.shopMsg = price ? `Sold for ${price} coins.` : ''; drawPanel(); return; }
    if ((v = t('data-pick')) != null) {
      if (ui.pick.includes(v)) ui.pick = ui.pick.filter((k) => k !== v);
      else ui.pick = [...ui.pick, v].slice(-2);
      ui.smithMsg = ''; drawPanel(); return;
    }
    if (t('data-merge') != null) {
      const r = game.merge(...ui.pick);
      ui.smithMsg = SMITH_SAYS[r];
      if (r === 'ok') ui.pick = [ui.pick[0]];
      drawPanel();
    }
  });

  world = startWorld($('world'), character, {
    game,
    view: { camera: settings.camera },
    onArea: (name) => showArea(name),
    onPlot(info) {
      ui.plot = info;
      ui.landMsg = '';
      ui.landChoice = info.owned?.purpose || 'house';
      overlay.dataset.panel = 'land';
      drawPanel();
      overlay.classList.remove('hidden');
    },
    onSaveLocation: (loc) => { character.location = { ...character.location, ...loc }; api.saveLocation(loc).catch(() => {}); },
    onEvent(type, data) {
      if (type === 'kill') for (const title of game.questKill(data.kind)) questReady(title);
      if (type === 'tired') showArea('You are getting very tired. Sleep (Z) by a fire or a torch before you collapse.');
      if (type === 'collapsed') showArea('You collapsed from exhaustion! Monsters may find you…');
      if (type === 'defeated') showArea(`Defeated by a ${data.by}. You wake up back home.`);
    },
    onKey(e) {
      if (e.code === 'KeyC') openPanel('status');
      if (e.code === 'KeyI') openPanel('bag');
      if (e.code === 'KeyB') openPanel('shop');
      if (e.code === 'KeyQ') openPanel('quests');
      if (e.code === 'KeyH') openPanel('help');
      if (e.code === 'KeyM') openPanel('map');
      if (e.code === 'KeyO') openPanel('settings');
      if (e.code === 'KeyL') toggleLand();
      if (e.code === 'Escape') closePanel();
    },
  });
  window.addEventListener('pagehide', () => game.saveNow());
  // Everyone's land: posts on owned plots, and levelled ground
  api.landList().then((r) => world.setLands(r.plots || [])).catch(() => {});
  // Explore quests finish when you reach the place
  game.fillQuests(here());
  setInterval(() => {
    const p = world?.position();
    if (p) for (const title of game.questVisit(p.x, p.z)) questReady(title);
  }, 1500);
  // the minimap in the corner follows you; tap it for the world map
  createMinimap($('minimap'), () => world?.position(), () => openPanel('map'));
  openPanel('help');
}

// The region name fades in at the top of the screen when you enter a new area
let areaTimer = null;
function showArea(name) {
  const el = $('area');
  el.textContent = name;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(areaTimer);
  areaTimer = setTimeout(() => el.classList.remove('show'), 4000);
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

