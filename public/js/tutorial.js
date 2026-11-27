// The tutorial for new players: a short card at the bottom of the screen walks a newcomer through
// the first things to know, one step at a time. Steps that need you somewhere show a gold arrow on
// the card (pointing the way from where the camera looks, with how far it is) and a beam of light
// in the world over the spot. Steps about a window point at the button that opens it and end when
// you open it. It can be skipped, is shown once per account, and replayed from Settings.
//
// It never says what a character will become later on: it only covers what a newcomer can see.
import { PLACES, toWorld } from './data/world-layout.mjs';
import { cityPlan } from './data/citylayout.mjs';
import { houseDoor, familyOfChar } from './data/birth.mjs';
import { codeFor, keyName } from './data/controls.mjs';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const key = (id) => `<kbd>${esc(keyName(codeFor(id)))}</kbd>`;
const touchScreen = () => matchMedia('(pointer: coarse)').matches;

// Where things are in a great city (in the world): the shrine in the middle, an Academy door,
// a shop door on the market street, and your family's front door
function cityTargets(cityId, character) {
  const place = PLACES.find((p) => p.id === cityId);
  if (!place) return null;
  const c = toWorld(place.px, place.py);
  const plan = cityPlan();
  const front = (b) => ({ x: c.x + b.x + (b.door?.x || 0) + b.fx * (b.d / 2 + 2), z: c.z + b.z + (b.door?.z || 0) + b.fz * (b.d / 2 + 2) });
  const food = plan.shops.find((s) => s.id === 'city_food') || plan.shops[0];
  const fam = familyOfChar(character);
  const home = fam && fam.city === cityId ? houseDoor(fam.city, fam.house) : null;
  return {
    name: place.name,
    centre: { x: c.x, z: c.z },
    shrine: { x: c.x, z: c.z },
    academy: plan.academies[0] && front(plan.academies[0]),
    shop: food && front(food),
    home: home && { x: home.x, z: home.z },
  };
}

// the city to guide you round: your family's (a child), or the nearest great city
function pickCity(character, at) {
  const fam = familyOfChar(character);
  if (character.child && fam && PLACES.some((p) => p.id === fam.city)) return fam.city;
  let best = null, bd = Infinity;
  for (const p of PLACES) {
    if (!p.city) continue;
    const c = toWorld(p.px, p.py);
    const d = Math.hypot(c.x - at.x, c.z - at.z);
    if (d < bd) { bd = d; best = p; }
  }
  return best && bd < 1500 ? best.id : null;
}

