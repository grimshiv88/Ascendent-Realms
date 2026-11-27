// The first journey: after the tutorial, a newcomer is led through their first days by a goal at the
// top of the screen (with a gold arrow, the distance, and the beam of light over the spot) and a
// notice that pops up at each new place explaining it. For a child: Academy Street, joining an
// Academy, a walk round the city (the market street, the Real Estate office, the Bank, the playground,
// the Dump's checkpoint), growing up, the Ceremony at the shrine when they turn 7, then out of the
// gates into the wilds to hunt a first goblin or slime. A grown newcomer starts at the city walk.
//
// Progress is kept on the character (`character.journey`: { seen: [step ids], off }), so it carries
// on after a reload or on another device. It never says what a character will become later on.
import { PLACES, toWorld } from './data/world-layout.mjs';
import { cityPlan, ESTATE_ID, BANK_ID } from './data/citylayout.mjs';
import { CITY_R } from './data/citylevels.mjs';
import { familyOfChar, SCHOOLS, ceremonyDue, isChild } from './data/birth.mjs';
import { CLASSES } from './data/game-data.mjs';
import { codeFor, keyName } from './data/controls.mjs';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const key = (id) => `<kbd>${esc(keyName(codeFor(id)))}</kbd>`;
const metres = (d) => (d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`);

// How each class fights its first monster (what its Academy trained it for)
const FIGHT = {
  swordsman: () => `Close in and cut with your sword (${key('attack')} or click). Keep moving round it so it can't land a blow.`,
  tank: () => 'Let it come to you. Take the blow on your shield and strike back: you can take far more hits than most.',
  assassin: () => 'Creep up behind it before you strike: hits from behind do far more damage.',
  healer: () => 'Fight with care and keep your HP up: heal yourself with your skills between blows.',
  mage: () => `Stay back and cast with your staff (${key('attack')} casts, ${key('spell')} changes spell). Keep your distance.`,
  blacksmith: () => `Swing hard with your hammer or blade (${key('attack')}). Your strong arms hit hard.`,
  builder: () => `Hit hard and steady (${key('attack')}). You are tough: stand your ground.`,
  farmer: () => `Strike with what you carry (${key('attack')}). You are sturdy and can take a few hits.`,
  potion_maker: () => `Strike (${key('attack')}) and drink a potion from your Bag (${key('bag')}) when your HP runs low.`,
  businessman: () => `Strike quickly (${key('attack')}) and step back. Buy a better weapon from the Shop (${key('shop')}) when you can.`,
};
const fightTip = (cls) => (FIGHT[cls] || (() => `Attack with ${key('attack')} or a click, and eat or drink from your Bag when HP runs low.`))();

// Where the journey's places are in a great city (in the world)
export function placesOf(cityId) {
  const place = PLACES.find((p) => p.id === cityId);
  if (!place) return null;
  const c = toWorld(place.px, place.py);
  const plan = cityPlan();
  const at = (x, z) => ({ x: c.x + x, z: c.z + z });
  const front = (b) => b && at(b.x + (b.door?.x || 0) + b.fx * (b.d / 2 + 2), b.z + (b.door?.z || 0) + b.fz * (b.d / 2 + 2));
  const shop = (id) => front(plan.shops.find((s) => s.id === id));
  const mid = plan.academies[Math.floor(plan.academies.length / 2)];
  return {
    name: place.name,
    street: front(mid),
    market: shop('city_food'),
    estate: shop(ESTATE_ID),
    bank: shop(BANK_ID),
    playground: plan.playground && at(plan.playground.x, plan.playground.z),
    checkpoint: plan.checkpoint && at(plan.checkpoint.x, plan.checkpoint.z),
    shrine: at(0, 0),
    // out of the south gate, along the road, to where the wilds begin
    wilds: at(0, CITY_R + 90),
  };
}

function cityFor(character, at) {
  const fam = familyOfChar(character);
  if (fam && PLACES.some((p) => p.id === fam.city && p.city)) return fam.city;
  let best = null, bd = Infinity;
  for (const p of PLACES) {
    if (!p.city) continue;
    const c = toWorld(p.px, p.py);
    const d = Math.hypot(c.x - at.x, c.z - at.z);
    if (d < bd) { bd = d; best = p; }
  }
  return best && bd < 1500 ? best.id : null;
}

