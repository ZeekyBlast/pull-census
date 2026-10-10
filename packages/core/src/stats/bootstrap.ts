import { mulberry32 } from './prng.ts'

/**
 * Percentile interval from a bootstrap that resamples whole clusters (accounts).
 * Each row holds one cluster's sufficient statistics; `stat` maps the summed rows to a number.
 */
export function clusterBootstrap(
  rows: number[][],
  stat: (sums: number[]) => number,
  opts: { reps: number; seed: number; level: number },
): [number, number] {
  const m = rows.length
  if (m === 0) return [Number.NaN, Number.NaN]
  const dim = rows[0]?.length ?? 0
  const rand = mulberry32(opts.seed)
  const values = new Float64Array(opts.reps)
  const sums = new Array<number>(dim)
  for (let r = 0; r < opts.reps; r++) {
    sums.fill(0)
    for (let i = 0; i < m; i++) {
      const row = rows[Math.floor(rand() * m)] as number[]
      for (let j = 0; j < dim; j++) sums[j]! += row[j]!
    }
    values[r] = stat(sums)
  }
  values.sort()
  const tail = (1 - opts.level) / 2
  const at = (q: number) =>
    values[Math.min(opts.reps - 1, Math.max(0, Math.floor(q * opts.reps)))] as number
  return [at(tail), at(1 - tail)]
}
