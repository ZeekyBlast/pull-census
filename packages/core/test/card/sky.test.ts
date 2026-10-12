import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as v from 'valibot'
import { cardVariant, pityLines, skyCardSvg } from '../../src/card/sky.ts'
import { CardSummary, cardSummary } from '../../src/card/summary.ts'
import { pityCheck } from '../../src/report/nights.ts'
import { boardPulls, SAMPLE_PITIES, SAMPLE_WON } from '../fixtures/report.ts'
import { fixtureRules as rules } from '../fixtures/rules.ts'

const summaryOf = (pities = SAMPLE_PITIES, won = SAMPLE_WON) =>
  cardSummary(pityCheck(boardPulls(pities, won), rules)[0]!)!

test('the summary holds the complete nights, their 50/50s and nothing that identifies anyone', () => {
  const s = summaryOf()
  assert.deepEqual(Object.keys(s).sort(), [
    'basis',
    'firstPlate',
    'game',
    'method',
    'nights',
    'percentile',
    'pool',
    'v',
  ])
  assert.deepEqual(
    s.nights.map((n) => n.p),
    SAMPLE_PITIES,
  )
  assert.deepEqual(
    s.nights.map((n) => n.c),
    ['won', 'won', 'lost', 'promised', 'won', 'won', 'lost', 'promised', 'won', 'lost', 'promised'],
  )
  assert.equal(s.firstPlate, 2) // night 1 began before the history
  assert.ok(v.is(CardSummary, s))
})

test('no finished night, no card', () => {
  assert.equal(cardSummary(pityCheck(boardPulls([], [], 20), rules)[0]!), null)
})

test('the schema refuses extra fields, impossible pities and empty skies', () => {
  const s = summaryOf()
  assert.ok(!v.is(CardSummary, { ...s, uid: '812345678' }))
  assert.ok(!v.is(CardSummary, { ...s, nights: [{ p: 91, c: null }] }))
  assert.ok(!v.is(CardSummary, { ...s, nights: [{ p: 50, c: null, time: 'x' }] }))
  assert.ok(!v.is(CardSummary, { ...s, nights: [] }))
  assert.ok(v.is(CardSummary, { ...s, pool: 'weapon-event', nights: [{ p: 80, c: null }] }))
  assert.ok(!v.is(CardSummary, { ...s, pool: 'weapon-event', nights: [{ p: 81, c: null }] }))
})

test('the sky picks the card: First Light, else the latest early star, else standard', () => {
  assert.deepEqual(cardVariant(summaryOf()), { kind: 'early', night: 7 })
  const fl = summaryOf([1, 7, 80], [1, 1, 1])
  assert.deepEqual(cardVariant(fl), { kind: 'firstlight', night: 0 })
  assert.deepEqual(cardVariant(summaryOf([70, 80], [1, 1])), { kind: 'standard', night: null })
})

test('the card front carries the board text, says simulated, and is deterministic', () => {
  const s = summaryOf()
  const svg = skyCardSvg(s)
  for (const text of [
    '5★ PULLS, IN ORDER',
    'SKY CARD · GENSHIN IMPACT',
    'character banner · 11 nights',
    'An early star.',
    'pull 7 · about 1 in 17',
    'rare, not earned.',
    'of simulated skies waited longer.',
    '>8 of 11<',
    'Plates GI·C·0002–0012 · methods-v1',
    'SEEING · SIMULATED',
    'astronomy, not astrology.',
  ])
    assert.ok(svg.includes(text), text)
  assert.equal(skyCardSvg(s), svg)
  assert.ok(!svg.includes('of the census'))
  assert.ok(skyCardSvg({ ...s, basis: 'census' }).includes('of the census'))
})

test('the pity list wraps to two lines and keeps the latest nights', () => {
  const short = pityLines([76, 81, 62])
  assert.deepEqual(short, ['76 · 81 · 62', ''])
  const many = Array.from({ length: 60 }, (_, i) => 10 + i)
  const [a, b] = pityLines(many)
  assert.ok(a.startsWith('… ') && a.length <= 56 && b.length <= 56, `${a} | ${b}`)
  assert.ok(b.endsWith('69'))
})
