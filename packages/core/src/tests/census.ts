// Census Tests (spec section 8.3): base-rate hazard and 50/50 win rate compared between two groups.
import { compareToPoint, poolRules } from '../rules/load.ts'
import type { Rules } from '../rules/schema.ts'
import { minNTwoSample } from '../stats/power.ts'
import { normCdf } from '../stats/special.ts'
import type { AccountFacts, CensusData, Streak } from '../types.ts'
import { base, baseRateLast, byAccount, byText, hasUnknown, interval, usable } from './common.ts'
import {
  ALPHA,
  BASE_RATE_MDE,
  FIFTY_FIFTY_MDE,
  POWER,
  REGIONS,
  RETURNING_GAP_DAYS,
  type TestResult,
} from './definitions.ts'

/** Which group a streak belongs to: 'A', 'B', or null (left out). */
type Split = { name: string; side: (s: Streak) => 'A' | 'B' | null }

/** Accounts in the lowest (0) to highest (4) quintile of a value. */
function quintiles(facts: AccountFacts[], value: (f: AccountFacts) => number): Map<string, number> {
  const sorted = [...facts].sort((a, b) => value(a) - value(b) || byText(a.accountId, b.accountId))
  return new Map(sorted.map((f, i) => [f.accountId, Math.floor((i * 5) / sorted.length)]))
}

export function splits(data: CensusData, rules: Rules): Split[] {
  const out: Split[] = []
  const regionOf = new Map(data.facts.map((f) => [f.accountId, f.region]))

  // Account age: quintiles of uidCoarse within each region.
  const age = new Map<string, number>()
  for (const r of new Set(data.facts.map((f) => f.region))) {
    for (const [id, q] of quintiles(
      data.facts.filter((f) => f.region === r),
      (f) => f.uidCoarse,
    ))
      age.set(id, q)
  }
  out.push({
    name: 'account-age',
    side: (s) => (age.get(s.accountId) === 0 ? 'A' : age.get(s.accountId) === 4 ? 'B' : null),
  })

  // Volume before each streak, never over the whole history: unlucky players pull more to reach a goal.
  const byVolume = [...data.streaks].sort(
    (a, b) =>
      a.recentPulls - b.recentPulls ||
      byText(a.accountId, b.accountId) ||
      byText(a.pool, b.pool) ||
      Date.parse(a.start) - Date.parse(b.start),
  )
  const volume = new Map(byVolume.map((s, i) => [s, Math.floor((i * 5) / byVolume.length)]))
  out.push({
    name: 'pull-volume',
    side: (s) => (volume.get(s) === 4 ? 'A' : volume.get(s) === 0 ? 'B' : null),
  })

  out.push({
    name: 'returning',
    side: (s) => ((s.gapDaysBefore ?? 0) >= RETURNING_GAP_DAYS ? 'A' : 'B'),
  })

  for (const region of REGIONS) {
    out.push({
      name: `region-${region}`,
      side: (s) => {
        const r = regionOf.get(s.accountId)
        return r === region ? 'A' : r && (REGIONS as readonly string[]).includes(r) ? 'B' : null
      },
    })
  }

  // Patches inside the data's time span. A streak belongs to the side it starts on: its end depends on its
  // outcome, so splitting on ends (or dropping spanning streaks) would favour short streaks before the patch.
  for (const patch of rules.patches) {
    // Compare instants: times from different servers carry different offsets, so ISO strings don't sort.
    if (
      !data.streaks.some((s) => compareToPoint(s.start, patch.start) < 0) ||
      !data.streaks.some((s) => compareToPoint(s.end, patch.start) >= 0)
    )
      continue
    out.push({
      name: `patch-${patch.version}`,
      side: (s) => (compareToPoint(s.start, patch.start) < 0 ? 'A' : 'B'),
    })
  }
  return out
}

