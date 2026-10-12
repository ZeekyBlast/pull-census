/**
 * One request at a time per upstream host, at least `gapMs` apart (spec section 6): every /fetch leaves from
 * one IP, so the queue is global, not per user.
 * ponytail: unbounded wait list; add a depth cap with a "busy" answer if imports ever queue for minutes.
 */
export class HostQueue {
  #tail = new Map<string, Promise<unknown>>()
  #last = new Map<string, number>()
  #gapMs: number
  #now: () => number
  #sleep: (ms: number) => Promise<void>

  constructor(gapMs: number, now: () => number, sleep: (ms: number) => Promise<void>) {
    this.#gapMs = gapMs
    this.#now = now
    this.#sleep = sleep
  }

  run<T>(host: string, task: () => Promise<T>): Promise<T> {
    const prev = this.#tail.get(host) ?? Promise.resolve()
    const next = prev
      .catch(() => {})
      .then(async () => {
        const wait = (this.#last.get(host) ?? Number.NEGATIVE_INFINITY) + this.#gapMs - this.#now()
        if (wait > 0) await this.#sleep(wait)
        try {
          return await task()
        } finally {
          this.#last.set(host, this.#now())
        }
      })
    this.#tail.set(host, next)
    return next
  }
}
