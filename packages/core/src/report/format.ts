import type { Game } from '../types.ts'

/** One percent formatter for every sentence on the site. */
export function pct(v: number): string {
  if (v < 0.01) return 'under 1%'
  if (v > 0.99) return 'over 99%'
  return `${Math.round(v * 100)}%`
}

/**
 * The omen phrase (spec section 7): "about N of the census's M accounts", or "about N in every 10,000 players"
 * while the census has fewer than 500 accounts. Never a yes or no.
 */
export function aboutPhrase(p: number, censusAccounts: number | null): string {
  const early = censusAccounts === null || censusAccounts < 500
  const m = early ? 10_000 : censusAccounts
  const n = p * m
  const who = early
    ? 'in every 10,000 players'
    : `of the census's ${m.toLocaleString('en-US')} accounts`
  if (n < 1) return `Fewer than 1 ${who} is expected to be at least this unlucky.`
  const count = (n >= 100 ? Math.round(n / 10) * 10 : Math.round(n)).toLocaleString('en-US')
  return `About ${count} ${who} are expected to be at least this unlucky.`
}

const GAME_CODE: Record<Game, string> = { genshin: 'GI', hsr: 'SR', zzz: 'ZZ' }
const POOL_CODE: Record<string, string> = {
  'character-event': 'C',
  'weapon-event': 'W',
  standard: 'S',
  chronicled: 'R',
  beginner: 'B',
}

/** Plate number of the nth night in a pool, e.g. GI·C·0007 (spec section 13). */
export const plate = (game: Game, pool: string, n: number): string =>
  `${GAME_CODE[game]}·${POOL_CODE[pool] ?? 'X'}·${String(n).padStart(4, '0')}`
