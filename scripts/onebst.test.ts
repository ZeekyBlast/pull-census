import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseOneBstCsv } from './onebst.ts'

const csv = [
  '\uFEFFname,gacha_type,item_type,rank_type,gacha_id,gacha_time',
  'Sword A,301,武器,3,1600000000000000002,2022-01-01 10:00:00',
  'Hero B,400,角色,5,1600000000000000003,2022-01-01 10:01:00',
  'Bad Row,999,角色,5,1600000000000000004,2022-01-01 10:02:00',
  '"Quoted, Name",200,武器,3,1600000000000000001,2022-01-01 09:00:00',
].join('\r\n')

test('parseOneBstCsv maps pools, merges 301 and 400, drops bad rows and sorts by id', () => {
  const pulls = parseOneBstCsv(csv)
  assert.deepEqual(
    pulls.map((p) => [p.pool, p.rarity, p.itemId]),
    [
      ['standard', 3, 'Quoted, Name'],
      ['character-event', 3, 'Sword A'],
      ['character-event', 5, 'Hero B'],
    ],
  )
  assert.equal(pulls[0]!.time, '2022-01-01T09:00:00+08:00')
})

test('parseOneBstCsv names the columns it could not find', () => {
  assert.throws(
    () => parseOneBstCsv('名称,卡池\nx,301'),
    /missing columns name, gacha_type, rank_type, gacha_id, gacha_time/,
  )
})
