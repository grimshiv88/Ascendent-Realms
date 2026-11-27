// The in-game HUD and the Status Window (laid out like Mohammed's black-and-gold design).
import { HUNGRY, hungerWord } from './data/hunger.mjs';
import { CASTLES, castleOf, KING_RETURNS_MS, CHALLENGE_ANSWER_MS } from './data/kings.mjs';
import { CONTROLS, CATEGORIES, CONTROL, codeFor, codesFor, keyName, clashes, isDefault } from './data/controls.mjs';
import {
  RACES, CLASSES, CLASS_GUIDE, ADVANCEMENTS, EVOLUTIONS, KEY_LEVELS, derivedStats, expToNext, rankFor, mayChangeForm, FORM_SWITCH_LEVEL,
} from './data/game-data.mjs';
import { tabsHtml } from './bag.js';
import { lifeRows, passRows } from './idcard.js';
import { fillFlags, flagHtml, countryOptions } from './flag.js';
import { birthdateWords } from './data/birthdate.mjs';
import { uniqueAbility, uniqueTier, TIER_NAMES, rankProofs, isAppraisal, RANK_UP_MAX, TRIALS_PER_PROOF, WORK_PER_PROOF } from './data/unique.mjs';
import { ageOf, CEREMONY_AGE, PARENT_JOBS, parentAlive, visitDue } from './data/birth.mjs';
import { ageYears, livesLeft, LIVES, MARRY_AGE, UNDYING_LEVEL } from './data/life.mjs';
import { PRIVACY, privacyOf, PARTY_INVITES, partyInvitesOf } from './data/social.mjs';
import { gameTime, clockText } from './data/clock.mjs';
import { SKILLS, UPGRADE_EVERY } from './data/skills.mjs';
import { money } from './data/money.mjs';
import { INJURY } from './progress.js';
import { setHtml } from './morph.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The ☰ menu in the top right; the letter keys open the same windows directly
let menuOpen = false;
export const toggleMenu = (open = !menuOpen) => { menuOpen = open; };

