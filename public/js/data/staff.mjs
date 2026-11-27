// Admin access for other accounts. The game's owner (the accounts in ADMIN_EMAILS) can do everything
// and is the only one who can give or take away admin access. Each admin the owner makes gets only
// the permissions the owner ticks for them: some are powers on the Admin Board, some are powers in
// the game itself (flying, not dying, ...).

// Powers on the Admin Board
export const BOARD_PERMS = [
  ['mute', 'Mute players', 'Stop a player chatting for a while.'],
  ['ban', 'Ban players', 'Ban a player for some days (up to the most days you allow). Only you can ban forever.'],
  ['kick', 'Sign players out', 'Sign a player out on every device.'],
  ['chat', 'Read and clean the chat', 'See the general chat and remove messages.'],
  ['reports', 'Handle reports', 'See players\' reports and close them.'],
  ['announce', 'Announcements', 'Show a message across the top of everyone\'s screen.'],
  ['move', 'Move players', 'Carry a player to a place.'],
  ['heal', 'Heal players', 'Heal a player fully and mend their bones.'],
  ['edit', 'Change characters', 'Levels, coins, stats, items, skills, race and class, childhood, gifts and pets.'],
  ['world', 'Run the world', 'City bridges, monster attacks, bringing back dragons, thrones, land, caves and houses, health numbers, sect leaders.'],
];
// Powers in the game (the owner always has all of them)
export const GAME_POWERS = [
  ['fly', 'Fly', 'Fly over the land. Fly up (Space) goes up, and the Fly down key the player picks in Settings → Controls goes down (Shift until one is picked).'],
  ['nodeath', 'Can\'t die', 'Nothing can kill them: they stay on at least 1 HP and never lose a life.'],
  ['speed', 'Run fast', 'Walk and run three times as fast.'],
  ['teleport', 'Teleport', 'Tap any place on the world map to go there at once.'],
  ['radar', 'Dragon radar', 'A radar of every dragon and wyvern: where each one is, how far, and whether it is alive or slain.'],
];
export const ALL_PERMS = [...BOARD_PERMS, ...GAME_POWERS].map(([id]) => id);
export const POWER_IDS = GAME_POWERS.map(([id]) => id);
export const BAN_DAYS_DEFAULT = 3; // the longest ban a new admin may give, unless the owner says more
export const BAN_DAYS_MAX = 365;

// What the owner sends when making an admin, made safe: { perms: [...], banDays }
export function cleanStaff(v) {
  const perms = [...new Set((Array.isArray(v?.perms) ? v.perms : []).filter((p) => ALL_PERMS.includes(p)))];
  const n = Math.round(Number(v?.banDays));
  const banDays = Number.isFinite(n) ? Math.min(BAN_DAYS_MAX, Math.max(1, n)) : BAN_DAYS_DEFAULT;
  return { perms, banDays };
}

// Which permission each Admin Board request needs. A request not listed here is for the owner alone
// (passwords, birth dates, deleting accounts, past lives, the log, and giving admin access).
export const ROUTE_PERMS = {
  // looking
  'GET stats': 'any', 'GET accounts': 'any', 'GET online': 'any', 'GET player': 'any', 'GET catalogue': 'any', 'GET me': 'any',
  'GET chat': 'chat', 'GET reports': 'reports', 'GET world': ['world', 'announce'], 'GET tuning': 'world', 'GET sects': 'world', 'GET skills': 'edit',
  // doing
  'POST mute': 'mute', 'POST ban': 'ban', 'POST signout': 'kick', 'POST chat/delete': 'chat', 'POST reports/close': 'reports',
  'POST announce': 'announce', 'POST move': 'move', 'POST edit': 'edit', 'POST skip/childhood': 'edit',
  'POST gates': 'world', 'POST take': 'world', 'POST kings/reset': 'world', 'POST tuning': 'world', 'POST sects': 'world',
  // gifts and pets (Change characters), monster attacks and bringing back the great beasts (Run the world)
  'GET gifts': 'edit', 'POST gift': 'edit', 'POST gift/unsend': 'edit', 'POST pet': 'edit',
  'GET raids': 'world', 'POST raid': 'world', 'POST raid/end': 'world', 'POST revive': 'world',
};
// Board requests that act on one player (by id): an admin the owner made can't use them on the owner
// or on another admin
export const ON_A_PLAYER = ['POST mute', 'POST ban', 'POST signout', 'POST move', 'POST edit', 'POST skip/childhood', 'POST sects', 'POST pet', 'POST gift'];

// May someone with these permissions make this request? (`body` for Heal, which goes through edit)
export function allowed(perms, key, body) {
  const need = ROUTE_PERMS[key];
  if (!need) return false;
  if (need === 'any') return true;
  if (key === 'POST edit' && !perms.includes('edit')) {
    // healing alone is its own permission
    return perms.includes('heal') && body && Object.keys(body).every((k) => k === 'id' || k === 'heal');
  }
  return (Array.isArray(need) ? need : [need]).some((p) => perms.includes(p));
}
