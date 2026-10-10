import assert from 'node:assert/strict'
import { test } from 'node:test'
import fc from 'fast-check'
import { binomCdf, binomSf, clopperPearson } from '../../src/stats/binom.ts'

const case_ = fc
  .record({
    n: fc.integer({ min: 1, max: 5000 }),
    u: fc.double({ min: 0, max: 1, noNaN: true }),
    p: fc.double({ min: 0.001, max: 0.999, noNaN: true }),
  })
  .map(({ n, u, p }) => ({ n, x: Math.floor(u * n), p }))

test('P(X ≤ x) + P(X ≥ x + 1) = 1', () => {
  fc.assert(
    fc.property(case_, ({ n, x, p }) => {
      assert.ok(Math.abs(binomCdf(x, n, p) + binomSf(x + 1, n, p) - 1) < 1e-9)
    }),
  )
})

test('a Clopper–Pearson interval contains x / n and widens with the level', () => {
  fc.assert(
    fc.property(case_, ({ n, x }) => {
      const [lo95, hi95] = clopperPearson(x, n, 0.95)
      const [lo999, hi999] = clopperPearson(x, n, 0.999)
      assert.ok(lo95 <= x / n && x / n <= hi95)
      assert.ok(lo999 <= lo95 + 1e-12 && hi95 <= hi999 + 1e-12)
    }),
    { numRuns: 50 },
  )
})
