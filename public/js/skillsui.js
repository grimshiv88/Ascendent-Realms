// The Skills window (K): put your skills on keys, keep spare ones in storage.
// Also the skill bar at the bottom of the screen, which works by key on desktop and by tap on touch.
import { SKILLS, SKILL_BAR, keyLabel } from './data/skills.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const what = (sk) => `${esc(sk.text)} <span class="sk-cost">${sk.sp} SP · ${sk.cd}s rest</span>`;

// `binding` is the skill waiting for a key press; `message` is shown at the top
export function renderSkills(el, game, { binding = null, message = '' } = {}) {
  const c = game.character;
  const stored = c.skills.filter((id) => !c.skillBar.some((b) => b.id === id));
  const bar = c.skillBar.length ? c.skillBar.map((b) => { const sk = SKILLS[b.id]; return `
    <div class="sk-row"><span class="sk-icon">${sk.icon}</span><span class="sk-name"><b>${esc(sk.name)}</b><small>${what(sk)}</small></span>
      <button type="button" class="sk-key${binding === b.id ? ' waiting' : ''}" data-bind="${b.id}" title="Change the key">${binding === b.id ? 'Press a key…' : b.key ? `Key ${esc(keyLabel(b.key))}` : 'Set a key'}</button>
      <button type="button" class="link-button" data-store="${b.id}">Store</button></div>`; }).join('')
    : '<p class="bag-hint">No skills ready yet. Your first comes at level 10.</p>';
  const kept = stored.length ? stored.map((id) => { const sk = SKILLS[id]; return `
    <div class="sk-row"><span class="sk-icon">${sk.icon}</span><span class="sk-name"><b>${esc(sk.name)}</b><small>${what(sk)}</small></span>
      <button type="button" class="gold-button small" data-ready="${id}" ${c.skillBar.length >= SKILL_BAR ? 'disabled title="Store a ready skill first"' : ''}>Get ready</button></div>`; }).join('')
    : '<p class="bag-hint">Skills you aren\'t using wait here. Nothing stored.</p>';
  el.innerHTML = `
    <div class="status-window skills-window" role="dialog" aria-label="Skills">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      <h2>Skills</h2>
      <p class="bag-hint">Every 10 levels you grow a little stronger and learn a new skill, given at random. Up to ${SKILL_BAR} are ready at once, each on a key of your choice; on a phone or iPad they are buttons above the attack button.</p>
      <p class="shop-msg" role="status">${esc(message)}</p>
      <h3 class="bag-sub">Ready <small>(${c.skillBar.length} of ${SKILL_BAR})</small></h3>
      ${bar}
      <h3 class="bag-sub">Stored</h3>
      ${kept}
    </div>`;
}

// The bar of ready skills. `cooling(id)` is the share of the rest still to go (0 when ready).
export function renderSkillBar(el, game) {
  const c = game.character;
  el.innerHTML = c.skillBar.map((b) => { const sk = SKILLS[b.id]; return `
    <button type="button" class="sk-btn" data-skill="${b.id}" aria-label="${esc(sk.name)}" title="${esc(sk.name)} (${sk.sp} SP)">
      <span class="sk-icon">${sk.icon}</span>${b.key ? `<kbd>${esc(keyLabel(b.key))}</kbd>` : ''}<span class="sk-cool"></span><b class="sk-time" hidden></b></button>`; }).join('');
  el.classList.toggle('hidden', !c.skillBar.length);
}

export function updateSkillBar(el, game, cooling) {
  for (const btn of el.querySelectorAll('[data-skill]')) {
    const left = cooling(btn.dataset.skill);
    btn.querySelector('.sk-cool').style.height = `${Math.round(left * 100)}%`;
    // the seconds until it can be used again, counting down on the button
    const secs = left * SKILLS[btn.dataset.skill].cd, time = btn.querySelector('.sk-time');
    time.hidden = secs <= 0;
    if (secs > 0) time.textContent = secs < 10 ? secs.toFixed(1) : String(Math.ceil(secs));
    btn.classList.toggle('no-sp', game.character.sp < SKILLS[btn.dataset.skill].sp);
  }
}
