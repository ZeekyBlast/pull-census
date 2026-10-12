import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'
import type { Env } from './env.ts'

/** Per-IP request budgets (spec section 15). /delete shares /contribute's settings. */
export const LIMITS = {
  fetch: { capacity: 5, perMs: 3_600_000 },
  contribute: { capacity: 10, perMs: 3_600_000 },
  delete: { capacity: 10, perMs: 3_600_000 },
  share: { capacity: 20, perMs: 3_600_000 },
} as const

/**
 * Token bucket per key: `capacity` requests, refilled evenly over `perMs`.
 * ponytail: in-memory and per process; move to sqlite if the API ever runs more than one process.
 */
export function tokenBucket(capacity: number, perMs: number, now: () => number) {
  const buckets = new Map<string, { tokens: number; at: number }>()
  return (key: string): boolean => {
    const t = now()
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets)
        if (b.tokens + ((t - b.at) * capacity) / perMs >= capacity) buckets.delete(k)
    }
    const b = buckets.get(key) ?? { tokens: capacity, at: t }
    b.tokens = Math.min(capacity, b.tokens + ((t - b.at) * capacity) / perMs)
    b.at = t
    buckets.set(key, b)
    if (b.tokens < 1) return false
    b.tokens -= 1
    return true
  }
}

export function clientIp(c: Context, env: Env): string {
  if (env.trustProxy) {
    const first = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    if (first) return first
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown'
  } catch {
    return 'unknown'
  }
}
