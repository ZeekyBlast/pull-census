import * as v from 'valibot'
import { wallClock } from '../ids.ts'
import { type Phase, type PoolRules, Rules, type TimePoint } from './schema.ts'

/** Validate a registry file. Throws a ValiError naming the bad path. */
export function loadRules(json: unknown): Rules {
  const rules = v.parse(Rules, json)
  const ids = new Set<string>()
  for (const p of rules.schedule) {
    if (ids.has(p.id)) throw new Error(`duplicate phase id: ${p.id}`)
    ids.add(p.id)
  }
  return rules
}

export function poolForGachaType(rules: Rules, gachaType: string): string | null {
  for (const [pool, r] of Object.entries(rules.pools))
    if (r.gachaTypes.includes(gachaType)) return pool
  return null
}

export function poolRules(rules: Rules, pool: string): PoolRules {
  const r = rules.pools[pool]
  if (!r) throw new Error(`unknown pool: ${pool}`)
  return r
}

/** Compare a pull time (ISO with server offset) with a registry time point: <0 before, 0 equal, >0 after. */
export function compareToPoint(time: string, point: TimePoint): number {
  if ('utc' in point) return Date.parse(time) - Date.parse(point.utc)
  const w = wallClock(time)
  return w < point.serverLocal ? -1 : w > point.serverLocal ? 1 : 0
}

export function isWithin(time: string, start: TimePoint, end: TimePoint): boolean {
  return compareToPoint(time, start) >= 0 && compareToPoint(time, end) <= 0
}

/** Phases of a pool running at a time. With a gacha_type, only that banner's phases. */
export function activePhases(
  rules: Rules,
  pool: string,
  time: string,
  gachaType?: string,
): Phase[] {
  const types = gachaType ? [gachaType] : poolRules(rules, pool).gachaTypes
  return rules.schedule.filter((p) => types.includes(p.gachaType) && isWithin(time, p.start, p.end))
}

/** The banner a pull came from. Without a unique match (e.g. UIGF without gacha_type), the featured 5★ decides. */
export function resolveBanner(
  rules: Rules,
  pool: string,
  time: string,
  gachaType: string | undefined,
  itemId: string,
): string | null {
  const phases = activePhases(rules, pool, time, gachaType)
  if (phases.length === 1) return phases[0]?.id ?? null
  const hit = phases.filter((p) => p.featured5.includes(itemId))
  return hit.length === 1 ? (hit[0]?.id ?? null) : null
}

export function isStandard5(rules: Rules, itemId: string, time: string): boolean {
  const day = wallClock(time).slice(0, 10)
  return rules.standard5.some(
    (s) => s.itemId === itemId && s.from <= day && (s.to === null || day <= s.to),
  )
}

/**
 * Was a 5★ the featured one? true / false, or null when the registry has no phase for that time
 * or the item is neither featured nor standard (the registry needs an update; never guess).
 */
export function isFeatured(
  rules: Rules,
  pool: string,
  bannerId: string | null,
  time: string,
  itemId: string,
): boolean | null {
  const phases = bannerId
    ? rules.schedule.filter((p) => p.id === bannerId)
    : activePhases(rules, pool, time)
  if (phases.length === 0) return null
  if (phases.some((p) => p.featured5.includes(itemId))) return true
  return isStandard5(rules, itemId, time) ? false : null
}

/** Region from the UID: longest matching prefix wins; a prefix may be tied to a UID length. */
export function regionForUid(rules: Rules, uid: string): string | null {
  const match = rules.regions
    .filter((r) => (r.digits === null || r.digits === uid.length) && uid.startsWith(r.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]
  return match?.region ?? null
}
