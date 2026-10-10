import type { CensusData, Streak } from '../../src/types.ts'

export const rec = (over: Partial<Streak> = {}): Streak => ({
  accountId: 'a1',
  pool: 'character-event',
  bannerId: 'T1-301',
  length: 60,
  censored: false,
  leftTruncated: false,
  multi: [],
  start: '2026-09-01T12:00:00+08:00',
  end: '2026-09-02T12:00:00+08:00',
  gapDaysBefore: 1,
  guaranteed: false,
  outcome: 'featured',
  lossesBefore: 0,
  verified: true,
  ...over,
})

export const census = (streaks: Streak[], over: Partial<CensusData> = {}): CensusData => ({
  streaks,
  facts: [...new Set(streaks.map((s) => s.accountId))].map((accountId) => ({
    accountId,
    region: 'asia',
    uidCoarse: 812,
    pullsPer30d: 100,
    verified: streaks.find((s) => s.accountId === accountId)!.verified,
  })),
  noFour: [],
  unknownItems: [],
  ...over,
})
