// The meeting rooms window: which of the Guild Hall's rooms are free, renting one, and choosing
// who else may come in. Each rented room has its own private chat for the people let in.
import { MEETING_ROOMS, CASTLE_ROOMS, CASTLE_DAYS, castleDay, ROOM_TIMES, roomCost, MAX_GUESTS } from './data/interiors.mjs';
import { money } from './data/money.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const left = (until) => { const m = Math.max(0, Math.ceil((until - Date.now()) / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };

// `rentals` from the server (null while loading); `pick` is the room chosen to rent
export function renderRooms(el, game, { rentals, pick, message = '', busy = false, castle = false, emperor = false } = {}) {
  const c = game.character;
  const LIST = castle ? CASTLE_ROOMS : MEETING_ROOMS;
  const rows = LIST.map((room) => {
    const r = rentals?.find((x) => x.room === room.id);
    let state;
    if (!rentals) state = '<small>Checking…</small>';
    else if (!r) state = castle && !emperor ? '<small>Free</small>' : `<button type="button" class="gold-button small" data-room-pick="${room.id}">${castle ? 'Open' : 'Rent'}</button>`;
    else if (r.mine) state = `<small>Yours for ${left(r.until)}</small>`;
    else if (r.allowed) state = `<small>${esc(r.renter)} let you in · ${left(r.until)}</small>`;
    else state = `<small>Taken by ${esc(r.renter)} · ${left(r.until)}</small>`;
    return `<div class="sk-row"><span class="sk-icon">🚪</span><span class="sk-name"><b>${esc(room.name)}</b><small>${castle ? 'Behind the great hall' : 'Upstairs'} · ${room.seats} seats</small></span>${state}</div>`;
  }).join('');
  const chosen = LIST.find((m) => m.id === pick);
  const rentForm = chosen && !rentals?.some((x) => x.room === chosen.id) ? `
    <h3 class="bag-sub">${castle ? 'Open' : 'Rent'} the ${esc(chosen.name)}</h3>
    <div class="room-form">
      <label>For how long
        <select data-room-minutes>${ROOM_TIMES.map((m) => `<option value="${m}">${m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? 's' : ''}`}${castle ? '' : `: ${money(roomCost(m))}`}</option>`).join('')}</select>
      </label>
      <label>Who else may come in <small>(usernames, separated by commas; up to ${MAX_GUESTS})</small>
        <input type="text" data-room-guests maxlength="240" placeholder="e.g. Aria, Borin" autocomplete="off">
      </label>
      <button type="button" class="gold-button" data-room-rent="${chosen.id}" ${busy ? 'disabled' : ''}>${castle ? 'Open the chamber (free)' : 'Pay and rent'}</button>
      <p class="bag-hint">${castle ? 'On trade days, the guests you list here may enter the castle.' : `You have ${money(c.coins)}.`} When the time is up, everyone in the room is sent back to the ${castle ? 'great hall' : 'hallway'}.</p>
    </div>` : '';
  const mine = (rentals || []).filter((r) => r.mine).map((r) => {
    const room = [...MEETING_ROOMS, ...CASTLE_ROOMS].find((m) => m.id === r.room);
    return `<div class="room-mine">
      <b>${esc(room?.name || 'Room')}</b> <small>${left(r.until)} left</small>
      <label>Let in <input type="text" data-room-edit="${r.id}" value="${esc(r.guests.join(', '))}" maxlength="240" autocomplete="off"></label>
      <button type="button" class="gold-button small" data-room-save="${r.id}" ${busy ? 'disabled' : ''}>Save</button>
      <button type="button" class="link-button" data-room-chat="${esc(room?.name || 'Room')} (private)">Open the room's chat</button>
    </div>`;
  }).join('');
  const guestOf = (rentals || []).filter((r) => !r.mine && r.allowed).map((r) => {
    const room = [...MEETING_ROOMS, ...CASTLE_ROOMS].find((m) => m.id === r.room);
    return `<div class="room-mine"><b>${esc(room?.name || 'Room')}</b> <small>by ${esc(r.renter)} · ${left(r.until)} left</small>
      <button type="button" class="link-button" data-room-chat="${esc(room?.name || 'Room')} (private)">Open the room's chat</button></div>`;
  }).join('');
  el.innerHTML = `
    <div class="status-window skills-window" role="dialog" aria-label="Meeting rooms">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      <h2>${castle ? "The Emperors' Castle" : 'Meeting Rooms'}</h2>
      ${castle ? `<p class="bag-hint"><b>Today is a ${CASTLE_DAYS[castleDay()].name}:</b> ${CASTLE_DAYS[castleDay()].text} Monday to Friday are council days (Emperors and Guild Masters); Saturday and Sunday are trade days (Emperors and the guests they invite). Meetings here are free. An Emperor can open a chamber for private business talks and choose who may come in.</p>`
    : '<p class="bag-hint">The rooms upstairs in the Main Guild Hall are for parties and guild masters. Rent one, choose who may come in, and talk in its private chat. Only the renter and the people let in can open the door.</p>'}
      <p class="shop-msg" role="status">${esc(message)}</p>
      ${rows}
      ${rentForm}
      ${mine || guestOf ? `<h3 class="bag-sub">Your rooms</h3>${mine}${guestOf}` : ''}
    </div>`;
}
