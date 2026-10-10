import assert from 'node:assert/strict'
import { test } from 'node:test'
import { onlyVerified, runRelease, runWithSensitivity, withoutLatest } from '../../src/tests/run.ts'
import { census, rec } from '../fixtures/census.ts'
import { fixtureRules as rules } from '../fixtures/rules.ts'

test('every result leaves runRelease settled, and deterministic tests skip Holm', () => {
  const rel = runRelease(census([rec({ length: 95 })]), rules, { reps: 50 })
  assert.ok(rel.results.every((r) => r.status !== 'pending'))
  const hp = rel.results.find((r) => r.id === 'hard-pity:character-event')!
  assert.equal(hp.status, 'differs')
  assert.equal(hp.pAdj, null)
  assert.ok(!rel.results.some((r) => r.pool === 'beginner'))
})

test('the beta gate counts complete verified character-event streaks', () => {
  const streaks = [
    rec(),
    rec({ leftTruncated: true }),
    rec({ censored: true }),
    rec({ verified: false, accountId: 'b' }),
    rec({ pool: 'standard' }),
  ]
  assert.deepEqual(runRelease(census(streaks), rules, { reps: 50 }).betaGate, {
    have: 1,
    need: 1500,
    met: false,
  })
})

test('onlyVerified drops self-reported accounts; withoutLatest drops the last streak per account and pool', () => {
  const data = census([
    rec({ end: '2026-09-02T00:00:00+08:00' }),
    rec({ end: '2026-09-03T00:00:00+08:00' }),
    rec({ accountId: 'b', verified: false }),
  ])
  assert.equal(onlyVerified(data).streaks.length, 2)
  assert.deepEqual(
    withoutLatest(data).streaks.map((s) => s.end),
    ['2026-09-02T00:00:00+08:00'],
  )
})

test('runWithSensitivity reports a status that moves when self-reported data is added', () => {
  const data = census([rec({ length: 80 }), rec({ accountId: 'b', verified: false, length: 120 })])
  const { main, disagreements } = runWithSensitivity(data, rules, { reps: 50 })
  assert.equal(main.results.find((r) => r.id === 'hard-pity:character-event')!.status, 'consistent')
  assert.deepEqual(
    disagreements.find((d) => d.id === 'hard-pity:character-event'),
    {
      variant: 'all-tiers',
      id: 'hard-pity:character-event',
      main: 'consistent',
      other: 'differs',
    },
  )
})
