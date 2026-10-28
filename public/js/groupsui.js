// The Party and Guild window (Y): your party, your guild, and invites waiting for you.
import { PARTY_MAX, GUILD_MAX, GUILD_FEE, GUILD_LEVEL } from './data/groups.mjs';
import { CLASSES } from './data/game-data.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const who = (m) => `${esc(m.name)}${m.level ? ` <small>Lv ${m.level}${CLASSES[m.cls] ? ` · ${esc(CLASSES[m.cls].name)}` : ''}</small>` : ''}`;

function members(kind, g, me) {
  const boss = kind === 'party' ? g.leader : g.master;
  return g.members.map((m) => `
    <div class="sk-row"><span class="sk-icon">${m.name === boss ? '👑' : '🛡️'}</span><span class="sk-name"><b>${who(m)}</b><small>${m.name === boss ? (kind === 'party' ? 'Leader' : 'Guild Master') : 'Member'}</small></span>
      ${g.mine && m.name !== me ? `<button type="button" class="link-button" data-group="lead" data-kind="${kind}" data-name="${esc(m.name)}">Make ${kind === 'party' ? 'leader' : 'Guild Master'}</button><button type="button" class="link-button" data-group="remove" data-kind="${kind}" data-name="${esc(m.name)}">Remove</button>` : ''}
    </div>`).join('') + (g.pending?.length ? `<p class="bag-hint">Invited: ${g.pending.map(esc).join(', ')}</p>` : '');
}
const inviteRow = (kind) => `<div class="room-form"><label>Invite a player <input type="text" data-group-name="${kind}" maxlength="16" placeholder="Username" autocomplete="off"></label>
  <button type="button" class="gold-button small" data-group="invite" data-kind="${kind}">Send invite</button></div>`;

// `v` is the view from the server (null while loading)
export function renderGroups(el, game, v, { message = '', busy = false } = {}) {
  const c = game.character;
  const me = c.name;
  let body = '<p class="bag-hint">Loading…</p>';
  if (v) {
    const invites = v.invites.length ? `<h3 class="bag-sub">Invites for you</h3>${v.invites.map((i) => `
      <div class="sk-row"><span class="sk-icon">✉️</span><span class="sk-name"><b>${esc(i.from)}</b><small>invites you to ${i.kind === 'party' ? 'their party' : `the guild ${esc(i.label)}`}</small></span>
        <button type="button" class="gold-button small" data-group="respond" data-id="${i.id}" data-accept="1">Join</button><button type="button" class="link-button" data-group="respond" data-id="${i.id}">No thanks</button></div>`).join('')}` : '';
    const party = v.party
      ? `${members('party', v.party, me)}${v.party.mine && v.party.members.length < PARTY_MAX ? inviteRow('party') : ''}
         <button type="button" class="link-button" data-group="leave" data-kind="party">Leave the party</button>${v.party.mine ? ' <button type="button" class="link-button" data-group="disband" data-kind="party">Break up the party</button>' : ''}`
      : `<p class="bag-hint">You're not in a party. Invite someone to start one (up to ${PARTY_MAX} players). Your party has its own chat tab.</p>${inviteRow('party')}`;
    const guild = v.guild
      ? `<p class="bag-hint"><b>${esc(v.guild.name)}</b> · ${v.guild.members.length} of ${GUILD_MAX} members</p>${members('guild', v.guild, me)}${v.guild.mine && v.guild.members.length < GUILD_MAX ? inviteRow('guild') : ''}
         <button type="button" class="link-button" data-group="leave" data-kind="guild">Leave the guild</button>${v.guild.mine ? ' <button type="button" class="link-button" data-group="disband" data-kind="guild">Disband the guild</button>' : ''}`
      : `<p class="bag-hint">You're not in a guild. Join one by invite, or found your own at the Main Guild Hall counter: it costs ${GUILD_FEE} G and you must be level ${GUILD_LEVEL}. The founder is the Guild Master.</p>
         <div class="room-form"><label>Guild name <input type="text" data-guild-name maxlength="24" placeholder="3 to 24 letters" autocomplete="off"></label>
         <button type="button" class="gold-button small" data-group="found" data-kind="guild" ${c.level < GUILD_LEVEL || c.coins < GUILD_FEE ? 'disabled' : ''}>Found a guild (${GUILD_FEE} G)</button></div>`;
    body = `${invites}<h3 class="bag-sub">Party</h3>${party}<h3 class="bag-sub">Guild</h3>${guild}`;
  }
  el.innerHTML = `
    <div class="status-window skills-window" role="dialog" aria-label="Party and guild">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      <h2>Party and Guild</h2>
      <p class="shop-msg" role="status">${esc(message)}</p>
      ${busy ? '<p class="bag-hint">One moment…</p>' : ''}
      ${body}
    </div>`;
}
