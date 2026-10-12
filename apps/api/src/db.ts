import { DatabaseSync } from 'node:sqlite'
import type { Pull } from '@pull-census/core'

export type Db = DatabaseSync

/** Opt-in data only (spec section 5). Pulls keep their own tier: a verified upload never vouches for older self-reported rows. */
const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY,
  uid_hash TEXT NOT NULL,
  game TEXT NOT NULL,
  region TEXT,
  uid_coarse INTEGER NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('verified', 'self')),
  delete_token_hash TEXT NOT NULL UNIQUE,
  first_upload TEXT NOT NULL,
  last_upload TEXT NOT NULL,
  uploads INTEGER NOT NULL DEFAULT 1,
  UNIQUE (game, uid_hash)
);
CREATE TABLE IF NOT EXISTS pulls (
  account_id INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  pool TEXT NOT NULL,
  banner_id TEXT,
  item_id TEXT NOT NULL,
  rarity INTEGER NOT NULL,
  time TEXT NOT NULL,
  multi INTEGER NOT NULL,
  verified INTEGER NOT NULL,
  PRIMARY KEY (account_id, source_id)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS used_tokens (
  hash TEXT PRIMARY KEY,
  reason TEXT NOT NULL CHECK (reason IN ('used', 'replaced')),
  at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shares (
  code TEXT PRIMARY KEY,
  summary_json TEXT NOT NULL,
  delete_key_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`

export function openDb(path: string): Db {
  const db = new DatabaseSync(path)
  db.exec(SCHEMA)
  return db
}

export function transaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const out = fn()
    db.exec('COMMIT')
    return out
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

export type AccountRow = { id: number; tier: 'verified' | 'self'; delete_token_hash: string }

export function findAccount(db: Db, game: string, uidHash: string): AccountRow | undefined {
  return db
    .prepare('SELECT id, tier, delete_token_hash FROM accounts WHERE game = ? AND uid_hash = ?')
    .get(game, uidHash) as AccountRow | undefined
}

/** Insert pulls; a verified row replaces a self-reported row with the same id, never the reverse. Returns rows added. */
export function upsertPulls(db: Db, accountId: number, pulls: Pull[], verified: boolean): number {
  const before = countPulls(db, accountId)
  const stmt = db.prepare(`
    INSERT INTO pulls (account_id, source_id, pool, banner_id, item_id, rarity, time, multi, verified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (account_id, source_id) DO UPDATE SET
      pool = excluded.pool, banner_id = excluded.banner_id, item_id = excluded.item_id,
      rarity = excluded.rarity, time = excluded.time, multi = excluded.multi, verified = 1
    WHERE excluded.verified = 1 AND pulls.verified = 0`)
  for (const p of pulls)
    stmt.run(
      accountId,
      p.sourceId,
      p.pool,
      p.bannerId,
      p.itemId,
      p.rarity,
      p.time,
      p.multi ? 1 : 0,
      verified ? 1 : 0,
    )
  return countPulls(db, accountId) - before
}

export const countPulls = (db: Db, accountId: number) =>
  (
    db.prepare('SELECT count(*) AS n FROM pulls WHERE account_id = ?').get(accountId) as {
      n: number
    }
  ).n
