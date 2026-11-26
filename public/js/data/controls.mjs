// The keys the game listens to. Every action has a key the player can change in Settings
// (for example the Shop on J instead of B); the choice is kept in this browser. The arrow keys
// always move as well, and Esc always opens the options, so nobody can lock themselves out.

export const CONTROLS = [
  // [action, name, default key, group]
  ['forward', 'Walk forward', 'KeyW', 'Moving'],
  ['back', 'Walk back', 'KeyS', 'Moving'],
  ['left', 'Left', 'KeyA', 'Moving'],
  ['right', 'Right', 'KeyD', 'Moving'],
  ['run', 'Run (hold)', 'ShiftLeft', 'Moving'],
  ['jump', 'Jump', 'Space', 'Moving'],
  ['flydown', 'Fly down (admins)', 'ControlLeft', 'Moving'],
  ['view', 'First / third person', 'F5', 'Moving'],
  ['attack', 'Attack', 'KeyF', 'Doing'],
  ['interact', 'Open / pick up', 'KeyE', 'Doing'],
  ['spell', 'Change spell (staff)', 'KeyX', 'Doing'],
  ['unique', 'Unique Skill', 'KeyU', 'Doing'],
  ['mythic', 'Mythic weapon skill', 'KeyJ', 'Doing'],
  ['sleep', 'Sleep / wake', 'KeyZ', 'Doing'],
  ['torch', 'Torch', 'KeyT', 'Doing'],
  ['tent', 'Pitch / pack tent', 'KeyP', 'Doing'],
  ['portal', 'Use a portal', 'KeyG', 'Doing'],
  ['mount', 'Call / ride your horse', 'KeyH', 'Doing'],
  ['land', 'Land grid', 'KeyL', 'Doing'],
  ['builder', 'Builder View', 'KeyV', 'Doing'],
  ['chat', 'Chat', 'Enter', 'Doing'],
  ['status', 'Status', 'KeyC', 'Windows'],
  ['bag', 'Bag', 'KeyI', 'Windows'],
  ['shop', 'Shop', 'KeyB', 'Windows'],
  ['smith', 'Blacksmith', 'KeyN', 'Windows'],
  ['quests', 'Quests', 'KeyQ', 'Windows'],
  ['skills', 'Skills', 'KeyK', 'Windows'],
  ['groups', 'Party and guild', 'KeyY', 'Windows'],
  ['map', 'World map', 'KeyM', 'Windows'],
  ['rankings', 'Top players', 'KeyR', 'Windows'],
  ['settings', 'Settings', 'KeyO', 'Windows'],
  ['help', 'Controls help', 'Slash', 'Windows'],
];
const DEFAULTS = Object.fromEntries(CONTROLS.map(([id, , code]) => [id, code]));
// keys no action can take
export const FIXED_KEYS = ['Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'];

const STORE = 'ar-keys';
let keys = { ...DEFAULTS };
try { keys = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; } catch { /* no storage */ }
// (H used to open the help; it calls your horse now, and the help moved to /)
if (keys.help === 'KeyH' && keys.mount === 'KeyH') keys.help = 'Slash';
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(keys)); } catch { /* private window */ } };

export const codeFor = (id) => keys[id];
// the action a key does, if any (the right Shift runs too while Run is on the left one)
export function actionFor(code) {
  for (const [id, c] of Object.entries(keys)) if (c === code) return id;
  if (code === 'ShiftRight' && keys.run === 'ShiftLeft') return 'run';
  return null;
}
// Put an action on a key. If another action had that key, the two swap.
export function setKey(id, code) {
  if (!(id in DEFAULTS) || FIXED_KEYS.includes(code)) return false;
  const other = Object.keys(keys).find((k) => keys[k] === code);
  if (other && other !== id) keys[other] = keys[id];
  keys[id] = code;
  save();
  return true;
}
export function resetKeys() { keys = { ...DEFAULTS }; save(); }

// A key's name as printed on the keyboard
export function keyName(code) {
  if (!code) return '—';
  const named = { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Right Shift', ControlLeft: 'Ctrl', ControlRight: 'Right Ctrl', AltLeft: 'Alt', AltRight: 'Right Alt', Enter: 'Enter', Backspace: 'Backspace', CapsLock: 'Caps Lock', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\' };
  return named[code] || code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');
}
