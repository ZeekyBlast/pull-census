import type { Rules } from '../rules/schema.ts'
import { holm } from '../stats/holm.ts'
import type { CensusData, Streak } from '../types.ts'
import { censusTests } from './census.ts'
import {
  ALPHA,
  BETA_GATE,
  BOOTSTRAP_REPS,
  METHOD_VERSION,
  SENSITIVITY_TRIM_PULLS,
  type Status,
  type TestResult,
} from './definitions.ts'
import { type Mechanics, mechanics } from './mechanics.ts'
import { baseRate, featuredRate, fourStarGuarantee, hardPity, hiddenFloor } from './verdict.ts'

export type Release = {
  method: string
  results: TestResult[]
  mechanics: Record<string, Mechanics>
  betaGate: { have: number; need: number; met: boolean }
}

/** Run every pre-registered test on one census snapshot, with Holm across all of them. */
export function runRelease(data: CensusData, rules: Rules, opts: { reps?: number } = {}): Release {
  const reps = opts.reps ?? BOOTSTRAP_REPS
  const pools = Object.entries(rules.pools)
    .filter(([, r]) => r.inCensus)
    .map(([p]) => p)
  const results: TestResult[] = []
  const mech: Record<string, Mechanics> = {}
  for (const pool of pools) {
    results.push(
      baseRate(data, rules, pool, reps),
      hiddenFloor(data, rules, pool, reps),
      hardPity(data, rules, pool),
    )
    const f = featuredRate(data, rules, pool, reps)
    if (f) results.push(f)
    results.push(fourStarGuarantee(data, rules, pool))
    results.push(...censusTests(data, rules, pool, reps))
    mech[pool] = mechanics(data, rules, pool)
  }

  const pending = results.filter((r) => r.status === 'pending')
  const adjusted = holm(pending.map((r) => r.p as number))
  pending.forEach((r, i) => {
    r.pAdj = adjusted[i] as number
    r.status = r.pAdj < ALPHA ? 'differs' : r.kind === 'verdict' ? 'consistent' : 'no-difference'
  })

  const have =
    rules.game === BETA_GATE.game
      ? data.streaks.filter(
          (s) => s.pool === BETA_GATE.pool && s.verified && !s.leftTruncated && !s.censored,
        ).length
      : 0
  return {
    method: METHOD_VERSION,
    results,
    mechanics: mech,
    betaGate: { have, need: BETA_GATE.streaks, met: have >= BETA_GATE.streaks },
  }
}

/** Verdicts use verified imports only (UIGF files count toward sensitivity checks, never verdicts). */
export function onlyVerified(data: CensusData): CensusData {
  const ok = new Set(data.facts.filter((f) => f.verified).map((f) => f.accountId))
  return {
    streaks: data.streaks.filter((s) => ok.has(s.accountId)),
    facts: data.facts.filter((f) => ok.has(f.accountId)),
    noFour: data.noFour.filter((r) => ok.has(r.accountId)),
    unknownItems: data.unknownItems.filter((u) => ok.has(u.accountId)),
  }
}

/**
 * Selection-bias check: drop each account's last `trim` pulls in each pool. The cut ignores outcomes, so the
 * streak crossing it becomes open (censored) instead of being dropped whole.
 */
export function withoutRecent(data: CensusData, trim = SENSITIVITY_TRIM_PULLS): CensusData {
  const total = new Map<string, number>()
  for (const s of data.streaks)
    total.set(`${s.accountId}|${s.pool}`, (total.get(`${s.accountId}|${s.pool}`) ?? 0) + s.length)
  const offset = new Map<string, number>()
  const streaks: Streak[] = []
  // Streaks are in pull order per account and pool.
  for (const s of data.streaks) {
    const key = `${s.accountId}|${s.pool}`
    const at = offset.get(key) ?? 0
    const cut = (total.get(key) ?? 0) - trim
    offset.set(key, at + s.length)
    if (at + s.length <= cut) streaks.push(s)
    else if (at < cut) {
      const length = cut - at
      streaks.push({
        ...s,
        length,
        censored: true,
        outcome: null,
        guaranteed: null,
        lossesBefore: null,
        multi: s.multi.slice(0, length),
      })
    }
  }
  return { ...data, streaks }
}

export type Disagreement = {
  variant: 'all-tiers' | 'without-recent'
  id: string
  main: Status
  other: Status
}

const settled = (s: Status) => s === 'consistent' || s === 'differs' || s === 'no-difference'

/**
 * The main release (verified only) plus the two sensitivity reruns; lists every test that reaches a result in
 * both runs and the results differ. A rerun that is only seeing too poor lacks data, it doesn't disagree.
 */
export function runWithSensitivity(all: CensusData, rules: Rules, opts: { reps?: number } = {}) {
  const verified = onlyVerified(all)
  const main = runRelease(verified, rules, opts)
  const variants = [
    ['all-tiers', runRelease(all, rules, opts)],
    ['without-recent', runRelease(withoutRecent(verified), rules, opts)],
  ] as const
  const status = new Map(main.results.map((r) => [r.id, r.status]))
  const disagreements: Disagreement[] = []
  for (const [variant, rel] of variants) {
    for (const r of rel.results) {
      const m = status.get(r.id)
      if (m && settled(m) && settled(r.status) && m !== r.status)
        disagreements.push({ variant, id: r.id, main: m, other: r.status })
    }
  }
  return { main, disagreements }
}
