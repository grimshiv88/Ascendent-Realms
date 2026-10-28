// Meeting rooms upstairs in the Main Guild Hall. A party leader or guild master rents one for a
// while, chooses who else may come in, and talks with them in the room's own private chat. When the
// time is up, everyone in the room is sent back out to the hallway.
export const MEETING_ROOMS = [
  { id: 'hall1', name: 'Oak Room', seats: 6 },
  { id: 'hall2', name: 'Lantern Room', seats: 6 },
  { id: 'hall3', name: 'Map Room', seats: 6 },
  { id: 'hall4', name: 'High Room', seats: 6 },
];
export const roomById = (id) => MEETING_ROOMS.find((r) => r.id === id) || null;
// how long a room can be rented for (minutes), and its price
export const ROOM_TIMES = [30, 60, 120];
export const ROOM_PRICE_PER_MIN = 2;
export const roomCost = (minutes) => minutes * ROOM_PRICE_PER_MIN;
export const MAX_GUESTS = 8;

// Check a rent request: { room, minutes, guests: [names] }. Returns { error } or the clean values.
export function checkRent(body, rentals, now = Date.now()) {
  const room = roomById(body?.room);
  if (!room) return { error: 'There is no such room.' };
  const minutes = Number(body.minutes);
  if (!ROOM_TIMES.includes(minutes)) return { error: 'Choose how long to rent it for.' };
  if (rentals.some((r) => r.room === room.id && r.until > now)) return { error: `The ${room.name} is taken right now.` };
  const guests = cleanGuests(body.guests);
  if (guests.error) return guests;
  return { room, minutes, guests, cost: roomCost(minutes) };
}
export function cleanGuests(list) {
  const names = [...new Set((Array.isArray(list) ? list : []).map((n) => String(n || '').trim()).filter(Boolean))];
  if (names.length > MAX_GUESTS) return { error: `You can let in up to ${MAX_GUESTS} people.` };
  if (names.some((n) => n.length > 24)) return { error: 'That name is too long.' };
  return names;
}
// who may be in a rented room
export const mayEnter = (rental, name) => !!rental && (rental.renter === name || rental.guests.includes(name));