// The steps, in order. The goal shown is the first step not done yet.
//   goal: the line at the top · target: where the arrow points · near: reached within this many metres
//   reach: the notice shown when you get there (then the step is done)
//   done(): done some other way · skip(): not for this character
function buildSteps(c, P) {
  const school = () => c.child?.school && SCHOOLS[c.child.school];
  return [
    { id: 'street', child: true, goal: 'Go to Academy Street', target: P.street, near: 22,
      skip: () => !isChild(c) || !!school(),
      reach: { title: 'Academy Street', text: `Here stand the Academies, one for every way of life: the Sword, the Shield, the Scouts, Healing, Magic, the Smiths, the Builders, the Herbalists, the Farmers and the Merchants. <b>Find the Academy you wish to join.</b> Walk in and register at the counter (${key('interact')}).` } },
    { id: 'join', child: true, goal: 'Find the Academy you wish to join and register at its counter', target: P.street,
      skip: () => !isChild(c), done: () => !!school(),
      after: () => ({ title: `Welcome to the ${school().academy}`, text: `${esc(school().text)} Stand on the red mat beside your teacher to train. Here you learn to fight the way of your school, and the more you train, the likelier you are to be given this class at your Ceremony.` }) },
    { id: 'market', goal: 'See the market street', target: P.market, near: 14,
      reach: { title: 'The market street', text: `The city's own shops: food, potions, a tailor, a smith, an armoury and the tavern. Walk up to a counter and press ${key('interact')} to buy. All food and drink here is halal. Sell for less than you paid.` } },
    { id: 'estate', goal: 'Visit the Real Estate office', target: P.estate, near: 14,
      reach: { title: 'The Real Estate office', text: 'Houses for sale in every quarter of the city are bought here, once you have the coins. A house of your own lets you into its quarter of the city.' } },
    { id: 'bank', goal: 'Find the city Bank', target: P.bank, near: 14,
      reach: { title: 'The Bank', text: 'Keep your coins safe here, and change Copper for Silver and Gold.' } },
    { id: 'playground', child: true, goal: 'Find the playground', target: P.playground, near: 16, skip: () => !isChild(c),
      reach: { title: 'The playground', text: 'The city\'s children play here. Come by between lessons.' } },
    { id: 'checkpoint', goal: 'Find the checkpoint in the Dump', target: P.checkpoint, near: 14,
      reach: { title: 'The checkpoint', text: 'This waystone in the Dump, by the south road, is where you rise again if you fall. The Dump is the poorest quarter: mind your coins.' } },
    { id: 'grow', child: true, goal: 'Train at your Academy and visit your parents until you turn 7', skip: () => !isChild(c), done: () => ceremonyDue(c) || !isChild(c),
      after: () => ({ title: 'You are 7!', text: 'Today is the day of your Ceremony of Revealing. Follow the arrow up to the shrine at the top of the city: the guards will let you through.' }) },
    { id: 'shrine', child: true, goal: 'Go to the shrine for your Ceremony', target: P.shrine, done: () => !isChild(c), skip: () => !isChild(c) && !c.journey?.seen?.includes('grow'),
      after: () => ({ title: `You are a ${esc(CLASSES[c.cls]?.name || 'grown-up')}!`, text: 'Your class is revealed and your childhood is over. Now the world beyond the walls is open to you.' }) },
    { id: 'wilds', goal: 'Leave the city by the south gate', target: P.wilds, near: 30, skip: () => isChild(c),
      reach: { title: 'The wilds', text: `Beyond the walls monsters roam, and nights are dangerous away from the light. <b>Hunt your first monster: a goblin or a slime.</b> ${fightTip(c.cls)}` } },
    { id: 'hunt', goal: 'Defeat a goblin or a slime', skip: () => isChild(c), event: 'kill',
      after: () => ({ title: 'Your first kill!', text: `Your journey has begun. Take on Quests (${key('quests')}) for EXP and coins, train your skills, and come back to the city to rest, eat and trade. Good luck!` }) },
  ];
}

