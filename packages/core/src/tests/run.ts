import type { Rules } from '../rules/schema.ts'
import { holm } from '../stats/holm.ts'
import type { CensusData, Streak } from '../types.ts'
import { censusTests } from './census.ts'
import {
  ALPHA,
  BETA_GATE,
  BOOTSTRAP_REPS,
  METHOD_VERSION,
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
    unknownItems: data.unknownItems,
  }
}

/** Selection-bias check: drop each account's most recent streak in each pool. */
export function withoutLatest(data: CensusData): CensusData {
  // Streaks are in pull order per account and pool, so the last one seen is the latest.
  const latest = new Map<string, Streak>()
  for (const s of data.streaks) latest.set(`${s.accountId}|${s.pool}`, s)
  const drop = new Set(latest.values())
  return { ...data, streaks: data.streaks.filter((s) => !drop.has(s)) }
}

export type Disagreement = {
  variant: 'all-tiers' | 'without-latest'
  id: string
  main: Status
  other: Status
}

/** The main release (verified only) plus the two sensitivity reruns; lists every test whose status moves. */
export function runWithSensitivity(all: CensusData, rules: Rules, opts: { reps?: number } = {}) {
  const verified = onlyVerified(all)
  const main = runRelease(verified, rules, opts)
  const variants = [
    ['all-tiers', runRelease(all, rules, opts)],
    ['without-latest', runRelease(withoutLatest(verified), rules, opts)],
  ] as const
  const status = new Map(main.results.map((r) => [r.id, r.status]))
  const disagreements: Disagreement[] = []
  for (const [variant, rel] of variants) {
    for (const r of rel.results) {
      const m = status.get(r.id)
      if (m && m !== r.status) disagreements.push({ variant, id: r.id, main: m, other: r.status })
    }
  }
  return { main, disagreements }
}
