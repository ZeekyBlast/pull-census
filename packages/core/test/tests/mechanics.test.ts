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

test('consolidated rate is 5★ per pull over closed streaks', () => {
  const m = mechanics(
    census([
      rec({ length: 60 }),
      rec({ length: 40 }),
      rec({ length: 30, censored: true, outcome: null }),
    ]),
    rules,
    'character-event',
  )
  assert.equal(m.consolidated.rate, 2 / 100)
  assert.equal(m.consolidated.disclosed, 0.016)
  assert.equal(m.softPity.length, 90)
})
