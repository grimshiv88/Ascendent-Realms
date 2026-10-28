// The Skills window (K): put your skills on keys, keep spare ones in storage.
// Also the skill bar at the bottom of the screen, which works by key on desktop and by tap on touch.
import { SKILLS, SKILL_BAR, UPGRADE_EVERY, keyLabel } from './data/skills.mjs';
import { SPELLS, KIND_TEXT, spellEvery } from './data/spells.mjs';
import { keyName, codeFor } from './data/controls.mjs';

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
      <p class="bag-hint">Every ${UPGRADE_EVERY} levels you grow a little stronger and learn a new skill, given at random. Up to ${SKILL_BAR} are ready at once, each on a key of your choice; on a phone or iPad they are buttons at the bottom middle of the screen.</p>
      <p class="shop-msg" role="status">${esc(message)}</p>
      <h3 class="bag-sub">Ready <small>(${c.skillBar.length} of ${SKILL_BAR})</small></h3>
      ${bar}
      <h3 class="bag-sub">Stored</h3>
      ${kept}
      ${spellsHtml(game)}
    </div>`;
}

// Spells: the ones you know, and which are attached to the staff in your hand
function spellsHtml(game) {
  const c = game.character;
  const st = game.staff();
  const chosen = game.chosenSpell();
  const head = `<h3 class="bag-sub">Spells ${st ? `<small>(${st.spells.length} of ${st.slots} on your staff)</small>` : ''}</h3>
    <p class="bag-hint">You learn a spell in your elements every ${spellEvery(c.cls)} levels, given at random. Attach spells to a staff (3, or 5 on a Legendary or Mythic staff), then the attack key casts the chosen one and ${esc(keyName(codeFor('spell')))} changes spell.${st ? '' : ' <b>Hold a staff to attach spells.</b>'}</p>`;
  if (!c.spells.length) return `${head}<p class="bag-hint">No spells yet.</p>`;
  return head + c.spells.map((id) => {
    const sp = SPELLS[id];
    const on = st?.spells.includes(id);
    const btn = !st ? '' : on
      ? `<button type="button" class="link-button" data-unspell="${id}">Detach</button>`
      : `<button type="button" class="gold-button small" data-spell="${id}" ${st.spells.length >= st.slots ? 'disabled title="Your staff is full: detach one first"' : ''}>Attach</button>`;
    return `<div class="sk-row"><span class="sk-icon">✨</span><span class="sk-name"><b>${esc(sp.name)}${chosen?.id === id ? ' · chosen' : ''}</b>
      <small>${esc(sp.element)} · ${esc(KIND_TEXT[sp.kind])} <span class="sk-cost">${sp.sp} SP · ${sp.cd}s rest</span></small></span>${btn}</div>`;
  }).join('');
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
