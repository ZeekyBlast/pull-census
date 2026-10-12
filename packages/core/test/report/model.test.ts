import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  band,
  catalogueDist,
  cdfAt,
  mean,
  modelDist,
  PUBLIC_MODEL,
  quantile,
  sumExceeds,
} from '../../src/report/model.ts'

const char = PUBLIC_MODEL['character-event']!
const d = modelDist(char)

test('the public character model matches the board sample and the disclosed consolidated rate', () => {
  assert.ok(Math.abs(cdfAt(d, 90) - 1) < 1e-12)
  assert.equal(Math.round(mean(d) * 10) / 10, 62.3)
  assert.equal(quantile(d, 0.5), 76)
  assert.equal(Math.round(1 / cdfAt(d, 1)), 167) // First Light odds
  assert.equal(Math.round(1 / cdfAt(d, 10)), 17) // early-star odds
  assert.ok(Math.abs(1 / mean(d) - 0.016) < 0.0005) // disclosed consolidated 1.6%
  assert.deepEqual(band(char), [74, 85])
})

test('the weapon model ends at 80 and its band at 73', () => {
  const w = PUBLIC_MODEL['weapon-event']!
  assert.ok(Math.abs(cdfAt(modelDist(w), 80) - 1) < 1e-12)
  assert.deepEqual(band(w), [63, 73])
})

test('the catalogue is flat until hard pity', () => {
  const c = catalogueDist(char)
  assert.ok(Math.abs((c.pmf[0] as number) - 0.006) < 1e-15)
  assert.ok(Math.abs(cdfAt(c, 74) - (1 - 0.994 ** 74)) < 1e-12)
  assert.ok(Math.abs(cdfAt(c, 90) - 1) < 1e-12)
})

test('sumExceeds is exact for one night and agrees with the normal approximation past 100 nights', () => {
  assert.ok(Math.abs(sumExceeds(d, 1, 76) - (1 - cdfAt(d, 76))) < 1e-12)
  assert.equal(sumExceeds(d, 3, 270), 0) // 3 nights can't pass 270 pulls
  assert.ok(Math.abs(sumExceeds(d, 3, 2) - 1) < 1e-12)
  const exact = sumExceeds(d, 100, 100 * 63)
  const approx = sumExceeds(d, 101, 101 * 63)
  assert.ok(Math.abs(exact - approx) < 0.03, `${exact} vs ${approx}`)
})
