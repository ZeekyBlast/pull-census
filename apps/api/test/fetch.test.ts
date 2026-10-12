import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rowsDigest, verifyReceipt } from '../src/receipt.ts'
import { API, fakeHoyo, HISTORY_URL, harness, history, ndjson } from './fixtures.ts'

const body = { game: 'genshin', url: HISTORY_URL }

test('the URL must be the official history API: anything else never reaches upstream', async () => {
  const fake = fakeHoyo({})
  const { post } = harness(fake.upstream)
  for (const url of [
    'https://evil.example/gacha_info/api/getGachaLog?authkey=FAKEKEY',
    `${API.replace('hoyoverse.com', 'hoyoverse.com.evil.example')}?authkey=FAKEKEY`,
    `${API}?lang=en`,
    'http://127.0.0.1:8080/',
  ]) {
    const res = await post('/fetch', { game: 'genshin', url })
    assert.equal(res.status, 400, url)
    assert.deepEqual(await res.json(), { error: 'bad-url' })
  }
  assert.equal((await post('/fetch', { game: 'genshin' })).status, 400)
  assert.equal(fake.calls.length, 0)
})

test('a full fetch streams every page of every pool, then a receipt for exactly those rows', async () => {
  const char = history(45, '301')
  const weapon = history(3, '302')
  const fake = fakeHoyo({ '301': char, '302': weapon })
  const { post, env } = harness(fake.upstream)
  const res = await post('/fetch', body)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-type'), 'application/x-ndjson')
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer')
  assert.equal(res.headers.get('cache-control'), 'no-store')
  const lines = await ndjson(res)
  const pages = lines.filter((l) => l.type === 'page')
  // 301: 20 + 20 + 5 rows; 100, 200, 302, 500: one page each.
  assert.deepEqual(
    pages.map((p) => [p.gachaType, p.rows.length]),
    [
      ['100', 0],
      ['200', 0],
      ['301', 20],
      ['301', 20],
      ['301', 5],
      ['302', 3],
      ['500', 0],
    ],
  )
  const end = lines.at(-1)
  assert.equal(end.type, 'end')
  assert.equal(end.error, null)
  const rows = pages.flatMap((p) => p.rows)
  assert.equal(
    verifyReceipt(env, 'genshin', end.receipt, {
      uid: '812345678',
      timeZone: 8,
      digest: rowsDigest(rows),
    }),
    true,
  )
  // Paging walks end_id down the history.
  const ends = fake.calls
    .filter((u) => u.searchParams.get('gacha_type') === '301')
    .map((u) => u.searchParams.get('end_id'))
  assert.deepEqual(ends, ['0', char.at(-20)!.id, char.at(-40)!.id])
})

test('upstream calls go to the official host with only allowed parameters and no redirects', async () => {
  const fake = fakeHoyo({ '301': history(3) })
  const { post } = harness(fake.upstream)
  await ndjson(
    await post('/fetch', { game: 'genshin', url: `${HISTORY_URL}&evil=1&lang=zh-cn&end_id=99` }),
  )
  for (const [i, u] of fake.calls.entries()) {
    assert.equal(`${u.origin}${u.pathname}`, API)
    assert.deepEqual([...new Set(u.searchParams.keys())].sort(), [
      'auth_appid',
      'authkey',
      'authkey_ver',
      'end_id',
      'gacha_type',
      'game_biz',
      'lang',
      'page',
      'region',
      'sign_type',
      'size',
    ])
    assert.equal(u.searchParams.get('lang'), 'en-us')
    assert.equal(fake.options[i]!.redirect, 'error')
  }
  assert.equal(fake.calls[0]!.searchParams.get('end_id'), '0')
})

test('an expired or broken authkey ends the stream with no receipt', async () => {
  for (const retcode of [-101, -100]) {
    const fake = fakeHoyo({}, () => ({ retcode, message: 'authkey timeout' }))
    const lines = await ndjson(await harness(fake.upstream).post('/fetch', body))
    assert.deepEqual(lines, [{ type: 'end', receipt: null, error: 'authkey-expired' }])
  }
})

test('"too frequent" backs off and retries; past the last wait the fetch gives up as busy', async () => {
  const twice = fakeHoyo({ '301': history(3) }, (_, call) =>
    call <= 2 ? { retcode: -110, message: 'visit too frequently' } : null,
  )
  const h = harness(twice.upstream)
  const lines = await ndjson(await h.post('/fetch', body))
  assert.equal(lines.at(-1).error, null)
  assert.deepEqual(
    h.sleeps.filter((ms) => ms >= 1000),
    [1000, 2000],
  )

  const always = fakeHoyo({}, () => ({ retcode: -110, message: 'visit too frequently' }))
  const busy = await ndjson(await harness(always.upstream).post('/fetch', body))
  assert.deepEqual(busy.at(-1), { type: 'end', receipt: null, error: 'busy' })
})

test('a page that fails partway keeps the pages so far but gives no receipt', async () => {
  const fake = fakeHoyo({ '301': history(45) }, (u) => {
    if (u.searchParams.get('gacha_type') === '301' && u.searchParams.get('end_id') !== '0')
      throw new Error('reset')
    return null
  })
  const lines = await ndjson(await harness(fake.upstream).post('/fetch', body))
  assert.equal(lines.filter((l) => l.type === 'page').length, 3) // 100, 200, first 301 page
  assert.deepEqual(lines.at(-1), { type: 'end', receipt: null, error: 'upstream' })
})

test('an empty history ends without a receipt and without an error', async () => {
  const lines = await ndjson(await harness(fakeHoyo({}).upstream).post('/fetch', body))
  assert.deepEqual(lines.at(-1), { type: 'end', receipt: null, error: null })
})

test('each IP gets five fetches an hour', async () => {
  const { post } = harness(fakeHoyo({}).upstream)
  const codes = []
  for (let i = 0; i < 6; i++) codes.push((await post('/fetch', body)).status)
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 429])
  assert.equal((await post('/fetch', body, '198.51.100.1')).status, 200)
})
