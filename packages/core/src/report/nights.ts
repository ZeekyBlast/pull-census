// PityCheck for one pool (spec section 7, boards V5CNight and V6Clouded): nights, lucky stars and the after-a-loss block.
import { poolRules } from '../rules/load.ts'
import type { Rules } from '../rules/schema.ts'
import { deriveStreaks } from '../streaks.ts'
import type { Game, Outcome, Pull, Streak } from '../types.ts'
import { plate } from './format.ts'
import {
  band,
  catalogueDist,
  cdfAt,
  type Dist,
  mean,
  modelDist,
  type PityModel,
  PUBLIC_MODEL,
  quantile,
  sumExceeds,
} from './model.ts'

export const EARLY_MAX = 10
const GREEK = 'αβγδεζηθικλμνξοπρστυφχψω'

export type Mark = 'SP' | 'L' | 'P' | 'E'
export type Rarity = 'bright' | 'medium' | 'dim'
export type Coin = 'won' | 'lost' | 'promised'

/** One night: the pulls from one 5★ (exclusive) to the next (inclusive). */
export type Night = {
  n: number
  plate: string
  pity: number
  /** The first night of an import started before the history: its pity is only a lower bound, so no statistic uses it. */
  truncated: boolean
  /** null when the pool has no featured 5★. */
  outcome: Outcome | null
  /** The 50/50: won, lost, or promised (guaranteed after a loss). null when unknown or the pool has none. */
  coin: Coin | null
  bannerId: string | null
  end: string
  marks: Mark[]
  /** Two-sided tail: how rare a night this short or this long is. null for truncated nights. */
  tail: number | null
  /** Share of model nights that ended sooner / ran longer. */
  before: number | null
  after: number | null
  rarity: Rarity | null
  /** Star glyph size in px: bigger is rarer, early or late (law 4). */
  size: number
  /** Greek letter by rarity rank (α rarest); only the 24 rarest nights get one. */
  letter: string | null
}

export type PoolReport = {
  game: Game
  pool: string
  model: PityModel
  dist: Dist
  catalogue: Dist
  band: [number, number]
  nights: Night[]
  /** The unfinished night: pulls since the last 5★. */
  open: { pity: number; plate: string } | null
  /** Nights every statistic uses: closed and not truncated. */
  complete: Night[]
  meanPity: number | null
  /** Share of simulated accounts with as many complete nights whose mean wait was longer. */
  percentile: { value: number; basis: 'simulated' } | null
  longest: { pity: number; open: boolean; plate: string } | null
  record: { won: number; lost: number; promised: number; unknown: number }
  lucky: { firstLight: number; early: number; odds: { firstLight: number; early: number } }
  /** Shown when the latest 5★ lost the 50/50: no pull button, ever (spec section 14). */
  afterLoss: { pity: number; median: number; p90: number } | null
  modelMean: number
  modelMedian: number
}

const rarityOf = (r: number): Rarity => (r < 0.05 ? 'bright' : r < 0.2 ? 'medium' : 'dim')
export const starSize = (r: number) => 14 + Math.min(1, Math.max(0, -Math.log10(r) / 3)) * 22

/** Every pool's report for one account's pulls, in the order pools first appear. */
export function pityCheck(pulls: Pull[], rules: Rules): PoolReport[] {
  const data = deriveStreaks(pulls, rules, { accountId: 'me', uid: '0', verified: false })
  return Object.keys(PUBLIC_MODEL)
    .filter((pool) => data.streaks.some((s) => s.pool === pool))
    .map((pool) =>
      poolReport(
        rules,
        pool,
        data.streaks.filter((s) => s.pool === pool),
      ),
    )
}

