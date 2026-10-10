import { betainc, betaincInv } from './special.ts'

/** P(X ≤ k), X ~ Binomial(n, p). */
export function binomCdf(k: number, n: number, p: number): number {
  if (k < 0) return 0
  if (k >= n) return 1
  return betainc(n - k, k + 1, 1 - p)
}

/** P(X ≥ k). */
export function binomSf(k: number, n: number, p: number): number {
  if (k <= 0) return 1
  if (k > n) return 0
  return betainc(k, n - k + 1, p)
}

/** Two-sided exact p-value by doubling the smaller tail. */
export function binomTwoSidedP(x: number, n: number, p: number): number {
  return Math.min(1, 2 * Math.min(binomCdf(x, n, p), binomSf(x, n, p)))
}

/** Clopper–Pearson interval for x successes in n at the given level (e.g. 0.95). */
export function clopperPearson(x: number, n: number, level: number): [number, number] {
  if (n === 0) return [0, 1]
  const alpha = 1 - level
  const lo = x === 0 ? 0 : betaincInv(x, n - x + 1, alpha / 2)
  const hi = x === n ? 1 : betaincInv(x + 1, n - x, 1 - alpha / 2)
  return [lo, hi]
}
