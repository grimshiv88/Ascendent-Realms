// Your character's progress while playing: HP and SP, EXP and levels, coins, the bag and what you wear.
// Every change is saved to the server a moment later.
import { CLASSES, KEY_LEVELS, derivedStats, expToNext } from './data/game-data.mjs';
import { ITEMS, SHOP, RECIPES, SLOTS, isGear, slotOf, sellPrice, upgraded, mergeResult } from './data/items.mjs';
import { fillBoard, progressOf } from './quests.js';
import { SKILLS, UPGRADE_EVERY, UPGRADE_STATS, SKILL_BAR, DEFAULT_KEYS, RESERVED_KEYS, skillOffers } from './data/skills.mjs';

const BAG_SLOTS = 30;
const uid = () => `g${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

export function createProgress(c, { save, onChange, onEvent }) {
  c.inventory ||= [];
  c.equipped = { ...Object.fromEntries(SLOTS.map(([s]) => [s, null])), ...(c.equipped || {}) };
  c.boosts ||= [];
  c.torches ||= [];
  c.tent ??= null; // where your tent is pitched
  c.fatigue ??= 0;
  // Skills: learned ones, the ones ready on keys (the rest are kept in storage), and choices still to make
  c.skills = (c.skills || []).filter((id) => SKILLS[id]);
  c.skillBar = (c.skillBar || []).filter((b) => c.skills.includes(b?.id));
  c.skillPicks ??= Math.max(0, Math.floor(c.level / UPGRADE_EVERY) - c.skills.length);
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
    return e ? { ...ITEMS[e.id], entry: e, plus: e.plus || 0 } : null;
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
    for (const x of c.boosts) b.sp += x.sp || 0;
    return b;
  }
  function stats() {
    const d = derivedStats(c.stats, c.level);
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
    skills: c.skills, skillBar: c.skillBar, skillPicks: c.skillPicks, tent: c.tent,
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

    // Blacksmiths merge two pieces of the same kind: the first gets stronger, the second is used up
    canMerge: () => c.cls === 'blacksmith',
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
      a.plus = plus;
      removeItem(b.uid, 1);
      changed('gear');
      return 'ok';
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
        c.coins += (key ? 5 : 1) * (20 + c.level * 10);
        c.uniquePoints += key ? 5 : 1;
        c.stats[CLASSES[c.cls].main] += 1;
        // every 10th level: a new skill to choose, and (between evolutions) a little more of every stat
        if (c.level % UPGRADE_EVERY === 0) {
          c.skillPicks += 1;
          if (!key) for (const k of Object.keys(c.stats)) c.stats[k] += UPGRADE_STATS;
          onEvent?.('upgrade', { level: c.level, evolution: key });
        }
        c.hp = stats().hp;
        c.sp = stats().sp;
      }
      if (levels) onEvent?.('level', c.level);
      changed('exp');
    },

    // Stat Points: place them, then confirm. Once confirmed they can't be taken back.
    spendPoints(add) {
      const total = Object.values(add).reduce((a, b) => a + b, 0);
      if (total <= 0 || total > c.unspentPoints) return;
      for (const [k, v] of Object.entries(add)) if (v > 0 && k in c.stats) c.stats[k] += v;
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
    skillOffers: () => (c.skillPicks > 0 ? skillOffers(c) : []),
    learnSkill(id) {
      if (c.skillPicks <= 0 || !skillOffers(c).includes(id)) return false;
      c.skills.push(id);
      c.skillPicks -= 1;
      if (c.skillBar.length < SKILL_BAR) this.readySkill(id);
      changed('skills');
      return true;
    },
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
      if (RESERVED_KEYS.includes(code)) return 'reserved';
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
