// The in-game HUD and the Status Window (laid out like Mohammed's black-and-gold design).
import {
  RACES, CLASSES, ADVANCEMENTS, derivedStats, expToNext, rankFor,
} from './data/game-data.mjs';
import { tabsHtml } from './bag.js';
import { gameTime, clockText } from './data/clock.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The ☰ menu in the top right; the letter keys open the same windows directly
let menuOpen = false;
export const toggleMenu = (open = !menuOpen) => { menuOpen = open; };

// `d` is the stats including gear; without it the base stats are shown
export function renderHud(el, c, d = derivedStats(c.stats, c.level)) {
  const hp = Math.round(c.hp ?? d.hp);
  const need = expToNext(c.level, c.race);
  el.innerHTML = `
    <div class="hud-card">
      <p class="hud-name">${esc(c.name)} <span>LVL ${c.level} · ${rankFor(c.level)}</span></p>
      <p class="hud-clock">${(() => { const t = gameTime(); return `${t.night ? '🌙' : '☀️'} ${clockText(t)}${t.night ? ' · Night: stay near light' : ''}`; })()}</p>
      <div class="hud-bar hp" title="HP"><span style="width:${(hp / d.hp) * 100}%"></span><b>HP ${hp} / ${d.hp}</b></div>
      <div class="hud-bar sp" title="SP"><span style="width:${((c.sp ?? d.sp) / d.sp) * 100}%"></span><b>SP ${Math.round(c.sp ?? d.sp)} / ${d.sp}</b></div>
      <div class="hud-bar fatigue" title="Fatigue: sleep (Z) by a fire or torch before it fills"><span style="width:${Math.min(100, c.fatigue || 0)}%"></span><b>FATIGUE ${Math.round(c.fatigue || 0)} / 100</b></div>
      <div class="hud-bar exp" title="EXP"><span style="width:${Math.min(100, (c.exp / need) * 100)}%"></span><b>EXP ${c.exp} / ${need}</b></div>
      ${c.unspentPoints ? `<button type="button" class="hud-points" data-open="status">${c.unspentPoints} Stat Points to place</button>` : ''}
    </div>
    <div class="hud-menu">
      <button type="button" class="menu-btn" data-menu aria-label="Menu" aria-expanded="${menuOpen}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
      </button>
      <div class="hud-buttons${menuOpen ? '' : ' hidden'}">
        <button type="button" data-open="status">Status <kbd>C</kbd></button>
        <button type="button" data-open="bag">Bag <kbd>I</kbd></button>
        <button type="button" data-open="shop">Shop <kbd>B</kbd></button>
        <button type="button" data-open="quests">Quests <kbd>Q</kbd></button>
        <button type="button" data-open="map">Map <kbd>M</kbd></button>
        <button type="button" data-open="land">Buy land <kbd>L</kbd></button>
        <button type="button" data-open="help">Controls <kbd>H</kbd></button>
        <button type="button" data-open="settings">Settings <kbd>O</kbd></button>
      </div>
    </div>
    </div>`;
}

