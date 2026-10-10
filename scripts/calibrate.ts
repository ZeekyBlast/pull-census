// Calibration against OneBST (spec section 17): must recover soft pity onset near pull 74 and a base rate near 0.6%.
// Usage: npm run calibrate -- <path to the extracted player_data folder>
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadRules } from '../packages/core/src/rules/load.ts'
import { hazardCurve } from '../packages/core/src/stats/hazard.ts'
import { deriveStreaks } from '../packages/core/src/streaks.ts'
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

const streaks: Streak[] = []
let accounts = 0
let pulls = 0
for (const file of readdirSync(dir).filter((f) => f.endsWith('.csv'))) {
  const ps = parseOneBstCsv(readFileSync(join(dir, file), 'utf8'))
  accounts++
  pulls += ps.length
  const data = deriveStreaks(ps, rules, { accountId: file, uid: '0', verified: true })
  for (const s of data.streaks)
    if (s.pool === 'character-event' && !s.leftTruncated) streaks.push({ ...s, multi: [] })
}

const curve = hazardCurve(streaks, 90, 0.95)
const window = curve.filter((p) => p.k <= 73)
const baseRate = window.reduce((a, p) => a + p.events, 0) / window.reduce((a, p) => a + p.atRisk, 0)
const onset = curve.find((p) => p.k > 1 && p.lo > 2 * baseRate)?.k ?? null
const ok = onset !== null && onset >= 73 && onset <= 75 && baseRate >= 0.005 && baseRate <= 0.007

console.log(
  JSON.stringify(
    {
      accounts,
      pulls,
      streaks: streaks.length,
      baseRate,
      onset,
      ok,
      curve: curve.filter((p) => p.k >= 70 && p.k <= 80),
    },
    null,
    2,
  ),
)
process.exit(ok ? 0 : 1)
