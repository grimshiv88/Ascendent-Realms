// Your character's progress while playing: HP and SP, EXP and levels, coins, the bag and what you wear.
// Every change is saved to the server a moment later.
import { CLASSES, KEY_LEVELS, derivedStats, expToNext } from './data/game-data.mjs';
import { ITEMS, SHOP, RECIPES, SLOTS, isGear, slotOf, sellPrice, upgraded, mergeResult, mergeCost, evolveStage, evolvedName, POTION_MAKER, BREWS, brewCost, brewSeconds } from './data/items.mjs';
import { fillBoard, progressOf } from './quests.js';
import { BOSS_RETURNS_MS } from './data/depths.mjs';
import { portalById, portalFee } from './data/portals.mjs';
import { actionFor, FIXED_KEYS } from './data/controls.mjs';
import { SKILLS, UPGRADE_EVERY, UPGRADE_STATS, SKILL_BAR, DEFAULT_KEYS, randomSkill } from './data/skills.mjs';

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

export function createProgress(c, { save, onChange, onEvent }) {
  c.inventory ||= [];
  c.equipped = { ...Object.fromEntries(SLOTS.map(([s]) => [s, null])), ...(c.equipped || {}) };
  c.boosts ||= [];
  c.torches ||= [];
  c.tent ??= null; // where your tent is pitched
  c.fatigue ??= 0;
  c.trained = { atk: 0, def: 0, matk: 0, mdef: 0, hp: 0, ...(c.trained || {}) }; // Stat Points put straight into ATK, DEF, MATK, MDEF or HP
  c.caves ??= {}; // cave id -> when you last beat its boss
  c.potionMaker ??= null; // { until, queue: [{ id, ready }] } while a Businessman has one hired
  // Skills: learned ones, the ones ready on keys (the rest are kept in storage), and choices still to make
  c.skills = (c.skills || []).filter((id) => SKILLS[id]);
  c.skillBar = (c.skillBar || []).filter((b) => c.skills.includes(b?.id));
  c.skillPicks ??= Math.max(0, Math.floor(c.level / UPGRADE_EVERY) - c.skills.length);
  // skills are given, not chosen: any still waiting are handed out now
  while (c.skillPicks > 0 && giveSkill(c));
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
    const d = derivedStats(c.stats, c.level, c.trained);
    const b = bonus();
    return { ...d, sp: d.sp + b.sp, atk: d.atk + b.atk, matk: d.matk + b.matk, def: d.def + b.def, mdef: d.mdef + b.mdef, bonus: b, base: d };
  }
  if (c.hp == null || c.hp > stats().hp) c.hp = stats().hp;
  if (c.sp == null || c.sp > stats().sp) c.sp = stats().sp;

  let saveTimer = null;
  function changed(what) {
    onChange?.(what);
    // saved at most every 1.5 s, so a steady trickle of changes (SP coming back) still gets saved
    saveTimer ??= setTimeout(() => { saveTimer = null; save?.(snapshot()); }, 1500);
  }
  const snapshot = () => ({
    level: c.level, exp: c.exp, coins: c.coins, hp: Math.round(c.hp), sp: Math.round(c.sp), stats: c.stats,
    unspentPoints: c.unspentPoints, uniquePoints: c.uniquePoints, inventory: c.inventory, equipped: c.equipped, boosts: c.boosts,
    quests: c.quests, fatigue: Math.round(c.fatigue), torches: c.torches, savedAt: Date.now(),
    skills: c.skills, skillBar: c.skillBar, skillPicks: c.skillPicks, tent: c.tent, potionMaker: c.potionMaker, trained: c.trained, caves: c.caves,
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
    buy(id) {
      const unlock = SHOP.find(([sid]) => sid === id)?.[1] ?? Infinity;
      const it = ITEMS[id];
      if (c.level < unlock) return 'locked';
      if (c.coins < it.price) return 'coins';
      if (!addItem(id, 1)) return 'full';
      c.coins -= it.price;
      changed('coins');
      return 'ok';
    },
    sellPrice: (e) => sellPrice(ITEMS[e.id], e.plus || 0, c.cls),
    // sells `n` of an item (all of them when n is left out); returns the coins earned
    sell(key, n = 1) {
      const e = entry(key);
      if (!e) return 0;
      n = Math.min(n ?? e.n, e.n);
      const price = sellPrice(ITEMS[e.id], e.plus || 0, c.cls);
      if (!removeItem(key, n)) return 0;
      c.coins += price * n;
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
      return c.boosts.reduce((n, x) => (x.stat === stat && x.until > now ? n + x.pct : n), 0);
    },

    // Blacksmiths merge two pieces of the same kind: the first gets stronger, the second is used up.
    // Every merge costs coins (and monster parts from Uncommon up), more for higher ranks and upgrades.
    canMerge: () => c.cls === 'blacksmith',
    mergeCost: (key) => { const a = entry(key); return a ? mergeCost(ITEMS[a.id], a.plus || 0) : null; },
    canPay: (cost) => c.coins >= cost.coins && cost.needs.every(([id, n]) => count(id) >= n),
    mergePreview(aKey, bKey) {
      const a = entry(aKey), b = entry(bKey);
      if (!a || !b || a === b) return null;
      return mergeResult(a, b);
    },
    merge(aKey, bKey) {
      if (c.cls !== 'blacksmith') return 'class';
      const a = entry(aKey), b = entry(bKey);
      if (!a || !b || a === b) return 'pick';
      const plus = mergeResult(a, b);
      if (plus == null) return 'kind';
      if (plus === (a.plus || 0)) return 'max';
      const cost = mergeCost(ITEMS[a.id], a.plus || 0);
      if (c.coins < cost.coins) return 'coins';
      if (!cost.needs.every(([id, n]) => count(id) >= n)) return 'parts';
      c.coins -= cost.coins;
      for (const [id, n] of cost.needs) removeItem(id, n);
      const before = evolveStage(a.plus || 0);
      a.plus = plus;
      removeItem(b.uid, 1);
      changed('gear');
      if (ITEMS[a.id].kind === 'weapon' && evolveStage(plus) > before) {
        onEvent?.('evolved', { name: evolvedName(ITEMS[a.id], plus) });
        return 'evolved';
      }
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

    // The Potion-Maker: only a Businessman can hire one
    canHire: () => c.cls === 'businessman',
    makerHired: () => !!c.potionMaker && c.potionMaker.until > Date.now(),
    // Pay a portal's fee to go to another portal on the same continent
    usePortal(fromId, toId) {
      const from = portalById(fromId), to = portalById(toId);
      if (!from || !to || from === to) return 'pick';
      if (from.region !== to.region) return 'sea';
      const fee = portalFee(from, to);
      if (c.coins < fee) return 'coins';
      c.coins -= fee;
      changed('coins');
      return 'ok';
    },
    hireMaker() {
      if (c.cls !== 'businessman') return 'class';
      if (c.coins < POTION_MAKER.fee) return 'coins';
      c.coins -= POTION_MAKER.fee;
      const from = Math.max(Date.now(), c.potionMaker?.until || 0);
      c.potionMaker = { until: from + POTION_MAKER.minutes * 60000, queue: c.potionMaker?.queue || [] };
      changed('coins');
      return 'ok';
    },
    brew(id) {
      const pm = c.potionMaker;
      if (!pm || pm.until <= Date.now()) return 'hire';
      if (!BREWS.includes(id)) return 'pick';
      if (pm.queue.length >= POTION_MAKER.queue) return 'busy';
      const cost = brewCost(id);
      if (c.coins < cost) return 'coins';
      c.coins -= cost;
      // each potion starts when the one before it is done
      const start = Math.max(Date.now(), pm.queue.at(-1)?.ready || 0);
      pm.queue.push({ id, ready: start + brewSeconds(id) * 1000 });
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

    gainCoins(n) { c.coins += n; changed('coins'); },
    gainExp(n) {
      c.exp += n;
      let levels = 0;
      while (c.exp >= expToNext(c.level, c.race)) {
        c.exp -= expToNext(c.level, c.race);
        c.level += 1;
        levels += 1;
        // each level: 3 free Stat Points (10 at key levels), +1 to the class's main stat, Unique Points
        // and a purse of coins
        const key = KEY_LEVELS.includes(c.level);
        c.unspentPoints += key ? 10 : 3;
        c.coins += (key ? 5 : 1) * (10 + c.level * 5);
        c.uniquePoints += key ? 5 : 1;
        c.stats[CLASSES[c.cls].main] += 1;
        // every 10th level: a new skill at random, and (between evolutions) a little more of every stat
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
    // Quests. `here` is where you stand, so new quests fit the area.
    fillQuests(here) { const before = (c.quests || []).length; fillBoard(c, here); if (c.quests.length !== before) changed('quests'); },
    questAccept(i) { if (c.quests[i]) { c.quests[i].accepted = true; changed('quests'); } },
    questDrop(i, here) { c.quests.splice(i, 1); fillBoard(c, here); changed('quests'); },
    // Returns the reward if the quest was finished
    questClaim(i, here) {
      const q = c.quests[i];
      if (!q?.accepted || progressOf(q, this) < q.need) return null;
      if (q.type === 'gather') removeItem(q.item, q.need);
      c.quests.splice(i, 1);
      fillBoard(c, here);
      if (q.reward.item) addItem(q.reward.item, 1);
      this.gainCoins(q.reward.coins);
      this.gainExp(q.reward.exp);
      return q.reward;
    },
    // Called when you defeat a monster or move: returns titles of quests that just became complete
    questKill(kind) {
      const ready = [];
      for (const q of c.quests || []) {
        if (q.accepted && q.type === 'hunt' && q.kind === kind && q.have < q.need) { q.have += 1; if (q.have >= q.need) ready.push(q.title); }
      }
      if (ready.length || (c.quests || []).some((q) => q.accepted && q.type === 'hunt' && q.kind === kind)) changed('quests');
      return ready;
    },
    questVisit(x, z) {
      const ready = [];
      for (const q of c.quests || []) {
        if (q.accepted && q.type === 'explore' && !q.have && Math.hypot(x - q.place.x, z - q.place.z) < q.place.r) { q.have = 1; ready.push(q.title); }
      }
      if (ready.length) changed('quests');
      return ready;
    },
    // ---------- skills ----------
    // put a stored skill on the bar, on the first free key
    readySkill(id) {
      if (!c.skills.includes(id) || c.skillBar.some((b) => b.id === id) || c.skillBar.length >= SKILL_BAR) return false;
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
    saveNow() { clearTimeout(saveTimer); saveTimer = null; return save?.(snapshot()); },
    // the server's count after it charged you (for land)
    setCoins(n) { c.coins = n; changed('coins'); },
  };
}
