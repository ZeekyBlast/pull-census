// Measured mechanics (spec section 8.4): published with a "measured, not disclosed" label, never a verdict.
import { poolRules } from '../rules/load.ts'
import type { Rules } from '../rules/schema.ts'
import { clopperPearson } from '../stats/binom.ts'
import { type HazardPoint, hazardCurve } from '../stats/hazard.ts'
import type { CensusData } from '../types.ts'
import { usable } from './common.ts'
import { FIFTY_FIFTY_MAX_K } from './definitions.ts'

export type Mechanics = {
  softPity: HazardPoint[]
  fiftyFiftyAfterLosses: {
    k: number
    n: number
    wins: number
    rate: number | null
    lo: number
    hi: number
  }[]
  /** 5★ per pull in the long run: 1 / expected streak length, from the hazard curve (uses open streaks too). */
  consolidated: { rate: number | null; disclosed: number }
}

export function mechanics(data: CensusData, rules: Rules, pool: string): Mechanics {
  const pr = poolRules(rules, pool)
  const streaks = usable(data, pool)

  const byK = Array.from({ length: FIFTY_FIFTY_MAX_K + 1 }, () => ({ n: 0, wins: 0 }))
  for (const s of streaks) {
    if (s.guaranteed !== false || s.lossesBefore === null) continue
    if (s.outcome !== 'featured' && s.outcome !== 'standard') continue
    const bucket = byK[Math.min(s.lossesBefore, FIFTY_FIFTY_MAX_K)]!
    bucket.n++
    if (s.outcome === 'featured') bucket.wins++
  }

  const softPity = hazardCurve(streaks, pr.hardPity5.value, 0.95)
  // Closed streaks alone over-count short ones; the survival curve doesn't.
  let survive = 1
  let expectedLength = 0
  for (const p of softPity) {
    expectedLength += survive
    survive *= 1 - p.h
  }
  return {
    softPity,
    fiftyFiftyAfterLosses: byK.map((b, k) => {
      const [l, h] = clopperPearson(b.wins, b.n, 0.95)
      return { k, n: b.n, wins: b.wins, rate: b.n ? b.wins / b.n : null, lo: l, hi: h }
    }),
    consolidated: {
      rate: softPity[0]?.atRisk ? 1 / expectedLength : null,
      disclosed: pr.consolidated5.value,
    },
  }
}
