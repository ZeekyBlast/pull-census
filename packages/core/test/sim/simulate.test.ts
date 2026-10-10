import assert from 'node:assert/strict'
import { test } from 'node:test'
import { simulate, softPityHazard } from '../../src/sim/simulate.ts'
import { cleanCharacterPool, simCensus, simConfig } from '../fixtures/sim.ts'

test('simulate is deterministic for a seed', () => {
  const cfg = simConfig([cleanCharacterPool], 20)
  assert.deepEqual(simulate(cfg, 1), simulate(cfg, 1))
  assert.notDeepEqual(simulate(cfg, 1), simulate(cfg, 2))
})

test('softPityHazard ramps from the onset and is certain at hard pity', () => {
  const h = softPityHazard(0.006, 74, 0.06, 90)
  assert.equal(h(73), 0.006)
  assert.ok(Math.abs(h(74) - 0.066) < 1e-12)
  assert.equal(h(90), 1)
})

test('simulated streaks never pass hard pity and 10-pulls share a timestamp', () => {
  const data = simCensus(simConfig([cleanCharacterPool], 200), 3)
  assert.ok(data.streaks.every((s) => s.length <= 90))
  assert.ok(data.noFour.every((r) => r.longest < 10))
  const acc = simulate(simConfig([cleanCharacterPool], 1), 3)[0]!
  const multi = acc.pulls.filter((p) => p.multi)
  assert.equal(multi.length % 10, 0)
})

test('the simulated base rate lands near 0.6%', () => {
  const data = simCensus(simConfig([cleanCharacterPool], 1000), 5)
  let pulls = 0
  let events = 0
  for (const s of data.streaks.filter((s) => !s.leftTruncated)) {
    pulls += Math.min(s.length, 73)
    if (!s.censored && s.length <= 73) events++
  }
  assert.ok(Math.abs(events / pulls - 0.006) < 0.001, `${events / pulls}`)
})
