# Ascendant Realms

An online 3D adventure game where you play as a non-human race (Elf, Dwarf, Hobbit, Giant, Beastkin) or a monster (Goblin, Slime, Fairy, Lizardman, Naga, Dragonewt), pick a class, and rise through the ranks. Each class has a single King crown for Players and one for Monsters, and only one character can hold each at a time.

## Running it on your computer

1. Install [Node.js](https://nodejs.org) version 22.5 or newer.
2. In this folder, run `npm install`.
3. Run `npm start`.
4. Open http://localhost:3000 in your browser.

Accounts are stored in `data/game.db`, which is created the first time the server starts.

## Admin board

Open http://localhost:3000/admin.html and sign in with an admin account to see every account and character, set a new password for a player who forgot theirs, sign an account out everywhere, or delete it.

Admins are set with the `ADMIN_EMAILS` setting (comma-separated emails) when starting the server, for example `ADMIN_EMAILS=you@example.com npm start`. Passwords are stored hashed, so they can't be shown, only replaced.
