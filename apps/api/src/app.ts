import { historyParams } from '@pull-census/core'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { stream } from 'hono/streaming'
import * as v from 'valibot'
import { type FetchDeps, fetchHistory } from './fetch.ts'
import { clientIp, LIMITS, tokenBucket } from './limits.ts'

export type Deps = FetchDeps

const FetchBody = v.object({
  game: v.picklist(['genshin', 'hsr', 'zzz']),
  url: v.pipe(v.string(), v.maxLength(4096)),
})

const tooBig = (c: { json: (b: unknown, s: 413) => Response }) => c.json({ error: 'too-big' }, 413)

export function createApp(deps: Deps): Hono {
  const app = new Hono()
  const buckets = Object.fromEntries(
    Object.entries(LIMITS).map(([k, l]) => [k, tokenBucket(l.capacity, l.perMs, deps.now)]),
  ) as Record<keyof typeof LIMITS, (key: string) => boolean>
  const limited = (name: keyof typeof LIMITS, c: Parameters<typeof clientIp>[0]) =>
    !buckets[name](clientIp(c, deps.env))

  // Referrer-Policy: no-referrer keeps history URLs out of any Referer header (spec section 6).
  app.use(
    '*',
    secureHeaders({ referrerPolicy: 'no-referrer', crossOriginResourcePolicy: 'cross-origin' }),
  )
  app.use(
    '*',
    cors({ origin: deps.env.siteOrigin, allowMethods: ['GET', 'POST', 'DELETE'], maxAge: 600 }),
  )
  // Never log request bodies or URLs: a history URL is a secret (spec section 15).
  app.onError((err, c) => {
    console.error(`api error on ${c.req.method} ${c.req.routePath}: ${err.name}`)
    return c.json({ error: 'server' }, 500)
  })

  app.post('/fetch', bodyLimit({ maxSize: 16 * 1024, onError: tooBig }), async (c) => {
    if (limited('fetch', c)) return c.json({ error: 'rate-limited' }, 429)
    const body = v.safeParse(FetchBody, await c.req.json().catch(() => null))
    if (!body.success) return c.json({ error: 'bad-request' }, 400)
    const params = historyParams(body.output.game, body.output.url)
    if (!params) return c.json({ error: 'bad-url' }, 400)
    c.header('Content-Type', 'application/x-ndjson')
    c.header('Cache-Control', 'no-store')
    return stream(c, async (s) => {
      for await (const line of fetchHistory(body.output.game, params, deps))
        await s.write(`${JSON.stringify(line)}\n`)
    })
  })

  return app
}
