// Checks the real registry, rules/genshin.json. Values come from sources; this test only checks shape and coverage.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { activePhases, isStandard5, loadRules } from '../../src/rules/load.ts'

const rules = loadRules(
  JSON.parse(readFileSync(new URL('../../../../rules/genshin.json', import.meta.url), 'utf8')),
)

/** Genshin's history API reaches back one year; the schedule must cover that and a margin. */
const COVERAGE_START = '2025-09-01'
const OFFSETS = ['+08:00', '+01:00', '-05:00']

test('pools and the gacha types that share their pity', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(rules.pools).map(([k, p]) => [k, p.gachaTypes])),
    {
      'character-event': ['301', '400'],
      'weapon-event': ['302'],
      standard: ['200'],
      beginner: ['100'],
      chronicled: ['500'],
    },
  )
  assert.equal(rules.pools.beginner!.inCensus, false)
  // Lightrace Wish may share the chronicled pity but its gacha_type is unsourced: keep chronicled out of the census.
  assert.equal(rules.pools.chronicled!.inCensus, false)
  // Epitomized Path: the state after a featured weapon can't be known from history.
  assert.equal(rules.pools['weapon-event']!.chartPath?.value, 1)
  assert.equal(rules.pools['character-event']!.chartPath, null)
})

test('exactly one phase per event banner at midday on every server, every day since coverage start', () => {
  const last = rules.schedule
    .filter((p) => p.gachaType === '301')
    .map((p) => ('utc' in p.end ? p.end.utc : p.end.serverLocal).slice(0, 10))
    .sort()
    .at(-1)!
  const problems: string[] = []
  for (
    let d = new Date(`${COVERAGE_START}T00:00:00Z`);
    d.toISOString().slice(0, 10) <= last;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const day = d.toISOString().slice(0, 10)
    for (const off of OFFSETS) {
      for (const [pool, type] of [
        ['character-event', '301'],
        ['character-event', '400'],
        ['weapon-event', '302'],
      ] as const) {
        const n = activePhases(rules, pool, `${day}T12:00:00${off}`, type).length
        if (n !== 1) problems.push(`${day}${off} ${type}: ${n} phases`)
      }
    }
  }
  assert.deepEqual(problems, [])
})

test('no featured 5★ of a character banner is in the standard pool during its own phase', () => {
  for (const p of rules.schedule.filter((p) => p.gachaType === '301' || p.gachaType === '400')) {
    const day =
      'utc' in p.start ? `${p.start.utc.slice(0, 19)}+00:00` : `${p.start.serverLocal}+08:00`
    for (const id of p.featured5) assert.equal(isStandard5(rules, id, day), false, `${p.id} ${id}`)
  }
})

test('every global server region is mapped', () => {
  for (const uid of ['600000001', '700000001', '800000001', '900000001']) {
    assert.ok(
      rules.regions.some(
        (r) => uid.startsWith(r.prefix) && (r.digits === null || r.digits === uid.length),
      ),
      uid,
    )
  }
})
