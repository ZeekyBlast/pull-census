import type { Game } from '../types.ts'

/** The official gacha history API per game. Only these hosts are ever called (spec section 6). */
export type HistoryApi = {
  host: string
  path: string
  /** gacha_type values to page through. Genshin's 301 query also returns 400 rows. */
  queryTypes: string[]
  /** Global-server game_biz; the CN server (a different host) uses the UIGF path in v1. */
  gameBiz: string
}

export const HISTORY_API: Partial<Record<Game, HistoryApi>> = {
  genshin: {
    host: 'public-operation-hk4e-sg.hoyoverse.com',
    path: '/gacha_info/api/getGachaLog',
    queryTypes: ['100', '200', '301', '302', '500'],
    gameBiz: 'hk4e_global',
  },
}

/** Parameters copied from the player's URL. Everything else is set by the server. */
export const FORWARDED_PARAMS = [
  'authkey',
  'authkey_ver',
  'sign_type',
  'game_biz',
  'region',
] as const

export type HistoryUrlProblem = 'not-a-url' | 'no-authkey' | 'cn-server' | 'unsupported-game'

/**
 * Turn any URL the player has (the cached API call, or the in-game page) into the official API URL with only the
 * forwarded parameters. The browser sends this; the server checks the host exactly (`historyParams`).
 */
export function canonicalHistoryUrl(
  game: Game,
  raw: string,
): { url: string } | { problem: HistoryUrlProblem } {
  const api = HISTORY_API[game]
  if (!api) return { problem: 'unsupported-game' }
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return { problem: 'not-a-url' }
  }
  if (u.protocol !== 'https:') return { problem: 'not-a-url' }
  // In-game pages sometimes carry the query after the hash.
  const hashQuery = u.hash.includes('?')
    ? new URLSearchParams(u.hash.slice(u.hash.indexOf('?')))
    : null
  const get = (k: string) => u.searchParams.get(k) ?? hashQuery?.get(k) ?? null
  if (!get('authkey')) return { problem: 'no-authkey' }
  const biz = get('game_biz')
  if (biz && biz !== api.gameBiz) return { problem: 'cn-server' }
  const out = new URL(`https://${api.host}${api.path}`)
  for (const k of FORWARDED_PARAMS) {
    const val = get(k)
    if (val !== null) out.searchParams.set(k, val)
  }
  return { url: out.toString() }
}

/** Server side: the forwarded parameters of a canonical URL, or null if the host or path isn't the allowlisted one. */
export function historyParams(game: Game, raw: string): URLSearchParams | null {
  const api = HISTORY_API[game]
  if (!api) return null
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' || u.host !== api.host || u.pathname !== api.path) return null
  if (!u.searchParams.get('authkey')) return null
  const biz = u.searchParams.get('game_biz')
  if (biz && biz !== api.gameBiz) return null
  const out = new URLSearchParams()
  for (const k of FORWARDED_PARAMS) {
    const val = u.searchParams.get(k)
    if (val !== null) out.set(k, val)
  }
  return out
}
