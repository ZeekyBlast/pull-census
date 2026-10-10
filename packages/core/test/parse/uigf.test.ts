import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseUigf } from '../../src/parse/uigf.ts'
import { FEATURED_T1_B, fixtureRules as rules } from '../fixtures/rules.ts'

const item = (over: Record<string, string> = {}) => ({
  uigf_gacha_type: '301',
  gacha_type: '301',
  item_id: '11301',
  count: '1',
  time: '2026-09-01 12:00:00',
  rank_type: '3',
  id: '1727690400000000001',
  ...over,
})
const file = (list: unknown[], extra = {}) => ({
  info: {
    export_timestamp: 1_791_590_000,
    export_app: 'fixture',
    export_app_version: '1.0',
    version: 'v4.2',
  },
  hk4e: [{ uid: '612345678', timezone: -5, lang: 'en-us', list }],
  ...extra,
})

test('parseUigf builds pulls with the account offset', () => {
  const { accounts, warnings } = parseUigf(file([item()]), rules)
  assert.deepEqual(warnings, [])
  assert.equal(accounts[0]!.uid, '612345678')
  assert.equal(accounts[0]!.pulls[0]!.time, '2026-09-01T12:00:00-05:00')
  assert.equal(accounts[0]!.pulls[0]!.pool, 'character-event')
})

test('parseUigf resolves 400 through gacha_type, or through the featured item when gacha_type is missing', () => {
  const a = parseUigf(
    file([item({ gacha_type: '400', item_id: '10000003', rank_type: '5' })]),
    rules,
  )
  assert.equal(a.accounts[0]!.pulls[0]!.bannerId, 'T1-400')
  const noType = { ...item({ item_id: FEATURED_T1_B, rank_type: '5' }) } as Record<string, string>
  delete noType.gacha_type
  const b = parseUigf(file([noType]), rules)
  assert.equal(b.accounts[0]!.pulls[0]!.bannerId, 'T1-400')
})

test('parseUigf rejects v3 files and items without rank_type', () => {
  assert.throws(() => parseUigf({ ...file([item()]), info: { version: 'v3.0' } }, rules))
  const noRank = item() as Record<string, string>
  delete noRank.rank_type
  assert.throws(() => parseUigf(file([noRank]), rules))
})

test('parseUigf ignores other games with a warning', () => {
  const { warnings } = parseUigf(file([item()], { hkrpg: [] }), rules)
  assert.deepEqual(warnings, ['hkrpg section ignored'])
})
