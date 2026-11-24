// The ID card a player shows the guards at the city gates: a photo of the character with their
// name, race, level, title and class. Emperors are shown as "Emperor of" their nation.
import { RACES, CLASSES, ADVANCEMENTS, rankFor } from './data/game-data.mjs';
import { CASTLES } from './data/kings.mjs';
import { characterPortrait } from './characters/icons.js';
import { CARD_RANKS, rankIndex } from './data/guildcard.mjs';
import { now, DAY_MS } from './data/clock.mjs';
import { PLACES } from './data/world-layout.mjs';
import { familyOfChar, parentInfo, parentAlive, visitDue, VISIT_EVERY_MS } from './data/birth.mjs';
import { cityPass, DAY_PASS, PASS_NAME } from './data/citypass.mjs';
import { countryName } from './data/countries.mjs';
import { moneyWords } from './data/money.mjs';
import { flagHtml, fillFlags } from './flag.js';
// the city or village a player was born in, as written on their ID
const birthplace = (c) => { const id = (c.child?.family || c.family)?.city; return id ? PLACES.find((p) => p.id === id)?.name.replace(/ \(.*\)/, '') || null : null; };

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
// The rows every ID shows below the photo's: the City Pass (how far into a city you may go, and
// why) and the flag of the country the player is from
export function passRows(c, perks = {}) {
  const pass = cityPass(c, perks);
  const day = c.dayPass && c.dayPass.until > Date.now() ? c.dayPass : null;
  return `<div><dt>City pass</dt><dd><span class="pass-badge pass-${pass.tier}">${esc(pass.name)}</span> <small>${esc(pass.why)}</small>${day ? `<br><small>Day pass: ${esc(PASS_NAME[day.tier])}, ${Math.max(1, Math.ceil((day.until - Date.now()) / 60000))} min left</small>` : ''}</dd></div>
    <div><dt>From</dt><dd>${c.country ? `${flagHtml(c.country)} ${esc(countryName(c.country) || '')}` : '<small>Not given</small>'}</dd></div>`;
}

// `inner`: stopped at a gate between a city's rings ({ tier, name, city }): the guard reads the
// City Pass and offers a day pass instead
export function renderIdCard(el, game, { city = 'Central City', leaving = false, monster = false, barredText = null, courts = [], nation = null, message = '', perks = {}, inner = null } = {}) {
  const c = game.character;
  const key = JSON.stringify([c.race, c.form, c.stage, c.look, c.equipped]);
  if (photo.key !== key) photo = { key, url: characterPortrait(c, game.worn()) };
  const cls = ADVANCEMENTS[c.cls]?.[c.stage || 0] || CLASSES[c.cls]?.name || c.cls;
  el.innerHTML = `
    <div class="status-window id-window" role="dialog" aria-label="City gate">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      <h2>${inner ? `${esc(inner.name)} Gate` : `${esc(city || 'Central City')} Gate`}</h2>
      <p class="bag-hint">${inner ? `The guard reads your City Pass and shakes their head. "Only folk with a ${esc(inner.name)} pass go up. You can buy a day pass, good for one day."` : monster ? esc(barredText || 'The guards cross their spears. "No monsters in the city."') : leaving ? 'A guard holds out a hand. "Your ID before you leave, please."' : 'A guard holds out a hand. "Your ID, please."'}</p>
      <div class="id-card">
        ${photo.url ? `<img class="id-photo" src="${photo.url}" alt="Photo of ${esc(c.name)}">` : '<div class="id-photo"></div>'}
        <dl>
          <div><dt>Name</dt><dd>${esc(c.name)}</dd></div>
          <div><dt>Race</dt><dd>${esc(RACES[c.race].name)}</dd></div>
          <div><dt>Level</dt><dd>${c.level}</dd></div>
          <div><dt>Title</dt><dd>${esc(titleOf(c, courts, nation))}</dd></div>
          <div><dt>Class</dt><dd>${esc(cls)}</dd></div>
          ${birthplace(c) ? `<div><dt>Born in</dt><dd>${esc(birthplace(c))}</dd></div>` : ''}
          ${passRows(c, perks)}
          ${lifeRows(c)}
        </dl>
      </div>
      <p class="shop-msg" role="status">${esc(message)}</p>
      ${inner ? `<button type="button" class="gold-button" data-day-pass="${esc(inner.tier)}">Buy a day pass (${esc(moneyWords(DAY_PASS[inner.tier]))})</button><button type="button" class="link-button" data-close>Turn back</button>` : monster ? '<button type="button" class="link-button" data-close>Turn back</button>' : '<button type="button" class="gold-button" data-show-id>Show your ID</button>'}
    </div>`;
  fillFlags(el);
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

// Your parents' cards: who they are, their class and level, and whether they still live. Grown
// children must visit them (talk to them at their door) at least every three hours of play.
const parentPhotos = new Map();
export function renderParents(el, game, { visited = false } = {}) {
  const c = game.character;
  const fam = familyOfChar(c);
  if (!fam) { el.innerHTML = '<div class="status-window id-window" role="dialog"><button type="button" class="sw-close" data-close aria-label="Close">×</button><p>No family.</p></div>'; return; }
  const cards = [0, 1].map((j) => {
    const p = parentInfo(fam, j);
    if (!p) return '';
    const alive = parentAlive(c, j);
    const key = `${fam.race}:${p.name}`;
    if (!parentPhotos.has(key)) parentPhotos.set(key, characterPortrait({ race: fam.race, form: 'humanoid', look: {} }));
    const url = parentPhotos.get(key);
    return `<div class="id-card${alive ? '' : ' late'}">
        ${url ? `<img class="id-photo" src="${url}" alt="Photo of ${esc(p.name)}">` : '<div class="id-photo"></div>'}
        <dl>
          <div><dt>Name</dt><dd>${esc(p.name)}${alive ? '' : ' <small>(passed away)</small>'}</dd></div>
          <div><dt>Race</dt><dd>${esc(RACES[fam.race]?.name || fam.race)}</dd></div>
          <div><dt>Level</dt><dd>${p.level}</dd></div>
          <div><dt>Title</dt><dd>${esc(rankFor(p.level))}</dd></div>
          <div><dt>Class</dt><dd>${esc(CLASSES[p.cls]?.name || '')}</dd></div>
          <div><dt>Work</dt><dd>${esc(p.jobName)}</dd></div>
          ${birthplace(c) ? `<div><dt>Lives in</dt><dd>${esc(birthplace(c))}, house ${fam.house + 1}</dd></div>` : ''}
        </dl>
      </div>`;
  }).join('');
  const due = visitDue(c);
  const hours = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
  const note = c.child ? 'Your parents look after you until the Ceremony. After it, visit them often.'
    : due === null ? 'Your parents have both passed away. Their house is quiet now.'
    : `${visited ? 'They are glad you came. ' : ''}Visit again within ${hours(due)} of play (every ${VISIT_EVERY_MS / 3600000} hours), or you will be counted a sinner.`;
  el.innerHTML = `
    <div class="status-window id-window parents-window" role="dialog" aria-label="Your parents">
      <button type="button" class="sw-close" data-close aria-label="Close">×</button>
      <h2>Your parents</h2>
      ${c.neglect ? '<p class="bag-hint bad">You left your parents unvisited for too long. You are a sinner in this life, and your next life starts weaker.</p>' : ''}
      <div class="parent-cards">${cards}</div>
      <p class="bag-hint">${esc(note)}</p>
    </div>`;
}
