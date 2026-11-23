// The game's database: Postgres (Supabase when the game is online).
// The connection comes from the DATABASE_URL setting (or POSTGRES_URL, which the Supabase
// integration for Vercel fills in). Nothing secret is ever written in the code.
//
//   await db.get(sql, ...args)   first row or undefined
//   await db.all(sql, ...args)   every row
//   await db.run(sql, ...args)   { changes, rows } (add RETURNING to get rows back)
//   await db.tx(async (t) => { await t.run(...) })   several changes that succeed or fail together
//
// SQL is written with ? for each value; it is turned into Postgres's $1, $2 ... here.
const { Pool, types } = require('pg');
const { SCHEMA } = require('./schema');

// big whole numbers (times in milliseconds, counts) come back as plain numbers, and times as ISO text
types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
types.setTypeParser(1184, (v) => (v === null ? null : new Date(v).toISOString()));

function connection() {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
  if (!raw) throw new Error('No database set. Set DATABASE_URL (or POSTGRES_URL) to the Supabase connection string.');
  const url = new URL(raw);
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname) || url.searchParams.get('sslmode') === 'disable';
  // Supabase's certificate isn't in Node's own list, so the connection is encrypted without that check
  for (const k of ['sslmode', 'supa', 'pgbouncer', 'connection_limit']) url.searchParams.delete(k);
  return { connectionString: url.toString(), ssl: local ? false : { rejectUnauthorized: false } };
}

let pool = null;
let ready = null;
function getPool() {
  if (!pool) {
    // one serverless instance handles one request at a time, so a few connections are plenty
    pool = new Pool({ ...connection(), max: Number(process.env.DB_POOL_MAX) || 3, idleTimeoutMillis: 10000 });
    pool.on('error', () => {}); // a dropped idle connection is simply replaced
  }
  return pool;
}

// The tables are made the first time they are needed (CREATE ... IF NOT EXISTS, so it is safe to repeat)
function prepare() {
  if (!ready) {
    ready = (async () => {
      for (let tries = 0; ; tries++) {
        try { await getPool().query(SCHEMA); return; } catch (e) {
          // two new servers starting at the same moment can trip over each other; try again
          if (tries >= 3) { ready = null; throw e; }
          await new Promise((r) => setTimeout(r, 200 * (tries + 1)));
        }
      }
    })();
  }
  return ready;
}

const toPg = (sql) => { let n = 0; return sql.replace(/\?/g, () => `$${++n}`); };

function wrap(run) {
  return {
    get: async (sql, ...args) => (await run(toPg(sql), args)).rows[0],
    all: async (sql, ...args) => (await run(toPg(sql), args)).rows,
    run: async (sql, ...args) => { const r = await run(toPg(sql), args); return { changes: r.rowCount, rows: r.rows }; },
  };
}

const db = wrap(async (sql, args) => { await prepare(); return getPool().query(sql, args); });

db.tx = async (fn) => {
  await prepare();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const out = await fn(wrap((sql, args) => client.query(sql, args)));
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
};

db.ready = prepare;
db.end = async () => { if (pool) await pool.end(); pool = null; ready = null; };

module.exports = db;
