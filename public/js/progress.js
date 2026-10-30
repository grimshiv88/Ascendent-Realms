// Your character's progress while playing: HP and SP, EXP and levels, coins, the bag and what you wear.
// Every change is saved to the server a moment later.
import { CLASSES, RACES, KEY_LEVELS, derivedStats, expToNext, mayChangeForm } from './data/game-data.mjs';
import { MINT } from './data/money.mjs';
import { ITEMS, shopFor, RECIPES, SLOTS, isGear, slotOf, sellPrice, upgraded, mergeCost, evolvedName, POTION_MAKER, BREWS, brewCost, brewSeconds, brewHerbs, forgeCost, forgeLevel, workshopLevel, rankOf, gearSkillSlots, mythicSkill, marketStock, marketPrice, MARKETS, BOT_BUY_SHARE } from './data/items.mjs';
import { mergeOutcome } from './data/merges.mjs';
import { deathOutcome, applyRise, livesLeft } from './data/life.mjs';
import { BODYGUARDS, HIRE_SPANS, hireCost, guardActive } from './data/hire.mjs';
import { WEDDING_FEE, ADOPT_FEE, MAX_CHILDREN, newChild, nextChildIn } from './data/family.mjs';
import { canMarry } from './data/life.mjs';
import { ageOf, childStatShare, classOdds, SCHOOLS, TRAIN_FULL_MS, visitDue, CHILD_MAX_LEVEL, TRAIN_EXP, TRAIN_HIT_EXP, TECHNIQUE_AT, SCHOOL_TECHNIQUES } from './data/birth.mjs';
import { PACT_PCT, DARK_MATK_PCT, DARK_SPELL_EVERY, BOOK_ID, bookStops, spellStrength } from './data/cults.mjs';
import { GUILD_HALL_LEVEL, CARD_FEE, assess, mayTake } from './data/guildcard.mjs';
import { fillBoard, progressOf, questsToday, QUESTS_PER_DAY, BOARDS } from './quests.js';
import { rankProofs, TRIAL_LEVEL, UNIQUE_RANKS } from './data/unique.mjs';
import { gameTime, DAY_MS } from './data/clock.mjs';

export const INJURY = {
  leg: { name: 'Broken leg', effect: 'You walk and run at 60% speed and can barely jump.' },
  arm: { name: 'Broken arm', effect: 'ATK and MATK are 30% lower.' },
  ribs: { name: 'Broken ribs', effect: 'Your SP is 30% lower.' },
};
import { BOSS_RETURNS_MS } from './data/depths.mjs';
import { portalById, portalFee } from './data/portals.mjs';
import { actionFor, FIXED_KEYS } from './data/controls.mjs';
import { SKILLS, UPGRADE_EVERY, UPGRADE_STATS, SKILL_BAR, DEFAULT_KEYS, randomSkill } from './data/skills.mjs';
import { SPELLS, randomSpell, staffSlots } from './data/spells.mjs';

