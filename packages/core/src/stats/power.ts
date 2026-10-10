import { normQuantile } from './special.ts'

/** Smallest n for a one-sample proportion test of p0 against p1 (normal approximation). */
export function minNOneSample(
  p0: number,
  p1: number,
  alpha: number,
  power: number,
  sides: 1 | 2,
): number {
  const za = normQuantile(1 - alpha / sides)
  const zb = normQuantile(power)
  const num = za * Math.sqrt(p0 * (1 - p0)) + zb * Math.sqrt(p1 * (1 - p1))
  return Math.ceil((num / (p1 - p0)) ** 2)
}

/** Smallest n per group for a two-sided two-proportion test of p0 against p1. */
export function minNTwoSample(p0: number, p1: number, alpha: number, power: number): number {
  const za = normQuantile(1 - alpha / 2)
  const zb = normQuantile(power)
  const pb = (p0 + p1) / 2
  const num = za * Math.sqrt(2 * pb * (1 - pb)) + zb * Math.sqrt(p0 * (1 - p0) + p1 * (1 - p1))
  return Math.ceil((num / (p1 - p0)) ** 2)
}
