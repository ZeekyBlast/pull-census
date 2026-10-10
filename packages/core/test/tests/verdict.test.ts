import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  baseRate,
  featuredRate,
  fourStarGuarantee,
  hardPity,
  hiddenFloor,
} from '../../src/tests/verdict.ts'
import { statusText } from '../../src/tests/wording.ts'
import { census, rec } from '../fixtures/census.ts'
import { fixtureRules as rules } from '../fixtures/rules.ts'

test('hard pity flags any streak longer than the disclosed maximum, open ones included', () => {
  const r = hardPity(
    census([rec({ length: 90 }), rec({ length: 91, censored: true, outcome: null })]),
    rules,
    'character-event',
  )
  assert.equal(r.flagged, 1)
  assert.equal(r.status, 'differs')
  assert.equal(statusText(r), 'Differs from the disclosed rate')
  assert.equal(
    hardPity(census([rec({ length: 90 })]), rules, 'character-event').status,
    'consistent',
  )
  assert.equal(hardPity(census([]), rules, 'character-event').status, 'seeing-too-poor')
})

test('the 4★ guarantee flags a run of 10 without a 4★ or better', () => {
  const data = census([rec()], {
    noFour: [{ accountId: 'a1', pool: 'character-event', longest: 10 }],
  })
  assert.equal(fourStarGuarantee(data, rules, 'character-event').status, 'differs')
  data.noFour[0]!.longest = 9
  assert.equal(fourStarGuarantee(data, rules, 'character-event').status, 'consistent')
})

test('too little data is "seeing too poor" with n and needed', () => {
  const r = baseRate(census([rec(), rec({ accountId: 'a2' })]), rules, 'character-event', 100)
  assert.equal(r.status, 'seeing-too-poor')
  assert.equal(r.n, 120)
  assert.equal(r.needed, 47446)
  assert.equal(statusText(r), 'Seeing too poor: 120 of 47,446 needed')
  assert.equal(hiddenFloor(census([rec()]), rules, 'character-event', 100).needed, 38673)
})

test('the base rate counts pulls only up to the soft-pity window', () => {
  const streaks = Array.from({ length: 800 }, (_, i) =>
    rec({ accountId: `a${i % 50}`, length: 80, outcome: 'featured' }),
  )
  const r = baseRate(census(streaks), rules, 'character-event', 100)
  assert.equal(r.n, 800 * 73)
  assert.equal(r.observed, 0)
  assert.equal(r.status, 'pending')
  assert.ok(r.p! < 1e-12)
})

test('the featured rate pauses when the rules miss a 5★, and has no test without a featured 5★', () => {
  const data = census([rec()], {
    unknownItems: [
      {
        accountId: 'a1',
        pool: 'character-event',
        itemId: '19999999',
        time: '2026-09-01T12:00:00+08:00',
      },
    ],
  })
  const r = featuredRate(data, rules, 'character-event', 100)!
  assert.equal(r.status, 'rules-need-update')
  assert.equal(statusText(r), 'Rules need update')
  assert.equal(featuredRate(census([rec()]), rules, 'standard', 100), null)
})

test('the featured rate counts only known 50/50s and is one-sided with a catch-up mechanic', () => {
  const flips = Array.from({ length: 2000 }, (_, i) =>
    rec({ accountId: `a${i % 100}`, outcome: i % 2 ? 'featured' : 'standard' }),
  )
  const noise = [rec({ guaranteed: true }), rec({ guaranteed: null }), rec({ outcome: 'unknown' })]
  const r = featuredRate(census([...flips, ...noise]), rules, 'character-event', 200)!
  assert.equal(r.n, 2000)
  assert.equal(r.observed, 0.5)
  assert.equal(r.needed, 1543)
  assert.ok(r.p! > 0.5)
  const lucky = flips.map((s, i) => ({
    ...s,
    outcome: i % 10 < 7 ? ('featured' as const) : ('standard' as const),
  }))
  assert.ok(featuredRate(census(lucky), rules, 'character-event', 200)!.p! > 0.99)
})
