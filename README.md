# Ascendant Realms

An online 3D adventure game where you play as a non-human race (Elf, Dwarf, Hobbit, Giant, Beastkin) or a monster (Goblin, Slime, Fairy, Lizardman, Naga, Dragonewt), pick a class, and rise through the ranks. Each class has a single King crown for Players and one for Monsters, and only one character can hold each at a time.

## Playing it online (Vercel + Supabase)

The game runs on [Vercel](https://vercel.com), and every account, character and piece of the shared world is kept in a [Supabase](https://supabase.com) Postgres database.

1. In Vercel, **Add New → Project** and import this GitHub repository. Leave every build setting as it is (`vercel.json` sets them).
2. In the Vercel project, open **Storage** (or **Integrations**) and connect **Supabase**. It creates the database and fills in the `POSTGRES_URL` setting for you. (Or set `DATABASE_URL` yourself to the Supabase connection string: Supabase → Connect → Transaction pooler.)
3. In **Settings → Environment Variables**, add `ADMIN_EMAILS` with your own email, so your account can open the admin board.
4. Redeploy. The tables are made by the game itself the first time anyone opens it.

Every change pushed to `main` goes live by itself. No secret key is ever kept in the code: they live only in Vercel's settings.

The tables have Row Level Security switched on with no rules, so Supabase's public web API can't read or change them. Only the game's own server can.

## Running it on your computer

1. Install [Node.js](https://nodejs.org) version 22 (22.12 or newer).
2. In this folder, run `npm install`.
3. Point it at a Postgres database (a Supabase project, or one on your computer), for example
   `DATABASE_URL=postgres://user:pass@localhost:5432/ascendant npm start`.
4. Open http://localhost:3000 in your browser.

## Admin board

Open http://localhost:3000/admin.html and sign in with an admin account to see every account and character, set a new password for a player who forgot theirs, sign an account out everywhere, or delete it.

Admins are set with the `ADMIN_EMAILS` setting (comma-separated emails) when starting the server, for example `ADMIN_EMAILS=you@example.com npm start`. Passwords are stored hashed, so they can't be shown, only replaced.
