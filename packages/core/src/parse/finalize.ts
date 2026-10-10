import { compareIds } from '../ids.ts'
import type { Pull } from '../types.ts'

/** Drop repeated sourceIds (overlapping pages), sort oldest first, and mark 10-pulls. */
export function finalizePulls(pulls: Omit<Pull, 'multi'>[]): Pull[] {
  const unique = [...new Map(pulls.map((p) => [p.sourceId, p] as const)).values()]
  unique.sort((a, b) => compareIds(a.sourceId, b.sourceId))
  const groupSize = new Map<string, number>()
  for (const p of unique)
    groupSize.set(`${p.pool}|${p.time}`, (groupSize.get(`${p.pool}|${p.time}`) ?? 0) + 1)
  // ponytail: a 10-pull is 10 rows sharing one timestamp; singles can't share a second.
  return unique.map((p) => ({ ...p, multi: (groupSize.get(`${p.pool}|${p.time}`) ?? 0) >= 10 }))
}
