import * as v from 'valibot'
import { PUBLIC_MODEL } from '../report/model.ts'
import type { PoolReport } from '../report/nights.ts'
import { METHOD_VERSION } from '../tests/definitions.ts'

/**
 * Everything a shared card holds (spec section 12): no UID, no times, no ids. The server renders the PNG from
 * this alone, so it carries each night's 50/50 result too (filled or hollow star).
 */
export const CardSummary = v.pipe(
  // Strict: a card stores exactly these fields, so nothing else can ride along into a shared link.
  v.strictObject({
    v: v.literal(1),
    game: v.literal('genshin'),
    pool: v.picklist(['character-event', 'weapon-event', 'standard', 'chronicled']),
    /** Complete nights in order: pity, and the 50/50 (null when unknown or the pool has none). */
    nights: v.pipe(
      v.array(
        v.strictObject({
          p: v.pipe(v.number(), v.integer(), v.minValue(1)),
          c: v.nullable(v.picklist(['won', 'lost', 'promised'])),
        }),
      ),
      v.minLength(1),
      v.maxLength(500),
    ),
    /** Share of the reference that waited longer. */
    percentile: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
    basis: v.picklist(['simulated', 'census']),
    /** Plate serial of the first complete night. */
    firstPlate: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(9999)),
    method: v.pipe(v.string(), v.regex(/^methods-v\d+$/)),
  }),
  v.check(
    (s) => s.nights.every((n) => n.p <= (PUBLIC_MODEL[s.pool]?.hardPity ?? 0)),
    'pity above hard pity',
  ),
)
export type CardSummary = v.InferOutput<typeof CardSummary>

/** The card for a pool report, or null when it has no complete night yet. */
export function cardSummary(r: PoolReport): CardSummary | null {
  if (r.complete.length === 0 || !r.percentile) return null
  return {
    v: 1,
    game: 'genshin',
    pool: r.pool as CardSummary['pool'],
    nights: r.complete.map((n) => ({ p: n.pity, c: n.coin })),
    percentile: r.percentile.value,
    basis: r.percentile.basis,
    firstPlate: r.complete[0]!.n,
    method: METHOD_VERSION,
  }
}
