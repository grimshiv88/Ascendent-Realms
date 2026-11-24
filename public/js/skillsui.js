// The Skills window (K): put your skills on keys, keep spare ones in storage.
// Also the skill bar at the bottom of the screen, which works by key on desktop and by tap on touch.
import { SKILLS, SKILL_BAR, UPGRADE_EVERY, keyLabel } from './data/skills.mjs';
import { SPELLS, KIND_TEXT } from './data/spells.mjs';
import { DARK_SPELL_EVERY } from './data/cults.mjs';
import { keyName, codeFor } from './data/controls.mjs';
import { uniqueAbility, nextTierLevel, TIER_NAMES, UNBOUND_LEVEL } from './data/unique.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const what = (sk) => `${esc(sk.text)} <span class="sk-cost">${sk.sp} SP · ${sk.cd}s rest</span>`;

// `binding` is the skill waiting for a key press; `message` is shown at the top
export function renderSkills(el, game, { binding = null, message = '' } = {}) {
  const c = game.character;
  const known = game.knownSkills(), fromGear = game.gearSkills().filter((id) => !c.skills.includes(id));
  const stored = known.filter((id) => !c.skillBar.some((b) => b.id === id));
  const tag = (id) => (fromGear.includes(id) ? ' <em class="forged-tag">gear</em>' : !known.includes(id) ? ' <em class="forged-tag">gear not worn</em>' : '');
  const bar = c.skillBar.length ? c.skillBar.map((b) => { const sk = SKILLS[b.id]; return `
    <div class="sk-row"><span class="sk-icon">${sk.icon}</span><span class="sk-name"><b>${esc(sk.name)}${tag(b.id)}</b><small>${what(sk)}</small></span>
      <button type="button" class="sk-key${binding === b.id ? ' waiting' : ''}" data-bind="${b.id}" title="Change the key">${binding === b.id ? 'Press a key…' : b.key ? `Key ${esc(keyLabel(b.key))}` : 'Set a key'}</button>
      <button type="button" class="link-button" data-store="${b.id}">Store</button></div>`; }).join('')
    : '<p class="bag-hint">No skills ready yet. Your first comes at level ${UPGRADE_EVERY}.</p>';
  const kept = stored.length ? stored.map((id) => { const sk = SKILLS[id]; return `
    <div class="sk-row"><span class="sk-icon">${sk.icon}</span><span class="sk-name"><b>${esc(sk.name)}${tag(id)}</b><small>${what(sk)}</small></span>
      <button type="button" class="gold-button small" data-ready="${id}" ${c.skillBar.length >= SKILL_BAR ? 'disabled title="Store a ready skill first"' : ''}>Get ready</button></div>`; }).join('')
    : '<p class="bag-hint">Skills you aren\'t using wait here. Nothing stored.</p>';
  el.innerHTML = `
    <div class="status-window skills-window" role="dialog" aria-label="Skills">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      <h2>Skills</h2>
      <p class="bag-hint">Every ${UPGRADE_EVERY} levels you grow a little stronger and learn a new skill, given at random. Up to ${SKILL_BAR} are ready at once, each on a key of your choice; on a phone or iPad they are buttons at the bottom middle of the screen.</p>
      <p class="shop-msg" role="status">${esc(message)}</p>
      ${uniqueHtml(c)}
      ${game.mythic() ? `<h3 class="bag-sub">Mythic weapon</h3><div class="sk-row"><span class="sk-icon">🌟</span><span class="sk-name"><b>${esc(game.mythic().name)}</b><small>${esc(game.mythic().text)} <span class="sk-cost">key ${esc(keyName(codeFor('mythic')))}</span></small></span></div>` : ''}
      <h3 class="bag-sub">Ready <small>(${c.skillBar.length} of ${SKILL_BAR})</small></h3>
      ${bar}
      <h3 class="bag-sub">Stored</h3>
      ${kept}
      ${spellsHtml(game)}
    </div>`;
}

