// The Academies (one for each class), where children register and train, and the Ceremony of Revealing
// at 7, which tells them their class.
import { SCHOOLS, TRAIN_FULL_MS, CEREMONY_AGE, ACADEMY_NAME, PARENT_JOBS, CHILD_MAX_LEVEL, SCHOOL_TECHNIQUES, TECHNIQUE_AT } from './data/birth.mjs';
import { SKILLS } from './data/skills.mjs';
import { CLASSES } from './data/game-data.mjs';
import { uniqueAbility } from './data/unique.mjs';
import { classGuide } from './status.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const pct = (p) => (p >= 0.995 ? '99' : p < 0.01 ? '<1' : String(Math.round(p * 100)));

// `school`: the Academy you are in (its counter). A child registers here, then trains on its mat.
export function renderAcademy(el, game, { school = null, message = '' } = {}) {
  const c = game.character;
  const S = SCHOOLS[school];
  const title = S ? S.academy : ACADEMY_NAME;
  let body;
  if (!c.child) {
    body = '<p class="bag-hint">The Academies are for children. You have had your Ceremony.</p>';
  } else if (!S) {
    body = '<p class="bag-hint">Each class has its own Academy on Academy Street. Go in, register at the counter, and train inside.</p>';
  } else {
    const odds = game.classOdds();
    const u = uniqueAbility(c);
    const age = game.age();
    const parents = c.child.family?.parents || [];
    const done = Math.min(1, (c.child.train?.[school] || 0) / TRAIN_FULL_MS);
    const mine = c.child.school === school;
    const other = c.child.school && !mine ? SCHOOLS[c.child.school] : null;
    body = `
      <p class="bag-hint">${S.icon} ${esc(S.text)} This Academy trains future <b>${esc(CLASSES[school].name)}s</b>. Register here, then train inside on the red mat beside the teacher. Training raises your level (up to ${CHILD_MAX_LEVEL} before the Ceremony) and teaches you the Academy's two techniques, which you keep for life. The more you train, the likelier you are to become a ${esc(CLASSES[school].name)} at your Ceremony (age ${CEREMONY_AGE}; you are ${age.toFixed(1)}). It is never certain: your parents' work counts too, and so does luck.</p>
      <div class="sk-row school-row${mine ? ' on' : ''}"><span class="sk-icon">${S.icon}</span>
        <span class="sk-name"><b>${esc(S.academy)}</b><small>trained ${Math.round(done * 100)}% · chance ${pct(odds[school])}% · teaches ${SCHOOL_TECHNIQUES[school].map((id, i) => `${esc(SKILLS[id].name)}${c.techniques?.includes(id) ? ' ✓' : ` (at ${Math.round(TECHNIQUE_AT[i] * 100)}%)`}`).join(', ')}</small></span>
        ${mine ? '<span class="school-here">Registered</span>' : `<button type="button" class="gold-button small" data-school="${school}">Register here</button>`}</div>
      ${other ? `<p class="bag-hint">You are registered at the ${esc(other.academy)}. Registering here moves you; the training you did there is kept.</p>` : ''}
      <p class="bag-hint">Your parents: ${parents.map((p) => `${esc(p.name)} (${esc(PARENT_JOBS[p.job]?.name || p.job)})`).join(' and ')}. Your Unique Skill, <b>${esc(u.name)}</b>, suits a <b>${esc(CLASSES[u.fit]?.name || 'anyone')}</b>.</p>`;
  }
  el.innerHTML = `
    <div class="status-window skills-window" role="dialog" aria-label="${esc(title)}">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      <h2>${esc(title)}</h2>
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
    : `<p class="blurb">You are ${CEREMONY_AGE}. The townsfolk gather round the shrine in the middle of the city for your Ceremony of Revealing, where the crystal shows what you will become. Your new card will shine in the sky over the city for all to see.</p>
       ${c.child?.school ? `<p class="bag-hint">You trained at the ${esc(SCHOOLS[c.child.school].name)}.</p>` : '<p class="bag-hint">You never chose a school. Your parents\' work and luck will decide.</p>'}
       <button type="button" class="gold-button" data-ceremony ${busy ? 'disabled' : ''}>Step forward</button>`;
  el.innerHTML = `
    <div class="status-window welcome-window" role="dialog" aria-label="The Ceremony of Revealing">
      <h2>The Ceremony of Revealing</h2>
      <p class="shop-msg" role="status">${esc(message)}</p>
      ${body}
    </div>`;
}
