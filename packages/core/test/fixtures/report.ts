// The concept boards' shared sample (V5CNight, V6Clouded, V6Omen, V6SkyCard), as pulls.
import { mkPulls, streakOf } from './pulls.ts'
import { FEATURED_T1 as F, STANDARD } from './rules.ts'

export const SAMPLE_PITIES = [76, 81, 62, 78, 74, 85, 79, 7, 77, 80, 75]
/** 1 = featured (won or promised), 0 = lost the 50/50. */
export const SAMPLE_WON = [1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1]

/**
 * A history whose first night (30 pulls, featured) started before the import, then the board's 11 nights, then
 * an open night of `open` pulls. The truncated first night makes the sample's guarantee states known.
 */
export function boardPulls(pities = SAMPLE_PITIES, won = SAMPLE_WON, open = 37) {
  const entries = [
    ...streakOf(29, F),
    ...pities.flatMap((p, i) => streakOf(p - 1, won[i] ? F : (STANDARD[0] as string))),
    ...Array<3>(open).fill(3),
  ]
  return mkPulls('character-event', entries)
}
