import assert from 'node:assert/strict'
import { test } from 'node:test'
import { tokenBucket } from '../src/limits.ts'
import { HostQueue } from '../src/queue.ts'

test('a token bucket allows its capacity, then refills evenly', () => {
  let t = 0
  const take = tokenBucket(3, 3_000, () => t)
  assert.deepEqual([take('a'), take('a'), take('a'), take('a')], [true, true, true, false])
  assert.equal(take('b'), true) // per key
  t = 1_000
  assert.deepEqual([take('a'), take('a')], [true, false])
})

test('the host queue runs one task at a time, at least the gap apart, and survives a failure', async () => {
  let t = 0
  const starts: number[] = []
  const q = new HostQueue(
    500,
    () => t,
    async (ms) => {
      t += ms
    },
  )
  const job = (fail: boolean) => async () => {
    starts.push(t)
    t += 100
    if (fail) throw new Error('upstream')
    return t
  }
  const results = await Promise.allSettled([
    q.run('h', job(false)),
    q.run('h', job(true)),
    q.run('h', job(false)),
  ])
  assert.deepEqual(
    results.map((r) => r.status),
    ['fulfilled', 'rejected', 'fulfilled'],
  )
  assert.deepEqual(starts, [0, 600, 1200])
})
