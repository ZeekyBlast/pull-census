/** Holm step-down adjusted p-values, returned in the input order. */
export function holm(ps: number[]): number[] {
  const m = ps.length
  const order = ps.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0])
  const adj = new Array<number>(m)
  let running = 0
  order.forEach(([p, i], rank) => {
    running = Math.max(running, Math.min(1, (m - rank) * p))
    adj[i] = running
  })
  return adj
}
