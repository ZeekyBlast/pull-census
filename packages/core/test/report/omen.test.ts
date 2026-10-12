import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pityCheck } from '../../src/report/nights.ts'
import { omenCheck } from '../../src/report/omen.ts'
import { binomCdf } from '../../src/stats/binom.ts'
import { boardPulls } from '../fixtures/report.ts'
import { fixtureRules as rules } from '../fixtures/rules.ts'

const report = pityCheck(boardPulls(), rules)[0]!

test('the board sample: 11 nights, 8 coin flips, 3 lost', () => {
  const o = omenCheck(report, rules)!
  assert.deepEqual([o.nights, o.flips, o.lost], [11, 8, 3])
  assert.equal(Math.round(o.meanPity * 10) / 10, 70.4)
  assert.equal(Math.round(o.modelMean * 10) / 10, 62.3)
  assert.equal(o.hits.length, 10_000)
  assert.equal(
    o.meanHits + o.lossHits,
    o.hits.reduce((a, h) => a + (h & 1) + ((h >> 1) & 1), 0),
  )
})

test('same seed, same numbers; and the shares match exact answers', () => {
  const a = omenCheck(report, rules)!
  const b = omenCheck(report, rules)!
  assert.deepEqual(a.hits, b.hits)
  // At least 3 losses in 8 fair flips: 1 - P(X <= 2).
  assert.ok(Math.abs(a.pLost - (1 - binomCdf(2, 8, 0.5))) < 0.015)
  // At least as long an average night: same tail as the percentile, ties included.
  assert.ok(Math.abs(a.pMean - report.percentile!.value) < 0.015)
})

test('no complete nights, no omen check', () => {
  assert.equal(omenCheck(pityCheck(boardPulls([], [], 20), rules)[0]!, rules), null)
})
