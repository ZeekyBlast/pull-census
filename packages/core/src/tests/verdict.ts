// The five pre-registered verdict tests (spec section 8.2). Each returns 'pending' with a raw p;
// runRelease applies Holm across the release and settles the status.
import { poolRules } from '../rules/load.ts'
import type { Rules } from '../rules/schema.ts'
import { binomCdf, binomTwoSidedP } from '../stats/binom.ts'
import { exposure } from '../stats/hazard.ts'
import { minNOneSample } from '../stats/power.ts'
import type { CensusData } from '../types.ts'
import { base, baseRateLast, byAccount, hasUnknown, interval, usable } from './common.ts'
import {
  ALPHA,
  BASE_RATE_MDE,
  FIFTY_FIFTY_MDE,
  FLOOR_POSITIONS,
  POWER,
  type TestResult,
} from './definitions.ts'

function rateTest(
  id: string,
  data: CensusData,
  pool: string,
  last: number,
  p0: number,
  needed: number,
  pValue: (x: number, n: number) => number,
  reps: number,
): TestResult {
  const rows = byAccount(
    usable(data, pool),
    (s) => s.accountId,
    (s) => {
      const e = exposure(s, last)
      return [e.events, e.pulls]
    },
    2,
  )
  const x = rows.reduce((a, r) => a + r[0]!, 0)
  const n = rows.reduce((a, r) => a + r[1]!, 0)
  const r = { ...base(id, 'verdict', pool), n, needed, expected: p0, observed: n ? x / n : null }
  if (n < needed) return { ...r, status: 'seeing-too-poor' }
  return {
    ...r,
    effect: x / n - p0,
    p: pValue(x, n),
    interval: interval(id, rows, (s) => s[0]! / s[1]!, reps),
  }
}

/** 1. Base rate: hazard at pulls before soft pity vs the disclosed base rate. Two-sided. */
export function baseRate(data: CensusData, rules: Rules, pool: string, reps: number): TestResult {
  const p0 = poolRules(rules, pool).base5.value
  const needed = Math.max(
    minNOneSample(p0, p0 * (1 + BASE_RATE_MDE), ALPHA, POWER, 2),
    minNOneSample(p0, p0 * (1 - BASE_RATE_MDE), ALPHA, POWER, 2),
  )
  const last = baseRateLast(pool)
  return rateTest(
    `base-rate:${pool}`,
    data,
    pool,
    last,
    p0,
    needed,
    (x, n) => binomTwoSidedP(x, n, p0),
    reps,
  )
}

/** 2. Hidden floor: 5★ in the first FLOOR_POSITIONS pulls vs expected. One-sided (fewer than expected). */
export function hiddenFloor(
  data: CensusData,
  rules: Rules,
  pool: string,
  reps: number,
): TestResult {
  const p0 = poolRules(rules, pool).base5.value
  const needed = minNOneSample(p0, p0 * (1 - BASE_RATE_MDE), ALPHA, POWER, 1)
  return rateTest(
    `hidden-floor:${pool}`,
    data,
    pool,
    FLOOR_POSITIONS,
    p0,
    needed,
    (x, n) => binomCdf(x, n, p0),
    reps,
  )
}

/** 3. Hard pity: any verified streak longer than the disclosed maximum. Deterministic. */
export function hardPity(data: CensusData, rules: Rules, pool: string): TestResult {
  const max = poolRules(rules, pool).hardPity5.value
  // Left-truncated and open streaks count too: their observed length is a lower bound.
  const streaks = data.streaks.filter((s) => s.pool === pool)
  const flagged = streaks.filter((s) => s.length > max).length
  const r = {
    ...base(`hard-pity:${pool}`, 'verdict', pool),
    n: streaks.length,
    needed: 1,
    expected: max,
    flagged,
  }
  if (streaks.length === 0) return { ...r, status: 'seeing-too-poor' }
  return { ...r, status: flagged > 0 ? 'differs' : 'consistent' }
}

/** 4. Featured rate: P(featured | not guaranteed). One-sided (lower) when a catch-up mechanic is disclosed. */
export function featuredRate(
  data: CensusData,
  rules: Rules,
  pool: string,
  reps: number,
): TestResult | null {
  const pr = poolRules(rules, pool)
  if (!pr.featuredRate) return null
  const id = `featured-rate:${pool}`
  const p0 = pr.featuredRate.value
  const oneSided = pr.catchUp !== null
  const needed = oneSided
    ? minNOneSample(p0, p0 - FIFTY_FIFTY_MDE, ALPHA, POWER, 1)
    : Math.max(
        minNOneSample(p0, Math.min(0.999, p0 + FIFTY_FIFTY_MDE), ALPHA, POWER, 2),
        minNOneSample(p0, p0 - FIFTY_FIFTY_MDE, ALPHA, POWER, 2),
      )
  const flips = usable(data, pool).filter(
    (s) => s.guaranteed === false && (s.outcome === 'featured' || s.outcome === 'standard'),
  )
  const rows = byAccount(
    flips,
    (s) => s.accountId,
    (s) => [s.outcome === 'featured' ? 1 : 0, 1],
    2,
  )
  const x = rows.reduce((a, r) => a + r[0]!, 0)
  const n = flips.length
  const r = { ...base(id, 'verdict', pool), n, needed, expected: p0, observed: n ? x / n : null }
  if (hasUnknown(data, pool)) return { ...r, status: 'rules-need-update' }
  if (n < needed) return { ...r, status: 'seeing-too-poor' }
  return {
    ...r,
    effect: x / n - p0,
    p: oneSided ? binomCdf(x, n, p0) : binomTwoSidedP(x, n, p0),
    interval: interval(id, rows, (s) => s[0]! / s[1]!, reps),
  }
}

/** 5. 4★ guarantee: any run of guarantee4Every pulls without a 4★ or better. Deterministic. */
export function fourStarGuarantee(data: CensusData, rules: Rules, pool: string): TestResult {
  const every = poolRules(rules, pool).guarantee4Every.value
  const runs = data.noFour.filter((r) => r.pool === pool)
  const flagged = runs.filter((r) => r.longest >= every).length
  const r = {
    ...base(`four-star:${pool}`, 'verdict', pool),
    n: runs.length,
    needed: 1,
    expected: every,
    flagged,
  }
  if (runs.length === 0) return { ...r, status: 'seeing-too-poor' }
  return { ...r, status: flagged > 0 ? 'differs' : 'consistent' }
}
