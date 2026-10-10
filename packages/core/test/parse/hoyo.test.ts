import assert from 'node:assert/strict'
import { test } from 'node:test'
import fc from 'fast-check'
import { compareIds } from '../../src/ids.ts'
import { HoyoApiError, parseHoyoPage, rowsToPulls } from '../../src/parse/hoyo.ts'
import { dict, page, row } from '../fixtures/hoyo.ts'
import { fixtureRules as rules } from '../fixtures/rules.ts'

test('parseHoyoPage returns rows, time zone and the last id for paging', () => {
  const rows = [row(), row()]
  const p = parseHoyoPage(page(rows))
  assert.equal(p.rows.length, 2)
  assert.equal(p.timeZone, 8)
  assert.equal(p.lastId, rows[1]!.id)
})

test('parseHoyoPage throws HoyoApiError on -101', () => {
  assert.throws(
    () => parseHoyoPage(page([], -101)),
    (e: unknown) => e instanceof HoyoApiError && e.authkeyTimeout && !e.tooFrequent,
  )
})

test('parseHoyoPage rejects a malformed row', () => {
  assert.throws(() => parseHoyoPage(page([{ ...row(), id: 'abc' }])))
})

test('rowsToPulls maps names, offsets, pools and banners', () => {
  const rows = [
    row({ name: 'Fixture Hero', rank_type: '5' }),
    row({ gacha_type: '400', name: 'Standard Hero', rank_type: '5' }),
  ]
  const { uid, pulls, warnings } = rowsToPulls(rows, 8, rules, dict)
  assert.equal(uid, '812345678')
  assert.deepEqual(warnings, [])
  assert.equal(pulls[0]!.itemId, '10000089')
  assert.equal(pulls[0]!.time, '2026-09-01T12:00:00+08:00')
  assert.equal(pulls[0]!.pool, 'character-event')
  assert.equal(pulls[0]!.bannerId, 'T1-301')
  assert.equal(pulls[1]!.bannerId, 'T1-400')
})

test('rowsToPulls keeps a non-empty item_id', () => {
  const { pulls } = rowsToPulls([row({ item_id: '11502', name: 'Not In Dict' })], 8, rules, dict)
  assert.equal(pulls[0]!.itemId, '11502')
})

test('rowsToPulls marks 10 rows sharing a timestamp as one 10-pull', () => {
  const ten = Array.from({ length: 10 }, () => row({ time: '2026-09-01 13:00:00' }))
  const single = row({ time: '2026-09-01 13:00:05' })
  const { pulls } = rowsToPulls([...ten, single], 8, rules, dict)
  assert.equal(pulls.filter((p) => p.multi).length, 10)
  assert.equal(pulls.at(-1)!.multi, false)
})

test('rowsToPulls warns on unknown names and gacha types instead of guessing', () => {
  const { pulls, warnings } = rowsToPulls(
    [row({ name: 'Nobody' }), row({ gacha_type: '999' })],
    8,
    rules,
    dict,
  )
  assert.equal(pulls.length, 0)
  assert.deepEqual(warnings, ['unknown item name: Nobody', 'unknown gacha_type 999'])
})

test('rowsToPulls refuses rows from two accounts', () => {
  assert.throws(
    () => rowsToPulls([row(), row({ uid: '812345679' })], 8, rules, dict),
    /more than one account/,
  )
})

test('rowsToPulls output is sorted, unique and never longer than the input', () => {
  fc.assert(
    fc.property(
      fc.array(fc.bigInt({ min: 1n, max: 9_999_999_999_999_999_999n }), { maxLength: 60 }),
      (ids) => {
        const rows = ids.map((id) => row({ id: id.toString() }))
        const { pulls } = rowsToPulls([...rows, ...rows.slice(0, 5)], 8, rules, dict)
        assert.equal(pulls.length, new Set(ids.map(String)).size)
        for (let i = 1; i < pulls.length; i++)
          assert.ok(compareIds(pulls[i - 1]!.sourceId, pulls[i]!.sourceId) < 0)
      },
    ),
  )
})
