// The in-game HUD and the Status Window (laid out like Mohammed's black-and-gold design).
import { CASTLES, castleOf, KING_RETURNS_MS, CHALLENGE_ANSWER_MS } from './data/kings.mjs';
import { CONTROLS, codeFor, keyName } from './data/controls.mjs';
import {
  RACES, CLASSES, CLASS_GUIDE, ADVANCEMENTS, EVOLUTIONS, KEY_LEVELS, derivedStats, expToNext, rankFor, mayChangeForm, FORM_SWITCH_LEVEL,
} from './data/game-data.mjs';
import { tabsHtml } from './bag.js';
import { lifeRows } from './idcard.js';
import { uniqueAbility, uniqueTier, TIER_NAMES } from './data/unique.mjs';
import { ageOf, CEREMONY_AGE, PARENT_JOBS } from './data/birth.mjs';
import { PRIVACY, privacyOf } from './data/social.mjs';
import { gameTime, clockText } from './data/clock.mjs';
import { SKILLS, UPGRADE_EVERY } from './data/skills.mjs';
import { money } from './data/money.mjs';

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
  el.innerHTML = `
    ${hudView.hidden ? `<button type="button" class="hud-show" data-hud-show aria-label="Show your status">👤 <b>${esc(c.name)}</b> <span>HP ${hp}</span></button>` : `<div class="hud-card" style="transform: translate(${hudView.x}px, ${hudView.y}px)">
      <div class="hud-tools"><span class="hud-grip" data-hud-drag title="Drag to move" aria-label="Drag to move">⠿</span><button type="button" class="hud-hide" data-hud-hide aria-label="Hide your status">‹</button></div>
      <p class="hud-name">${esc(c.name)} <span>LVL ${c.level} · ${rankFor(c.level)}</span></p>
      <p class="hud-clock">${(() => { const t = gameTime(); return `${t.night ? '🌙' : '☀️'} ${clockText(t)}${t.night ? ' · Night: stay near light' : ''}`; })()}</p>
      <div class="hud-bar hp" title="HP"><span style="width:${(hp / d.hp) * 100}%"></span><b>HP ${hp} / ${d.hp}</b></div>
      <div class="hud-bar sp" title="SP"><span style="width:${((c.sp ?? d.sp) / d.sp) * 100}%"></span><b>SP ${Math.round(c.sp ?? d.sp)} / ${d.sp}</b></div>
      <div class="hud-bar fatigue" title="Fatigue: sleep (Z) by a fire or torch before it fills"><span style="width:${Math.min(100, c.fatigue || 0)}%"></span><b>FATIGUE ${Math.round(c.fatigue || 0)} / 100</b></div>
      <div class="hud-bar exp" title="EXP"><span style="width:${Math.min(100, (c.exp / need) * 100)}%"></span><b>EXP ${c.exp} / ${need}</b></div>
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
        <button type="button" data-open="options">Controls <kbd>Esc</kbd></button>
        <button type="button" data-signout>Log out</button>
      </div>
    </div>
    </div>`;
}

// the next upgrade level that isn't an evolution
const nextUpgrade = (level) => { let l = (Math.floor(level / UPGRADE_EVERY) + 1) * UPGRADE_EVERY; while (KEY_LEVELS.includes(l)) l += UPGRADE_EVERY; return l; };

// `pending` holds Stat Points placed with the + buttons but not yet confirmed
export function renderStatus(el, c, pending = {}, d = derivedStats(c.stats, c.level)) {
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
          ${c.child ? row('Age', `${ageOf(c).toFixed(1)} <small>(the Ceremony at ${CEREMONY_AGE})</small>`) : ''}
          ${(c.child?.family || c.family) ? row('Parents', (c.child?.family || c.family).parents.map((p) => `${esc(p.name)} <small>(${esc(PARENT_JOBS[p.job]?.name || p.job)})</small>`).join(', ')) : ''}
          ${row('EXP', `${c.exp} / ${need}`)}
          ${row('Coins', money(c.coins))}
          ${lifeRows(c).replace(/<div><dt>([^<]*)<\/dt>/g, '<div class="sw-row"><dt>$1:</dt>')}
        </dl>
        <dl>
          ${row('LVL', c.level)}
          ${row('Rank', rankFor(c.level))}
          ${row('Unique', `<span class="sw-unique" title="${esc(uniqueAbility(c).text)}">${esc(c.uniqueSkill.name)}</span> <b class="u-rank u-${esc(uniqueAbility(c).rank)}">${esc(uniqueAbility(c).rank)}</b> <small>(${esc(TIER_NAMES[uniqueTier(c.level)])}${c.child && CLASSES[uniqueAbility(c).fit] ? ` · suits a ${esc(CLASSES[uniqueAbility(c).fit].name)}` : ''})</small>`)}
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
          ${row('Dex', stat('dex'))}
        </dl>
        <dl>
          ${row('Stamina', stat('sta'))}
          ${row('Intelligence', stat('int'))}
          ${row('Fatigue', `${Math.round(c.fatigue || 0)} / 100`)}
        </dl>
      </div>
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
      <p class="sw-points">Unspent points: <b>${left}</b>${c.unspentPoints ? ' <small>Put points into Strength, Agility, Dex, Stamina or Intelligence. HP, SP, ATK, MATK, DEF and MDEF grow with them.</small>' : ''}</p>
      <hr>
      <div class="sw-privacy" role="radiogroup" aria-label="Who can see your Status">
        <span>Who can see this Status:</span>
        ${Object.entries(PRIVACY).map(([id, p]) => `<button type="button" role="radio" data-privacy="${id}" aria-checked="${privacyOf(c) === id}" title="${esc(p.text)}">${p.name}</button>`).join('')}
        <small>${esc(PRIVACY[privacyOf(c)].text)}</small>
      </div>
      ${placed ? `<p class="sw-confirm">Points can't be taken back once confirmed.
        <button type="button" class="gold-button small" data-confirm-points>Confirm</button>
        <button type="button" class="link-button" data-reset-points>Undo</button></p>` : ''}
    </div>`;
}

