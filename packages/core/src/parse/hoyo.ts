import * as v from 'valibot'
import { isoWithOffset } from '../ids.ts'
import { poolForGachaType, resolveBanner } from '../rules/load.ts'
import type { Rules } from '../rules/schema.ts'
import type { Pull } from '../types.ts'
import { finalizePulls } from './finalize.ts'

/** HoYo error codes the import must handle (spec section 6). */
export class HoyoApiError extends Error {
  readonly retcode: number
  constructor(retcode: number, message: string) {
    super(`HoYo API ${retcode}: ${message}`)
    this.retcode = retcode
  }
  get authkeyTimeout() {
    return this.retcode === -101
  }
  get tooFrequent() {
    return this.retcode === -110
  }
}

const Row = v.object({
  uid: v.pipe(v.string(), v.regex(/^\d+$/)),
  gacha_type: v.string(),
  item_id: v.string(),
  time: v.string(),
  name: v.string(),
  lang: v.string(),
  rank_type: v.picklist(['3', '4', '5']),
  id: v.pipe(v.string(), v.regex(/^\d{1,19}$/)),
})
export type HoyoRow = v.InferOutput<typeof Row>

const Page = v.object({
  retcode: v.number(),
  message: v.string(),
  data: v.nullable(
    v.object({
      list: v.array(Row),
      region_time_zone: v.optional(v.pipe(v.number(), v.integer())),
    }),
  ),
})

export type HoyoPage = { rows: HoyoRow[]; timeZone: number | null; lastId: string | null }

/** Validate one getGachaLog page. Throws HoyoApiError for a non-zero retcode. */
export function parseHoyoPage(json: unknown): HoyoPage {
  const page = v.parse(Page, json)
  if (page.retcode !== 0) throw new HoyoApiError(page.retcode, page.message)
  if (!page.data) throw new HoyoApiError(page.retcode, 'empty data')
  const rows = page.data.list
  return { rows, timeZone: page.data.region_time_zone ?? null, lastId: rows.at(-1)?.id ?? null }
}

/** Item name → item id, for the rows' language (the UIGF dictionary, api.uigf.org/dict). */
export type ItemDict = Record<string, string | number>

export type ImportResult = { uid: string; pulls: Pull[]; warnings: string[] }

/** Turn every row of an import into Pull[]. Genshin returns an empty item_id, so names go through the dictionary. */
export function rowsToPulls(
  rows: HoyoRow[],
  timeZone: number,
  rules: Rules,
  dict: ItemDict,
): ImportResult {
  const warnings: string[] = []
  const uids = new Set(rows.map((r) => r.uid))
  if (uids.size > 1) throw new Error('rows from more than one account')
  const raw: Omit<Pull, 'multi'>[] = []
  for (const r of rows) {
    const pool = poolForGachaType(rules, r.gacha_type)
    if (!pool) {
      warnings.push(`unknown gacha_type ${r.gacha_type}`)
      continue
    }
    let itemId = r.item_id !== '' ? r.item_id : dict[r.name]
    if (itemId === undefined) {
      // Keep the pull: dropping it would merge two streaks. Its outcome becomes 'unknown'.
      warnings.push(`unknown item name: ${r.name}`)
      itemId = `unknown:${r.name}`
    }
    const time = isoWithOffset(r.time, timeZone)
    raw.push({
      game: rules.game,
      pool,
      bannerId: resolveBanner(rules, pool, time, r.gacha_type, String(itemId)),
      itemId: String(itemId),
      rarity: Number(r.rank_type) as 3 | 4 | 5,
      time,
      sourceId: r.id,
    })
  }
  return { uid: [...uids][0] ?? '', pulls: finalizePulls(raw), warnings }
}
