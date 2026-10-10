// Spec section 17: the tests must catch every planted deviation and must not flag clean runs.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { softPityHazard } from '../../src/sim/simulate.ts'
import { runRelease } from '../../src/tests/run.ts'
import { fixtureRules as rules } from '../fixtures/rules.ts'
import { cleanCharacterPool, cleanStandardPool, simCensus, simConfig } from '../fixtures/sim.ts'

const REPS = 200
const differs = (pools: Parameters<typeof simConfig>[0], multiShare = 0.6, accounts = 4000) =>
  runRelease(simCensus(simConfig(pools, accounts, multiShare), 1), rules, { reps: REPS })
    .results.filter((r) => r.status === 'differs')
    .map((r) => r.id)

test('a clean census flags nothing', () => {
  assert.deepEqual(differs([cleanCharacterPool, cleanStandardPool]), [])
})

test('a 0.5% base rate is caught', () => {
  const ids = differs([{ ...cleanCharacterPool, hazard5: softPityHazard(0.005, 74, 0.06, 90) }])
  assert.ok(ids.includes('base-rate:character-event'), ids.join())
})

test('a hidden floor (no 5★ in the first 10 pulls) is caught', () => {
  const soft = softPityHazard(0.006, 74, 0.06, 90)
  const ids = differs([{ ...cleanCharacterPool, hazard5: (k) => (k <= 10 ? 0 : soft(k)) }])
  assert.ok(ids.includes('hidden-floor:character-event'), ids.join())
})

test('a 45% 50/50 is caught', () => {
  const ids = differs([{ ...cleanCharacterPool, featuredRate: 0.45 }])
  assert.ok(ids.includes('featured-rate:character-event'), ids.join())
})

test('a lower base rate inside 10-pulls is caught by the singles-vs-multi Census Test', () => {
  // Mostly singles here, so both groups clear the Census Test's minimum n.
  const ids = differs(
    [{ ...cleanCharacterPool, multiHazard5: softPityHazard(0.004, 74, 0.06, 90) }],
    0.1,
  )
  assert.ok(ids.includes('census:singles-vs-multi:base-rate:character-event'), ids.join())
})

test('a clean census with a patch inside its span flags nothing', () => {
  // Long histories put the fixture's 5.5 patch mid-span, where splitting on streak ends was biased.
  assert.deepEqual(differs([{ ...cleanCharacterPool, pulls: [800, 1200] }], 0.6, 2000), [])
})

test('goal-directed players (pull until they own 2–6 featured) do not make pull volume differ', () => {
  const goal = {
    ...cleanCharacterPool,
    pulls: [1, 3000] as [number, number],
    untilFeatured: [2, 6] as [number, number],
  }
  const ids = differs([goal])
  assert.ok(!ids.some((id) => id.startsWith('census:pull-volume')), ids.join())
})
