// The Academy, where children train at the school of their choice, and the Ceremony of Revealing
// at 7, which tells them their class.
import { SCHOOLS, TRAIN_FULL_MS, CEREMONY_AGE, ACADEMY_NAME, PARENT_JOBS } from './data/birth.mjs';
import { CLASSES } from './data/game-data.mjs';
import { uniqueAbility } from './data/unique.mjs';
import { classGuide } from './status.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const pct = (p) => (p >= 0.995 ? '99' : p < 0.01 ? '<1' : String(Math.round(p * 100)));

export function renderAcademy(el, game, { message = '' } = {}) {
  const c = game.character;
  let body;
  if (!c.child) {
    body = '<p class="bag-hint">The Academy is for children. You have had your Ceremony.</p>';
  } else {
    const odds = game.classOdds();
    const u = uniqueAbility(c);
    const age = game.age();
    const parents = c.child.family?.parents || [];
    body = `
      <p class="bag-hint">Choose a school and stay at the Academy to train in it. The more you train, the likelier you are to become that class at your Ceremony (age ${CEREMONY_AGE}; you are ${age.toFixed(1)}). It is never certain: your parents' work counts too, and so does luck.</p>
      <p class="bag-hint">Your parents: ${parents.map((p) => `${esc(p.name)} (${esc(PARENT_JOBS[p.job]?.name || p.job)})`).join(' and ')}. Your Unique Skill, <b>${esc(u.name)}</b>, suits a <b>${esc(CLASSES[u.fit]?.name || 'anyone')}</b>.</p>
      <div class="school-list">${Object.entries(SCHOOLS).map(([cls, s]) => {
        const done = Math.min(1, (c.child.train?.[cls] || 0) / TRAIN_FULL_MS);
        const on = c.child.school === cls;
        return `<div class="sk-row school-row${on ? ' on' : ''}"><span class="sk-icon">${s.icon}</span>
          <span class="sk-name"><b>${esc(s.name)}</b><small>${esc(CLASSES[cls].name)} · ${esc(s.text)} · trained ${Math.round(done * 100)}% · chance ${pct(odds[cls])}%</small></span>
          ${on ? '<span class="school-here">Training here</span>' : `<button type="button" class="gold-button small" data-school="${cls}">Train here</button>`}</div>`;
      }).join('')}</div>`;
  }
  el.innerHTML = `
    <div class="status-window skills-window" role="dialog" aria-label="${ACADEMY_NAME}">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      <h2>${ACADEMY_NAME}</h2>
      <p class="shop-msg" role="status">${esc(message)}</p>
      ${body}
    </div>`;
}

// `result` is the grown-up character after the Ceremony (null before it)
export function renderCeremony(el, game, { result = null, busy = false, message = '' } = {}) {
  const c = game.character;
  const body = result
    ? `<p class="blurb">The elder lays a hand on your head, and the crystal lights up. You are a <b>${esc(CLASSES[result.cls].name)}</b>.</p>
       ${classGuide(result.cls)}
       <button type="button" class="gold-button" data-close>Begin your journey</button>`
    : `<p class="blurb">You are ${CEREMONY_AGE}. The townsfolk gather at the Academy for your Ceremony of Revealing, where the crystal shows what you will become.</p>
       ${c.child?.school ? `<p class="bag-hint">You trained at the ${esc(SCHOOLS[c.child.school].name)}.</p>` : '<p class="bag-hint">You never chose a school. Your parents\' work and luck will decide.</p>'}
       <button type="button" class="gold-button" data-ceremony ${busy ? 'disabled' : ''}>Step forward</button>`;
  el.innerHTML = `
    <div class="status-window welcome-window" role="dialog" aria-label="The Ceremony of Revealing">
      <h2>The Ceremony of Revealing</h2>
      <p class="shop-msg" role="status">${esc(message)}</p>
      ${body}
    </div>`;
}
