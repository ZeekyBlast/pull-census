import {
  type Game,
  HISTORY_API,
  HoyoApiError,
  type HoyoRow,
  parseHoyoPage,
} from '@pull-census/core'
import type { Env } from './env.ts'
import type { HostQueue } from './queue.ts'
import { type Receipt, rowsDigest, signReceipt } from './receipt.ts'

export const PAGE_SIZE = 20
export const MAX_PAGES_PER_POOL = 1000
export const PAGE_TIMEOUT_MS = 30_000
/** Waits after a "too frequent" (-110) answer before trying the page again. */
export const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000]

export type FetchError = 'authkey-expired' | 'busy' | 'upstream' | 'too-many-pages'

/** One NDJSON line of the /fetch response. The last line is always `end`. */
export type FetchLine =
  | { type: 'page'; gachaType: string; timeZone: number | null; rows: HoyoRow[] }
  | { type: 'end'; receipt: Receipt | null; error: FetchError | null }

export type FetchDeps = {
  env: Env
  queue: HostQueue
  upstream: typeof fetch
  now: () => number
  sleep: (ms: number) => Promise<void>
}

/** Page through every pool's history. Yields pages as they arrive, then the receipt (complete fetches only). */
export async function* fetchHistory(
  game: Game,
  params: URLSearchParams,
  deps: FetchDeps,
): AsyncGenerator<FetchLine> {
  const api = HISTORY_API[game]!
  const all: HoyoRow[] = []
  let timeZone: number | null = null
  const end = (error: FetchError): FetchLine => ({ type: 'end', receipt: null, error })

  for (const gachaType of api.queryTypes) {
    let endId = '0'
    for (let page = 1; ; page++) {
      if (page > MAX_PAGES_PER_POOL) {
        yield end('too-many-pages')
        return
      }
      const url = new URL(`https://${api.host}${api.path}`)
      for (const [k, v] of params) url.searchParams.set(k, v)
      // Set by the server, never by the player: English names match the vendored item dictionary.
      url.searchParams.set('lang', 'en-us')
      url.searchParams.set('auth_appid', 'webview_gacha')
      url.searchParams.set('gacha_type', gachaType)
      url.searchParams.set('page', String(page))
      url.searchParams.set('size', String(PAGE_SIZE))
      url.searchParams.set('end_id', endId)

      let result: Awaited<ReturnType<typeof getPage>>
      try {
        result = await getPage(url, api.host, deps)
      } catch {
        yield end('upstream')
        return
      }
      if (result === 'authkey-expired' || result === 'busy') {
        yield end(result)
        return
      }
      all.push(...result.rows)
      timeZone ??= result.timeZone
      yield { type: 'page', gachaType, timeZone: result.timeZone, rows: result.rows }
      if (result.rows.length < PAGE_SIZE || !result.lastId) break
      endId = result.lastId
    }
  }

  const uids = new Set(all.map((r) => r.uid))
  if (uids.size === 0) {
    yield { type: 'end', receipt: null, error: null } // no pulls: nothing to vouch for
    return
  }
  // Rows from two accounts or no time zone: the API never sends these, so don't vouch for them.
  if (uids.size > 1 || timeZone === null) {
    yield end('upstream')
    return
  }
  const receipt = signReceipt(deps.env, game, {
    uid: [...uids][0]!,
    timeZone,
    digest: rowsDigest(all),
    fetchedAt: new Date(deps.now()).toISOString(),
  })
  yield { type: 'end', receipt, error: null }
}

async function getPage(url: URL, host: string, deps: FetchDeps) {
  for (let attempt = 0; ; attempt++) {
    const json = await deps.queue.run(host, async () => {
      // No redirects: a redirect could point the server anywhere.
      const res = await deps.upstream(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
        headers: { accept: 'application/json' },
      })
      if (!res.ok) throw new Error(`upstream ${res.status}`)
      return (await res.json()) as unknown
    })
    try {
      return parseHoyoPage(json)
    } catch (e) {
      if (!(e instanceof HoyoApiError)) throw e
      // -101 is an expired authkey, -100 a broken one: either way the player reopens the history.
      if (e.authkeyTimeout || e.retcode === -100) return 'authkey-expired' as const
      if (!e.tooFrequent) throw e
      const wait = BACKOFF_MS[attempt]
      if (wait === undefined) return 'busy' as const
      await deps.sleep(wait)
    }
  }
}