const BAG_SLOTS = 30;
const uid = () => `g${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

// Hand out one waiting skill at random, ready on the first free key if the bar has room
function giveSkill(c) {
  const id = randomSkill(c);
  c.skillPicks = Math.max(0, c.skillPicks - 1);
  if (!id) return null;
  c.skills.push(id);
  if (c.skillBar.length < SKILL_BAR) {
    const key = DEFAULT_KEYS.find((k) => !c.skillBar.some((b) => b.key === k)) || null;
    c.skillBar.push({ id, key });
  }
  return id;
}

// Spells due by now. Magic is the Dark Side's alone: joining gives a spell in each of your elements
// at once, then one every 10 levels (and one more for a Mage). Nobody else learns spells.
const magical = (c) => c.pact === 'dark' || c.cls === 'mage';
const spellGap = () => DARK_SPELL_EVERY;
const spellsDue = (c) => (!magical(c) ? 0 : (c.cls === 'mage' ? 1 : 0) + (c.pact === 'dark' ? (c.elements?.length || 1) : 0) + Math.floor(c.level / DARK_SPELL_EVERY));
function giveSpell(c) {
  if (!c.elements?.length) c.elements = [RACES[c.race]?.element].filter(Boolean);
  const id = randomSpell(c);
  if (id) c.spells.push(id);
  return id;
}

export function createProgress(c, { save, onChange, onEvent }) {
  c.inventory ||= [];
  c.equipped = { ...Object.fromEntries(SLOTS.map(([s]) => [s, null])), ...(c.equipped || {}) };
  c.boosts ||= [];
  c.torches ||= [];
  c.tent ??= null; // where your tent is pitched
  c.fatigue ??= 0;
  c.trained = { atk: 0, def: 0, matk: 0, mdef: 0, hp: 0, ...(c.trained || {}) }; // Stat Points put straight into ATK, DEF, MATK, MDEF or HP
  c.caves ??= {}; // cave id -> when you last beat its boss
  c.villages ??= { list: [], due: [] }; // monster villages out in the wilds, and when the next ones appear
  c.potionMaker ??= null; // { until, queue: [{ id, ready }] } while a Businessman has one hired
  // Skills: learned ones, the ones ready on keys (the rest are kept in storage), and choices still to make
  c.skills = (c.skills || []).filter((id) => SKILLS[id]);
  c.techniques = (c.techniques || []).filter((id) => SKILLS[id]); // learned as a child at school
  // (a skill from a Skill Stone in your gear stays on the bar while that gear is off, but only works when worn)
  c.skillBar = (c.skillBar || []).filter((b) => SKILLS[b?.id]);
  c.skillPicks ??= Math.max(0, Math.floor(c.level / UPGRADE_EVERY) - c.skills.length);
  // skills are given, not chosen: any still waiting are handed out now
  while (c.skillPicks > 0 && giveSkill(c));
  // Spells (cast with a staff): catch up on any due
  c.spells = (c.spells || []).filter((id) => SPELLS[id]);
  c.spellPick ??= 0;
  while (c.spells.length < spellsDue(c) && giveSpell(c));
  // time away counts as rest: fatigue falls 2 points per real minute you were gone
  if (c.savedAt) c.fatigue = Math.max(0, c.fatigue - ((Date.now() - c.savedAt) / 60000) * 2);
  // Gear doesn't stack: each piece has its own id so it can be equipped and upgraded
  for (const s of c.inventory) if (isGear(ITEMS[s.id]) && !s.uid) s.uid = uid();
  // older saves stored the equipped weapon by item id
  for (const [slot, v] of Object.entries(c.equipped)) {
    if (v && !c.inventory.some((s) => s.uid === v)) c.equipped[slot] = c.inventory.find((s) => s.id === v)?.uid || null;
  }

  const entry = (key) => c.inventory.find((s) => s.uid === key) || c.inventory.find((s) => !s.uid && s.id === key);
  const gearIn = (slot) => {
    const e = c.equipped[slot] && c.inventory.find((s) => s.uid === c.equipped[slot]);
    return e ? { ...ITEMS[e.id], entry: e, plus: e.plus || 0, coat: e.coat || null } : null;
  };

  // Bonuses from what you wear, and from boosters still running
  function bonus() {
    const b = { atk: 0, matk: 0, def: 0, mdef: 0, sp: 0 };
    for (const [slot] of SLOTS) {
      const g = gearIn(slot);
      if (!g) continue;
      if (g.kind === 'weapon') b[g.magic ? 'matk' : 'atk'] += upgraded(g.power, g.plus);
      else { b.def += upgraded(g.def || 0, g.plus); b.mdef += upgraded(g.mdef || 0, g.plus); }
    }
    const now = Date.now();
    c.boosts = c.boosts.filter((x) => x.until > now);
    for (const x of c.boosts) if (!x.stat) b.sp += x.sp || 0;
    return b;
  }
  function stats() {
    // a child's body is still growing: only part of their stats count yet
    const share = c.child ? childStatShare(ageOf(c)) : 1;
    const base = share === 1 ? c.stats : Object.fromEntries(Object.entries(c.stats).map(([k, v]) => [k, Math.max(1, Math.round(v * share))]));
    const d = derivedStats(base, c.level, c.trained);
    const b = bonus();
    // a broken arm weakens your blows; broken ribs leave you short of breath (less SP)
    const arm = c.injury?.part === 'arm' ? 0.7 : 1, ribs = c.injury?.part === 'ribs' ? 0.7 : 1;
    return { ...d, sp: Math.round((d.sp + b.sp) * ribs), atk: Math.round((d.atk + b.atk) * arm), matk: Math.round((d.matk + b.matk) * arm), def: d.def + b.def, mdef: d.mdef + b.mdef, bonus: b, base: d };
  }
  if (c.hp == null || c.hp > stats().hp) c.hp = stats().hp;
  if (c.sp == null || c.sp > stats().sp) c.sp = stats().sp;

  let saveTimer = null;
  // not enough coins: the game says so on screen
  // Proofs of growth for the Unique Skill's rank (see rankProofs): honest work adds up here
  c.growth = { work: 0, trials: 0, ...(c.growth || {}) };
  // grown before parents needed visiting: their clock starts now
  if (!c.child && !c.visitPlay && !c.grownPlay) c.visitPlay = c.playMs || 0;
  function work(n) {
    c.growth.work += n;
    const u = c.uniqueSkill;
    if (u && rankProofs(c).total > (u.raised || 0) && UNIQUE_RANKS.indexOf(u.born || u.rank) + (u.raised || 0) < UNIQUE_RANKS.length - 1) onEvent?.('rank-due');
  }
  const poor = (need) => { onEvent?.('no-funds', { need, have: c.coins }); return 'coins'; };
  function changed(what) {
    onChange?.(what);
    // saved at most every 1.5 s, so a steady trickle of changes (SP coming back) still gets saved
    saveTimer ??= setTimeout(() => { saveTimer = null; save?.(snapshot()); }, 1500);
  }
  const snapshot = () => ({
    level: c.level, exp: c.exp, coins: c.coins, hp: Math.round(c.hp), sp: Math.round(c.sp), stats: c.stats,
    unspentPoints: c.unspentPoints, uniquePoints: c.uniquePoints, inventory: c.inventory, equipped: c.equipped, boosts: c.boosts,
    room: c.room || null, guildQuests: c.guildQuests || [], guildNext: c.guildNext || 0, quests: c.quests, questNext: c.questNext || 0, questDay: c.questDay || null, fatigue: Math.round(c.fatigue), torches: c.torches, savedAt: Date.now(), injury: c.injury || null, growth: c.growth, visitPlay: c.visitPlay || 0, neglect: !!c.neglect, guard: c.guard || null, spouse: c.spouse || null, children: c.children || [], lastChildPlay: c.lastChildPlay || 0, livesLeft: livesLeft(c), ageShift: c.ageShift || 0, techniques: c.techniques,
    spells: c.spells, spellPick: c.spellPick, skills: c.skills, skillBar: c.skillBar, skillPicks: c.skillPicks, tent: c.tent, potionMaker: c.potionMaker, trained: c.trained, caves: c.caves, villages: c.villages, form: c.form, guildCard: c.guildCard || null, playMs: c.playMs || 0, pact: c.pact || null, child: c.child || null,
  });

  // worn gear doesn't take up room in the bag
  const used = () => c.inventory.filter((s) => !(s.uid && Object.values(c.equipped).includes(s.uid))).length;
  const count = (id) => c.inventory.reduce((n, s) => n + (s.id === id ? s.n : 0), 0);
  function addItem(id, n = 1, plus = 0) {
    const it = ITEMS[id];
    if (isGear(it)) {
      for (let i = 0; i < n; i++) {
        if (used() >= BAG_SLOTS) { onEvent?.('bag-full'); return false; }
        c.inventory.push({ id, n: 1, uid: uid(), ...(plus ? { plus } : {}) });
      }
    } else {
      const slot = c.inventory.find((s) => s.id === id);
      if (slot) slot.n += n;
      else if (used() < BAG_SLOTS) c.inventory.push({ id, n });
      else { onEvent?.('bag-full'); return false; }
    }
    changed('bag');
    return true;
  }
  // `key` is a gear piece's uid, or a stackable item's id
  function removeItem(key, n = 1) {
    const e = entry(key);
    if (!e || e.n < n) return false;
    e.n -= n;
    if (e.n === 0) {
      c.inventory.splice(c.inventory.indexOf(e), 1);
      // Skill Stones in a piece that's gone (sold, merged, dropped) come back to the bag
      for (const id of e.skills || []) { const st = c.inventory.find((x) => x.id === `stone_${id}`); if (st) st.n += 1; else c.inventory.push({ id: `stone_${id}`, n: 1 }); }
      for (const [slot, v] of Object.entries(c.equipped)) if (e.uid && v === e.uid) c.equipped[slot] = null;
    }
    changed('bag');
    return true;
  }

  return {
    character: c,
    bagSlots: BAG_SLOTS,
    stats,
    count,
    entry,
    addItem,
    removeItem,
    // a whole piece of gear leaving the bag as it is (onto a display stand), and coming back
    takeOut(key) {
      const e = entry(key);
      if (!e?.uid) return null;
      c.inventory.splice(c.inventory.indexOf(e), 1);
      for (const [slot, v] of Object.entries(c.equipped)) if (v === e.uid) c.equipped[slot] = null;
      changed('bag');
      return e;
    },
    putBack(e) {
      if (e.uid && c.inventory.some((x) => x.uid === e.uid)) return true;
      if (used() >= BAG_SLOTS) return false;
      c.inventory.push({ ...e, n: 1 });
      changed('bag');
      return true;
    },
    bagFull: () => used() >= BAG_SLOTS,
    // Mint every piece of one ore you carry into coins (see data/money.mjs MINT); returns the Copper made
    mint(id) {
      const n = count(id);
      if (!MINT[id] || !n) return 0;
      removeItem(id, n);
      const made = n * MINT[id];
      c.coins += made;
      changed('coins');
      return made;
    },
    gearIn,
    weapon: () => gearIn('weapon'),
    isEquipped: (e) => !!e.uid && Object.values(c.equipped).includes(e.uid),
    // What to draw on the character: { weapon: item, head: item, ... }
    worn() {
      const out = {};
      for (const [slot] of SLOTS) { const g = gearIn(slot); if (g) out[slot] = g; }
      return out;
    },

    equip(key) {
      const e = entry(key);
      const it = e && ITEMS[e.id];
      if (!isGear(it)) return;
      const slot = slotOf(it);
      c.equipped[slot] = c.equipped[slot] === e.uid ? null : e.uid;
      changed('gear');
    },
    use(key) {
      const e = entry(key);
      const it = e && ITEMS[e.id];
      if (it?.kind !== 'food') return;
      removeItem(key, 1);
      if (it.boost) c.boosts.push({ sp: it.boost.sp, until: Date.now() + it.boost.minutes * 60000 });
      if (it.buff) {
        // the same kind of potion doesn't stack: drinking another starts the time again
        c.boosts = c.boosts.filter((x) => x.stat !== it.buff.stat);
        c.boosts.push({ stat: it.buff.stat, pct: it.buff.pct, until: Date.now() + it.buff.minutes * 60000 });
      }
      if (it.rest) c.fatigue = Math.max(0, c.fatigue - it.rest);
      if (it.heal) c.hp = Math.min(stats().hp, c.hp + it.heal);
      if (it.sp) c.sp = Math.min(stats().sp, c.sp + it.sp);
      changed('hp');
    },

    // Shop: buying needs the level and the coins; selling pays less than the shop asks
    // buy from the ordinary shop, or from a market (by its id) when standing at one
    buy(id, market = null) {
      const unlock = shopFor(c).find(([sid]) => sid === id)?.[1] ?? Infinity;
      const it = ITEMS[id];
      if (market ? !marketStock(market, c.level).includes(id) : c.level < unlock) return 'locked';
      const price = market ? marketPrice(market, id) : it.price;
      if (c.coins < price) return poor(price);
      if (!addItem(id, 1)) return 'full';
      c.coins -= price;
      changed('coins');
      return 'ok';
    },
    // ---------- spells on a staff ----------
    // the staff in your hand: its spells and how many it can hold
    staff() {
      const w = gearIn('weapon');
      if (!w || w.type !== 'staff') return null;
      const slots = staffSlots(rankOf(w, w.plus));
      // a staff picked up for the first time comes with your first spells on it
      w.entry.spells = w.entry.spells ? w.entry.spells.filter((id) => c.spells.includes(id)) : c.spells.slice(0, slots);
      return { entry: w.entry, spells: w.entry.spells, slots };
    },
    attachSpell(id) {
      const st = this.staff();
      if (!st) return 'staff';
      if (!c.spells.includes(id)) return 'pick';
      if (st.spells.includes(id)) return 'have';
      if (st.spells.length >= st.slots) return 'full';
      st.entry.spells.push(id);
      changed('gear');
      return 'ok';
    },
    detachSpell(id) {
      const st = this.staff();
      if (!st) return 'staff';
      st.entry.spells = st.spells.filter((x) => x !== id);
      changed('gear');
      return 'ok';
    },
    // the spell the attack key casts, and changing it
    chosenSpell() {
      const st = this.staff();
      if (!st?.spells.length) return null;
      return SPELLS[st.spells[c.spellPick % st.spells.length]];
    },
    nextSpell() {
      const st = this.staff();
      if (!st?.spells.length) return null;
      c.spellPick = (c.spellPick + 1) % st.spells.length;
      return SPELLS[st.spells[c.spellPick]];
    },
    // A tavern room: rented for a day of the realm. Sleeping in it restores everything.
    // ---- Falls and broken bones ----
    // A fall hurts past a safe height that grows with your size. Big, high-level and high-DEF bodies
    // take much less from the same drop. A bad one can break a bone, which needs treating at
    // The Green Vial once a day until it mends (a leg: 3 treatments, an arm or ribs: 2).
    fall(fell, bodyH = 1.75) {
      const s = stats();
      const safe = Math.max(4, bodyH * 2.3);
      if (fell <= safe) return null;
      const tough = (bodyH / 1.75) ** 1.5 * (1 + c.level / 150) * (1 + s.def / 150);
      const frac = Math.min(1.2, ((fell - safe) * 0.035) / tough);
      const dmg = Math.round(s.hp * frac);
      let broke = null;
      if (frac >= 0.25 && Math.random() < Math.min(0.9, frac * 1.5)) {
        if (c.injury) c.injury.left = Math.min(5, c.injury.left + 1); // landing on it again sets it back
        else {
          const r = Math.random();
          const part = r < 0.6 ? 'leg' : r < 0.85 ? 'arm' : 'ribs';
          c.injury = { part, left: part === 'leg' ? 3 : 2, lastTreat: 0 };
          broke = part;
        }
        changed('hp');
      }
      return { dmg, broke };
    },
    injury() {
      const j = c.injury;
      if (!j) return null;
      const wait = Math.max(0, j.lastTreat + DAY_MS - Date.now());
      return { ...j, name: INJURY[j.part].name, effect: INJURY[j.part].effect, price: this.treatPrice(), waitMin: Math.ceil(wait / 60000) };
    },
    treatPrice: () => 150 + c.level * 8,
    // one treatment a day of the realm; the last one mends the bone
    treat() {
      const j = c.injury;
      if (!j) return 'none';
      if (j.lastTreat + DAY_MS > Date.now()) return 'wait';
      const price = this.treatPrice();
      if (c.coins < price) return poor(price);
      c.coins -= price;
      j.left -= 1; j.lastTreat = Date.now();
      if (j.left <= 0) c.injury = null;
      if (c.hp > stats().hp) c.hp = stats().hp;
      changed('coins');
      return c.injury ? 'treated' : 'healed';
    },
    // a broken leg slows you down
    // a seal just broke, or something else may have earned a proof: see if a rank climb is due
    checkRank() { work(0); },
    injurySpeed: () => (c.injury?.part === 'leg' ? 0.6 : 1),

    roomPrice: () => 20 + c.level * 2,
    room: () => (c.room?.until > Date.now() ? { minutes: Math.ceil((c.room.until - Date.now()) / 60000), n: c.room.n || 1 } : null),
    rentRoom() {
      if (this.room()) return 'have';
      const price = this.roomPrice();
      if (c.coins < price) return poor(price);
      c.coins -= price;
      c.room = { until: Date.now() + DAY_MS, n: 1 + Math.floor(Math.random() * 3) }; // one of the three rooms upstairs
      changed('coins');
      return 'ok';
    },
    // A drink ordered at the tavern counter: paid now, brought to you by the waiter (see serve)
    order(id, market) {
      const it = ITEMS[id];
      if (!it || !marketStock(market, c.level).includes(id)) return 'locked';
      const price = marketPrice(market, id);
      if (c.coins < price) return poor(price);
      c.coins -= price;
      changed('coins');
      return 'ok';
    },
    // the waiter brings it: you drink it at once (it does what it would from the bag, and a fresh
    // drink at the table gives a little more)
    serve(id) {
      const it = ITEMS[id];
      if (!it) return;
      if (it.heal) c.hp = Math.min(stats().hp, c.hp + Math.round(it.heal * 1.25));
      if (it.sp) c.sp = Math.min(stats().sp, c.sp + Math.round(it.sp * 1.25));
      if (it.rest) c.fatigue = Math.max(0, c.fatigue - it.rest);
      if (it.boost) c.boosts.push({ sp: it.boost.sp, until: Date.now() + it.boost.minutes * 60000 });
      changed('hp');
    },
    sleepInRoom() {
      if (!this.room()) return 'none';
      const s = this.stats();
      c.hp = s.hp; c.sp = s.sp; c.fatigue = 0;
      changed('hp');
      return 'ok';
    },
    // the city's own shops (bots) pay less than ordinary shops
    sellPrice: (e, market = null) => Math.max(1, Math.floor(sellPrice(ITEMS[e.id], e.plus || 0, c.cls) * (MARKETS[market]?.bot ? BOT_BUY_SHARE : 1))),
    // sells `n` of an item (all of them when n is left out); returns the coins earned
    sell(key, n = 1, market = null) {
      const e = entry(key);
      if (!e || ITEMS[e.id]?.bound) return 0;
      n = Math.min(n ?? e.n, e.n);
      const price = this.sellPrice(e, market);
      if (!removeItem(key, n)) return 0;
      c.coins += price * n;
      work(3 * n);
      changed('coins');
      return price * n;
    },
    canCraft: (r) => r.needs.every(([id, n]) => count(id) >= n),
    craft(r) {
      if (!r.needs.every(([id, n]) => count(id) >= n)) return;
      for (const [id, n] of r.needs) removeItem(id, n);
      addItem(r.makes, 1);
    },
    recipes: RECIPES,

    // A potion's strength still running: % more ATK, DEF or speed
    boostPct(stat) {
      const now = Date.now();
      // a cult's dark pact strengthens attacks and magic for good
      const pact = c.pact !== 'dark' ? 0 : stat === 'atk' ? PACT_PCT : stat === 'matk' ? DARK_MATK_PCT : 0;
      return pact + c.boosts.reduce((n, x) => (x.stat === stat && x.until > now ? n + x.pct : n), 0);
    },
    // The reward for answering a cult: { pact: 'dark', coins } (and magic: the spells now due) or
    // { pact: 'holy', book: true }. Returns the spells it gave.
    takePact(r) {
      if (!r) return [];
      c.pact = r.pact;
      if (r.coins) c.coins += r.coins;
      if (r.book && !count(BOOK_ID)) addItem(BOOK_ID, 1);
      const given = [];
      let id;
      while (c.spells.length < spellsDue(c) && (id = giveSpell(c))) given.push(id);
      changed('coins'); changed('stats'); changed('bag');
      return given;
    },
    // A Dark Side spell hits you (once players can fight each other): the Book of the Dawn stops all
    // or part of it. Returns the damage left.
    darkSpellHit(dmg, casterInt, power) {
      if (!count(BOOK_ID)) return dmg;
      return Math.round(dmg * (1 - bookStops(c.stats.int, spellStrength(casterInt, power))));
    },
    // ---------- childhood ----------
    age: () => ageOf(c),
    // choose the school to train at (training already done at others is kept)
    setSchool(cls) { if (c.child && SCHOOLS[cls]) { c.child.school = cls; changed('child'); } },
    // time spent training at your school, while at the Academy
    // a minute (or `ms`) of training on your Academy's training mat: it counts towards your class, raises
    // your level (up to CHILD_MAX_LEVEL) and in time teaches the school's techniques
    train(ms) {
      const school = c.child?.school;
      if (!school) return;
      c.child.train ||= {};
      c.child.train[school] = Math.min(TRAIN_FULL_MS, (c.child.train[school] || 0) + ms);
      if (c.level < CHILD_MAX_LEVEL) this.gainExp(Math.max(1, Math.round(expToNext(c.level, c.race) * TRAIN_EXP * (ms / 60000))));
      const done = c.child.train[school] / TRAIN_FULL_MS;
      (SCHOOL_TECHNIQUES[school] || []).forEach((id, i) => {
        if (done >= TECHNIQUE_AT[i] && !c.techniques.includes(id)) { c.techniques.push(id); onEvent?.('technique', { id }); }
      });
      changed('child');
    },
    // a swing at practice on your Academy's mat: a little EXP each time (up to CHILD_MAX_LEVEL).
    // Returns the EXP gained.
    trainHit() {
      if (!c.child?.school || c.level >= CHILD_MAX_LEVEL) return 0;
      const exp = Math.max(1, Math.round(expToNext(c.level, c.race) * TRAIN_HIT_EXP));
      this.gainExp(exp);
      return exp;
    },
    classOdds: () => classOdds(c),
    // the Ceremony is over: the grown-up character from the server takes the child's place
    grownUp(g) {
      Object.assign(c, { cls: g.cls, stats: g.stats, elements: g.elements, inventory: g.inventory, grown: g.grown });
      delete c.child;
      changed('stats'); changed('bag'); changed('form');
    },
    // Joined the Dark Side and took the Mage class (the server has done the same)
    becameMage(cls, stats) {
      c.cls = cls;
      c.stats = { ...c.stats, ...stats };
      let id;
      while (c.spells.length < spellsDue(c) && (id = giveSpell(c))) onEvent?.('spell', { id });
      changed('stats');
    },
    // Stripped by the cult: its powers go, and every coin it gave (as far as you have them)
    loseCult(coins) {
      c.pact = null;
      c.coins = Math.max(0, c.coins - (coins || 0));
      changed('coins');
    },

    // Blacksmiths merge two pieces of the same sub-category (see the merge book in merges.mjs): the
    // first becomes what the pair makes, the second is used up. Every merge costs coins (and monster
    // parts from Uncommon up), priced by what comes out.
    canMerge: () => c.cls === 'blacksmith',
    mergeCost(aKey, bKey) {
      const a = entry(aKey), b = bKey ? entry(bKey) : null;
      if (!a) return null;
      const out = b && a !== b ? mergeOutcome(a, b) : null;
      return out ? mergeCost(ITEMS[out.id], Math.max(0, out.plus - 1)) : mergeCost(ITEMS[a.id], a.plus || 0);
    },
    canPay: (cost) => c.coins >= cost.coins && cost.needs.every(([id, n]) => count(id) >= n),
    mergePreview(aKey, bKey) {
      const a = entry(aKey), b = entry(bKey);
      if (!a || !b || a === b) return null;
      return mergeOutcome(a, b);
    },
    merge(aKey, bKey) {
      if (c.cls !== 'blacksmith') return 'class';
      const a = entry(aKey), b = entry(bKey);
      if (!a || !b || a === b) return 'pick';
      const out = mergeOutcome(a, b);
      if (!out) return 'kind';
      if (out.id === a.id && out.plus === (a.plus || 0)) return 'max';
      const cost = this.mergeCost(aKey, bKey);
      if (c.coins < cost.coins) return poor(cost.coins);
      if (!cost.needs.every(([id, n]) => count(id) >= n)) return 'parts';
      c.coins -= cost.coins;
      for (const [id, n] of cost.needs) removeItem(id, n);
      const before = rankOf(ITEMS[a.id], a.plus || 0), was = a.id;
      a.id = out.id;
      if (out.plus) a.plus = out.plus; else delete a.plus;
      removeItem(b.uid, 1);
      work(30);
      changed('gear');
      if (out.id !== was) { onEvent?.('merged', { name: evolvedName(ITEMS[a.id], out.plus) }); return 'new'; }
      if (ITEMS[a.id].kind === 'weapon' && rankOf(ITEMS[a.id], out.plus) > before) {
        onEvent?.('evolved', { name: evolvedName(ITEMS[a.id], out.plus) });
        return 'evolved';
      }
      return 'ok';
    },
    // Blacksmiths forge weapons and armour from ore and coins. Each rank unlocks at a class
    // advancement; a better metal than the rank needs makes the piece +1 or +2 stronger.
    // At their own anvil (`workshop`) a Blacksmith can forge the workshop pieces too.
    forge(id, ore = null, workshop = false) {
      if (c.cls !== 'blacksmith') return 'class';
      const it = ITEMS[id];
      const need = workshop ? workshopLevel(id) : forgeLevel(id);
      if (!it || !isGear(it) || need === Infinity) return 'pick';
      if (c.level < need) return 'level';
      const cost = forgeCost(it, ore);
      if (!cost) return 'pick';
      if (c.coins < cost.coins) return poor(cost.coins);
      if (!cost.needs.every(([n, k]) => count(n) >= k)) return 'parts';
      if (used() >= BAG_SLOTS) return 'full';
      c.coins -= cost.coins;
      for (const [n, k] of cost.needs) removeItem(n, k);
      addItem(id, 1, cost.bonus);
      work(40);
      changed('gear');
      return 'ok';
    },
    // Blacksmiths can brush a coating (Poison Potion, Fire Oil, Frost Oil) onto a weapon
    coat(weaponKey, coatId) {
      if (c.cls !== 'blacksmith') return 'class';
      const w = entry(weaponKey), it = ITEMS[coatId];
      if (!w || ITEMS[w.id].kind !== 'weapon' || it?.kind !== 'coating' || !count(coatId)) return 'pick';
      removeItem(coatId, 1);
      w.coat = { id: it.coat, hits: it.hits };
      changed('gear');
      return 'ok';
    },
    // one hit used from the coating on your weapon
    useCoat() {
      const w = gearIn('weapon')?.entry;
      if (!w?.coat) return;
      w.coat.hits -= 1;
      if (w.coat.hits <= 0) delete w.coat;
      changed('bag');
    },

    // Caves: when you last beat each one's boss. A boss comes home a day later.
    bossHome: (id) => !(c.caves[id] > Date.now() - BOSS_RETURNS_MS),
    caveCleared: (id) => !!c.caves[id],
    clearCave(id) { c.caves[id] = Date.now(); changed('caves'); },

    // Monster villages (see data/mobvillages.mjs)
    villages: () => c.villages.list,
    villagesDue: () => c.villages.due,
    addVillage(v) { c.villages.list.push(v); c.villages.due = c.villages.due.filter((t) => t > Date.now()); changed('villages'); },
    villageKill(id, i) {
      const v = c.villages.list.find((q) => q.id === id);
      if (v && !v.dead.includes(i)) { v.dead.push(i); changed('villages'); }
      return v;
    },
    // looting the chest ends the village; another comes later
    lootVillage(id, returnsMs) {
      c.villages.list = c.villages.list.filter((q) => q.id !== id);
      c.villages.due.push(Date.now() + returnsMs);
      changed('villages');
    },

    // Brewing: only a Potion Maker brews (no more hiring one)
    canBrew: () => c.cls === 'potion_maker',
    canHire: () => c.cls === 'potion_maker',
    makerHired: () => false,
    // Pay a portal's fee to go to another portal on the same continent
    usePortal(fromId, toId) {
      const from = portalById(fromId), to = portalById(toId);
      if (!from || !to || from === to) return 'pick';
      if (from.region !== to.region) return 'sea';
      const fee = portalFee(from, to);
      if (c.coins < fee) return poor(fee);
      c.coins -= fee;
      changed('coins');
      return 'ok';
    },
    brew(id) {
      if (c.cls !== 'potion_maker') return 'class';
      const pm = (c.potionMaker ||= { until: 0, queue: [] });
      if (!BREWS.includes(id)) return 'pick';
      if (pm.queue.length >= POTION_MAKER.queue) return 'busy';
      const cost = brewCost(id), herbs = brewHerbs(id);
      if (c.coins < cost) return poor(cost);
      if (count('herb') < herbs) return 'herbs';
      c.coins -= cost;
      removeItem('herb', herbs);
      // each potion starts when the one before it is done
      const start = Math.max(Date.now(), pm.queue.at(-1)?.ready || 0);
      pm.queue.push({ id, ready: start + brewSeconds(id) * 1000 });
      work(25);
      changed('coins');
      return 'ok';
    },
    // potions that are ready go into the bag (if there's room); returns their names
    collectBrews() {
      const pm = c.potionMaker;
      if (!pm?.queue.length) return [];
      const got = [];
      const fits = (id) => c.inventory.some((e) => e.id === id) || used() < BAG_SLOTS;
      while (pm.queue.length && pm.queue[0].ready <= Date.now() && fits(pm.queue[0].id) && addItem(pm.queue[0].id, 1)) got.push(ITEMS[pm.queue.shift().id].name);
      if (got.length) changed('bag');
      return got;
    },

    heal(n) {
      c.hp = Math.min(stats().hp, c.hp + n);
      changed('hp');
    },
    // Returns true if this hit defeated you
    damage(n) {
      c.hp = Math.max(0, c.hp - n);
      changed('hp');
      return c.hp <= 0;
    },
    respawn() {
      c.hp = stats().hp;
      c.sp = stats().sp;
      changed('hp');
    },
    // Hire a bodyguard at the guild for `mins` minutes (see data/hire.mjs): 'hired', 'coins' or 'busy'
    hireGuard(tier, mins) {
      if (!BODYGUARDS[tier] || !HIRE_SPANS.includes(mins)) return 'bad';
      if (guardActive(c)) return 'busy';
      const cost = hireCost(tier, mins);
      if (c.coins < cost) return 'coins';
      c.coins -= cost;
      c.guard = { tier, until: Date.now() + mins * 60000 };
      changed('coins');
      this.saveNow();
      return 'hired';
    },
    dismissGuard() { c.guard = null; changed('guard'); },
    // ---- marriage and children (see data/family.mjs) ----
    // marry a townsperson: 'married', 'young', 'married-already' or 'coins'
    marryNpc(s) {
      if (!canMarry(c)) return 'young';
      if (c.spouse) return 'married-already';
      if (c.coins < WEDDING_FEE) return 'coins';
      c.coins -= WEDDING_FEE;
      c.spouse = { name: s.name, race: s.race, cls: s.cls, npc: true, since: Date.now() };
      changed('coins');
      this.saveNow();
      return 'married';
    },
    setSpouse(sp) { c.spouse = sp || null; changed('spouse'); },
    // a child of your marriage ('born', 'single', 'wait', 'full') or given by the Temple ('coins')
    haveChild(school, adopt = false) {
      c.children ||= [];
      if (c.children.length >= MAX_CHILDREN) return 'full';
      if (adopt) {
        if (c.coins < ADOPT_FEE) return 'coins';
        c.coins -= ADOPT_FEE;
        changed('coins');
      } else {
        if (!c.spouse) return 'single';
        if (nextChildIn(c) > 0) return 'wait';
        c.lastChildPlay = c.playMs || 0;
      }
      c.children.push(newChild(c, school));
      changed('children');
      this.saveNow();
      return 'born';
    },
    setChildSchool(i, school) { if (c.children?.[i]) { c.children[i].school = school || null; changed('children'); } },
    guard: () => guardActive(c),
    // A death: what it costs (see data/life.mjs). If you rise again, it is applied and you are healed.
    die(cause) {
      const out = deathOutcome(c, cause);
      if (out.rise) {
        applyRise(c, out);
        c.injury = null; // the shrine mends broken bones too
        this.respawn();
        changed('lives');
        this.saveNow();
      }
      return out;
    },

    gainCoins(n) { c.coins += n; changed('coins'); },
    gainExp(n) {
      c.exp += n;
      let levels = 0;
      while (c.exp >= expToNext(c.level, c.race)) {
        c.exp -= expToNext(c.level, c.race);
        c.level += 1;
        levels += 1;
        if (KEY_LEVELS.includes(c.level)) work(0); // a seal may have broken: a proof of growth
        // each level: 3 free Stat Points (10 at key levels), +1 to the class's main stat, Unique Points
        // and a purse of coins
        const key = KEY_LEVELS.includes(c.level);
        c.unspentPoints += key ? 10 : 3;
        c.coins += (key ? 5 : 1) * (10 + c.level * 5);
        c.uniquePoints += key ? 5 : 1;
        c.stats[CLASSES[c.cls].main] += 1;
        // every 25th level (an upgrade): a new skill at random, and (between evolutions) a little more of every stat
        if (c.level % spellGap(c) === 0 && c.spells.length < spellsDue(c)) {
          const sp = giveSpell(c);
          if (sp) onEvent?.('spell', { id: sp });
        }
        if (c.level % UPGRADE_EVERY === 0) {
          c.skillPicks += 1;
          const got = giveSkill(c);
          if (!key) for (const k of Object.keys(c.stats)) c.stats[k] += UPGRADE_STATS;
          onEvent?.('upgrade', { level: c.level, evolution: key, skill: got });
        }
        c.hp = stats().hp;
        c.sp = stats().sp;
      }
      if (levels) onEvent?.('level', c.level);
      changed('exp');
    },

    // Stat Points: place them, then confirm. Once confirmed they can't be taken back.
    spendPoints(add) {
      // only the main stats take points (HP, ATK, DEF and the rest grow from them)
      const main = Object.entries(add).filter(([k, v]) => v > 0 && k in c.stats);
      const total = main.reduce((a, [, v]) => a + v, 0);
      if (total <= 0 || total > c.unspentPoints) return;
      for (const [k, v] of main) c.stats[k] += v;
      c.unspentPoints -= total;
      changed('stats');
    },
    // Quests. `here` is where you stand, so new quests fit the area. `board` is 'quests' (the quest
    // board, 3 a day) or 'guild' (the Main Guild Hall, one at a time).
    fillQuests(here, board = 'quests') {
      const B = BOARDS[board], before = (c[B.list] || []).length, next = c[B.next];
      fillBoard(c, here, board);
      if (c[B.list].length !== before || c[B.next] !== next) changed('quests');
    },
    // returns 'ok', 'limit' when today's quests are used up, or 'one' when you already hold a guild request
    questAccept(i, board = 'quests') {
      const list = c[BOARDS[board].list] || [];
      const q = list[i];
      if (!q || q.accepted) return 'pick';
      if (board === 'guild') {
        if (!c.guildCard?.rank) return 'card';
        if (q.rank && !mayTake(c.guildCard, q.rank)) return 'rank';
        if (list.some((x) => x.accepted)) return 'one';
      }
      else {
        if (questsToday(c) >= QUESTS_PER_DAY) return 'limit';
        c.questDay = { day: gameTime().day, n: questsToday(c) + 1 };
      }
      q.accepted = true;
      changed('quests');
      return 'ok';
    },
    questDrop(i, here, board = 'quests') { c[BOARDS[board].list].splice(i, 1); fillBoard(c, here, board); changed('quests'); },
    // Returns the reward if the quest was finished
    questClaim(i, here, board = 'quests') {
      const list = c[BOARDS[board].list] || [];
      const q = list[i];
      if (!q?.accepted || progressOf(q, this) < q.need) return null;
      if (q.type === 'gather') removeItem(q.item, q.need);
      list.splice(i, 1);
      fillBoard(c, here, board);
      if (q.reward.item) addItem(q.reward.item, 1);
      this.gainCoins(q.reward.coins);
      this.gainExp(q.reward.exp);
      // a guild request done at a high level is a Rank Trial for the Unique Skill
      if (board === 'guild' && c.level >= TRIAL_LEVEL) c.growth.trials += 1;
      work(board === 'guild' ? 60 : 40);
      return q.reward;
    },
    // Called when you defeat a monster or move: returns titles of quests that just became complete
    questKill(kind, level = 0) {
      const ready = [];
      const counts = (q) => q.accepted && ((q.type === 'hunt' && q.kind === kind) || (q.type === 'slay' && level >= q.min));
      for (const q of [...(c.quests || []), ...(c.guildQuests || [])]) {
        if (counts(q) && q.have < q.need) { q.have += 1; if (q.have >= q.need) ready.push(q.title); }
      }
      if (ready.length || [...(c.quests || []), ...(c.guildQuests || [])].some(counts)) changed('quests');
      return ready;
    },
    questVisit(x, z) {
      const ready = [];
      for (const q of [...(c.quests || []), ...(c.guildQuests || [])]) {
        if (q.accepted && q.type === 'explore' && !q.have && Math.hypot(x - q.place.x, z - q.place.z) < q.place.r) { q.have = 1; ready.push(q.title); }
      }
      if (ready.length) changed('quests');
      return ready;
    },
    // ---------- skills ----------
    // Skills from Skill Stones set in the gear you're wearing (Rare and better gear holds 3, Legendary
    // and Mythic 5)
    gearSkills() {
      const out = [];
      for (const [slot] of SLOTS) {
        const g = gearIn(slot);
        if (g && gearSkillSlots(g, g.plus)) for (const id of g.entry.skills || []) if (SKILLS[id] && !out.includes(id)) out.push(id);
      }
      return out;
    },
    // every skill you can use now: learned ones and those in your gear
    knownSkills() { return [...new Set([...c.skills, ...c.techniques, ...this.gearSkills()])]; },
    // the Mythic weapon in your hand's own skill, if you hold one
    mythic() { const w = gearIn('weapon'); return w ? mythicSkill(w, w.plus) : null; },
    // set a Skill Stone (by its item id) into a piece of gear (by uid), or take one out again
    setStone(uidKey, stoneId) {
      const e = entry(uidKey), st = ITEMS[stoneId];
      if (!e?.uid || !isGear(ITEMS[e.id]) || st?.kind !== 'stone' || !count(stoneId)) return 'none';
      const slots = gearSkillSlots(ITEMS[e.id], e.plus || 0);
      if (!slots) return 'rank';
      e.skills ||= [];
      if (e.skills.includes(st.skill)) return 'have';
      if (e.skills.length >= slots) return 'full';
      removeItem(stoneId, 1);
      e.skills.push(st.skill);
      changed('gear'); changed('skills');
      return 'ok';
    },
    takeStone(uidKey, skillId) {
      const e = entry(uidKey);
      if (!e?.skills?.includes(skillId)) return 'none';
      if (!addItem(`stone_${skillId}`, 1)) return 'full';
      e.skills = e.skills.filter((x) => x !== skillId);
      if (!e.skills.length) delete e.skills;
      changed('gear'); changed('skills');
      return 'ok';
    },
    // put a stored skill on the bar, on the first free key
    readySkill(id) {
      if (!this.knownSkills().includes(id) || c.skillBar.some((b) => b.id === id) || c.skillBar.length >= SKILL_BAR) return false;
      const key = DEFAULT_KEYS.find((k) => !c.skillBar.some((b) => b.key === k)) || null;
      c.skillBar.push({ id, key });
      changed('skills');
      return true;
    },
    storeSkill(id) { c.skillBar = c.skillBar.filter((b) => b.id !== id); changed('skills'); },
    // any key the game doesn't already use; a key taken by another skill moves to this one
    setSkillKey(id, code) {
      if (FIXED_KEYS.includes(code) || actionFor(code)) return 'reserved';
      const b = c.skillBar.find((x) => x.id === id);
      if (!b) return 'none';
      for (const o of c.skillBar) if (o.key === code) o.key = null;
      b.key = code;
      changed('skills');
      return 'ok';
    },
    // Something changed that only the HUD shows (fatigue ticking)
    touch(what) { changed(what); },
    // Torches: take one from the bag and stand it in the ground (up to 10 burn at once)
    placeTorch(x, z) {
      if (c.torches.length >= 10) return 'max';
      if (!removeItem('torch', 1)) return 'none';
      c.torches.push({ x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 });
      changed('torches');
      return 'ok';
    },
    // Your tent: pitching it uses the one in your bag (or moves it if it's already up); packing it
    // puts it back in the bag
    pitchTent(x, z, heading) {
      if (!c.tent && !removeItem('tent', 1)) return 'none';
      c.tent = { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, heading: Math.round(heading * 100) / 100 };
      changed('tent');
      return 'ok';
    },
    packTent() {
      if (!c.tent) return 'none';
      if (!addItem('tent', 1)) return 'full';
      c.tent = null;
      changed('tent');
      return 'ok';
    },
    // pick a placed torch back up (the nearest within `r` metres of x, z)
    takeTorch(x, z, r = 2.2) {
      let best = -1, bestD = r;
      c.torches.forEach((t, i) => { const d = Math.hypot(t.x - x, t.z - z); if (d < bestD) { bestD = d; best = i; } });
      if (best < 0) return 'none';
      if (!addItem('torch', 1)) return 'full';
      c.torches.splice(best, 1);
      changed('torches');
      return 'ok';
    },
    // real time spent playing, shown on the ID card
    addPlayTime(ms) {
      c.playMs = (c.playMs || 0) + ms;
      // grown, with a parent still living, and no visit for too long: a sinner for this life
      const due = visitDue(c);
      if (due !== null && due <= 0 && !c.neglect) { c.neglect = true; changed('soul'); onEvent?.('neglect'); }
    },
    // talking to your parents at their door counts as a visit
    visitParents() {
      if (c.child) return 'child';
      const before = visitDue(c);
      c.visitPlay = c.playMs || 0;
      changed('visit');
      return before;
    },
    // The Hunter's Guild Card: ask for one at the Guild Hall counter (paying the fee), then lay a
    // hand on the crystal in the Assessment Room to have it read and ranked
    requestCard() {
      if (c.level < GUILD_HALL_LEVEL) return 'level';
      if (c.guildCard) return c.guildCard.pending ? 'pending' : 'have';
      if (c.coins < CARD_FEE) return poor(CARD_FEE);
      c.coins -= CARD_FEE;
      c.guildCard = { pending: true, issued: Date.now() };
      changed('coins');
      return 'ok';
    },
    assessCard() {
      if (!c.guildCard) return 'none';
      const before = c.guildCard.rank;
      c.guildCard = assess(c);
      changed('card');
      return before && before !== c.guildCard.rank ? 'up' : before ? 'same' : 'new';
    },
    // Monster players from level 100: switch between monster and humanoid form
    changeForm() {
      if (!mayChangeForm(c)) return 'level';
      c.form = c.form === 'humanoid' ? 'monster' : 'humanoid';
      changed('form');
      return 'ok';
    },
    saveNow() { clearTimeout(saveTimer); saveTimer = null; return save?.(snapshot()); },
    // the server's count after it charged you (for land)
    setCoins(n) { c.coins = n; changed('coins'); },
  };
}
