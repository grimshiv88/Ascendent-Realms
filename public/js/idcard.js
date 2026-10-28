// The ID card a player shows the guards at the city gates: a photo of the character with their
// name, race, level, title and class. Emperors are shown as "Emperor of" their nation.
import { RACES, CLASSES, ADVANCEMENTS, rankFor } from './data/game-data.mjs';
import { CASTLES } from './data/kings.mjs';
import { characterPortrait } from './characters/icons.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// the title on the card: a crown, an empire, or the rank your level gives you
export function titleOf(c, courts = [], nation = null) {
  const court = courts.find((q) => q.king && !q.king.npc && q.king.name === c.name);
  if (court) return CASTLES[court.race]?.title || 'King';
  if (nation) return `Emperor of ${nation}`;
  return rankFor(c.level);
}

let photo = { key: '', url: null };
export function renderIdCard(el, game, { monster = false, courts = [], nation = null, message = '' } = {}) {
  const c = game.character;
  const key = JSON.stringify([c.race, c.form, c.stage, c.look, c.equipped]);
  if (photo.key !== key) photo = { key, url: characterPortrait(c, game.worn()) };
  const cls = ADVANCEMENTS[c.cls]?.[c.stage || 0] || CLASSES[c.cls].name;
  el.innerHTML = `
    <div class="status-window id-window" role="dialog" aria-label="City gate">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      <h2>Central City Gate</h2>
      <p class="bag-hint">${monster ? 'The guards cross their spears. "No monsters in the city."' : 'A guard holds out a hand. "Your ID, please."'}</p>
      <div class="id-card">
        ${photo.url ? `<img class="id-photo" src="${photo.url}" alt="Photo of ${esc(c.name)}">` : '<div class="id-photo"></div>'}
        <dl>
          <div><dt>Name</dt><dd>${esc(c.name)}</dd></div>
          <div><dt>Race</dt><dd>${esc(RACES[c.race].name)}</dd></div>
          <div><dt>Level</dt><dd>${c.level}</dd></div>
          <div><dt>Title</dt><dd>${esc(titleOf(c, courts, nation))}</dd></div>
          <div><dt>Class</dt><dd>${esc(cls)}</dd></div>
        </dl>
      </div>
      <p class="shop-msg" role="status">${esc(message)}</p>
      ${monster ? '<button type="button" class="link-button" data-close>Turn back</button>' : '<button type="button" class="gold-button" data-show-id>Show your ID</button>'}
    </div>`;
}