// Your Unique Skill: how much of it is let out so far
export function uniqueHtml(c) {
  const u = uniqueAbility(c), next = nextTierLevel(c.level);
  return `<h3 class="bag-sub">Unique Skill <b class="u-rank u-${esc(u.rank)}">${esc(u.rank)}-Rank</b> <small>(${esc(TIER_NAMES[u.tier])})</small></h3>
    <div class="sk-row sk-unique-row"><span class="sk-icon">${u.icon}</span><span class="sk-name"><b>${esc(u.name)}</b>
      <small>${esc(u.element)} · ${esc(u.text)} <span class="sk-cost">No SP · key ${esc(keyName(codeFor('unique')))}</span></small></span></div>
    <p class="bag-hint">${next ? `It is held back. Each evolution lets out more of it${next === UNBOUND_LEVEL ? '' : ` (next at level ${next})`}, and at level ${UNBOUND_LEVEL} it is Unbound, used to the full.` : 'Unbound: nothing holds it back any more.'} It stays yours even if you fall and begin again.</p>`;
}

// Spells: the ones you know, and which are attached to the staff in your hand
function spellsHtml(game) {
  const c = game.character;
  const st = game.staff();
  const chosen = game.chosenSpell();
  // only the Dark Side has magic, and nobody else is told it exists
  if (!c.spells.length && c.pact !== 'dark' && c.cls !== 'mage') return '';
  const head = `<h3 class="bag-sub">Spells ${st ? `<small>(${st.spells.length} of ${st.slots} on your staff)</small>` : ''}</h3>
    <p class="bag-hint">You learn a spell in your elements every ${DARK_SPELL_EVERY} levels, given at random. Attach spells to a staff (3, or 5 on a Legendary or Mythic staff), then the attack key casts the chosen one and ${esc(keyName(codeFor('spell')))} changes spell.${st ? '' : ' <b>Hold a staff to attach spells.</b>'}</p>`;
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
  // the Unique Skill always comes first
  const u = uniqueAbility(c), uk = codeFor('unique');
  const known = game.knownSkills(), myth = game.mythic(), mk = codeFor('mythic');
  el.innerHTML = `<button type="button" class="sk-btn sk-unique" data-skill="unique" aria-label="${esc(u.name)}" title="${esc(u.name)} (Unique Skill)">
      <span class="sk-icon">${u.icon}</span>${uk ? `<kbd>${esc(keyLabel(uk))}</kbd>` : ''}<span class="sk-cool"></span><b class="sk-time" hidden></b></button>` + (myth ? `<button type="button" class="sk-btn sk-mythic" data-skill="mythic" aria-label="${esc(myth.name)}" title="${esc(myth.name)} (Mythic weapon, ${myth.sp} SP)">
      <span class="sk-icon">${myth.icon}</span>${mk ? `<kbd>${esc(keyLabel(mk))}</kbd>` : ''}<span class="sk-cool"></span><b class="sk-time" hidden></b></button>` : '') + c.skillBar.map((b) => { const sk = SKILLS[b.id]; return `
    <button type="button" class="sk-btn${known.includes(b.id) ? '' : ' sk-off'}" data-skill="${b.id}" aria-label="${esc(sk.name)}" title="${esc(sk.name)} (${sk.sp} SP)">
      <span class="sk-icon">${sk.icon}</span>${b.key ? `<kbd>${esc(keyLabel(b.key))}</kbd>` : ''}<span class="sk-cool"></span><b class="sk-time" hidden></b></button>`; }).join('');
  el.classList.remove('hidden');
}

export function updateSkillBar(el, game, cooling, skillOf) {
  for (const btn of el.querySelectorAll('[data-skill]')) {
    const sk = skillOf(btn.dataset.skill);
    const left = cooling(btn.dataset.skill);
    // (each part is only written when it changes, so an idle bar costs nothing ten times a second)
    const cool = btn.querySelector('.sk-cool'), h = `${Math.round(left * 100)}%`;
    if (cool.style.height !== h) cool.style.height = h;
    // the seconds until it can be used again, counting down on the button
    const secs = left * sk.cd, time = btn.querySelector('.sk-time');
    if (time.hidden !== secs <= 0) time.hidden = secs <= 0;
    if (secs > 0) { const txt = secs < 10 ? secs.toFixed(1) : String(Math.ceil(secs)); if (time.textContent !== txt) time.textContent = txt; }
    const noSp = game.character.sp < sk.sp;
    if (btn.classList.contains('no-sp') !== noSp) btn.classList.toggle('no-sp', noSp);
  }
}

