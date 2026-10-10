// Synthetic registry for tests. Item ids are made up; never use these values for real verdicts.
import { loadRules } from '../../src/rules/load.ts'

const source = {
  url: 'https://example.org/fixture',
  archive: 'https://web.archive.org/web/2026/https://example.org/fixture',
  retrieved: '2026-10-09',
}
const s = <T>(value: T) => ({ value, source })

const pool = (
  gachaTypes: string[],
  hardPity: number,
  base5: number,
  featured: number | null,
  extra = {},
) => ({
  gachaTypes,
  inCensus: true,
  base5: s(base5),
  consolidated5: s(0.016),
  hardPity5: s(hardPity),
  base4: s(0.051),
  guarantee4Every: s(10),
  featuredRate: featured === null ? null : s(featured),
  catchUp: null,
  guaranteeAfterLoss: featured !== null,
  chartPath: null,
  source,
  ...extra,
})

export const FEATURED_T1 = '10000089'
export const FEATURED_T1_B = '10000090'
export const FEATURED_T2 = '10000091'
export const FEATURED_SIM = '10000100'
export const STANDARD = [
  '10000003',
  '10000016',
  '10000041',
  '10000035',
  '10000042',
  '10000069',
  '10000079',
]

export const fixtureRules = loadRules({
  game: 'genshin',
  pools: {
    'character-event': pool(['301', '400'], 90, 0.006, 0.5, { catchUp: s('capturing-radiance') }),
    'weapon-event': pool(['302'], 80, 0.007, 0.75, { chartPath: s(1) }),
    standard: pool(['200'], 90, 0.006, null),
    beginner: { ...pool(['100'], 90, 0.006, null), inCensus: false },
    chronicled: pool(['500'], 90, 0.006, null),
  },
  standard5: STANDARD.map((itemId) => ({
    itemId,
    name: `standard ${itemId}`,
    from: '2020-09-28',
    to: null,
    source,
  })),
  schedule: [
    {
      id: 'T1-301',
      gachaType: '301',
      version: '6.0',
      start: { utc: '2026-08-26T22:00:00Z' },
      end: { serverLocal: '2026-09-16T17:59:59' },
      featured5: [FEATURED_T1],
      featured4: [],
      source,
    },
    {
      id: 'T1-400',
      gachaType: '400',
      version: '6.0',
      start: { utc: '2026-08-26T22:00:00Z' },
      end: { serverLocal: '2026-09-16T17:59:59' },
      featured5: [FEATURED_T1_B],
      featured4: [],
      source,
    },
    {
      id: 'T1-302',
      gachaType: '302',
      version: '6.0',
      start: { utc: '2026-08-26T22:00:00Z' },
      end: { serverLocal: '2026-09-16T17:59:59' },
      featured5: ['11513', '15514'],
      featured4: [],
      source,
    },
    {
      id: 'T2-301',
      gachaType: '301',
      version: '6.0',
      start: { serverLocal: '2026-09-16T18:00:00' },
      end: { serverLocal: '2026-10-07T14:59:59' },
      featured5: [FEATURED_T2],
      featured4: [],
      source,
    },
    {
      id: 'SIM-301',
      gachaType: '301',
      version: '5.x',
      start: { utc: '2025-01-01T00:00:00Z' },
      end: { serverLocal: '2025-12-31T23:59:59' },
      featured5: [FEATURED_SIM],
      featured4: [],
      source,
    },
  ],
  regions: [
    { prefix: '6', digits: 9, region: 'america', source },
    { prefix: '7', digits: 9, region: 'europe', source },
    { prefix: '8', digits: 9, region: 'asia', source },
    { prefix: '18', digits: 10, region: 'asia', source },
    { prefix: '9', digits: 9, region: 'tw-hk-mo', source },
  ],
  patches: [{ version: '5.5', start: { utc: '2025-03-25T22:00:00Z' }, source }],
})
