// Synthetic getGachaLog rows in the API's shape. No real UID, no authkey.
import type { HoyoRow } from '../../src/parse/hoyo.ts'

let next = 1_727_690_400_000_000_000n
export const row = (over: Partial<HoyoRow> = {}): HoyoRow => ({
  uid: '812345678',
  gacha_type: '301',
  item_id: '',
  time: '2026-09-01 12:00:00',
  name: 'Fixture Sword',
  lang: 'en-us',
  rank_type: '3',
  id: String(next++),
  ...over,
})

export const page = (rows: HoyoRow[], retcode = 0) => ({
  retcode,
  message: retcode === 0 ? 'OK' : 'authkey timeout',
  data:
    retcode === 0
      ? { page: '1', size: '20', total: '0', list: rows, region: 'os_asia', region_time_zone: 8 }
      : null,
})

export const dict = { 'Fixture Sword': 11301, 'Fixture Hero': 10000089, 'Standard Hero': 10000003 }
