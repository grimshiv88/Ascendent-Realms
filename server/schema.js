// Every table the game keeps (Postgres). Run on start; safe to run again and again.
// Row Level Security is switched on for every table with no rules, so the public Supabase web API
// can't read or change anything: only the game's own server (which connects as the owner) can.
const TABLES = ['admin_log', 'reports', 'accounts', 'sessions', 'characters', 'fallen', 'world_state', 'lands', 'cave_owners', 'city_homes', 'courts', 'friends', 'chat', 'rentals', 'bounties', 'auth_codes', 'past_lives', 'oil_wells', 'presence', 'duels', 'arena_players'];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL,
  username      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen     BIGINT NOT NULL DEFAULT 0,
  last_sent     BIGINT NOT NULL DEFAULT 0
);
-- the real-world country the player said they are from (its flag shows on the in-game ID)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS country TEXT;
-- emails: confirmed or not, the welcome email sent, and 2-step sign-in ('email' or 'app')
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS welcomed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS twofa TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS totp_secret TEXT;
-- the player's real birth date (YYYY-MM-DD), for age rules; only the player sees it
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS birthdate TEXT;
-- the admin board: a ban (until when, 0 = none, -1 = forever, and why) and a chat mute (until when)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS banned_until BIGINT NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS muted_until BIGINT NOT NULL DEFAULT 0;
-- admin access the owner gave this account: JSON { perms: [...], banDays } (see public/js/data/staff.mjs)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS admin_perms TEXT;
-- voice chat: passed a real age check (an ID check service, for later; the birth date is used until then)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS voice_verified BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS accounts_email ON accounts (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS accounts_username ON accounts (lower(username));

-- codes sent by email (or waiting for an authenticator app): only a scrambled copy of each code is kept
CREATE TABLE IF NOT EXISTS auth_codes (
  ticket     TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  code_hash  TEXT NOT NULL,
  data       TEXT,
  expires    BIGINT NOT NULL,
  tries      INTEGER NOT NULL DEFAULT 0,
  created    BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_codes_account ON auth_codes (account_id, kind);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_account ON sessions (account_id);

-- one character per account
CREATE TABLE IF NOT EXISTS characters (
  account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  data       TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- what a fallen character passes on to the next one
CREATE TABLE IF NOT EXISTS fallen (
  account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  data       TEXT NOT NULL
);
-- every life a player has lost (the whole character as it was), for the admins: they can change one
-- and bring the player back to it
CREATE TABLE IF NOT EXISTS past_lives (
  id         SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  at         BIGINT NOT NULL,
  cause      TEXT,
  data       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS past_lives_account ON past_lives (account_id);
-- small shared states kept as one JSON value each (guilds, cults, proposals, ceremonies, city gates)
CREATE TABLE IF NOT EXISTS world_state (
  key  TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lands (
  ix         INTEGER NOT NULL,
  iz         INTEGER NOT NULL,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  owner      TEXT NOT NULL,
  purpose    TEXT NOT NULL,
  flat       DOUBLE PRECISION,
  cleared    INTEGER NOT NULL DEFAULT 0,
  build      TEXT,
  bought_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ix, iz)
);
CREATE TABLE IF NOT EXISTS cave_owners (
  cave       TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  owner      TEXT NOT NULL,
  bought_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS city_homes (
  city       TEXT NOT NULL,
  house      TEXT NOT NULL,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  owner      TEXT NOT NULL,
  bought_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (city, house)
);
-- the Monster Kings' courts, one per monster race
CREATE TABLE IF NOT EXISTS courts (
  race TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS friends (
  a            INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  b            INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  requested_by INTEGER NOT NULL,
  accepted     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (a, b)
);
CREATE TABLE IF NOT EXISTS chat (
  id        SERIAL PRIMARY KEY,
  channel   TEXT NOT NULL,
  from_id   INTEGER NOT NULL,
  from_name TEXT NOT NULL,
  text      TEXT NOT NULL,
  at        BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_channel ON chat (channel, id);

-- meeting rooms in the Main Guild Hall
CREATE TABLE IF NOT EXISTS rentals (
  id        SERIAL PRIMARY KEY,
  room      TEXT NOT NULL,
  renter_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  renter    TEXT NOT NULL,
  guests    TEXT NOT NULL,
  until     BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS bounties (
  id         SERIAL PRIMARY KEY,
  target     TEXT NOT NULL,
  by_id      INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  by_name    TEXT NOT NULL,
  prize      BIGINT NOT NULL,
  placed_at  BIGINT NOT NULL,
  state      TEXT NOT NULL DEFAULT 'open',
  claimed_by TEXT
);

-- every change made from the admin board, newest last
CREATE TABLE IF NOT EXISTS admin_log (
  id     SERIAL PRIMARY KEY,
  at     BIGINT NOT NULL,
  admin  TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT
);
-- players reported by other players (the "Report" button on a player's card)
CREATE TABLE IF NOT EXISTS reports (
  id      SERIAL PRIMARY KEY,
  at      BIGINT NOT NULL,
  by_id   INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  by_name TEXT NOT NULL,
  target  TEXT NOT NULL,
  reason  TEXT NOT NULL,
  text    TEXT,
  done    BOOLEAN NOT NULL DEFAULT false
);

-- oil derricks of the Oil Companies, one per pool (see data/economy.mjs)
CREATE TABLE IF NOT EXISTS oil_wells (
  id          TEXT PRIMARY KEY,
  x           INTEGER NOT NULL,
  z           INTEGER NOT NULL,
  account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  owner       TEXT NOT NULL,
  company     TEXT NOT NULL,
  last        BIGINT NOT NULL,
  tank        INTEGER NOT NULL DEFAULT 0,
  out_barrels INTEGER NOT NULL DEFAULT 0
);

-- where each player is right now, so players close by can see each other (see server/presence.js)
CREATE TABLE IF NOT EXISTS presence (
  account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  x          DOUBLE PRECISION NOT NULL,
  y          DOUBLE PRECISION NOT NULL,
  z          DOUBLE PRECISION NOT NULL,
  heading    DOUBLE PRECISION NOT NULL DEFAULT 0,
  speed      DOUBLE PRECISION NOT NULL DEFAULT 0,
  place      TEXT NOT NULL DEFAULT 'out',
  pose       TEXT NOT NULL DEFAULT '',
  body       TEXT,
  at         BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS presence_place_at ON presence (place, at);

-- Colosseum fights (see server/arena.js): a challenge, a fight waiting for both, a fight on, or one over.
-- 'friendly' duels and 'cup' fights of the Weekly Championship. The server keeps both fighters' HP.
CREATE TABLE IF NOT EXISTS duels (
  id         SERIAL PRIMARY KEY,
  kind       TEXT NOT NULL DEFAULT 'friendly',
  a_id       INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  b_id       INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  a_name     TEXT NOT NULL,
  b_name     TEXT NOT NULL,
  state      TEXT NOT NULL,
  made_at    BIGINT NOT NULL,
  until_at   BIGINT NOT NULL,
  a_in       BOOLEAN NOT NULL DEFAULT false,
  b_in       BOOLEAN NOT NULL DEFAULT false,
  start_at   BIGINT,
  ends_at    BIGINT,
  hp_a       INTEGER,
  hp_b       INTEGER,
  max_a      INTEGER,
  max_b      INTEGER,
  stats      TEXT,
  last_a     BIGINT NOT NULL DEFAULT 0,
  last_b     BIGINT NOT NULL DEFAULT 0,
  winner_id  INTEGER,
  how        TEXT,
  ended_at   BIGINT,
  cup_week   BIGINT,
  cup_round  INTEGER,
  cup_match  INTEGER
);
CREATE INDEX IF NOT EXISTS duels_a ON duels (a_id, state);
CREATE INDEX IF NOT EXISTS duels_b ON duels (b_id, state);
CREATE INDEX IF NOT EXISTS duels_state ON duels (state);
-- each player's Colosseum record, and whether they want its emails
CREATE TABLE IF NOT EXISTS arena_players (
  account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  wins       INTEGER NOT NULL DEFAULT 0,
  losses     INTEGER NOT NULL DEFAULT 0,
  cup_wins   INTEGER NOT NULL DEFAULT 0,
  mail_duels BOOLEAN NOT NULL DEFAULT true,
  mail_cup   BOOLEAN NOT NULL DEFAULT true
);

${TABLES.map((t) => `ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`).join('\n')}
`;

module.exports = { SCHEMA, TABLES };
