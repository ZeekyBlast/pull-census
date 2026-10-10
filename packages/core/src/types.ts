export type Game = 'genshin' | 'hsr' | 'zzz'

/** One pull, as spec section 5 defines it. */
export type Pull = {
  game: Game
  /** Pity group, e.g. 'character-event' | 'weapon-event' | 'standard'. */
  pool: string
  /** Genshin: resolved from the registry's banner schedule by time and gacha_type. */
  bannerId: string | null
  itemId: string
  rarity: 3 | 4 | 5
  /** ISO 8601 with the server's UTC offset, e.g. 2026-09-30T18:05:12+08:00. */
  time: string
  /** The game's per-pull id, up to 19 digits, always a string. */
  sourceId: string
  /** Part of a 10-pull (10 rows sharing one timestamp). */
  multi: boolean
}

export type Outcome = 'featured' | 'standard' | 'unknown'

/** The pulls from one 5★ (exclusive) to the next 5★ (inclusive) in one pool. */
export type Streak = {
  accountId: string
  pool: string
  /** Banner of the streak's last pull. */
  bannerId: string | null
  /** Pulls in the streak. For a closed streak this is the pity of its 5★. */
  length: number
  /** Still open: no 5★ yet. Counts toward base-rate exposure only. */
  censored: boolean
  /** First streak of the import: its starting pity is unknown, so it's dropped from census statistics. */
  leftTruncated: boolean
  /** Per position (index 0 = pull 1): was that pull part of a 10-pull. */
  multi: boolean[]
  start: string
  end: string
  /** Days since the account's previous pull in any pool; null for the account's first pull. */
  gapDaysBefore: number | null
  /** Guarantee state before the 5★ landed, known only from an earlier 5★ in the import. */
  guaranteed: boolean | null
  /** null when censored or the pool has no featured 5★. */
  outcome: Outcome | null
  /** 50/50 losses since the last won 50/50 (guaranteed 5★ don't reset it); null if unknown. */
  lossesBefore: number | null
  verified: boolean
}

export type AccountFacts = {
  accountId: string
  region: string | null
  /** floor(uid / 1e6): a proxy for registration order. */
  uidCoarse: number
  pullsPer30d: number
  verified: boolean
}

/** Longest run of pulls in one pool with no 4★ or 5★. */
export type NoFourRun = { accountId: string; pool: string; longest: number }

export type CensusData = {
  streaks: Streak[]
  facts: AccountFacts[]
  noFour: NoFourRun[]
  /** 5★ item ids that are neither featured nor standard in the rules: the registry needs an update. */
  unknownItems: { pool: string; itemId: string; time: string }[]
}
