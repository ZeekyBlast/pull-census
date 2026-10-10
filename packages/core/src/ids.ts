/** Compare two numeric id strings (up to 19 digits) without losing precision. */
export function compareIds(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length
  return a < b ? -1 : a > b ? 1 : 0
}

/** "2026-09-30 18:05:12" at UTC+8 → "2026-09-30T18:05:12+08:00". */
export function isoWithOffset(local: string, offsetHours: number): string {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(local)) throw new Error(`bad time: ${local}`)
  if (!Number.isInteger(offsetHours) || offsetHours < -12 || offsetHours > 14) {
    throw new Error(`bad UTC offset: ${offsetHours}`)
  }
  const sign = offsetHours < 0 ? '-' : '+'
  const hh = String(Math.abs(offsetHours)).padStart(2, '0')
  return `${local.replace(' ', 'T')}${sign}${hh}:00`
}

/** Epoch ms → ISO at a whole-hour server offset. */
export function msToIso(ms: number, offsetHours: number): string {
  const local = new Date(ms + offsetHours * 3_600_000).toISOString().slice(0, 19).replace('T', ' ')
  return isoWithOffset(local, offsetHours)
}

/** The server-local wall-clock part of an ISO time with offset: "2026-09-30T18:05:12". */
export function wallClock(iso: string): string {
  return iso.slice(0, 19)
}