// `pending` holds Stat Points placed with the + buttons but not yet confirmed
export function renderStatus(el, c, pending = {}, d = derivedStats(c.stats, c.level)) {
  const placed = Object.values(pending).reduce((a, b) => a + b, 0);
  const left = c.unspentPoints - placed;
  const stat = (k) => `${c.stats[k]}${pending[k] ? ` <b class="sw-pending">+${pending[k]}</b>` : ''}${c.unspentPoints ? ` <button type="button" class="sw-plus" data-add="${k}" aria-label="Add a point" ${left > 0 ? '' : 'disabled'}>+</button>` : ''}`;
  const race = RACES[c.race];
  const plus = (k) => (d.bonus?.[k] ? ` <small class="sw-gear">(+${d.bonus[k]} gear)</small>` : '');
  const isMonster = race.side === 'monster';
  const className = ADVANCEMENTS[c.cls][c.stage || 0] || CLASSES[c.cls].name;
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
          ${row('Race', `${race.name}${isMonster ? ` <small>(${c.form === 'humanoid' ? 'humanoid form' : 'monster form'})</small>` : ''}`)}
          ${row('Class', className)}
          ${row('EXP', `${c.exp} / ${need}`)}
          ${row('Coins', c.coins)}
        </dl>
        <dl>
          ${row('LVL', c.level)}
          ${row('Rank', rankFor(c.level))}
          ${row('Unique', `<span class="sw-unique" title="${esc(c.uniqueSkill.text)} Sealed: ${esc(c.uniqueSkill.sealed)}">${esc(c.uniqueSkill.name)}</span> <small>(${5 - c.uniqueSkill.sealsOpen} seals)</small>`)}
          ${isMonster ? row('Next evolution', '???') : row('Next advancement', '???')}
        </dl>
      </div>
      <hr>
      <div class="sw-grid">
        <dl>${row('HP', `${Math.round(c.hp ?? d.hp)} / ${d.hp}`)}</dl>
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
        <dl>${row('ATK', d.atk + plus('atk'))}${row('DEF', d.def + plus('def'))}</dl>
        <dl>${row('MATK', d.matk + plus('matk'))}${row('MDEF', d.mdef + plus('mdef'))}</dl>
      </div>
      <hr>
      <dl>
        ${row('Titles', c.titles.length ? c.titles.map(esc).join(', ') : 'None yet')}
        ${row('Elements', c.elements.join(', '))}
        ${row('Skills', c.skills.length ? c.skills.map(esc).join(', ') : 'None yet')}
      </dl>
      <p class="sw-points">Unspent points: <b>${left}</b></p>
      ${placed ? `<p class="sw-confirm">Points can't be taken back once confirmed.
        <button type="button" class="gold-button small" data-confirm-points>Confirm</button>
        <button type="button" class="link-button" data-reset-points>Undo</button></p>` : ''}
    </div>`;
}

// Player settings, kept in this browser
export function renderSettings(el, settings) {
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
      <h3 class="bag-sub">Account</h3>
      <p class="bag-hint">This browser keeps you signed in. Sign out on shared computers.</p>
      <button type="button" class="link-button" data-signout>Sign out</button>
    </div>`;
}

export const HELP_HTML = `
  <div class="status-window help-window" role="dialog" aria-label="Controls">
    <button type="button" class="sw-close" data-close aria-label="Close">×</button>
    <h2>Controls</h2>
    <dl>
      <div class="sw-row"><dt>Move</dt><dd>W A S D or arrow keys, in any direction (W + D goes forward-right)</dd></div>
      <div class="sw-row"><dt>Run</dt><dd>Hold Shift</dd></div>
      <div class="sw-row"><dt>Jump</dt><dd>Space</dd></div>
      <div class="sw-row"><dt>Camera</dt><dd>Drag with the mouse, scroll to zoom</dd></div>
      <div class="sw-row"><dt>Attack / punch</dt><dd>Click, or F (touch: the fist button)</dd></div>
      <div class="sw-row"><dt>Status</dt><dd>C</dd></div>
      <div class="sw-row"><dt>Bag and shop</dt><dd>I and B</dd></div>
      <div class="sw-row"><dt>Quests</dt><dd>Q</dd></div>
      <div class="sw-row"><dt>Sleep</dt><dd>Z, by a campfire or a torch (lowers Fatigue)</dd></div>
      <div class="sw-row"><dt>Place a torch</dt><dd>T (buy torches in the shop; they keep monsters away at night)</dd></div>
      <div class="sw-row"><dt>World map</dt><dd>M</dd></div>
      <div class="sw-row"><dt>Land</dt><dd>L shows the grid of plots; tap a square to buy it or manage it</dd></div>
      <div class="sw-row"><dt>Settings</dt><dd>O (a free camera, or one that follows your body)</dd></div>
      <div class="sw-row"><dt>Swim</dt><dd>Walk into deep water</dd></div>
      <div class="sw-row"><dt>Touch</dt><dd>The stick on the left moves in any direction; drag on the right to turn the camera</dd></div>
    </dl>
  </div>`;
