// methods/v1.md and the frozen code must say the same thing.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { minNOneSample, minNTwoSample } from '../src/stats/power.ts'
import * as d from '../src/tests/definitions.ts'

const doc = readFileSync(new URL('../../../methods/v1.md', import.meta.url), 'utf8')
const fmt = (n: number) => n.toLocaleString('en-US')

test('methods/v1.md states every frozen value', () => {
  const must = [
    d.METHOD_VERSION,
    `α = ${d.ALPHA}`,
    `${fmt(d.BOOTSTRAP_REPS)} resamples`,
    `seed ${d.METHOD_SEED}`,
    `${d.BOOTSTRAP_LEVEL * 100}%`,
    `${d.POWER * 100}%`,
    `±${d.BASE_RATE_MDE * 100}% relative`,
    `±${d.FIFTY_FIFTY_MDE * 100} points`,
    `first ${d.FLOOR_POSITIONS} pulls`,
    `Pulls 1–${d.BASE_RATE_LAST['character-event']}`,
    `1–${d.BASE_RATE_LAST['weapon-event']} for the weapon pool`,
    `${d.RETURNING_GAP_DAYS} or more days`,
    `${fmt(d.BETA_GATE.streaks)} complete verified`,
    `${d.RECENT_VOLUME_DAYS} days before the streak starts`,
    `last ${d.SENSITIVITY_TRIM_PULLS} pulls`,
    'Epitomized Path',
    'right after a won 50/50',
  ]
  for (const s of must) assert.ok(doc.includes(s), `methods/v1.md is missing "${s}"`)
})

test('the minimum n quoted in the methods matches the code', () => {
  for (const n of [
    minNOneSample(0.006, 0.0075, d.ALPHA, d.POWER, 2),
    minNOneSample(0.006, 0.0045, d.ALPHA, d.POWER, 1),
    minNOneSample(0.5, 0.45, d.ALPHA, d.POWER, 1),
    minNTwoSample(0.006, 0.0075, d.ALPHA, d.POWER),
    minNTwoSample(0.5, 0.55, d.ALPHA, d.POWER),
  ]) {
    assert.ok(doc.includes(fmt(n)), `methods/v1.md is missing ${fmt(n)}`)
  }
})
