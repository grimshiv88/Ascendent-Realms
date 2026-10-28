// Front door flow: intro → title docks → Choose → Sign Up / Sign In → clouds → next screen.
import { startIntro } from './intro.js';
import * as api from './api.js';
import { paintCloudBanks } from './clouds.js';
import { openCreator } from './creator.js';
import { startWorld } from './world/world.js';
import { renderMap, createMinimap } from './mapview.js';
import { renderHud, renderStatus, renderSettings, renderRankings, toggleMenu, renderOptions, renderWelcome, bindHud, renderChallenge, HELP_HTML } from './status.js';
import { createProgress } from './progress.js';
import { renderBag, renderShop, renderSmith, renderPotions, tabsHtml, setTabsClass } from './bag.js';
import { ITEMS, forgeCost } from './data/items.mjs';
import { playWork } from './workscene.js';
import { renderAssess } from './idcard.js';
import { renderQuests, renderGuild } from './quests.js';
import { renderLand, renderCave } from './landui.js';
import { caveById } from './data/depths.mjs';
import { portalFee, portalKm } from './data/portals.mjs';
import { openBuilder as openBuilderView } from './builder.js';
import { loadSculpts } from './characters/sculpt.js';

const sculptsReady = loadSculpts();
import { PLOT, REACH, inReach, plotPrice } from './data/land.mjs';
import { makeStage } from './characters/stage.js';
import { buildCharacter, animateCharacter } from './characters/model.js';
import { wearGear } from './characters/gear.js';
import { fillIcons } from './characters/icons.js';
import { SPELLS } from './data/spells.mjs';
import { renderIdCard } from './idcard.js';
import { renderRooms } from './roomsui.js';
import { renderGroups } from './groupsui.js';
import { renderSkills, renderSkillBar, updateSkillBar } from './skillsui.js';
import { SKILLS } from './data/skills.mjs';
import { uniqueAbility, uniqueTier } from './data/unique.mjs';
import { challengeBar } from './data/kings.mjs';
import { renderCult } from './cultui.js';
import { GATES_R } from './data/cults.mjs';
import { gameTime as realmTime } from './data/clock.mjs';
import { placesWithPositions } from './data/world-layout.mjs';
import { createSocial } from './social.js';
import { actionFor, setKey, resetKeys, CONTROLS, FIXED_KEYS, codeFor, keyName } from './data/controls.mjs';

paintCloudBanks();

