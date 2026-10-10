import type { TestResult } from './definitions.ts'

const fmt = (n: number) => n.toLocaleString('en-US')

/** The only strings a result may render as (spec section 8.7). */
export function statusText(r: TestResult): string {
  switch (r.status) {
    case 'consistent':
      return 'Consistent with the disclosed rate'
    case 'differs':
      return r.kind === 'verdict' ? 'Differs from the disclosed rate' : 'Differs'
    case 'no-difference':
      return 'No difference found'
    case 'seeing-too-poor':
      return `Seeing too poor: ${fmt(r.n)} of ${fmt(r.needed)} needed`
    case 'rules-need-update':
      return 'Rules need update'
    case 'pending':
      throw new Error(`result ${r.id} was never adjusted`)
  }
}
