import assert from 'node:assert/strict'
import { test } from 'node:test'
import fc from 'fast-check'
import { compareIds, isoWithOffset, msToIso, wallClock } from '../src/ids.ts'

test('compareIds orders like BigInt', () => {
  fc.assert(
    fc.property(
      fc.bigInt({ min: 0n, max: 9_999_999_999_999_999_999n }),
      fc.bigInt({ min: 0n, max: 9_999_999_999_999_999_999n }),
      (a, b) => {
        const got = Math.sign(compareIds(a.toString(), b.toString()))
        const want = a < b ? -1 : a > b ? 1 : 0
        assert.equal(got, want)
      },
    ),
  )
})

test('isoWithOffset formats positive and negative offsets', () => {
  assert.equal(isoWithOffset('2026-09-30 18:05:12', 8), '2026-09-30T18:05:12+08:00')
  assert.equal(isoWithOffset('2026-09-30 18:05:12', -5), '2026-09-30T18:05:12-05:00')
  assert.equal(isoWithOffset('2026-09-30 18:05:12', 0), '2026-09-30T18:05:12+00:00')
})

test('isoWithOffset rejects bad input', () => {
  assert.throws(() => isoWithOffset('2026-09-30T18:05:12', 8), /bad time/)
  assert.throws(() => isoWithOffset('2026-09-30 18:05:12', 5.5), /bad UTC offset/)
})

test('msToIso round-trips through Date.parse', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1_600_000_000_000, max: 2_000_000_000_000 }),
      fc.integer({ min: -12, max: 14 }),
      (ms, tz) => {
        const s = Math.floor(ms / 1000) * 1000
        assert.equal(Date.parse(msToIso(s, tz)), s)
      },
    ),
  )
})

test('wallClock keeps the server-local part', () => {
  assert.equal(wallClock('2026-09-30T18:05:12+08:00'), '2026-09-30T18:05:12')
})
