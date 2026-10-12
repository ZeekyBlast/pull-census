// Test harness: an app with a fake clock and a scripted HoYo API. No authkeys, no real UIDs.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { HoyoRow } from '@pull-census/core'
import { createApp } from '../src/app.ts'
import { loadEnv } from '../src/env.ts'
import { HostQueue } from '../src/queue.ts'

export const API = 'https://public-operation-hk4e-sg.hoyoverse.com/gacha_info/api/getGachaLog'
export const HISTORY_URL = `${API}?authkey=FAKEKEY&authkey_ver=1&sign_type=2&game_biz=hk4e_global&region=os_asia`

export const testEnv = () =>
  loadEnv({
    SITE_ORIGIN: 'https://pullcensus.test',
    TRUST_PROXY: '1',
    DB_PATH: ':memory:',
    CARD_DIR: mkdtempSync(join(tmpdir(), 'pc-cards-')),
    RECEIPT_KEYS: `k1:${'a'.repeat(43)},k0:${'b'.repeat(43)}`,
    UID_SALT: 'c'.repeat(43),
  })

/** A scripted getGachaLog: rows per gacha_type, newest first, paged by end_id like the real API. */
export function fakeHoyo(
  rowsByType: Record<string, HoyoRow[]>,
  script: (url: URL, call: number) => { retcode: number; message: string } | null = () => null,
) {
  const calls: URL[] = []
  const options: RequestInit[] = []
  const upstream = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input))
    calls.push(url)
    options.push(init ?? {})
    const err = script(url, calls.length)
    if (err) return Response.json({ ...err, data: null })
    const type = url.searchParams.get('gacha_type') ?? ''
    const endId = url.searchParams.get('end_id') ?? '0'
    const size = Number(url.searchParams.get('size'))
    const rows = [...(rowsByType[type] ?? [])]
      .sort((a, b) => (BigInt(b.id) > BigInt(a.id) ? 1 : -1))
      .filter((r) => endId === '0' || BigInt(r.id) < BigInt(endId))
      .slice(0, size)
    return Response.json({
      retcode: 0,
      message: 'OK',
      data: { page: '1', size: String(size), list: rows, region: 'os_asia', region_time_zone: 8 },
    })
  }) as typeof fetch
  return { upstream, calls, options }
}

export function harness(upstream: typeof fetch = fakeHoyo({}).upstream) {
  const env = testEnv()
  let t = Date.parse('2026-10-12T00:00:00Z')
  const sleeps: number[] = []
  const clock = {
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms)
      t += ms
    },
  }
  const app = createApp({
    env,
    queue: new HostQueue(500, clock.now, clock.sleep),
    upstream,
    now: clock.now,
    sleep: clock.sleep,
  })
  const post = (path: string, body: unknown, ip = '203.0.113.7') =>
    app.request(path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    })
  return { app, env, clock, sleeps, post }
}

export const ndjson = async (res: Response) =>
  (await res.text())
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l))

let nextId = 1_727_690_400_000_000_000n
/** `n` rows of one pool, one minute apart from 2026-09-01 12:00 (UTC+8); every 50th is the featured 5★. */
export function history(n: number, gachaType = '301', uid = '812345678'): HoyoRow[] {
  const start = Date.parse('2026-09-01T04:00:00Z')
  return Array.from({ length: n }, (_, i) => {
    const five = (i + 1) % 50 === 0
    return {
      uid,
      gacha_type: gachaType,
      item_id: '',
      time: new Date(start + i * 60_000 + 8 * 3_600_000)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' '),
      name: five ? 'Fixture Hero' : 'Fixture Sword',
      lang: 'en-us',
      rank_type: five ? '5' : '3',
      id: String(nextId++),
    }
  })
}
