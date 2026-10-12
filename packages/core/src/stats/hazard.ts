import type { Streak } from '../types.ts'
import { clopperPearson } from './binom.ts'

export type HazardPoint = {
  k: number
  atRisk: number
  events: number
  /** null where no streak is at risk. */
  h: number | null
  lo: number
  hi: number
}

/**
 * Discrete hazard per position: of the streaks that reached pull k, the share that ended there.
 * Censored streaks count as at risk up to their length. Left-truncated streaks must be filtered out by the caller.
 */
export function hazardCurve(streaks: Streak[], maxK: number, level = 0.95): HazardPoint[] {
  const reached = new Array<number>(maxK + 2).fill(0)
  const ended = new Array<number>(maxK + 2).fill(0)
  for (const s of streaks) {
    reached[Math.min(s.length, maxK + 1)]! += 1
    if (!s.censored && s.length <= maxK) ended[s.length]! += 1
  }
  const out: HazardPoint[] = []
  let atRisk = streaks.length
  for (let k = 1; k <= maxK; k++) {
    const events = ended[k]!
    const [lo, hi] = clopperPearson(events, atRisk, level)
    out.push({ k, atRisk, events, h: atRisk ? events / atRisk : null, lo, hi })
    atRisk -= reached[k]!
  }
  return out
}

/** Pulls at positions 1..last and the 5★ among them, per streak. */
export function exposure(s: Streak, last: number): { pulls: number; events: number } {
  return { pulls: Math.min(s.length, last), events: !s.censored && s.length <= last ? 1 : 0 }
}
