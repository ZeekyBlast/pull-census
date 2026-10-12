import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadEnv } from '../src/env.ts'

const secret = 'S'.repeat(43)
const base = {
  SITE_ORIGIN: 'https://pullcensus.test/',
  RECEIPT_KEYS: `k2:${secret},k1:${'T'.repeat(43)}`,
  UID_SALT: secret,
}

test('the environment parses into keys, newest first', () => {
  const env = loadEnv(base)
  assert.equal(env.siteOrigin, 'https://pullcensus.test')
  assert.deepEqual(
    env.receiptKeys.map((k) => [k.kid, k.key.length]),
    [
      ['k2', 32],
      ['k1', 32],
    ],
  )
  assert.equal(env.trustProxy, false)
  assert.equal(env.port, 8787)
})

test('a bad environment names the variable, never its value', () => {
  const weak = 'short-secret'
  assert.throws(
    () => loadEnv({ ...base, UID_SALT: weak }),
    (e: Error) => e.message === 'bad environment: UID_SALT' && !e.message.includes(weak),
  )
  assert.throws(() => loadEnv({ ...base, SITE_ORIGIN: undefined }), /SITE_ORIGIN/)
})
