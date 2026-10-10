import assert from 'node:assert/strict'
import { test } from 'node:test'
import { censusTests, splits } from '../../src/tests/census.ts'
import { census, rec } from '../fixtures/census.ts'
import { fixtureRules as rules } from '../fixtures/rules.ts'

test('the pre-registered splits, with patches only inside the data span', () => {
  const inside = census([
    rec({ start: '2025-03-01T12:00:00+08:00', end: '2025-04-30T12:00:00+08:00' }),
  ])
  assert.deepEqual(
    splits(inside, rules).map((s) => s.name),
    [
      'account-age',
      'pull-volume',
      'returning',
      'region-america',
      'region-europe',
      'region-asia',
      'region-tw-hk-mo',
      'patch-5.5',
    ],
  )
  assert.ok(!splits(census([rec()]), rules).some((s) => s.name.startsWith('patch')))
})

test('returning players are streaks after a 60-day gap', () => {
  const side = splits(census([rec()]), rules).find((s) => s.name === 'returning')!.side
  assert.equal(side(rec({ gapDaysBefore: 60 })), 'A')
  assert.equal(side(rec({ gapDaysBefore: 59.9 })), 'B')
  assert.equal(side(rec({ gapDaysBefore: null })), 'B')
})

test('singles vs 10-pulls splits exposure per pull', () => {
  // 10 streaks per account; each has 5 single pulls then 5 pulls inside a 10-pull, ending on a 10-pull 5★.
  const multi = [false, false, false, false, false, true, true, true, true, true]
  const streaks = Array.from({ length: 30_000 }, (_, i) =>
    rec({ accountId: `a${i % 3000}`, length: 10, multi }),
  )
  const r = censusTests(census(streaks), rules, 'character-event', 50).find(
    (t) => t.id === 'census:singles-vs-multi:base-rate:character-event',
  )!
  assert.equal(r.n, 150_000)
  assert.equal(r.observed, 0)
  assert.equal(r.expected, 30_000 / 150_000)
  assert.equal(r.status, 'pending')
})

test('every census test is seeing too poor on a tiny census', () => {
  const rs = censusTests(census([rec()]), rules, 'character-event', 50)
  assert.ok(rs.length >= 14)
  assert.ok(rs.every((r) => r.status === 'seeing-too-poor' && r.kind === 'census'))
})