/** Two-sided two-proportion z-test. */
function twoProportionP(xa: number, na: number, xb: number, nb: number): number {
  const pooled = (xa + xb) / (na + nb)
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / na + 1 / nb))
  if (se === 0) return 1
  return 2 * normCdf(-Math.abs((xa / na - xb / nb) / se))
}

function compare(
  id: string,
  pool: string,
  rows: number[][],
  needed: number,
  reps: number,
): TestResult {
  const [xa, na, xb, nb] = [0, 1, 2, 3].map((j) => rows.reduce((a, r) => a + r[j]!, 0)) as [
    number,
    number,
    number,
    number,
  ]
  const n = Math.min(na, nb)
  const r = { ...base(id, 'census', pool), n, needed }
  if (n < needed) return { ...r, status: 'seeing-too-poor' }
  const diff = (s: number[]) => (s[1]! && s[3]! ? s[0]! / s[1]! - s[2]! / s[3]! : 0)
  return {
    ...r,
    observed: xa / na,
    expected: xb / nb,
    effect: xa / na - xb / nb,
    p: twoProportionP(xa, na, xb, nb),
    interval: interval(id, rows, diff, reps),
  }
}

/** Every Census Test for one pool. */
export function censusTests(
  data: CensusData,
  rules: Rules,
  pool: string,
  reps: number,
): TestResult[] {
  const pr = poolRules(rules, pool)
  const last = baseRateLast(pool)
  const p0 = pr.base5.value
  const neededRate = minNTwoSample(p0, p0 * (1 + BASE_RATE_MDE), ALPHA, POWER)
  const neededFlip = minNTwoSample(0.5, 0.5 + FIFTY_FIFTY_MDE, ALPHA, POWER)
  const streaks = usable(data, pool)
  const out: TestResult[] = []

  const rateRow = (s: Streak, side: (pos: number) => 'A' | 'B' | null) => {
    const row = [0, 0, 0, 0]
    const end = Math.min(s.length, last)
    for (let pos = 1; pos <= end; pos++) {
      const g = side(pos)
      if (g) row[g === 'A' ? 1 : 3]! += 1
    }
    const g = side(s.length)
    if (!s.censored && s.length <= last && g) row[g === 'A' ? 0 : 2]! += 1
    return row
  }
  const flipRow = (s: Streak, g: 'A' | 'B' | null) => {
    if (!g || s.guaranteed !== false || (s.outcome !== 'featured' && s.outcome !== 'standard'))
      return [0, 0, 0, 0]
    const win = s.outcome === 'featured' ? 1 : 0
    return g === 'A' ? [win, 1, 0, 0] : [0, 0, win, 1]
  }

  const add = (name: string, rate: (s: Streak) => number[], flip: (s: Streak) => number[]) => {
    out.push(
      compare(
        `census:${name}:base-rate:${pool}`,
        pool,
        byAccount(streaks, (s) => s.accountId, rate, 4),
        neededRate,
        reps,
      ),
    )
    if (!pr.featuredRate) return
    const id = `census:${name}:fifty-fifty:${pool}`
    if (hasUnknown(data, pool)) {
      out.push({ ...base(id, 'census', pool), needed: neededFlip, status: 'rules-need-update' })
      return
    }
    out.push(
      compare(
        id,
        pool,
        byAccount(streaks, (s) => s.accountId, flip, 4),
        neededFlip,
        reps,
      ),
    )
  }

  // Singles vs 10-pulls is per pull: group A = single pulls, group B = pulls inside a 10-pull.
  const bySingle = (s: Streak) => (pos: number) => (s.multi[pos - 1] ? 'B' : 'A') as 'A' | 'B'
  add(
    'singles-vs-multi',
    (s) => rateRow(s, bySingle(s)),
    (s) => flipRow(s, bySingle(s)(s.length)),
  )
  for (const sp of splits(data, rules))
    add(
      sp.name,
      (s) => rateRow(s, () => sp.side(s)),
      (s) => flipRow(s, sp.side(s)),
    )
  return out
}
