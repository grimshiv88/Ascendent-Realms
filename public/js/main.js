// Front door flow: intro → title docks → Choose → Sign Up / Sign In → clouds → next screen.
import { RACES } from './data/game-data.mjs';
import { renderCastlePlan } from './castleplan.js';
import { startIntro } from './intro.js';
import * as api from './api.js';
import { paintCloudBanks } from './clouds.js';
import { openCreator } from './creator.js';
import { startWorld } from './world/world.js';
import { renderMap, createMinimap } from './mapview.js';
import { villageName } from './data/mobvillages.mjs';
import { renderHud, renderStatus, renderSettings, renderRankings, toggleMenu, renderOptions, renderWelcome, bindHud, renderChallenge, HELP_HTML } from './status.js';
import { createProgress } from './progress.js';
import { renderBag, renderShop, renderSmith, renderPotions, tabsHtml, setTabsClass, itemInfoHtml } from './bag.js';
import { ITEMS, forgeCost } from './data/items.mjs';
import { playWork } from './workscene.js';
import { renderAssess, renderParents } from './idcard.js';
import { renderQuests, renderGuild } from './quests.js';
import { renderLand, renderCave, renderEstate } from './landui.js';
import { renderBank, renderDerrick, renderOilSpot } from './bankui.js';
import { depositById, BANK_ID, bankPlace } from './data/economy.mjs';
import { caveById } from './data/depths.mjs';
import { portalFee, portalKm, portalLevel } from './data/portals.mjs';
import { openBuilder as openBuilderView } from './builder.js';
import { loadSculpts } from './characters/sculpt.js';

const sculptsReady = loadSculpts();
import { PLOT, REACH, inReach, plotPrice } from './data/land.mjs';
import { makeStage } from './characters/stage.js';
import { buildCharacter, animateCharacter } from './characters/model.js';
import { wearGear } from './characters/gear.js';
import { fillIcons, warmIcons } from './characters/icons.js';
import { warmWorldMap } from './world/mapdraw.js';
import { SPELLS } from './data/spells.mjs';
import { renderIdCard } from './idcard.js';
import { renderRooms } from './roomsui.js';
import { renderGroups } from './groupsui.js';
import { renderSkills, renderSkillBar, updateSkillBar, renderPower } from './skillsui.js';
import { SKILLS } from './data/skills.mjs';
import { uniqueAbility, uniqueTier } from './data/unique.mjs';
import { challengeBar } from './data/kings.mjs';
import { renderCult } from './cultui.js';
import { GATES_R } from './data/cults.mjs';
import { gameTime as realmTime } from './data/clock.mjs';
import { placesWithPositions } from './data/world-layout.mjs';
import { createSocial } from './social.js';
import { createVoice } from './voice.js';
import { createPowers } from './powersui.js';
import { POWER_IDS } from './data/staff.mjs';

// Nothing in the game can be selected, copied or right-clicked, except the boxes you type in
const typing = (e) => e.target.closest?.('input, textarea, select, [contenteditable="true"]');
document.addEventListener('contextmenu', (e) => { if (!typing(e)) e.preventDefault(); });
document.addEventListener('selectstart', (e) => { if (!typing(e)) e.preventDefault(); });
document.addEventListener('dragstart', (e) => { if (!typing(e)) e.preventDefault(); });
import { actionFor, setKey, resetKeys, CONTROLS, FIXED_KEYS, codeFor, keyName } from './data/controls.mjs';
import { ageOf, isChild, ceremonyDue, SCHOOLS, PARENT_JOBS } from './data/birth.mjs';
import { UNDYING_LEVEL, RENEW_AGE, MARRY_AGE, diedOfAge } from './data/life.mjs';
import { BODYGUARDS } from './data/hire.mjs';
import { suitorsFor } from './data/family.mjs';
import { renderFamily } from './familyui.js';
import { renderAcademy, renderCeremony } from './schoolui.js';
import { renderAppraise } from './appraiseui.js';
import { piecesCost } from './data/building.mjs';
import { money, moneyWords } from './data/money.mjs';
import { PASS_NAME } from './data/citypass.mjs';
import { flagHtml, fillFlags, countryOptions, wireCountryPicker } from './flag.js';
import { accountSteps } from './accountsteps.js';

paintCloudBanks();

const $ = (id) => document.getElementById(id);
const panels = ['choose', 'signup', 'signin', 'story', 'forgot', 'auth-step'];

function show(panelId) {
  for (const id of panels) $(id).classList.toggle('hidden', id !== panelId);
  $(panelId).querySelector('input')?.focus();
}

