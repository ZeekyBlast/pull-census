import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clusterBootstrap } from '../../src/stats/bootstrap.ts'
import { exposure, hazardCurve } from '../../src/stats/hazard.ts'
import { holm } from '../../src/stats/holm.ts'
import { minNOneSample, minNTwoSample } from '../../src/stats/power.ts'
import { mulberry32, seedFor } from '../../src/stats/prng.ts'
import type { Streak } from '../../src/types.ts'

const streak = (length: number, censored = false): Streak => ({
  accountId: 'a',
  pool: 'character-event',
  bannerId: null,
  length,
  censored,
  leftTruncated: false,
  multi: [],
  start: '',
  end: '',
  gapDaysBefore: null,
  guaranteed: null,
  outcome: null,
  lossesBefore: null,
  verified: true,
  recentPulls: 0,
})

test('mulberry32 is deterministic and in [0, 1)', () => {
  const a = mulberry32(42)
  const b = mulberry32(42)
  for (let i = 0; i < 1000; i++) {
    const x = a()
    assert.equal(x, b())
    assert.ok(x >= 0 && x < 1)
  }
  assert.notEqual(seedFor(1, 'base-rate:standard'), seedFor(1, 'base-rate:weapon-event'))
})

test('hazardCurve counts censored streaks as at risk but never as events', () => {
  const h = hazardCurve([streak(1), streak(2), streak(2, true), streak(3)], 3)
  assert.deepEqual(
    h.map((p) => [p.k, p.atRisk, p.events]),
    [
      [1, 4, 1],
      [2, 3, 1],
      [3, 1, 1],
    ],
  )
  assert.equal(h[1]!.h, 1 / 3)
})

test('exposure stops at the last position', () => {
  assert.deepEqual(exposure(streak(80), 73), { pulls: 73, events: 0 })
  assert.deepEqual(exposure(streak(10), 73), { pulls: 10, events: 1 })
  assert.deepEqual(exposure(streak(10, true), 73), { pulls: 10, events: 0 })
})

test('clusterBootstrap is reproducible and brackets the point estimate', () => {
  const rand = mulberry32(7)
  const rows = Array.from({ length: 400 }, () => [rand() < 0.3 ? 1 : 0, 1])
  const est = rows.reduce((a, r) => a + r[0]!, 0) / rows.length
  const opts = { reps: 2000, seed: 99, level: 0.95 }
  const ci = clusterBootstrap(rows, (s) => s[0]! / s[1]!, opts)
  assert.deepEqual(
    ci,
    clusterBootstrap(rows, (s) => s[0]! / s[1]!, opts),
  )
  assert.ok(ci[0] < est && est < ci[1])
  assert.ok(ci[1] - ci[0] < 0.12)
})

test('holm matches the textbook example', () => {
  const adj = holm([0.01, 0.04, 0.03, 0.005])
  const want = [0.03, 0.06, 0.06, 0.02]
  adj.forEach((p, i) => {
    assert.ok(Math.abs(p - want[i]!) < 1e-12)
  })
})

test('minimum n matches the scipy-computed values for the pre-registered effects', () => {
  // base rate 0.6% ±25% relative, two-sided; 50/50 ±5 points; α = 0.001, power 80%
  assert.equal(
    Math.max(
      minNOneSample(0.006, 0.0075, 0.001, 0.8, 2),
      minNOneSample(0.006, 0.0045, 0.001, 0.8, 2),
    ),
    47446,
  )
  assert.equal(minNOneSample(0.006, 0.0045, 0.001, 0.8, 1), 38673)
  assert.equal(minNOneSample(0.5, 0.45, 0.001, 0.8, 1), 1543)
  assert.equal(minNOneSample(0.5, 0.55, 0.001, 0.8, 2), 1704)
  assert.equal(minNTwoSample(0.006, 0.0075, 0.001, 0.8), 101755)
  assert.equal(minNTwoSample(0.5, 0.55, 0.001, 0.8), 3405)
})

test('hazardCurve has no hazard where no streak is at risk', () => {
  const h = hazardCurve([streak(1)], 3)
  assert.deepEqual(
    h.map((p) => p.h),
    [1, null, null],
  )
})
