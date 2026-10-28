// The ID card a player shows the guards at the city gates: a photo of the character with their
// name, race, level, title and class. Emperors are shown as "Emperor of" their nation.
import { RACES, CLASSES, ADVANCEMENTS, rankFor } from './data/game-data.mjs';
import { CASTLES } from './data/kings.mjs';
import { characterPortrait } from './characters/icons.js';
import { CARD_RANKS, rankIndex } from './data/guildcard.mjs';
import { now, DAY_MS } from './data/clock.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// the title on the card: a crown, an empire, or the rank your level gives you
export function titleOf(c, courts = [], nation = null) {
  const court = courts.find((q) => q.king && !q.king.npc && q.king.name === c.name);
  if (court) return CASTLES[court.race]?.title || 'King';
  if (nation) return `Emperor of ${nation}`;
  return rankFor(c.level);
}

// When the character joined (real date), how long they have played (real hours), and how many days
// of the realm have passed since then
export function lifeRows(c) {
  const joined = c.createdAt ? new Date(c.createdAt) : null;
  const hours = Math.floor((c.playMs || 0) / 3600000), mins = Math.floor(((c.playMs || 0) % 3600000) / 60000);
  const days = joined ? Math.max(0, Math.floor((now() - joined.getTime()) / DAY_MS)) : 0;
  return `${joined ? `<div><dt>Joined</dt><dd>${joined.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div>` : ''}
    <div><dt>Played</dt><dd>${hours ? `${hours} h ` : ''}${mins} min</dd></div>
    ${joined ? `<div><dt>Days in the realm</dt><dd>${days}</dd></div>` : ''}`;
}

let photo = { key: '', url: null };
export function renderIdCard(el, game, { monster = false, barredText = null, courts = [], nation = null, message = '' } = {}) {
  const c = game.character;
  const key = JSON.stringify([c.race, c.form, c.stage, c.look, c.equipped]);
  if (photo.key !== key) photo = { key, url: characterPortrait(c, game.worn()) };
  const cls = ADVANCEMENTS[c.cls]?.[c.stage || 0] || CLASSES[c.cls].name;
  el.innerHTML = `
    <div class="status-window id-window" role="dialog" aria-label="City gate">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      <h2>Central City Gate</h2>
      <p class="bag-hint">${monster ? esc(barredText || 'The guards cross their spears. "No monsters in the city."') : 'A guard holds out a hand. "Your ID, please."'}</p>
      <div class="id-card">
        ${photo.url ? `<img class="id-photo" src="${photo.url}" alt="Photo of ${esc(c.name)}">` : '<div class="id-photo"></div>'}
        <dl>
          <div><dt>Name</dt><dd>${esc(c.name)}</dd></div>
          <div><dt>Race</dt><dd>${esc(RACES[c.race].name)}</dd></div>
          <div><dt>Level</dt><dd>${c.level}</dd></div>
          <div><dt>Title</dt><dd>${esc(titleOf(c, courts, nation))}</dd></div>
          <div><dt>Class</dt><dd>${esc(cls)}</dd></div>
          ${lifeRows(c)}
        </dl>
      </div>
      <p class="shop-msg" role="status">${esc(message)}</p>
      ${monster ? '<button type="button" class="link-button" data-close>Turn back</button>' : '<button type="button" class="gold-button" data-show-id>Show your ID</button>'}
    </div>`;
}

// The Assessment Room: the crystal reads your level and stats and ranks your Hunter's Guild Card.
// `result` is 'new', 'up' or 'same' (see progress.assessCard).
export function renderAssess(el, c, result = 'new') {
  const card = c.guildCard;
  const r = CARD_RANKS[rankIndex(card.rank)];
  const next = CARD_RANKS[rankIndex(card.rank) + 1];
  const stats = Object.entries(card.stats || c.stats).map(([k, v]) => `<div><dt>${esc(k.toUpperCase())}</dt><dd>${v}</dd></div>`).join('');
  el.innerHTML = `
    <div class="status-window id-window" role="dialog" aria-label="Assessment Room">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      <h2>Assessment Room</h2>
      <p class="bag-hint">You lay a hand on the crystal. It glows, and words of light spell out what it sees.</p>
      <dl class="assess-stats"><div><dt>Level</dt><dd>${card.level}</dd></div>${stats}</dl>
      <div class="guild-card"><span class="gc-rank">${r.id}</span><span><b>${esc(c.name)}</b><small>Hunter's Guild Card · Rank ${r.id} (${r.name})</small></span></div>
      <p class="shop-msg" role="status">${{ new: `Your card is ready: Rank ${r.id}. You can now take guild requests of rank ${r.id} and below at the counter.`, up: `Your card rises to Rank ${r.id}!`, same: `Your card stays at Rank ${r.id}.` }[result]}${next ? ` Rank ${next.id} needs level ${next.level}.` : ''}</p>
      <button type="button" class="gold-button" data-close>Take the card</button>
    </div>`;
}
