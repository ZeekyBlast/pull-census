import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findHistoryUrl } from '../../src/import/cache.ts'

const API = 'https://public-operation-hk4e-sg.hoyoverse.com/gacha_info/api/getGachaLog'
const enc = (s: string) => new TextEncoder().encode(s)
const join = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}
const noise = new Uint8Array([0, 1, 0xff, 0x80, 0, 0x22, 0x0a])

test('findHistoryUrl returns the last history URL with an authkey among binary noise', () => {
  const bytes = join(
    noise,
    enc(`1/0/${API}?authkey=OLD&size=5`),
    noise,
    enc('1/0/https://example.com/other?authkey=NOPE'),
    noise,
    enc(`1/0/${API}?authkey=NEW&size=5`),
    noise,
    enc(`1/0/${API}?lang=en`),
    noise,
  )
  assert.equal(findHistoryUrl(bytes, 'genshin'), `${API}?authkey=NEW&size=5`)
})

test('findHistoryUrl returns null when the history was never opened', () => {
  assert.equal(findHistoryUrl(join(noise, enc('https://example.com/')), 'genshin'), null)
})
