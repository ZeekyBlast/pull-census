// Reader for the OneBST dataset (github.com/OneBST/GI_gacha_dataset, dataset 03: one CSV per account).
// The dataset has no licence: calibration only, never committed, never published (spec section 8.6).
import { isoWithOffset } from '../packages/core/src/ids.ts'
import { finalizePulls } from '../packages/core/src/parse/finalize.ts'
import type { Pull } from '../packages/core/src/types.ts'

/** Column names from the dataset's readme. If a file's header differs, change them here. */
export const COLUMNS = {
  name: 'name',
  gachaType: 'gacha_type',
  rank: 'rank_type',
  id: 'gacha_id',
  time: 'gacha_time',
}

/** OneBST gacha_type → pool. 301 and 400 share the character-event pity. */
const POOLS: Record<string, string> = {
  '100': 'beginner',
  '200': 'standard',
  '301': 'character-event',
  '400': 'character-event',
  '302': 'weapon-event',
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

/** One account's CSV text → Pull[] (CN server times, UTC+8). Item names stand in for item ids. */
export function parseOneBstCsv(text: string): Pull[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
  const header = splitCsvLine(lines[0] ?? '')
  const col = Object.fromEntries(
    Object.entries(COLUMNS).map(([k, name]) => [k, header.indexOf(name)]),
  ) as Record<keyof typeof COLUMNS, number>
  const missing = Object.entries(col)
    .filter(([, i]) => i < 0)
    .map(([k]) => COLUMNS[k as keyof typeof COLUMNS])
  if (missing.length)
    throw new Error(`missing columns ${missing.join(', ')}; header is: ${header.join(', ')}`)
  const raw: Omit<Pull, 'multi'>[] = []
  for (const line of lines.slice(1)) {
    const f = splitCsvLine(line)
    const pool = POOLS[f[col.gachaType] ?? '']
    const rank = Number(f[col.rank])
    if (!pool || (rank !== 3 && rank !== 4 && rank !== 5)) continue // the readme warns of a few bad rows
    raw.push({
      game: 'genshin',
      pool,
      bannerId: null,
      itemId: f[col.name] ?? '',
      rarity: rank,
      time: isoWithOffset(f[col.time] ?? '', 8),
      sourceId: f[col.id] ?? '',
    })
  }
  return finalizePulls(raw)
}
