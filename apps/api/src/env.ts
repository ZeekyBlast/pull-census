import * as v from 'valibot'

/** base64url, at least 32 bytes. */
const Secret = v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]{43,}$/, 'must be base64url, 32+ bytes'))

const Raw = v.object({
  PORT: v.optional(v.pipe(v.string(), v.regex(/^\d+$/)), '8787'),
  DB_PATH: v.optional(v.string(), 'data/census.db'),
  CARD_DIR: v.optional(v.string(), 'data/cards'),
  SITE_ORIGIN: v.pipe(v.string(), v.url()),
  TRUST_PROXY: v.optional(v.picklist(['0', '1']), '0'),
  /** "kid:secret,kid:secret"; the first key signs, all keys verify (rotation). */
  RECEIPT_KEYS: v.pipe(
    v.string(),
    v.regex(/^[a-z0-9]+:[A-Za-z0-9_-]{43,}(,[a-z0-9]+:[A-Za-z0-9_-]{43,})*$/),
  ),
  UID_SALT: Secret,
})

export type Env = {
  port: number
  dbPath: string
  cardDir: string
  siteOrigin: string
  /** Behind Caddy: the client IP is the first X-Forwarded-For entry. */
  trustProxy: boolean
  receiptKeys: { kid: string; key: Buffer }[]
  uidSalt: Buffer
}

export function loadEnv(env: Record<string, string | undefined>): Env {
  const r = v.safeParse(Raw, env)
  if (!r.success) {
    // Name the variables only, never their values: they are secrets.
    const names = r.issues.map((i) => i.path?.map((p) => String(p.key)).join('.')).join(', ')
    throw new Error(`bad environment: ${names}`)
  }
  const e = r.output
  return {
    port: Number(e.PORT),
    dbPath: e.DB_PATH,
    cardDir: e.CARD_DIR,
    siteOrigin: new URL(e.SITE_ORIGIN).origin,
    trustProxy: e.TRUST_PROXY === '1',
    receiptKeys: e.RECEIPT_KEYS.split(',').map((pair) => {
      const [kid, key] = pair.split(':') as [string, string]
      return { kid, key: Buffer.from(key, 'base64url') }
    }),
    uidSalt: Buffer.from(e.UID_SALT, 'base64url'),
  }
}
