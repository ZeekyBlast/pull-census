// Slow suite (npm run test:slow): false-positive rate of the whole release across many seeds.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runRelease } from '../../src/tests/run.ts'
import { fixtureRules as rules } from '../fixtures/rules.ts'
import { cleanCharacterPool, cleanStandardPool, simCensus, simConfig } from '../fixtures/sim.ts'

const SEEDS = 40

test(`clean censuses across ${SEEDS} seeds: at most one run flags anything`, {
  skip: !process.env.SLOW,
}, () => {
  let flaggedRuns = 0
  for (let seed = 100; seed < 100 + SEEDS; seed++) {
    const rel = runRelease(
      simCensus(simConfig([cleanCharacterPool, cleanStandardPool], 1500), seed),
      rules,
      { reps: 100 },
    )
    if (rel.results.some((r) => r.status === 'differs')) flaggedRuns++
  }
  // Holm keeps the family-wise error at α = 0.001 per run, so even one flagged run is unlikely.
  assert.ok(flaggedRuns <= 1, `${flaggedRuns} of ${SEEDS} clean runs flagged`)
})
