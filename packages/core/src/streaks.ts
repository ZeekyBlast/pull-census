import { compareIds } from './ids.ts'
import { hasPhase, isFeatured, poolRules, regionForUid } from './rules/load.ts'
import type { Rules } from './rules/schema.ts'
import { RECENT_VOLUME_DAYS } from './tests/definitions.ts'
import type { CensusData, NoFourRun, Outcome, Pull, Streak } from './types.ts'

const DAY_MS = 86_400_000

export type Account = { accountId: string; uid: string; verified: boolean }

/** Days since the account's previous pull in any pool, keyed by sourceId. */
function gapsBefore(pulls: Pull[]): Map<string, number | null> {
  const byTime = [...pulls].sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
  const gaps = new Map<string, number | null>()
  byTime.forEach((p, i) => {
    const prev = byTime[i - 1]
    gaps.set(p.sourceId, prev ? (Date.parse(p.time) - Date.parse(prev.time)) / DAY_MS : null)
  })
  return gaps
}

/** Pulls (any pool) strictly before `ms` and within RECENT_VOLUME_DAYS of it. `sorted` is ascending epoch ms. */
function recentCount(sorted: number[], ms: number): number {
  const lowerBound = (x: number) => {
    let lo = 0
    let hi = sorted.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if ((sorted[mid] as number) < x) lo = mid + 1
      else hi = mid
    }
    return lo
  }
  return lowerBound(ms) - lowerBound(ms - RECENT_VOLUME_DAYS * DAY_MS)
}

/** Split one account's pulls (any order) into streaks, with guarantee state and 50/50 outcomes. */
export function deriveStreaks(input: Pull[], rules: Rules, account: Account): CensusData {
  const pulls = [...input].sort((a, b) => compareIds(a.sourceId, b.sourceId))
  const gaps = gapsBefore(pulls)
  const sortedMs = pulls.map((p) => Date.parse(p.time)).sort((a, b) => a - b)
  const streaks: Streak[] = []
  const noFour: NoFourRun[] = []
  const unknownItems: CensusData['unknownItems'] = []

  for (const pool of new Set(pulls.map((p) => p.pool))) {
    const pr = poolRules(rules, pool)
    const hasFeatured = pr.featuredRate !== null
    let guaranteed: boolean | null = null
    let losses: number | null = null
    let first = true
    let cur: Pull[] = []
    let run4 = 0
    let longest4 = 0

    const close = (censored: boolean, outcome: Outcome | null) => {
      const head = cur[0] as Pull
      const last = cur.at(-1) as Pull
      streaks.push({
        accountId: account.accountId,
        pool,
        bannerId: last.bannerId,
        length: cur.length,
        censored,
        leftTruncated: first,
        multi: cur.map((p) => p.multi),
        start: head.time,
        end: last.time,
        gapDaysBefore: gaps.get(head.sourceId) ?? null,
        guaranteed: hasFeatured && !censored ? guaranteed : null,
        outcome,
        lossesBefore: hasFeatured && !censored ? losses : null,
        verified: account.verified,
        recentPulls: recentCount(sortedMs, Date.parse(head.time)),
      })
    }

    for (const p of pulls) {
      if (p.pool !== pool) continue
      cur.push(p)
      run4 = p.rarity >= 4 ? 0 : run4 + 1
      longest4 = Math.max(longest4, run4)
      if (p.rarity !== 5) continue

      let outcome: Outcome | null = null
      if (hasFeatured) {
        const f = isFeatured(rules, pool, p.bannerId, p.time, p.itemId)
        outcome = f === true ? 'featured' : f === false ? 'standard' : 'unknown'
        // Outside the schedule's coverage is unknown too, but only a gap inside it means the rules need an update.
        if (outcome === 'unknown' && hasPhase(rules, pool, p.bannerId, p.time)) {
          unknownItems.push({ accountId: account.accountId, pool, itemId: p.itemId, time: p.time })
        }
      }
      close(false, outcome)

      if (outcome === 'featured') {
        if (guaranteed === false) losses = 0 // a won 50/50
        // After a featured 5★ the next is a 50/50, unless a chart course may have made it guaranteed.
        guaranteed = pr.chartPath ? null : false
      } else if (outcome === 'standard') {
        if (guaranteed === false) losses = losses === null ? null : losses + 1
        guaranteed = pr.guaranteeAfterLoss
      } else if (outcome === 'unknown') {
        guaranteed = null
        losses = null
      }
      first = false
      cur = []
    }
    if (cur.length > 0) close(true, null)
    noFour.push({ accountId: account.accountId, pool, longest: longest4 })
  }

  return {
    streaks,
    noFour,
    unknownItems,
    facts: [
      {
        accountId: account.accountId,
        region: regionForUid(rules, account.uid),
        uidCoarse: Math.floor(Number(account.uid) / 1e6),
        verified: account.verified,
      },
    ],
  }
}

export function mergeCensus(parts: CensusData[]): CensusData {
  return {
    streaks: parts.flatMap((p) => p.streaks),
    facts: parts.flatMap((p) => p.facts),
    noFour: parts.flatMap((p) => p.noFour),
    unknownItems: parts.flatMap((p) => p.unknownItems),
  }
}