const $ = (id) => document.getElementById(id);
const panels = ['choose', 'signup', 'signin', 'story'];

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
    // after "Switch account" the sign-in form opens straight away
    let switching = false;
    try { switching = sessionStorage.getItem('ar.switch') === '1'; sessionStorage.removeItem('ar.switch'); } catch { /* blocked */ }
    setTimeout(() => show(switching ? 'signin' : 'choose'), 900);
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
    await sculptsReady; // the sculpted bodies, so characters are built from them
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
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
let social = null; // friends and chat
const settings = (() => {
  try { return { camera: 'free', ...JSON.parse(localStorage.getItem('ar-settings') || '{}') }; } catch { return { camera: 'free' }; }
})();
const saveSettings = () => { try { localStorage.setItem('ar-settings', JSON.stringify(settings)); } catch { /* private window */ } };
const FIST = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7.5a1.5 1.5 0 0 1 3 0V10m0-3.2a1.5 1.5 0 0 1 3 0V10m0-2.6a1.5 1.5 0 0 1 3 0V11m0-1.4a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a6 6 0 0 1-6-6v-2.2a2 2 0 0 1 2.4-2l1.6.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SWORD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4l-9.5 9.5M20 4h-4l-8 8m12-8v4l-8 8M6.5 13.5l4 4M8 15l-4 4m0 0l1 1m-1-1l-1-1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function startGame(character) {
  $('game').classList.remove('hidden');
  const overlay = $('overlay');
  const ui = { selected: null, pending: {}, pick: [], shopMsg: '', smithMsg: '', questMsg: '', plot: null, landChoice: 'house', landMsg: '', landBusy: false, basket: [] };
  let hudQueued = false;

  const game = createProgress(character, {
    save: (p) => api.saveProgress(p).catch(() => {}),
    onChange(what) {
      // HP ticks often while resting, so the HUD redraws at most once a frame
      if (!hudQueued) { hudQueued = true; requestAnimationFrame(() => { hudQueued = false; drawHud(); }); }
      if (what === 'gear') world?.refreshGear();
      if (what === 'form') world?.rebuildAvatar();
      if (what !== 'hp' && what !== 'fatigue' && what !== 'sp' && !overlay.classList.contains('hidden')) drawPanel();
      if (what === 'skills') drawSkillBar();
    },
    onEvent(type, data) {
      if (type === 'level') { world?.say(`Level ${data}!`, 'exp'); showArea(`Level ${data}! New Stat Points and a purse of coins.`); }
      if (type === 'bag-full') world?.say('Your bag is full', 'hurt');
      if (type === 'evolved') { world?.say('Your weapon evolved!', 'exp'); showArea(`Your weapon evolved into the ${data.name}!`); }
      if (type === 'spell') {
        const sp = SPELLS[data.id];
        const on = game.attachSpell(data.id) === 'ok';
        showArea(`You learned the spell ${sp.name}!${on ? ' It is on your staff.' : ' Attach it to a staff in Skills (K).'}`);
        world?.say(`New spell: ${sp.name}`, 'exp');
      }
      if (type === 'upgrade') {
        const sk = data.skill ? ` You learned ${SKILLS[data.skill].icon} ${SKILLS[data.skill].name}!` : '';
        showArea(data.evolution ? `Level ${data.level}!${sk}` : `Level ${data.level} upgrade! Every stat +2.${sk}`);
        if (data.skill) { world?.say(`New skill: ${SKILLS[data.skill].name}`, 'exp'); drawSkillBar(); }
      }
    },
  });

  // ---------- the Bounty Board in the Guild Hall ----------
  function loadBounties() {
    ui.bounty = null;
    api.bountiesList().then((r) => { ui.bounty = { board: r.board }; }).catch(() => { ui.bounty = { board: [] }; })
      .then(() => { if (overlay.dataset.panel === 'guild' && !overlay.classList.contains('hidden')) drawPanel(); });
  }

  // ---------- meeting rooms in the Guild Hall ----------
  function takeRentals(list) {
    ui.rentals = list || [];
    const allowed = {};
    for (const r of ui.rentals) if (r.allowed) allowed[r.room] = r.until;
    world?.setRooms(allowed);
    castleAccess();
    if (overlay.dataset.panel === 'rooms' && !overlay.classList.contains('hidden')) drawPanel();
  }
  // parties and guilds: invites show up as a note on screen
  let seenInvites = null;
  function takeGroups(v) {
    ui.groups = v;
    const ids = new Set(v.invites.map((i) => i.id));
    if (!seenInvites && v.invites.length) showArea(`You have ${v.invites.length === 1 ? 'an invite' : `${v.invites.length} invites`} waiting. Press ${keyName(codeFor('groups'))} to answer.`);
    if (seenInvites) for (const i of v.invites) if (!seenInvites.has(i.id)) showArea(`${i.from} invites you to ${i.kind === 'party' ? 'their party' : `the guild ${i.label}`}. Press ${keyName(codeFor('groups'))} to answer.`);
    seenInvites = ids;
    castleAccess();
    if (overlay.dataset.panel === 'groups' && !overlay.classList.contains('hidden') && !ui.groupBusy) drawPanel();
  }
  // who may walk into the Emperors' Castle today
  function castleAccess() {
    world?.setCastleAccess({ emperor: !!ui.groups?.nation, guildMaster: !!ui.groups?.guild?.mine, guest: (ui.rentals || []).some((r) => r.room.startsWith('castle') && r.allowed && !r.mine) });
  }
  function loadGroups() { api.groupsList().then(takeGroups).catch(() => {}); }
  // ---------- cults and the Order of the Dawn ----------
  // Missions are counted here (kills near towns, kills by night, a night visit to a village waystone)
  // and kept in this browser until done.
  const missionCount = (m) => { try { return Number(localStorage.getItem(`ar-mission-${m.id}`)) || 0; } catch { return 0; } };
  const setMissionCount = (m, n) => { try { localStorage.setItem(`ar-mission-${m.id}`, String(n)); } catch { /* private window */ } };
  function takeCult(v) {
    if (!v) return;
    ui.cult = v;
    // gave the cult away: its powers and its coins are gone
    if (v.stripped && !ui.stripping) {
      ui.stripping = true;
      game.loseCult(v.stripped.reduce((a, x) => a + (x.coins || 0), 0));
      showArea('You gave the cult away. Its dark powers and every coin it gave you are gone.');
      api.cultAct({ action: 'ack' }).then((r) => { ui.stripping = false; takeCult(r); }).catch(() => { ui.stripping = false; });
    }
    // a cult has asked you to join: the offer comes to you at once
    if (v.invited && !ui.cultOffered) { ui.cultOffered = true; openPanel('cult'); return; }
    if (overlay.dataset.panel === 'cult' && !overlay.classList.contains('hidden')) drawPanel();
  }
  function loadCult() { api.cultsView().then(takeCult).catch(() => {}); }
  const activeMissions = () => [...(ui.cult?.cult?.missions || []), ...(ui.cult?.order?.missions || [])];
  function missionStep(kind) {
    for (const m of activeMissions()) {
      if (m.kind !== kind || ui.missionBusy?.[m.id]) continue;
      const n = missionCount(m) + 1;
      setMissionCount(m, n);
      if (n < m.need) continue;
      (ui.missionBusy ||= {})[m.id] = true;
      api.cultAct({ action: 'done', id: m.id }).then((r) => {
        game.gainCoins(r.coins || 0);
        world?.say(`Mission done: +${r.coins} G`, 'exp');
        takeCult(r);
      }).catch(() => { ui.missionBusy[m.id] = false; });
    }
  }
  const towns = () => placesWithPositions().filter((p) => p.city || p.village);
  const nearTown = (p, r) => towns().some((q) => Math.hypot(q.x - p.x, q.z - p.z) < r);
  setInterval(() => {
    const p = world?.position();
    if (p && realmTime().night && activeMissions().some((m) => m.kind === 'omen') && placesWithPositions().some((q) => q.village && Math.hypot(q.x - p.x, q.z - p.z) < 25)) missionStep('omen');
  }, 3000);
  setInterval(loadCult, 60000);

  // The crowns. A monster player as strong as their race's player King challenges them at once,
  // and a challenge (or its outcome) is shown straight away to both of them, once.
  function takeCourts(courts) {
    ui.courts = courts;
    const me = character.name;
    const mine = courts.find((c) => c.race === character.race);
    if (mine && !challengeBar(mine, character) && !ui.challengeSent) {
      ui.challengeSent = true;
      api.kingChallenge(character.race).then((r) => takeCourts(r.courts)).catch(() => {});
    }
    for (const c of courts) {
      const ch = c.challenge;
      if (!ch || (ch.by !== me && ch.king !== me)) continue;
      const key = `ar-challenge-${c.race}-${ch.at}-${ch.settled ? 's' : ch.answered ? 'a' : 'n'}`;
      let seen = false;
      try { seen = !!localStorage.getItem(key); localStorage.setItem(key, '1'); } catch { /* private window */ }
      if (seen || (ch.settled && Date.now() - ch.settledAt > 7 * 86400000)) continue;
      ui.challengeCourt = c; ui.challengeMsg = '';
      openPanel('challenge');
      break;
    }
  }
  loadGroups();
  loadRooms();
  setInterval(loadGroups, 20000);
  function loadRooms() { api.roomsList().then((r) => takeRentals(r.rentals)).catch(() => {}); }
  // while you're in the Guild Hall, keep up with who has which room (and when time runs out)
  let roomsTick = 0;
  setInterval(() => { roomsTick++; if (['guild', 'castle'].includes(world?.indoors?.kind) || roomsTick % 4 === 0) loadRooms(); }, 15000);

  // ---------- skills ----------
  const skillBar = $('skill-bar');
  let barSig = '';
  function drawSkillBar() {
    const sig = JSON.stringify([character.skillBar, uniqueTier(character.level), codeFor('unique'), codeFor('mythic'), game.knownSkills(), game.mythic()?.name]);
    if (sig === barSig) return;
    barSig = sig;
    renderSkillBar(skillBar, game);
  }
  const readyAt = {}; // skill id -> time (ms) it can be used again
  // the Unique Skill is used like a skill, at the strength its tier allows
  const skillOf = (id) => (id === 'unique' ? uniqueAbility(character) : id === 'mythic' ? (game.mythic() || { cd: 40, sp: 0, name: 'Mythic skill' }) : SKILLS[id]);
  const cooling = (id) => Math.max(0, (readyAt[id] || 0) - performance.now()) / (skillOf(id).cd * 1000);
  function trySkill(id) {
    const sk = skillOf(id);
    if (!sk || !world) return;
    if (id === 'mythic' && !game.mythic()) { world.say('Hold a Mythic weapon to use its skill', 'hurt'); return; }
    if (SKILLS[id] && !game.knownSkills().includes(id)) { world.say(`${sk.name}: put on the gear that holds it`, 'hurt'); return; }
    if (cooling(id) > 0) { world.say(`${sk.name}: ready in ${(cooling(id) * sk.cd).toFixed(1)}s`, 'hurt'); return; }
    const r = world.useSkill(sk);
    if (r === 'sp') world.say(`Not enough SP (${sk.name} needs ${sk.sp})`, 'hurt');
    else if (r === 'none') world.say('Nothing in reach', 'hurt');
    else if (r === 'ok') readyAt[id] = performance.now() + sk.cd * 1000;
  }
  skillBar.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-skill]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    trySkill(b.dataset.skill);
  });
  setInterval(() => { drawSkillBar(); updateSkillBar(skillBar, game, cooling, skillOf); }, 100);
  // the Potion-Maker's brewing: finished potions go into the bag
  setInterval(() => {
    const got = game.collectBrews();
    if (got.length) world?.say(`Brewed: ${got.join(', ')}`, 'exp');
    if (overlay.dataset.panel === 'potions' && !overlay.classList.contains('hidden')) drawPanel();
  }, 1000);
  // choosing a key for a skill: the next key pressed is the one
  window.addEventListener('keydown', (e) => {
    // choosing a key for an action in Settings → Controls
    if (ui.bindingControl) {
      e.preventDefault(); e.stopImmediatePropagation();
      const id = ui.bindingControl;
      ui.bindingControl = null;
      const name = CONTROLS.find((x) => x[0] === id)[1];
      if (e.code === 'Escape') ui.controlMsg = '';
      else if (FIXED_KEYS.includes(e.code)) ui.controlMsg = `${e.key} can't be used. Pick another key.`;
      else if (character.skillBar.some((b) => b.key === e.code)) ui.controlMsg = `${e.key.toUpperCase()} is on one of your skills. Change that skill's key first (Skills window).`;
      else { setKey(id, e.code); ui.controlMsg = `${name} is now on ${e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key}.`; }
      drawPanel();
      return;
    }
    if (!ui.binding) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.code !== 'Escape') {
      const r = game.setSkillKey(ui.binding, e.code);
      ui.skillMsg = r === 'reserved' ? `${e.key.toUpperCase()} is already used by the game. Pick another key.` : r === 'ok' ? `${SKILLS[ui.binding].name} is now on ${e.key.toUpperCase()}.` : '';
    }
    ui.binding = null;
    drawPanel();
  }, true);

  // Land: L shows the grid of plots around you; tap one to see it in the Land window
  // everyone's plots go to the world; yours are kept for the map
  function setLands(list) { ui.myPlots = list.filter((p) => p.mine); ui.otherPlots = list.filter((p) => !p.mine); world.setLands(list); }
  const loadCaves = () => api.caveList().then((r) => { ui.caves = r.caves || []; }).catch(() => {});
  function toggleLand() {
    const on = !world.landMode;
    world.setLandMode(on);
    if (on) {
      api.landList().then((r) => setLands(r.plots || [])).catch(() => {});
      showArea(`Land: tap squares to choose them, then buy them all at once. Green is for sale, blue is river (buy it beside your land), gold is yours. You can buy up to ${REACH} m away; the Map (M) shows more. Press L to leave.`);
    } else {
      ui.basket = [];
      showArea('Left the land grid.');
    }
  }
  // Tapping a plot (on the grid or the map): one you can buy goes into (or out of) the basket,
  // to buy together; any other opens on its own in the Land window. Returns the plot's info.
  function tapPlot(ix, iz) {
    const info = world.selectPlot({ ix, iz });
    ui.plot = info;
    ui.landMsg = '';
    ui.landChoice = info.owned?.purpose || ui.landChoice || 'house';
    const k = (p) => p.ix === ix && p.iz === iz;
    if (ui.basket.some(k)) ui.basket = ui.basket.filter((p) => !k(p));
    else if (!info.owned && !info.why) {
      const me = here();
      if (!inReach(ix, iz, me.x, me.z)) { ui.landMsg = `That plot is too far away. You can buy land up to ${REACH} m from where you stand.`; return info; }
      ui.basket = [...ui.basket, { ix, iz }];
    }
    world.choosePlots(ui.basket);
    // river plots chosen beside other chosen plots may no longer be allowed: the info is checked again
    ui.plot = world.selectPlot({ ix, iz });
    return info;
  }
  const basketTotal = () => ui.basket.reduce((a, p) => a + plotPrice(p.ix, p.iz), 0);
  function updateMapBasket() {
    const bar = overlay.querySelector('.map-basket');
    if (!bar) return;
    bar.hidden = !ui.basket.length && !ui.landMsg;
    bar.innerHTML = ui.basket.length
      ? `<span>${ui.basket.length} plot${ui.basket.length === 1 ? '' : 's'} chosen · ${basketTotal()} G</span><button type="button" class="sys-button" data-land-open>Buy…</button><button type="button" class="sys-button ghost" data-land-clear>Clear</button>`
      : `<span>${ui.landMsg}</span>`;
  }

  async function landAction(call, okText) {
    ui.landBusy = true; drawPanel();
    try {
      await game.saveNow(); // so the server charges from your latest coins
      const r = await call();
      game.setCoins(r.coins);
      setLands(r.plots);
      if (r.bought) { ui.basket = []; world.choosePlots([]); }
      ui.plot = world.selectPlot({ ix: ui.plot.ix, iz: ui.plot.iz });
      ui.landMsg = typeof okText === 'function' ? okText(r) : okText;
    } catch (err) {
      ui.landMsg = err.message;
    }
    ui.landBusy = false;
    drawPanel();
  }

  const here = () => world?.position() || { x: character.location?.x || 0, z: character.location?.z || 0 };
  const questReady = (title) => { showArea(`${title}: done! Open Quests (Q) to claim the reward.`); world?.say('Quest ready', 'exp'); };

  function drawHud() {
    renderHud($('hud'), character, game.stats(), ui.atCave, world?.atPortal);
    const btn = $('attack-btn');
    const armed = !!game.weapon();
    btn.innerHTML = armed ? SWORD : FIST;
    btn.setAttribute('aria-label', armed ? `Attack with ${game.weapon().name}` : 'Punch');
    btn.classList.toggle('armed', armed);
  }

  function drawPanel() {
    // keep the window scrolled where it was (buying and selling redraw it)
    const keep = overlay.dataset.shown === overlay.dataset.panel ? [...overlay.querySelectorAll('*')].filter((n) => n.scrollTop > 0).map((n) => [n.className, n.scrollTop]) : [];
    const keepSelf = overlay.dataset.shown === overlay.dataset.panel ? overlay.scrollTop : 0;
    drawPanelNow();
    overlay.dataset.shown = overlay.dataset.panel;
    overlay.scrollTop = keepSelf;
    for (const [cls, top] of keep) { const n = cls && overlay.getElementsByClassName(cls.split(' ')[0])[0]; if (n) n.scrollTop = top; }
  }
  function drawPanelNow() {
    const name = overlay.dataset.panel;
    if (name === 'status') renderStatus(overlay, character, ui.pending, game.stats());
    else if (name === 'bag') { renderBag(overlay, game, ui.selected); preview.mount(overlay.querySelector('[data-preview]')); }
    else if (name === 'shop') renderShop(overlay, game, ui.shopMsg);
    else if (name === 'market' && ui.market) renderShop(overlay, game, ui.shopMsg, ui.market);
    else if (name === 'groups') renderGroups(overlay, game, ui.groups, { message: ui.groupMsg, busy: ui.groupBusy });
    else if (name === 'rooms') renderRooms(overlay, game, { rentals: ui.rentals, pick: ui.roomPick, message: ui.roomMsg, busy: ui.roomBusy, castle: !!ui.roomsCastle, emperor: !!ui.groups?.nation });
    else if (name === 'gate') renderIdCard(overlay, game, { monster: ui.gate?.barred, barredText: ui.gate?.barred && !ui.gate?.monster ? 'The guards bare their fangs. "No outsiders in a monster city."' : null, courts: ui.courts || [], nation: ui.groups?.nation?.name });
    else if (name === 'smith') renderSmith(overlay, game, ui.pick, ui.smithMsg, { workshop: !!ui.workshop });
    else if (name === 'potions') renderPotions(overlay, game, ui.potionMsg || '');
    else if (name === 'quests') renderQuests(overlay, game, tabsHtml, ui.questMsg);
    else if (name === 'guild') renderGuild(overlay, game, ui.questMsg, ui.bounty);
    else if (name === 'assess') renderAssess(overlay, character, ui.assessed);
    else if (name === 'map') renderMap(overlay, () => world?.position(), (character.quests || []).filter((q) => q.accepted && q.type === 'explore' && !q.have).map((q) => ({ ...q.place, label: q.title.replace('Explore: ', '') })),
      { plots: ui.myPlots || [], others: ui.otherPlots || [], chosen: () => ui.basket, reach: REACH, caves: (ui.caves || []).filter((q) => q.mine).map((q) => { const cv = caveById(q.cave); return cv && { x: cv.place.x, z: cv.place.z, name: cv.name }; }).filter(Boolean) },
      world?.landMode ? (x, z) => {
        // tapping squares on the map chooses them to buy together; your own land opens in the Land window
        const info = tapPlot(Math.floor(x / PLOT), Math.floor(z / PLOT));
        if (info.owned?.mine || (info.why && !ui.basket.length)) { overlay.dataset.panel = 'land'; drawPanel(); return; }
        if (info.why) ui.landMsg = info.why;
        else if (info.owned && !info.owned.mine) ui.landMsg = `Owned by ${info.owned.owner}.`;
        updateMapBasket();
      } : null);
    else if (name === 'settings') renderSettings(overlay, settings, api.deviceAccounts(), api.cloudSaves(), ui.passwordMsg || '', { binding: ui.bindingControl, message: ui.controlMsg || '' });
    else if (name === 'skills') renderSkills(overlay, game, { binding: ui.binding, message: ui.skillMsg });
    else if (name === 'options') renderOptions(overlay);
    else if (name === 'welcome') renderWelcome(overlay, character.name, !(character.level === 1 && !character.exp));
    else if (name === 'portal' && world?.atPortal) {
      ui.trip = { from: world.atPortal, to: null, onPick: showTrip };
      renderMap(overlay, () => world?.position(), [], { plots: ui.myPlots || [], caves: [] }, null, ui.trip);
    }
    else if (name === 'rankings') renderRankings(overlay, ui.top, character.name, ui.courts || []);
    else if (name === 'cult') renderCult(overlay, character, ui.cult, { message: ui.cultMsg || '', counts: missionCount });
    else if (name === 'challenge' && ui.challengeCourt) renderChallenge(overlay, ui.challengeCourt, character.name, ui.challengeMsg || '');
    else if (name === 'cave' && ui.atCave) {
      const own = (ui.caves || []).find((q) => q.cave === ui.atCave.id);
      renderCave(overlay, ui.atCave, game, { owner: own?.owner, mine: own?.mine, message: ui.caveMsg || '', busy: ui.caveBusy });
    }
    else if (name === 'land' && ui.plot) renderLand(overlay, ui.plot, game, { choice: ui.landChoice, message: ui.landMsg, busy: ui.landBusy, basket: ui.basket.map((p) => ({ ...p, price: plotPrice(p.ix, p.iz) })) });
    else overlay.innerHTML = HELP_HTML;
    if (name !== 'bag') preview.unmount();
    if (name === 'map') updateMapBasket();
    if (name === 'bag' || name === 'shop' || name === 'market') fillIcons(overlay);
  }
  const openPanel = (name) => {
    if (!overlay.classList.contains('hidden') && overlay.dataset.panel === name) { closePanel(); return; }
    world?.releaseMouse();
    overlay.dataset.panel = name;
    ui.workshop = false;
    ui.shopMsg = ''; ui.smithMsg = ''; ui.questMsg = ''; ui.passwordMsg = ''; ui.skillMsg = ''; ui.binding = null;
    if (name === 'groups') { ui.groupMsg = ''; loadGroups(); }
    if (name === 'cult') { ui.cultMsg = ''; loadCult(); }
    if (name === 'rankings') {
      ui.top = null;
      game.saveNow();
      api.topPlayers().then((r) => { ui.top = r.players; }).catch(() => { ui.top = []; })
        .then(() => { if (overlay.dataset.panel === 'rankings') drawPanel(); });
    }
    drawPanel();
    overlay.classList.remove('hidden');
  };
  // Death is final: the character is gone. Only the Unique Skill passes on to the next one.
  async function fallen(by) {
    game.saveNow?.();
    let kept = character.uniqueSkill;
    try { const r = await api.fall(); kept = r.kept?.uniqueSkill || kept; } catch { /* still show the screen */ }
    world?.releaseMouse();
    overlay.dataset.panel = 'fallen';
    overlay.innerHTML = `
      <div class="status-window welcome-window fallen-window" role="dialog" aria-label="You have fallen">
        <h2>You have fallen</h2>
        <p>${esc(character.name)} was defeated by a ${esc(by)} at level ${character.level}.</p>
        <p>Your journey begins again from the very start: choose your race and class anew.</p>
        <p>Your Unique Skill stays with you: <b>${esc(kept?.name || '')}</b>.</p>
        <button type="button" class="gold-button" data-begin-again>Begin again</button>
      </div>`;
    overlay.classList.remove('hidden');
    overlay.querySelector('[data-begin-again]').addEventListener('click', () => location.reload());
  }
  const closePanel = () => { overlay.classList.add('hidden'); overlay.dataset.shown = ''; preview.unmount(); };

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
    if (e.target.closest('[data-signout]')) { logOut(); return; }
    if (e.target.closest('[data-switch]')) { logOut(true); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act) { toggleMenu(false); drawHud(); runAct(act); return; }
    if (b) { toggleMenu(false); drawHud(); if (b.dataset.open === 'land') toggleLand(); else openPanel(b.dataset.open); }
  });
  async function logOut(switchAccount = false) {
    if (switchAccount) { try { sessionStorage.setItem('ar.switch', '1'); } catch { /* blocked */ } }
    await Promise.resolve(game.saveNow()).catch(() => {});
    world?.stop();
    social?.dispose();
    await api.signOut();
    location.reload();
  }
  // Settings: set a new password (for now without the old one)
  // posting a bounty on the Guild Hall's board
  overlay.addEventListener('submit', async (e) => {
    if (!e.target.matches('[data-bounty-form]')) return;
    e.preventDefault();
    const { target, prize } = Object.fromEntries(new FormData(e.target));
    try {
      const r = await api.bountyPost(target, Number(prize));
      character.coins = r.coins;
      ui.bounty = { board: r.board, message: `Bounty posted on ${target}. The guild holds the prize.` };
      drawHud();
    } catch (err) { ui.bounty = { ...(ui.bounty || {}), message: err.message }; }
    drawPanel();
  });
  overlay.addEventListener('submit', async (e) => {
    if (!e.target.matches('[data-password]')) return;
    e.preventDefault();
    const { password, confirm } = Object.fromEntries(new FormData(e.target));
    try {
      if (password !== confirm) throw new Error('The two passwords don\'t match.');
      await api.changePassword(password);
      ui.passwordMsg = 'Password changed. Use the new one next time you sign in.';
    } catch (err) { ui.passwordMsg = err.message; }
    drawPanel();
  });
  $('attack-btn').classList.remove('hidden');
  $('attack-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); world?.attack(); });
  $('jump-btn').classList.remove('hidden');
  $('jump-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); world?.jump(); });

  const SHOP_SAYS = { ok: 'Bought. It is in your bag.', locked: 'You need a higher level for that.', coins: 'Not enough coins.', full: 'Your bag is full.' };
  const BREW_SAYS = { ok: 'Brewing…', class: 'Only a Potion Maker can brew.', coins: 'Not enough coins.', herbs: 'Not enough Healing Herbs. Buy them in the shop or find them on monsters.', busy: 'You are already brewing as much as you can.', pick: '' };
  const FORGE_SAYS = { ok: 'Forged! It is in your bag.', class: 'Only a Blacksmith can forge.', level: 'You are not high enough level for that yet.', coins: 'Not enough coins.', parts: 'You need more ore.', full: 'Your bag is full.', pick: '' };
  setTabsClass(character.cls);
  const ORE_COLORS = { iron_ore: '#5a5a60', silver_ore: '#c8ccd4', gold_ore: '#e0b040', ruby: '#c0202a', dragonite: '#7a2a24' };
  const SMITH_SAYS = { ok: 'Merged! The item is stronger.', evolved: 'Merged, and the weapon evolved! It climbed a rank.', coins: 'Not enough coins to pay for the merge.', parts: 'You need more monster parts for this merge.', class: 'Only a Blacksmith can merge.', pick: 'Pick two items.', kind: 'Those two are different kinds.', max: 'That item is already at its strongest.' };
  // Portals: after picking where to go on the portal's map, the fee shows before you pay
  function showTrip(to, message = '') {
    const box = overlay.querySelector('.portal-pick');
    if (!box) return;
    const fee = portalFee(ui.trip.from, to);
    box.innerHTML = `<p><b>${to.name}</b> · ${portalKm(ui.trip.from, to).toFixed(1)} km away</p>
      <p>Fee: <b>${fee} G</b> <small>(you have ${character.coins} G)</small></p>
      ${message ? `<p class="error">${message}</p>` : ''}
      <button type="button" class="gold-button" data-portal-go="${to.id}" ${character.coins < fee ? 'disabled' : ''}>Pay ${fee} G and travel</button>`;
  }
  function openPortal() {
    if (world?.underground) { showArea(world.indoors ? 'Go outside to use a portal.' : 'There are no portals underground.'); return; }
    if (!world?.atPortal) { showArea('Stand on a portal stone to use it. The map (M) shows them as purple rings.'); return; }
    openPanel('portal');
  }

  // The Builder View: your land in 3D, to put up buildings
  async function openBuilder() {
    if (ui.builder) { ui.builder.close(); return; }
    if (world?.underground) { showArea(world.indoors ? 'Go outside to build.' : 'Come up to the surface to build.'); return; }
    world?.releaseMouse();
    closePanel();
    let list;
    try { list = (await api.landList()).plots || []; } catch (err) { showArea(err.message); return; }
    setLands(list);
    ui.builder = openBuilderView($('builder-host'), {
      plots: list,
      cls: character.cls,
      coins: () => character.coins,
      async build(body) {
        await game.saveNow(); // so the server charges from your latest coins
        const r = await api.landBuild(body);
        game.setCoins(r.coins);
        setLands(r.plots);
        drawHud();
        return r.plots;
      },
      onClose: () => { ui.builder = null; if (world) world.paused = false; },
    });
    if (ui.builder && world) world.paused = true;
    if (!ui.builder) showArea("You don't own any land yet. Press L for the land grid and buy a plot, then build on it here.");
  }
  // actions the menu and the Controls window can run, like their keys do
  function runAct(act) {
    if (act === 'sleep') world?.sleep();
    if (act === 'tent') world?.pitchTent();
    if (act === 'torch') world?.placeTorch();
    if (act === 'land') toggleLand();
    if (act === 'builder') openBuilder();
    if (act === 'portal') openPortal();
  }
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-close]')) { closePanel(); return; }
    const t = (attr) => e.target.closest(`[${attr}]`)?.getAttribute(attr);
    let v;
    if ((v = t('data-act')) != null && overlay.dataset.panel === 'options') { closePanel(); runAct(v); return; }
    if ((v = t('data-open')) != null) { overlay.dataset.panel = ''; if (v === 'portal') { closePanel(); openPortal(); } else openPanel(v); return; }
    if ((v = t('data-portal-go')) != null) {
      const to = ui.trip?.to;
      const r = to ? game.usePortal(ui.trip.from.id, v) : 'pick';
      if (r === 'ok') {
        closePanel();
        world.teleport(to.x, to.z);
        showArea(`The portal hums and you step out at ${to.name}.`);
        drawHud();
      } else if (to) showTrip(to, r === 'coins' ? 'Not enough coins.' : 'That portal is across the sea.');
      return;
    }
    if ((v = t('data-room')) != null) {
      const r = v === 'rent' ? game.rentRoom() : game.sleepInRoom();
      ui.shopMsg = { ok: v === 'rent' ? 'The room is yours for a day of the realm (one real hour).' : 'You sleep in your room and wake fully rested.', coins: 'Not enough coins.', have: 'You already have a room.', none: 'Rent a room first.' }[r];
      if (v === 'sleep' && r === 'ok') { world?.say('Fully rested', 'exp'); drawHud(); }
      drawPanel(); return;
    }
    const board = t('data-board') || 'quests';
    if ((v = t('data-quest-accept')) != null) {
      const r = game.questAccept(Number(v), board);
      ui.questMsg = { ok: board === 'guild' ? 'Guild request accepted.' : 'Quest accepted.', limit: 'You have taken on 3 quests today. Come back tomorrow (a day of the realm is one real hour).', one: 'You can hold only one guild request at a time.', card: 'You need a Hunter\'s Guild Card first. Ask for one at the counter.', rank: 'That request is above your card\'s rank.', pick: '' }[r];
      drawPanel(); return;
    }
    if ((v = t('data-quest-drop')) != null) { game.questDrop(Number(v), here(), board); ui.questMsg = 'Given up. A new one is posted every 20 minutes.'; drawPanel(); return; }
    if ((v = t('data-quest-claim')) != null) {
      const r = game.questClaim(Number(v), here(), board);
      if (r) { ui.questMsg = `Quest complete: +${r.exp} EXP, +${r.coins} G${r.item ? `, ${r.item.replace(/_/g, ' ')}` : ''}.`; world?.say('Quest complete!', 'exp'); }
      drawPanel(); return;
    }
    if ((v = t('data-land-pick')) != null) { ui.landChoice = v; ui.landMsg = ''; drawPanel(); return; }
    if (t('data-land-buy') != null) {
      landAction(async () => {
        // the server checks the distance from where you are saved, so save it first
        const at = world.here();
        await api.saveLocation(at);
        return api.landBuy(ui.basket, ui.landChoice, at);
      }, (r) => (r.bought > 1 ? `${r.bought} plots are yours!` : 'The land is yours!'));
      return;
    }
    if ((v = t('data-land-unpick')) != null) {
      const [ix, iz] = v.split(',').map(Number);
      tapPlot(ix, iz);
      drawPanel(); return;
    }
    if (t('data-land-clear') != null) {
      ui.basket = []; world.choosePlots([]); ui.landMsg = '';
      if (overlay.dataset.panel === 'map') updateMapBasket(); else drawPanel();
      return;
    }
    if (t('data-land-open') != null) { overlay.dataset.panel = 'land'; drawPanel(); return; }
    if (t('data-land-open-basket') != null && ui.basket.length) { ui.plot = world.selectPlot(ui.basket[0]); ui.landMsg = ''; drawPanel(); return; }
    if (t('data-land-change') != null) { landAction(() => api.landPurpose(ui.plot.ix, ui.plot.iz, ui.landChoice), 'Purpose changed.'); return; }
    if ((v = t('data-land-prepare')) != null) { landAction(() => api.landPrepare(ui.plot.ix, ui.plot.iz, v), v === 'clear' ? 'Cleared. The trees, rocks and grass are gone; the ground keeps its shape.' : 'Flattened. Ready to build on.'); return; }
    if (t('data-signout') != null) { logOut(); return; }
    if (t('data-switch') != null) { logOut(true); return; }
    if (t('data-show-pw') != null) {
      const btn = e.target.closest('[data-show-pw]');
      const on = btn.getAttribute('aria-pressed') !== 'true';
      for (const i of overlay.querySelectorAll('[data-password] input')) i.type = on ? 'text' : 'password';
      btn.setAttribute('aria-pressed', String(on));
      btn.textContent = on ? 'Hide' : 'Show';
      return;
    }
    if (t('data-open-groups') != null) { ui.groupMsg = ''; loadGroups(); openPanel('groups'); return; }
    if ((v = t('data-group')) != null) {
      const btn = e.target.closest('[data-group]');
      const kind = btn.dataset.kind;
      const body = { action: v, kind, name: btn.dataset.name, id: Number(btn.dataset.id), accept: btn.dataset.accept === '1' };
      if (v === 'invite') body.name = overlay.querySelector(`[data-group-name="${kind}"]`)?.value.trim();
      if (v === 'found') body.name = overlay.querySelector('[data-guild-name]')?.value.trim();
      if (v === 'nation' || v === 'rename-nation') body.name = overlay.querySelector('[data-nation-name]')?.value.trim();
      if ((v === 'disband' || (v === 'leave' && kind === 'guild')) && !confirm(v === 'disband' ? `Really ${kind === 'party' ? 'break up the party' : 'disband the guild'}?` : 'Really leave the guild?')) return;
      ui.groupBusy = true; drawPanel();
      (async () => {
        try {
          if (v === 'found') await game.saveNow(); // so the server sees your latest coins
          const r = await api.groupsAct(body);
          if (r.coins !== undefined) game.setCoins(r.coins);
          ui.groups = r;
          ui.groupMsg = { invite: `Invite sent to ${body.name}.`, respond: body.accept ? 'Welcome aboard! Its chat is a new tab in the chat.' : 'Invite turned down.', leave: `You left the ${kind}.`, remove: `${body.name} was removed.`, lead: `${body.name} now leads.`, disband: kind === 'party' ? 'The party broke up.' : 'The guild is disbanded.', found: `You founded ${body.name}! You are its Guild Master.`, nation: `You founded the nation of ${body.name}. Hail, Emperor!`, 'rename-nation': `Your nation is now ${body.name}.` }[v] || '';
          social?.refresh();
        } catch (err) { ui.groupMsg = err.message; }
        ui.groupBusy = false; drawPanel();
      })();
      return;
    }
    if (t('data-card-request') != null) {
      const r = game.requestCard();
      ui.questMsg = { ok: `Paid. Now go to the Assessment Room (the glowing crystal in the back left corner of the hall) and press E to have your card read.`, coins: 'Not enough coins.', level: 'You must be level 20 to be a hunter.', pending: 'Your card is waiting in the Assessment Room.', have: 'You already have a card.' }[r];
      drawPanel(); return;
    }
    if (t('data-open-rooms') != null) { ui.roomMsg = ''; ui.roomsCastle = false; loadRooms(); openPanel('rooms'); return; }
    if ((v = t('data-room-pick')) != null) { ui.roomPick = v; ui.roomMsg = ''; drawPanel(); return; }
    if ((v = t('data-room-chat')) != null) { closePanel(); social?.openRoom(v); return; }
    if ((v = t('data-room-rent')) != null || (v = t('data-room-save')) != null) {
      const renting = e.target.closest('[data-room-rent]');
      const names = (renting ? overlay.querySelector('[data-room-guests]') : overlay.querySelector(`[data-room-edit="${v}"]`))?.value.split(',').map((x) => x.trim()).filter(Boolean) || [];
      const minutes = Number(overlay.querySelector('[data-room-minutes]')?.value || 0);
      ui.roomBusy = true; drawPanel();
      (async () => {
        try {
          if (renting) {
            await game.saveNow(); // so the server sees your latest coins
            const r = await api.roomRent(v, minutes, names);
            game.setCoins(r.coins);
            takeRentals(r.rentals);
            ui.roomPick = null;
            ui.roomMsg = v.startsWith('castle') ? 'The chamber is open. Its door is at the back of the great hall; your guests can come in too, and on trade days they may enter the castle. Its private chat is a new tab in the chat (bottom left).' : 'The room is yours. Go up the stairs to its door; your guests can come in too. Its private chat is a new tab in the chat (bottom left).';
            social?.refresh();
          } else {
            const r = await api.roomGuests(Number(v), names);
            takeRentals(r.rentals);
            ui.roomMsg = 'Saved: those players can come in now.';
            social?.refresh();
          }
        } catch (err) { ui.roomMsg = err.message; }
        ui.roomBusy = false; drawPanel();
      })();
      return;
    }
    if (t('data-show-id') != null) { if (world?.passGate()) closePanel(); return; }
    if ((v = t('data-spell')) != null) { const r = game.attachSpell(v); ui.skillMsg = { ok: `${SPELLS[v].name} attached to your staff.`, full: 'Your staff is full: detach a spell first.', staff: 'Hold a staff first.' }[r] || ''; drawPanel(); return; }
    if ((v = t('data-unspell')) != null) { game.detachSpell(v); ui.skillMsg = `${SPELLS[v].name} detached.`; drawPanel(); return; }
    if ((v = t('data-ready')) != null) { game.readySkill(v); ui.skillMsg = ''; drawPanel(); return; }
    if ((v = t('data-store')) != null) { game.storeSkill(v); ui.skillMsg = `${SKILLS[v].name} stored.`; drawPanel(); return; }
    if ((v = t('data-bind')) != null) { ui.binding = v; ui.skillMsg = 'Press the key you want for this skill (Esc to cancel).'; drawPanel(); return; }
    if (t('data-torch') != null) { closePanel(); world?.placeTorch(); return; }
    if (t('data-hold-torch') != null) { closePanel(); world?.holdTorch(); return; }
    if ((v = t('data-cave-buy')) != null) {
      ui.caveBusy = true; drawPanel();
      (async () => {
        try {
          await game.saveNow(); // so the server sees your latest coins and the beaten boss
          const r = await api.caveBuy(v);
          game.setCoins(r.coins);
          ui.caves = r.caves;
          ui.caveMsg = 'The cave is yours! It shows in gold on your map.';
        } catch (err) { ui.caveMsg = err.message; }
        ui.caveBusy = false; drawPanel();
      })();
      return;
    }
    if (t('data-tent') != null) { closePanel(); world?.pitchTent(); return; }
    if ((v = t('data-cult')) != null) {
      const btn = e.target.closest('[data-cult]');
      const body = { action: v };
      if (v === 'answer') body.accept = btn.dataset.accept === '1';
      if (v === 'found') body.name = overlay.querySelector('[data-cult-found]')?.value;
      if (v === 'invite') body.name = overlay.querySelector('[data-cult-name]')?.value;
      if (v === 'give') { body.name = btn.dataset.name; body.pick = Number(overlay.querySelector(`[data-cult-pick="${CSS.escape(btn.dataset.name)}"]`)?.value) || 0; }
      api.cultAct(body).then((r) => {
        if (r.reward) game.takePact(r.reward);
        ui.cultMsg = { answer: body.accept ? 'You have joined. Tell no one.' : 'You refused. Holy power fills you.', order: 'You are sworn to the Order of the Dawn.', found: 'Your cult is founded. You are its Cult Leader.',
          invite: 'They have been asked. They will never know it was you.', ask: 'A new mission.', give: 'The mission has gone down to them.' }[v] || '';
        takeCult(r);
        drawPanel();
      }).catch((err) => { ui.cultMsg = err.message; drawPanel(); });
      return;
    }
    if ((v = t('data-answer-challenge')) != null) {
      api.kingChallenge(v, true).then((r) => { ui.courts = r.courts; ui.challengeCourt = r.courts.find((c) => c.race === v); ui.challengeMsg = 'You have accepted the duel.'; drawPanel(); })
        .catch((err) => { ui.challengeMsg = err.message; drawPanel(); });
      return;
    }
    // Skill Stones: set into a piece of gear, or taken out again
    if ((v = t('data-set-stone')) != null) {
      const [u, st] = v.split('|'); const r = game.setStone(u, st);
      world?.say({ ok: 'The stone sinks into the metal. Its skill is yours while you wear it.', full: 'No room for another skill.', have: 'It already holds that skill.', rank: 'Only Rare or better gear can hold skills.' }[r] || 'That stone is gone.', r === 'ok' ? 'exp' : 'hurt');
      drawPanel(); return;
    }
    if ((v = t('data-take-stone')) != null) {
      const [u, id] = v.split('|'); const r = game.takeStone(u, id);
      world?.say(r === 'ok' ? `${SKILLS[id].name} Stone back in your bag` : r === 'full' ? 'Your bag is full' : 'Nothing to take out', r === 'ok' ? 'note' : 'hurt');
      drawPanel(); return;
    }
    if ((v = t('data-control')) != null) { ui.bindingControl = v; ui.controlMsg = ''; drawPanel(); return; }
    if (e.target.closest('[data-controls-reset]')) { resetKeys(); ui.controlMsg = 'Every key is back to how it started.'; drawPanel(); return; }
    if ((v = t('data-mouse')) != null) { settings.mouse = v; saveSettings(); world?.setMouseMode(v); drawPanel(); return; }
    if ((v = t('data-camera')) != null) { settings.camera = v; saveSettings(); world?.setCameraMode(v); drawPanel(); return; }
    if ((v = t('data-add')) != null) { ui.pending[v] = (ui.pending[v] || 0) + 1; drawPanel(); return; }
    if ((v = t('data-privacy')) != null) {
      const before = character.privacy;
      character.privacy = v; drawPanel();
      api.setPrivacy(v).catch((err) => { character.privacy = before; drawPanel(); showArea(err.message); });
      return;
    }
    if (t('data-confirm-points') != null) { game.spendPoints(ui.pending); ui.pending = {}; drawPanel(); return; }
    if (t('data-reset-points') != null) { ui.pending = {}; drawPanel(); return; }
    if ((v = t('data-equip')) != null) { game.equip(v); return; }
    if ((v = t('data-use')) != null) { game.use(v); if (!game.entry(v)) ui.selected = null; drawPanel(); return; }
    if ((v = t('data-drop')) != null) { game.removeItem(v, 1); if (!game.entry(v)) ui.selected = null; return; }
    if ((v = t('data-craft')) != null) { game.craft(game.recipes.find((r) => r.makes === v)); return; }
    if ((v = t('data-item')) != null) { ui.selected = ui.selected === v ? null : v; drawPanel(); return; }
    if ((v = t('data-buy')) != null) { ui.shopMsg = SHOP_SAYS[game.buy(v, overlay.dataset.panel === 'market' ? ui.market : null)]; drawPanel(); return; }
    if ((v = t('data-sell')) != null || (v = t('data-sell-all')) != null) {
      const all = t('data-sell-all') != null;
      const n = all ? game.entry(v)?.n : 1;
      const got = game.sell(v, n, overlay.dataset.panel === 'market' ? ui.market : null);
      ui.shopMsg = got ? `Sold ${all ? `${n} ` : ''}for ${got} coins.` : '';
      if (got) world?.say(`+${got} G`, 'exp');
      drawPanel(); return;
    }
    if (t('data-form') != null) {
      if (game.changeForm() === 'ok') showArea(`You take your ${character.form} form.`);
      drawPanel(); return;
    }
    if ((v = t('data-pick')) != null) {
      if (ui.pick.includes(v)) ui.pick = ui.pick.filter((k) => k !== v);
      else ui.pick = [...ui.pick, v].slice(-2);
      ui.smithMsg = ''; drawPanel(); return;
    }
    if (t('data-merge') != null) {
      // remember the two pieces for the work scene before they're merged
      const pieces = ui.pick.map((k) => game.entry(k)).map((e) => e && { item: ITEMS[e.id], plus: e.plus || 0 });
      const out = game.mergePreview(...ui.pick);
      const r = game.merge(...ui.pick);
      ui.smithMsg = r === 'new' ? `Merged into a new piece: the ${ITEMS[out.id].name}${out.plus ? ` +${out.plus}` : ''}!` : SMITH_SAYS[r];
      if (r === 'ok' || r === 'evolved' || r === 'new') {
        ui.pick = [ui.pick[0]];
        playWork('smith', character, game.worn(), { pieces, result: { item: ITEMS[out.id], plus: out.plus }, doneText: ui.smithMsg }, drawPanel);
      }
      drawPanel(); return;
    }
    if ((v = t('data-forge')) != null) {
      const ore = t('data-ore') || null;
      const r = game.forge(v, ore, t('data-workshop') != null);
      const fc = forgeCost(ITEMS[v], ore);
      const bonus = r === 'ok' ? fc.bonus : 0;
      ui.smithMsg = r === 'ok' ? `Forged a ${ITEMS[v].name}${bonus ? ` +${bonus}` : ''}! It is in your bag.` : FORGE_SAYS[r];
      if (r === 'ok') playWork('smith', character, game.worn(), { ore: true, oreColor: ORE_COLORS[fc.ore], result: { item: ITEMS[v], plus: bonus }, doneText: `${ITEMS[v].name}${bonus ? ` +${bonus}` : ''}, forged!` }, drawPanel);
      drawPanel(); return;
    }
    if ((v = t('data-coat')) != null) {
      const r = game.coat(game.gearIn('weapon')?.entry.uid, v);
      ui.smithMsg = r === 'ok' ? 'Your weapon is coated.' : r === 'class' ? 'Only a Blacksmith can coat weapons.' : 'Equip a weapon first.';
      drawPanel(); return;
    }
    if ((v = t('data-brew')) != null) {
      const r = game.brew(v);
      ui.potionMsg = BREW_SAYS[r];
      if (r === 'ok') playWork('brew', character, game.worn(), {}, drawPanel);
      drawPanel(); return;
    }
  });

  world = startWorld($('world'), character, {
    game,
    view: { camera: settings.camera, mouse: settings.mouse },
    onArea: (name) => showArea(name),
    onPlot(info) {
      tapPlot(info.ix, info.iz);
      overlay.dataset.panel = 'land';
      drawPanel();
      overlay.classList.remove('hidden');
    },
    // the player pressed Esc while the mouse was captured
    windowOpen: () => !overlay.classList.contains('hidden') || !!social?.typing,
    onMouseFreed: () => { if (overlay.classList.contains('hidden')) openPanel('settings'); },
    onSaveLocation: (loc) => { character.location = { ...character.location, ...loc }; api.saveLocation(loc).catch(() => {}); },
    onEvent(type, data) {
      if (type === 'kill') for (const title of game.questKill(data.kind, data.level)) questReady(title);
      if (type === 'kill' && activeMissions().length) {
        const p = world?.position();
        if (p && nearTown(p, GATES_R)) missionStep('gates');
        if (realmTime().night) missionStep('night');
      }
      if (type === 'depths') $('minimap').classList.add('hidden'); // no map underground
      if (type === 'depths') showArea(`${data.cave.name}: ${{ small: 'a small cave', medium: 'a winding cave', deep: 'a deep cave' }[data.cave.size]}. ${world?.holding ? '' : 'Pitch dark: light a torch (T). '}Mine glowing ore veins, break nests, and find the boss at the bottom.`);
      if (type === 'surface') { ui.atCave = null; drawHud(); $('minimap').classList.remove('hidden'); }
      if (type === 'cave') {
        ui.atCave = data; ui.caveMsg = '';
        drawHud();
        const own = data && (ui.caves || []).find((q) => q.cave === data.id);
        if (data && game.caveCleared(data.id) && !own) showArea(`You beat this cave's boss: you can buy ${data.name} (tap its name under your bars).`);
      }
      if (type === 'cave-boss') showArea(`You beat the boss of the ${data.name}! Open its chest, and the cave can now be bought up top.`);
      if (type === 'king-slain') {
        showArea(`${data.name}, ${data.title}, has fallen!`);
        api.kingSlain(data.race).then((r) => {
          ui.courts = r.courts;
          showArea(r.crowned ? `You beat the King in a fight and take the crown: you are the ${data.title}!` : `${data.name} has fallen. You take the EXP and loot; the strongest Overlord will take the throne.`);
        }).catch(() => {});
      }
      if (type === 'market') { ui.market = data; openPanel('market'); }
      if (type === 'indoors') {
        $('minimap').classList.add('hidden');
        if (data.kind === 'castle') { showArea("The Emperors' Castle: meetings at the council table are free. The steward's desk by the door (E) opens the chambers for private business."); loadRooms(); }
        else showArea(data.kind === 'guild' ? 'Main Guild Hall: the counter (E) has guild requests; sit at a table (E by a chair); the stairs lead up to the meeting rooms.' : `${data.shop.name}: walk up to the counter and press E. Sit on a chair with E.`);
        if (data.kind === 'guild') loadRooms();
      }
      if (type === 'outdoors') $('minimap').classList.remove('hidden');
      if (type === 'castle') { ui.roomsCastle = true; ui.roomPick = null; ui.roomMsg = ''; loadRooms(); openPanel('rooms'); }
      if (type === 'anvil') {
        // your own anvil: the Blacksmith window, with the workshop pieces to forge too
        openPanel('smith');
        ui.workshop = true;
        if (character.cls !== 'blacksmith') ui.smithMsg = 'Only a Blacksmith can work an anvil. You can see what one could make here.';
        drawPanel();
      }
      if (type === 'castle-denied') showArea(data.day === 'council' ? "Today is a council day: only Emperors and Guild Masters may enter the Emperors' Castle." : "Today is a trade day: only Emperors and the guests they invited may enter the Emperors' Castle.");
      if (type === 'meeting-room') { ui.roomsCastle = data.id.startsWith('castle'); ui.roomPick = data.id; ui.roomMsg = ''; loadRooms(); if (overlay.classList.contains('hidden') || overlay.dataset.panel !== 'rooms') openPanel('rooms'); }
      if (type === 'room-ended') { showArea('Your time in the meeting room is up. You are back in the hallway.'); loadRooms(); }
      if (type === 'gate') { ui.gate = data; if (overlay.classList.contains('hidden') || overlay.dataset.panel !== 'gate') openPanel('gate'); }
      if (type === 'guild') { game.fillQuests(here(), 'guild'); openPanel('guild'); loadBounties(); }
      if (type === 'guild-denied') showArea(`The guards at the Main Guild Hall turn you away: only hunters of level ${data.level} or more may enter.`);
      if (type === 'assess') {
        const r = game.assessCard();
        if (r === 'none') showArea('The crystal stays dark. Ask for a Hunter Card at the counter first.');
        else { ui.assessed = r; openPanel('assess'); }
      }
      if (type === 'chest') showArea(`The chest held ${data.coins} G, ${data.items.join(', ')}.`);
      if (type === 'portal') drawHud();
      if (type === 'portal' && data) showArea(`${data.name}: press G (or tap Portal) to travel to another portal on this continent.`);
      if (type === 'ambush') showArea(`Ambush! ${data.n} goblins leap out of hiding!`);
      if (type === 'tired') showArea('You are getting very tired. Sleep (Z) by a fire or a torch before you collapse.');
      if (type === 'collapsed') showArea('You collapsed from exhaustion! Monsters may find you…');
      if (type === 'defeated') fallen(data.by);
    },
    onKey(e) {
      const act = actionFor(e.code);
      const open = { status: 'status', bag: 'bag', shop: 'shop', smith: 'smith', quests: 'quests', help: 'help', map: 'map', settings: 'settings', rankings: 'rankings', skills: 'skills', groups: 'groups' }[act];
      if (open) openPanel(open);
      if (act === 'builder' && !ui.builder) openBuilder();
      if (act === 'portal') { if (overlay.dataset.panel === 'portal' && !overlay.classList.contains('hidden')) closePanel(); else openPortal(); }
      if (overlay.classList.contains('hidden')) { const b = character.skillBar.find((x) => x.key === e.code); if (b) trySkill(b.id); else if (act === 'unique') trySkill('unique'); else if (act === 'mythic') trySkill('mythic'); }
      if (act === 'land') toggleLand();
      if (act === 'chat') { e.preventDefault(); world?.releaseMouse(); social?.focusChat(); }
      // Esc opens the options; Esc again (or on any window) closes it
      if (e.code === 'Escape') { if (overlay.classList.contains('hidden')) openPanel('options'); else closePanel(); }
    },
  });
  if (ui.rentals) takeRentals(ui.rentals); else castleAccess(); // the world is here now
  if (/[?&]debug\b/.test(location.search)) window.__world = world; // for tests

  window.addEventListener('pagehide', () => game.saveNow());
  // Friends and chat: search at the top right, chat at the bottom left
  social = createSocial($('game'));
  // Everyone's land: posts on owned plots, and levelled ground
  api.landList().then((r) => setLands(r.plots || [])).catch(() => {});
  loadCaves();
  api.kingsList().then((r) => { takeCourts(r.courts); world.setCourts(r.courts); }).catch(() => {});
  setInterval(() => api.kingsList().then((r) => takeCourts(r.courts)).catch(() => {}), 60000);
  loadCult(); // a cult's offer, a mission, or news that you were stripped
  // Explore quests finish when you reach the place
  game.fillQuests(here());
  setInterval(() => {
    const p = world?.position();
    if (p) for (const title of game.questVisit(p.x, p.z)) questReady(title);
  }, 1500);
  // a new quest is posted on the board every 20 minutes
  setInterval(() => {
    const before = (character.quests || []).length;
    game.fillQuests(here());
    if (character.guildQuests) game.fillQuests(here(), 'guild');
    if ((character.quests || []).length > before) { showArea('A new quest was posted on the board (Q).'); if (overlay.dataset.panel === 'quests' && !overlay.classList.contains('hidden')) drawPanel(); }
  }, 10000);
  drawSkillBar();
  bindHud($('hud'), drawHud);
  // real time played, for the ID card: counted while the game is open and showing
  setInterval(() => { if (!document.hidden) game.addPlayTime(60000); }, 60000);
  // death is final, so warn when HP runs low
  let warnedAt = 0;
  setInterval(() => {
    const max = game.stats().hp, hp = character.hp ?? max;
    if (hp > 0 && hp < max * 0.25 && Date.now() - warnedAt > 60000) { warnedAt = Date.now(); world?.say('Low HP! Death is final: heal or run', 'hurt'); }
  }, 1000);
  // the minimap in the corner follows you; tap it for the world map
  createMinimap($('minimap'), () => world?.position(), () => openPanel('map'));
  openPanel('welcome');
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

