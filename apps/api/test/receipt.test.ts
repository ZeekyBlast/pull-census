import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rowsDigest, signReceipt, verifyReceipt } from '../src/receipt.ts'
import { history, testEnv } from './fixtures.ts'

const env = testEnv()
const rows = history(30)

test('the digest ignores row order and repeated rows, and refuses two different rows with one id', () => {
  assert.equal(rowsDigest([...rows].reverse()), rowsDigest(rows))
  assert.equal(rowsDigest([...rows, ...rows.slice(0, 5)]), rowsDigest(rows))
  assert.throws(() => rowsDigest([...rows, { ...rows[0]!, rank_type: '5' }]), /conflicting/)
})

test('a receipt verifies only for the same account, time zone and content', () => {
  const digest = rowsDigest(rows)
  const r = signReceipt(env, 'genshin', {
    uid: '812345678',
    timeZone: 8,
    digest,
    fetchedAt: '2026-10-12T00:00:00.000Z',
  })
  assert.equal(r.kid, 'k1')
  const ok = { uid: '812345678', timeZone: 8, digest }
  assert.equal(verifyReceipt(env, 'genshin', r, ok), true)
  // Editing one pull's rarity changes the digest.
  const edited = rowsDigest(rows.map((x, i) => (i === 3 ? { ...x, rank_type: '5' as const } : x)))
  assert.equal(verifyReceipt(env, 'genshin', r, { ...ok, digest: edited }), false)
  assert.equal(verifyReceipt(env, 'genshin', r, { ...ok, uid: '812345679' }), false)
  assert.equal(verifyReceipt(env, 'genshin', r, { ...ok, timeZone: -5 }), false)
  assert.equal(verifyReceipt(env, 'hsr', r, ok), false)
  assert.equal(verifyReceipt(env, 'genshin', { ...r, sig: `${r.sig.slice(0, -1)}A` }, ok), false)
  assert.equal(verifyReceipt(env, 'genshin', { ...r, kid: 'nope' }, ok), false)
})

test('receipts signed with an older key still verify after rotation', () => {
  const old = { ...env, receiptKeys: [env.receiptKeys[1]!] }
  const digest = rowsDigest(rows)
  const r = signReceipt(old, 'genshin', { uid: '812345678', timeZone: 8, digest, fetchedAt: 'x' })
  assert.equal(r.kid, 'k0')
  assert.equal(verifyReceipt(env, 'genshin', r, { uid: '812345678', timeZone: 8, digest }), true)
})
