import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { compareIds, type Game, type HoyoRow } from '@pull-census/core'
import type { Env } from './env.ts'

/** Proof that the server fetched these rows from the official API (spec section 6). */
export type Receipt = {
  kid: string
  fetchedAt: string
  uid: string
  /** The server's UTC offset from the API: pull times are built from it, so it is signed too. */
  timeZone: number
  digest: string
  sig: string
}

const line = (r: HoyoRow) => [r.id, r.gacha_type, r.rank_type, r.time, r.item_id, r.name].join('|')

/**
 * sha256 over every row's content, sorted by id. It covers outcomes (item and rarity), not just ids, so a
 * contributor can't keep a valid receipt while editing what they pulled. Repeated identical rows count once;
 * two different rows with one id throw.
 */
export function rowsDigest(rows: HoyoRow[]): string {
  const byId = new Map<string, string>()
  for (const r of rows) {
    const l = line(r)
    const seen = byId.get(r.id)
    if (seen !== undefined && seen !== l) throw new Error('conflicting rows')
    byId.set(r.id, l)
  }
  const lines = [...byId.entries()].sort(([a], [b]) => compareIds(a, b)).map(([, l]) => l)
  return createHash('sha256').update(lines.join('\n')).digest('hex')
}

type Signed = Omit<Receipt, 'kid' | 'sig'>

const mac = (key: Buffer, game: Game, s: Signed) =>
  createHmac('sha256', key)
    .update(`${game}|${s.uid}|${s.timeZone}|${s.digest}|${s.fetchedAt}`)
    .digest('base64url')

export function signReceipt(env: Env, game: Game, s: Signed): Receipt {
  const { kid, key } = env.receiptKeys[0]!
  return { kid, ...s, sig: mac(key, game, s) }
}

/** True if `r` was signed by one of our keys for exactly this account, time zone and content. */
export function verifyReceipt(
  env: Env,
  game: Game,
  r: Receipt,
  s: Omit<Signed, 'fetchedAt'>,
): boolean {
  const k = env.receiptKeys.find((k) => k.kid === r.kid)
  if (!k || r.uid !== s.uid || r.timeZone !== s.timeZone || r.digest !== s.digest) return false
  const want = Buffer.from(mac(k.key, game, r))
  const got = Buffer.from(r.sig)
  return want.length === got.length && timingSafeEqual(want, got)
}
