import { clusterBootstrap } from '../stats/bootstrap.ts'
import { seedFor } from '../stats/prng.ts'
import type { CensusData, Streak } from '../types.ts'
import { BOOTSTRAP_LEVEL, METHOD_SEED, METHOD_VERSION, type TestResult } from './definitions.ts'

/** Streaks the census uses: known starting pity, in this pool. */
export const usable = (data: CensusData, pool: string): Streak[] =>
  data.streaks.filter((s) => s.pool === pool && !s.leftTruncated)

/** Sum per-account rows so the bootstrap resamples accounts, not pulls. */
export function byAccount<T>(
  items: T[],
  account: (t: T) => string,
  row: (t: T) => number[],
  dim: number,
): number[][] {
  const map = new Map<string, number[]>()
  for (const it of items) {
    const key = account(it)
    const acc = map.get(key) ?? new Array<number>(dim).fill(0)
    row(it).forEach((v, i) => {
      acc[i]! += v
    })
    map.set(key, acc)
  }
  return [...map.values()]
}

export const interval = (
  id: string,
  rows: number[][],
  stat: (s: number[]) => number,
  reps: number,
) => clusterBootstrap(rows, stat, { reps, seed: seedFor(METHOD_SEED, id), level: BOOTSTRAP_LEVEL })

export const base = (id: string, kind: TestResult['kind'], pool: string): TestResult => ({
  id,
  kind,
  pool,
  method: METHOD_VERSION,
  n: 0,
  needed: 0,
  observed: null,
  expected: null,
  effect: null,
  interval: null,
  p: null,
  pAdj: null,
  flagged: null,
  status: 'pending',
})

export const hasUnknown = (data: CensusData, pool: string) =>
  data.unknownItems.some((u) => u.pool === pool)
