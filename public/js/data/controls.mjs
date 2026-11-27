// The keys the game listens to. Every action can be put on any key (or a mouse button), with a main
// key and a second key, and any action can be left with no key at all. The choice is saved with the
// player's account (and in this browser), so it follows them to any computer.
// Only Esc can't be taken: it always opens the menu, so nobody can lock themselves out.

// The tabs of the Controls screen, each with its own icon (drawn in status.js)
export const CATEGORIES = [
  ['move', 'Movement'],
  ['combat', 'Combat'],
  ['camera', 'Camera'],
  ['feel', 'Sensitivity'],
  ['fly', 'Flying & riding'],
  ['world', 'Actions'],
  ['windows', 'Windows'],
  ['build', 'Building'],
  ['admin', 'Admin'],
];

// [action, name, [main key, second key], tab, what it does]
// Actions in the 'build' group only work while you build, so they may share keys with the rest.
// Fly up shares the Jump key on purpose (you can't jump in the air), so the two never clash.
export const CONTROLS = [
  ['forward', 'Walk forward', ['KeyW', 'ArrowUp'], 'move', 'Tap twice quickly to walk on your own (auto-walk).'],
  ['back', 'Walk back', ['KeyS', 'ArrowDown'], 'move'],
  ['left', 'Left', ['KeyA', 'ArrowLeft'], 'move'],
  ['right', 'Right', ['KeyD', 'ArrowRight'], 'move'],
  ['run', 'Run (hold)', ['ShiftLeft', 'ShiftRight'], 'move'],
  ['jump', 'Jump', ['Space', null], 'move'],
  ['autowalk', 'Auto-walk on / off', [null, null], 'move', 'Keep walking forward without holding a key.'],
  ['attack', 'Attack', ['KeyF', null], 'combat', 'Clicking the game attacks too.'],
  ['spell', 'Change spell (staff)', ['KeyX', null], 'combat'],
  ['unique', 'Unique Skill', ['KeyU', null], 'combat'],
  ['mythic', 'Mythic weapon skill', ['KeyJ', null], 'combat'],
  ['view', 'First / third person', ['F5', null], 'camera'],
  ['zoomin', 'Camera closer', [null, null], 'camera', 'The same as scrolling the mouse wheel up.'],
  ['zoomout', 'Camera further', [null, null], 'camera', 'The same as scrolling the mouse wheel down.'],
  ['mouse', 'Free the mouse / catch it again', [null, null], 'camera', 'Lets the mouse go so you can click windows, or catches it again to turn the camera.'],
  ['mount', 'Call / ride your mount', ['KeyH', null], 'fly'],
  ['dragon', 'Your dragon: attack / come back', ['Digit7', null], 'fly', 'Sets your tamed dragon or wyvern on the foe in front of you, or calls it back. On its back, it breathes fire ahead.'],
  ['flyup', 'Fly up / climb', ['Space', null], 'fly', 'On a dragon or wyvern, or with the admin Fly power.'],
  ['flydown', 'Fly down / dive', [null, null], 'fly', 'Pick any key you like. Until you do, Run (Shift) dives.'],
  ['interact', 'Open / pick up / talk', ['KeyE', null], 'world'],
  ['chat', 'Open chat', ['Enter', null], 'world', 'Works while the mouse turns the camera: it frees the mouse and puts you in the chat box. Send or press Esc to go back to the game.'],
  ['sleep', 'Sleep / wake', ['KeyZ', null], 'world'],
  ['torch', 'Torch', ['KeyT', null], 'world'],
  ['tent', 'Pitch / pack tent', ['KeyP', null], 'world'],
  ['portal', 'Use a portal', ['KeyG', null], 'world'],
  ['land', 'Land grid', ['KeyL', null], 'world'],
  ['status', 'Status', ['KeyC', null], 'windows'],
  ['bag', 'Bag', ['KeyI', null], 'windows'],
  ['shop', 'Shop', ['KeyB', null], 'windows'],
  ['smith', 'Blacksmith', ['KeyN', null], 'windows'],
  ['quests', 'Quests', ['KeyQ', null], 'windows'],
  ['skills', 'Skills', ['KeyK', null], 'windows'],
  ['groups', 'Party and guild', ['KeyY', null], 'windows'],
  ['map', 'World map', ['KeyM', null], 'windows'],
  ['rankings', 'Top players', ['KeyR', null], 'windows'],
  ['settings', 'Settings', ['KeyO', null], 'windows'],
  ['controls', 'Controls (change keys)', [null, null], 'windows'],
  ['help', 'Key guide', ['Slash', null], 'windows'],
  ['builder', 'Builder View', ['KeyV', null], 'build', 'Shift + this key builds walking around instead.'],
  ['walkbuild', 'Build walking around', [null, null], 'build'],
  ['b_place', 'Place a piece (building)', ['KeyE', null], 'build', 'Only while you build.'],
  ['b_turn', 'Turn a piece (building)', ['KeyR', null], 'build', 'Only while you build.'],
  ['b_up', 'Storey up (building)', ['PageUp', null], 'build', 'Only while you build.'],
  ['b_down', 'Storey down (building)', ['PageDown', null], 'build', 'Only while you build.'],
  ['powers', 'Admin powers panel', [null, null], 'admin', 'For accounts the owner gave powers to.'],
  ['radar', 'Dragon radar range', [null, null], 'admin', 'For accounts with the Dragon radar power.'],
];
export const CONTROL = Object.fromEntries(CONTROLS.map((c) => [c[0], { id: c[0], name: c[1], keys: c[2], tab: c[3], about: c[4] || '' }]));
const DEFAULTS = Object.fromEntries(CONTROLS.map(([id, , k]) => [id, [...k]]));
// keys no action can take
export const FIXED_KEYS = ['Escape'];
const BUILD = new Set(CONTROLS.filter((c) => c[3] === 'build' && c[0].startsWith('b_')).map((c) => c[0]));
// two actions may share a key without it being a clash
const SHARES = [['jump', 'flyup']];
const canShare = (a, b) => (BUILD.has(a) !== BUILD.has(b)) || SHARES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

