import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aboutPhrase, pct, plate } from '../../src/report/format.ts'

test('one percent formatter: under 1%, over 99%, else whole percents', () => {
  assert.deepEqual([0.004, 0.01, 0.876, 0.99, 0.996].map(pct), [
    'under 1%',
    '1%',
    '88%',
    '99%',
    'over 99%',
  ])
})

test('the omen phrase speaks per 10,000 players until the census has 500 accounts', () => {
  assert.equal(
    aboutPhrase(0.1404, null),
    'About 1,400 in every 10,000 players are expected to be at least this unlucky.',
  )
  assert.equal(
    aboutPhrase(0.1404, 499),
    'About 1,400 in every 10,000 players are expected to be at least this unlucky.',
  )
  assert.equal(
    aboutPhrase(0.1404, 18_240),
    "About 2,560 of the census's 18,240 accounts are expected to be at least this unlucky.",
  )
  assert.equal(
    aboutPhrase(0.004, 600),
    "About 2 of the census's 600 accounts are expected to be at least this unlucky.",
  )
  assert.equal(
    aboutPhrase(0.00001, 600),
    "Fewer than 1 of the census's 600 accounts is expected to be at least this unlucky.",
  )
})

test('plates number the nights of each pool', () => {
  assert.equal(plate('genshin', 'character-event', 7), 'GI·C·0007')
  assert.equal(plate('genshin', 'weapon-event', 1234), 'GI·W·1234')
  assert.equal(plate('hsr', 'standard', 12), 'SR·S·0012')
})