// sign-in codes, adding and confirming the email, new passwords (enterRealm is hoisted)
const steps = accountSteps({ el: $('auth-step'), show, enter: (r) => enterRealm(r) });

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
    // the link in an email (confirm the email, reset the password) opens its own step
    setTimeout(async () => { if (!(await steps.fromLink())) show(switching ? 'signin' : 'choose'); }, 900);
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
  $('continue-btn').addEventListener('click', () => steps.next(r));
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
let myAccount = null; // the signed-in account (its email and 2-step sign-in, for Settings)
function enterRealm({ account }) {
  myAccount = account;
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
    async onBorn() {
      // reborn as one of your children (chosen on the screen of your final death)
      let asChild = null;
      try { const v = sessionStorage.getItem('ar.rebirth'); if (v != null) asChild = Number(v); sessionStorage.removeItem('ar.rebirth'); } catch { /* blocked */ }
      return (await api.createCharacter(Number.isInteger(asChild) ? { asChild } : {})).character;
    },
    async onEnter(character) {
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
  // what lifts your City Pass besides birth and level (see data/citypass.mjs): houses you own, a crown
  const passPerks = () => {
    const homes = (ui.homes || []).filter((h) => h.mine).map((h) => ({ city: h.city, tier: String(h.house).replace(/\d+$/, '') }));
    const king = (ui.courts || []).some((q) => q.king && !q.king.npc && q.king.name === character.name);
    return { homes, crowned: king ? 'King' : ui.groups?.nation ? 'Emperor' : false };
  };
  setInterval(() => world?.setPassPerks(passPerks()), 3000);
  let hudQueued = false;

  // The Unique Skill climbs a rank when a proof of growth is earned (the server checks the proof
  // and the SS / SSS world limits)
  let climbing = false;
  async function climbRank() {
    if (climbing) return;
    climbing = true;
    try {
      await game.saveNow();
      const r = await api.rankUp(character);
      if (r?.ok) {
        character.uniqueSkill = r.uniqueSkill;
        world?.say(`${r.uniqueSkill.name} rose to rank ${r.uniqueSkill.rank}!`, 'exp');
        showArea(`Your Unique Skill grew: ${r.uniqueSkill.name} is now rank ${r.uniqueSkill.rank}.`);
      }
    } catch { /* not yet, or the rank is full: tried again on the next proof */ }
    climbing = false;
  }
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
      if (type === 'no-funds') noFunds(data.need);
      if (type === 'rank-due') climbRank();
      if (type === 'technique') { world?.say(`New technique: ${SKILLS[data.id].name}`, 'exp'); showArea(`Your teacher taught you ${SKILLS[data.id].name}. It is on your skills now.`); drawSkillBar(); }
      if (type === 'neglect') showArea('You have not visited your parents for too long. You are now counted a sinner in this life.');
      if (type === 'evolved') { world?.say('Your weapon evolved!', 'exp'); showArea(`Your weapon evolved into the ${data.name}!`); }
      if (type === 'spell') {
        const sp = SPELLS[data.id];
        game.attachSpell(data.id);
        world?.say(`New spell: ${sp.name}`, 'exp');
        newPower({ kind: 'spell', id: data.id });
      }
      if (type === 'upgrade') {
        showArea(data.evolution ? `Level ${data.level}!` : `Level ${data.level} upgrade! Every stat +2.`);
        if (data.skill) { world?.say(`New skill: ${SKILLS[data.skill].name}`, 'exp'); drawSkillBar(); newPower({ kind: 'skill', id: data.skill }); }
      }
      // an evolution lets more of the Unique Skill out
      if (type === 'level' && uniqueTier(data) > ui.uniqueTier) { ui.uniqueTier = uniqueTier(data); drawSkillBar(); newPower({ kind: 'unique' }); }
    },
  });

  // ---------- not enough coins: "Insufficient funds" in the middle of the screen ----------
  let fundsTimer = null;
  function noFunds(need) {
    let el = document.getElementById('no-funds');
    if (!el) { el = document.createElement('div'); el.id = 'no-funds'; el.setAttribute('role', 'alert'); document.body.appendChild(el); }
    const have = character.coins;
    el.innerHTML = `<b>Insufficient funds</b>${need ? `<span>You need ${money(need)} and have ${money(have)}${need > have ? ` (${money((need - have))} short)` : ''}.</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(fundsTimer);
    fundsTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  window.addEventListener('ar-no-funds', (e) => noFunds(e.detail?.need));

  // ---------- a new power: a window says what it is and what it does, and where it went ----------
  ui.uniqueTier = uniqueTier(character.level);
  ui.powers = [];
  function newPower(p) {
    ui.powers.push(p);
    if (overlay.dataset.panel !== 'power' || overlay.classList.contains('hidden')) { ui.skillMsg = ''; openPanel('power'); } else drawPanel();
  }

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
    // the Cult / Order window shows in the menu only for those who have had the call (or could found a cult)
    const menu = v.cult ? 'Cult' : v.order ? 'The Order' : v.canFound ? 'Cult' : null;
    if (menu !== (character.secretMenu || null)) { character.secretMenu = menu; drawHud(); }
    // gave the cult away: its powers and its coins are gone
    if (v.stripped && !ui.stripping) {
      ui.stripping = true;
      game.loseCult(v.stripped.reduce((a, x) => a + (x.coins || 0), 0));
      showArea('You gave the cult away. Its dark powers and every coin it gave you are gone.');
      api.cultAct({ action: 'ack' }).then((r) => { ui.stripping = false; takeCult(r); }).catch(() => { ui.stripping = false; });
    }
    // the call comes out of nowhere: the message springs open at once
    if (v.invited && !ui.cultOffered) { ui.cultOffered = true; world?.say('A voice speaks in the dark…', 'hurt'); openPanel('cult'); return; }
    if (overlay.dataset.panel === 'cult' && !overlay.classList.contains('hidden')) drawPanel();
  }
  function loadCult() { api.cultsView().then(takeCult).catch(() => {}); }
  // Something done in the world that might bring the call (which deeds count is the server's secret)
  function deed(id) { if (!ui.cult?.cult && !ui.cult?.order && !ui.cult?.choice) api.cultAct({ action: 'deed', deed: id }).then(takeCult).catch(() => {}); }
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
        world?.say(`Mission done: +${money(r.coins)}`, 'exp');
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
  const rawSkill = (id) => (id === 'unique' ? uniqueAbility(character) : id === 'mythic' ? (game.mythic() || { cd: 40, sp: 0, name: 'Mythic skill' }) : SKILLS[id]);
  // Elves are gifted with skills: ready sooner and cheaper in SP
  const skillOf = (id) => { const sk = rawSkill(id); return sk && RACES[character.race]?.skillGift ? { ...sk, cd: sk.cd * 0.8, sp: Math.round((sk.sp || 0) * 0.85) } : sk; };
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
  // A display stand (anyone's): see what's on it; at your own, a Blacksmith puts their work on it
  // or takes it back
  function showStand(st, message = '') {
    const at = { x: st.piece.x, z: st.piece.z, l: st.piece.l };
    const shown = st.piece.show;
    const msg = message ? `<p class="shop-msg" role="status">${message}</p>` : '';
    const send = async (item, close) => {
      try {
        const r = await api.landShow({ ...at, item });
        if (item) game.takeOut(item.uid);
        else if (r.old) game.putBack(r.old);
        setLands(r.plots || []);
        close();
        showArea(item ? 'Your work is on the stand for everyone to see.' : 'You take it back off the stand.');
      } catch (err) { showStand(st, err.message || 'That did not work.'); }
    };
    if (shown) {
      const extra = st.mine
        ? `${msg}<div class="bag-actions"><button type="button" class="gold-button small" data-stand-take>Take it back</button></div>`
        : `<p class="bag-hint">Made by <b>${esc(st.owner)}</b>, shown on their stand.</p>`;
      showItemPop(itemInfoHtml(shown.id, shown, { extra, form: character.form }), (e, close) => {
        if (!e.target.closest('[data-stand-take]')) return;
        if (game.bagFull()) { showStand(st, 'Your bag is full.'); return; }
        send(null, close);
      });
      return;
    }
    if (!st.mine) { showArea(`${esc(st.owner)}'s display stand is empty.`); return; }
    if (character.cls !== 'blacksmith') { showArea('Only a Blacksmith can put their work on a display stand.'); return; }
    const gear = character.inventory.filter((e) => e.uid && !game.isEquipped(e));
    const list = gear.map((e) => `<button type="button" class="shop-row smith-row" data-stand-put="${e.uid}"><span class="smith-pic"><img class="item-pic" data-icon="${e.id}" data-plus="${e.plus || 0}" alt=""><span class="bag-icon">${ITEMS[e.id].icon}</span></span><span class="shop-name"><b>${esc(ITEMS[e.id].name)}${e.plus ? ` +${e.plus}` : ''}</b></span></button>`).join('');
    showItemPop(`<div class="item-pop-box" role="dialog" aria-label="Display stand">
        <button type="button" class="sw-close" data-pop-close aria-label="Close">×</button>
        <h3>Your display stand</h3>${msg}
        <p class="bag-hint">Choose a weapon or piece of armour to put on show. Everyone who walks by can touch it to see what it does. It stays yours: take it back whenever you like.</p>
        <div class="smith-list">${list || '<p class="bag-hint">No weapons or armour in your bag (take off what you are wearing first).</p>'}</div>
      </div>`, (e, close) => {
      const k = e.target.closest('[data-stand-put]')?.dataset.standPut;
      const item = k && game.entry(k);
      if (item) send(item, close);
    });
  }
  function setLands(list) { ui.myPlots = list.filter((p) => p.mine); ui.otherPlots = list.filter((p) => !p.mine); world.setLands(list); }
  const loadHomes = () => api.homeList().then((r) => { ui.homes = r.homes || []; world?.setHomes(ui.homes); }).catch(() => {});
  const loadCaves = () => api.caveList().then((r) => { ui.caves = r.caves || []; }).catch(() => {});
  // the Bank and oil (see bankui.js and data/economy.mjs)
  const takeWells = (list) => { ui.wells = list || []; world?.setWells(ui.wells); if (ui.well) ui.well = ui.wells.find((w) => w.id === ui.well.id) || ui.well; };
  const loadOil = () => api.oilInfo().then((r) => { takeWells(r.wells); ui.bankInfo = { ...(ui.bankInfo || {}), oil: r.oil }; }).catch(() => {});
  const loadBank = () => api.bankInfo().then((r) => { game.setCoins(r.coins); ui.bankInfo = { bank: r.bank, oil: r.oil }; }).catch((e) => { ui.econMsg = e.message; ui.econBad = true; });
  // one thing done at the Bank or with oil: the server sees your latest coins, bag and spot first
  async function econ(run) {
    ui.econBusy = true; drawPanel();
    try {
      await game.saveNow();
      if (world) await api.saveLocation(world.here()).catch(() => {});
      const r = await run();
      if (r.coins != null) game.setCoins(r.coins);
      if (r.bank) ui.bankInfo = { ...(ui.bankInfo || {}), bank: r.bank };
      if (r.oil) ui.bankInfo = { ...(ui.bankInfo || {}), oil: r.oil };
      if (r.wells) takeWells(r.wells);
      ui.econMsg = r.message || ''; ui.econBad = false;
      return r;
    } catch (err) { ui.econMsg = err.message; ui.econBad = true; return null; }
    finally { ui.econBusy = false; drawPanel(); }
  }
  // dig a test pit with a Shovel, just in front of you
  let digging = false;
  function digPit() {
    if (digging) return;
    const spot = world?.digSpot();
    if (!spot || spot.error) { showArea(spot?.error || 'You can\'t dig here.'); return; }
    digging = true;
    showArea('You dig a test pit...');
    setTimeout(async () => {
      try {
        await game.saveNow();
        await api.saveLocation(world.here()).catch(() => {});
        const r = await api.oilAct({ act: 'dig', x: spot.x, z: spot.z });
        world?.digPit(spot.x, spot.z);
        if (r.oil) ui.bankInfo = { ...(ui.bankInfo || {}), oil: r.oil };
        if (r.wells) takeWells(r.wells);
        showArea(r.message);
        if (r.found) { ui.oilSpot = depositById(r.found); ui.econMsg = r.message; ui.econBad = false; openPanel('oilspot'); }
      } catch (err) { showArea(err.message); }
      digging = false;
    }, 2500);
  }
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
      ? `<span>${ui.basket.length} plot${ui.basket.length === 1 ? '' : 's'} chosen · ${money(basketTotal())}</span><button type="button" class="sys-button" data-land-open>Buy…</button><button type="button" class="sys-button ghost" data-land-clear>Clear</button>`
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
    // (only when it changes: a button redrawn under your thumb loses the tap)
    const label = armed ? `Attack with ${game.weapon().name}` : 'Punch';
    if (btn.getAttribute('aria-label') !== label || !btn.firstChild) {
      btn.innerHTML = armed ? SWORD : FIST;
      btn.setAttribute('aria-label', label);
      btn.classList.toggle('armed', armed);
    }
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
    if (name === 'status') renderStatus(overlay, character, ui.pending, game.stats(), passPerks());
    else if (name === 'bag') { renderBag(overlay, game, ui.selected); preview.mount(overlay.querySelector('[data-preview]')); }
    else if (name === 'shop') renderShop(overlay, game, ui.shopMsg);
    else if (name === 'market' && ui.market) renderShop(overlay, game, ui.shopMsg, ui.market);
    else if (name === 'groups') renderGroups(overlay, game, ui.groups, { message: ui.groupMsg, busy: ui.groupBusy });
    else if (name === 'rooms') renderRooms(overlay, game, { rentals: ui.rentals, pick: ui.roomPick, message: ui.roomMsg, busy: ui.roomBusy, castle: !!ui.roomsCastle, emperor: !!ui.groups?.nation });
    else if (name === 'appraise') renderAppraise(overlay, game, ui.appraise || {});
    else if (name === 'parents') renderParents(overlay, game, { visited: ui.parentsVisited });
    else if (name === 'academy') renderAcademy(overlay, game, { school: ui.academySchool, message: ui.academyMsg || '' });
    else if (name === 'ceremony') renderCeremony(overlay, game, { result: ui.grown, busy: ui.ceremonyBusy, message: ui.ceremonyMsg || '' });
    else if (name === 'gate') renderIdCard(overlay, game, { city: ui.gate?.city, leaving: ui.gate?.leaving, monster: ui.gate?.barred, barredText: ui.gate?.barred && !ui.gate?.monster ? 'The guards bare their fangs. "No outsiders in a monster city."' : null, courts: ui.courts || [], nation: ui.groups?.nation?.name, perks: passPerks() });
    else if (name === 'citygate' && ui.cityGate) renderIdCard(overlay, game, { city: ui.cityGate.city, inner: ui.cityGate, courts: ui.courts || [], nation: ui.groups?.nation?.name, perks: passPerks(), message: ui.cityGateMsg || '' });
    else if (name === 'smith') renderSmith(overlay, game, ui.pick, ui.smithMsg, { workshop: !!ui.workshop });
    else if (name === 'potions') renderPotions(overlay, game, ui.potionMsg || '');
    else if (name === 'quests') renderQuests(overlay, game, tabsHtml, ui.questMsg);
    else if (name === 'guild') renderGuild(overlay, game, ui.questMsg, ui.bounty);
    else if (name === 'family') renderFamily(overlay, game, { server: ui.familyServer, message: ui.familyMsg || '' });
    else if (name === 'assess') renderAssess(overlay, character, ui.assessed);
    else if (name === 'map' && world?.indoors()?.kind === 'castle') renderCastlePlan(overlay, world.indoors());
    else if (name === 'map') renderMap(overlay, () => world?.position(), [...(character.quests || []).filter((q) => q.accepted && q.type === 'explore' && !q.have).map((q) => ({ ...q.place, label: q.title.replace('Explore: ', '') })),
      ...(character.villages?.list || []).map((v) => ({ x: v.x, z: v.z, label: villageName(v) }))],
      { plots: ui.myPlots || [], others: ui.otherPlots || [], chosen: () => ui.basket, reach: REACH, caves: (ui.caves || []).filter((q) => q.mine).map((q) => { const cv = caveById(q.cave); return cv && { x: cv.place.x, z: cv.place.z, name: cv.name }; }).filter(Boolean) },
      world?.landMode ? (x, z) => {
        // tapping squares on the map chooses them to buy together; your own land opens in the Land window
        const info = tapPlot(Math.floor(x / PLOT), Math.floor(z / PLOT));
        if (info.owned?.mine || (info.why && !ui.basket.length)) { overlay.dataset.panel = 'land'; drawPanel(); return; }
        if (info.why) ui.landMsg = info.why;
        else if (info.owned && !info.owned.mine) ui.landMsg = `Owned by ${info.owned.owner}.`;
        updateMapBasket();
      } : null, null, ui.adminPowers?.on('teleport') ? (x, z) => {
        // an admin's Teleport power: tap the map to go there
        if (world?.teleport(x, z - 5)) { closePanel(); showArea('Teleported.'); } else showArea('You can\'t teleport from in here.');
      } : null);
    else if (name === 'settings') renderSettings(overlay, settings, api.deviceAccounts(), api.cloudSaves(), ui.passwordMsg || '', { binding: ui.bindingControl, message: ui.controlMsg || '', country: game ? character.country || '' : undefined, account: myAccount, acct: ui.acct });
    else if (name === 'skills') renderSkills(overlay, game, { binding: ui.binding, message: ui.skillMsg });
    else if (name === 'power') { if (ui.powers.length) renderPower(overlay, game, ui.powers[0], { binding: ui.binding, message: ui.skillMsg, more: ui.powers.length - 1 }); else closePanel(); }
    else if (name === 'options') renderOptions(overlay);
    else if (name === 'welcome') renderWelcome(overlay, character.name, !(character.level === 1 && !character.exp));
    else if (name === 'portal' && world?.atPortal) {
      ui.trip = { from: world.atPortal, to: null, onPick: showTrip, level: character.level };
      renderMap(overlay, () => world?.position(), [], { plots: ui.myPlots || [], caves: [] }, null, ui.trip);
    }
    else if (name === 'rankings') renderRankings(overlay, ui.top, character.name, ui.courts || []);
    else if (name === 'cult') renderCult(overlay, character, ui.cult, { message: ui.cultMsg || '', counts: missionCount });
    else if (name === 'challenge' && ui.challengeCourt) renderChallenge(overlay, ui.challengeCourt, character.name, ui.challengeMsg || '');
    else if (name === 'cave' && ui.atCave) {
      const own = (ui.caves || []).find((q) => q.cave === ui.atCave.id);
      renderCave(overlay, ui.atCave, game, { owner: own?.owner, mine: own?.mine, message: ui.caveMsg || '', busy: ui.caveBusy });
    }
    else if (name === 'bank' && ui.bankCity) renderBank(overlay, game, { city: ui.bankCity, info: ui.bankInfo, tab: ui.bankTab, message: ui.econMsg || '', bad: ui.econBad, busy: ui.econBusy, wells: ui.wells || [] });
    else if (name === 'derrick' && ui.well) renderDerrick(overlay, ui.well, { message: ui.econMsg || '', bad: ui.econBad, busy: ui.econBusy });
    else if (name === 'oilspot' && ui.oilSpot) renderOilSpot(overlay, game, ui.oilSpot, { info: ui.bankInfo, well: (ui.wells || []).find((w) => w.id === ui.oilSpot.id), message: ui.econMsg || '', bad: ui.econBad, busy: ui.econBusy });
    else if (name === 'estate' && ui.estateCity) renderEstate(overlay, game, { city: ui.estateCity, homes: ui.homes || [], ring: ui.estateRing, message: ui.estateMsg || '', busy: ui.estateBusy });
    else if (name === 'land' && ui.plot) renderLand(overlay, ui.plot, game, { choice: ui.landChoice, message: ui.landMsg, busy: ui.landBusy, basket: ui.basket.map((p) => ({ ...p, price: plotPrice(p.ix, p.iz) })) });
    else overlay.innerHTML = HELP_HTML;
    if (name !== 'bag') preview.unmount();
    if (name === 'map') updateMapBasket();
    if (name === 'bag' || name === 'shop' || name === 'market' || name === 'smith') fillIcons(overlay);
  }
  const openPanel = (name) => {
    // the Blacksmith window (forging, merging, minting) is for Blacksmiths alone
    if (name === 'smith' && character.cls !== 'blacksmith') { showArea('Only a Blacksmith can open the Blacksmith window. A Blacksmith player can forge, merge or mint for you.'); return; }
    if (!overlay.classList.contains('hidden') && overlay.dataset.panel === name) { closePanel(); return; }
    world?.releaseMouse();
    overlay.dataset.panel = name;
    if (name !== 'power') ui.powers = [];
    ui.workshop = false;
    ui.shopMsg = ''; ui.smithMsg = ''; ui.questMsg = ''; ui.passwordMsg = ''; ui.acct = {}; ui.skillMsg = ''; ui.binding = null;
    if (name === 'groups') { ui.groupMsg = ''; loadGroups(); }
    if (name === 'cult') { ui.cultMsg = ''; loadCult(); }
    if (name === 'family') { ui.familyMsg = ''; loadFamily(); }
    if (name === 'rankings') {
      ui.top = null;
      game.saveNow();
      api.topPlayers().then((r) => { ui.top = r.players; }).catch(() => { ui.top = []; })
        .then(() => { if (overlay.dataset.panel === 'rankings') drawPanel(); });
    }
    drawPanel();
    overlay.classList.remove('hidden');
  };
  // A death: it costs one of your 3 lives and you wake at the nearest shrine, or, with none left
  // (or of old age below level 250), it is final (see data/life.mjs).
  // The screen turns grey at once with the news and the lives left; the heavy work of moving you
  // to the shrine (building its town and land) happens only after that has been drawn, behind a
  // dark screen, so the moment of death never freezes the game. Then you stand up again by yourself.
  function died(by, cause) {
    const out = game.die(cause);
    if (!out.rise) { fallen(by); return; }
    if (!overlay.classList.contains('hidden')) closePanel();
    world?.releaseMouse();
    const what = cause === 'age' ? 'Your body gave out to old age.'
      : cause === 'fall' ? 'You fell from too high.'
      : cause === 'drown' ? 'You drowned.'
      : `You were killed by ${cause === 'monster' && !/^the /i.test(by) ? 'a ' : ''}${esc(by)}.`;
    const lives = out.free
      ? (out.renewed ? `Past level ${UNDYING_LEVEL}, death cannot hold you: the shrine renews you at the age of ${RENEW_AGE}.` : `Past level ${UNDYING_LEVEL}, death cannot hold you. <b>No life lost.</b>`)
      : `<b class="death-lives">${out.livesLeft} ${out.livesLeft === 1 ? 'life' : 'lives'} left</b>${out.livesLeft === 1 ? '<br><small>The next death will be your last.</small>' : ''}`;
    showDeathScreen(what, lives);
  }
  const DEATH_GREY_MS = 3000; // how long the grey screen shows before you are carried to the shrine
  const DEATH_LOAD_MS = 2500; // the most time spent building the shrine's land before you stand up
  let deathScreen = null;
  function showDeathScreen(what, lives) {
    deathScreen?.remove();
    const el = deathScreen = document.createElement('div');
    el.id = 'death-screen';
    el.setAttribute('role', 'alert');
    el.innerHTML = `
      <div class="death-box">
        <h2>You died</h2>
        <p>${what}</p>
        <p>${lives}</p>
        <p class="death-wait">Respawning in <span data-count>${Math.ceil(DEATH_GREY_MS / 1000)}</span>…</p>
      </div>`;
    document.body.append(el);
    document.body.classList.add('player-dead');
    const count = el.querySelector('[data-count]');
    const wait = el.querySelector('.death-wait');
    const t0 = performance.now();
    const tick = setInterval(() => { count.textContent = Math.max(1, Math.ceil((DEATH_GREY_MS - (performance.now() - t0)) / 1000)); }, 250);
    setTimeout(() => {
      clearInterval(tick);
      el.classList.add('dark'); // fade to a dark screen, then do the heavy work behind it
      wait.textContent = 'Waking at the shrine…';
      setTimeout(() => requestAnimationFrame(() => {
        const where = world?.riseAtShrine();
        wait.textContent = `Waking at the shrine of ${where || 'the nearest town'}…`;
        drawHud();
        const s0 = performance.now();
        const build = () => {
          if (deathScreen !== el) return;
          const left = world?.catchUpLand(24) || 0;
          if (left > 0 && performance.now() - s0 < DEATH_LOAD_MS) { requestAnimationFrame(build); return; }
          world?.stand();
          document.body.classList.remove('player-dead');
          el.classList.add('gone');
          setTimeout(() => { el.remove(); if (deathScreen === el) deathScreen = null; }, 700);
        };
        requestAnimationFrame(build);
      }), 450);
    }, DEATH_GREY_MS);
  }
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
        <p>Your journey begins again from the very start: you will be born anew, into a new family, as whatever life gives you.</p>
        <p>Your Unique Skill stays with you: <b>${esc(kept?.name || '')}</b>.</p>
        ${character.pact === 'dark' ? '<p>You served the dark and die a <b>sinner</b>. Your next life begins weaker.</p>' : character.pact === 'holy' ? '<p>You die in the Light. Your next life begins <b>stronger</b>.</p>' : ''}
        ${(character.children || []).length ? `<p>Or be <b>reborn as one of your children</b>, a child of 4 in your family's house:</p>
          <p>${character.children.map((k, i) => `<button type="button" class="gold-button small" data-rebirth="${i}">${esc(k.name)} (${esc(RACES[k.race]?.name || k.race)})</button>`).join(' ')}</p>` : ''}
        <button type="button" class="gold-button" data-begin-again>Begin again</button>
      </div>`;
    overlay.classList.remove('hidden');
    overlay.querySelector('[data-begin-again]').addEventListener('click', () => location.reload());
    for (const b of overlay.querySelectorAll('[data-rebirth]')) b.addEventListener('click', () => { try { sessionStorage.setItem('ar.rebirth', b.dataset.rebirth); } catch { /* blocked */ } location.reload(); });
  }
  const closePanel = () => { if (overlay.dataset.panel === 'power') ui.powers = []; overlay.classList.add('hidden'); overlay.dataset.shown = ''; preview.unmount(); };

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
      model = buildCharacter({ race: character.race, form: character.form, stage: character.stage || 0, look: character.look, age: ageOf(character) });
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
  // marriage between players: proposals waiting for you, and your spouse as the server has it
  function loadFamily(r = null) {
    const done = (x) => { ui.familyServer = x; if (x.spouse && !character.spouse) game.setSpouse(x.spouse); if (overlay.dataset.panel === 'family') drawPanel(); };
    if (r) { done(r); return; }
    api.family().then(done).catch(() => {});
  }
  overlay.addEventListener('submit', async (e) => {
    if (!e.target.matches('[data-propose-form]')) return;
    e.preventDefault();
    const { to } = Object.fromEntries(new FormData(e.target));
    try { loadFamily(await api.familyAct({ act: 'propose', to })); ui.familyMsg = `You asked ${to}. They will see it in their Family window.`; } catch (err) { ui.familyMsg = err.message; }
    drawPanel();
  });
  overlay.addEventListener('change', (e) => {
    if (e.target.matches?.('[data-country]')) {
      game.setCountry(e.target.value);
      const f = overlay.querySelector('[data-country-flag]');
      if (f) { f.innerHTML = flagHtml(character.country); fillFlags(f); }
      return;
    }
    const i = e.target.dataset?.kidSchool;
    if (i != null) { game.setChildSchool(Number(i), e.target.value); ui.familyMsg = 'School chosen.'; }
  });
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
  // Settings: the email and 2-step sign-in
  const acctDo = async (fn) => {
    try {
      const r = await fn();
      if (r?.account) myAccount = { ...myAccount, ...r.account };
      return r;
    } catch (err) { ui.acct = { ...(ui.acct || {}), msg: err.message, code: null }; drawPanel(); return null; }
  };
  overlay.addEventListener('submit', async (e) => {
    const kind = e.target.dataset?.acct;
    if (!kind) return;
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const way = e.submitter?.value;
    let r;
    if (kind === 'verify') { if ((r = await acctDo(() => api.verifyEmail({ code: f.code })))) ui.acct = { msg: 'Email confirmed. Thank you!' }; }
    else if (kind === 'email') { if ((r = await acctDo(() => api.setEmail(f.email, f.password)))) ui.acct = { msg: myAccount.mail ? `Saved. We sent a code to ${f.email}: type it above to confirm it.` : 'Saved.', code: r.previewCode }; }
    else if (kind === 'twofa' && way === 'email') { if ((r = await acctDo(() => api.twofaEmail(f.password)))) ui.acct = { msg: '2-step sign-in is on: codes will come by email.' }; }
    else if (kind === 'twofa') { if ((r = await acctDo(() => api.twofaAppStart(f.password)))) ui.acct = { app: { secret: r.secret, uri: r.uri } }; }
    else if (kind === 'app-confirm') { if ((r = await acctDo(() => api.twofaAppConfirm(f.code)))) ui.acct = { msg: '2-step sign-in is on: you will need a code from the app each time you sign in.' }; }
    else if (kind === 'off') { if ((r = await acctDo(() => api.twofaOff(f.password)))) ui.acct = { msg: '2-step sign-in is off.' }; }
    if (r) drawPanel();
  });
  overlay.addEventListener('click', async (e) => {
    if (e.target.closest('[data-acct-cancel]')) { ui.acct = {}; drawPanel(); return; }
    if (!e.target.closest('[data-acct-send]')) return;
    const r = await acctDo(() => api.sendVerify());
    if (r) { ui.acct = { msg: r.already ? 'Your email is already confirmed.' : 'Sent. Look for the newest email.', code: r.previewCode }; drawPanel(); }
  });
  overlay.addEventListener('submit', async (e) => {
    if (!e.target.matches('[data-password]')) return;
    e.preventDefault();
    const { current, password, confirm } = Object.fromEntries(new FormData(e.target));
    try {
      if (password !== confirm) throw new Error('The two passwords don\'t match.');
      await api.changePassword(current, password);
      ui.passwordMsg = 'Password changed. Use the new one next time you sign in.';
    } catch (err) { ui.passwordMsg = err.message; }
    drawPanel();
  });
  $('attack-btn').classList.remove('hidden');
  $('attack-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); world?.attack(); });
  $('jump-btn').classList.remove('hidden');
  $('jump-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); world?.jump(); });
  // on a dragon or wyvern: hold to fly down (tap jump to climb); shown only while you fly
  {
    const dive = document.createElement('button');
    dive.type = 'button'; dive.id = 'dive-btn'; dive.className = 'hidden'; dive.setAttribute('aria-label', 'Fly down');
    dive.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v13m-6-6 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    $('jump-btn').after(dive);
    const set = (on) => (e) => { e.preventDefault(); e.stopPropagation(); world?.flyDown?.(on); };
    dive.addEventListener('pointerdown', set(true));
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) dive.addEventListener(ev, set(false));
    setInterval(() => { const on = !!world?.flying; if (dive.classList.contains('hidden') === on) dive.classList.toggle('hidden', !on); if (!on) world?.flyDown?.(false); }, 400);
  }

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
    const lv = portalLevel(to);
    // a portal only opens to land whose monsters are your level or lower
    if (lv > character.level) {
      box.innerHTML = `<p><b>${to.name}</b> · ${portalKm(ui.trip.from, to).toFixed(1)} km away</p>
        <p class="error">🔒 Monsters there are up to level ${lv}. The portal won't send you until you are level ${lv}.</p>`;
      return;
    }
    const fee = portalFee(ui.trip.from, to);
    box.innerHTML = `<p><b>${to.name}</b> · ${portalKm(ui.trip.from, to).toFixed(1)} km away · monsters up to Lv ${lv}</p>
      <p>Fee: <b>${money(fee)}</b> <small>(you have ${money(character.coins)})</small></p>
      ${message ? `<p class="error">${message}</p>` : ''}
      <button type="button" class="gold-button" data-portal-go="${to.id}">Pay ${money(fee)} and travel</button>`;
  }
  function openPortal() {
    if (world?.underground) { showArea(world.indoors ? 'Go outside to use a portal.' : 'There are no portals underground.'); return; }
    if (!world?.atPortal) { showArea('Stand on a portal stone to use it. The map (M) shows them as purple rings.'); return; }
    openPanel('portal');
  }

  // The Builder View: your land in 3D, to put up buildings
  // Build from your character, in the world itself (a see-through piece shows in front of you)
  async function walkBuild() {
    if (ui.walk) { ui.walk.stop(); return; }
    if (world?.underground) { showArea(world.indoors ? 'Go outside to build.' : 'Come up to the surface to build.'); return; }
    let list;
    try { list = (await api.landList()).plots || []; } catch (err) { showArea(err.message); return; }
    setLands(list);
    if (!list.some((p) => p.mine)) { showArea("You don't own any land yet. Press L for the land grid and buy a plot, then build on it."); return; }
    closePanel();
    ui.walk = world.startWalkBuild(document.body, {
      plots: list,
      cls: character.cls,
      coins: () => character.coins,
      async build(body) {
        await game.saveNow();
        const r = await api.landBuild(body);
        game.setCoins(r.coins);
        setLands(r.plots);
        drawHud();
        return r.plots;
      },
      onClose: () => { ui.walk = null; },
    });
  }
  async function openBuilder() {
    if (ui.walk) { ui.walk.stop(); return; }
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
      onWalk: () => walkBuild(),
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
    // touching an item (its picture, name or box) shows what it does; its buttons still do their job
    const info = e.target.closest('[data-info],[data-info-entry]'), btn = e.target.closest('button');
    if (info && (!btn || btn.contains(info))) {
      const k = info.dataset.infoEntry;
      const entry = k ? game.entry(k) : null;
      showItemPop(itemInfoHtml(entry?.id || info.dataset.info, entry, { form: character.form }));
      return;
    }
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
      } else if (to) showTrip(to, r === 'coins' ? 'Not enough coins.' : r === 'level' ? 'The monsters there are stronger than you.' : 'That portal is across the sea.');
      return;
    }
    if (t('data-treat') != null) {
      const r = game.treat();
      ui.shopMsg = { treated: 'The healer sets and binds it. Come back tomorrow for the next treatment.', healed: 'The bone has mended. You are whole again.', coins: 'Not enough coins.', wait: 'Too soon: one treatment a day.', none: 'Nothing to treat.' }[r];
      drawHud(); drawPanel(); return;
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
      if (r) { ui.questMsg = `Quest complete: +${r.exp} EXP, +${money(r.coins)}${r.item ? `, ${r.item.replace(/_/g, ' ')}` : ''}.`; world?.say('Quest complete!', 'exp'); }
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
    if (t('data-appraise') != null) {
      const name = overlay.querySelector('[data-appraise-name]')?.value.trim();
      if (!name) return;
      ui.appraise = { ...(ui.appraise || {}), busy: true, message: '' }; drawPanel();
      api.appraise(name).then((r) => { ui.appraise.person = r.player; }).catch((err) => { ui.appraise.message = err.message; ui.appraise.person = null; })
        .then(() => { ui.appraise.busy = false; drawPanel(); });
      return;
    }
    if ((v = t('data-school')) != null) { game.setSchool(v); ui.academyMsg = `You are registered at the ${SCHOOLS[v].academy}. Stand on the red training mat beside your teacher to train.`; drawPanel(); return; }
    if (t('data-open-family') != null) { openPanel('family'); return; }
    if ((v = t('data-marry')) != null) {
      const s2 = suitorsFor(character, realmTime().day)[Number(v)];
      const r = s2 ? game.marryNpc(s2) : 'gone';
      ui.familyMsg = { married: `You and ${s2?.name} are married at the shrine!`, coins: 'You cannot afford the wedding.', young: `You must be ${MARRY_AGE} to marry.`, 'married-already': 'You are already married.' }[r] || '';
      drawPanel(); drawHud(); return;
    }
    if ((v = t('data-answer')) != null) {
      const [from, yes] = v.split(':');
      api.familyAct({ act: 'answer', from, yes: yes === '1' }).then((r) => { if (r.married) game.setSpouse(r.married); ui.familyMsg = r.married ? `You and ${from} are married!` : 'You said no.'; loadFamily(r); })
        .catch((err) => { ui.familyMsg = err.message; drawPanel(); });
      return;
    }
    if (t('data-have-child') != null || t('data-adopt') != null) {
      const school = overlay.querySelector('[data-new-school]')?.value || null;
      const r = game.haveChild(school, t('data-adopt') != null);
      const kid = character.children?.[character.children.length - 1];
      ui.familyMsg = { born: `Welcome, ${kid?.name}!`, coins: 'You cannot afford that.', wait: 'Not yet.', single: 'You need to be married first.', full: 'Your house is full.' }[r] || '';
      drawPanel(); drawHud(); return;
    }
    if ((v = t('data-guard')) != null) {
      const [tier, mins] = v.split(':');
      const r = game.hireGuard(tier, Number(mins));
      ui.questMsg = { hired: `Your ${BODYGUARDS[tier].name} is ready. They will follow you and fight anything that comes near.`, coins: 'You cannot afford that hunter.', busy: 'You already have a bodyguard.' }[r] || '';
      world?.refreshGuard(); drawPanel(); return;
    }
    if (t('data-guard-dismiss') != null) { game.dismissGuard(); world?.refreshGuard(); ui.questMsg = 'Your bodyguard heads home.'; drawPanel(); return; }
    if (t('data-ceremony') != null) {
      ui.ceremonyBusy = true; drawPanel();
      game.saveNow?.();
      api.ceremony().then((r) => {
        game.grownUp(r.character);
        ui.grown = r.character;
        world?.rebuildAvatar(); drawHud(); drawSkillBar();
        loadCityGates(); // your card goes up in the sky over the shrine
      }).catch((err) => { ui.ceremonyMsg = err.message; }).then(() => { ui.ceremonyBusy = false; drawPanel(); });
      return;
    }
    if (t('data-show-id') != null) { if (world?.passGate()) closePanel(); return; }
    // a day pass at a gate between a city's rings
    if ((v = t('data-day-pass')) != null) {
      const r = game.buyDayPass(v, ui.cityGate?.cityId);
      if (r === 'bought') { ui.cityGateMsg = ''; drawHud(); closePanel(); showArea(`Day pass bought: the ${PASS_NAME[v]} is open to you for one day of the realm.`); }
      else { ui.cityGateMsg = r === 'coins' ? 'Insufficient funds.' : 'The guard shakes their head.'; drawPanel(); }
      return;
    }
    if ((v = t('data-spell')) != null) { const r = game.attachSpell(v); ui.skillMsg = { ok: `${SPELLS[v].name} attached to your staff.`, full: 'Your staff is full: detach a spell first.', staff: 'Hold a staff first.' }[r] || ''; drawPanel(); return; }
    if ((v = t('data-unspell')) != null) { game.detachSpell(v); ui.skillMsg = `${SPELLS[v].name} detached.`; drawPanel(); return; }
    if ((v = t('data-ready')) != null) { game.readySkill(v); ui.skillMsg = ''; drawPanel(); return; }
    if ((v = t('data-store')) != null) { game.storeSkill(v); ui.skillMsg = `${SKILLS[v].name} stored.`; drawPanel(); return; }
    if (t('data-power-next') != null) { ui.powers.shift(); ui.skillMsg = ''; if (ui.powers.length) drawPanel(); else closePanel(); return; }
    if ((v = t('data-bind')) != null) { ui.binding = v; ui.skillMsg = 'Press the key you want for this skill (Esc to cancel).'; drawPanel(); return; }
    if (t('data-torch') != null) { closePanel(); world?.placeTorch(); return; }
    if (t('data-hold-torch') != null) { closePanel(); world?.holdTorch(); return; }
    if (t('data-dig') != null) { closePanel(); digPit(); return; }
    if ((v = t('data-bank-tab')) != null) { ui.bankTab = v; ui.econMsg = ''; drawPanel(); return; }
    if ((v = t('data-bank')) != null) {
      const box = overlay.querySelector('#bank-amount');
      const amount = box && box.value !== '' ? Math.floor(Number(box.value)) : undefined;
      const name = overlay.querySelector('#bank-company')?.value;
      if (v === 'found') econ(() => api.oilAct({ act: 'found', name, city: ui.bankCity?.id }));
      else econ(() => api.bankAct({ act: v, amount, cur: e.target.closest('[data-cur]')?.dataset.cur, from: e.target.closest('[data-from]')?.dataset.from, city: ui.bankCity?.id }));
      return;
    }
    if ((v = t('data-oil')) != null) {
      if (v === 'drill' && ui.oilSpot) econ(() => api.oilAct({ act: 'drill', x: ui.oilSpot.x, z: ui.oilSpot.z })).then((r) => { if (r?.ok) { ui.well = (ui.wells || []).find((w) => w.id === ui.oilSpot.id); if (ui.well) { overlay.dataset.panel = 'derrick'; drawPanel(); } } });
      else if (ui.well) econ(() => api.oilAct({ act: v, id: ui.well.id })).then((r) => { if (r?.ok && v === 'close') { ui.well = null; closePanel(); showArea(r.message); } });
      return;
    }
    if ((v = t('data-estate-ring')) != null) { ui.estateRing = v; ui.estateMsg = ''; drawPanel(); return; }
    if ((v = t('data-home-buy')) != null && ui.estateCity) {
      ui.estateBusy = true; drawPanel();
      (async () => {
        try {
          await game.saveNow(); // so the server sees your latest coins
          const r = await api.homeBuy(ui.estateCity.id, v);
          game.setCoins(r.coins);
          ui.homes = r.homes; world?.setHomes(r.homes);
          ui.estateMsg = 'The house is yours! Its sign now shows your name.';
        } catch (err) { ui.estateMsg = err.message; }
        ui.estateBusy = false; drawPanel();
      })();
      return;
    }
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
    if (t('data-campfire') != null) { closePanel(); world?.lightCampfire(); return; }
    if ((v = t('data-plant')) != null) { closePanel(); world?.plantSeed(v); return; }
    if ((v = t('data-mount')) != null) { closePanel(); world?.callMount(v); return; }
    if ((v = t('data-cult')) != null) {
      const btn = e.target.closest('[data-cult]');
      const body = { action: v };
      if (v === 'answer') body.choice = btn.dataset.choice;
      if (v === 'found') body.name = overlay.querySelector('[data-cult-found]')?.value;
      if (v === 'give') { body.name = btn.dataset.name; body.pick = Number(overlay.querySelector(`[data-cult-pick="${CSS.escape(btn.dataset.name)}"]`)?.value) || 0; }
      api.cultAct(body).then((r) => {
        if (r.reward) {
          // the Dark Side's magic: a spell in each of your elements, at once
          for (const id of game.takePact(r.reward)) { game.attachSpell(id); world?.say(`New spell: ${SPELLS[id].name}`, 'exp'); newPower({ kind: 'spell', id }); }
        }
        if (r.mage) { game.becameMage(r.mage.cls, r.mage.stats); world?.say('You are a Mage now', 'exp'); }
        ui.cultMsg = { mage: 'You are a Mage now. The Mage ranks are yours to climb.', answer: { dark: 'You have joined the Dark Side. Dark magic fills you. Tell no one.', light: 'You have become Light. The Book of the Dawn is in your bag. Tell no one.', none: 'The voice fades. You must never speak of it.' }[body.choice], found: 'Your cult is founded. You are its Cult Leader.',
          ask: 'A new mission.', give: 'The mission has gone down to them.' }[v] || '';
        takeCult(r);
        if (v === 'answer' && body.choice === 'none') closePanel(); else drawPanel();
      }).catch((err) => { ui.cultMsg = err.message; if (v === 'answer') loadCult(); drawPanel(); });
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
      if (r === 'ok') deed('stone_set');
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
    if ((v = t('data-view')) != null) { settings.view = v; saveSettings(); world?.setView(v); drawPanel(); return; }
    if ((v = t('data-graphics')) != null) { settings.graphics = v; saveSettings(); settings.graphicsNow = world?.setGraphics(v); drawPanel(); return; }
    if ((v = t('data-camera')) != null) { settings.camera = v; saveSettings(); world?.setCameraMode(v); drawPanel(); return; }
    if ((v = t('data-cam-follow')) != null) { settings.camFollow = v; saveSettings(); world?.setCameraFollow(v); drawPanel(); return; }
    if ((v = t('data-add')) != null) { ui.pending[v] = (ui.pending[v] || 0) + 1; drawPanel(); return; }
    if ((v = t('data-party-invites')) != null) {
      const before = character.partyInvites;
      character.partyInvites = v; drawPanel();
      api.setPartyInvites(v).catch((err) => { character.partyInvites = before; drawPanel(); showArea(err.message); });
      return;
    }
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
    if ((v = t('data-mint')) != null) {
      const made = game.mint(v);
      ui.smithMsg = made ? `The Blacksmith strikes your ${ITEMS[v].name} into ${moneyWords(made)}.` : 'You have none of that ore.';
      drawHud(); drawPanel(); return;
    }
    // in the tavern a drink is ordered: paid at the counter, made by the keeper, brought by the waiter
    if ((v = t('data-buy')) != null && overlay.dataset.panel === 'market' && ui.market === 'tavern' && ITEMS[v]?.kind === 'food' && world?.indoors()?.kind === 'tavern') {
      const r = game.order(v, ui.market);
      if (r === 'ok') {
        const name = ITEMS[v].name;
        world.tavernOrder(() => { game.serve(v); world?.say(`The waiter brings your ${name}. Refreshing!`, 'exp'); drawHud(); });
        ui.shopMsg = `Ordered: ${name}. Take a seat and the waiter will bring it to you.`;
      } else ui.shopMsg = SHOP_SAYS[r];
      drawPanel(); return;
    }
    if ((v = t('data-buy')) != null) { ui.shopMsg = SHOP_SAYS[game.buy(v, overlay.dataset.panel === 'market' ? ui.market : null)]; drawPanel(); return; }
    if ((v = t('data-sell')) != null || (v = t('data-sell-all')) != null) {
      const all = t('data-sell-all') != null;
      const n = all ? game.entry(v)?.n : 1;
      const got = game.sell(v, n, overlay.dataset.panel === 'market' ? ui.market : null);
      ui.shopMsg = got ? `Sold ${all ? `${n} ` : ''}for ${got} coins.` : '';
      if (got) world?.say(`+${money(got)}`, 'exp');
      // a Businessman's trade: a big sale, or a deal at a market stall in the dark
      if (got && character.cls === 'businessman') {
        if (got >= 2000) deed('big_sale');
        if (overlay.dataset.panel === 'market' && realmTime().night) deed('night_trade');
      }
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
        if (out.plus >= 9) deed('merge_ascend'); else if (out.plus >= 6) deed('merge_awaken');
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

  // If the page closed by itself last time while you were in the world (a phone out of memory),
  // this time the world opens on Battery saver, and says so. Leaving normally clears the mark.
  let closedBySelf = false;
  try { closedBySelf = localStorage.getItem('ar.inWorld') === '1'; localStorage.setItem('ar.inWorld', '1'); } catch { /* private window */ }
  const markInWorld = (on) => { try { if (on) localStorage.setItem('ar.inWorld', '1'); else localStorage.removeItem('ar.inWorld'); } catch { /* private window */ } };
  window.addEventListener('pagehide', () => markInWorld(false));
  document.addEventListener('visibilitychange', () => markInWorld(document.visibilityState !== 'hidden'));
  const safeStart = closedBySelf && settings.graphics !== 'low';
  if (safeStart) setTimeout(() => showArea('The game closed last time, so it is on Battery saver for now (Settings to change it)'), 4000);

  // painted now, behind the loading clouds, so the first look at the map or the bag doesn't stall
  try { warmWorldMap(); warmIcons([...(character.inventory || []).map((e) => e.id), ...Object.values(character.equipped || {}).map((e) => e?.id).filter(Boolean)]); } catch { /* only a head start */ }
  world = startWorld($('world'), character, {
    game,
    view: { camera: settings.camera, camFollow: settings.camFollow, mouse: settings.mouse, view: settings.view, graphics: safeStart ? 'low' : settings.graphics },
    onView(v) { settings.view = v; saveSettings(); showArea(v === 'first' ? 'First person view' : 'Third person view'); if (overlay.dataset.panel === 'settings' && !overlay.classList.contains('hidden')) drawPanel(); },
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
      // the phone took the graphics away for a moment (see world.js): wait, or reload if they don't come back
      if (type === 'graphicsLost') { showArea('Getting the graphics back...'); return; }
      if (type === 'graphicsBack') { showArea('Graphics are back'); return; }
      if (type === 'graphicsGone') { markInWorld(false); Promise.resolve(game.saveNow()).finally(() => location.reload()); return; }
      if (type === 'carcass') { showCarcass(data); return; }
      if (type === 'plant') { showPlant(data); return; }
      if (type === 'kill') for (const title of game.questKill(data.kind, data.level)) questReady(title);
      if (type === 'kill') {
        const t = realmTime();
        if (data.chief) deed(t.night ? 'village_chief_night' : 'village_chief');
        if (data.boss && data.depth) deed(t.night ? 'cave_boss_night' : 'cave_boss');
        if (data.royal) deed('royal_guard');
        if (data.level >= 50 && Math.floor(t.hour) === 0) deed('midnight_kill');
      }
      if (type === 'chest' && data.village) deed('village_loot');
      if (type === 'kill' && activeMissions().length) {
        const p = world?.position();
        if (p && nearTown(p, GATES_R)) missionStep('gates');
        if (realmTime().night) missionStep('night');
      }
      if (type === 'depths') $('minimap').classList.add('hidden'); // no map underground
      if (type === 'depths') showArea(`${data.cave.name}: ${{ small: 'a small', medium: 'a winding', deep: 'a deep' }[data.cave.size]} ${data.cave.dungeon ? 'dungeon in the mountain' : 'cave'}. Not every tunnel leads down to the boss: some are false routes that go deep and end in rock. ${world?.holding ? '' : 'Pitch dark: light a torch (T). '}Mine glowing ore veins, break nests, and find the boss at the bottom.`);
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
      if (type === 'market' && data === 'real_estate') {
        const p = world?.outdoors();
        ui.estateCity = p && placesWithPositions().filter((q) => q.city).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
        ui.estateMsg = ''; ui.estateRing ||= 'common';
        loadHomes().then(drawPanel);
        openPanel('estate');
      }
      // the counter of a city's Bank, or a village's Bank Kiosk: the window opens only there
      if ((type === 'market' && data === BANK_ID) || type === 'kiosk') {
        const p = world?.outdoors();
        const city = type === 'kiosk' ? null : p && placesWithPositions().filter((q) => q.city).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
        ui.bankCity = bankPlace(type === 'kiosk' ? data : city?.id);
        if (!ui.bankCity) return;
        if (!ui.bankCity.full && ui.bankTab === 'loan') ui.bankTab = 'safe';
        ui.econMsg = ''; ui.econBad = false; ui.bankTab ||= 'safe';
        loadBank().then(loadOil).then(drawPanel);
        openPanel('bank');
        return;
      }
      if (type === 'derrick') { ui.well = data; ui.econMsg = ''; ui.econBad = false; openPanel('derrick'); loadOil().then(drawPanel); return; }
      if (type === 'oil-spot') { ui.oilSpot = data; ui.econMsg = ''; ui.econBad = false; openPanel('oilspot'); loadOil().then(drawPanel); return; }
      else if (type === 'market') { ui.market = data; openPanel('market'); }
      if (type === 'indoors') {
        $('minimap').classList.add('hidden');
        if (data.kind === 'castle') { showArea("The Emperors' Castle: meetings at the council table are free. The steward's desk by the door (E) opens the chambers for private business."); loadRooms(); }
        else if (data.kind === 'academy') showArea(isChild(character)
          ? (character.child.school === data.shop.school ? `${data.shop.name}: stand on the red mat beside your teacher to train.` : `${data.shop.name}: register at the counter (E), then train on the red mat beside the teacher.`)
          : `${data.shop.name}: the Academies are for children before their Ceremony.`);
        else showArea(data.kind === 'guild' ? 'Main Guild Hall: the counter (E) has guild requests; sit at a table (E by a chair); the stairs lead up to the meeting rooms.' : `${data.shop.name}: walk up to the counter and press E. Sit on a chair with E.`);
        if (data.kind === 'guild') loadRooms();
      }
      if (type === 'outdoors') $('minimap').classList.remove('hidden');
      if (type === 'castle') { ui.roomsCastle = true; ui.roomPick = null; ui.roomMsg = ''; loadRooms(); openPanel('rooms'); }
      if (type === 'stand') showStand(data);
      if (type === 'anvil') {
        // your own anvil: the Blacksmith window, with the workshop pieces to forge too (Blacksmiths only)
        openPanel('smith');
        if (character.cls !== 'blacksmith') return;
        ui.workshop = true;
        drawPanel();
      }
      if (type === 'castle-denied') showArea(data.day === 'council' ? "Today is a council day: only Emperors and Guild Masters may enter the Emperors' Castle." : "Today is a trade day: only Emperors and the guests they invited may enter the Emperors' Castle.");
      if (type === 'meeting-room') { ui.roomsCastle = data.id.startsWith('castle'); ui.roomPick = data.id; ui.roomMsg = ''; loadRooms(); if (overlay.classList.contains('hidden') || overlay.dataset.panel !== 'rooms') openPanel('rooms'); }
      if (type === 'room-ended') { showArea('Your time in the meeting room is up. You are back in the hallway.'); loadRooms(); }
      // townsfolk: your own parents, other families, and the merchants of the plaza
      if (type === 'npc' && data.kind === 'parent' && data.mine) {
        game.visitParents();
        ui.parentsVisited = !isChild(character);
        openPanel('parents');
        return;
      }
      if (type === 'npc' && data.kind === 'stall') { ui.market = data.market; openPanel('market'); return; }
      if (type === 'npc') {
        const job = PARENT_JOBS[data.job]?.name;
        const line = data.kind === 'parent'
          ? (data.mine ? (isChild(character) ? `${data.name}, your parent (${job}): "Off to Academy Street with you! Pick the Academy of the class you want, register, and work hard."` : `${data.name}, your parent (${job}): "We are proud of you. Come home safe."`) : `${data.name} (${job}): "Good day to you."`)
          : data.kind === 'teacher' ? `${data.name}, teacher of the ${SCHOOLS[data.school].name}: "${isChild(character) ? (character.child.school === data.school ? 'Stand here with me and practise. Every minute counts, and soon you will learn our techniques.' : 'Is this your school? Choose it at the Academy, then come and train with me.') : 'You have grown well. Come back and teach the little ones some day.'}"`
          : data.kind === 'child' ? `${data.name}: "Want to play? Catch me if you can!"`
          : data.kind === 'shopper' ? `${data.name}: "Busy market today. The bread here is still warm."`
          : data.kind === 'idler' ? (data.pose === 'lying' ? `${data.name} is fast asleep on an old blanket.` : `${data.name}: "Spare a coin? No? Then mind the mud, friend."`)
          : data.kind === 'businessman' ? `${data.name}, ${data.title}: "Looking for a shop of your own? Come and see me once you are grown."` : `${data.name}, ${data.title}: "The finest goods in the city, for those with coin."`;
        showArea(line);
      }
      if (type === 'academy') { ui.academyMsg = ''; ui.academySchool = data; openPanel('academy'); }
      // Appraisal: the monster in front, then the land underfoot (looked up)
      if (type === 'appraise') {
        ui.appraise = { ...(ui.appraise || {}), monster: data.monster, land: null, message: '' };
        openPanel('appraise');
        const at = world?.position();
        api.landList().then((r) => {
          if (!at) return;
          const ix = Math.floor(at.x / 20), iz = Math.floor(at.z / 20);
          const p = (r.plots || []).find((q) => q.ix === ix && q.iz === iz);
          if (!p) return;
          ui.appraise.land = { ix, iz, owner: p.mine ? 'you' : p.owner, price: plotPrice(ix, iz), pieces: (p.pieces || []).length, built: piecesCost(p.pieces || [], 'other') };
          if (overlay.dataset.panel === 'appraise') drawPanel();
        }).catch(() => {});
      }
      if (type === 'citygate') { ui.cityGate = data; ui.cityGateMsg = ''; if (overlay.classList.contains('hidden') || overlay.dataset.panel !== 'citygate') openPanel('citygate'); }
      if (type === 'gate') { ui.gate = data; if (overlay.classList.contains('hidden') || overlay.dataset.panel !== 'gate') openPanel('gate'); }
      if (type === 'guild') { game.fillQuests(here(), 'guild'); openPanel('guild'); loadBounties(); }
      if (type === 'guild-denied') showArea(`The guards at the Main Guild Hall turn you away: only hunters of level ${data.level} or more may enter.`);
      if (type === 'assess') {
        const r = game.assessCard();
        if (r === 'none') showArea('The crystal stays dark. Ask for a Hunter Card at the counter first.');
        else { ui.assessed = r; openPanel('assess'); }
      }
      if (type === 'chest') showArea(`The chest held ${money(data.coins)}, ${data.items.join(', ')}.`);
      if (type === 'portal') drawHud();
      if (type === 'portal' && data) showArea(`${data.name}: press G (or tap Portal) to travel to another portal on this continent.`);
      if (type === 'ambush') showArea(`Ambush! ${data.n} goblins leap out of hiding!`);
      if (type === 'tired') showArea('You are getting very tired. Sleep (Z) by a fire or a torch before you collapse.');
      if (type === 'collapsed') showArea('You collapsed from exhaustion! Monsters may find you…');
      if (type === 'defeated') died(data.by, data.cause);
    },
    onKey(e) {
      const act = actionFor(e.code);
      const open = { status: 'status', bag: 'bag', shop: 'shop', smith: 'smith', quests: 'quests', help: 'help', map: 'map', settings: 'settings', rankings: 'rankings', skills: 'skills', groups: 'groups' }[act];
      if (open) openPanel(open);
      if (act === 'builder' && !ui.builder) { if (e.shiftKey && !ui.walk) walkBuild(); else openBuilder(); }
      if (act === 'portal') { if (overlay.dataset.panel === 'portal' && !overlay.classList.contains('hidden')) closePanel(); else openPortal(); }
      if (overlay.classList.contains('hidden')) { const b = character.skillBar.find((x) => x.key === e.code); if (b) trySkill(b.id); else if (act === 'unique') trySkill('unique'); else if (act === 'mythic') trySkill('mythic'); }
      if (act === 'land') toggleLand();
      if (act === 'view') { e.preventDefault(); if (!e.repeat) world?.toggleView(); }
      if (act === 'chat') { e.preventDefault(); world?.releaseMouse(); social?.focusChat(); }
      // Esc opens the options; Esc again (or on any window) closes it
      if (e.code === 'Escape') { if (overlay.classList.contains('hidden')) openPanel('options'); else closePanel(); }
    },
  });
  settings.graphicsNow = world.graphics; // what "Automatic" chose for this device
  if (ui.rentals) takeRentals(ui.rentals); else castleAccess(); // the world is here now
  if (/[?&]debug\b/.test(location.search)) { window.__world = world; window.__game = game; } // for tests

  window.addEventListener('pagehide', () => game.saveNow());
  // Friends and chat: search at the top right, chat at the bottom left
  social = createSocial($('game'));
  // Voice chat (16+): a mic button under the chat button; voices fade with distance
  createVoice($('game'), { position: () => world?.position() });
  // An admin's powers (fly, can't die, run fast, teleport), given by the owner on the Admin Board.
  // The private preview page belongs to the owner, so there every power is there to switch on.
  api.isPreviewMode().then((preview) => {
    ui.adminPowers = createPowers($('game'), preview ? POWER_IDS : myAccount?.powers || [], {
      apply(p, down) {
        world?.setPowers(p);
        game.setNoDeath(p.nodeath);
        if (down !== undefined) world?.flyDown(down);
      },
      say: (text) => world?.say(text, 'note'),
    });
  }).catch(() => {});
  // Everyone's land: posts on owned plots, and levelled ground
  api.landList().then((r) => setLands(r.plots || [])).catch(() => {});
  loadCaves();
  loadHomes();
  loadOil();
  setInterval(loadOil, 120000); // derricks' tanks fill, and others put new ones up
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
  setInterval(() => {
    if (document.hidden) return;
    game.addPlayTime(60000);
    // a life runs out at its race's age (see data/life.mjs)
    if (diedOfAge(character)) { world?.oldAge(); return; }
    // childhood: training at the Academy, growing a little, and the Ceremony at 7
    if (!isChild(character)) return;
    // training: inside your own class's Academy, on its mat beside the teacher
    const at = world?.trainingAt();
    if (character.child.school && at === character.child.school) { game.train(60000); if (overlay.dataset.panel === 'academy' && !overlay.classList.contains('hidden')) drawPanel(); }
    else if (at) showArea(character.child.school ? `You are registered at the ${SCHOOLS[character.child.school].academy}. Register here at the counter (E) to train here instead.` : 'Register at the counter (E) before you train.');
    world?.rebuildAvatar();
  }, 60000);
  // the Ceremony is held at the shrine in the middle of your city: when you are old enough, go there
  let ceremonyNag = 0;
  setInterval(() => {
    if (!ceremonyDue(character) || overlay.dataset.panel === 'ceremony' && !overlay.classList.contains('hidden')) return;
    if (world?.atShrine()) { if (!ui.ceremonyShown) { ui.ceremonyShown = true; ui.grown = null; openPanel('ceremony'); } return; }
    ui.ceremonyShown = false;
    if (Date.now() - ceremonyNag > 90000) { ceremonyNag = Date.now(); showArea('You are 7! Go to the shrine in the middle of your city for your Ceremony of Revealing.'); }
  }, 2000);
  // the bridges over the city moats: raised in times of war or attack (set by the realm's keepers)
  const loadCityGates = () => api.cityGates().then((r) => { world?.setCityGates(r.raised); world?.setCeremonies(r.ceremonies || []); }).catch(() => {});
  loadCityGates();
  setInterval(loadCityGates, 60000);
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
// The pop-up an item opens (see bag.js itemInfoHtml). `onClick(e, close)` handles its buttons.
// A hunted animal's body: drag it to a Butcher, cut it up here, or set it as bait over a snare
// (keys: E or 1 drags, 2 cuts, 3 baits)
function showCarcass(d) {
  world?.releaseMouse?.();
  const pop = showItemPop(`<div class="item-pop-box" role="dialog" aria-label="Hunted animal">
      <button type="button" class="sw-close" data-pop-close aria-label="Close">×</button>
      <h3>${escHtml(d.name)}</h3>
      <p class="bag-hint">${d.meat ? 'Halal game. Take it whole to a Halal Butcher on a farm (he prepares and cooks it for a small fee), or cut it up here and cook the meat over a fire.' : 'Its meat is not halal and is not eaten, but its hide and fangs can be sold.'}</p>
      <div class="pop-actions">
        <button type="button" class="gold-button small" data-carcass="drag">Drag it (E)</button>
        <button type="button" class="gold-button small" data-carcass="cut"${d.blade ? '' : ' title="You need a Hunting Knife, or a sword, dagger or axe in your hand"'}>Cut it up (2)${d.blade ? '' : ': needs a blade'}</button>
        ${d.baited ? '' : `<button type="button" class="gold-button small" data-carcass="bait"${d.snare ? '' : ' title="You need a Hunter\'s Snare Trap"'}>Set it as bait (3)${d.snare ? '' : ': needs a Snare Trap'}</button>`}
        ${d.canStuff && !d.trophy && !d.baited ? `<button type="button" class="gold-button small" data-carcass="stuff">Taxidermy (4)</button>` : ''}
      </div>
      <p class="bag-hint">${d.baited ? 'Your snare is set under it. Stay back and wait for a bigger animal to come for the bait.' : 'As bait, with a Hunter\'s Snare Trap under it, its smell draws a bigger meat-eater (a fox, jackal, lynx, wolf or bear, by the land), and the snare holds it fast.'}</p>
    </div>`, (e, close) => {
    const act = e.target.closest('[data-carcass]')?.dataset.carcass;
    if (!act) return;
    close(); window.removeEventListener('keydown', keys, true);
    carcassAct(act);
  });
  function carcassAct(act) {
    if (act === 'drag') world?.dragCarcass(); else if (act === 'bait') world?.baitCarcass(); else if (act === 'stuff') showTaxidermy(d); else world?.cutCarcass();
  }
  function keys(e) {
    if (!document.body.contains(pop)) { window.removeEventListener('keydown', keys, true); return; }
    const act = e.code === 'KeyE' || e.code === 'Digit1' ? 'drag' : e.code === 'Digit2' ? 'cut' : e.code === 'Digit3' && !d.baited ? 'bait' : e.code === 'Digit4' && d.canStuff && !d.trophy && !d.baited ? 'stuff' : null;
    if (!act) return;
    e.preventDefault(); e.stopPropagation();
    pop.remove(); window.removeEventListener('keydown', keys, true);
    carcassAct(act);
  }
  setTimeout(() => window.addEventListener('keydown', keys, true), 50);
}
// Taxidermy: keep the head, the head and paws (or hooves, or feet), or the whole body (keys 1 to 3)
function showTaxidermy(d) {
  world?.releaseMouse?.();
  const L = d.limbs, opts = [
    ['head', 'Head only', 1, 'Mounted on a plaque. The body stays, to cut up for meat and hide.'],
    ['paws', `Head and ${L}`, 2, `Mounted together. The body stays, to cut up (a little less hide).`],
    ['full', 'Full body', 3, 'The whole animal, stuffed and on a stand. Nothing is left to cut up.'],
  ];
  const pop = showItemPop(`<div class="item-pop-box" role="dialog" aria-label="Taxidermy">
      <button type="button" class="sw-close" data-pop-close aria-label="Close">×</button>
      <h3>Taxidermy: ${escHtml(d.name)}</h3>
      <p class="bag-hint">You have ${d.kits} Taxidermy Kit${d.kits === 1 ? '' : 's'}. You also need a blade in hand or a Hunting Knife. The trophy goes in your bag as furniture for a home, or to sell.</p>
      <div class="pop-actions" style="flex-direction:column;align-items:stretch">
        ${opts.map(([how, label, kits, about], i) => `<button type="button" class="gold-button small" data-stuff="${how}"${d.kits < kits ? ` title="Needs ${kits} kits"` : ''}>${label} (${i + 1}) · ${kits} kit${kits > 1 ? 's' : ''}</button><p class="bag-hint" style="margin:2px 0 8px">${about}</p>`).join('')}
      </div>
    </div>`, (e, close) => {
    const how = e.target.closest('[data-stuff]')?.dataset.stuff;
    if (!how) return;
    close(); window.removeEventListener('keydown', keys, true);
    world?.stuffCarcass(how);
  });
  function keys(e) {
    if (!document.body.contains(pop)) { window.removeEventListener('keydown', keys, true); return; }
    const how = { Digit1: 'head', Digit2: 'paws', Digit3: 'full' }[e.code];
    if (!how) return;
    e.preventDefault(); e.stopPropagation();
    pop.remove(); window.removeEventListener('keydown', keys, true);
    world?.stuffCarcass(how);
  }
  setTimeout(() => window.addEventListener('keydown', keys, true), 50);
}
// Which seeds to plant in this bed (when you carry more than one kind); keys 1 to 9 pick one too
function showPlant(d) {
  world?.releaseMouse?.();
  const pop = showItemPop(`<div class="item-pop-box" role="dialog" aria-label="Plant seeds">
      <button type="button" class="sw-close" data-pop-close aria-label="Close">×</button>
      <h3>🌱 What will you plant?</h3>
      <p class="bag-hint">One packet plants the whole bed. It grows even while you are away.</p>
      <div class="pop-actions">${d.seeds.map((q, i) => `<button type="button" class="gold-button small" data-plant-seed="${q.id}">${escHtml(q.crop)} <small>(${i + 1}) · ${q.mins} min</small></button>`).join('')}</div>
    </div>`, (e, close) => {
    const id = e.target.closest('[data-plant-seed]')?.dataset.plantSeed;
    if (!id) return;
    close(); window.removeEventListener('keydown', keys, true);
    world?.plantSeed(id);
  });
  function keys(e) {
    if (!document.body.contains(pop)) { window.removeEventListener('keydown', keys, true); return; }
    const n = /^Digit([1-9])$/.exec(e.code)?.[1];
    const q = n && d.seeds[Number(n) - 1];
    if (!q) return;
    e.preventDefault(); e.stopPropagation();
    pop.remove(); window.removeEventListener('keydown', keys, true);
    world?.plantSeed(q.id);
  }
  setTimeout(() => window.addEventListener('keydown', keys, true), 50);
}
const escHtml = (t) => String(t ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function showItemPop(html, onClick = null) {
  let pop = document.getElementById('item-pop');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = 'item-pop';
    pop.className = 'item-pop';
    document.body.appendChild(pop);
    pop.addEventListener('click', (e) => {
      if (e.target === pop || e.target.closest('[data-pop-close]')) { pop.remove(); return; }
      pop.onPick?.(e, () => pop.remove());
    });
    pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') pop.remove(); });
  }
  pop.innerHTML = html;
  pop.onPick = onClick;
  fillIcons(pop);
  pop.querySelector('[data-pop-close]')?.focus();
  return pop;
}

function showArea(name) {
  const el = $('area');
  el.textContent = name;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(areaTimer);
  areaTimer = setTimeout(() => el.classList.remove('show'), 4000);
}

function wireForm(formId, action, after = (result) => steps.next(result)) {
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
      await after(result);
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

// the country picker on the sign-up form, with its flag beside it
$('signup-country').innerHTML = countryOptions('');
wireCountryPicker($('signup-country'), $('signup-flag'));
wireForm('signup-form', ({ confirm, ...fields }) => {
  if (fields.password !== confirm) throw new Error('The two passwords don\'t match.');
  return api.signUp(fields);
});
wireForm('signin-form', api.signIn);
wireForm('forgot-form', ({ login }) => api.forgotPassword(login), (f) => steps.askReset(f));