// `host` is the game screen. `getWorld()` the running world; `game` the progress (setJourney);
// `paused()` true while something else (the tutorial) has the screen.
export function startJourney(host, { character, game, getWorld, paused }) {
  const c = character;
  const v0 = getWorld()?.guideView?.() || c.location || { x: 0, z: 0 };
  const cityId = cityFor(c, v0);
  const P = cityId ? placesOf(cityId) : null;
  if (!P || !c.journey || c.journey.off) return null;
  const steps = buildSteps(c, P);
  const seen = new Set(c.journey.seen || []);
  const save = () => { c.journey = { seen: [...seen], off: !!c.journey?.off }; game.setJourney?.(c.journey); };

  const bar = document.createElement('div');
  bar.className = 'journey-goal hidden';
  bar.setAttribute('aria-live', 'polite');
  const toast = document.createElement('div');
  toast.className = 'journey-toast hidden';
  toast.setAttribute('role', 'status');
  host.append(bar, toast);
  let toastTimer = 0;
  function notify(n) {
    if (!n) return;
    toast.innerHTML = `<p class="jt-kicker">New</p><h3>${n.title}</h3><p>${n.text}</p><button type="button" class="jt-ok" data-jt-ok>OK</button>`;
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 25000);
  }
  toast.addEventListener('click', (e) => { if (e.target.closest('[data-jt-ok]')) { clearTimeout(toastTimer); toast.classList.add('hidden'); } });
  for (const type of ['pointerdown', 'mousedown', 'touchstart']) {
    toast.addEventListener(type, (e) => e.stopPropagation(), { passive: true });
    bar.addEventListener(type, (e) => e.stopPropagation(), { passive: true });
  }
  bar.addEventListener('click', (e) => {
    if (!e.target.closest('[data-jg-hide]')) return;
    c.journey = { ...c.journey, off: true }; game.setJourney?.(c.journey);
    stop();
  });

  const current = () => steps.find((s) => !seen.has(s.id) && !s.skip?.());
  let shown = null, lastText = '', guided = undefined, raf = 0, ended = false;
  function finish(s, note) {
    seen.add(s.id); save();
    notify(note);
    shown = null;
  }
  function draw(s) {
    shown = s;
    lastText = '';
    bar.innerHTML = `
      ${s.target ? '<svg class="jg-arrow" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 33 34 20 26 7 34Z"/></svg>' : '<span class="jg-dot" aria-hidden="true">✦</span>'}
      <span class="jg-text"><small>Goal</small><b>${esc(s.goal)}</b><span class="jg-dist"></span></span>
      <button type="button" class="jg-hide" data-jg-hide aria-label="Hide the goals" title="Hide the goals">×</button>`;
  }
  function tick() {
    raf = requestAnimationFrame(tick);
    const world = getWorld();
    if (paused?.()) { bar.classList.add('hidden'); guided = undefined; return; }
    const s = current();
    if (!s) { stop(); return; }
    if (s !== shown) draw(s);
    bar.classList.remove('hidden');
    // done some other way (an Academy joined, grown up)
    if (s.done?.()) { finish(s, s.after?.()); return; }
    const want = s.target || null;
    if (want !== guided) { world?.setGuide?.(want); guided = want; }
    const v = world?.guideView?.();
    if (!s.target || !v) return;
    const dx = s.target.x - v.x, dz = s.target.z - v.z, d = Math.hypot(dx, dz);
    if (s.near && !v.inside && !v.depth && d < s.near) { finish(s, s.reach); return; }
    const fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw);
    const arrow = bar.querySelector('.jg-arrow');
    if (arrow) arrow.style.transform = `rotate(${Math.atan2(dx * -fz + dz * fx, dx * fx + dz * fz)}rad)`;
    const text = v.inside ? 'step outside first' : v.depth ? 'back to the surface first' : metres(d);
    if (text !== lastText) { lastText = text; bar.querySelector('.jg-dist').textContent = text; }
  }
  function stop() {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    if (guided) getWorld()?.setGuide?.(null);
    bar.remove();
    setTimeout(() => toast.remove(), toast.classList.contains("hidden") ? 0 : 25000);
  }
  raf = requestAnimationFrame(tick);
  return {
    // something happened in the world (from main.js onEvent): a monster killed, an Academy entered
    saw(type) {
      if (ended || paused?.()) return;
      const s = current();
      if (s?.event === type) finish(s, s.after?.());
    },
    stop,
    get running() { return !ended; },
  };
}
