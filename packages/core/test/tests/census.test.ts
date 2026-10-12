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

test('patch groups follow the streak start, so a streak spanning the patch counts as before it', () => {
  const data = census([
    rec({ start: '2025-03-01T12:00:00+08:00', end: '2025-04-30T12:00:00+08:00' }),
  ])
  const side = splits(data, rules).find((s) => s.name === 'patch-5.5')!.side
  assert.equal(
    side(rec({ start: '2025-03-20T12:00:00+08:00', end: '2025-03-30T12:00:00+08:00' })),
    'A',
  )
  assert.equal(
    side(rec({ start: '2025-03-27T12:00:00+08:00', end: '2025-03-30T12:00:00+08:00' })),
    'B',
  )
})

test('pull-volume groups streaks by the pulls made in the 90 days before each one starts', () => {
  // Listed busiest first, so input order can't fake the answer.
  const streaks = Array.from({ length: 10 }, (_, i) =>
    rec({ accountId: `a${i}`, recentPulls: (9 - i) * 10 }),
  )
  const side = splits(census(streaks), rules).find((s) => s.name === 'pull-volume')!.side
  assert.deepEqual(streaks.map(side), ['A', 'A', null, null, null, null, null, null, 'B', 'B'])
})

test('census results do not depend on the order of streaks or accounts, ties included', () => {
  // uidCoarse is the same for every account and recentPulls repeats: quintile edges cut through ties.
  // Big enough that the account-age and pull-volume tests reach a result; one account in three always loses.
  const streaks = Array.from({ length: 30_000 }, (_, i) => {
    const length = 30 + (i % 7)
    return rec({
      accountId: `a${i % 3000}`,
      length,
      multi: Array.from({ length }, (_, k) => k >= 5),
      outcome: i % 3 === 0 ? 'standard' : 'featured',
      recentPulls: i % 13,
    })
  })
  const forward = censusTests(census(streaks), rules, 'character-event', 50)
  for (const name of ['account-age', 'pull-volume'])
    assert.equal(
      forward.find((r) => r.id === `census:${name}:base-rate:character-event`)!.status,
      'pending',
    )
  assert.deepEqual(
    censusTests(census([...streaks].reverse()), rules, 'character-event', 50),
    forward,
  )
})

test('the patch split compares instants, not ISO strings with different offsets', () => {
  // Patch 5.5 starts 2025-03-25T22:00Z. The +08:00 streak is before it; the -05:00 one is after.
  const data = census([
    rec({ start: '2025-03-26T05:00:00+08:00', end: '2025-03-26T05:30:00+08:00' }),
    rec({ start: '2025-03-26T00:00:00-05:00', end: '2025-03-26T01:00:00-05:00' }),
  ])
  assert.ok(splits(data, rules).some((s) => s.name === 'patch-5.5'))
})

test('a pool without a base-rate window throws instead of silently having no Census Tests', () => {
  assert.throws(() => censusTests(census([rec()]), rules, 'beginner', 50), /no base-rate window/)
})
