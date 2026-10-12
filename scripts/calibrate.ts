// Calibration against OneBST (spec section 17): each pool's soft pity must start within one pull of the pull after
// its base-rate window, and its base rate must sit near the disclosed one.
// Usage: npm run calibrate -- <path to the extracted player_data folder>
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadRules, poolRules } from '../packages/core/src/rules/load.ts'
import { hazardCurve } from '../packages/core/src/stats/hazard.ts'
import { deriveStreaks } from '../packages/core/src/streaks.ts'
import { baseRateLast } from '../packages/core/src/tests/common.ts'
import type { Streak } from '../packages/core/src/types.ts'
import { parseOneBstCsv } from './onebst.ts'

const dir = process.argv[2]
if (!dir) {
  console.error('usage: npm run calibrate -- <player_data folder>')
  process.exit(2)
}
const rules = loadRules(
  JSON.parse(readFileSync(new URL('../rules/genshin.json', import.meta.url), 'utf8')),
)

/** Pools checked, with the base-rate band each must land in. */
const POOLS: Record<string, [number, number]> = {
  'character-event': [0.005, 0.007],
  'weapon-event': [0.006, 0.008],
}

const streaks = new Map<string, Streak[]>(Object.keys(POOLS).map((p) => [p, []]))
let accounts = 0
let pulls = 0
for (const file of readdirSync(dir).filter((f) => f.endsWith('.csv'))) {
  const ps = parseOneBstCsv(readFileSync(join(dir, file), 'utf8'))
  accounts++
  pulls += ps.length
  const data = deriveStreaks(ps, rules, { accountId: file, uid: '0', verified: true })
  for (const s of data.streaks) if (!s.leftTruncated) streaks.get(s.pool)?.push({ ...s, multi: [] })
}

const results = Object.entries(POOLS).map(([pool, [lo, hi]]) => {
  const last = baseRateLast(pool)
  const curve = hazardCurve(streaks.get(pool) ?? [], poolRules(rules, pool).hardPity5.value, 0.95)
  const window = curve.filter((p) => p.k <= last)
  const baseRate =
    window.reduce((a, p) => a + p.events, 0) / window.reduce((a, p) => a + p.atRisk, 0)
  const onset = curve.find((p) => p.k > 1 && p.lo > 2 * baseRate)?.k ?? null
  const ok = onset !== null && Math.abs(onset - (last + 1)) <= 1 && baseRate >= lo && baseRate <= hi
  return {
    pool,
    streaks: streaks.get(pool)?.length ?? 0,
    window: last,
    baseRate,
    onset,
    ok,
    curve: curve.filter((p) => p.k >= last - 3 && p.k <= last + 7),
  }
})

console.log(JSON.stringify({ accounts, pulls, results }, null, 2))
process.exit(results.every((r) => r.ok) ? 0 : 1)
