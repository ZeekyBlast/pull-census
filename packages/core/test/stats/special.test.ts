import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { binomCdf, binomTwoSidedP, clopperPearson } from '../../src/stats/binom.ts'
import { betainc, lgamma, normCdf, normQuantile } from '../../src/stats/special.ts'

const golden = JSON.parse(
  readFileSync(new URL('./golden.json', import.meta.url), 'utf8'),
) as Record<string, number[][]>

const close = (got: number, want: number, rel = 1e-9) =>
  assert.ok(Math.abs(got - want) <= rel * Math.max(1, Math.abs(want)), `got ${got}, want ${want}`)

test('lgamma matches scipy', () => {
  for (const [x, want] of golden.lgamma as [number, number][]) close(lgamma(x), want, 1e-12)
})

test('betainc matches scipy', () => {
  for (const [a, b, x, want] of golden.betainc as [number, number, number, number][])
    close(betainc(a, b, x), want)
})

test('binomCdf matches scipy', () => {
  for (const [k, n, p, want] of golden.binomCdf as [number, number, number, number][])
    close(binomCdf(k, n, p), want)
})

test('binomTwoSidedP matches scipy', () => {
  for (const [x, n, p, want] of golden.binomTwoSided as [number, number, number, number][])
    close(binomTwoSidedP(x, n, p), want)
})

test('clopperPearson matches scipy', () => {
  for (const [x, n, level, lo, hi] of golden.clopperPearson as [
    number,
    number,
    number,
    number,
    number,
  ][]) {
    const [gl, gh] = clopperPearson(x, n, level)
    close(gl, lo)
    close(gh, hi)
  }
})

test('normQuantile matches scipy and inverts normCdf', () => {
  for (const [p, want] of golden.normQuantile as [number, number][]) {
    close(normQuantile(p), want)
    close(normCdf(want), p)
  }
})
