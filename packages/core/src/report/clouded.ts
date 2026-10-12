// "Clouded out", the Dry List (spec section 7, board V6Clouded): every wait for a featured star.
import { poolRules } from '../rules/load.ts'
import type { Rules } from '../rules/schema.ts'
import { cdfAt, type Dist, quantile } from './model.ts'
import type { Night, PoolReport } from './nights.ts'

export type Wait = {
  nights: Night[]
  /** Banner of the star that ended the wait; for a wait still going, of its latest night. */
  bannerId: string | null
  /** Pulls from the first pull after the previous featured star to the featured star itself (or so far). */
  total: number
  /** Still dry: no featured star yet. */
  open: boolean
  /**
   * 'unknown-start': began before the history or after an unknown 5★, so its length is a lower bound.
   * 'rules-need-update': ended on a 5★ the registry doesn't know yet (spec section 9).
   */
  status: 'ok' | 'unknown-start' | 'rules-need-update'
  /** Share of observers whose wait was shorter ("longer than X% of observers"); null unless status is ok. */
  longerThan: number | null
}

export type Clouded = {
  waits: Wait[]
  /** The longest finished wait with a known start. */
  longest: Wait | null
  /** Pulls-to-featured distribution from a fresh 50/50 (index t - 1), up to two nights. */
  dist: Dist
  quartiles: [number, number, number]
  basis: 'simulated'
}

/** Pulls to a featured star from a fresh 50/50: one night if the coin is won, two if it is lost. */
export function waitDist(night: Dist, winRate: number): Dist {
  const n = night.pmf.length
  const pmf = new Array<number>(2 * n).fill(0)
  for (let a = 1; a <= n; a++) {
    const pa = night.pmf[a - 1] as number
    pmf[a - 1]! += winRate * pa
    for (let b = 1; b <= n; b++)
      pmf[a + b - 1]! += (1 - winRate) * pa * (night.pmf[b - 1] as number)
  }
  let total = 0
  return { pmf, cdf: pmf.map((p) => (total += p)) }
}

/** The Dry List, or null for pools without a 50/50 (or with a chart path, where the target can't be known). */
export function cloudedOut(r: PoolReport, rules: Rules): Clouded | null {
  const pr = poolRules(rules, r.pool)
  if (!pr.featuredRate || !pr.guaranteeAfterLoss || pr.chartPath) return null
  const dist = waitDist(r.dist, pr.featuredRate.value)

  const waits: Wait[] = []
  let cur: Night[] = []
  let startKnown = false
  const close = (status: Wait['status'], open: boolean, extra = 0) => {
    const total = cur.reduce((a, n) => a + n.pity, 0) + extra
    const ok = status === 'ok'
    waits.push({
      nights: cur,
      bannerId: cur.at(-1)?.bannerId ?? null,
      total,
      open,
      status,
      longerThan: !ok ? null : open ? cdfAt(dist, total) : cdfAt(dist, total - 1),
    })
    cur = []
  }
  for (const night of r.nights) {
    if (night.truncated) {
      // Only a featured first star tells us the next wait starts fresh.
      startKnown = night.outcome === 'featured'
      continue
    }
    cur.push(night)
    if (night.outcome === 'featured') {
      close(startKnown ? 'ok' : 'unknown-start', false)
      startKnown = true
    } else if (night.outcome === 'unknown') {
      close('rules-need-update', false)
      startKnown = false
    }
    // A lost 50/50 keeps the wait going: the promised star ends it.
  }
  if (cur.length > 0 || r.open) close(startKnown ? 'ok' : 'unknown-start', true, r.open?.pity ?? 0)

  let longest: Wait | null = null
  for (const w of waits)
    if (w.status === 'ok' && !w.open && (!longest || w.total > longest.total)) longest = w
  return {
    waits,
    longest,
    dist,
    quartiles: [quantile(dist, 0.25), quantile(dist, 0.5), quantile(dist, 0.75)],
    basis: 'simulated',
  }
}
