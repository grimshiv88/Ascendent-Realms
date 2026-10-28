// The Cult window (monsters) and the Order of the Dawn (anyone who refused a cult, and players).
// Everything here is secret: only you see it, and a cult member sees only their own rank and below.
import { CULT_RANKS, CULT_FOUND_LEVEL, ORDER_NAME, MISSIONS, JOIN_COINS, HOLY_STR, PACT_PCT, RECRUIT_RANK } from './data/cults.mjs';
import { RACES } from './data/game-data.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function missionRows(list, counts) {
  if (!list?.length) return '<p class="bag-hint">No missions right now.</p>';
  return `<ul class="cult-missions">${list.map((m) => `<li><b>${m.from === 'above' ? 'From above' : 'Your own'}</b> · ${esc(m.text)}
    <small>${Math.min(counts(m), m.need)} / ${m.need} · reward ${m.reward} G</small></li>`).join('')}</ul>`;
}

// `v` is the view from the server (see data/cults.mjs view); `counts(mission)` is how far along it is
export function renderCult(el, c, v, { message = '', counts = () => 0 } = {}) {
  const monster = RACES[c.race]?.side === 'monster';
  let body = '';
  if (!v) body = '<p class="bag-hint">Loading…</p>';
  else if (v.invited) {
    body = `<div class="cult-offer">
      <p>A hooded figure finds you alone. <i>"We have watched you. The ${esc(RACES[c.race].name)} cult would have you. Join us, and the dark will make you strong and rich. Refuse, and walk your own road."</i></p>
      <p class="bag-hint"><b>Join:</b> dark powers (+${PACT_PCT}% attack, for good) and ${JOIN_COINS(c.level)} coins. You may never say you are in the cult. If you give it away, you lose the powers and every coin it gave you.<br>
      <b>Refuse:</b> holy powers (+${PACT_PCT}% defence, for good) and +${HOLY_STR} Strength. The ${ORDER_NAME}, which works against the cults, will then take you.</p>
      <div class="bag-actions"><button type="button" class="gold-button cult-dark" data-cult="answer" data-accept="1">Join the cult</button>
      <button type="button" class="gold-button" data-cult="answer" data-accept="0">Refuse</button></div></div>`;
  } else if (v.cult) {
    const k = v.cult;
    const lower = k.members.filter((m) => m.rank > k.rank);
    body = `<p class="cult-rank">${esc(k.name)} · <b>${esc(k.rankName)}</b> <small>(favour ${k.favour})</small></p>
      <p class="bag-hint">Keep it secret. Nobody outside the cult can see you are in it, and those below you can't see you either. Say the word in chat and you lose the cult's powers and the ${k.gained} coins it has given you.</p>
      <h3 class="bag-sub">Your missions</h3>
      ${missionRows(k.missions, counts)}
      <button type="button" class="gold-button small" data-cult="ask">Ask for a mission</button>
      <h3 class="bag-sub">Those you can see <small>(your rank and below)</small></h3>
      <ul class="cult-members">${k.members.map((m) => `<li><span>${esc(m.name)}</span> <small>${esc(m.rankName)}</small>
        ${m.rank > k.rank ? `<select data-cult-pick="${esc(m.name)}">${MISSIONS.cult.map((t, i) => `<option value="${i}">${esc(t.text.split(':')[0])}</option>`).join('')}</select><button type="button" class="link-button" data-cult="give" data-name="${esc(m.name)}">Give mission</button>` : ''}</li>`).join('')}</ul>
      ${lower.length ? '' : '<p class="bag-hint">Nobody below you yet.</p>'}
      ${k.rank <= RECRUIT_RANK ? `<h3 class="bag-sub">Bring someone in</h3>
      <p class="bag-hint">Only ${esc(RACES[k.race].name)} monsters. They never learn who asked.</p>
      <div class="room-form"><label>Name <input type="text" data-cult-name maxlength="16" autocomplete="off"></label><button type="button" class="gold-button small" data-cult="invite">Ask them</button></div>` : '<p class="bag-hint">Earn favour with missions to rise. From Acolyte up you can bring others in.</p>'}
      <p class="bag-hint">Ranks: ${CULT_RANKS.join(' › ')}.</p>`;
  } else if (v.order) {
    body = `<p class="cult-rank">${ORDER_NAME} <small>(${v.order.members} sworn)</small></p>
      <p class="bag-hint">The Order works against the cults. Nobody is told who is in a cult, and the Order never names anyone: it keeps the roads and towns safe.</p>
      <h3 class="bag-sub">Your missions</h3>
      ${missionRows(v.order.missions, counts)}
      <button type="button" class="gold-button small" data-cult="ask">Ask for a mission</button>`;
  } else {
    const canOrder = !monster || v.choice === 'refused';
    body = `${v.choice === 'refused' ? '<p class="bag-hint">You refused the cult. Holy power runs in you.</p>' : ''}
      ${canOrder ? `<p>The <b>${ORDER_NAME}</b> works in secret against the cults, keeping the roads and towns safe.</p>
        <button type="button" class="gold-button" data-cult="order">Swear to the Order</button>
        ${v.choice ? '' : `<p class="bag-hint">Joining brings holy powers (+${PACT_PCT}% defence) and +${HOLY_STR} Strength.</p>`}` : ''}
      ${monster ? (v.canFound ? `<h3 class="bag-sub">Found your race's cult</h3>
        <p class="bag-hint">There can be only one cult for each race, and yours has none. Found it and you are its Cult Leader.</p>
        <div class="room-form"><label>Cult name <input type="text" data-cult-found maxlength="28" autocomplete="off"></label><button type="button" class="gold-button small cult-dark" data-cult="found">Found it</button></div>`
        : `<p class="bag-hint">${c.level < CULT_FOUND_LEVEL ? `Strong monsters (level ${CULT_FOUND_LEVEL}) can found a cult, one for each race.` : 'Your race already has its cult.'} A cult may yet come to you.</p>`) : ''}`;
  }
  el.innerHTML = `
    <div class="status-window cult-window" role="dialog" aria-label="${monster ? 'Cult' : ORDER_NAME}">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      <h2>${v?.cult ? 'The Cult' : v?.order ? ORDER_NAME : monster ? 'Cults and the Order' : ORDER_NAME}</h2>
      <p class="shop-msg" role="status">${esc(message)}</p>
      ${body}
    </div>`;
}
