// The Cult window and the Order of the Dawn, and the call that brings you to one of them.
// Everything here is secret: only you see it, and a cult member sees only their own rank and below.
import { CULT_RANKS, CULT_FOUND_LEVEL, ORDER_NAME, MISSIONS, JOIN_COINS, PACT_PCT, DARK_MATK_PCT, DARK_SPELL_EVERY, bookLevel, ACCEPT_TEXT, REJECT_TEXT } from './data/cults.mjs';
import { RACES } from './data/game-data.mjs';
import { money } from './data/money.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function missionRows(list, counts) {
  if (!list?.length) return '<p class="bag-hint">No missions right now.</p>';
  return `<ul class="cult-missions">${list.map((m) => `<li><b>${m.from === 'above' ? 'From above' : 'Your own'}</b> · ${esc(m.text)}
    <small>${Math.min(counts(m), m.need)} / ${m.need} · reward ${money(m.reward)}</small></li>`).join('')}</ul>`;
}

// `v` is the view from the server (see data/cults.mjs view); `counts(mission)` is how far along it is
export function renderCult(el, c, v, { message = '', counts = () => 0 } = {}) {
  const monster = RACES[c.race]?.side === 'monster';
  let body = '';
  if (!v) body = '<p class="bag-hint">Loading…</p>';
  else if (v.invited) {
    body = `<div class="cult-offer">
      <p><i>A voice speaks out of the dark, meant for you alone. "We have watched you. Few are ever called. The Dark Side would have you: power beyond your kind, and gold. Or turn from us and fight the Evil, and the Light will take you instead. Choose."</i></p>
      <p class="bag-hint"><b>The Dark Side:</b> ${money(JOIN_COINS(c.level))}, +${PACT_PCT}% attack, and magic: a spell in each of your elements at once, a new one every ${DARK_SPELL_EVERY} levels, and +${DARK_MATK_PCT}% magic attack. Only the Dark Side may become Mages. You may never say you serve it: give it away and you lose the powers and every coin it gave you. And the dark leaves its mark: die with it and you die a sinner, and your next life begins weaker.<br>
      <b>The Light:</b> none of the dark's gifts, but the Book of the Dawn, which stops Dark Side spells that hit you (the higher your Intelligence, the stronger the spells it stops). Sworn to the ${ORDER_NAME}, which fights the cults in secret. Die in the Light and your next life begins stronger.<br>
      Whatever you choose, this call is a secret. Speak of it and your words are blotted out.</p>
      <div class="bag-actions cult-choice"><button type="button" class="gold-button cult-dark" data-cult="answer" data-choice="dark">${ACCEPT_TEXT}</button>
      <button type="button" class="gold-button cult-light" data-cult="answer" data-choice="light">${REJECT_TEXT}</button></div>
      <button type="button" class="link-button" data-cult="answer" data-choice="none">Walk away from both</button></div>`;
  } else if (v.cult) {
    const k = v.cult;
    const lower = k.members.filter((m) => m.rank > k.rank);
    body = `<p class="cult-rank">${esc(k.name)} · <b>${esc(k.rankName)}</b> <small>(favour ${k.favour})</small></p>
      <p class="bag-hint">Keep it secret. Nobody outside the cult can see you are in it, and those below you can't see you either. Say the word in chat and you lose the cult's powers and the ${money(k.gained)} it has given you.</p>
      ${c.cls === 'mage' ? '' : `<h3 class="bag-sub">Become a Mage</h3>
        <p class="bag-hint">Only those who serve the Dark Side may become Mages. Your class bonus is swapped for the Mage's (+6 Intelligence, +4 Dexterity) and you rise through the Mage ranks from now on. This is for good.</p>
        <button type="button" class="gold-button small cult-dark" data-cult="mage">Become a Mage</button>`}
      <h3 class="bag-sub">Your missions</h3>
      ${missionRows(k.missions, counts)}
      <button type="button" class="gold-button small" data-cult="ask">Ask for a mission</button>
      <h3 class="bag-sub">Those you can see <small>(your rank and below)</small></h3>
      <ul class="cult-members">${k.members.map((m) => `<li><span>${esc(m.name)}</span> <small>${esc(m.rankName)}</small>
        ${m.rank > k.rank ? `<select data-cult-pick="${esc(m.name)}">${MISSIONS.cult.map((t, i) => `<option value="${i}">${esc(t.text.split(':')[0])}</option>`).join('')}</select><button type="button" class="link-button" data-cult="give" data-name="${esc(m.name)}">Give mission</button>` : ''}</li>`).join('')}</ul>
      ${lower.length ? '' : '<p class="bag-hint">Nobody below you yet.</p>'}
      <p class="bag-hint">Nobody can be brought in by name. The dark calls those it chooses, and only as many as the cult's strength can hold.</p>
      <p class="bag-hint">Ranks: ${CULT_RANKS.join(' › ')}.</p>`;
  } else if (v.order) {
    body = `<p class="cult-rank">${ORDER_NAME} <small>(${v.order.members} sworn)</small></p>
      <p class="bag-hint">The Order works against the cults. Nobody is told who is in a cult, and the Order never names anyone: it keeps the roads and towns safe.</p>
      <p class="bag-hint">📖 <b>Book of the Dawn</b>, level ${bookLevel(c.stats?.int)} (your Intelligence). Kept in your bag, it stops Dark Side spells that hit you: the whole hit when its level is at least the spell's strength (the caster's Intelligence times the spell's power), and part of it otherwise.</p>
      <h3 class="bag-sub">Your missions</h3>
      ${missionRows(v.order.missions, counts)}
      <button type="button" class="gold-button small" data-cult="ask">Ask for a mission</button>`;
  } else {
    body = `${v.choice === 'silent' ? '<p class="bag-hint">You walked away from the voice. Never speak of it.</p>' : ''}
      ${monster ? (v.canFound ? `<h3 class="bag-sub">Found your race's cult</h3>
        <p class="bag-hint">There can be only one cult for each race, and yours has none. Found it and you are its Cult Leader. Nobody joins by asking: the dark calls those it chooses, and the stronger you and your cult grow, the more it can hold.</p>
        <div class="room-form"><label>Cult name <input type="text" data-cult-found maxlength="28" autocomplete="off"></label><button type="button" class="gold-button small cult-dark" data-cult="found">Found it</button></div>`
        : `<p class="bag-hint">${c.level < CULT_FOUND_LEVEL ? `Strong monsters (level ${CULT_FOUND_LEVEL}) can found a cult, one for each race.` : 'Your race already has its cult.'}</p>`) : ''}`;
  }
  el.innerHTML = `
    <div class="status-window cult-window" role="dialog" aria-label="${v?.order ? ORDER_NAME : 'Cult'}">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      <h2>${v?.invited ? 'A Voice in the Dark' : v?.cult ? 'The Cult' : v?.order ? ORDER_NAME : 'The Cult'}</h2>
      <p class="shop-msg" role="status">${esc(message)}</p>
      ${body}
    </div>`;
}