const STORE = 'ar-keys';
let keys = clean({});
let saver = null; // sends the keys to the account

// keys as saved: { action: [main, second] }; old saves were { action: 'KeyX' }
function clean(saved) {
  const out = {};
  for (const id of Object.keys(DEFAULTS)) {
    let v = saved?.[id];
    if (typeof v === 'string' || v === null) v = [v, DEFAULTS[id][1]];
    if (!Array.isArray(v)) v = DEFAULTS[id];
    out[id] = [0, 1].map((i) => (typeof v[i] === 'string' && /^[A-Za-z0-9]{1,24}$/.test(v[i]) && !FIXED_KEYS.includes(v[i]) ? v[i] : null));
  }
  return out;
}
function fromBrowser() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (!raw) return null;
    // (old saves: the arrows always moved and Ctrl flew down; keep the arrows, drop Ctrl)
    if (!raw.v) {
      for (const id of ['forward', 'back', 'left', 'right']) if (typeof raw[id] === 'string') raw[id] = [raw[id], DEFAULTS[id][1]];
      if (raw.flydown === 'ControlLeft') raw.flydown = null;
      if (raw.help === 'KeyH' && raw.mount === 'KeyH') raw.help = 'Slash';
    }
    delete raw.v;
    return clean(raw);
  } catch { return null; }
}
keys = fromBrowser() || clean(DEFAULTS);
const keepHere = () => { try { localStorage.setItem(STORE, JSON.stringify({ v: 2, ...keys })); } catch { /* private window */ } };
const save = () => { keepHere(); saver?.(keys); };