// Player settings, kept in this browser
export function renderSettings(el, settings, accounts = null, cloud = false, passwordMsg = '', keys = {}) {
  const groups = [...new Set(CONTROLS.map((x) => x[3]))];
  const controls = groups.map((g) => `<h4 class="ctl-group">${g}</h4><div class="ctl-list">${CONTROLS.filter((x) => x[3] === g).map(([id, name]) => `
    <div class="ctl-row"><span>${esc(name)}</span><button type="button" class="sk-key${keys.binding === id ? ' waiting' : ''}" data-control="${id}" aria-label="Change the key for ${esc(name)}">${keys.binding === id ? 'Press a key…' : esc(keyName(codeFor(id)))}</button></div>`).join('')}</div>`).join('');
  const opt = (value, title, text) => `<button type="button" class="setting-opt" data-camera="${value}" aria-pressed="${settings.camera === value}"><b>${title}</b><span>${text}</span></button>`;
  el.innerHTML = `
    <div class="status-window settings-window" role="dialog" aria-label="Settings">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      <h2>Settings</h2>
      <h3 class="bag-sub">Camera</h3>
      <div class="setting-opts">
        ${opt('free', 'Free camera', 'You turn the camera yourself (drag the mouse, or drag on the right of the screen). Your character walks the way you push, relative to the camera.')}
        ${opt('follow', 'Follow your body', 'The camera stays behind your character. Left and right turn your body, forward walks the way you face.')}
      </div>
      <h3 class="bag-sub">Mouse</h3>
      <div class="setting-opts">
        <button type="button" class="setting-opt" data-mouse="locked" aria-pressed="${settings.mouse !== 'free'}"><b>Connected</b><span>Click the game and the mouse is captured: moving it turns the camera, clicking attacks. Esc lets it go.</span></button>
        <button type="button" class="setting-opt" data-mouse="free" aria-pressed="${settings.mouse === 'free'}"><b>Free Move</b><span>The mouse stays free, so you can click the chat and windows while you walk. Drag on the game to turn the camera.</span></button>
      </div>
      <h3 class="bag-sub">Controls</h3>
      <p class="bag-hint">Click an action, then press the key you want for it. If another action had that key, they swap. The arrow keys always move you and Esc always opens the options.</p>
      <p class="shop-msg" role="status">${esc(keys.message || '')}</p>
      ${controls}
      <button type="button" class="link-button" data-controls-reset>Put every key back to how it started</button>
      <h3 class="bag-sub">Account</h3>
      <form class="pw-change" data-password>
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

// Every window and action in the game, with the key that opens it; tap one to open it now
const OPTIONS = [
  ['Status', 'status', 'status', 'Your level, stats and Stat Points'],
  ['Bag', 'bag', 'bag', 'Your items, and what you have on'],
  ['Shop', 'shop', 'shop', 'Buy and sell'],
  ['Quests', 'quests', 'quests', 'Take on quests and claim rewards'],
  ['Skills', 'skills', 'skills', 'Your skills and their keys'],
  ['World map', 'map', 'map', 'Where you are, your land and caves'],
  ['Portals', 'portal', 'act:portal', 'Travel to another portal on this continent (beside a portal stone)'],
  ['Land', 'land', 'act:land', 'Show the grid of plots to buy land'],
  ['Builder View', 'builder', 'act:builder', 'Build on the land you own'],
  ['Sleep / wake', 'sleep', 'act:sleep', 'By a fire, a torch or in your tent'],
  ['Pitch / pack tent', 'tent', 'act:tent', 'Pitch your tent in front of you'],
  ['Torch', 'torch', 'act:torch', 'Place a torch, or pick one back up'],
  ['Top players', 'rankings', 'rankings', 'The highest-level characters'],
  ['Settings', 'settings', 'settings', 'Camera, keys, password and accounts'],
  ['Key guide', 'help', 'help', 'How to move, fight and more'],
];
export function renderOptions(el) {
  el.innerHTML = `
    <div class="status-window options-window" role="dialog" aria-label="Controls">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      <h2>Controls</h2>
      <p class="bag-hint">Press a key to open a window from anywhere, or tap it here. You can change any key in Settings.</p>
      <div class="options-grid">
        ${OPTIONS.map(([label, action, go, what]) => `<button type="button" class="option-btn" ${go.startsWith('act:') ? `data-act="${go.slice(4)}"` : `data-open="${go}"`}><kbd>${esc(keyName(codeFor(action)))}</kbd><b>${label}</b><small>${what}</small></button>`).join('')}
        <button type="button" class="option-btn" data-switch><kbd>&nbsp;</kbd><b>Switch account</b><small>Sign in as someone else</small></button>
      </div>
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
      <p class="bag-hint">All the controls are under <b>Controls</b> in the ☰ menu at the top of the screen (or press Esc).</p>
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
      <div class="sw-row"><dt>Controls</dt><dd>Esc shows every window and its key (also frees the mouse)</dd></div>
      <div class="sw-row"><dt>Status</dt><dd>C</dd></div>
      <div class="sw-row"><dt>Bag and shop</dt><dd>I and B</dd></div>
      <div class="sw-row"><dt>Quests</dt><dd>Q</dd></div>
      <div class="sw-row"><dt>Skills</dt><dd>K opens them. Use a skill with its key (1 to 6 at first; you can change them), or tap its button</dd></div>
      <div class="sw-row"><dt>Sleep</dt><dd>Z, inside your tent, by a campfire or by a torch (lowers Fatigue; fastest in a tent)</dd></div>
      <div class="sw-row"><dt>Tent</dt><dd>P pitches your tent in front of you (buy one in the shop, or craft it from 8 logs). Press P beside it to pack it up</dd></div>
      <div class="sw-row"><dt>Torches</dt><dd>T places one (buy them in the shop; they keep monsters away at night). Press T beside one to pick it back up</dd></div>
      <div class="sw-row"><dt>Caves</dt><dd>Walk into the dark shaft at the back of a cave to go down. Underground, T lights a torch in your hand. Swing at glowing veins to mine ore, break nests, beat the boss and open its chest with E, then buy the cave. The shaft of daylight takes you back up</dd></div>
      <div class="sw-row"><dt>World map</dt><dd>M</dd></div>
      <div class="sw-row"><dt>Portals</dt><dd>Stand on a portal stone (purple rings on the map) and press G. Pick where to go on the map, see the fee, then pay. Portals only reach other portals on the same continent</dd></div>
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
