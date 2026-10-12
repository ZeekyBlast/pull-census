import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cloudedOut, waitDist } from '../../src/report/clouded.ts'
import { cdfAt, modelDist, PUBLIC_MODEL } from '../../src/report/model.ts'
import { pityCheck } from '../../src/report/nights.ts'
import { mkPulls, streakOf } from '../fixtures/pulls.ts'
import { boardPulls } from '../fixtures/report.ts'
import { fixtureRules as rules, STANDARD } from '../fixtures/rules.ts'

const clouded = (...a: Parameters<typeof boardPulls>) =>
  cloudedOut(pityCheck(boardPulls(...a), rules)[0]!, rules)!

test('waits group a lost night with its promised star, as on the board', () => {
  const c = clouded()
  assert.deepEqual(
    c.waits.map((w) => [w.nights.map((n) => n.pity), w.total, w.open]),
    [
      [[76], 76, false],
      [[81], 81, false],
      [[62, 78], 140, false],
      [[74], 74, false],
      [[85], 85, false],
      [[79, 7], 86, false],
      [[77], 77, false],
      [[80, 75], 155, false],
      [[], 37, true],
    ],
  )
  assert.equal(c.longest!.total, 155)
  assert.deepEqual(c.quartiles, [75, 80, 135])
  assert.equal(c.basis, 'simulated')
})

test('longer-than shares: strictly shorter waits for a closed wait, at most as long for an open one', () => {
  const c = clouded()
  const w155 = c.waits[7]!
  assert.ok(Math.abs(w155.longerThan! - cdfAt(c.dist, 154)) < 1e-12)
  assert.equal(Math.round(w155.longerThan! * 100), 88) // board: "Longer than 88% of observers"
  const open = c.waits.at(-1)!
  assert.ok(Math.abs(open.longerThan! - cdfAt(c.dist, 37)) < 1e-12)
})

test('a wait still going after a lost 50/50 keeps the lost night', () => {
  const c = clouded([76, 62], [1, 0], 37)
  const open = c.waits.at(-1)!
  assert.deepEqual([open.nights.map((n) => n.pity), open.total, open.open], [[62], 99, true])
})

test('a wait that began before the history has no comparison', () => {
  // First (truncated) night lost: the promised star's wait started before the import.
  const pulls = mkPulls('character-event', [
    ...streakOf(29, STANDARD[0]!),
    ...streakOf(49, '10000089'),
    ...streakOf(59, '10000089'),
  ])
  const c = cloudedOut(pityCheck(pulls, rules)[0]!, rules)!
  assert.deepEqual(
    c.waits.map((w) => [w.total, w.status, w.longerThan === null]),
    [
      [50, 'unknown-start', true],
      [60, 'ok', false],
    ],
  )
})

test('an unknown 5★ pauses its wait and the next one', () => {
  const pulls = mkPulls('character-event', [
    ...streakOf(29, '10000089'),
    ...streakOf(49, '10009999'),
    ...streakOf(59, '10000089'),
  ])
  const c = cloudedOut(pityCheck(pulls, rules)[0]!, rules)!
  assert.deepEqual(
    c.waits.map((w) => w.status),
    ['rules-need-update', 'unknown-start'],
  )
})

test('the wait distribution has two humps and sums to one', () => {
  const d = waitDist(modelDist(PUBLIC_MODEL['character-event']!), 0.5)
  assert.ok(Math.abs(cdfAt(d, 180) - 1) < 1e-12)
  // Every won coin ends within one night (half the waits), plus two quick nights after a lost one.
  assert.ok(cdfAt(d, 90) > 0.5 && cdfAt(d, 90) < 0.65)
  // Humps near 76 and near 150, a trough between.
  assert.ok(d.pmf[75]! > 3 * d.pmf[114]! && d.pmf[149]! > 2 * d.pmf[114]!)
})

test('pools without a plain 50/50 have no Dry List', () => {
  const weapon = pityCheck(mkPulls('weapon-event', streakOf(59, '11513')), rules)[0]!
  assert.equal(cloudedOut(weapon, rules), null)
  const standard = pityCheck(mkPulls('standard', streakOf(59, STANDARD[0]!)), rules)[0]!
  assert.equal(cloudedOut(standard, rules), null)
})
