// Hand-rolled special functions (spec section 4). Checked against scipy goldens in test/stats.

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
]

/** ln Γ(x) for x > 0 (Lanczos, g = 7). */
export function lgamma(x: number): number {
  if (!(x > 0)) throw new RangeError(`lgamma needs x > 0, got ${x}`)
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x)
  const z = x - 1
  let a = LANCZOS[0] as number
  const t = z + 7.5
  for (let i = 1; i < 9; i++) a += (LANCZOS[i] as number) / (z + i)
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a)
}

/** Continued fraction for the incomplete beta (modified Lentz). */
function betacf(a: number, b: number, x: number): number {
  const TINY = 1e-300
  let c = 1
  let d = 1 - ((a + b) * x) / (a + 1)
  if (Math.abs(d) < TINY) d = TINY
  d = 1 / d
  let h = d
  for (let m = 1; m <= 100_000; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < TINY) d = TINY
    c = 1 + aa / c
    if (Math.abs(c) < TINY) c = TINY
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1))
    d = 1 + aa * d
    if (Math.abs(d) < TINY) d = TINY
    c = 1 + aa / c
    if (Math.abs(c) < TINY) c = TINY
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-15) return h
  }
  throw new Error(`betacf did not converge (a=${a}, b=${b}, x=${x})`)
}

/** Regularized incomplete beta I_x(a, b). */
export function betainc(a: number, b: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const lnFront = lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log1p(-x)
  if (x < (a + 1) / (a + b + 2)) return (Math.exp(lnFront) * betacf(a, b, x)) / a
  return 1 - (Math.exp(lnFront) * betacf(b, a, 1 - x)) / b
}

/** Inverse of betainc in x, by bisection (monotone, so it always converges). */
export function betaincInv(a: number, b: number, p: number): number {
  if (p <= 0) return 0
  if (p >= 1) return 1
  let lo = 0
  let hi = 1
  for (let i = 0; i < 200 && hi - lo > 1e-15; i++) {
    const mid = (lo + hi) / 2
    if (betainc(a, b, mid) < p) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Regularized incomplete gamma: [P(a, x), Q(a, x)]. Series below a + 1, continued fraction above. */
function gammaPQ(a: number, x: number): [number, number] {
  if (x <= 0) return [0, 1]
  const lnFront = -x + a * Math.log(x) - lgamma(a)
  if (x < a + 1) {
    let sum = 1 / a
    let del = sum
    for (let n = 1; n < 100_000; n++) {
      del *= x / (a + n)
      sum += del
      if (Math.abs(del) < Math.abs(sum) * 1e-16) break
    }
    const p = sum * Math.exp(lnFront)
    return [p, 1 - p]
  }
  const TINY = 1e-300
  let b = x + 1 - a
  let c = 1 / TINY
  let d = 1 / b
  let h = d
  for (let i = 1; i < 100_000; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < TINY) d = TINY
    c = b + an / c
    if (Math.abs(c) < TINY) c = TINY
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-16) break
  }
  const q = Math.exp(lnFront) * h
  return [1 - q, q]
}

/** Standard normal CDF, accurate in both tails. */
export function normCdf(x: number): number {
  const [p, q] = gammaPQ(0.5, (x * x) / 2)
  return x >= 0 ? 0.5 + 0.5 * p : 0.5 * q
}

/** Standard normal quantile: Acklam's approximation plus one Halley step. */
export function normQuantile(p: number): number {
  if (!(p > 0 && p < 1)) throw new RangeError(`normQuantile needs 0 < p < 1, got ${p}`)
  const a = [
    -39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716,
    2.506628277459239,
  ]
  const b = [
    -54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972,
    -13.28068155288572,
  ]
  const c = [
    -0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ]
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]
  const [a0, a1, a2, a3, a4, a5] = a as [number, number, number, number, number, number]
  const [b0, b1, b2, b3, b4] = b as [number, number, number, number, number]
  const [c0, c1, c2, c3, c4, c5] = c as [number, number, number, number, number, number]
  const [d0, d1, d2, d3] = d as [number, number, number, number]
  const lowTail = 0.02425
  let x: number
  if (p < lowTail) {
    const q = Math.sqrt(-2 * Math.log(p))
    x =
      (((((c0 * q + c1) * q + c2) * q + c3) * q + c4) * q + c5) /
      ((((d0 * q + d1) * q + d2) * q + d3) * q + 1)
  } else if (p <= 1 - lowTail) {
    const q = p - 0.5
    const r = q * q
    x =
      ((((((a0 * r + a1) * r + a2) * r + a3) * r + a4) * r + a5) * q) /
      (((((b0 * r + b1) * r + b2) * r + b3) * r + b4) * r + 1)
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    x =
      -(((((c0 * q + c1) * q + c2) * q + c3) * q + c4) * q + c5) /
      ((((d0 * q + d1) * q + d2) * q + d3) * q + 1)
  }
  const e = normCdf(x) - p
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2)
  return x - u / (1 + (x * u) / 2)
}
