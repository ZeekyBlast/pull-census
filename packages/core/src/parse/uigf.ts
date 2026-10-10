import * as v from 'valibot'
import { isoWithOffset } from '../ids.ts'
import { resolveBanner } from '../rules/load.ts'
import type { Rules } from '../rules/schema.ts'
import type { Pull } from '../types.ts'
import { finalizePulls } from './finalize.ts'

/** UIGF uigf_gacha_type → pool. 400 is merged into 301 by the standard. */
const UIGF_POOLS: Record<string, string> = {
  '100': 'beginner',
  '200': 'standard',
  '301': 'character-event',
  '302': 'weapon-event',
  '500': 'chronicled',
}

const Item = v.object({
  uigf_gacha_type: v.picklist(['100', '200', '301', '302', '500']),
  gacha_type: v.optional(v.picklist(['100', '200', '301', '302', '400', '500'])),
  item_id: v.pipe(v.string(), v.regex(/^\d+$/)),
  time: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)),
  // Optional in UIGF, required here: without it we can't tell a 5★ from a 3★.
  rank_type: v.picklist(['3', '4', '5']),
  id: v.pipe(v.string(), v.regex(/^\d{1,19}$/)),
})

const Uigf = v.object({
  info: v.object({ version: v.pipe(v.string(), v.regex(/^v4\.\d+$/)) }),
  hk4e: v.optional(
    v.array(
      v.object({
        uid: v.union([v.pipe(v.string(), v.regex(/^\d+$/)), v.pipe(v.number(), v.integer())]),
        timezone: v.pipe(v.number(), v.integer()),
        list: v.array(Item),
      }),
    ),
  ),
})

export type UigfResult = { accounts: { uid: string; pulls: Pull[] }[]; warnings: string[] }

/** Parse a UIGF v4.x file's Genshin section. Other games' sections are ignored with a warning. */
export function parseUigf(json: unknown, rules: Rules): UigfResult {
  const file = v.parse(Uigf, json)
  const warnings: string[] = []
  for (const key of ['hkrpg', 'nap'])
    if (json && typeof json === 'object' && key in json) warnings.push(`${key} section ignored`)
  const accounts = (file.hk4e ?? []).map((acc) => {
    const raw = acc.list.map((it) => {
      const pool = UIGF_POOLS[it.uigf_gacha_type] as string
      const time = isoWithOffset(it.time, acc.timezone)
      return {
        game: rules.game,
        pool,
        bannerId: resolveBanner(rules, pool, time, it.gacha_type, it.item_id),
        itemId: it.item_id,
        rarity: Number(it.rank_type) as 3 | 4 | 5,
        time,
        sourceId: it.id,
      }
    })
    return { uid: String(acc.uid), pulls: finalizePulls(raw) }
  })
  return { accounts, warnings }
}