// The status card in the top left can be dragged anywhere by its grip, or hidden behind a small
// button like the chat. Where it is, and whether it's hidden, is kept in this browser.
const hudView = (() => { try { return { hidden: false, x: 0, y: 0, ...JSON.parse(localStorage.getItem('ar-hud') || '{}') }; } catch { return { hidden: false, x: 0, y: 0 }; } })();
const saveHudView = () => { try { localStorage.setItem('ar-hud', JSON.stringify(hudView)); } catch { /* private window */ } };
export function bindHud(el, redraw) {
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-hud-hide]')) { hudView.hidden = true; saveHudView(); redraw(); }
    else if (e.target.closest('[data-hud-show]')) { hudView.hidden = false; saveHudView(); redraw(); }
  });
  el.addEventListener('pointerdown', (e) => {
    const grip = e.target.closest('[data-hud-drag]');
    if (!grip) return;
    e.preventDefault();
    const card = el.querySelector('.hud-card');
    const sx = e.clientX - hudView.x, sy = e.clientY - hudView.y;
    const move = (ev) => {
      const r = card.getBoundingClientRect();
      const baseX = r.left - hudView.x, baseY = r.top - hudView.y;
      hudView.x = Math.max(-baseX, Math.min(window.innerWidth - r.width - baseX, ev.clientX - sx));
      hudView.y = Math.max(-baseY, Math.min(window.innerHeight - r.height - baseY, ev.clientY - sy));
      el.querySelector('.hud-card').style.transform = `translate(${hudView.x}px, ${hudView.y}px)`;
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); saveHudView(); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
}

// `d` is the stats including gear; without it the base stats are shown
// `cave` is the cave you're standing in up top, if any
export function renderHud(el, c, d = derivedStats(c.stats, c.level), cave = null, portal = null) {
  const hp = Math.round(c.hp ?? d.hp);
  const need = expToNext(c.level, c.race);
  setHtml(el, `
    ${hudView.hidden ? `<button type="button" class="hud-show" data-hud-show aria-label="Show your status">👤 <b>${esc(c.name)}</b> <span>HP ${hp}</span></button>` : `<div class="hud-card" style="transform: translate(${hudView.x}px, ${hudView.y}px)">
      <div class="hud-tools"><span class="hud-grip" data-hud-drag title="Drag to move" aria-label="Drag to move">⠿</span><button type="button" class="hud-hide" data-hud-hide aria-label="Hide your status">‹</button></div>
      <p class="hud-name">${esc(c.name)} <span>LVL ${c.level} · ${rankFor(c.level)}</span></p>
      <p class="hud-clock">${(() => { const t = gameTime(); return `${t.night ? '🌙' : '☀️'} ${clockText(t)}${t.night ? ' · Night: stay near light' : ''}`; })()}</p>
      <div class="hud-bar hp" title="HP"><span style="width:${(hp / d.hp) * 100}%"></span><b>HP ${hp} / ${d.hp}</b></div>
      <div class="hud-bar sp" title="SP"><span style="width:${((c.sp ?? d.sp) / d.sp) * 100}%"></span><b>SP ${Math.round(c.sp ?? d.sp)} / ${d.sp}</b></div>
      <div class="hud-bar fatigue" title="Fatigue: sleep (Z) by a fire or torch before it fills"><span style="width:${Math.min(100, c.fatigue || 0)}%"></span><b>FATIGUE ${Math.round(c.fatigue || 0)} / 100</b></div>
      <div class="hud-bar hunger${(c.hunger ?? 100) < HUNGRY ? ' low' : ''}" title="Hunger: eat before it runs out. Cook meat over a fire, or buy food"><span style="width:${Math.max(0, Math.min(100, c.hunger ?? 100))}%"></span><b>HUNGER ${Math.round(c.hunger ?? 100)} / 100 · ${hungerWord(c.hunger ?? 100).toUpperCase()}</b></div>
      <div class="hud-bar exp" title="EXP"><span style="width:${Math.min(100, (c.exp / need) * 100)}%"></span><b>EXP ${c.exp} / ${need}</b></div>
      ${c.injury ? `<p class="hud-injury" title="${esc(INJURY[c.injury.part].effect)}">🩹 ${INJURY[c.injury.part].name}: treat at The Green Vial</p>` : ''}
      ${c.unspentPoints ? `<button type="button" class="hud-points" data-open="status">${c.unspentPoints} Stat Points to place</button>` : ''}
      ${portal ? `<button type="button" class="hud-points portal" data-act="portal">${esc(portal.name)}: travel (G)</button>` : ''}
      ${cave ? `<button type="button" class="hud-points" data-open="cave">${esc(cave.name)}: about this ${cave.dungeon ? 'dungeon' : 'cave'}</button>` : ''}
    </div>`}
    <div class="hud-menu">
      <button type="button" class="menu-btn" data-menu aria-label="Menu" aria-expanded="${menuOpen}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
      </button>
      <div class="hud-buttons${menuOpen ? '' : ' hidden'}">
        <button type="button" data-open="status">Status <kbd>C</kbd></button>
        <button type="button" data-open="bag">Bag <kbd>I</kbd></button>
        <button type="button" data-open="map">Map <kbd>M</kbd></button>
        <button type="button" data-open="quests">Quests <kbd>Q</kbd></button>
        ${c.secretMenu ? `<button type="button" data-open="cult">${c.secretMenu}</button>` : ''}
        <button type="button" data-open="controls">Controls${codeFor('controls') ? ` <kbd>${esc(keyName(codeFor('controls')))}</kbd>` : ''}</button>
        <button type="button" data-signout>Log out</button>
      </div>
    </div>
    </div>`);
}

// the next upgrade level that isn't an evolution
const nextUpgrade = (level) => { let l = (Math.floor(level / UPGRADE_EVERY) + 1) * UPGRADE_EVERY; while (KEY_LEVELS.includes(l)) l += UPGRADE_EVERY; return l; };

// `pending` holds Stat Points placed with the + buttons but not yet confirmed
export function renderStatus(el, c, pending = {}, d = derivedStats(c.stats, c.level), perks = {}) {
  const placed = Object.values(pending).reduce((a, b) => a + b, 0);
  const left = c.unspentPoints - placed;
  // HP, SP, ATK, MATK, DEF and MDEF grow from the main stats; points can't go into them directly
  const trained = (k, value) => value;
  const stat = (k) => `${c.stats[k]}${pending[k] ? ` <b class="sw-pending">+${pending[k]}</b>` : ''}${c.unspentPoints ? ` <button type="button" class="sw-plus" data-add="${k}" aria-label="Add a point" ${left > 0 ? '' : 'disabled'}>+</button>` : ''}`;
  const race = RACES[c.race];
  const plus = (k) => (d.bonus?.[k] ? ` <small class="sw-gear">(+${d.bonus[k]} gear)</small>` : '');
  const isMonster = race.side === 'monster';
  const className = ADVANCEMENTS[c.cls]?.[c.stage || 0] || CLASSES[c.cls]?.name || c.cls;
  const need = expToNext(c.level, c.race);
  const row = (label, value) => `<div class="sw-row"><dt>${label}:</dt><dd>${value}</dd></div>`;
  el.innerHTML = `
    <div class="status-window" role="dialog" aria-label="Status">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      ${tabsHtml('status')}
      <h2>Status</h2>
      <div class="sw-grid">
        <dl>
          ${row('Name', esc(c.name))}
          ${row('Race', `${race.name}${c.stage > 0 && EVOLUTIONS[c.race]?.[c.stage] ? ` (${esc(EVOLUTIONS[c.race][c.stage])})` : ''}${isMonster ? ` <small>(${c.form === 'humanoid' ? 'humanoid form' : 'monster form'})</small>` : ''}${isMonster ? (mayChangeForm(c) ? ` <button type="button" class="sw-form" data-form>Change to ${c.form === 'humanoid' ? 'monster' : 'humanoid'} form</button>` : ` <small>· humanoid form opens at Lv ${FORM_SWITCH_LEVEL}</small>`) : ''}`)}
          ${row('Class', className)}
          ${c.child ? row('Age', `${ageOf(c).toFixed(1)} <small>(the Ceremony at ${CEREMONY_AGE})</small>`) : row('Age', `${Math.floor(ageYears(c))} <small>(a year every 4 h of play${ageYears(c) < MARRY_AGE ? `; can marry at ${MARRY_AGE}` : ''})</small> <button type="button" class="sw-form" data-open-family>Family</button>`)}
          ${row('Lives', c.level >= UNDYING_LEVEL ? `${livesLeft(c)} <small>(undying: only another player's hand can take one)</small>` : (livesLeft(c) > LIVES ? `${livesLeft(c)}` : `${livesLeft(c)} of ${LIVES}`))}
          ${(c.child?.family || c.family) ? row('Parents', (c.child?.family || c.family).parents.map((p, j) => `${esc(p.name)} <small>(${esc(PARENT_JOBS[p.job]?.name || p.job)}${parentAlive(c, j) ? '' : ', passed away'})</small>`).join(', ')) : ''}
          ${(() => { const due = visitDue(c); return due === null ? '' : row('Visit parents', due > 0 ? `within ${Math.ceil(due / 60000)} min of play` : '<b>overdue</b>'); })()}
          ${c.neglect ? row('Soul', 'Sinner <small>(left parents unvisited)</small>') : ''}
          ${row('EXP', `${c.exp} / ${need}`)}
          ${row('Coins', money(c.coins))}
          ${(passRows(c, perks) + lifeRows(c)).replace(/<div><dt>([^<]*)<\/dt>/g, '<div class="sw-row"><dt>$1:</dt>')}
        </dl>
        <dl>
          ${row('LVL', c.level)}
          ${row('Rank', rankFor(c.level))}
          ${row('Unique', `<span class="sw-unique" title="${esc(uniqueAbility(c).text)}">${esc(c.uniqueSkill.name)}</span> <b class="u-rank u-${esc(uniqueAbility(c).rank)}">${esc(uniqueAbility(c).rank)}</b> <small>(${esc(TIER_NAMES[uniqueTier(c.level)])}${c.child && CLASSES[uniqueAbility(c).fit] ? ` · suits a ${esc(CLASSES[uniqueAbility(c).fit].name)}` : ''})</small>`)}
          ${c.uniqueSkill && !isAppraisal(c) ? (() => { const p = rankProofs(c), up = c.uniqueSkill.raised || 0; return row('Rank growth', `${up} of ${RANK_UP_MAX} climbs <small title="Each climb needs one proof: a broken seal (the 2nd and 4th), ${TRIALS_PER_PROOF} guild requests at level 150+, or ${WORK_PER_PROOF} work (merging, forging, brewing, selling, quests)">· seals ${p.seals} · trials ${(c.growth?.trials || 0)} · work ${Math.round(c.growth?.work || 0)}</small>`); })() : ''}
          ${row(isMonster ? 'Next evolution' : 'Next advancement', `??? <small>at Lv ${KEY_LEVELS.find((k) => k > c.level) ?? '—'}</small>`)}
          ${row('Next upgrade', `Lv ${nextUpgrade(c.level)} <small>(stronger, + a new skill)</small>`)}
        </dl>
      </div>
      <details class="sw-guide"><summary>Your class: what you can do and your goals</summary>${classGuide(c.cls)}</details>
      <hr>
      <div class="sw-grid">
        <dl>${row('HP', trained('hp', `${Math.round(c.hp ?? d.hp)} / ${d.hp}`))}</dl>
        <dl>${row('SP', `${Math.round(c.sp ?? d.sp)} / ${d.sp}`)}</dl>
      </div>
      <hr>
      <div class="sw-grid">
        <dl>
          ${row('Strength', stat('str'))}
          ${row('Agility', stat('agi'))}
          ${row('Dex <small>(AIM)</small>', stat('dex'))}
        </dl>
        <dl>
          ${row('Stamina', stat('sta'))}
          ${row('Intelligence', stat('int'))}
          ${row('Fatigue', `${Math.round(c.fatigue || 0)} / 100`)}
          ${row('Hunger', `${Math.round(c.hunger ?? 100)} / 100 (${hungerWord(c.hunger ?? 100)})`)}
          ${c.injury ? row('Injury', `${INJURY[c.injury.part].name} (${c.injury.left} treatment${c.injury.left > 1 ? 's' : ''} left)`) : ''}
        </dl>
      </div>
      ${placed ? `<p class="sw-confirm">Points left to place: <b>${left}</b>. Points can't be taken back once confirmed.
        <button type="button" class="gold-button small" data-confirm-points>Confirm</button>
        <button type="button" class="link-button" data-reset-points>Undo</button></p>` : ''}
      <hr>
      <div class="sw-grid">
        <dl>${row('ATK', trained('atk', d.atk + plus('atk')))}${row('DEF', trained('def', d.def + plus('def')))}</dl>
        <dl>${row('MATK', trained('matk', d.matk + plus('matk')))}${row('MDEF', trained('mdef', d.mdef + plus('mdef')))}</dl>
      </div>
      <hr>
      <dl>
        ${row('Titles', c.titles.length ? c.titles.map(esc).join(', ') : 'None yet')}
        ${row('Elements', c.elements.join(', '))}
        ${row('Skills', c.skills.length ? c.skills.map((id) => esc(SKILLS[id]?.name || id)).join(', ') : 'None yet')}
      </dl>
      <p class="sw-points">Unspent points: <b>${left}</b></p>
      <hr>
      <div class="sw-privacy" role="radiogroup" aria-label="Who can see your Status">
        <span>Who can see this Status:</span>
        ${Object.entries(PRIVACY).map(([id, p]) => `<button type="button" role="radio" data-privacy="${id}" aria-checked="${privacyOf(c) === id}" title="${esc(p.text)}">${p.name}</button>`).join('')}
        <small>${esc(PRIVACY[privacyOf(c)].text)}</small>
      </div>
      <div class="sw-privacy" role="radiogroup" aria-label="Who can invite you to a party">
        <span>Who can invite you to a party:</span>
        ${Object.entries(PARTY_INVITES).map(([id, p]) => `<button type="button" role="radio" data-party-invites="${id}" aria-checked="${partyInvitesOf(c) === id}" title="${esc(p.text)}">${p.name}</button>`).join('')}
        <small>${esc(PARTY_INVITES[partyInvitesOf(c)].text)}</small>
      </div>
    </div>`;
  fillFlags(el);
}

// The account part of Settings: the email (confirmed or not) and 2-step sign-in.
// `st` is what is going on: { msg, app: { secret, uri } while an authenticator app is being set up, code }
function accountSettings(a, st) {
  const pw = '<input name="password" type="password" autocomplete="current-password" placeholder="Your password" required>';
  const email = a.email
    ? `<p class="bag-hint">Email: <b>${esc(a.email)}</b> · ${a.emailVerified ? 'confirmed' : '<b>not confirmed yet</b>'}</p>
       ${a.emailVerified ? '' : `<form class="pw-change" data-acct="verify"><label>Code from the email <input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" required></label>
         <div class="pw-buttons"><button type="submit" class="gold-button small">Confirm</button><button type="button" class="link-button" data-acct-send>Send the email again</button></div></form>`}`
    : '<p class="bag-hint"><b>No email yet.</b> Add one below.</p>';
  const change = `<details class="acct-more"><summary>${a.email ? 'Change email' : 'Add an email'}</summary>
      <form class="pw-change" data-acct="email"><label>New email <input name="email" type="email" autocomplete="email" required></label>
      ${a.email ? `<label>Password ${pw}</label>` : ''}<div class="pw-buttons"><button type="submit" class="gold-button small">Save email</button></div></form></details>`;
  let twofa;
  if (st.app) {
    twofa = `<p class="bag-hint">1. Install an authenticator app (Google Authenticator, Microsoft Authenticator or Authy).<br>
      2. On this phone, <a href="${esc(st.app.uri)}">open it in your authenticator app</a>. On another device, choose "Enter a setup key" in the app and type this key:</p>
      <p class="totp-key">${esc(st.app.secret.replace(/(.{4})/g, '$1 ').trim())}</p>
      <form class="pw-change" data-acct="app-confirm"><label>3. Type the 6-digit code the app shows <input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" required></label>
      <div class="pw-buttons"><button type="submit" class="gold-button small">Turn it on</button><button type="button" class="link-button" data-acct-cancel>Cancel</button></div></form>`;
  } else if (a.twofa) {
    twofa = `<p class="bag-hint"><b>On</b>: signing in needs a code ${a.twofa === 'app' ? 'from your authenticator app' : 'sent to your email'} as well as the password.</p>
      <form class="pw-change" data-acct="off"><label>Password ${pw}</label><div class="pw-buttons"><button type="submit" class="gold-button small">Turn off 2-step sign-in</button></div></form>`;
  } else {
    const emailOk = a.email && a.emailVerified && a.mail;
    twofa = `<p class="bag-hint"><b>Off.</b> Turn it on so nobody can get in with only your password.</p>
      <form class="pw-change" data-acct="twofa"><label>Password ${pw}</label>
      <div class="pw-buttons">${emailOk ? '<button type="submit" class="gold-button small" name="way" value="email">Codes by email</button>' : ''}<button type="submit" class="gold-button small" name="way" value="app">Authenticator app</button></div>
      ${emailOk ? '' : `<p class="bag-hint">${a.mail ? 'Codes by email need a confirmed email.' : 'Codes by email can be used once the game can send emails.'}</p>`}</form>`;
  }
  const born = a.birthdate ? `<p class="bag-hint">Birth date: <b>${esc(birthdateWords(a.birthdate))}</b> (age ${a.age}). Only you can see it. If it is wrong, ask the game's owner.</p>` : '';
  return `${born}<h4 class="ctl-group">Email</h4>${email}${change}
    <h4 class="ctl-group">2-step sign-in</h4>${twofa}
    ${st.code ? `<p class="preview-code">Preview only, no real email is sent here. Your code is <b>${esc(st.code)}</b></p>` : ''}
    <p class="shop-msg" role="status">${esc(st.msg || '')}</p>`;
}

// Settings → Controls: a row of icons across the top, one for each kind of action; pick one to see
// its actions and their keys. Every action has a main key and a second key, and either can be left
// empty. (The icons are drawn here, simple line pictures in the game's gold.)
const CTL_ICONS = {
  move: '<path d="M13 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM10 8l-3 5 3 1 1 6M13 8l3 4 3 1M10 8h3l-1 6 4 6"/>',
  combat: '<path d="M5 19l9-9M14 10l4-6 2 2-6 4M8 14l2 2M4 20l2-2M19 19l-9-9M10 10L6 4 4 6l6 4M16 14l-2 2M20 20l-2-2"/>',
  camera: '<path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3.5"/>',
  fly: '<path d="M2 14c3-1 5-4 6-8 1 3 2 5 4 6 2-1 3-3 4-6 1 4 3 7 6 8-4 0-6 2-8 5-1-2-1-3-2-3s-1 1-2 3c-2-3-4-5-8-5z"/>',
  world: '<path d="M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V14c0 4-2 7-6 7-3 0-4-1-6-4l-2-4a1.5 1.5 0 0 1 2.5-1.5L8 14"/>',
  windows: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 8h18M7 12h6M7 16h10"/>',
  build: '<path d="M14 6l4 4-9 9H5v-4zM12 8l4 4M15 3l6 6-2 2-6-6z"/>',
  admin: '<path d="M3 18h18M4 18l-1-10 5 4 4-7 4 7 5-4-1 10"/>',
  feel: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
};
// Rows of the Controls screen that can be opened or done straight from there (it took over the old
// Menu window): a window to open, or an action to do now
const OPENS = { status: 'open:status', bag: 'open:bag', shop: 'open:shop', smith: 'open:smith', quests: 'open:quests', skills: 'open:skills',
  groups: 'open:groups', map: 'open:map', rankings: 'open:rankings', settings: 'open:settings', help: 'open:help', trade: 'open:trade',
  portal: 'act:portal', land: 'act:land', sleep: 'act:sleep', tent: 'act:tent', torch: 'act:torch', builder: 'act:builder' };
const openBtn = (id) => {
  const go = OPENS[id];
  if (!go) return '';
  const [k, v] = go.split(':');
  return `<button type="button" class="ctl-go" data-${k}="${v}" title="${k === 'open' ? 'Open it now' : 'Do it now'}">${k === 'open' ? 'Open' : 'Do'}</button>`;
};
// Controls → Sensitivity: sliders for how the camera turns and sees, and the camera and mouse choices
const FEEL = [
  ['mouse', 'Mouse look speed', 10, 400, 5, '%', 'How far the camera turns when you move the mouse (or drag with it).'],
  ['touch', 'Touch look speed', 10, 400, 5, '%', 'How far the camera turns when you drag a finger on a phone or tablet.'],
  ['turn', 'Key turn speed', 30, 300, 5, '%', 'How fast left and right turn you while walking (Follow your body camera).'],
  ['zoom', 'Zoom speed', 20, 400, 10, '%', 'How fast the mouse wheel and the Camera closer / further keys zoom.'],
  ['fov', 'Field of view', 45, 100, 1, '°', 'How wide the camera sees. Wider shows more around you; narrower looks closer.'],
];
export const FEEL_DEFAULT = { mouse: 1, touch: 1, turn: 1, zoom: 1, fov: 60, invertY: false };
export const feelShown = (k, v) => (k === 'fov' ? `${Math.round(v)}°` : `${Math.round(v * 100)}%`);
export function cameraOptions(settings) {
  const opt = (value, title, text) => `<button type="button" class="setting-opt" data-camera="${value}" aria-pressed="${settings.camera === value}"><b>${title}</b><span>${text}</span></button>`;
  return `<h3 class="bag-sub">Camera</h3>
      <div class="setting-opts">
        ${opt('free', 'Free camera', 'You turn the camera yourself (drag the mouse, or drag on the right of the screen). Your character walks the way you push, relative to the camera.')}
        ${opt('follow', 'Follow your body', 'The camera stays behind your character. Left and right turn your body, forward walks the way you face.')}
      </div>
      <h3 class="bag-sub">Mouse</h3>
      <div class="setting-opts">
        <button type="button" class="setting-opt" data-mouse="locked" aria-pressed="${settings.mouse !== 'free'}"><b>Connected</b><span>Click the game and the mouse is captured: moving it turns the camera, clicking attacks. Esc lets it go.</span></button>
        <button type="button" class="setting-opt" data-mouse="free" aria-pressed="${settings.mouse === 'free'}"><b>Free Move</b><span>The mouse stays free, so you can click the chat and windows while you walk. Drag on the game to turn the camera.</span></button>
      </div>
      <h4 class="ctl-group">Camera follows you (Free Move, and touch screens)</h4>
      <div class="setting-opts">
        <button type="button" class="setting-opt" data-cam-follow="on" aria-pressed="${settings.camFollow !== 'off'}"><b>Follows</b><span>As you walk, the camera swings round behind your character, so it looks where you are going. Drag to look around: it comes back behind you a moment after you let go.</span></button>
        <button type="button" class="setting-opt" data-cam-follow="off" aria-pressed="${settings.camFollow === 'off'}"><b>Stays put</b><span>The camera stays where you point it until you drag it round yourself.</span></button>
      </div>`;
}
function feelPanel(settings = {}) {
  const f = { ...FEEL_DEFAULT, ...(settings.feel || {}) };
  const rows = FEEL.map(([k, name, lo, hi, step, , about]) => {
    const v = k === 'fov' ? f[k] : Math.round(f[k] * 100);
    return `<label class="feel-row"><span class="ctl-name"><b>${esc(name)}</b><small>${esc(about)}</small></span>
      <input type="range" min="${lo}" max="${hi}" step="${step}" value="${v}" data-feel="${k}" aria-label="${esc(name)}"><output data-feel-out="${k}">${feelShown(k, f[k])}</output></label>`;
  }).join('');
  return `<h3 class="bag-sub">Sensitivity</h3>
    <div class="feel-table">${rows}
      <div class="feel-row"><span class="ctl-name"><b>Invert up / down</b><small>Moving the mouse or a finger up looks down, like a plane's stick.</small></span>
        <span class="feel-flip"><button type="button" class="setting-chip" data-feel-invert="off" aria-pressed="${!f.invertY}">Normal</button><button type="button" class="setting-chip" data-feel-invert="on" aria-pressed="${!!f.invertY}">Inverted</button></span></div>
    </div>
    <div class="ctl-foot"><button type="button" class="link-button" data-feel-reset>Put sensitivity back</button></div>
    ${cameraOptions(settings)}`;
}
export function renderControlsWindow(el, keys = {}) {
  el.innerHTML = `
    <div class="status-window settings-window controls-window" role="dialog" aria-label="Controls">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      <h2>Controls</h2>
      ${renderControls(keys)}
      <p class="bag-hint ctl-more"><button type="button" class="link-button" data-open="settings">Settings</button><button type="button" class="link-button" data-switch>Switch account</button></p>
    </div>`;
}
export function renderControls(keys = {}) {
  const tabs = CATEGORIES.filter(([id]) => id !== 'admin' || keys.admin);
  const tab = tabs.some(([id]) => id === keys.tab) ? keys.tab : 'move';
  const bad = clashes();
  const badTabs = new Set(Object.keys(bad).map((k) => CONTROL[k.split(':')[0]].tab));
  const tabRow = `<div class="ctl-tabs" role="tablist">${tabs.map(([id, name]) => `<button type="button" role="tab" class="ctl-tab${badTabs.has(id) ? ' clash' : ''}" data-ctl-tab="${id}" aria-selected="${id === tab}" title="${esc(name)}"><svg viewBox="0 0 24 24" aria-hidden="true">${CTL_ICONS[id]}</svg><span>${esc(name)}</span></button>`).join('')}</div>`;
  if (tab === 'feel') return `${tabRow}<div role="tabpanel">${feelPanel(keys.settings)}</div>`;
  const slot = (id, i) => {
    const code = codesFor(id)[i], waiting = keys.binding === `${id}:${i}`;
    return `<span class="ctl-slot${bad[`${id}:${i}`] ? ' clash' : ''}"><button type="button" class="sk-key${waiting ? ' waiting' : ''}${code ? '' : ' empty'}" data-control="${id}:${i}" aria-label="${i ? 'Second key' : 'Key'} for ${esc(CONTROL[id].name)}: ${esc(code ? keyName(code) : 'none')}">${waiting ? 'Press a key…' : code ? esc(keyName(code)) : 'No key'}</button>${code && !waiting ? `<button type="button" class="ctl-x" data-control-clear="${id}:${i}" aria-label="Leave it with no key" title="Leave it with no key">×</button>` : ''}</span>`;
  };
  const rows = CONTROLS.filter((c) => c[3] === tab).map(([id, name, , , about]) => `
    <div class="ctl-row"><span class="ctl-name"><b>${esc(name)}</b>${about ? `<small>${esc(about)}</small>` : ''}</span>${openBtn(id)}${slot(id, 0)}${slot(id, 1)}
      <button type="button" class="ctl-undo" data-control-default="${id}" aria-label="Back to the first key" title="Back to the first key"${isDefault(id) ? ' disabled' : ''}>↺</button></div>`).join('');
  const skills = tab === 'combat' && keys.skillBar?.length ? `<h4 class="ctl-group">Skill bar</h4><div class="ctl-table">${keys.skillBar.map((b) => `
    <div class="ctl-row"><span class="ctl-name"><b>${esc(SKILLS[b.id]?.icon || '')} ${esc(SKILLS[b.id]?.name || b.id)}</b></span><span class="ctl-slot"><button type="button" class="sk-key${b.key ? '' : ' empty'}" data-open="skills">${b.key ? esc(keyName(b.key)) : 'No key'}</button></span></div>`).join('')}</div>
    <p class="bag-hint">Skill keys are changed in the Skills window (tap a key to go there).</p>` : '';
  const c = keys.clash;
  const ask = c ? `<div class="ctl-ask" role="alertdialog" aria-label="That key is taken">
      <p><b>${esc(keyName(c.code))}</b> is already on <b>${esc(c.skill ? `your skill ${SKILLS[c.skill]?.name || c.skill}` : CONTROL[c.other].name)}</b>.</p>
      <div class="ctl-ask-btns">
        ${c.skill ? '' : `<button type="button" class="gold-button" data-clash="swap">Swap them</button>`}
        <button type="button" class="${c.skill ? 'gold-button' : 'ghost'}" data-clash="take">Take it (${c.skill ? 'the skill' : esc(CONTROL[c.other].name)} gets no key)</button>
        ${c.skill ? '' : '<button type="button" class="ghost" data-clash="both">Keep both on it</button>'}
        <button type="button" class="ghost" data-clash="cancel">Cancel</button>
      </div></div>` : '';
  return `${tabRow}
    <p class="bag-hint">Click a key, then press the key (or mouse side button) you want. × leaves it with no key, ↺ puts it back. Esc always frees the mouse and closes windows.</p>
    ${ask}
    <p class="shop-msg" role="status">${esc(keys.message || '')}${Object.keys(bad).length ? `${keys.message ? ' ' : ''}<span class="ctl-warn">Keys in red are on two actions at once.</span>` : ''}</p>
    <div class="ctl-table" role="tabpanel">${rows}</div>
    ${skills}
    <div class="ctl-foot"><button type="button" class="link-button" data-controls-reset="${tab}">Put this tab's keys back</button><button type="button" class="link-button" data-controls-reset="">Put every key back</button></div>`;
}

// Player settings, kept in this browser
export function renderSettings(el, settings, accounts = null, cloud = false, passwordMsg = '', keys = {}) {
  el.innerHTML = `
    <div class="status-window settings-window" role="dialog" aria-label="Settings">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      <h2>Settings</h2>
      <h3 class="bag-sub">Tutorial</h3>
      <div class="setting-opts">
        <button type="button" class="setting-opt" data-tutorial-replay><b>Play the tutorial again</b><span>The step-by-step guide for new players, with arrows to where to go. Skip it any time.</span></button>
      </div>
      <h3 class="bag-sub">View</h3>
      <div class="setting-opts">
        <button type="button" class="setting-opt" data-view="third" aria-pressed="${settings.view !== 'first'}"><b>Third person</b><span>The camera is behind your character, so you see yourself and what is around you.</span></button>
        <button type="button" class="setting-opt" data-view="first" aria-pressed="${settings.view === 'first'}"><b>First person</b><span>You see through your character's eyes, with your arms and weapon in front of you. Look down to see your body.</span></button>
      </div>
      <p class="bag-hint">Switch any time with ${esc(keyName(codeFor('view')))}, or scroll all the way in for first person and back out for third.</p>
      <h3 class="bag-sub">Graphics</h3>
      <div class="setting-opts">
        ${[['auto', 'Automatic', `Picks for your device (${({ low: 'Battery saver', medium: 'Balanced', high: 'Far view' })[settings.graphicsNow] || 'Balanced'} on this one), and draws a little less sharply for a while if the game starts to lag.`],
          ['low', 'Battery saver', 'For phones and tablets: shorter view, no shadows, fewer far townsfolk and details, 30 frames a second. Keeps the device cooler and smooth.'],
          ['medium', 'Balanced', 'Shadows and a medium view distance.'],
          ['high', 'Far view', 'For computers: sharp, with distant land, trees and grass drawn much further.']]
          .map(([v, title, text]) => `<button type="button" class="setting-opt" data-graphics="${v}" aria-pressed="${(settings.graphics || 'auto') === v}"><b>${title}</b><span>${esc(text)}</span></button>`).join('')}
      </div>
      <h3 class="bag-sub">Camera, mouse and sensitivity</h3>
      <p class="bag-hint">The camera, the mouse, how fast they turn, invert and field of view are in Controls → Sensitivity.</p>
      <button type="button" class="gold-button" data-open="controls" data-ctl-tab="feel">Sensitivity</button>
      <h3 class="bag-sub">Controls</h3>
      <p class="bag-hint">Put any action on any key, give it a second key, or leave it with no key. Every window can be opened from there too.</p>
      <button type="button" class="gold-button" data-open="controls" data-ctl-tab="move">Change keys</button>
      <h3 class="bag-sub">Account</h3>
      ${keys.country !== undefined ? `<label class="country-setting">Where you are from <small>(its flag is on your ID)</small><span class="country-field"><select data-country>${countryOptions(keys.country || '')}</select><span data-country-flag>${flagHtml(keys.country)}</span></span></label>` : ''}
      ${keys.account ? accountSettings(keys.account, keys.acct || {}) : ''}
      <form class="pw-change" data-password>
        <h4 class="ctl-group">Password</h4>
        <label>Current password <input name="current" type="password" autocomplete="current-password" required></label>
        <label>New password <input name="password" type="password" minlength="8" autocomplete="new-password" required></label>
        <label>Type it again <input name="confirm" type="password" minlength="8" autocomplete="new-password" required></label>
        <div class="pw-buttons"><button type="submit" class="gold-button small">Change password</button>
          <button type="button" class="link-button" data-show-pw aria-pressed="false">Show</button></div>
        <p class="bag-hint" role="status">${esc(passwordMsg)}</p>
      </form>
      <div class="pw-buttons"><button type="button" class="gold-button small" data-signout>Log out</button>
        <button type="button" class="gold-button small" data-switch>Switch account</button></div>
      ${accounts ? `<h3 class="bag-sub">Saved accounts</h3>
      <p class="bag-hint">${cloud ? 'Saved privately online, so they follow you to any device you open the game on.' : 'Kept in this browser only.'} Passwords are stored scrambled, so they can't be shown.</p>
      <ul class="device-accounts">${accounts.map((a) => `<li><b>${esc(a.username)}</b> <small>${esc(a.email)}</small><br>${a.character ? `${esc(a.character.name)} · ${esc(RACES[a.character.race]?.name || a.character.race)} ${esc(CLASSES[a.character.cls]?.name || a.character.cls)} · Lv ${a.character.level} · ${money(a.character.coins)}` : 'No character yet'}</li>`).join('') || '<li>None</li>'}</ul>` : ''}
    </div>`;
  fillFlags(el);
}

// The highest-level players. `me` is your character's name, to mark your own row.
// The Overlord's challenge: shown at once to the challenger and to the King. The King has two real
// days to answer, or the crown passes to the challenger.
export function renderChallenge(el, court, me, message = '') {
  const ch = court.challenge, title = CASTLES[court.race].title;
  const left = Math.max(0, ch.at + CHALLENGE_ANSWER_MS - Date.now());
  const time = `${Math.floor(left / 3600000)} h ${Math.floor((left % 3600000) / 60000)} min`;
  let body;
  if (ch.settled) body = ch.king === me
    ? `<p>You didn't answer <b>${esc(ch.by)}</b>'s challenge within two days. The crown of the ${esc(title)} has passed to them, and you now stand among the Overlords.</p>`
    : `<p><b>${esc(ch.king)}</b> didn't answer your challenge within two days. <b>You are now the ${esc(title)}.</b></p>`;
  else if (ch.king === me) body = `<p><b>${esc(ch.by)}</b> has grown as strong as you and challenges you for the crown of the ${esc(title)}. You must fight.</p>
    ${ch.answered ? '<p class="bag-hint">You have accepted. The duel will be fought in the throne room once players can fight each other (not in the game yet).</p>'
      : `<p class="welcome-warn">Answer within <b>${time}</b>, or the crown passes to ${esc(ch.by)} without a fight.</p>
    <button type="button" class="gold-button" data-answer-challenge="${court.race}">Accept the duel</button>`}`;
  else body = `<p>You have grown as strong as the King. Your challenge has gone to <b>${esc(ch.king)}</b>, the ${esc(title)}: the two of you must fight for the crown.</p>
    ${ch.answered ? `<p class="bag-hint">${esc(ch.king)} has accepted. The duel will be fought in the throne room once players can fight each other (not in the game yet).</p>`
      : `<p class="bag-hint">If the King doesn't answer within <b>${time}</b>, the crown is yours.</p>`}`;
  el.innerHTML = `
    <div class="status-window challenge-window" role="dialog" aria-label="A challenge for the crown">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      <h2>${ch.settled ? 'The crown has passed' : 'A challenge for the crown'}</h2>
      ${body}
      <p class="shop-msg" role="status">${esc(message)}</p>
    </div>`;
}

export function renderRankings(el, players, me, courts = []) {
  const rows = players === null ? '<p class="bag-hint">Loading…</p>'
    : players.length ? `<ol class="rankings">${players.map((p, i) => `
        <li class="${p.name === me ? 'me' : ''}"><span class="rk-place">${i + 1}</span>
          <span class="rk-name">${esc(p.name)}<small>${esc(RACES[p.race]?.name || p.race)} · ${esc(CLASSES[p.cls]?.name || p.cls)}</small></span>
          <span class="rk-level">Lv ${p.level}<small>${rankFor(p.level)}</small></span></li>`).join('')}</ol>`
      : '<p class="bag-hint">No players yet.</p>';
  el.innerHTML = `
    <div class="status-window rankings-window" role="dialog" aria-label="Top players">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      <h2>Top Players</h2>
      ${courts.length ? `<h3>The Monster Kings</h3>
      <p class="bag-hint">Each sits in a castle in the race's homeland, guarded by Overlords. A monster of the same race who beats the King takes the crown.</p>
      <ul class="crowns">${courts.map((c) => {
        const castle = castleOf(c.race);
        const empty = Date.now() - (c.slainAt || 0) < KING_RETURNS_MS;
        return `<li><b>${esc(CASTLES[c.race].title)}</b> <span>${empty ? `The throne is empty: ${esc(c.king.name)} takes it ${new Date((c.slainAt || 0) + KING_RETURNS_MS).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : `${esc(c.king.name)}${c.king.npc ? '' : ' <small>(a player)</small>'} · Lv ${c.king.level}`}</span>
          <small>${esc(castle?.castle || CASTLES[c.race].castle)} · ${c.overlords.length} Overlords</small></li>`;
      }).join('')}</ul>` : ''}
      <h3>Top players</h3>
      <p class="bag-hint">The highest-level characters right now.</p>
      ${rows}

    </div>`;
}

// What you see when you come into the realm: a short welcome and a Start button
export function renderWelcome(el, name, back = true) {
  el.innerHTML = `
    <div class="status-window welcome-window" role="dialog" aria-label="Welcome">
      <h2>${back ? 'Welcome back' : 'Welcome'}, ${esc(name)}</h2>
      <p>The realm awaits you.</p>
      <button type="button" class="gold-button" data-close>Start</button>
      <p class="welcome-warn">Be careful out there: <b>death is final</b>. If you die, you start again from nothing and choose a new race and class. Only your Unique Skill stays with you.</p>
      <p class="bag-hint">Every window is in the ☰ menu at the top of the screen, and in Controls, where every key can be changed.</p>
    </div>`;
}

export const HELP_HTML = `
  <div class="status-window help-window" role="dialog" aria-label="Key guide">
    <button type="button" class="sw-close" data-close aria-label="Close">×</button>
    <h2>Key Guide</h2>
    <p class="bag-hint">These are the keys the game starts with. Change any of them in Settings (O) → Controls.</p>
    <dl>
      <div class="sw-row"><dt>Move</dt><dd>W A S D or arrow keys. Hold W and press A or D to curve gently left or right, even while sprinting. S turns you round to face behind you. Tap W (or ↑) twice quickly to keep walking on your own; tap W or S to stop</dd></div>
      <div class="sw-row"><dt>Run</dt><dd>Hold Shift</dd></div>
      <div class="sw-row"><dt>Jump</dt><dd>Space</dd></div>
      <div class="sw-row"><dt>Camera</dt><dd>Click the game once, then move the mouse to look around and steer; scroll to zoom</dd></div>
      <div class="sw-row"><dt>Attack / punch</dt><dd>Click, or F (touch: the fist button)</dd></div>
      <div class="sw-row"><dt>Open / pick up</dt><dd>E opens a chest in front of you, picks up a torch, or packs up your tent</dd></div>
      <div class="sw-row"><dt>Trees</dt><dd>Young and dead trees, bushes: by hand. Pines: an axe and 15 STR (or 40 STR). Oaks: an axe and 22 STR (or 50). Swamp and fae trees: an axe and 28 to 32 STR. Great trees: a War Axe and 60 STR. Hitting a tree also tells you what it needs.</dd></div>
      <div class="sw-row"><dt>Esc</dt><dd>Frees the mouse and closes the window that is open. The ☰ button at the top shows every window and its key</dd></div>
      <div class="sw-row"><dt>Chat</dt><dd>Enter opens the chat even while the mouse turns the camera; send or press Esc to go back to the game</dd></div>
      <div class="sw-row"><dt>Status</dt><dd>C</dd></div>
      <div class="sw-row"><dt>Bag and shop</dt><dd>I and B</dd></div>
      <div class="sw-row"><dt>Quests</dt><dd>Q</dd></div>
      <div class="sw-row"><dt>Skills</dt><dd>K opens them. Use a skill with its key (1 to 6 at first; you can change them), or tap its button</dd></div>
      <div class="sw-row"><dt>Hunting</dt><dd>Kill a wild animal, then E beside its body: drag it to a Butcher, or cut it up (with a knife, sword, dagger or axe) and cook the meat with E by a campfire. Only halal animals give meat.</dd></div>
      <div class="sw-row"><dt>Campfires</dt><dd>Light one from Firewood in your bag. E beside it cooks raw meat; with nothing to cook, E puts your campfire out. Don't step in a lit fire: it burns you.</dd></div>
      <div class="sw-row"><dt>Animals</dt><dd>E beside a grazing animal: feed it a vegetable, hay or grain from your bag, or pet it. Farm animals belong to the farmer: feed and pet them, don't hunt them.</dd></div>
      <div class="sw-row"><dt>Growing crops</dt><dd>Buy seeds at a Farm Stand and press E by one of the farm's visitors' beds to plant them (or dig your own beds with a Hoe on land you set to Farm). They grow while you are away; a Watering Can filled at water makes them grow faster. E again when ripe to harvest.</dd></div>
      <div class="sw-row"><dt>Riding</dt><dd>Buy a horse or donkey at a Farm Stand, or tame a wild horse or camel: stand still with a carrot or apple in your bag and feed it 3 times. ${keyName(codeFor('mount'))} calls it, and ${keyName(codeFor('mount'))} (or E beside it) gets you on and off. Run to gallop.</dd></div>
      <div class="sw-row"><dt>Hunger</dt><dd>Eat before the Hunger bar runs out. Hungry: rest stops healing you. Starving: you slowly lose HP and hit softer.</dd></div>
      <div class="sw-row"><dt>Sleep</dt><dd>Z, inside your tent, by a campfire or by a torch (lowers Fatigue; fastest in a tent)</dd></div>
      <div class="sw-row"><dt>Tent</dt><dd>P pitches your tent in front of you (buy one in the shop, or craft it from 8 logs). Press P beside it to pack it up</dd></div>
      <div class="sw-row"><dt>Torches</dt><dd>T places one (buy them in the shop; they keep monsters away at night). Press T beside one to pick it back up</dd></div>
      <div class="sw-row"><dt>Caves</dt><dd>Walk into the dark shaft at the back of a cave to go down. Underground, T lights a torch in your hand. Swing at glowing veins to mine ore, break nests, beat the boss and open its chest with E, then buy the cave. The shaft of daylight takes you back up</dd></div>
      <div class="sw-row"><dt>World map</dt><dd>M</dd></div>
      <div class="sw-row"><dt>Portals</dt><dd>Stand on a portal stone (purple rings on the map) and press G. Pick where to go on the map, see the fee, then pay. Portals only reach other portals on the same continent. The Central City has two: a public one outside the south gate, and the castle's private one on Castle Hill, only for Emperors, Guild Masters on council days and an Emperor's guests on trade days</dd></div>
      <div class="sw-row"><dt>Land</dt><dd>L shows the grid of plots; tap a square to buy it or manage it</dd></div>
      <div class="sw-row"><dt>Top players</dt><dd>R</dd></div>
      <div class="sw-row"><dt>Settings</dt><dd>O (a free camera, or one that follows your body)</dd></div>
      <div class="sw-row"><dt>Swim</dt><dd>Walk into deep water</dd></div>
      <div class="sw-row"><dt>Touch</dt><dd>The stick on the left moves in any direction; drag on the right to turn the camera</dd></div>
    </dl>
  </div>`;

// What a class can do, and what to aim for
export function classGuide(cls) {
  const g = CLASS_GUIDE[cls];
  if (!g) return '';
  return `<div class="class-guide"><div><h4>What you can do</h4><ul>${g.can.map((t) => `<li>${t}</li>`).join('')}</ul></div>
    <div><h4>Your goals</h4><ul>${g.goals.map((t) => `<li>${t}</li>`).join('')}</ul></div></div>`;
}
