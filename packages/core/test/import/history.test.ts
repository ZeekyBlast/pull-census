import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canonicalHistoryUrl, historyParams } from '../../src/import/history.ts'

// Made-up authkey: fixtures never contain a real one.
const KEY = 'FAKEKEY%2Fabc%3D%3D'
const API = 'https://public-operation-hk4e-sg.hoyoverse.com/gacha_info/api/getGachaLog'

test('canonicalHistoryUrl keeps only the forwarded parameters on the official host', () => {
  const r = canonicalHistoryUrl(
    'genshin',
    `https://gs.hoyoverse.com/genshin/event/e20190909gacha-v3/index.html?win_mode=fullscreen&authkey_ver=1&sign_type=2&auth_appid=webview_gacha&init_type=301&timestamp=1&lang=en&device_type=pc&region=os_euro&authkey=${KEY}&game_biz=hk4e_global#/log`,
  )
  assert.ok('url' in r)
  const u = new URL(r.url)
  assert.equal(`${u.origin}${u.pathname}`, API)
  assert.deepEqual([...u.searchParams.keys()].sort(), [
    'authkey',
    'authkey_ver',
    'game_biz',
    'region',
    'sign_type',
  ])
  assert.equal(u.searchParams.get('authkey'), decodeURIComponent(KEY))
})

test('canonicalHistoryUrl ignores spaces and line breaks around a pasted link', () => {
  const r = canonicalHistoryUrl('genshin', `\n  ${API}?authkey=${KEY}&game_biz=hk4e_global  \n`)
  assert.ok('url' in r)
})

test('canonicalHistoryUrl reads a query placed after the hash', () => {
  const r = canonicalHistoryUrl('genshin', `https://example.hoyoverse.com/page#/log?authkey=${KEY}`)
  assert.ok('url' in r)
})

test('canonicalHistoryUrl explains what is wrong', () => {
  assert.deepEqual(canonicalHistoryUrl('genshin', 'not a url'), { problem: 'not-a-url' })
  assert.deepEqual(canonicalHistoryUrl('genshin', `http://x.com/?authkey=${KEY}`), {
    problem: 'not-a-url',
  })
  assert.deepEqual(canonicalHistoryUrl('genshin', 'https://x.com/?lang=en'), {
    problem: 'no-authkey',
  })
  assert.deepEqual(canonicalHistoryUrl('genshin', `${API}?authkey=${KEY}&game_biz=hk4e_cn`), {
    problem: 'cn-server',
  })
  assert.deepEqual(canonicalHistoryUrl('hsr', `${API}?authkey=${KEY}`), {
    problem: 'unsupported-game',
  })
})

test('historyParams accepts only the exact host and path', () => {
  assert.equal(historyParams('genshin', `${API}?authkey=${KEY}&x=1`)?.toString(), `authkey=${KEY}`)
  for (const bad of [
    `https://public-operation-hk4e-sg.hoyoverse.com.evil.com/gacha_info/api/getGachaLog?authkey=${KEY}`,
    `https://evil.com/gacha_info/api/getGachaLog?authkey=${KEY}`,
    `https://public-operation-hk4e-sg.hoyoverse.com/other?authkey=${KEY}`,
    `https://user@public-operation-hk4e-sg.hoyoverse.com:8443/gacha_info/api/getGachaLog?authkey=${KEY}`,
    `http://public-operation-hk4e-sg.hoyoverse.com/gacha_info/api/getGachaLog?authkey=${KEY}`,
    `${API}?lang=en`,
    `${API}?authkey=${KEY}&game_biz=hk4e_cn`,
  ])
    assert.equal(historyParams('genshin', bad), null, bad)
})
