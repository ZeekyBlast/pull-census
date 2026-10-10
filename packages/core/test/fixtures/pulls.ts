import { msToIso } from '../../src/ids.ts'
import type { Pull } from '../../src/types.ts'

let id = 1_700_000_000_000_000_000n

/** Build pulls: 3 and 4 are rarities, a string is a 5★ item id. One pull per minute unless `stepMs` says otherwise. */
export function mkPulls(
  pool: string,
  entries: (3 | 4 | string)[],
  opts: { bannerId?: string | null; startMs?: number; stepMs?: number; multi?: boolean } = {},
): Pull[] {
  const start = opts.startMs ?? Date.parse('2026-09-01T04:00:00Z')
  return entries.map((e, i) => ({
    game: 'genshin',
    pool,
    bannerId: opts.bannerId === undefined ? 'T1-301' : opts.bannerId,
    itemId: typeof e === 'string' ? e : e === 4 ? '14401' : '11301',
    rarity: typeof e === 'string' ? 5 : e,
    time: msToIso(start + i * (opts.stepMs ?? 60_000), 8),
    sourceId: String(id++),
    multi: opts.multi ?? false,
  }))
}

/** `n` 3★ pulls then a 5★ of `item`: a streak of length n + 1. */
export const streakOf = (n: number, item: string): (3 | string)[] => [...Array<3>(n).fill(3), item]
