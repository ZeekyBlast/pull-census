import type { Game } from '../types.ts'
import { HISTORY_API } from './history.ts'

/**
 * Find the newest history URL in the game's web cache file (webCaches/<version>/Cache/Cache_Data/data_2).
 * The file is binary; URLs sit in it as plain ASCII. Runs in the browser: the file never leaves the device.
 */
export function findHistoryUrl(bytes: Uint8Array, game: Game): string | null {
  const api = HISTORY_API[game]
  if (!api) return null
  // latin1 maps every byte to one char, so binary noise can't break the decode.
  const text = new TextDecoder('latin1').decode(bytes)
  const re = /https:\/\/[\x21-\x7e]+/g
  let last: string | null = null
  for (const m of text.matchAll(re)) {
    const url = m[0]
    if (url.includes(api.path) && url.includes('authkey=')) last = url
  }
  return last
}
