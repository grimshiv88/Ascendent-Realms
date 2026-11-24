# Ascendant Realms

An online 3D adventure game where you play as a non-human race (Elf, Dwarf, Hobbit, Giant, Beastkin) or a monster (Goblin, Slime, Fairy, Lizardman, Naga, Dragonewt), pick a class, and rise through the ranks. Each class has a single King crown for Players and one for Monsters, and only one character can hold each at a time.

## Playing it online (Vercel + Supabase)

The game runs on [Vercel](https://vercel.com), and every account, character and piece of the shared world is kept in a [Supabase](https://supabase.com) Postgres database.

1. In Vercel, **Add New → Project** and import this GitHub repository. Leave every build setting as it is (`vercel.json` sets them).
2. In the Vercel project, open **Storage** (or **Integrations**) and connect **Supabase**. It creates the database and fills in the `POSTGRES_URL` setting for you. (Or set `DATABASE_URL` yourself to the Supabase connection string: Supabase → Connect → Transaction pooler.)
3. In **Settings → Environment Variables**, add `ADMIN_EMAILS` with your own email, so your account can open the admin board.
4. Redeploy. The tables are made by the game itself the first time anyone opens it.

### Emails (confirm email, welcome, password reset, 2-step sign-in)

The game sends its emails through [Resend](https://resend.com) (free for 3,000 emails a month). Until it is set up, players can still sign up and play, but no email is sent, "Forgot password?" says it isn't switched on yet, and 2-step sign-in works only with an authenticator app.

1. Buy a domain (for example at Cloudflare, Porkbun or Namecheap).
2. In Resend: **Domains → Add Domain**, then copy the DNS records it shows into your domain's DNS settings and wait until it says **Verified**.
3. In Resend: **API Keys → Create API Key** with "Sending access".
4. In Vercel, **Settings → Environment Variables**, add:
   - `RESEND_API_KEY`: the key from step 3
   - `MAIL_FROM`: `Ascendant Realms <noreply@yourdomain.com>`
   - `APP_URL`: the game's address, for the links in the emails (for example `https://ascendent-realms.vercel.app`)
5. Redeploy. `/api/health` then shows `"mail": true`.

Once emails are on, every account must confirm its email before playing (accounts from before email was required are asked to add one), and an admin must have confirmed the email listed in `ADMIN_EMAILS`.

### Voice chat (players 16 and over)

Players near each other can talk. Voices fade with distance and can't be heard past 40 m. Each voice has a Mute button (only for you) and a Report button (shows on the admin board). Players in a party (made from the Friends menu) also get a party voice room, heard at full loudness at any distance; a Nearby / Party switch picks where your mic goes. A player muted on the admin board can't talk either. The voices go through [LiveKit Cloud](https://cloud.livekit.io) (free plan to start). Until it is set up, the mic button says voice chat isn't switched on yet.

1. Sign up at cloud.livekit.io and make a project.
2. **Settings → API Keys → Create key**.
3. In Vercel, **Settings → Environment Variables**, add `LIVEKIT_URL` (starts with `wss://`), `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`.
4. Redeploy. `/api/health` then shows `"voice": true`.

The age comes from the birth date given at sign-up. `VOICE_AGE_CHECK=id` makes voice also need `accounts.voice_verified`, for when an ID check service (for example Yoti) is added.

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
