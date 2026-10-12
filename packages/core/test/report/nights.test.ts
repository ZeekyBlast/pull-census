import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cdfAt, modelDist, PUBLIC_MODEL } from '../../src/report/model.ts'
import { almanac, pityCheck } from '../../src/report/nights.ts'
import { mulberry32 } from '../../src/stats/prng.ts'
import { mkPulls, streakOf } from '../fixtures/pulls.ts'
import { boardPulls, SAMPLE_PITIES } from '../fixtures/report.ts'
import { fixtureRules as rules, STANDARD } from '../fixtures/rules.ts'

const report = () => pityCheck(boardPulls(), rules)[0]!

test('the board sample: letters by rarity, rarity classes, sizes and marks', () => {
  const r = report()
  assert.equal(r.pool, 'character-event')
  assert.deepEqual(
    r.complete.map((n) => n.pity),
    SAMPLE_PITIES,
  )
  assert.equal(r.complete.map((n) => n.letter).join(''), 'λγζηθαεβιδκ')
  assert.deepEqual(
    r.complete.map((n) => n.rarity),
    ['dim', 'medium', 'dim', 'dim', 'dim', 'bright', 'dim', 'bright', 'dim', 'medium', 'dim'],
  )
  assert.deepEqual(
    r.complete.map((n) => Math.round(n.size * 10) / 10),
    [16, 22, 17.7, 17.6, 16.9, 33.1, 18.8, 24.2, 16.7, 20.2, 16.4],
  )
  assert.deepEqual(
    r.complete.map((n) => n.marks.join(' ')),
    ['SP', 'SP', 'L', 'SP P', 'SP', 'SP', 'SP L', 'E P', 'SP', 'SP L', 'SP P'],
  )
})

test('the first night of an import is truncated: listed, but in no statistic', () => {
  const r = report()
  const first = r.nights[0]!
  assert.equal(first.truncated, true)
  assert.equal(first.pity, 30)
  assert.equal(first.tail, null)
  assert.equal(first.letter, null)
  assert.deepEqual(first.marks, [])
  assert.equal(r.complete.length, 11)
  assert.equal(r.nights.length, 12)
})

test('plates, open night, longest night, 50/50 record and lucky stars', () => {
  const r = report()
  assert.equal(r.nights[0]!.plate, 'GI·C·0001')
  assert.deepEqual(r.open, { pity: 37, plate: 'GI·C·0013' })
  assert.deepEqual(r.longest, { pity: 85, open: false, plate: 'GI·C·0007' })
  assert.deepEqual(r.record, { won: 5, lost: 3, promised: 3, unknown: 0 })
  assert.deepEqual(r.lucky, { firstLight: 0, early: 1, odds: { firstLight: 167, early: 17 } })
  assert.equal(r.afterLoss, null)
  assert.equal(Math.round(r.meanPity! * 10) / 10, 70.4)
  assert.equal(r.modelMedian, 76)
})

test('the percentile is the share of simulated accounts with 11 nights and a longer mean wait', () => {
  const r = report()
  assert.equal(r.percentile!.basis, 'simulated')
  // Independent check: 20,000 seeded simulated accounts of 11 nights each.
  const d = modelDist(PUBLIC_MODEL['character-event']!)
  const rand = mulberry32(7)
  let longer = 0
  for (let i = 0; i < 20_000; i++) {
    let sum = 0
    for (let j = 0; j < 11; j++) {
      const u = rand()
      sum += d.cdf.findIndex((v) => v >= u) + 1
    }
    if (sum > 774) longer++
  }
  assert.ok(Math.abs(r.percentile!.value - longer / 20_000) < 0.01)
  // Mean 70.4 against a model mean of 62.3: most simulated accounts waited less.
  assert.ok(r.percentile!.value < 0.2)
  assert.ok(pityCheck(boardPulls([40, 50, 45], [1, 1, 1], 0), rules)[0]!.percentile!.value > 0.8)
})

test('after a lost 50/50: the next star is promised, with median and 90th-percentile pulls from current pity', () => {
  const r = pityCheck(boardPulls([76, 62], [1, 0], 37), rules)[0]!
  const d = modelDist(PUBLIC_MODEL['character-event']!)
  const left = 1 - cdfAt(d, 37)
  const need = (q: number) => {
    let j = 1
    while ((cdfAt(d, 37 + j) - cdfAt(d, 37)) / left < q) j++
    return j
  }
  assert.deepEqual(r.afterLoss, { pity: 37, median: need(0.5), p90: need(0.9) })
  assert.ok(r.afterLoss!.median > 30 && r.afterLoss!.p90 <= 53)
})

test('the open night counts as the longest when it already passed every closed night', () => {
  const r = pityCheck(boardPulls([20], [1], 60), rules)[0]!
  assert.deepEqual(r.longest, { pity: 60, open: true, plate: 'GI·C·0003' })
})

test('a pool with no finished night yet has no statistics, and nothing is NaN', () => {
  const r = pityCheck(boardPulls([], [], 20), rules)[0]!
  assert.equal(r.complete.length, 0)
  assert.equal(r.meanPity, null)
  assert.equal(r.percentile, null)
  assert.deepEqual(r.longest, { pity: 20, open: true, plate: 'GI·C·0002' })
  assert.deepEqual(r.record, { won: 0, lost: 0, promised: 0, unknown: 0 })
  assert.deepEqual(r.lucky.firstLight + r.lucky.early, 0)
})

test('a pool without a featured 5★ has no 50/50 record', () => {
  const r = pityCheck(
    mkPulls('standard', [...streakOf(9, STANDARD[0]!), ...streakOf(49, STANDARD[1]!)]),
    rules,
  )[0]!
  assert.equal(r.pool, 'standard')
  assert.deepEqual(r.record, { won: 0, lost: 0, promised: 0, unknown: 0 })
  assert.equal(r.complete[0]!.coin, null)
  assert.equal(r.afterLoss, null)
})

test('the almanac matches the board: measured, catalogue and still clouded out', () => {
  const rows = almanac(report())
  const at = (k: number) => rows.find((x) => x.k === k)!
  assert.deepEqual(
    rows.map((x) => x.k),
    [30, 60, 74, 78, 80, 85, 90],
  )
  assert.equal(Math.round(at(74).measured * 100), 40)
  assert.equal(Math.round(at(74).catalogue * 100), 36)
  assert.equal(Math.round(at(80).measured * 100), 92)
  assert.equal(Math.round(at(80).clouded * 1000) / 10, 8.2)
})