// The steps. `when` is what ends a step: 'next' (its button), 'moved', a window opening
// ({ panel }), an event in the world ({ event, test }), or reaching its target ({ near }).
function buildSteps(character, T) {
  const child = !!character.child;
  const move = touchScreen()
    ? 'Drag your thumb on the <b>left half</b> of the screen to walk. Push further to run. The round button on the right jumps.'
    : `Walk with ${key('forward')} ${key('left')} ${key('back')} ${key('right')} (or the arrow keys). Hold ${key('run')} to run and press ${key('jump')} to jump.`;
  const look = touchScreen()
    ? 'Drag on the <b>right half</b> of the screen to turn the camera. Pinch to zoom in and out.'
    : 'Click the game once, then move the mouse to look around. Scroll to zoom in and out (all the way in is first person).';
  const steps = [
    { id: 'hello', title: 'Welcome to the realm', text: `${child ? 'You were just born into a family of this city, and you are 4 years old.' : 'This is your first time in the realm.'} This short guide shows you around. A gold arrow on this card and a beam of light will show you where to go.`, when: 'next', button: 'Show me' },
    { id: 'move', title: 'Walking', text: `${move} Take a few steps now.`, when: 'moved' },
    { id: 'look', title: 'Looking around', text: look, when: 'next' },
  ];
  if (child && T?.home) steps.push({ id: 'parents', title: 'Your parents', text: `Your parents are standing by your front door. Walk up to one of them and press ${key('interact')} to talk. Visit them often: they will miss you if you stay away too long.`, target: T.home, label: 'Your home', when: { event: 'npc', test: (d) => d?.kind === 'parent' && d.mine } });
  steps.push(
    { id: 'status', title: 'Your Status', text: `Press ${key('status')} (or open the ☰ menu and tap Status). It shows your level, HP, SP, your stats and your Unique Skill. When you have Stat Points, place them with the + buttons: once confirmed they stay for good.`, point: '.menu-btn', when: { panel: 'status' } },
    { id: 'bars', title: 'Your bars', text: 'The card at the top left shows your <b>HP</b> (health), <b>SP</b> (for skills), <b>Fatigue</b> (sleep before it fills), <b>Hunger</b> (eat before it empties) and <b>EXP</b> (fill it to gain a level).', point: '.hud-card', when: 'next' },
    { id: 'bag', title: 'Your Bag', text: `Press ${key('bag')} to open your Bag. Your items and what you wear are in it. ${child ? 'Your family packed you bread, water and tea: tap one to eat or drink it when you are hungry.' : 'Tap an item to use it or put it on.'}`, point: '.menu-btn', when: { panel: 'bag' } },
    { id: 'map', title: 'The map', text: `The little map in the corner turns with you. Tap it, or press ${key('map')}, for the world map.`, point: '#minimap', when: { panel: 'map' } },
  );
  steps.push(
    { id: 'buy', title: 'The Shop', text: `Press ${key('shop')} anywhere to open the Shop window. Better gear unlocks as your level rises. Selling gives back less than you paid.`, when: { panel: 'shop' }, button: 'Next' },
    { id: 'quests', title: 'Quests', text: `Press ${key('quests')} for Quests. Take one on, do what it asks, then come back to claim the reward in EXP and coins.`, point: '.menu-btn', when: { panel: 'quests' } },
  );
  steps.push(
    { id: 'settings', title: 'Settings', text: `Press ${key('settings')} for Settings: the camera, the keys, graphics and your account. You can play this guide again from there.`, when: { panel: 'settings' }, button: 'Next' },
    { id: 'done', title: 'You are ready', text: `Your first goal now shows at the top of the screen, with an arrow pointing the way. Be careful out there. Night is dangerous away from the city lights, and your lives are few. All the keys are in the Key Guide (${key('help')}). Good luck!`, when: 'next', button: 'Finish' },
  );
  return steps;
}

