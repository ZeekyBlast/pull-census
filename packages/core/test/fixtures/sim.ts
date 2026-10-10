import {
  disclosedHazard,
  fourStarHazard,
  type SimConfig,
  type SimPool,
  simulate,
  softPityHazard,
} from '../../src/sim/simulate.ts'
import { deriveStreaks, mergeCensus } from '../../src/streaks.ts'
import type { CensusData } from '../../src/types.ts'
import { FEATURED_SIM, fixtureRules, STANDARD } from './rules.ts'

/** The clean world: measured-style soft pity from 74, a fair 50/50. */
export const cleanCharacterPool: SimPool = {
  pool: 'character-event',
  bannerId: 'SIM-301',
  hazard5: softPityHazard(0.006, 74, 0.06, 90),
  hazard4: fourStarHazard,
  featuredRate: 0.5,
  guaranteeAfterLoss: true,
  featured5: [FEATURED_SIM],
  standard5: STANDARD,
  pulls: [200, 400],
}

export const cleanStandardPool: SimPool = {
  pool: 'standard',
  bannerId: null,
  hazard5: disclosedHazard(0.006, 90),
  hazard4: fourStarHazard,
  featuredRate: null,
  guaranteeAfterLoss: false,
  featured5: [],
  standard5: STANDARD,
  pulls: [50, 150],
}

export const simConfig = (pools: SimPool[], accounts = 4000, multiShare = 0.6): SimConfig => ({
  game: 'genshin',
  pools,
  accounts,
  multiShare,
  startMs: Date.parse('2025-02-01T00:00:00Z'),
  uidPrefixes: ['6', '7', '8', '9'],
})

/** Simulate, then derive the census exactly as the batch will. */
export function simCensus(cfg: SimConfig, seed: number): CensusData {
  return mergeCensus(
    simulate(cfg, seed).map((a, i) =>
      deriveStreaks(a.pulls, fixtureRules, { accountId: `sim-${i}`, uid: a.uid, verified: true }),
    ),
  )
}
