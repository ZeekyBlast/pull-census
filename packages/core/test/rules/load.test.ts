import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  activePhases,
  compareToPoint,
  isFeatured,
  loadRules,
  poolForGachaType,
  regionForUid,
  resolveBanner,
} from '../../src/rules/load.ts'
import { FEATURED_T1, FEATURED_T1_B, fixtureRules as rules } from '../fixtures/rules.ts'

test('gacha types 301 and 400 share the character-event pool', () => {
  assert.equal(poolForGachaType(rules, '301'), 'character-event')
  assert.equal(poolForGachaType(rules, '400'), 'character-event')
  assert.equal(poolForGachaType(rules, '999'), null)
})

test('a utc point compares as an instant, a serverLocal point as wall clock', () => {
  // 06:00 at UTC+8 is 22:00Z the day before: the same instant on every server.
  assert.equal(compareToPoint('2026-08-27T06:00:00+08:00', { utc: '2026-08-26T22:00:00Z' }), 0)
  assert.ok(compareToPoint('2026-08-26T16:59:59-05:00', { utc: '2026-08-26T22:00:00Z' }) < 0)
  // 18:00 server time is 18:00 on every server, whatever the offset.
  assert.equal(
    compareToPoint('2026-09-16T18:00:00-05:00', { serverLocal: '2026-09-16T18:00:00' }),
    0,
  )
  assert.equal(
    compareToPoint('2026-09-16T18:00:00+08:00', { serverLocal: '2026-09-16T18:00:00' }),
    0,
  )
})

test('phase ends are inclusive and the next phase starts on the next second', () => {
  assert.deepEqual(
    activePhases(rules, 'character-event', '2026-09-16T17:59:59+01:00', '301').map((p) => p.id),
    ['T1-301'],
  )
  assert.deepEqual(
    activePhases(rules, 'character-event', '2026-09-16T18:00:00+01:00', '301').map((p) => p.id),
    ['T2-301'],
  )
})

test('resolveBanner uses gacha_type, else the featured item', () => {
  const t = '2026-09-01T12:00:00+08:00'
  assert.equal(resolveBanner(rules, 'character-event', t, '400', '10000003'), 'T1-400')
  assert.equal(resolveBanner(rules, 'character-event', t, undefined, FEATURED_T1_B), 'T1-400')
  assert.equal(resolveBanner(rules, 'character-event', t, undefined, '10000003'), null)
})

test('isFeatured: featured, standard, and unknown items', () => {
  const t = '2026-09-01T12:00:00+08:00'
  assert.equal(isFeatured(rules, 'character-event', 'T1-301', t, FEATURED_T1), true)
  assert.equal(isFeatured(rules, 'character-event', 'T1-301', t, '10000003'), false)
  assert.equal(isFeatured(rules, 'character-event', 'T1-301', t, '19999999'), null)
  assert.equal(
    isFeatured(rules, 'character-event', null, '2024-01-01T12:00:00+08:00', FEATURED_T1),
    null,
  )
})

test('regionForUid: longest prefix wins and UID length matters', () => {
  assert.equal(regionForUid(rules, '812345678'), 'asia')
  assert.equal(regionForUid(rules, '1812345678'), 'asia')
  assert.equal(regionForUid(rules, '181234567'), null)
  assert.equal(regionForUid(rules, '612345678'), 'america')
})

test('loadRules rejects a missing archive url and duplicate phase ids', () => {
  const bad = structuredClone(rules) as unknown as { patches: { source: { archive: string } }[] }
  bad.patches[0]!.source.archive = 'https://example.org/not-wayback'
  assert.throws(() => loadRules(bad))
  const dup = structuredClone(rules)
  dup.schedule.push(structuredClone(dup.schedule[0]!))
  assert.throws(() => loadRules(dup), /duplicate phase id/)
})

test('isFeatured without a banner uses every phase sharing the pity (UIGF without gacha_type)', () => {
  const t = '2026-09-01T12:00:00+08:00'
  assert.equal(isFeatured(rules, 'character-event', null, t, FEATURED_T1_B), true)
  assert.equal(isFeatured(rules, 'character-event', null, t, '10000003'), false)
})
