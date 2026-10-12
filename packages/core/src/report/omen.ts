// The omen check (spec section 7, board V6Omen): how unusual your record is, never a yes or no.
import { poolRules } from '../rules/load.ts'
import type { Rules } from '../rules/schema.ts'
import { mulberry32 } from '../stats/prng.ts'
import { METHOD_SEED } from '../tests/definitions.ts'
import type { PoolReport } from './nights.ts'

export const OMEN_SKIES = 10_000
/** The board promises this seed: "Use a fixed seed, 20261009, so anyone can rerun it and get the same numbers." */
export const OMEN_SEED = METHOD_SEED

export type Omen = {
  nights: number
  /** Real 50/50s: won or lost, not promised. */
  flips: number
  lost: number
  meanPity: number
  modelMean: number
  skies: number
  /** Per simulated sky: bit 1 = an average night at least this long, bit 2 = at least this many losses. */
  hits: Uint8Array
  meanHits: number
  lossHits: number
  /** Share of skies at least this unlucky: mean pity, and 50/50 losses (at the disclosed 50/50 rate). */
  pMean: number
  pLost: number
}

/** Simulate `skies` accounts with the same number of nights and coin flips. Same seed, same numbers. */
export function omenCheck(r: PoolReport, rules: Rules, skies = OMEN_SKIES): Omen | null {
  const k = r.complete.length
  if (k === 0) return null
  const sum = r.complete.reduce((a, n) => a + n.pity, 0)
  const flips = r.complete.filter((n) => n.coin === 'won' || n.coin === 'lost').length
  const lost = r.complete.filter((n) => n.coin === 'lost').length
  const win = poolRules(rules, r.pool).featuredRate?.value ?? 0.5
  const cdf = r.dist.cdf
  const draw = (u: number) => {
    let lo = 0
    let hi = cdf.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if ((cdf[mid] as number) >= u) hi = mid
      else lo = mid + 1
    }
    return lo + 1
  }

  const rand = mulberry32(OMEN_SEED)
  const hits = new Uint8Array(skies)
  let meanHits = 0
  let lossHits = 0
  for (let i = 0; i < skies; i++) {
    let s = 0
    for (let j = 0; j < k; j++) s += draw(rand())
    let l = 0
    for (let j = 0; j < flips; j++) if (rand() >= win) l++
    if (s >= sum) {
      hits[i]! |= 1
      meanHits++
    }
    if (l >= lost) {
      hits[i]! |= 2
      lossHits++
    }
  }
  return {
    nights: k,
    flips,
    lost,
    meanPity: sum / k,
    modelMean: r.modelMean,
    skies,
    hits,
    meanHits,
    lossHits,
    pMean: meanHits / skies,
    pLost: lossHits / skies,
  }
}
