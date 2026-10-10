import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mechanics } from '../../src/tests/mechanics.ts'
import { census, rec } from '../fixtures/census.ts'
import { fixtureRules as rules } from '../fixtures/rules.ts'

test('50/50 after k losses buckets 3 or more together', () => {
  const m = mechanics(
    census([
      rec({ lossesBefore: 0, outcome: 'featured' }),
      rec({ lossesBefore: 1, outcome: 'standard' }),
      rec({ lossesBefore: 3, outcome: 'featured' }),
      rec({ lossesBefore: 7, outcome: 'featured' }),
      rec({ lossesBefore: null, outcome: 'featured' }),
      rec({ guaranteed: true, lossesBefore: 2, outcome: 'featured' }),
    ]),
    rules,
    'character-event',
  )
  assert.deepEqual(
    m.fiftyFiftyAfterLosses.map((b) => [b.k, b.n, b.wins]),
    [
      [0, 1, 1],
      [1, 1, 0],
      [2, 0, 0],
      [3, 2, 2],
    ],
  )
})

test('consolidated rate is 1 / expected streak length from the hazard curve', () => {
  const m = mechanics(
    census([
      rec({ length: 60 }),
      rec({ length: 40 }),
      rec({ length: 30, censored: true, outcome: null }),
    ]),
    rules,
    'character-event',
  )
  // Two streaks reach pull 40 and one ends there (h = 1/2); the last ends at 60 (h = 1). E[length] = 40 + 20 × 1/2.
  assert.ok(Math.abs(m.consolidated.rate! - 1 / 50) < 1e-12)
  assert.equal(m.consolidated.disclosed, 0.016)
  assert.equal(m.softPity.length, 90)
})

test('the consolidated rate comes from the hazard curve, so short streaks are not over-counted', async () => {
  const { softPityHazard } = await import('../../src/sim/simulate.ts')
  const { cleanCharacterPool, simCensus, simConfig } = await import('../fixtures/sim.ts')
  const h = softPityHazard(0.006, 74, 0.06, 90)
  let survive = 1
  let expectedLength = 0
  for (let k = 1; k <= 90; k++) {
    expectedLength += survive
    survive *= 1 - h(k)
  }
  const m = mechanics(
    simCensus(simConfig([{ ...cleanCharacterPool, pulls: [60, 120] }], 4000), 8),
    rules,
    'character-event',
  )
  assert.ok(
    Math.abs(m.consolidated.rate! - 1 / expectedLength) < 0.0003,
    `${m.consolidated.rate} vs ${1 / expectedLength}`,
  )
})
