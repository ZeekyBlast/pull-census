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
  consolidated: {
    fiveStars: number
    pulls: number
    rate: number | null
    lo: number
    hi: number
    disclosed: number
  }
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

  const closed = streaks.filter((s) => !s.censored)
  const pulls = closed.reduce((a, s) => a + s.length, 0)
  const [lo, hi] = clopperPearson(closed.length, pulls, 0.95)
  return {
    softPity: hazardCurve(streaks, pr.hardPity5.value, 0.95),
    fiftyFiftyAfterLosses: byK.map((b, k) => {
      const [l, h] = clopperPearson(b.wins, b.n, 0.95)
      return { k, n: b.n, wins: b.wins, rate: b.n ? b.wins / b.n : null, lo: l, hi: h }
    }),
    consolidated: {
      fiveStars: closed.length,
      pulls,
      rate: pulls ? closed.length / pulls : null,
      lo,
      hi,
      disclosed: pr.consolidated5.value,
    },
  }
}
