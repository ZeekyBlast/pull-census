// Frozen pre-registered settings (methods/v1.md). Changing any value here needs a new method version.

export const METHOD_VERSION = 'methods-v1'
export const ALPHA = 0.001
export const POWER = 0.8
export const METHOD_SEED = 20261009
export const BOOTSTRAP_REPS = 10_000
export const BOOTSTRAP_LEVEL = 0.999
/** Smallest effects the tests are sized to detect. */
export const BASE_RATE_MDE = 0.25 // relative
export const FIFTY_FIFTY_MDE = 0.05 // absolute
/** Hidden floor: 5★ count in the first N pulls of a streak. */
export const FLOOR_POSITIONS = 10
/** Last pull before soft pity, per pool: the base-rate window is pulls 1..last. */
export const BASE_RATE_LAST: Record<string, number> = {
  'character-event': 73,
  standard: 73,
  chronicled: 73,
  'weapon-event': 62,
}
export const RETURNING_GAP_DAYS = 60
/** Pull volume is measured over this many days before each streak starts, never over the whole history. */
export const RECENT_VOLUME_DAYS = 90
/** Selection-bias rerun: drop each account's last N pulls in each pool. */
export const SENSITIVITY_TRIM_PULLS = 90
export const REGIONS = ['america', 'europe', 'asia', 'tw-hk-mo'] as const
/** 50/50 after k losses in a row: k = 0, 1, 2, and 3 or more. */
export const FIFTY_FIFTY_MAX_K = 3
export const BETA_GATE = { game: 'genshin', pool: 'character-event', streaks: 1500 } as const

export type Status =
  | 'pending'
  | 'consistent'
  | 'differs'
  | 'no-difference'
  | 'seeing-too-poor'
  | 'rules-need-update'

export type TestResult = {
  /** e.g. 'base-rate:character-event' or 'census:returning:fifty-fifty:character-event'. */
  id: string
  kind: 'verdict' | 'census'
  pool: string
  method: string
  n: number
  needed: number
  observed: number | null
  expected: number | null
  /** observed − expected (verdicts) or group A − group B (census). */
  effect: number | null
  /** 99.9% cluster-bootstrap interval of `observed` (verdicts) or of `effect` (census). */
  interval: [number, number] | null
  p: number | null
  pAdj: number | null
  /** Deterministic tests: how many streaks or windows broke the rule. */
  flagged: number | null
  status: Status
}