// The tutorial itself. `host` is the game screen; `getWorld()` the running world (see world.js
// guideView and setGuide); `onEnd(finished)` is called once when it is finished or skipped.
export function startTutorial(host, { character, getWorld, onEnd, storeKey }) {
  const world0 = getWorld();
  const at = world0?.guideView?.() || character.location || { x: 0, z: 0 };
  const cityId = pickCity(character, at);
  const T = cityId ? cityTargets(cityId, character) : null;
  const steps = buildSteps(character, T);
  let index = 0;
  try { const saved = Number(localStorage.getItem(storeKey)); if (saved > 0 && saved < steps.length) index = saved; } catch { /* private window */ }

  const card = document.createElement('div');
  card.className = 'tut-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Tutorial');
  const pointer = document.createElement('div');
  pointer.className = 'tut-pointer hidden';
  pointer.setAttribute('aria-hidden', 'true');
  host.append(card, pointer);

  let startPos = null, ended = false, raf = 0, lastText = '';
  const step = () => steps[index];

  function draw() {
    const s = step();
    const w = s.when;
    const showNext = w === 'next' || s.button;
    card.innerHTML = `
      <div class="tut-top"><span class="tut-count">${index + 1} / ${steps.length}</span><button type="button" class="tut-skip" data-tut-skip>Skip tutorial</button></div>
      <div class="tut-body">
        ${s.target ? '<div class="tut-compass"><svg class="tut-arrow" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 33 34 20 26 7 34Z"/></svg><span class="tut-dist"></span></div>' : ''}
        <div class="tut-words"><h3>${esc(s.title)}</h3><p>${s.text}</p>${s.target ? `<p class="tut-where"></p>` : ''}</div>
      </div>
      ${showNext ? `<div class="tut-actions"><button type="button" class="gold-button" data-tut-next>${esc(s.button || 'Next')}</button></div>` : ''}`;
    lastText = '';
    startPos = null;
    getWorld()?.setGuide?.(s.target || null);
    try { localStorage.setItem(storeKey, String(index)); } catch { /* private window */ }
  }

  function advance() {
    if (ended) return;
    index++;
    if (index >= steps.length) { end(true); return; }
    draw();
  }

  function end(finished) {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    getWorld()?.setGuide?.(null);
    card.remove(); pointer.remove();
    try { localStorage.removeItem(storeKey); } catch { /* private window */ }
    onEnd?.(finished);
  }

  card.addEventListener('click', (e) => {
    if (e.target.closest('[data-tut-skip]')) end(false);
    else if (e.target.closest('[data-tut-next]')) advance();
  });
  // keep clicks on the card from reaching the game (which would capture the mouse)
  for (const type of ['pointerdown', 'mousedown', 'touchstart']) card.addEventListener(type, (e) => e.stopPropagation(), { passive: true });

  // each frame: the arrow, the distance, the pointer at a button, and whether you've walked
  function tick() {
    raf = requestAnimationFrame(tick);
    const s = step();
    const world = getWorld();
    const v = world?.guideView?.();
    if (v && s.when === 'moved') {
      if (!startPos) startPos = { x: v.x, z: v.z };
      else if (Math.hypot(v.x - startPos.x, v.z - startPos.z) > 5) { advance(); return; }
    }
    if (s.target && v) {
      const where = card.querySelector('.tut-where'), arrow = card.querySelector('.tut-arrow'), dist = card.querySelector('.tut-dist');
      const dx = s.target.x - v.x, dz = s.target.z - v.z, d = Math.hypot(dx, dz);
      if (s.when.near && !v.inside && !v.depth && d < s.when.near) { advance(); return; }
      // the camera looks along (-sin yaw, -cos yaw); its right is (cos yaw, -sin yaw)
      const fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw);
      const ang = Math.atan2(dx * -fz + dz * fx, dx * fx + dz * fz);
      if (arrow) arrow.style.transform = `rotate(${ang}rad)`;
      const text = v.inside ? 'Step outside first, then follow the arrow.' : v.depth ? 'Climb back up to the surface first.' : `${s.label}: ${d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`} away`;
      if (text !== lastText) { lastText = text; if (where) where.textContent = text; if (dist) dist.textContent = d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`; }
    }
    // the bouncing pointer next to the button a step is about
    const el = s.point && !document.querySelector('#overlay:not(.hidden)') ? document.querySelector(s.point) : null;
    const r = el?.getBoundingClientRect();
    if (r && r.width) {
      const hr = host.getBoundingClientRect();
      // point from below the button (from its left when it sits at the very top right)
      pointer.classList.remove('hidden');
      pointer.style.left = `${r.left - hr.left + r.width / 2}px`;
      pointer.style.top = `${r.bottom - hr.top + 6}px`;
    } else pointer.classList.add('hidden');
  }

  draw();
  raf = requestAnimationFrame(tick);

  return {
    // a window opened (`panel`), or something happened in the world (from main.js onEvent)
    saw(kind, data) {
      if (ended) return;
      const s = step(), w = s.when;
      if (!w || typeof w !== 'object') return;
      if (kind === 'panel' && (w.panel === data || w.panels?.includes(data))) { advance(); return; }
      if (kind !== 'panel') {
        if (w.event === kind && (!w.test || w.test(data))) { advance(); return; }
        for (const [ev, test] of w.events || []) if (ev === kind && (!test || test(data))) { advance(); return; }
      }
    },
    // the world was rebuilt (for example after dying): put the beam back
    refresh() { if (!ended) getWorld()?.setGuide?.(step().target || null); },
    stop: () => end(false),
    get running() { return !ended; },
  };
}