// After signing in: the account's keys win; an account with none yet takes this browser's.
export function useAccountKeys(saved, send) {
  saver = send;
  if (saved && typeof saved === 'object') { keys = clean(saved); keepHere(); }
  else { let had = false; try { had = !!localStorage.getItem(STORE); } catch { /* blocked */ } if (had) send?.(keys); }
}
export const allKeys = () => keys;

// the main key of an action (or its second one, if the main is empty), for hints like "Press E"
export const codeFor = (id) => keys[id]?.[0] || keys[id]?.[1] || null;
export const codesFor = (id) => keys[id] || [null, null];
export const isDefault = (id) => keys[id][0] === DEFAULTS[id][0] && keys[id][1] === DEFAULTS[id][1];
// the action a key does while playing (building keys only while building)
export function actionFor(code, { building = false } = {}) {
  if (!code) return null;
  for (const [id, k] of Object.entries(keys)) if ((k[0] === code || k[1] === code) && BUILD.has(id) === building) return id;
  return null;
}
// is this key held for the action? (keys = the Set of keys down)
export const isHeld = (down, id) => !!keys[id] && ((keys[id][0] && down.has(keys[id][0])) || (keys[id][1] && down.has(keys[id][1])));

// Who else uses this key (a clash), leaving out the action's own slot
export function clashFor(id, code, slot = 0) {
  if (!code) return null;
  for (const [other, k] of Object.entries(keys)) {
    for (const i of [0, 1]) {
      if (other === id && i === slot) continue;
      if (k[i] === code && (other === id || !canShare(id, other))) return { id: other, slot: i };
    }
  }
  return null;
}
// Every key used twice: { 'action:slot': true } for each clashing slot (shown red)
export function clashes() {
  const out = {};
  for (const [id, k] of Object.entries(keys)) for (const i of [0, 1]) if (k[i] && clashFor(id, k[i], i)) out[`${id}:${i}`] = true;
  return out;
}

// Put a key on one slot of an action. how: 'swap' (the other action gets your old key), 'take'
// (the other action loses it) or 'both' (keep both, a clash). Returns false for a key nobody may use.
export function setKey(id, code, slot = 0, how = 'swap') {
  if (!(id in DEFAULTS) || (code && FIXED_KEYS.includes(code))) return false;
  if (code && how !== 'both') {
    let give = how === 'swap' ? keys[id][slot] : null; // (only the first clash gets your old key)
    for (let c = clashFor(id, code, slot); c; c = clashFor(id, code, slot)) { keys[c.id][c.slot] = give; give = null; }
  }
  keys[id][slot] = code || null;
  if (keys[id][0] && keys[id][0] === keys[id][1]) keys[id][1] = null;
  save();
  return true;
}
export const clearKey = (id, slot = 0) => setKey(id, null, slot);
export function resetKey(id) { keys[id] = [...DEFAULTS[id]]; save(); }
export function resetKeys(tab) {
  for (const [id, , , t] of CONTROLS) if (!tab || t === tab) keys[id] = [...DEFAULTS[id]];
  save();
}

// A mouse button as a key: the middle button and the two side buttons can be used
export const mouseCode = (button) => ({ 1: 'Mouse3', 3: 'Mouse4', 4: 'Mouse5' })[button] || null;

// A key's name as printed on the keyboard
export function keyName(code) {
  if (!code) return '—';
  const named = { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Right Shift', ControlLeft: 'Ctrl', ControlRight: 'Right Ctrl', AltLeft: 'Alt', AltRight: 'Right Alt', MetaLeft: 'Cmd / Win', MetaRight: 'Right Cmd / Win', Enter: 'Enter', NumpadEnter: 'Num Enter', Backspace: 'Backspace', CapsLock: 'Caps Lock', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', PageUp: 'Page Up', PageDown: 'Page Down', Mouse3: 'Middle mouse', Mouse4: 'Mouse back', Mouse5: 'Mouse forward', ContextMenu: 'Menu' };
  return named[code] || code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');
}