// A new power has come to you: what it is, what it does, and where it is now, so you can choose
// to keep it on a key or put it away. `power` is { kind: 'skill'|'spell'|'unique', id }.
export function renderPower(el, game, power, { binding = null, message = '', more = 0 } = {}) {
  const c = game.character;
  let icon = '✨', name = '', kind = '', does = '', where = '', buttons = '';
  if (power.kind === 'skill') {
    const sk = SKILLS[power.id];
    const b = c.skillBar.find((x) => x.id === power.id);
    icon = sk.icon; name = sk.name; kind = 'New skill';
    does = what(sk);
    if (b) {
      where = b.key ? `It is ready on key <kbd>${esc(keyLabel(b.key))}</kbd>${matchMedia('(pointer: coarse)').matches ? ' and as a button at the bottom of the screen' : ''}.` : 'It is on your skill bar, but has no key yet.';
      buttons = `<button type="button" class="gold-button small${binding === power.id ? ' waiting' : ''}" data-bind="${power.id}">${binding === power.id ? 'Press a key…' : b.key ? 'Change its key' : 'Choose a key'}</button>
        <button type="button" class="gold-button small" data-store="${power.id}">Keep it in storage</button>`;
    } else {
      const full = c.skillBar.length >= SKILL_BAR;
      where = full ? `Your skill bar is full (${SKILL_BAR} of ${SKILL_BAR}), so it is kept in storage. Store another skill to make room for it.` : 'It is kept in storage.';
      buttons = `<button type="button" class="gold-button small" data-ready="${power.id}" ${full ? 'disabled' : ''}>Put it on a key</button>`;
    }
  } else if (power.kind === 'spell') {
    const sp = SPELLS[power.id];
    const st = game.staff();
    const on = st?.spells.includes(power.id);
    name = sp.name; kind = 'New spell';
    does = `${esc(sp.element)} · ${esc(KIND_TEXT[sp.kind])} <span class="sk-cost">${sp.sp} SP · ${sp.cd}s rest</span>`;
    where = on ? `It is attached to your staff. The attack key casts the chosen spell; ${esc(keyName(codeFor('spell')))} changes spell.` : st ? 'It is not on your staff yet.' : 'Hold a staff to cast it: attach it in Skills (K).';
    if (st && !on) buttons = `<button type="button" class="gold-button small" data-spell="${power.id}" ${st.spells.length >= st.slots ? 'disabled' : ''}>Attach it to your staff</button>`;
    else if (on) buttons = `<button type="button" class="gold-button small" data-unspell="${power.id}">Detach it</button>`;
  } else {
    const u = uniqueAbility(c);
    icon = u.icon; name = u.name; kind = `Unique Skill · ${TIER_NAMES[u.tier]}`;
    does = esc(u.text);
    where = `It needs no SP and is always on key <kbd>${esc(keyName(codeFor('unique')))}</kbd> (the first button on your skill bar).`;
  }
  el.innerHTML = `
    <div class="status-window power-window" role="dialog" aria-label="${kind}">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      <h2>${power.kind === 'unique' ? 'Your power grows' : 'You received a new power'}</h2>
      <p class="shop-msg" role="status">${esc(message)}</p>
      <div class="power-card"><span class="power-icon">${icon}</span>
        <div><small class="power-kind">${esc(kind)}</small><b class="power-name">${esc(name)}</b><p>${does}</p></div></div>
      <p class="bag-hint">${where}</p>
      <div class="bag-actions">${buttons}
        <button type="button" class="link-button" data-open="skills">All skills (K)</button>
        <button type="button" class="gold-button small" data-power-next>${more ? `Next (${more} more)` : 'Got it'}</button></div>
    </div>`;
}
