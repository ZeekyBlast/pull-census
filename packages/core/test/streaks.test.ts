import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deriveStreaks, mergeCensus } from '../src/streaks.ts'
import { mkPulls, streakOf } from './fixtures/pulls.ts'
import { FEATURED_T1 as F, fixtureRules as rules, STANDARD } from './fixtures/rules.ts'

const S = STANDARD[0] as string
const acc = { accountId: 'a1', uid: '812345678', verified: true }

test('streak lengths, left truncation and the open streak', () => {
  const pulls = mkPulls('character-event', [...streakOf(9, F), ...streakOf(75, F), 3, 3, 3])
  const { streaks } = deriveStreaks(pulls, rules, acc)
  assert.deepEqual(
    streaks.map((s) => [s.length, s.censored, s.leftTruncated]),
    [
      [10, false, true],
      [76, false, false],
      [3, true, false],
    ],
  )
})

test('guarantee state and losses in a row follow the 50/50 history', () => {
  const seq = [F, S, F, F, S, F, S].flatMap((item) => streakOf(4, item))
  const { streaks } = deriveStreaks(mkPulls('character-event', seq), rules, acc)
  assert.deepEqual(
    streaks.map((s) => s.outcome),
    ['featured', 'standard', 'featured', 'featured', 'standard', 'featured', 'standard'],
  )
  assert.deepEqual(
    streaks.map((s) => s.guaranteed),
    [null, false, true, false, false, true, false],
  )
  assert.deepEqual(
    streaks.map((s) => s.lossesBefore),
    [null, null, null, null, 0, 1, 1],
  )
})

test('an item the rules do not know is unknown, reported, and resets the guarantee state', () => {
  const seq = [...streakOf(4, '19999999'), ...streakOf(4, F)]
  const data = deriveStreaks(mkPulls('character-event', seq), rules, acc)
  assert.equal(data.streaks[0]!.outcome, 'unknown')
  assert.equal(data.streaks[1]!.guaranteed, null)
  assert.deepEqual(
    data.unknownItems.map((u) => u.itemId),
    ['19999999'],
  )
})

test('two 5★ in one 10-pull end two streaks, the second of length 1', () => {
  const pulls = mkPulls('character-event', [3, 3, F, S, 3, 3, 3, 3, 3, 3], {
    multi: true,
    stepMs: 0,
  })
  const { streaks } = deriveStreaks(pulls, rules, acc)
  assert.deepEqual(
    streaks.map((s) => [s.length, s.outcome, s.censored]),
    [
      [3, 'featured', false],
      [1, 'standard', false],
      [6, null, true],
    ],
  )
})

test('pools without a featured 5★ have no outcome', () => {
  const { streaks } = deriveStreaks(
    mkPulls('standard', streakOf(4, S), { bannerId: null }),
    rules,
    acc,
  )
  assert.equal(streaks[0]!.outcome, null)
  assert.equal(streaks[0]!.guaranteed, null)
})

test('longest run without a 4★ or 5★ counts a 5★ as resetting it', () => {
  const { noFour } = deriveStreaks(
    mkPulls('character-event', [4, ...Array<3>(10).fill(3), F, 3, 3]),
    rules,
    acc,
  )
  assert.deepEqual(noFour, [{ accountId: 'a1', pool: 'character-event', longest: 10 }])
})

test('gapDaysBefore measures from the previous pull in any pool', () => {
  const day = 86_400_000
  const a = mkPulls('standard', [3, 3], {
    bannerId: null,
    startMs: Date.parse('2026-06-01T04:00:00Z'),
  })
  const b = mkPulls('character-event', [3], {
    startMs: Date.parse('2026-06-01T04:01:00Z') + 61 * day,
  })
  const { streaks } = deriveStreaks([...a, ...b], rules, acc)
  const ce = streaks.find((s) => s.pool === 'character-event')!
  assert.equal(ce.gapDaysBefore, 61)
  assert.equal(streaks.find((s) => s.pool === 'standard')!.gapDaysBefore, null)
})

test('account facts: region, coarse uid and pulls per 30 days', () => {
  const pulls = mkPulls('character-event', Array<3>(60).fill(3), { stepMs: 86_400_000 })
  const { facts } = deriveStreaks(pulls, rules, acc)
  assert.equal(facts[0]!.region, 'asia')
  assert.equal(facts[0]!.uidCoarse, 812)
  assert.ok(Math.abs(facts[0]!.pullsPer30d - 60 / (59 / 30)) < 1e-9)
})

test('mergeCensus concatenates accounts', () => {
  const one = deriveStreaks(mkPulls('character-event', streakOf(3, F)), rules, acc)
  const two = deriveStreaks(mkPulls('character-event', streakOf(3, F)), rules, {
    ...acc,
    accountId: 'a2',
  })
  assert.equal(mergeCensus([one, two]).streaks.length, 2)
  assert.equal(mergeCensus([one, two]).facts.length, 2)
})
