import { msToIso } from '../ids.ts'
import { mulberry32 } from '../stats/prng.ts'
import type { Game, Pull } from '../types.ts'

export type Hazard = (k: number) => number

/** Disclosed ("catalogue") 5★ hazard: flat base rate, certain at hard pity. */
export const disclosedHazard =
  (base: number, hardPity: number): Hazard =>
  (k) =>
    k >= hardPity ? 1 : base

/** Measured-style 5★ hazard: flat base rate, then a linear soft-pity ramp from `onset`. */
export const softPityHazard =
  (base: number, onset: number, step: number, hardPity: number): Hazard =>
  (k) =>
    k >= hardPity ? 1 : k < onset ? base : Math.min(1, base + step * (k - onset + 1))

/** 4★ hazard with a soft step at pull 9 and the guarantee at 10. */
export const fourStarHazard: Hazard = (k) => (k >= 10 ? 1 : k === 9 ? 0.56 : 0.051)

export type SimPool = {
  pool: string
  bannerId: string | null
  hazard5: Hazard
  /** Planted deviation: a different 5★ hazard for pulls made inside a 10-pull. */
  multiHazard5?: Hazard
  hazard4: Hazard
  featuredRate: number | null
  guaranteeAfterLoss: boolean
  featured5: string[]
  standard5: string[]
  /** Pulls per account in this pool: uniform in [min, max]. */
  pulls: [number, number]
  /** Goal-directed player: stop right after owning this many featured 5★ (drawn uniformly), capped by `pulls`. */
  untilFeatured?: [number, number]
}

export type SimConfig = {
  game: Game
  pools: SimPool[]
  accounts: number
  /** Share of sessions that are 10-pulls. */
  multiShare: number
  startMs: number
  /** UID prefixes to draw from (9-digit UIDs). */
  uidPrefixes: string[]
}

export type SimAccount = { uid: string; pulls: Pull[] }

/** Simulate whole-history imports. Same config and seed, same accounts. */
export function simulate(cfg: SimConfig, seed: number): SimAccount[] {
  const rand = mulberry32(seed)
  const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)] as T
  const out: SimAccount[] = []
  for (let a = 0; a < cfg.accounts; a++) {
    const uid = pick(cfg.uidPrefixes) + String(Math.floor(rand() * 1e8)).padStart(8, '0')
    let id = 1_700_000_000_000_000_000n + BigInt(a) * 10_000_000n
    let clock = cfg.startMs + Math.floor(rand() * 30) * 86_400_000
    const pulls: Pull[] = []
    for (const sp of cfg.pools) {
      const total = sp.pulls[0] + Math.floor(rand() * (sp.pulls[1] - sp.pulls[0] + 1))
      let k5 = 0
      let k4 = 0
      let guaranteed = false
      // Only goal-directed pools draw a target, so other configs keep their exact random sequence.
      const goal = sp.untilFeatured
        ? sp.untilFeatured[0] + Math.floor(rand() * (sp.untilFeatured[1] - sp.untilFeatured[0] + 1))
        : Number.POSITIVE_INFINITY
      let owned = 0
      let done = 0
      session: while (done < total) {
        const multi = rand() < cfg.multiShare && total - done >= 10
        const size = multi ? 10 : 1
        clock += 3_600_000 + Math.floor(rand() * 86_400_000)
        const time = msToIso(clock, 8)
        for (let i = 0; i < size; i++) {
          k5++
          k4++
          const h5 = multi && sp.multiHazard5 ? sp.multiHazard5(k5) : sp.hazard5(k5)
          let rarity: 3 | 4 | 5 = 3
          let itemId = '11301'
          if (rand() < h5) {
            rarity = 5
            if (sp.featuredRate === null) itemId = pick(sp.standard5)
            else if (guaranteed || rand() < sp.featuredRate) {
              itemId = pick(sp.featured5)
              guaranteed = false
              owned++
            } else {
              itemId = pick(sp.standard5)
              guaranteed = sp.guaranteeAfterLoss
            }
            k5 = 0
            k4 = 0
          } else if (rand() < sp.hazard4(k4)) {
            rarity = 4
            itemId = '14401'
            k4 = 0
          }
          pulls.push({
            game: cfg.game,
            pool: sp.pool,
            bannerId: sp.bannerId,
            itemId,
            rarity,
            time,
            sourceId: String(id++),
            multi,
          })
          if (owned >= goal) break session
        }
        done += size
      }
    }
    pulls.sort(
      (x, y) => x.sourceId.length - y.sourceId.length || (x.sourceId < y.sourceId ? -1 : 1),
    )
    out.push({ uid, pulls })
  }
  return out
}