export function poolReport(rules: Rules, pool: string, streaks: Streak[]): PoolReport {
  const model = PUBLIC_MODEL[pool]
  if (!model) throw new Error(`no model for pool ${pool}`)
  const pr = poolRules(rules, pool)
  const dist = modelDist(model)
  const [bandLo, bandHi] = band(model)
  const hasFeatured = pr.featuredRate !== null

  const nights: Night[] = streaks
    .filter((s) => !s.censored)
    .map((s, i) => {
      const truncated = s.leftTruncated
      const tail = truncated ? null : Math.min(cdfAt(dist, s.length), 1 - cdfAt(dist, s.length - 1))
      // A standard 5★ is always a lost 50/50; a featured one is won or promised only if the state before it is known.
      const coin: Coin | null = !hasFeatured
        ? null
        : s.outcome === 'standard'
          ? 'lost'
          : s.outcome !== 'featured'
            ? null
            : s.guaranteed === true
              ? 'promised'
              : s.guaranteed === false
                ? 'won'
                : null
      const marks: Mark[] = []
      if (!truncated && s.length <= EARLY_MAX) marks.push('E')
      if (!truncated && s.length >= bandLo && s.length <= bandHi) marks.push('SP')
      if (coin === 'lost') marks.push('L')
      if (coin === 'promised') marks.push('P')
      return {
        n: i + 1,
        plate: plate(rules.game, pool, i + 1),
        pity: s.length,
        truncated,
        outcome: hasFeatured ? s.outcome : null,
        coin,
        bannerId: s.bannerId,
        end: s.end,
        marks,
        tail,
        before: truncated ? null : cdfAt(dist, s.length - 1),
        after: truncated ? null : 1 - cdfAt(dist, s.length),
        rarity: tail === null ? null : rarityOf(tail),
        size: tail === null ? 14 : starSize(tail),
        letter: null,
      }
    })
  const complete = nights.filter((n) => !n.truncated)
  ;[...complete]
    .sort((a, b) => (a.tail as number) - (b.tail as number))
    .slice(0, GREEK.length)
    .forEach((night, i) => {
      night.letter = GREEK[i] as string
    })

  const openStreak = streaks.find((s) => s.censored)
  const open = openStreak
    ? { pity: openStreak.length, plate: plate(rules.game, pool, nights.length + 1) }
    : null

  const sum = complete.reduce((a, n) => a + n.pity, 0)
  const meanPity = complete.length ? sum / complete.length : null
  const percentile = complete.length
    ? { value: sumExceeds(dist, complete.length, sum), basis: 'simulated' as const }
    : null

  let longest: PoolReport['longest'] = null
  for (const n of complete)
    if (!longest || n.pity > longest.pity) longest = { pity: n.pity, open: false, plate: n.plate }
  if (open && (!longest || open.pity > longest.pity))
    longest = { pity: open.pity, open: true, plate: open.plate }

  const record = { won: 0, lost: 0, promised: 0, unknown: 0 }
  if (hasFeatured) for (const n of complete) record[n.coin ?? 'unknown']++

  const last = nights.at(-1)
  let afterLoss: PoolReport['afterLoss'] = null
  if (hasFeatured && pr.guaranteeAfterLoss && last?.outcome === 'standard') {
    const c = open?.pity ?? 0
    const left = 1 - cdfAt(dist, c)
    const remaining = (q: number) => {
      for (let j = 1; c + j <= dist.cdf.length; j++)
        if ((cdfAt(dist, c + j) - cdfAt(dist, c)) / left >= q - 1e-12) return j
      return dist.cdf.length - c
    }
    afterLoss = { pity: c, median: remaining(0.5), p90: remaining(0.9) }
  }

  return {
    game: rules.game,
    pool,
    model,
    dist,
    catalogue: catalogueDist(model),
    band: [bandLo, bandHi],
    nights,
    open,
    complete,
    meanPity,
    percentile,
    longest,
    record,
    lucky: {
      firstLight: complete.filter((n) => n.pity === 1).length,
      early: complete.filter((n) => n.pity <= EARLY_MAX).length,
      odds: {
        firstLight: Math.round(1 / cdfAt(dist, 1)),
        early: Math.round(1 / cdfAt(dist, EARLY_MAX)),
      },
    },
    afterLoss,
    modelMean: mean(dist),
    modelMedian: quantile(dist, 0.5),
  }
}

/** Chance a night has ended by each pull: measured, catalogue, and still clouded out (board V5CNight). */
export function almanac(r: PoolReport, ks?: number[]) {
  const list = ks ?? [30, 60, r.band[0], r.band[0] + 4, r.band[0] + 6, r.band[1], r.model.hardPity]
  return list.map((k) => ({
    k,
    measured: cdfAt(r.dist, k),
    catalogue: cdfAt(r.catalogue, k),
    clouded: 1 - cdfAt(r.dist, k),
  }))
}
