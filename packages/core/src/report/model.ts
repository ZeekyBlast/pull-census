import { disclosedHazard, type Hazard, softPityHazard } from '../sim/simulate.ts'
import { normCdf } from '../stats/special.ts'

/**
 * The public soft-pity model: the long-known community measurement, which our OneBST calibration reproduces
 * (methods/v1.md section 10) and which matches each pool's disclosed consolidated rate. PityCheck compares
 * against a simulation of it until the census measures a pool (spec section 7).
 */
export type PityModel = { base: number; onset: number; step: number; hardPity: number }

const CHARACTER: PityModel = { base: 0.006, onset: 74, step: 0.06, hardPity: 90 }
export const PUBLIC_MODEL: Record<string, PityModel> = {
  'character-event': CHARACTER,
  standard: CHARACTER,
  chronicled: CHARACTER,
  'weapon-event': { base: 0.007, onset: 63, step: 0.07, hardPity: 80 },
}

/** A pity distribution: pmf[k - 1] = P(the 5★ lands on pull k), cdf[k - 1] = P(by pull k). */
export type Dist = { pmf: number[]; cdf: number[] }

export function distFromHazard(h: Hazard, maxK: number): Dist {
  const pmf: number[] = []
  const cdf: number[] = []
  let survive = 1
  let total = 0
  for (let k = 1; k <= maxK; k++) {
    const p = survive * h(k)
    pmf.push(p)
    total += p
    cdf.push(total)
    survive *= 1 - h(k)
  }
  return { pmf, cdf }
}

export const modelDist = (m: PityModel): Dist =>
  distFromHazard(softPityHazard(m.base, m.onset, m.step, m.hardPity), m.hardPity)

/** The catalogue: the disclosed base rate on every pull, certain at hard pity. */
export const catalogueDist = (m: PityModel): Dist =>
  distFromHazard(disclosedHazard(m.base, m.hardPity), m.hardPity)

/** F(k) with F(0) = 0 and F(k) = 1 past the end. */
export const cdfAt = (d: Dist, k: number): number =>
  k <= 0 ? 0 : k > d.cdf.length ? 1 : (d.cdf[k - 1] as number)

export const mean = (d: Dist): number => d.pmf.reduce((a, p, i) => a + p * (i + 1), 0)

/** Smallest k with F(k) >= q. */
export const quantile = (d: Dist, q: number): number => {
  const i = d.cdf.findIndex((v) => v >= q - 1e-12)
  return i === -1 ? d.cdf.length : i + 1
}

/** The soft-pity band ("the Milky Way"): from onset to the pull where 99.9% of nights have ended. */
export const band = (m: PityModel): [number, number] => [m.onset, quantile(modelDist(m), 0.999)]

/** Largest night count summed exactly; above it the normal approximation is used. */
const EXACT_SUM_MAX = 100

/**
 * P(sum of n independent pities > s): the share of simulated accounts with n nights whose mean wait is longer
 * than a mean of s / n. Exact by convolution up to EXACT_SUM_MAX nights.
 * ponytail: normal approximation above 100 nights (error well under 1 point there); FFT if that ever matters.
 */
export function sumExceeds(d: Dist, n: number, s: number): number {
  if (n <= 0) return 0
  if (n > EXACT_SUM_MAX) {
    const mu = mean(d)
    const v = d.pmf.reduce((a, p, i) => a + p * (i + 1 - mu) ** 2, 0)
    const z = (s + 0.5 - n * mu) / Math.sqrt(n * v)
    return 1 - normCdf(z)
  }
  // dist[t] = P(sum = t), built one night at a time.
  let dist = [1]
  for (let j = 0; j < n; j++) {
    const next = new Array<number>(dist.length + d.pmf.length).fill(0)
    for (let t = 0; t < dist.length; t++) {
      const a = dist[t] as number
      if (a === 0) continue
      for (let k = 0; k < d.pmf.length; k++) next[t + k + 1]! += a * (d.pmf[k] as number)
    }
    dist = next
  }
  let above = 0
  for (let t = Math.floor(s) + 1; t < dist.length; t++) above += dist[t] as number
  return Math.min(1, Math.max(0, above))
}
