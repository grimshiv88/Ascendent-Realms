// The in-game HUD and the Status Window (laid out like Mohammed's black-and-gold design).
import {
  RACES, CLASSES, ADVANCEMENTS, derivedStats, expToNext, rankFor,
} from './data/game-data.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderHud(el, c) {
  const d = derivedStats(c.stats, c.level);
  el.innerHTML = `
    <div class="hud-card">
      <p class="hud-name">${esc(c.name)} <span>LVL ${c.level} · ${rankFor(c.level)}</span></p>
      <div class="hud-bar hp" title="HP"><span style="width:100%"></span><b>HP ${d.hp} / ${d.hp}</b></div>
      <div class="hud-bar sp" title="SP"><span style="width:100%"></span><b>SP ${d.sp} / ${d.sp}</b></div>
      <div class="hud-bar fatigue" title="Fatigue"><span style="width:${c.fatigue}%"></span><b>Fatigue ${c.fatigue}</b></div>
    </div>
    <div class="hud-buttons">
      <button type="button" data-open="status">Status <kbd>C</kbd></button>
      <button type="button" data-open="help">Controls <kbd>H</kbd></button>
    </div>`;
}

export function renderStatus(el, c) {
  const d = derivedStats(c.stats, c.level);
  const race = RACES[c.race];
  const isMonster = race.side === 'monster';
  const className = ADVANCEMENTS[c.cls][c.stage || 0] || CLASSES[c.cls].name;
  const need = expToNext(c.level, c.race);
  const row = (label, value) => `<div class="sw-row"><dt>${label}:</dt><dd>${value}</dd></div>`;
  el.innerHTML = `
    <div class="status-window" role="dialog" aria-label="Status">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
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
        <dl>${row('HP', `${d.hp} / ${d.hp}`)}</dl>
        <dl>${row('SP', `${d.sp} / ${d.sp}`)}</dl>
      </div>
      <hr>
      <div class="sw-grid">
        <dl>
          ${row('Strength', c.stats.str)}
          ${row('Agility', c.stats.agi)}
          ${row('Dex', c.stats.dex)}
        </dl>
        <dl>
          ${row('Stamina', c.stats.sta)}
          ${row('Intelligence', c.stats.int)}
          ${row('Fatigue', `${c.fatigue} / 100`)}
        </dl>
      </div>
      <hr>
      <div class="sw-grid">
        <dl>${row('ATK', d.atk)}${row('DEF', d.def)}</dl>
        <dl>${row('MATK', d.matk)}${row('MDEF', d.mdef)}</dl>
      </div>
      <hr>
      <dl>
        ${row('Titles', c.titles.length ? c.titles.map(esc).join(', ') : 'None yet')}
        ${row('Elements', c.elements.join(', '))}
        ${row('Skills', c.skills.length ? c.skills.map(esc).join(', ') : 'None yet')}
      </dl>
      <p class="sw-points">Unspent points: <b>${c.unspentPoints}</b></p>
    </div>`;
}

export const HELP_HTML = `
  <div class="status-window help-window" role="dialog" aria-label="Controls">
    <button type="button" class="sw-close" data-close aria-label="Close">×</button>
    <h2>Controls</h2>
    <dl>
      <div class="sw-row"><dt>Move</dt><dd>W A S D or arrow keys</dd></div>
      <div class="sw-row"><dt>Run</dt><dd>Hold Shift</dd></div>
      <div class="sw-row"><dt>Jump</dt><dd>Space</dd></div>
      <div class="sw-row"><dt>Camera</dt><dd>Drag with the mouse, scroll to zoom</dd></div>
      <div class="sw-row"><dt>Status</dt><dd>C</dd></div>
      <div class="sw-row"><dt>Touch</dt><dd>Left side moves, right side turns the camera</dd></div>
    </dl>
  </div>`;
