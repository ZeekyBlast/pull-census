# Plan 2A (report maths + API) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build everything behind the alpha site except the pages. That covers:
- in `packages/core`: the PityCheck maths, the cache-file and history-URL helpers, and the sky card SVG
- in a new `apps/api`: `/fetch`, `/contribute`, `/delete`, `/share` and `/card`
- the settled pre-registration, tagged `methods-v1`

**Architecture:**
- **Core** stays pure and runs in the browser. It gains:
  - `import/`: the history-URL helpers and the cache-file scanner
  - `report/`: the public soft-pity model, the nights report, the Dry List and the omen check
  - `card/`: the summary schema and the front SVG
- **API:** a Hono app on `node:sqlite`. It is built by `createApp(deps)` with every dependency injected (clock, queue, upstream `fetch`), so every route is tested through `app.request()` without opening a port.
- **Trust:** the server never trusts the browser.
  - `/fetch` rebuilds the upstream URL from an allowlist.
  - `/contribute` derives pulls itself from raw rows and checks a receipt over their content.
  - The card PNG is rendered server-side from a strict summary.

**Tech Stack:**
- Node 26.11.1 (`node:test`, `node:sqlite`), TypeScript 7.0.2 (typecheck only), valibot 1.5.0, Biome 2.5.15
- New dependencies, all in `apps/api` only: hono 4.13.13, @hono/node-server 2.1.4, @resvg/resvg-js 2.6.2
- Font build only: fonttools 4.60.1 through `uvx`

**Spec:** `docs/superpowers/specs/2026-10-09-pull-census-design.md`. Read sections 4–8, 12, 13 (type and props), 14, 15 and 16. This is the first half of section 19, plan 2. **Plan 2B** (the Astro site built from boards V5/V6/V7, plus the Playwright matrix) follows. It consumes everything here.

**Board contract:** the data each locked board implies was extracted on 2026-10-12. It is in `~/Projects/pull-census-spikes/research/board-contract.md`; every board-versus-spec conflict it found is settled under Rulings below.

**How this plan was checked:**
- Every code block was run in a scratch copy on Node 26.11.1 before it was written down.
- The plan was then replayed task by task on a fresh clone of `main` (4289270) by the script that generated it. Every "make sure it fails" step failed, every "run the tests" step passed, and each commit left a clean tree.
- End state: 174 tests pass, plus 1 slow test skipped; typecheck and lint are clean.
- The card PNG was rendered and inspected for the standard, early-star and First Light variants and for a 60-night history.
- Security-critical lines were mutation-checked: removing any of them fails a test. They are:
  - the redirect guard and the exact-host check
  - the "self upload gets no token" rule
  - the signed time zone
  - the verified-over-self upsert
  - forced `lang`
  - the log redaction
- Not checked live: the real HoYo API. No authkey was used in planning. The user runs one real import after Task 9 (see the footer).

## Global Constraints

- **Plan 1 constraints still apply:**
  - `.ts` runs by type stripping, so use erasable syntax only and end every relative import in `.ts`.
  - `packages/core/src` does no I/O.
  - Ids are strings compared with `compareIds`.
  - Times are ISO with the server's own offset.
  - Commit at the end of every task, and never push.
- **Exact pinned versions:** hono 4.13.13, @hono/node-server 2.1.4, @resvg/resvg-js 2.6.2 (in `apps/api` only). Add no other runtime dependency.
- **The history URL is a secret (spec section 15):**
  - It travels only in POST bodies.
  - It is never logged, echoed in an error, or stored.
  - The server builds its own upstream URL from `HISTORY_API` and `FORWARDED_PARAMS`, and never follows redirects.
- **Logs:** the API logs only `api error on <METHOD> <route pattern>: <error class name>`, never a body, query string or message.
- **Privacy (spec section 15):**
  - The UID is stored only as `HMAC-SHA256(UID_SALT, game + uid)`.
  - Delete tokens and share keys are stored only as SHA-256 hashes.
  - A share summary holds nothing that identifies a player, and its schema is strict.
- **Fixed strings (spec section 8.7, board copy):** "Rare, not earned", the omen phrase, "Seeing too poor". Never "rigged", "lying", "scam", "cursed" as a verdict, or a yes/no.
- **Ethics (spec section 14):** nothing here builds a pull button, a luck leaderboard or an unlockable. The after-a-loss block always comes with the miss side (90th percentile).
- **Licences:**
  - `apps/api` is AGPL-3.0-only (`apps/api/LICENSE`).
  - The card fonts are OFL, with each family's licence beside the files.
  - The vendored UIGF dictionary comes from `api.uigf.org`.
- **Pre-registration:** `methods-v1` is tagged in Task 13, before any deployment accepts `/contribute`. Nothing in `packages/core/src/tests/definitions.ts` changes in this plan.

## Rulings

The locked boards (V5–V7), spec section 7 and spec section 12 disagree in places. The ruling order is:
1. The boards decide look and copy.
2. Section 7 decides what content must exist.
3. Section 15 decides privacy and security.

⚑ marks a ruling that changes the spec's meaning. Task 13 writes those into the spec. "Cost if wrong" says what undoing it would take.

| # | Ruling | Cost if wrong |
|---|---|---|
| R1 | Until the census measures a pool, PityCheck compares against the **public soft-pity model** (0.6%, +6 points a pull from 74, certain at 90; weapons 0.7%, +7 from 63, certain at 80), at the disclosed 50% 50/50. User decision, 2026-10-12. | swap `PUBLIC_MODEL` |
| R2 ⚑ | Brightness, star size and Greek letters follow **rarity, early or late** (two-sided tail), per section 13 law 4 and V4Lexicon. Section 7's "how low the pity was" / "by pity rank" is superseded. Height follows pity rank. | one sort key |
| R3 ⚑ | The **first night of an import** started before the history. It is listed with its pity as a lower bound and kept out of every statistic: percentile, record, lucky stars, Dry List, omen and card. This is the census's own rule (section 5). Players see one fewer night than their 5★ count. | a filter in `poolReport` |
| R4 ⚑ | The omen check is **per pool, two shares** (an average night at least as long, and at least as many 50/50 losses) from 10,000 skies with seed 20261009, never combined. This follows board V6Omen and replaces section 7's single account-level p-value. | one module |
| R5 | "Waited longer" is strictly longer. The percentile is exact by convolution up to 100 nights and uses a normal approximation beyond. | none |
| R6 | Simulated figures say so. The card reads "of simulated skies", not "of the census", and the stamp reads "SEEING · SIMULATED". Seeing grades by sample size come with the census (Plan 3). | copy |
| R7 | The **Dry List** covers every wait for a featured star, since the player's target can't be known. Pools with no plain 50/50 (weapon, with its chart path; standard) get none. A wait still going keeps its lost night. A wait takes the banner of the star that ends it. Waits that start before the history or after an unknown 5★ get no comparison. One ending on an unknown 5★ says "rules need update". The board's "Still going" stands in for section 7's "still dry". | grouping rules |
| R8 | **Longest night** is the highest pity reached, counting the open night (flagged open). The card uses complete nights only. | none |
| R9 | The **after-a-loss block** gives the median and 90th-percentile pulls from current pity, on the public model. No board draws it, so Plan 2B designs it in board style. | none |
| R10 | Plates are per night: `GI·C·0007` (game, pool letter C/W/S/R/B, 4-digit night number). The boards' 0407 base was sample decoration. | a format |
| R11 | One percent formatter for sentences: "under 1%" / "over 99%" / whole percents. The card's big numeral uses `<1%` / `>99%`. | none |
| R12 | One card PNG serves both the sharer and viewers. The front label is "5★ PULLS, IN ORDER" (V7Shared), and the First Light glyph comes from the data (V6SkyCard). The variant is First Light if any night ended on pull 1, else the latest early star, else standard; the pencil marks that night. | `cardVariant` |
| R13 ⚑ | Card fonts add **Shantell Sans** (hand notes, as on the board) and a **one-glyph Noto Sans Symbols 2** subset for ★ to section 12's Bodoni Moda and Martian Mono. All are OFL static instances. | drop the hand notes to Mono |
| R14 | The card back's postmark is the **share day** (date only), from `GET /share/:code`. The front carries no date. | none |
| R15 | "Featured x of y" stays: section 12 requires it, and it is a record of outcomes, not a section 14 collection counter. | copy |
| R16 | The card's pity list is two lines; longer histories keep their latest nights after "…". | none |
| R17 ⚑ | The **card summary** holds game, pool, each complete night's pity and 50/50 result, percentile, basis, first plate and method version, and nothing else (strict schema). The census median and field are drawn from the model at render time. | schema version `v: 2` |
| R18 ⚑ | The **receipt** signs `game, uid, timeZone, sha256(each row's content sorted by id), fetchedAt`. Section 6's "sorted sourceIds" alone would let a contributor keep a valid receipt while editing outcomes. | none; strictly safer |
| R19 | `/contribute` takes the raw rows (or the UIGF file); the server derives pulls with core. | none |
| R20 ⚑ | Pulls keep **their own tier** (`pulls.verified`). A verified row replaces a self-reported row with the same id, never the reverse, and the account tier is the best it has seen. Section 5's "a verified re-upload upgrades the account's tier" would have vouched for self-reported rows. Plan 3's batch decides how mixed accounts enter verdicts. | a column |
| R21 ⚑ | **Delete tokens** go only to a new account or to a verified upload (which replaces the old token, remembered as "replaced"). Anyone can type a UID into a UIGF file, so a self-reported upload never gets or takes over a token. | an `if` |
| R22 ⚑ | `/delete` is **two steps**, as on V7Delete: `POST /delete/lookup` (game, pulls, uploads, first upload), then `POST /delete`. Used tokens report when they were used. Board error wording wins in Plan 2B. | one route |
| R23 ⚑ | Upstream requests: `lang=en-us` is forced (the vendored dictionary is English), the server sets `auth_appid=webview_gacha`, redirects are refused, and `-100` is treated like `-101`. | params |
| R24 ⚑ | **50/50 Census Tests** count only 50/50s right after a won 50/50. This is the Capturing Radiance confound from the Plan 1 review, settled before the tag. | a pre-registered rule, so it must land before `methods-v1` |
| R25 | Share codes are 8 characters from a 31-letter alphabet with no look-alikes. V7Shared's 4-character `[A-Z0-9]` sample would be guessable. | a regex |
| R26 | CN-server URLs (`game_biz=hk4e_cn`) are refused with the problem `cn-server`; section 6 sends CN players to UIGF in v1. | none |

## Review Focus

1. **A 10-pull's ten rows share one timestamp.** The plausibility check must accept equal times, or every 10-pull upload is refused as "out-of-order". *Pinned in Task 10 (`contribute.test.ts`: "a 10-pull's ten rows share one timestamp…").*
2. **A pool with no finished night yet** (a new player, or a pool touched once) must give no percentile, no omen check and no card, and never NaN. *Pinned in Task 4 (`nights.test.ts`: "a pool with no finished night yet…"), Task 6 (`omen.test.ts`: "no complete nights…") and Task 7 (`sky.test.ts`: "no finished night, no card").*
3. **A 5★ the registry doesn't know yet** (a new banner before upkeep) must pause, not guess. The Dry List says "rules need update", and the wait after it has no comparison. *Pinned in Task 5 (`clouded.test.ts`: "an unknown 5★ pauses its wait and the next one").*
4. **A pasted link the way people paste it**: with spaces or line breaks around it, with the query after `#` from the in-game page, or from the CN server. *Pinned in Task 2 (`history.test.ts`: "…ignores spaces…", "…after the hash", "…explains what is wrong").*
5. **Someone else's UID in a file.** A self-reported upload for a UID that already has verified data must neither get a delete token nor change a verified pull. *Pinned in Task 10 (`contribute.test.ts`: "without a receipt the upload is self-reported…", "a self-reported upload never overwrites a verified pull").*

## File map

```
pull-census/
  package.json  biome.json                Task 8   workspaces apps/*, test glob, typecheck both
  methods/v1.md                            Task 1, 13  50/50 rule; beta-gate precision
  rules/dict/genshin-en.json               Task 8   vendored UIGF dictionary (name → id)
  scripts/card-fonts.sh                    Task 11  static font instances for resvg
  packages/core/src/
    tests/census.ts                        Task 1   50/50 Census Tests after a win only
    import/history.ts cache.ts             Task 2   history URL helpers, cache-file scanner
    parse/hoyo.ts                          Task 2   export HoyoRowSchema
    report/model.ts format.ts              Task 3   public model, distributions, formatters
    report/nights.ts                       Task 4   PityCheck per pool
    report/clouded.ts                      Task 5   the Dry List
    report/omen.ts                         Task 6   the omen check
    card/summary.ts sky.ts                 Task 7   card summary schema, front SVG
    index.ts                               Task 2, 7  exports
  packages/core/test/…                     mirrors src; fixtures/report.ts (board sample)
  apps/api/
    package.json tsconfig.json LICENSE .env.example
    src/env.ts limits.ts queue.ts db.ts    Task 8
    src/receipt.ts fetch.ts app.ts         Task 9   (app.ts grows in Tasks 10 and 11)
    src/contribute.ts                      Task 10
    src/share.ts  fonts/                   Task 11
    src/server.ts                          Task 12
    test/fixtures.ts + one test per module
```

---


### Task 1: Capturing Radiance: 50/50 Census Tests after a won 50/50 only

**Files:**
- Modify: `packages/core/src/tests/census.ts` (`flipRow` in `censusTests`)
- Modify: `methods/v1.md` (section 3)
- Test: `packages/core/test/tests/census.test.ts`, `packages/core/test/methods.test.ts`

**Interfaces:**
- Consumes: `censusTests(data, rules, pool, reps)` and the `Streak.lossesBefore` field from Plan 1.
- Produces: no new names. 50/50 Census Tests now count only streaks with `lossesBefore === 0`.

The Plan 1 final review left one confound to settle before the `methods-v1` tag: under Capturing Radiance the 50/50 win rate rises with each loss in a row, so a group holding more losing runs shows a different 50/50 on fair data. The fix compares like with like: only 50/50s right after a won 50/50 (ruling R24).

- [ ] **Step 1: Write the failing test**

Append to `packages/core/test/tests/census.test.ts`:

```ts

test('50/50 Census Tests count only 50/50s after a won 50/50, so the catch-up counter is level in both groups', () => {
  // Even i: a 50/50 after a win (lossesBefore 0); odd i: after a loss. Every third streak ends in a 10-pull.
  const streaks = Array.from({ length: 7000 }, (_, i) =>
    rec({
      accountId: `a${i % 4000}`,
      lossesBefore: i % 2,
      outcome: i % 4 < 2 ? 'featured' : 'standard',
      multi: Array.from({ length: 60 }, () => i % 3 === 0),
    }),
  )
  const flips = (data: typeof streaks) =>
    censusTests(census(data), rules, 'character-event', 50).find(
      (t) => t.id === 'census:singles-vs-multi:fifty-fifty:character-event',
    )!.n
  // n is the smaller group: 10-pull flips after a win are i ≡ 0 (mod 6), 1167 of them.
  assert.equal(flips(streaks), 1167)
  // Counting every flip would give the 10-pull group all 2334 streaks with i ≡ 0 (mod 3).
  assert.equal(flips(streaks.map((s) => ({ ...s, lossesBefore: 0 }))), 2334)
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test packages/core/test/tests/census.test.ts`

Expected: FAIL: `2334 !== 1167` (every flip is counted).

- [ ] **Step 3: Count only 50/50s after a win**

In `packages/core/src/tests/census.ts`, replace:

```ts
  const flipRow = (s: Streak, g: 'A' | 'B' | null) => {
    if (!g || s.guaranteed !== false || (s.outcome !== 'featured' && s.outcome !== 'standard'))
      return [0, 0, 0, 0]
```

with:

```ts
  // Only 50/50s right after a won 50/50: a catch-up mechanic (Capturing Radiance) raises the win rate with each
  // loss in a row, so groups with different loss streaks would differ on fair data.
  const flipRow = (s: Streak, g: 'A' | 'B' | null) => {
    if (
      !g ||
      s.guaranteed !== false ||
      s.lossesBefore !== 0 ||
      (s.outcome !== 'featured' && s.outcome !== 'standard')
    )
      return [0, 0, 0, 0]
```

- [ ] **Step 4: Run the census and simulation tests**

Run: `node --test packages/core/test/tests/census.test.ts packages/core/test/sim/suite.test.ts`

Expected: PASS. The simulation suite still catches its planted 45% 50/50.

- [ ] **Step 5: Say it in the methods, and pin the sentence**

In `methods/v1.md`, replace:

```markdown
| Patch (one per registry patch inside the data) | Streaks that start before the patch | Streaks that start after it |
```

with:

```markdown
| Patch (one per registry patch inside the data) | Streaks that start before the patch | Streaks that start after it |

- **50/50 comparisons** count only 50/50s that come right after a won 50/50. A catch-up mechanic such as Capturing Radiance raises the win rate with each loss in a row, so a group that happens to hold more losing runs would show a different 50/50 on fair data.
```

In `packages/core/test/methods.test.ts`, replace:

```ts
    'Epitomized Path',
  ]
```

with:

```ts
    'Epitomized Path',
    'right after a won 50/50',
  ]
```

Run: `node --test packages/core/test/methods.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/tests/census.ts packages/core/test/tests/census.test.ts methods/v1.md packages/core/test/methods.test.ts
git commit -m "fix(core): 50/50 Census Tests compare only 50/50s after a won 50/50"
```


### Task 2: History URL helpers and the cache-file scanner

**Files:**
- Create: `packages/core/src/import/history.ts`, `packages/core/src/import/cache.ts`
- Modify: `packages/core/src/parse/hoyo.ts` (export the row schema)
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/import/history.test.ts`, `packages/core/test/import/cache.test.ts`

**Interfaces:**
- Produces:
  - `HISTORY_API: Partial<Record<Game, HistoryApi>>` with `HistoryApi = { host, path, queryTypes: string[], gameBiz }`
  - `FORWARDED_PARAMS` (`authkey`, `authkey_ver`, `sign_type`, `game_biz`, `region`)
  - `canonicalHistoryUrl(game, raw): { url } | { problem: 'not-a-url' | 'no-authkey' | 'cn-server' | 'unsupported-game' }` (browser)
  - `historyParams(game, raw): URLSearchParams | null` (server; exact host and path)
  - `findHistoryUrl(bytes: Uint8Array, game): string | null`
  - `HoyoRowSchema` (valibot), the schema behind `HoyoRow`

Core stays I/O-free: these run in the browser (the cache file never leaves the device) and on the server (the host check). The server never calls the URL it is given; it rebuilds one from the allowlisted host and parameters. CN-server URLs are refused with a problem the site turns into "use a UIGF file" (ruling R26).

- [ ] **Step 1: Write the failing tests**

`packages/core/test/import/history.test.ts`:

```ts
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
```

`packages/core/test/import/cache.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findHistoryUrl } from '../../src/import/cache.ts'

const API = 'https://public-operation-hk4e-sg.hoyoverse.com/gacha_info/api/getGachaLog'
const enc = (s: string) => new TextEncoder().encode(s)
const join = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}
const noise = new Uint8Array([0, 1, 0xff, 0x80, 0, 0x22, 0x0a])

test('findHistoryUrl returns the last history URL with an authkey among binary noise', () => {
  const bytes = join(
    noise,
    enc(`1/0/${API}?authkey=OLD&size=5`),
    noise,
    enc('1/0/https://example.com/other?authkey=NOPE'),
    noise,
    enc(`1/0/${API}?authkey=NEW&size=5`),
    noise,
    enc(`1/0/${API}?lang=en`),
    noise,
  )
  assert.equal(findHistoryUrl(bytes, 'genshin'), `${API}?authkey=NEW&size=5`)
})

test('findHistoryUrl returns null when the history was never opened', () => {
  assert.equal(findHistoryUrl(join(noise, enc('https://example.com/')), 'genshin'), null)
})
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test packages/core/test/import/`

Expected: FAIL: `ERR_MODULE_NOT_FOUND` for `src/import/history.ts`.

- [ ] **Step 3: Write the helpers**

`packages/core/src/import/history.ts`:

```ts
import type { Game } from '../types.ts'

/** The official gacha history API per game. Only these hosts are ever called (spec section 6). */
export type HistoryApi = {
  host: string
  path: string
  /** gacha_type values to page through. Genshin's 301 query also returns 400 rows. */
  queryTypes: string[]
  /** Global-server game_biz; the CN server (a different host) uses the UIGF path in v1. */
  gameBiz: string
}

export const HISTORY_API: Partial<Record<Game, HistoryApi>> = {
  genshin: {
    host: 'public-operation-hk4e-sg.hoyoverse.com',
    path: '/gacha_info/api/getGachaLog',
    queryTypes: ['100', '200', '301', '302', '500'],
    gameBiz: 'hk4e_global',
  },
}

/** Parameters copied from the player's URL. Everything else is set by the server. */
export const FORWARDED_PARAMS = [
  'authkey',
  'authkey_ver',
  'sign_type',
  'game_biz',
  'region',
] as const

export type HistoryUrlProblem = 'not-a-url' | 'no-authkey' | 'cn-server' | 'unsupported-game'

/**
 * Turn any URL the player has (the cached API call, or the in-game page) into the official API URL with only the
 * forwarded parameters. The browser sends this; the server checks the host exactly (`historyParams`).
 */
export function canonicalHistoryUrl(
  game: Game,
  raw: string,
): { url: string } | { problem: HistoryUrlProblem } {
  const api = HISTORY_API[game]
  if (!api) return { problem: 'unsupported-game' }
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return { problem: 'not-a-url' }
  }
  if (u.protocol !== 'https:') return { problem: 'not-a-url' }
  // In-game pages sometimes carry the query after the hash.
  const hashQuery = u.hash.includes('?')
    ? new URLSearchParams(u.hash.slice(u.hash.indexOf('?')))
    : null
  const get = (k: string) => u.searchParams.get(k) ?? hashQuery?.get(k) ?? null
  if (!get('authkey')) return { problem: 'no-authkey' }
  const biz = get('game_biz')
  if (biz && biz !== api.gameBiz) return { problem: 'cn-server' }
  const out = new URL(`https://${api.host}${api.path}`)
  for (const k of FORWARDED_PARAMS) {
    const val = get(k)
    if (val !== null) out.searchParams.set(k, val)
  }
  return { url: out.toString() }
}

/** Server side: the forwarded parameters of a canonical URL, or null if the host or path isn't the allowlisted one. */
export function historyParams(game: Game, raw: string): URLSearchParams | null {
  const api = HISTORY_API[game]
  if (!api) return null
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' || u.host !== api.host || u.pathname !== api.path) return null
  if (!u.searchParams.get('authkey')) return null
  const biz = u.searchParams.get('game_biz')
  if (biz && biz !== api.gameBiz) return null
  const out = new URLSearchParams()
  for (const k of FORWARDED_PARAMS) {
    const val = u.searchParams.get(k)
    if (val !== null) out.set(k, val)
  }
  return out
}
```

`packages/core/src/import/cache.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests**

Run: `node --test packages/core/test/import/`

Expected: PASS (7 tests).

- [ ] **Step 5: Export the row schema and the new modules**

In `packages/core/src/parse/hoyo.ts`, replace:

```ts
const Row = v.object({
```

with:

```ts
/** One getGachaLog row, as the API sends it. */
export const HoyoRowSchema = v.object({
```

In `packages/core/src/parse/hoyo.ts`, replace:

```ts
export type HoyoRow = v.InferOutput<typeof Row>
```

with:

```ts
export type HoyoRow = v.InferOutput<typeof HoyoRowSchema>
```

In `packages/core/src/parse/hoyo.ts`, replace:

```ts
      list: v.array(Row),
```

with:

```ts
      list: v.array(HoyoRowSchema),
```

In `packages/core/src/index.ts`, replace:

```ts
export * from './ids.ts'
```

with:

```ts
export * from './ids.ts'
export * from './import/cache.ts'
export * from './import/history.ts'
```

Run: `node --test packages/core/test/parse/hoyo.test.ts packages/core/test/index.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/import packages/core/test/import packages/core/src/parse/hoyo.ts packages/core/src/index.ts
git commit -m "feat(core): history URL helpers and the cache-file scanner"
```


### Task 3: The public soft-pity model and the shared formatters

**Files:**
- Create: `packages/core/src/report/model.ts`, `packages/core/src/report/format.ts`
- Test: `packages/core/test/report/model.test.ts`, `packages/core/test/report/format.test.ts`

**Interfaces:**
- Consumes: `softPityHazard`, `disclosedHazard`, `type Hazard` (`src/sim/simulate.ts`), `normCdf` (`src/stats/special.ts`).
- Produces:
  - `type PityModel = { base, onset, step, hardPity }`, `PUBLIC_MODEL: Record<pool, PityModel>`
  - `type Dist = { pmf: number[]; cdf: number[] }`, `distFromHazard`, `modelDist(m)`, `catalogueDist(m)`
  - `cdfAt(d, k)`, `mean(d)`, `quantile(d, q)`, `band(m): [onset, end]`, `sumExceeds(d, n, s)`
  - `pct(v)`, `aboutPhrase(p, censusAccounts | null)`, `plate(game, pool, n)`

Every PityCheck number compares against a pity distribution. Until the census measures a pool, that is the public soft-pity model (ruling R1). It must reproduce the boards' own numbers: median 76, mean 62.3, First Light 1 in 167, early star 1 in 17, the Milky Way band 74–85, and the disclosed 1.6% consolidated rate.

- [ ] **Step 1: Write the failing tests**

`packages/core/test/report/model.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  band,
  catalogueDist,
  cdfAt,
  mean,
  modelDist,
  PUBLIC_MODEL,
  quantile,
  sumExceeds,
} from '../../src/report/model.ts'

const char = PUBLIC_MODEL['character-event']!
const d = modelDist(char)

test('the public character model matches the board sample and the disclosed consolidated rate', () => {
  assert.ok(Math.abs(cdfAt(d, 90) - 1) < 1e-12)
  assert.equal(Math.round(mean(d) * 10) / 10, 62.3)
  assert.equal(quantile(d, 0.5), 76)
  assert.equal(Math.round(1 / cdfAt(d, 1)), 167) // First Light odds
  assert.equal(Math.round(1 / cdfAt(d, 10)), 17) // early-star odds
  assert.ok(Math.abs(1 / mean(d) - 0.016) < 0.0005) // disclosed consolidated 1.6%
  assert.deepEqual(band(char), [74, 85])
})

test('the weapon model ends at 80 and its band at 73', () => {
  const w = PUBLIC_MODEL['weapon-event']!
  assert.ok(Math.abs(cdfAt(modelDist(w), 80) - 1) < 1e-12)
  assert.deepEqual(band(w), [63, 73])
})

test('the catalogue is flat until hard pity', () => {
  const c = catalogueDist(char)
  assert.ok(Math.abs((c.pmf[0] as number) - 0.006) < 1e-15)
  assert.ok(Math.abs(cdfAt(c, 74) - (1 - 0.994 ** 74)) < 1e-12)
  assert.ok(Math.abs(cdfAt(c, 90) - 1) < 1e-12)
})

test('sumExceeds is exact for one night and agrees with the normal approximation past 100 nights', () => {
  assert.ok(Math.abs(sumExceeds(d, 1, 76) - (1 - cdfAt(d, 76))) < 1e-12)
  assert.equal(sumExceeds(d, 3, 270), 0) // 3 nights can't pass 270 pulls
  assert.ok(Math.abs(sumExceeds(d, 3, 2) - 1) < 1e-12)
  const exact = sumExceeds(d, 100, 100 * 63)
  const approx = sumExceeds(d, 101, 101 * 63)
  assert.ok(Math.abs(exact - approx) < 0.03, `${exact} vs ${approx}`)
})
```

`packages/core/test/report/format.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aboutPhrase, pct, plate } from '../../src/report/format.ts'

test('one percent formatter: under 1%, over 99%, else whole percents', () => {
  assert.deepEqual([0.004, 0.01, 0.876, 0.99, 0.996].map(pct), [
    'under 1%',
    '1%',
    '88%',
    '99%',
    'over 99%',
  ])
})

test('the omen phrase speaks per 10,000 players until the census has 500 accounts', () => {
  assert.equal(
    aboutPhrase(0.1404, null),
    'About 1,400 in every 10,000 players are expected to be at least this unlucky.',
  )
  assert.equal(
    aboutPhrase(0.1404, 499),
    'About 1,400 in every 10,000 players are expected to be at least this unlucky.',
  )
  assert.equal(
    aboutPhrase(0.1404, 18_240),
    "About 2,560 of the census's 18,240 accounts are expected to be at least this unlucky.",
  )
  assert.equal(
    aboutPhrase(0.004, 600),
    "About 2 of the census's 600 accounts are expected to be at least this unlucky.",
  )
  assert.equal(
    aboutPhrase(0.00001, 600),
    "Fewer than 1 of the census's 600 accounts is expected to be at least this unlucky.",
  )
})

test('plates number the nights of each pool', () => {
  assert.equal(plate('genshin', 'character-event', 7), 'GI·C·0007')
  assert.equal(plate('genshin', 'weapon-event', 1234), 'GI·W·1234')
  assert.equal(plate('hsr', 'standard', 12), 'SR·S·0012')
})
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test packages/core/test/report/`

Expected: FAIL: `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the model and the formatters**

`packages/core/src/report/model.ts`:

```ts
import { disclosedHazard, type Hazard, softPityHazard } from '../sim/simulate.ts'
import { normCdf } from '../stats/special.ts'

/**
 * The public soft-pity model: the long-known community measurement, which our OneBST calibration reproduces
 * (methods/v1.md section 10) and which matches each pool's disclosed consolidated rate. PityCheck compares
 * against a simulation of it until the census measures a pool (spec section 7).
 */
export type PityModel = { base: number; onset: number; step: number; hardPity: number }

const CHARACTER: PityModel = { base: 0.006, onset: 74, step: 0.06, hardPity: 90 }
export const PUBLIC_MODEL: Record<string, PityModel> = {
  'character-event': CHARACTER,
  standard: CHARACTER,
  chronicled: CHARACTER,
  'weapon-event': { base: 0.007, onset: 63, step: 0.07, hardPity: 80 },
}

/** A pity distribution: pmf[k - 1] = P(the 5★ lands on pull k), cdf[k - 1] = P(by pull k). */
export type Dist = { pmf: number[]; cdf: number[] }

export function distFromHazard(h: Hazard, maxK: number): Dist {
  const pmf: number[] = []
  const cdf: number[] = []
  let survive = 1
  let total = 0
  for (let k = 1; k <= maxK; k++) {
    const p = survive * h(k)
    pmf.push(p)
    total += p
    cdf.push(total)
    survive *= 1 - h(k)
  }
  return { pmf, cdf }
}

export const modelDist = (m: PityModel): Dist =>
  distFromHazard(softPityHazard(m.base, m.onset, m.step, m.hardPity), m.hardPity)

/** The catalogue: the disclosed base rate on every pull, certain at hard pity. */
export const catalogueDist = (m: PityModel): Dist =>
  distFromHazard(disclosedHazard(m.base, m.hardPity), m.hardPity)

/** F(k) with F(0) = 0 and F(k) = 1 past the end. */
export const cdfAt = (d: Dist, k: number): number =>
  k <= 0 ? 0 : k > d.cdf.length ? 1 : (d.cdf[k - 1] as number)

export const mean = (d: Dist): number => d.pmf.reduce((a, p, i) => a + p * (i + 1), 0)

/** Smallest k with F(k) >= q. */
export const quantile = (d: Dist, q: number): number => {
  const i = d.cdf.findIndex((v) => v >= q - 1e-12)
  return i === -1 ? d.cdf.length : i + 1
}

/** The soft-pity band ("the Milky Way"): from onset to the pull where 99.9% of nights have ended. */
export const band = (m: PityModel): [number, number] => [m.onset, quantile(modelDist(m), 0.999)]

/** Largest night count summed exactly; above it the normal approximation is used. */
const EXACT_SUM_MAX = 100

/**
 * P(sum of n independent pities > s): the share of simulated accounts with n nights whose mean wait is longer
 * than a mean of s / n. Exact by convolution up to EXACT_SUM_MAX nights.
 * ponytail: normal approximation above 100 nights (error well under 1 point there); FFT if that ever matters.
 */
export function sumExceeds(d: Dist, n: number, s: number): number {
  if (n <= 0) return 0
  if (n > EXACT_SUM_MAX) {
    const mu = mean(d)
    const v = d.pmf.reduce((a, p, i) => a + p * (i + 1 - mu) ** 2, 0)
    const z = (s + 0.5 - n * mu) / Math.sqrt(n * v)
    return 1 - normCdf(z)
  }
  // dist[t] = P(sum = t), built one night at a time.
  let dist = [1]
  for (let j = 0; j < n; j++) {
    const next = new Array<number>(dist.length + d.pmf.length).fill(0)
    for (let t = 0; t < dist.length; t++) {
      const a = dist[t] as number
      if (a === 0) continue
      for (let k = 0; k < d.pmf.length; k++) next[t + k + 1]! += a * (d.pmf[k] as number)
    }
    dist = next
  }
  let above = 0
  for (let t = Math.floor(s) + 1; t < dist.length; t++) above += dist[t] as number
  return Math.min(1, Math.max(0, above))
}
```

`packages/core/src/report/format.ts`:

```ts
import type { Game } from '../types.ts'

/** One percent formatter for every sentence on the site. */
export function pct(v: number): string {
  if (v < 0.01) return 'under 1%'
  if (v > 0.99) return 'over 99%'
  return `${Math.round(v * 100)}%`
}

/**
 * The omen phrase (spec section 7): "about N of the census's M accounts", or "about N in every 10,000 players"
 * while the census has fewer than 500 accounts. Never a yes or no.
 */
export function aboutPhrase(p: number, censusAccounts: number | null): string {
  const early = censusAccounts === null || censusAccounts < 500
  const m = early ? 10_000 : censusAccounts
  const n = p * m
  const who = early
    ? 'in every 10,000 players'
    : `of the census's ${m.toLocaleString('en-US')} accounts`
  if (n < 1) return `Fewer than 1 ${who} is expected to be at least this unlucky.`
  const count = (n >= 100 ? Math.round(n / 10) * 10 : Math.round(n)).toLocaleString('en-US')
  return `About ${count} ${who} are expected to be at least this unlucky.`
}

const GAME_CODE: Record<Game, string> = { genshin: 'GI', hsr: 'SR', zzz: 'ZZ' }
const POOL_CODE: Record<string, string> = {
  'character-event': 'C',
  'weapon-event': 'W',
  standard: 'S',
  chronicled: 'R',
  beginner: 'B',
}

/** Plate number of the nth night in a pool, e.g. GI·C·0007 (spec section 13). */
export const plate = (game: Game, pool: string, n: number): string =>
  `${GAME_CODE[game]}·${POOL_CODE[pool] ?? 'X'}·${String(n).padStart(4, '0')}`
```

- [ ] **Step 4: Run the tests**

Run: `node --test packages/core/test/report/`

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/report packages/core/test/report
git commit -m "feat(core): public soft-pity model and report formatters"
```


### Task 4: PityCheck: nights, percentile, lucky stars and the after-a-loss block

**Files:**
- Create: `packages/core/src/report/nights.ts`
- Create: `packages/core/test/fixtures/report.ts` (the boards' shared sample as pulls)
- Test: `packages/core/test/report/nights.test.ts`

**Interfaces:**
- Consumes: `deriveStreaks` (`src/streaks.ts`), `poolRules` (`src/rules/load.ts`), everything from Task 3.
- Produces:
  - `type Night` (n, plate, pity, truncated, outcome, coin: `'won' | 'lost' | 'promised' | null`, bannerId, end, marks, tail, before, after, rarity, size, letter)
  - `type PoolReport` (game, pool, model, dist, catalogue, band, nights, open, complete, meanPity, percentile, longest, record, lucky, afterLoss, modelMean, modelMedian)
  - `pityCheck(pulls, rules): PoolReport[]`, `poolReport(rules, pool, streaks)`, `almanac(report, ks?)`
  - `EARLY_MAX` (10), `starSize(tail)`
  - test fixture `boardPulls(pities?, won?, open?)`, `SAMPLE_PITIES`, `SAMPLE_WON`

One report per pool, from the account's own pulls. The first night of an import started before the history, so it is listed but kept out of every statistic (ruling R3). Letters and star sizes follow rarity, early or late (R2). The after-a-loss block gives the median and 90th-percentile pulls to the next 5★ from current pity (R9).

- [ ] **Step 1: Write the fixture and the failing tests**

`packages/core/test/fixtures/report.ts`:

```ts
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
```

`packages/core/test/report/nights.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cdfAt, modelDist, PUBLIC_MODEL } from '../../src/report/model.ts'
import { almanac, pityCheck } from '../../src/report/nights.ts'
import { mulberry32 } from '../../src/stats/prng.ts'
import { mkPulls, streakOf } from '../fixtures/pulls.ts'
import { boardPulls, SAMPLE_PITIES } from '../fixtures/report.ts'
import { fixtureRules as rules, STANDARD } from '../fixtures/rules.ts'

const report = () => pityCheck(boardPulls(), rules)[0]!

test('the board sample: letters by rarity, rarity classes, sizes and marks', () => {
  const r = report()
  assert.equal(r.pool, 'character-event')
  assert.deepEqual(
    r.complete.map((n) => n.pity),
    SAMPLE_PITIES,
  )
  assert.equal(r.complete.map((n) => n.letter).join(''), 'λγζηθαεβιδκ')
  assert.deepEqual(
    r.complete.map((n) => n.rarity),
    ['dim', 'medium', 'dim', 'dim', 'dim', 'bright', 'dim', 'bright', 'dim', 'medium', 'dim'],
  )
  assert.deepEqual(
    r.complete.map((n) => Math.round(n.size * 10) / 10),
    [16, 22, 17.7, 17.6, 16.9, 33.1, 18.8, 24.2, 16.7, 20.2, 16.4],
  )
  assert.deepEqual(
    r.complete.map((n) => n.marks.join(' ')),
    ['SP', 'SP', 'L', 'SP P', 'SP', 'SP', 'SP L', 'E P', 'SP', 'SP L', 'SP P'],
  )
})

test('the first night of an import is truncated: listed, but in no statistic', () => {
  const r = report()
  const first = r.nights[0]!
  assert.equal(first.truncated, true)
  assert.equal(first.pity, 30)
  assert.equal(first.tail, null)
  assert.equal(first.letter, null)
  assert.deepEqual(first.marks, [])
  assert.equal(r.complete.length, 11)
  assert.equal(r.nights.length, 12)
})

test('plates, open night, longest night, 50/50 record and lucky stars', () => {
  const r = report()
  assert.equal(r.nights[0]!.plate, 'GI·C·0001')
  assert.deepEqual(r.open, { pity: 37, plate: 'GI·C·0013' })
  assert.deepEqual(r.longest, { pity: 85, open: false, plate: 'GI·C·0007' })
  assert.deepEqual(r.record, { won: 5, lost: 3, promised: 3, unknown: 0 })
  assert.deepEqual(r.lucky, { firstLight: 0, early: 1, odds: { firstLight: 167, early: 17 } })
  assert.equal(r.afterLoss, null)
  assert.equal(Math.round(r.meanPity! * 10) / 10, 70.4)
  assert.equal(r.modelMedian, 76)
})

test('the percentile is the share of simulated accounts with 11 nights and a longer mean wait', () => {
  const r = report()
  assert.equal(r.percentile!.basis, 'simulated')
  // Independent check: 20,000 seeded simulated accounts of 11 nights each.
  const d = modelDist(PUBLIC_MODEL['character-event']!)
  const rand = mulberry32(7)
  let longer = 0
  for (let i = 0; i < 20_000; i++) {
    let sum = 0
    for (let j = 0; j < 11; j++) {
      const u = rand()
      sum += d.cdf.findIndex((v) => v >= u) + 1
    }
    if (sum > 774) longer++
  }
  assert.ok(Math.abs(r.percentile!.value - longer / 20_000) < 0.01)
  // Mean 70.4 against a model mean of 62.3: most simulated accounts waited less.
  assert.ok(r.percentile!.value < 0.2)
  assert.ok(pityCheck(boardPulls([40, 50, 45], [1, 1, 1], 0), rules)[0]!.percentile!.value > 0.8)
})

test('after a lost 50/50: the next star is promised, with median and 90th-percentile pulls from current pity', () => {
  const r = pityCheck(boardPulls([76, 62], [1, 0], 37), rules)[0]!
  const d = modelDist(PUBLIC_MODEL['character-event']!)
  const left = 1 - cdfAt(d, 37)
  const need = (q: number) => {
    let j = 1
    while ((cdfAt(d, 37 + j) - cdfAt(d, 37)) / left < q) j++
    return j
  }
  assert.deepEqual(r.afterLoss, { pity: 37, median: need(0.5), p90: need(0.9) })
  assert.ok(r.afterLoss!.median > 30 && r.afterLoss!.p90 <= 53)
})

test('the open night counts as the longest when it already passed every closed night', () => {
  const r = pityCheck(boardPulls([20], [1], 60), rules)[0]!
  assert.deepEqual(r.longest, { pity: 60, open: true, plate: 'GI·C·0003' })
})

test('a pool with no finished night yet has no statistics, and nothing is NaN', () => {
  const r = pityCheck(boardPulls([], [], 20), rules)[0]!
  assert.equal(r.complete.length, 0)
  assert.equal(r.meanPity, null)
  assert.equal(r.percentile, null)
  assert.deepEqual(r.longest, { pity: 20, open: true, plate: 'GI·C·0002' })
  assert.deepEqual(r.record, { won: 0, lost: 0, promised: 0, unknown: 0 })
  assert.deepEqual(r.lucky.firstLight + r.lucky.early, 0)
})

test('a pool without a featured 5★ has no 50/50 record', () => {
  const r = pityCheck(
    mkPulls('standard', [...streakOf(9, STANDARD[0]!), ...streakOf(49, STANDARD[1]!)]),
    rules,
  )[0]!
  assert.equal(r.pool, 'standard')
  assert.deepEqual(r.record, { won: 0, lost: 0, promised: 0, unknown: 0 })
  assert.equal(r.complete[0]!.coin, null)
  assert.equal(r.afterLoss, null)
})

test('the almanac matches the board: measured, catalogue and still clouded out', () => {
  const rows = almanac(report())
  const at = (k: number) => rows.find((x) => x.k === k)!
  assert.deepEqual(
    rows.map((x) => x.k),
    [30, 60, 74, 78, 80, 85, 90],
  )
  assert.equal(Math.round(at(74).measured * 100), 40)
  assert.equal(Math.round(at(74).catalogue * 100), 36)
  assert.equal(Math.round(at(80).measured * 100), 92)
  assert.equal(Math.round(at(80).clouded * 1000) / 10, 8.2)
})
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test packages/core/test/report/nights.test.ts`

Expected: FAIL: `ERR_MODULE_NOT_FOUND` for `src/report/nights.ts`.

- [ ] **Step 3: Write the pool report**

`packages/core/src/report/nights.ts`:

```ts
// PityCheck for one pool (spec section 7, boards V5CNight and V6Clouded): nights, lucky stars and the after-a-loss block.
import { poolRules } from '../rules/load.ts'
import type { Rules } from '../rules/schema.ts'
import { deriveStreaks } from '../streaks.ts'
import type { Game, Outcome, Pull, Streak } from '../types.ts'
import { plate } from './format.ts'
import {
  band,
  catalogueDist,
  cdfAt,
  type Dist,
  mean,
  modelDist,
  type PityModel,
  PUBLIC_MODEL,
  quantile,
  sumExceeds,
} from './model.ts'

export const EARLY_MAX = 10
const GREEK = 'αβγδεζηθικλμνξοπρστυφχψω'

export type Mark = 'SP' | 'L' | 'P' | 'E'
export type Rarity = 'bright' | 'medium' | 'dim'
export type Coin = 'won' | 'lost' | 'promised'

/** One night: the pulls from one 5★ (exclusive) to the next (inclusive). */
export type Night = {
  n: number
  plate: string
  pity: number
  /** The first night of an import started before the history: its pity is only a lower bound, so no statistic uses it. */
  truncated: boolean
  /** null when the pool has no featured 5★. */
  outcome: Outcome | null
  /** The 50/50: won, lost, or promised (guaranteed after a loss). null when unknown or the pool has none. */
  coin: Coin | null
  bannerId: string | null
  end: string
  marks: Mark[]
  /** Two-sided tail: how rare a night this short or this long is. null for truncated nights. */
  tail: number | null
  /** Share of model nights that ended sooner / ran longer. */
  before: number | null
  after: number | null
  rarity: Rarity | null
  /** Star glyph size in px: bigger is rarer, early or late (law 4). */
  size: number
  /** Greek letter by rarity rank (α rarest); only the 24 rarest nights get one. */
  letter: string | null
}

export type PoolReport = {
  game: Game
  pool: string
  model: PityModel
  dist: Dist
  catalogue: Dist
  band: [number, number]
  nights: Night[]
  /** The unfinished night: pulls since the last 5★. */
  open: { pity: number; plate: string } | null
  /** Nights every statistic uses: closed and not truncated. */
  complete: Night[]
  meanPity: number | null
  /** Share of simulated accounts with as many complete nights whose mean wait was longer. */
  percentile: { value: number; basis: 'simulated' } | null
  longest: { pity: number; open: boolean; plate: string } | null
  record: { won: number; lost: number; promised: number; unknown: number }
  lucky: { firstLight: number; early: number; odds: { firstLight: number; early: number } }
  /** Shown when the latest 5★ lost the 50/50: no pull button, ever (spec section 14). */
  afterLoss: { pity: number; median: number; p90: number } | null
  modelMean: number
  modelMedian: number
}

const rarityOf = (r: number): Rarity => (r < 0.05 ? 'bright' : r < 0.2 ? 'medium' : 'dim')
export const starSize = (r: number) => 14 + Math.min(1, Math.max(0, -Math.log10(r) / 3)) * 22

/** Every pool's report for one account's pulls, in the order pools first appear. */
export function pityCheck(pulls: Pull[], rules: Rules): PoolReport[] {
  const data = deriveStreaks(pulls, rules, { accountId: 'me', uid: '0', verified: false })
  return Object.keys(PUBLIC_MODEL)
    .filter((pool) => data.streaks.some((s) => s.pool === pool))
    .map((pool) =>
      poolReport(
        rules,
        pool,
        data.streaks.filter((s) => s.pool === pool),
      ),
    )
}

export function poolReport(rules: Rules, pool: string, streaks: Streak[]): PoolReport {
  const model = PUBLIC_MODEL[pool]
  if (!model) throw new Error(`no model for pool ${pool}`)
  const pr = poolRules(rules, pool)
  const dist = modelDist(model)
  const [bandLo, bandHi] = band(model)
  const hasFeatured = pr.featuredRate !== null

  const nights: Night[] = streaks
    .filter((s) => !s.censored)
    .map((s, i) => {
      const truncated = s.leftTruncated
      const tail = truncated ? null : Math.min(cdfAt(dist, s.length), 1 - cdfAt(dist, s.length - 1))
      // A standard 5★ is always a lost 50/50; a featured one is won or promised only if the state before it is known.
      const coin: Coin | null = !hasFeatured
        ? null
        : s.outcome === 'standard'
          ? 'lost'
          : s.outcome !== 'featured'
            ? null
            : s.guaranteed === true
              ? 'promised'
              : s.guaranteed === false
                ? 'won'
                : null
      const marks: Mark[] = []
      if (!truncated && s.length <= EARLY_MAX) marks.push('E')
      if (!truncated && s.length >= bandLo && s.length <= bandHi) marks.push('SP')
      if (coin === 'lost') marks.push('L')
      if (coin === 'promised') marks.push('P')
      return {
        n: i + 1,
        plate: plate(rules.game, pool, i + 1),
        pity: s.length,
        truncated,
        outcome: hasFeatured ? s.outcome : null,
        coin,
        bannerId: s.bannerId,
        end: s.end,
        marks,
        tail,
        before: truncated ? null : cdfAt(dist, s.length - 1),
        after: truncated ? null : 1 - cdfAt(dist, s.length),
        rarity: tail === null ? null : rarityOf(tail),
        size: tail === null ? 14 : starSize(tail),
        letter: null,
      }
    })
  const complete = nights.filter((n) => !n.truncated)
  ;[...complete]
    .sort((a, b) => (a.tail as number) - (b.tail as number))
    .slice(0, GREEK.length)
    .forEach((night, i) => {
      night.letter = GREEK[i] as string
    })

  const openStreak = streaks.find((s) => s.censored)
  const open = openStreak
    ? { pity: openStreak.length, plate: plate(rules.game, pool, nights.length + 1) }
    : null

  const sum = complete.reduce((a, n) => a + n.pity, 0)
  const meanPity = complete.length ? sum / complete.length : null
  const percentile = complete.length
    ? { value: sumExceeds(dist, complete.length, sum), basis: 'simulated' as const }
    : null

  let longest: PoolReport['longest'] = null
  for (const n of complete)
    if (!longest || n.pity > longest.pity) longest = { pity: n.pity, open: false, plate: n.plate }
  if (open && (!longest || open.pity > longest.pity))
    longest = { pity: open.pity, open: true, plate: open.plate }

  const record = { won: 0, lost: 0, promised: 0, unknown: 0 }
  if (hasFeatured) for (const n of complete) record[n.coin ?? 'unknown']++

  const last = nights.at(-1)
  let afterLoss: PoolReport['afterLoss'] = null
  if (hasFeatured && pr.guaranteeAfterLoss && last?.outcome === 'standard') {
    const c = open?.pity ?? 0
    const left = 1 - cdfAt(dist, c)
    const remaining = (q: number) => {
      for (let j = 1; c + j <= dist.cdf.length; j++)
        if ((cdfAt(dist, c + j) - cdfAt(dist, c)) / left >= q - 1e-12) return j
      return dist.cdf.length - c
    }
    afterLoss = { pity: c, median: remaining(0.5), p90: remaining(0.9) }
  }

  return {
    game: rules.game,
    pool,
    model,
    dist,
    catalogue: catalogueDist(model),
    band: [bandLo, bandHi],
    nights,
    open,
    complete,
    meanPity,
    percentile,
    longest,
    record,
    lucky: {
      firstLight: complete.filter((n) => n.pity === 1).length,
      early: complete.filter((n) => n.pity <= EARLY_MAX).length,
      odds: {
        firstLight: Math.round(1 / cdfAt(dist, 1)),
        early: Math.round(1 / cdfAt(dist, EARLY_MAX)),
      },
    },
    afterLoss,
    modelMean: mean(dist),
    modelMedian: quantile(dist, 0.5),
  }
}

/** Chance a night has ended by each pull: measured, catalogue, and still clouded out (board V5CNight). */
export function almanac(r: PoolReport, ks?: number[]) {
  const list = ks ?? [30, 60, r.band[0], r.band[0] + 4, r.band[0] + 6, r.band[1], r.model.hardPity]
  return list.map((k) => ({
    k,
    measured: cdfAt(r.dist, k),
    catalogue: cdfAt(r.catalogue, k),
    clouded: 1 - cdfAt(r.dist, k),
  }))
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test packages/core/test/report/nights.test.ts`

Expected: PASS (9 tests). The percentile test checks the exact answer against 20,000 seeded simulated accounts.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/report/nights.ts packages/core/test/fixtures/report.ts packages/core/test/report/nights.test.ts
git commit -m "feat(core): PityCheck nights, percentile, lucky stars and after-a-loss block"
```


### Task 5: Clouded out: the Dry List

**Files:**
- Create: `packages/core/src/report/clouded.ts`
- Test: `packages/core/test/report/clouded.test.ts`

**Interfaces:**
- Consumes: `PoolReport`, `Night` (Task 4); `cdfAt`, `quantile`, `Dist` (Task 3).
- Produces:
  - `type Wait = { nights, bannerId, total, open, status: 'ok' | 'unknown-start' | 'rules-need-update', longerThan }`
  - `type Clouded = { waits, longest, dist, quartiles, basis: 'simulated' }`
  - `waitDist(night: Dist, winRate): Dist`, `cloudedOut(report, rules): Clouded | null`

Every wait for a featured star, set against simulated observers starting from a fresh 50/50 (ruling R7). The board's own numbers are the expectations: waits 76, 81, 140, 74, 85, 86, 77, 155 and an open 37; quartiles 75 / 80 / 135; the 155 wait "longer than 88% of observers".

- [ ] **Step 1: Write the failing tests**

`packages/core/test/report/clouded.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cloudedOut, waitDist } from '../../src/report/clouded.ts'
import { cdfAt, modelDist, PUBLIC_MODEL } from '../../src/report/model.ts'
import { pityCheck } from '../../src/report/nights.ts'
import { mkPulls, streakOf } from '../fixtures/pulls.ts'
import { boardPulls } from '../fixtures/report.ts'
import { fixtureRules as rules, STANDARD } from '../fixtures/rules.ts'

const clouded = (...a: Parameters<typeof boardPulls>) =>
  cloudedOut(pityCheck(boardPulls(...a), rules)[0]!, rules)!

test('waits group a lost night with its promised star, as on the board', () => {
  const c = clouded()
  assert.deepEqual(
    c.waits.map((w) => [w.nights.map((n) => n.pity), w.total, w.open]),
    [
      [[76], 76, false],
      [[81], 81, false],
      [[62, 78], 140, false],
      [[74], 74, false],
      [[85], 85, false],
      [[79, 7], 86, false],
      [[77], 77, false],
      [[80, 75], 155, false],
      [[], 37, true],
    ],
  )
  assert.equal(c.longest!.total, 155)
  assert.deepEqual(c.quartiles, [75, 80, 135])
  assert.equal(c.basis, 'simulated')
})

test('longer-than shares: strictly shorter waits for a closed wait, at most as long for an open one', () => {
  const c = clouded()
  const w155 = c.waits[7]!
  assert.ok(Math.abs(w155.longerThan! - cdfAt(c.dist, 154)) < 1e-12)
  assert.equal(Math.round(w155.longerThan! * 100), 88) // board: "Longer than 88% of observers"
  const open = c.waits.at(-1)!
  assert.ok(Math.abs(open.longerThan! - cdfAt(c.dist, 37)) < 1e-12)
})

test('a wait still going after a lost 50/50 keeps the lost night', () => {
  const c = clouded([76, 62], [1, 0], 37)
  const open = c.waits.at(-1)!
  assert.deepEqual([open.nights.map((n) => n.pity), open.total, open.open], [[62], 99, true])
})

test('a wait that began before the history has no comparison', () => {
  // First (truncated) night lost: the promised star's wait started before the import.
  const pulls = mkPulls('character-event', [
    ...streakOf(29, STANDARD[0]!),
    ...streakOf(49, '10000089'),
    ...streakOf(59, '10000089'),
  ])
  const c = cloudedOut(pityCheck(pulls, rules)[0]!, rules)!
  assert.deepEqual(
    c.waits.map((w) => [w.total, w.status, w.longerThan === null]),
    [
      [50, 'unknown-start', true],
      [60, 'ok', false],
    ],
  )
})

test('an unknown 5★ pauses its wait and the next one', () => {
  const pulls = mkPulls('character-event', [
    ...streakOf(29, '10000089'),
    ...streakOf(49, '10009999'),
    ...streakOf(59, '10000089'),
  ])
  const c = cloudedOut(pityCheck(pulls, rules)[0]!, rules)!
  assert.deepEqual(
    c.waits.map((w) => w.status),
    ['rules-need-update', 'unknown-start'],
  )
})

test('the wait distribution has two humps and sums to one', () => {
  const d = waitDist(modelDist(PUBLIC_MODEL['character-event']!), 0.5)
  assert.ok(Math.abs(cdfAt(d, 180) - 1) < 1e-12)
  // Every won coin ends within one night (half the waits), plus two quick nights after a lost one.
  assert.ok(cdfAt(d, 90) > 0.5 && cdfAt(d, 90) < 0.65)
  // Humps near 76 and near 150, a trough between.
  assert.ok(d.pmf[75]! > 3 * d.pmf[114]! && d.pmf[149]! > 2 * d.pmf[114]!)
})

test('pools without a plain 50/50 have no Dry List', () => {
  const weapon = pityCheck(mkPulls('weapon-event', streakOf(59, '11513')), rules)[0]!
  assert.equal(cloudedOut(weapon, rules), null)
  const standard = pityCheck(mkPulls('standard', streakOf(59, STANDARD[0]!)), rules)[0]!
  assert.equal(cloudedOut(standard, rules), null)
})
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test packages/core/test/report/clouded.test.ts`

Expected: FAIL: `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the Dry List**

`packages/core/src/report/clouded.ts`:

```ts
// "Clouded out", the Dry List (spec section 7, board V6Clouded): every wait for a featured star.
import { poolRules } from '../rules/load.ts'
import type { Rules } from '../rules/schema.ts'
import { cdfAt, type Dist, quantile } from './model.ts'
import type { Night, PoolReport } from './nights.ts'

export type Wait = {
  nights: Night[]
  /** Banner of the star that ended the wait; for a wait still going, of its latest night. */
  bannerId: string | null
  /** Pulls from the first pull after the previous featured star to the featured star itself (or so far). */
  total: number
  /** Still dry: no featured star yet. */
  open: boolean
  /**
   * 'unknown-start': began before the history or after an unknown 5★, so its length is a lower bound.
   * 'rules-need-update': ended on a 5★ the registry doesn't know yet (spec section 9).
   */
  status: 'ok' | 'unknown-start' | 'rules-need-update'
  /** Share of observers whose wait was shorter ("longer than X% of observers"); null unless status is ok. */
  longerThan: number | null
}

export type Clouded = {
  waits: Wait[]
  /** The longest finished wait with a known start. */
  longest: Wait | null
  /** Pulls-to-featured distribution from a fresh 50/50 (index t - 1), up to two nights. */
  dist: Dist
  quartiles: [number, number, number]
  basis: 'simulated'
}

/** Pulls to a featured star from a fresh 50/50: one night if the coin is won, two if it is lost. */
export function waitDist(night: Dist, winRate: number): Dist {
  const n = night.pmf.length
  const pmf = new Array<number>(2 * n).fill(0)
  for (let a = 1; a <= n; a++) {
    const pa = night.pmf[a - 1] as number
    pmf[a - 1]! += winRate * pa
    for (let b = 1; b <= n; b++)
      pmf[a + b - 1]! += (1 - winRate) * pa * (night.pmf[b - 1] as number)
  }
  let total = 0
  return { pmf, cdf: pmf.map((p) => (total += p)) }
}

/** The Dry List, or null for pools without a 50/50 (or with a chart path, where the target can't be known). */
export function cloudedOut(r: PoolReport, rules: Rules): Clouded | null {
  const pr = poolRules(rules, r.pool)
  if (!pr.featuredRate || !pr.guaranteeAfterLoss || pr.chartPath) return null
  const dist = waitDist(r.dist, pr.featuredRate.value)

  const waits: Wait[] = []
  let cur: Night[] = []
  let startKnown = false
  const close = (status: Wait['status'], open: boolean, extra = 0) => {
    const total = cur.reduce((a, n) => a + n.pity, 0) + extra
    const ok = status === 'ok'
    waits.push({
      nights: cur,
      bannerId: cur.at(-1)?.bannerId ?? null,
      total,
      open,
      status,
      longerThan: !ok ? null : open ? cdfAt(dist, total) : cdfAt(dist, total - 1),
    })
    cur = []
  }
  for (const night of r.nights) {
    if (night.truncated) {
      // Only a featured first star tells us the next wait starts fresh.
      startKnown = night.outcome === 'featured'
      continue
    }
    cur.push(night)
    if (night.outcome === 'featured') {
      close(startKnown ? 'ok' : 'unknown-start', false)
      startKnown = true
    } else if (night.outcome === 'unknown') {
      close('rules-need-update', false)
      startKnown = false
    }
    // A lost 50/50 keeps the wait going: the promised star ends it.
  }
  if (cur.length > 0 || r.open) close(startKnown ? 'ok' : 'unknown-start', true, r.open?.pity ?? 0)

  let longest: Wait | null = null
  for (const w of waits)
    if (w.status === 'ok' && !w.open && (!longest || w.total > longest.total)) longest = w
  return {
    waits,
    longest,
    dist,
    quartiles: [quantile(dist, 0.25), quantile(dist, 0.5), quantile(dist, 0.75)],
    basis: 'simulated',
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test packages/core/test/report/clouded.test.ts`

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/report/clouded.ts packages/core/test/report/clouded.test.ts
git commit -m "feat(core): Clouded out, the Dry List"
```


### Task 6: The omen check

**Files:**
- Create: `packages/core/src/report/omen.ts`
- Test: `packages/core/test/report/omen.test.ts`

**Interfaces:**
- Consumes: `PoolReport` (Task 4), `mulberry32` (`src/stats/prng.ts`), `METHOD_SEED` (`src/tests/definitions.ts`).
- Produces: `type Omen` (nights, flips, lost, meanPity, modelMean, skies, hits: `Uint8Array`, meanHits, lossHits, pMean, pLost), `omenCheck(report, rules, skies?)`, `OMEN_SKIES`, `OMEN_SEED`.

Per pool, two shares from 10,000 seeded skies, never combined and never a yes or no (ruling R4). `hits` keeps one byte per sky, so the site can draw the board's 100 × 100 plates. The tests check the simulated shares against exact answers.

- [ ] **Step 1: Write the failing tests**

`packages/core/test/report/omen.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pityCheck } from '../../src/report/nights.ts'
import { omenCheck } from '../../src/report/omen.ts'
import { binomCdf } from '../../src/stats/binom.ts'
import { boardPulls } from '../fixtures/report.ts'
import { fixtureRules as rules } from '../fixtures/rules.ts'

const report = pityCheck(boardPulls(), rules)[0]!

test('the board sample: 11 nights, 8 coin flips, 3 lost', () => {
  const o = omenCheck(report, rules)!
  assert.deepEqual([o.nights, o.flips, o.lost], [11, 8, 3])
  assert.equal(Math.round(o.meanPity * 10) / 10, 70.4)
  assert.equal(Math.round(o.modelMean * 10) / 10, 62.3)
  assert.equal(o.hits.length, 10_000)
  assert.equal(
    o.meanHits + o.lossHits,
    o.hits.reduce((a, h) => a + (h & 1) + ((h >> 1) & 1), 0),
  )
})

test('same seed, same numbers; and the shares match exact answers', () => {
  const a = omenCheck(report, rules)!
  const b = omenCheck(report, rules)!
  assert.deepEqual(a.hits, b.hits)
  // At least 3 losses in 8 fair flips: 1 - P(X <= 2).
  assert.ok(Math.abs(a.pLost - (1 - binomCdf(2, 8, 0.5))) < 0.015)
  // At least as long an average night: same tail as the percentile, ties included.
  assert.ok(Math.abs(a.pMean - report.percentile!.value) < 0.015)
})

test('no complete nights, no omen check', () => {
  assert.equal(omenCheck(pityCheck(boardPulls([], [], 20), rules)[0]!, rules), null)
})
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test packages/core/test/report/omen.test.ts`

Expected: FAIL: `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the omen check**

`packages/core/src/report/omen.ts`:

```ts
// The omen check (spec section 7, board V6Omen): how unusual your record is, never a yes or no.
import { poolRules } from '../rules/load.ts'
import type { Rules } from '../rules/schema.ts'
import { mulberry32 } from '../stats/prng.ts'
import { METHOD_SEED } from '../tests/definitions.ts'
import type { PoolReport } from './nights.ts'

export const OMEN_SKIES = 10_000
/** The board promises this seed: "Use a fixed seed, 20261009, so anyone can rerun it and get the same numbers." */
export const OMEN_SEED = METHOD_SEED

export type Omen = {
  nights: number
  /** Real 50/50s: won or lost, not promised. */
  flips: number
  lost: number
  meanPity: number
  modelMean: number
  skies: number
  /** Per simulated sky: bit 1 = an average night at least this long, bit 2 = at least this many losses. */
  hits: Uint8Array
  meanHits: number
  lossHits: number
  /** Share of skies at least this unlucky: mean pity, and 50/50 losses (at the disclosed 50/50 rate). */
  pMean: number
  pLost: number
}

/** Simulate `skies` accounts with the same number of nights and coin flips. Same seed, same numbers. */
export function omenCheck(r: PoolReport, rules: Rules, skies = OMEN_SKIES): Omen | null {
  const k = r.complete.length
  if (k === 0) return null
  const sum = r.complete.reduce((a, n) => a + n.pity, 0)
  const flips = r.complete.filter((n) => n.coin === 'won' || n.coin === 'lost').length
  const lost = r.complete.filter((n) => n.coin === 'lost').length
  const win = poolRules(rules, r.pool).featuredRate?.value ?? 0.5
  const cdf = r.dist.cdf
  const draw = (u: number) => {
    let lo = 0
    let hi = cdf.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if ((cdf[mid] as number) >= u) hi = mid
      else lo = mid + 1
    }
    return lo + 1
  }

  const rand = mulberry32(OMEN_SEED)
  const hits = new Uint8Array(skies)
  let meanHits = 0
  let lossHits = 0
  for (let i = 0; i < skies; i++) {
    let s = 0
    for (let j = 0; j < k; j++) s += draw(rand())
    let l = 0
    for (let j = 0; j < flips; j++) if (rand() >= win) l++
    if (s >= sum) {
      hits[i]! |= 1
      meanHits++
    }
    if (l >= lost) {
      hits[i]! |= 2
      lossHits++
    }
  }
  return {
    nights: k,
    flips,
    lost,
    meanPity: sum / k,
    modelMean: r.modelMean,
    skies,
    hits,
    meanHits,
    lossHits,
    pMean: meanHits / skies,
    pLost: lossHits / skies,
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test packages/core/test/report/omen.test.ts`

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/report/omen.ts packages/core/test/report/omen.test.ts
git commit -m "feat(core): the omen check"
```


### Task 7: The sky card: summary schema and front SVG

**Files:**
- Create: `packages/core/src/card/summary.ts`, `packages/core/src/card/sky.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/card/sky.test.ts`

**Interfaces:**
- Consumes: `PoolReport` (Task 4), the model helpers (Task 3), `mulberry32`, `METHOD_VERSION`.
- Produces:
  - `CardSummary` (valibot schema and type), `cardSummary(report): CardSummary | null`
  - `cardVariant(summary): { kind: 'standard' | 'early' | 'firstlight'; night: number | null }`
  - `pityLines(pities): [string, string]`, `skyCardSvg(summary): string` (1200×630)
  - `@pull-census/core` now also exports every `report/*` and `card/*` module

The board V6SkyCard front, ported to a pure SVG string: the API renders it to PNG with resvg, and the site (Plan 2B) shows the same markup (rulings R6, R11, R12, R16). The summary is strict (R17): anything extra is refused, so nothing can ride along into a shared link. The fonts are Task 11; the rendered result was checked by eye during planning for all three variants and a 60-night card.

- [ ] **Step 1: Write the failing tests**

`packages/core/test/card/sky.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as v from 'valibot'
import { cardVariant, pityLines, skyCardSvg } from '../../src/card/sky.ts'
import { CardSummary, cardSummary } from '../../src/card/summary.ts'
import { pityCheck } from '../../src/report/nights.ts'
import { boardPulls, SAMPLE_PITIES, SAMPLE_WON } from '../fixtures/report.ts'
import { fixtureRules as rules } from '../fixtures/rules.ts'

const summaryOf = (pities = SAMPLE_PITIES, won = SAMPLE_WON) =>
  cardSummary(pityCheck(boardPulls(pities, won), rules)[0]!)!

test('the summary holds the complete nights, their 50/50s and nothing that identifies anyone', () => {
  const s = summaryOf()
  assert.deepEqual(Object.keys(s).sort(), [
    'basis',
    'firstPlate',
    'game',
    'method',
    'nights',
    'percentile',
    'pool',
    'v',
  ])
  assert.deepEqual(
    s.nights.map((n) => n.p),
    SAMPLE_PITIES,
  )
  assert.deepEqual(
    s.nights.map((n) => n.c),
    ['won', 'won', 'lost', 'promised', 'won', 'won', 'lost', 'promised', 'won', 'lost', 'promised'],
  )
  assert.equal(s.firstPlate, 2) // night 1 began before the history
  assert.ok(v.is(CardSummary, s))
})

test('no finished night, no card', () => {
  assert.equal(cardSummary(pityCheck(boardPulls([], [], 20), rules)[0]!), null)
})

test('the schema refuses extra fields, impossible pities and empty skies', () => {
  const s = summaryOf()
  assert.ok(!v.is(CardSummary, { ...s, uid: '812345678' }))
  assert.ok(!v.is(CardSummary, { ...s, nights: [{ p: 91, c: null }] }))
  assert.ok(!v.is(CardSummary, { ...s, nights: [{ p: 50, c: null, time: 'x' }] }))
  assert.ok(!v.is(CardSummary, { ...s, nights: [] }))
  assert.ok(v.is(CardSummary, { ...s, pool: 'weapon-event', nights: [{ p: 80, c: null }] }))
  assert.ok(!v.is(CardSummary, { ...s, pool: 'weapon-event', nights: [{ p: 81, c: null }] }))
})

test('the sky picks the card: First Light, else the latest early star, else standard', () => {
  assert.deepEqual(cardVariant(summaryOf()), { kind: 'early', night: 7 })
  const fl = summaryOf([1, 7, 80], [1, 1, 1])
  assert.deepEqual(cardVariant(fl), { kind: 'firstlight', night: 0 })
  assert.deepEqual(cardVariant(summaryOf([70, 80], [1, 1])), { kind: 'standard', night: null })
})

test('the card front carries the board text, says simulated, and is deterministic', () => {
  const s = summaryOf()
  const svg = skyCardSvg(s)
  for (const text of [
    '5★ PULLS, IN ORDER',
    'SKY CARD · GENSHIN IMPACT',
    'character banner · 11 nights',
    'An early star.',
    'pull 7 · about 1 in 17',
    'rare, not earned.',
    'of simulated skies waited longer.',
    '>8 of 11<',
    'Plates GI·C·0002–0012 · methods-v1',
    'SEEING · SIMULATED',
    'astronomy, not astrology.',
  ])
    assert.ok(svg.includes(text), text)
  assert.equal(skyCardSvg(s), svg)
  assert.ok(!svg.includes('of the census'))
  assert.ok(skyCardSvg({ ...s, basis: 'census' }).includes('of the census'))
})

test('the pity list wraps to two lines and keeps the latest nights', () => {
  const short = pityLines([76, 81, 62])
  assert.deepEqual(short, ['76 · 81 · 62', ''])
  const many = Array.from({ length: 60 }, (_, i) => 10 + i)
  const [a, b] = pityLines(many)
  assert.ok(a.startsWith('… ') && a.length <= 56 && b.length <= 56, `${a} | ${b}`)
  assert.ok(b.endsWith('69'))
})
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test packages/core/test/card/`

Expected: FAIL: `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the summary and the card**

`packages/core/src/card/summary.ts`:

```ts
import * as v from 'valibot'
import { PUBLIC_MODEL } from '../report/model.ts'
import type { PoolReport } from '../report/nights.ts'
import { METHOD_VERSION } from '../tests/definitions.ts'

/**
 * Everything a shared card holds (spec section 12): no UID, no times, no ids. The server renders the PNG from
 * this alone, so it carries each night's 50/50 result too (filled or hollow star).
 */
export const CardSummary = v.pipe(
  // Strict: a card stores exactly these fields, so nothing else can ride along into a shared link.
  v.strictObject({
    v: v.literal(1),
    game: v.literal('genshin'),
    pool: v.picklist(['character-event', 'weapon-event', 'standard', 'chronicled']),
    /** Complete nights in order: pity, and the 50/50 (null when unknown or the pool has none). */
    nights: v.pipe(
      v.array(
        v.strictObject({
          p: v.pipe(v.number(), v.integer(), v.minValue(1)),
          c: v.nullable(v.picklist(['won', 'lost', 'promised'])),
        }),
      ),
      v.minLength(1),
      v.maxLength(500),
    ),
    /** Share of the reference that waited longer. */
    percentile: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
    basis: v.picklist(['simulated', 'census']),
    /** Plate serial of the first complete night. */
    firstPlate: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(9999)),
    method: v.pipe(v.string(), v.regex(/^methods-v\d+$/)),
  }),
  v.check(
    (s) => s.nights.every((n) => n.p <= (PUBLIC_MODEL[s.pool]?.hardPity ?? 0)),
    'pity above hard pity',
  ),
)
export type CardSummary = v.InferOutput<typeof CardSummary>

/** The card for a pool report, or null when it has no complete night yet. */
export function cardSummary(r: PoolReport): CardSummary | null {
  if (r.complete.length === 0 || !r.percentile) return null
  return {
    v: 1,
    game: 'genshin',
    pool: r.pool as CardSummary['pool'],
    nights: r.complete.map((n) => ({ p: n.pity, c: n.coin })),
    percentile: r.percentile.value,
    basis: r.percentile.basis,
    firstPlate: r.complete[0]!.n,
    method: METHOD_VERSION,
  }
}
```

`packages/core/src/card/sky.ts`:

```ts
// The sky card front, 1200×630 (spec section 12, board V6SkyCard). A pure SVG string: the API renders it to PNG
// with resvg, and the site shows the same markup. Postcard colours in every theme: the card is a picture.

import { plate } from '../report/format.ts'
import { band, cdfAt, modelDist, PUBLIC_MODEL } from '../report/model.ts'
import { EARLY_MAX, starSize } from '../report/nights.ts'
import { mulberry32 } from '../stats/prng.ts'
import type { CardSummary } from './summary.ts'

const C = {
  paper: '#F7F8F4',
  grid: '#E3E7EC',
  ink: '#1B2335',
  ink2: '#3B465C',
  muted: '#5A6578',
  meas: '#8C5A00',
  frame: '#FCFCFA',
  frameEdge: '#E3E6E0',
  shadow: '#1B2335',
  dot: '#F4E6C8',
  star: '#F2B544',
  pencil: '#F2D9A0',
  stamp: '#A8322B',
  tape: 'rgba(226, 214, 170, 0.75)',
}
const SERIF = 'Bodoni Moda, serif'
const MONO = 'Martian Mono, monospace'
const HAND = 'Shantell Sans, cursive'
const POOL_LABEL: Record<CardSummary['pool'], string> = {
  'character-event': 'character banner',
  'weapon-event': 'weapon banner',
  standard: 'standard wish',
  chronicled: 'chronicled wish',
}
/** Characters per line of the pity list: Martian Mono 18 is about 12.6 px a character, x 74 to x 800. */
const LIST_CHARS = 56

// The print: a 1000-wide plate mapping (as on the report), scaled into the photo window.
const PX = 74
const PY = 82
const PW = 724
const PH = 318.6

const f1 = (n: number) => n.toFixed(1)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const dot = (x: number, y: number, r: number) =>
  `M${f1(x - r)} ${f1(y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`
function star(cx: number, cy: number, R: number, n: number, ir: number): string {
  let d = ''
  for (let j = 0; j < 2 * n; j++) {
    const a = -Math.PI / 2 + (j * Math.PI) / n
    const r = j % 2 ? R * ir : R
    d += `${j ? 'L' : 'M'}${f1(cx + r * Math.cos(a))} ${f1(cy + r * Math.sin(a))}`
  }
  return `${d}Z`
}
/** "<1%" and ">99%" keep the headline numeral short. */
const bigPct = (p: number) => (p < 0.01 ? '<1%' : p > 0.99 ? '>99%' : `${Math.round(p * 100)}%`)

/** Which card a sky gets: First Light if any night ended on pull 1, else an early star, else standard. */
export function cardVariant(s: CardSummary): {
  kind: 'standard' | 'early' | 'firstlight'
  night: number | null
} {
  const last = (test: (p: number) => boolean) => s.nights.findLastIndex((n) => test(n.p))
  const fl = last((p) => p === 1)
  if (fl >= 0) return { kind: 'firstlight', night: fl }
  const early = last((p) => p <= EARLY_MAX)
  if (early >= 0) return { kind: 'early', night: early }
  return { kind: 'standard', night: null }
}

/** The pity list, wrapped to two lines; longer histories keep their latest nights. */
export function pityLines(pities: number[]): [string, string] {
  const fits = (xs: number[]) => xs.join(' · ').length
  let shown = pities
  let lead = ''
  while (fits(shown) + lead.length > 2 * LIST_CHARS - 4) {
    shown = shown.slice(1)
    lead = '… '
  }
  const parts = shown.map(String)
  let first = lead
  let i = 0
  while (i < parts.length && (first + (i ? ' · ' : '') + parts[i]).length <= LIST_CHARS) {
    first += (i ? ' · ' : '') + parts[i]
    i++
  }
  const rest = parts.slice(i).join(' · ')
  return [first, rest ? `· ${rest}` : '']
}

export function skyCardSvg(s: CardSummary): string {
  const model = PUBLIC_MODEL[s.pool]!
  const d = modelDist(model)
  const hard = model.hardPity
  const X = (k: number) => PX + ((20 + ((k - 0.5) / hard) * 960) / 1000) * PW
  const [b0, b1] = band(model)

  // Census field: 800 nights drawn from the model, seed 13 as on the board.
  const rand = mulberry32(13)
  let field = ''
  for (let i = 0; i < 800; i++) {
    const u = rand()
    const k = d.cdf.findIndex((c) => c >= u) + 1 || hard
    field += dot(
      X(k) + (rand() - 0.5) * 6.5,
      PY + 8 + rand() * (PH - 16),
      rand() < 0.88 ? 0.8 : 1.4,
    )
  }

  // Stars: x by pity, y scattered by pity rank (golden ratio), size by rarity early or late.
  const rank = new Map(
    s.nights
      .map((n, i) => ({ p: n.p, i }))
      .sort((a, b) => a.p - b.p || a.i - b.i)
      .map((x, r) => [x.i, r]),
  )
  const variant = cardVariant(s)
  let filled = ''
  let hollow = ''
  let halo = ''
  let spikes = ''
  let first = ''
  let firstHalo = ''
  let focus: { cx: number; cy: number; R: number } | null = null
  s.nights.forEach((n, i) => {
    const r = Math.min(cdfAt(d, n.p), 1 - cdfAt(d, n.p - 1))
    const R = starSize(r) * 0.39
    const cx = X(n.p)
    const cy = PY + ((12 + ((0.5 + (rank.get(i) as number) * 0.618034) % 1) * 76) / 100) * PH
    if (n.p === 1) {
      first += star(cx, cy, R * 1.25, 8, 0.4)
      firstHalo += dot(cx, cy, Number(f1(R * 2.3)))
    } else if (n.c === 'lost') hollow += star(cx, cy, R, 5, 0.45)
    else filled += star(cx, cy, R, 5, 0.45)
    if (n.p > 1 && n.p <= EARLY_MAX) {
      halo += dot(cx, cy, Number(f1(R * 1.9)))
      const a = R * 2.2
      const b = R * 3
      spikes += `M${f1(cx)} ${f1(cy - a)}V${f1(cy - b)}M${f1(cx)} ${f1(cy + a)}V${f1(cy + b)}M${f1(cx - a)} ${f1(cy)}H${f1(cx - b)}M${f1(cx + a)} ${f1(cy)}H${f1(cx + b)}`
    }
    if (i === variant.night) focus = { cx, cy, R: n.p === 1 ? R * 2.3 : R * 3 }
  })

  let pencil = ''
  if (focus) {
    const { cx, cy, R } = focus as { cx: number; cy: number; R: number }
    const ex = cx + R + 6
    const ey = cy - 4
    const sx = ex + 40
    const sy = cy - 40
    pencil =
      `<path d="M${f1(sx)} ${f1(sy)}Q${f1(sx - 4)} ${f1(ey - 2)} ${f1(ex)} ${f1(ey)}M${f1(ex)} ${f1(ey)}l10 -5M${f1(ex)} ${f1(ey)}l8 7" fill="none" stroke="${C.pencil}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<text x="${f1(sx + 6)}" y="${f1(sy - 6)}" font-family="${HAND}" font-size="22" fill="${C.pencil}">${variant.kind === 'firstlight' ? 'first light' : 'early star'}</text>`
  }

  const nights = s.nights.length
  const featured = s.nights.filter((n) => n.c === 'won' || n.c === 'promised').length
  const early = s.nights.filter((n) => n.p <= EARLY_MAX).length
  const longest = Math.max(...s.nights.map((n) => n.p))
  const who = s.basis === 'census' ? 'of the census' : 'of simulated skies'
  const big = bigPct(s.percentile)
  const [line1, line2] = pityLines(s.nights.map((n) => n.p))
  const seeing = s.basis === 'census' ? 'SEEING · CENSUS' : 'SEEING · SIMULATED'
  // Mono 600 at 12 px with 1.6 letter-spacing; the box keeps its right edge inside the photo frame.
  const stampW = seeing.length * 10.6 + 16
  const plates = `Plates ${plate(s.game, s.pool, s.firstPlate)}–${String(s.firstPlate + nights - 1).padStart(4, '0')} · ${s.method}`

  let headline: string
  if (variant.kind === 'standard') {
    headline =
      // "<1%" and ">99%" are a character wider: a smaller size keeps them inside the card.
      `<text x="852" y="300" font-family="${SERIF}" font-weight="600" font-size="${big.length > 3 ? 100 : 128}" fill="${C.meas}">${esc(big)}</text>` +
      `<text x="860" y="340" font-family="${SERIF}" font-style="italic" font-size="27" fill="${C.ink}">${who}</text>` +
      `<text x="860" y="372" font-family="${SERIF}" font-style="italic" font-size="27" fill="${C.ink}">waited longer.</text>`
  } else {
    const fl = variant.kind === 'firstlight'
    const p = s.nights[variant.night as number]!.p
    const odds = Math.round(1 / cdfAt(d, fl ? 1 : EARLY_MAX))
    headline =
      `<text x="860" y="250" font-family="${SERIF}" font-style="italic" font-weight="600" font-size="46" fill="${C.meas}">${fl ? 'First Light.' : 'An early star.'}</text>` +
      `<text x="860" y="288" font-family="${MONO}" font-size="17" fill="${C.ink}">pull ${p} · about 1 in ${odds}</text>` +
      `<text x="860" y="316" font-family="${MONO}" font-size="17" fill="${C.muted}">rare, not earned.</text>` +
      `<text x="860" y="366" font-family="${SERIF}" font-style="italic" font-size="20" fill="${C.ink}"><tspan font-weight="600" fill="${C.meas}">${esc(big)}</tspan> ${who} waited longer.</text>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2E3F63"/><stop offset="0.45" stop-color="#1A263D"/><stop offset="0.8" stop-color="#0B111C"/><stop offset="1" stop-color="#06080C"/></linearGradient>
<pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="${C.grid}" stroke-width="1"/></pattern>
</defs>
<rect width="1200" height="630" fill="${C.paper}"/>
<rect width="1200" height="630" fill="url(#grid)"/>
<g transform="rotate(-1 436 260)">
<rect x="66" y="76" width="752" height="385" fill="${C.shadow}" fill-opacity="0.14"/>
<rect x="60" y="68" width="752" height="385" fill="${C.frame}" stroke="${C.frameEdge}" stroke-width="1"/>
<rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" fill="url(#sky)"/>
<rect x="${f1(X(b0) - 3.8)}" y="${PY}" width="${f1(X(b1) - X(b0) + 7.6)}" height="${PH}" fill="${C.star}" fill-opacity="0.09"/>
<path d="${field}" fill="${C.dot}" fill-opacity="0.85"/>
<path d="${firstHalo}" fill="${C.star}" fill-opacity="0.14" stroke="${C.star}" stroke-opacity="0.55" stroke-width="1.2"/>
<path d="${halo}" fill="none" stroke="${C.star}" stroke-opacity="0.8" stroke-width="1.3" stroke-dasharray="3 4"/>
<path d="${spikes}" fill="none" stroke="${C.star}" stroke-width="1.4" stroke-linecap="round"/>
<path d="${filled}" fill="${C.star}" stroke="${C.star}" stroke-width="1.6" stroke-linejoin="round"/>
<path d="${hollow}" fill="none" stroke="${C.star}" stroke-width="2" stroke-linejoin="round"/>
<path d="${first}" fill="${C.star}" stroke="${C.star}" stroke-width="1.2" stroke-linejoin="round"/>
${pencil}
<text x="86" y="437" font-family="${HAND}" font-size="20" fill="${C.ink2}">dusk → midnight · the milky way</text>
<g transform="rotate(-3 ${f1(798 - stampW / 2)} 428)"><rect x="${f1(798 - stampW)}" y="414" width="${f1(stampW)}" height="28" rx="4" fill="none" stroke="${C.stamp}" stroke-width="2.4"/><text x="${f1(798 - stampW / 2)}" y="433" text-anchor="middle" font-family="${MONO}" font-size="12" font-weight="600" letter-spacing="1.6" fill="${C.stamp}">${seeing}</text></g>
</g>
<rect x="96" y="50" width="112" height="30" fill="${C.tape}" transform="rotate(-6 152 65)"/>
<rect x="676" y="46" width="112" height="30" fill="${C.tape}" transform="rotate(5 732 61)"/>
<text x="74" y="500" font-family="${MONO}" font-size="13" letter-spacing="1.2" fill="${C.muted}">5★ PULLS, IN ORDER</text>
<text x="74" y="528" font-family="${MONO}" font-size="18" fill="${C.meas}">${esc(line1)}</text>
<text x="74" y="552" font-family="${MONO}" font-size="18" fill="${C.meas}">${esc(line2)}</text>
<text x="74" y="584" font-family="${MONO}" font-size="13" fill="${C.muted}">Left to right: pull 1 (dusk) to pull ${hard} (midnight). Bigger star, rarer night.</text>
<text x="860" y="112" font-family="${SERIF}" font-style="italic" font-size="34" fill="${C.ink}">Pull Census</text>
<text x="860" y="146" font-family="${MONO}" font-size="14" letter-spacing="1.4" fill="${C.muted}">SKY CARD · GENSHIN IMPACT</text>
<text x="860" y="170" font-family="${MONO}" font-size="14" fill="${C.muted}">${POOL_LABEL[s.pool]} · ${nights} ${nights === 1 ? 'night' : 'nights'}</text>
${headline}
<g font-family="${MONO}" font-size="16">
<text x="860" y="432" fill="${C.muted}">Featured</text><text x="1150" y="432" text-anchor="end" fill="${C.ink}">${featured} of ${nights}</text>
<path d="M860 446H1150M860 488H1150" stroke="${C.grid}" stroke-width="1.5"/>
<text x="860" y="474" fill="${C.muted}">Early stars</text><text x="1150" y="474" text-anchor="end" fill="${C.ink}">${early}</text>
<text x="860" y="516" fill="${C.muted}">Longest night</text><text x="1150" y="516" text-anchor="end" fill="${C.meas}">${longest}</text>
</g>
<text x="860" y="574" font-family="${MONO}" font-size="13" fill="${C.muted}">${esc(plates)}</text>
<text x="860" y="604" font-family="${HAND}" font-size="19" fill="${C.ink2}">astronomy, not astrology.</text>
</svg>`
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test packages/core/test/card/`

Expected: PASS (6 tests).

- [ ] **Step 5: Export the report and card modules**

In `packages/core/src/index.ts`, replace:

```ts
export * from './ids.ts'
```

with:

```ts
export * from './card/sky.ts'
export * from './card/summary.ts'
export * from './ids.ts'
```

In `packages/core/src/index.ts`, replace:

```ts
export * from './parse/uigf.ts'
```

with:

```ts
export * from './parse/uigf.ts'
export * from './report/clouded.ts'
export * from './report/format.ts'
export * from './report/model.ts'
export * from './report/nights.ts'
export * from './report/omen.ts'
```

Run: `npm test`

Expected: PASS: every core test.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/card packages/core/test/card packages/core/src/index.ts
git commit -m "feat(core): sky card summary and front SVG"
```


### Task 8: API scaffold: workspace, environment, limits, queue, database

**Files:**
- Modify: `package.json` (workspaces, test glob, typecheck), `biome.json` (skip the vendored dictionary)
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/LICENSE` (AGPL-3.0)
- Create: `rules/dict/genshin-en.json` (vendored UIGF dictionary)
- Create: `apps/api/src/env.ts`, `apps/api/src/limits.ts`, `apps/api/src/queue.ts`, `apps/api/src/db.ts`
- Test: `apps/api/test/env.test.ts`, `apps/api/test/limits.test.ts`

**Interfaces:**
- Produces:
  - `type Env = { port, dbPath, cardDir, siteOrigin, trustProxy, receiptKeys: { kid, key: Buffer }[], uidSalt: Buffer }`, `loadEnv(env)`
  - `LIMITS` (fetch 5/h, contribute 10/h, delete 10/h, share 20/h), `tokenBucket(capacity, perMs, now)`, `clientIp(c, env)`
  - `class HostQueue(gapMs, now, sleep)` with `run(host, task)`
  - `type Db`, `openDb(path)`, `transaction(db, fn)`, `findAccount`, `upsertPulls(db, accountId, pulls, verified)`, `countPulls`
  - SQLite tables `accounts` (with `uploads`), `pulls` (with `verified`), `used_tokens`, `shares`

The API is a second workspace, `@pull-census/api` (AGPL-3.0). Its schema is spec section 5 plus the rulings: pulls keep their own tier (R20) and spent tokens are remembered as hashes (R22). The item dictionary is vendored because Genshin returns no item ids; the copy tested in planning had sha256 `8e376b17…c7bb4a3a2` (372 names, 2026-10-12). A newer download is fine: tests use their own fixture dictionary.

- [ ] **Step 1: Add the workspace**

`package.json`:

```json
{
  "name": "pull-census",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "engines": {
    "node": ">=26.11"
  },
  "scripts": {
    "test": "node --test \"packages/*/test/**/*.test.ts\" \"apps/*/test/**/*.test.ts\" \"scripts/*.test.ts\"",
    "test:slow": "SLOW=1 node --test \"packages/core/test/sim/*.slow.test.ts\"",
    "typecheck": "tsc -p packages/core --noEmit && tsc -p apps/api --noEmit",
    "lint": "biome check .",
    "calibrate": "node scripts/calibrate.ts"
  },
  "devDependencies": {
    "@biomejs/biome": "2.5.15",
    "@types/node": "26.6.5",
    "fast-check": "4.10.2",
    "typescript": "7.0.2"
  }
}
```

`biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.15/schema.json",
  "files": {
    "includes": [
      "**",
      "!**/node_modules",
      "!data",
      "!**/golden.json",
      "!**/.impeccable",
      "!rules/dict"
    ]
  },
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded"
    }
  },
  "linter": {
    "rules": {
      "preset": "recommended",
      "style": {
        "noNonNullAssertion": "off"
      }
    }
  }
}
```

`apps/api/package.json`:

```json
{
  "name": "@pull-census/api",
  "version": "0.1.0",
  "private": true,
  "license": "AGPL-3.0-only",
  "type": "module",
  "scripts": {
    "start": "node --env-file-if-exists=.env src/server.ts"
  },
  "dependencies": {
    "@hono/node-server": "2.1.4",
    "@pull-census/core": "0.1.0",
    "@resvg/resvg-js": "2.6.2",
    "hono": "4.13.13",
    "valibot": "1.5.0"
  }
}
```

`apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test"]
}
```

Run:

```bash
mkdir -p apps/api/src apps/api/test rules/dict
curl -fsSL -o apps/api/LICENSE https://www.gnu.org/licenses/agpl-3.0.txt
curl -fsSL -o rules/dict/genshin-en.json https://api.uigf.org/dict/genshin/en.json
npm install
```

- [ ] **Step 2: Write the failing tests**

`apps/api/test/env.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadEnv } from '../src/env.ts'

const secret = 'S'.repeat(43)
const base = {
  SITE_ORIGIN: 'https://pullcensus.test/',
  RECEIPT_KEYS: `k2:${secret},k1:${'T'.repeat(43)}`,
  UID_SALT: secret,
}

test('the environment parses into keys, newest first', () => {
  const env = loadEnv(base)
  assert.equal(env.siteOrigin, 'https://pullcensus.test')
  assert.deepEqual(
    env.receiptKeys.map((k) => [k.kid, k.key.length]),
    [
      ['k2', 32],
      ['k1', 32],
    ],
  )
  assert.equal(env.trustProxy, false)
  assert.equal(env.port, 8787)
})

test('a bad environment names the variable, never its value', () => {
  const weak = 'short-secret'
  assert.throws(
    () => loadEnv({ ...base, UID_SALT: weak }),
    (e: Error) => e.message === 'bad environment: UID_SALT' && !e.message.includes(weak),
  )
  assert.throws(() => loadEnv({ ...base, SITE_ORIGIN: undefined }), /SITE_ORIGIN/)
})
```

`apps/api/test/limits.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { tokenBucket } from '../src/limits.ts'
import { HostQueue } from '../src/queue.ts'

test('a token bucket allows its capacity, then refills evenly', () => {
  let t = 0
  const take = tokenBucket(3, 3_000, () => t)
  assert.deepEqual([take('a'), take('a'), take('a'), take('a')], [true, true, true, false])
  assert.equal(take('b'), true) // per key
  t = 1_000
  assert.deepEqual([take('a'), take('a')], [true, false])
})

test('the host queue runs one task at a time, at least the gap apart, and survives a failure', async () => {
  let t = 0
  const starts: number[] = []
  const q = new HostQueue(
    500,
    () => t,
    async (ms) => {
      t += ms
    },
  )
  const job = (fail: boolean) => async () => {
    starts.push(t)
    t += 100
    if (fail) throw new Error('upstream')
    return t
  }
  const results = await Promise.allSettled([
    q.run('h', job(false)),
    q.run('h', job(true)),
    q.run('h', job(false)),
  ])
  assert.deepEqual(
    results.map((r) => r.status),
    ['fulfilled', 'rejected', 'fulfilled'],
  )
  assert.deepEqual(starts, [0, 600, 1200])
})
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `node --test apps/api/test/`

Expected: FAIL: `ERR_MODULE_NOT_FOUND` for `src/env.ts`.

- [ ] **Step 4: Write the modules**

`apps/api/src/env.ts`:

```ts
import * as v from 'valibot'

/** base64url, at least 32 bytes. */
const Secret = v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]{43,}$/, 'must be base64url, 32+ bytes'))

const Raw = v.object({
  PORT: v.optional(v.pipe(v.string(), v.regex(/^\d+$/)), '8787'),
  DB_PATH: v.optional(v.string(), 'data/census.db'),
  CARD_DIR: v.optional(v.string(), 'data/cards'),
  SITE_ORIGIN: v.pipe(v.string(), v.url()),
  TRUST_PROXY: v.optional(v.picklist(['0', '1']), '0'),
  /** "kid:secret,kid:secret"; the first key signs, all keys verify (rotation). */
  RECEIPT_KEYS: v.pipe(
    v.string(),
    v.regex(/^[a-z0-9]+:[A-Za-z0-9_-]{43,}(,[a-z0-9]+:[A-Za-z0-9_-]{43,})*$/),
  ),
  UID_SALT: Secret,
})

export type Env = {
  port: number
  dbPath: string
  cardDir: string
  siteOrigin: string
  /** Behind Caddy: the client IP is the first X-Forwarded-For entry. */
  trustProxy: boolean
  receiptKeys: { kid: string; key: Buffer }[]
  uidSalt: Buffer
}

export function loadEnv(env: Record<string, string | undefined>): Env {
  const r = v.safeParse(Raw, env)
  if (!r.success) {
    // Name the variables only, never their values: they are secrets.
    const names = r.issues.map((i) => i.path?.map((p) => String(p.key)).join('.')).join(', ')
    throw new Error(`bad environment: ${names}`)
  }
  const e = r.output
  return {
    port: Number(e.PORT),
    dbPath: e.DB_PATH,
    cardDir: e.CARD_DIR,
    siteOrigin: new URL(e.SITE_ORIGIN).origin,
    trustProxy: e.TRUST_PROXY === '1',
    receiptKeys: e.RECEIPT_KEYS.split(',').map((pair) => {
      const [kid, key] = pair.split(':') as [string, string]
      return { kid, key: Buffer.from(key, 'base64url') }
    }),
    uidSalt: Buffer.from(e.UID_SALT, 'base64url'),
  }
}
```

`apps/api/src/limits.ts`:

```ts
import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'
import type { Env } from './env.ts'

/** Per-IP request budgets (spec section 15). /delete shares /contribute's settings. */
export const LIMITS = {
  fetch: { capacity: 5, perMs: 3_600_000 },
  contribute: { capacity: 10, perMs: 3_600_000 },
  delete: { capacity: 10, perMs: 3_600_000 },
  share: { capacity: 20, perMs: 3_600_000 },
} as const

/**
 * Token bucket per key: `capacity` requests, refilled evenly over `perMs`.
 * ponytail: in-memory and per process; move to sqlite if the API ever runs more than one process.
 */
export function tokenBucket(capacity: number, perMs: number, now: () => number) {
  const buckets = new Map<string, { tokens: number; at: number }>()
  return (key: string): boolean => {
    const t = now()
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets)
        if (b.tokens + ((t - b.at) * capacity) / perMs >= capacity) buckets.delete(k)
    }
    const b = buckets.get(key) ?? { tokens: capacity, at: t }
    b.tokens = Math.min(capacity, b.tokens + ((t - b.at) * capacity) / perMs)
    b.at = t
    buckets.set(key, b)
    if (b.tokens < 1) return false
    b.tokens -= 1
    return true
  }
}

export function clientIp(c: Context, env: Env): string {
  if (env.trustProxy) {
    const first = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    if (first) return first
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown'
  } catch {
    return 'unknown'
  }
}
```

`apps/api/src/queue.ts`:

```ts
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
```

`apps/api/src/db.ts`:

```ts
import { DatabaseSync } from 'node:sqlite'
import type { Pull } from '@pull-census/core'

export type Db = DatabaseSync

/** Opt-in data only (spec section 5). Pulls keep their own tier: a verified upload never vouches for older self-reported rows. */
const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY,
  uid_hash TEXT NOT NULL,
  game TEXT NOT NULL,
  region TEXT,
  uid_coarse INTEGER NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('verified', 'self')),
  delete_token_hash TEXT NOT NULL UNIQUE,
  first_upload TEXT NOT NULL,
  last_upload TEXT NOT NULL,
  uploads INTEGER NOT NULL DEFAULT 1,
  UNIQUE (game, uid_hash)
);
CREATE TABLE IF NOT EXISTS pulls (
  account_id INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  pool TEXT NOT NULL,
  banner_id TEXT,
  item_id TEXT NOT NULL,
  rarity INTEGER NOT NULL,
  time TEXT NOT NULL,
  multi INTEGER NOT NULL,
  verified INTEGER NOT NULL,
  PRIMARY KEY (account_id, source_id)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS used_tokens (
  hash TEXT PRIMARY KEY,
  reason TEXT NOT NULL CHECK (reason IN ('used', 'replaced')),
  at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shares (
  code TEXT PRIMARY KEY,
  summary_json TEXT NOT NULL,
  delete_key_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`

export function openDb(path: string): Db {
  const db = new DatabaseSync(path)
  db.exec(SCHEMA)
  return db
}

export function transaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const out = fn()
    db.exec('COMMIT')
    return out
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

export type AccountRow = { id: number; tier: 'verified' | 'self'; delete_token_hash: string }

export function findAccount(db: Db, game: string, uidHash: string): AccountRow | undefined {
  return db
    .prepare('SELECT id, tier, delete_token_hash FROM accounts WHERE game = ? AND uid_hash = ?')
    .get(game, uidHash) as AccountRow | undefined
}

/** Insert pulls; a verified row replaces a self-reported row with the same id, never the reverse. Returns rows added. */
export function upsertPulls(db: Db, accountId: number, pulls: Pull[], verified: boolean): number {
  const before = countPulls(db, accountId)
  const stmt = db.prepare(`
    INSERT INTO pulls (account_id, source_id, pool, banner_id, item_id, rarity, time, multi, verified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (account_id, source_id) DO UPDATE SET
      pool = excluded.pool, banner_id = excluded.banner_id, item_id = excluded.item_id,
      rarity = excluded.rarity, time = excluded.time, multi = excluded.multi, verified = 1
    WHERE excluded.verified = 1 AND pulls.verified = 0`)
  for (const p of pulls)
    stmt.run(
      accountId,
      p.sourceId,
      p.pool,
      p.bannerId,
      p.itemId,
      p.rarity,
      p.time,
      p.multi ? 1 : 0,
      verified ? 1 : 0,
    )
  return countPulls(db, accountId) - before
}

export const countPulls = (db: Db, accountId: number) =>
  (
    db.prepare('SELECT count(*) AS n FROM pulls WHERE account_id = ?').get(accountId) as {
      n: number
    }
  ).n
```

- [ ] **Step 5: Run the tests and the checks**

Run: `node --test apps/api/test/ && npm run typecheck && npm run lint`

Expected: PASS (4 tests); typecheck and lint clean.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json biome.json apps/api rules/dict
git commit -m "feat(api): workspace, environment, limits, queue and database"
```


### Task 9: /fetch: the proxy, its queue and the receipt

**Files:**
- Create: `apps/api/src/receipt.ts`, `apps/api/src/fetch.ts`, `apps/api/src/app.ts`
- Create: `apps/api/test/fixtures.ts` (harness, scripted HoYo API)
- Test: `apps/api/test/receipt.test.ts`, `apps/api/test/fetch.test.ts`

**Interfaces:**
- Consumes: `HISTORY_API`, `historyParams`, `parseHoyoPage`, `HoyoApiError`, `HoyoRow`, `compareIds` (core); `Env`, `HostQueue`, `LIMITS`, `tokenBucket`, `clientIp` (Task 8).
- Produces:
  - `type Receipt = { kid, fetchedAt, uid, timeZone, digest, sig }`, `rowsDigest(rows)`, `signReceipt(env, game, signed)`, `verifyReceipt(env, game, receipt, { uid, timeZone, digest })`
  - `type FetchLine = { type: 'page'; gachaType; timeZone; rows } | { type: 'end'; receipt; error }`, `fetchHistory(game, params, deps)`
  - `type FetchDeps = { env, queue, upstream: typeof fetch, now, sleep }`, `createApp(deps)`
  - test helpers `testEnv`, `fakeHoyo`, `harness`, `ndjson`, `history`, `API`, `HISTORY_URL`

The receipt covers each row's content and the server's time zone, not only the ids (ruling R18): with ids alone a contributor could keep a valid receipt and edit what they pulled. The server sets `lang=en-us` and `auth_appid` itself and refuses redirects (R23). Nothing is logged but the route and the error's class name.

- [ ] **Step 1: Write the harness and the failing tests**

`apps/api/test/fixtures.ts`:

```ts
// Test harness: an app with a fake clock and a scripted HoYo API. No authkeys, no real UIDs.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { HoyoRow } from '@pull-census/core'
import { createApp } from '../src/app.ts'
import { loadEnv } from '../src/env.ts'
import { HostQueue } from '../src/queue.ts'

export const API = 'https://public-operation-hk4e-sg.hoyoverse.com/gacha_info/api/getGachaLog'
export const HISTORY_URL = `${API}?authkey=FAKEKEY&authkey_ver=1&sign_type=2&game_biz=hk4e_global&region=os_asia`

export const testEnv = () =>
  loadEnv({
    SITE_ORIGIN: 'https://pullcensus.test',
    TRUST_PROXY: '1',
    DB_PATH: ':memory:',
    CARD_DIR: mkdtempSync(join(tmpdir(), 'pc-cards-')),
    RECEIPT_KEYS: `k1:${'a'.repeat(43)},k0:${'b'.repeat(43)}`,
    UID_SALT: 'c'.repeat(43),
  })

/** A scripted getGachaLog: rows per gacha_type, newest first, paged by end_id like the real API. */
export function fakeHoyo(
  rowsByType: Record<string, HoyoRow[]>,
  script: (url: URL, call: number) => { retcode: number; message: string } | null = () => null,
) {
  const calls: URL[] = []
  const options: RequestInit[] = []
  const upstream = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input))
    calls.push(url)
    options.push(init ?? {})
    const err = script(url, calls.length)
    if (err) return Response.json({ ...err, data: null })
    const type = url.searchParams.get('gacha_type') ?? ''
    const endId = url.searchParams.get('end_id') ?? '0'
    const size = Number(url.searchParams.get('size'))
    const rows = [...(rowsByType[type] ?? [])]
      .sort((a, b) => (BigInt(b.id) > BigInt(a.id) ? 1 : -1))
      .filter((r) => endId === '0' || BigInt(r.id) < BigInt(endId))
      .slice(0, size)
    return Response.json({
      retcode: 0,
      message: 'OK',
      data: { page: '1', size: String(size), list: rows, region: 'os_asia', region_time_zone: 8 },
    })
  }) as typeof fetch
  return { upstream, calls, options }
}

export function harness(upstream: typeof fetch = fakeHoyo({}).upstream) {
  const env = testEnv()
  let t = Date.parse('2026-10-12T00:00:00Z')
  const sleeps: number[] = []
  const clock = {
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms)
      t += ms
    },
  }
  const app = createApp({
    env,
    queue: new HostQueue(500, clock.now, clock.sleep),
    upstream,
    now: clock.now,
    sleep: clock.sleep,
  })
  const post = (path: string, body: unknown, ip = '203.0.113.7') =>
    app.request(path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    })
  return { app, env, clock, sleeps, post }
}

export const ndjson = async (res: Response) =>
  (await res.text())
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l))

let nextId = 1_727_690_400_000_000_000n
/** `n` rows of one pool, one minute apart from 2026-09-01 12:00 (UTC+8); every 50th is the featured 5★. */
export function history(n: number, gachaType = '301', uid = '812345678'): HoyoRow[] {
  const start = Date.parse('2026-09-01T04:00:00Z')
  return Array.from({ length: n }, (_, i) => {
    const five = (i + 1) % 50 === 0
    return {
      uid,
      gacha_type: gachaType,
      item_id: '',
      time: new Date(start + i * 60_000 + 8 * 3_600_000)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' '),
      name: five ? 'Fixture Hero' : 'Fixture Sword',
      lang: 'en-us',
      rank_type: five ? '5' : '3',
      id: String(nextId++),
    }
  })
}
```

`apps/api/test/receipt.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rowsDigest, signReceipt, verifyReceipt } from '../src/receipt.ts'
import { history, testEnv } from './fixtures.ts'

const env = testEnv()
const rows = history(30)

test('the digest ignores row order and repeated rows, and refuses two different rows with one id', () => {
  assert.equal(rowsDigest([...rows].reverse()), rowsDigest(rows))
  assert.equal(rowsDigest([...rows, ...rows.slice(0, 5)]), rowsDigest(rows))
  assert.throws(() => rowsDigest([...rows, { ...rows[0]!, rank_type: '5' }]), /conflicting/)
})

test('a receipt verifies only for the same account, time zone and content', () => {
  const digest = rowsDigest(rows)
  const r = signReceipt(env, 'genshin', {
    uid: '812345678',
    timeZone: 8,
    digest,
    fetchedAt: '2026-10-12T00:00:00.000Z',
  })
  assert.equal(r.kid, 'k1')
  const ok = { uid: '812345678', timeZone: 8, digest }
  assert.equal(verifyReceipt(env, 'genshin', r, ok), true)
  // Editing one pull's rarity changes the digest.
  const edited = rowsDigest(rows.map((x, i) => (i === 3 ? { ...x, rank_type: '5' as const } : x)))
  assert.equal(verifyReceipt(env, 'genshin', r, { ...ok, digest: edited }), false)
  assert.equal(verifyReceipt(env, 'genshin', r, { ...ok, uid: '812345679' }), false)
  assert.equal(verifyReceipt(env, 'genshin', r, { ...ok, timeZone: -5 }), false)
  assert.equal(verifyReceipt(env, 'hsr', r, ok), false)
  assert.equal(verifyReceipt(env, 'genshin', { ...r, sig: `${r.sig.slice(0, -1)}A` }, ok), false)
  assert.equal(verifyReceipt(env, 'genshin', { ...r, kid: 'nope' }, ok), false)
})

test('receipts signed with an older key still verify after rotation', () => {
  const old = { ...env, receiptKeys: [env.receiptKeys[1]!] }
  const digest = rowsDigest(rows)
  const r = signReceipt(old, 'genshin', { uid: '812345678', timeZone: 8, digest, fetchedAt: 'x' })
  assert.equal(r.kid, 'k0')
  assert.equal(verifyReceipt(env, 'genshin', r, { uid: '812345678', timeZone: 8, digest }), true)
})
```

`apps/api/test/fetch.test.ts`:

```ts
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
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test apps/api/test/receipt.test.ts apps/api/test/fetch.test.ts`

Expected: FAIL: `ERR_MODULE_NOT_FOUND` for `src/receipt.ts`.

- [ ] **Step 3: Write the receipt, the pager and the app**

`apps/api/src/receipt.ts`:

```ts
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { compareIds, type Game, type HoyoRow } from '@pull-census/core'
import type { Env } from './env.ts'

/** Proof that the server fetched these rows from the official API (spec section 6). */
export type Receipt = {
  kid: string
  fetchedAt: string
  uid: string
  /** The server's UTC offset from the API: pull times are built from it, so it is signed too. */
  timeZone: number
  digest: string
  sig: string
}

const line = (r: HoyoRow) => [r.id, r.gacha_type, r.rank_type, r.time, r.item_id, r.name].join('|')

/**
 * sha256 over every row's content, sorted by id. It covers outcomes (item and rarity), not just ids, so a
 * contributor can't keep a valid receipt while editing what they pulled. Repeated identical rows count once;
 * two different rows with one id throw.
 */
export function rowsDigest(rows: HoyoRow[]): string {
  const byId = new Map<string, string>()
  for (const r of rows) {
    const l = line(r)
    const seen = byId.get(r.id)
    if (seen !== undefined && seen !== l) throw new Error('conflicting rows')
    byId.set(r.id, l)
  }
  const lines = [...byId.entries()].sort(([a], [b]) => compareIds(a, b)).map(([, l]) => l)
  return createHash('sha256').update(lines.join('\n')).digest('hex')
}

type Signed = Omit<Receipt, 'kid' | 'sig'>

const mac = (key: Buffer, game: Game, s: Signed) =>
  createHmac('sha256', key)
    .update(`${game}|${s.uid}|${s.timeZone}|${s.digest}|${s.fetchedAt}`)
    .digest('base64url')

export function signReceipt(env: Env, game: Game, s: Signed): Receipt {
  const { kid, key } = env.receiptKeys[0]!
  return { kid, ...s, sig: mac(key, game, s) }
}

/** True if `r` was signed by one of our keys for exactly this account, time zone and content. */
export function verifyReceipt(
  env: Env,
  game: Game,
  r: Receipt,
  s: Omit<Signed, 'fetchedAt'>,
): boolean {
  const k = env.receiptKeys.find((k) => k.kid === r.kid)
  if (!k || r.uid !== s.uid || r.timeZone !== s.timeZone || r.digest !== s.digest) return false
  const want = Buffer.from(mac(k.key, game, r))
  const got = Buffer.from(r.sig)
  return want.length === got.length && timingSafeEqual(want, got)
}
```

`apps/api/src/fetch.ts`:

```ts
import {
  type Game,
  HISTORY_API,
  HoyoApiError,
  type HoyoRow,
  parseHoyoPage,
} from '@pull-census/core'
import type { Env } from './env.ts'
import type { HostQueue } from './queue.ts'
import { type Receipt, rowsDigest, signReceipt } from './receipt.ts'

export const PAGE_SIZE = 20
export const MAX_PAGES_PER_POOL = 1000
export const PAGE_TIMEOUT_MS = 30_000
/** Waits after a "too frequent" (-110) answer before trying the page again. */
export const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000]

export type FetchError = 'authkey-expired' | 'busy' | 'upstream' | 'too-many-pages'

/** One NDJSON line of the /fetch response. The last line is always `end`. */
export type FetchLine =
  | { type: 'page'; gachaType: string; timeZone: number | null; rows: HoyoRow[] }
  | { type: 'end'; receipt: Receipt | null; error: FetchError | null }

export type FetchDeps = {
  env: Env
  queue: HostQueue
  upstream: typeof fetch
  now: () => number
  sleep: (ms: number) => Promise<void>
}

/** Page through every pool's history. Yields pages as they arrive, then the receipt (complete fetches only). */
export async function* fetchHistory(
  game: Game,
  params: URLSearchParams,
  deps: FetchDeps,
): AsyncGenerator<FetchLine> {
  const api = HISTORY_API[game]!
  const all: HoyoRow[] = []
  let timeZone: number | null = null
  const end = (error: FetchError): FetchLine => ({ type: 'end', receipt: null, error })

  for (const gachaType of api.queryTypes) {
    let endId = '0'
    for (let page = 1; ; page++) {
      if (page > MAX_PAGES_PER_POOL) {
        yield end('too-many-pages')
        return
      }
      const url = new URL(`https://${api.host}${api.path}`)
      for (const [k, v] of params) url.searchParams.set(k, v)
      // Set by the server, never by the player: English names match the vendored item dictionary.
      url.searchParams.set('lang', 'en-us')
      url.searchParams.set('auth_appid', 'webview_gacha')
      url.searchParams.set('gacha_type', gachaType)
      url.searchParams.set('page', String(page))
      url.searchParams.set('size', String(PAGE_SIZE))
      url.searchParams.set('end_id', endId)

      let result: Awaited<ReturnType<typeof getPage>>
      try {
        result = await getPage(url, api.host, deps)
      } catch {
        yield end('upstream')
        return
      }
      if (result === 'authkey-expired' || result === 'busy') {
        yield end(result)
        return
      }
      all.push(...result.rows)
      timeZone ??= result.timeZone
      yield { type: 'page', gachaType, timeZone: result.timeZone, rows: result.rows }
      if (result.rows.length < PAGE_SIZE || !result.lastId) break
      endId = result.lastId
    }
  }

  const uids = new Set(all.map((r) => r.uid))
  if (uids.size === 0) {
    yield { type: 'end', receipt: null, error: null } // no pulls: nothing to vouch for
    return
  }
  // Rows from two accounts or no time zone: the API never sends these, so don't vouch for them.
  if (uids.size > 1 || timeZone === null) {
    yield end('upstream')
    return
  }
  const receipt = signReceipt(deps.env, game, {
    uid: [...uids][0]!,
    timeZone,
    digest: rowsDigest(all),
    fetchedAt: new Date(deps.now()).toISOString(),
  })
  yield { type: 'end', receipt, error: null }
}

async function getPage(url: URL, host: string, deps: FetchDeps) {
  for (let attempt = 0; ; attempt++) {
    const json = await deps.queue.run(host, async () => {
      // No redirects: a redirect could point the server anywhere.
      const res = await deps.upstream(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
        headers: { accept: 'application/json' },
      })
      if (!res.ok) throw new Error(`upstream ${res.status}`)
      return (await res.json()) as unknown
    })
    try {
      return parseHoyoPage(json)
    } catch (e) {
      if (!(e instanceof HoyoApiError)) throw e
      // -101 is an expired authkey, -100 a broken one: either way the player reopens the history.
      if (e.authkeyTimeout || e.retcode === -100) return 'authkey-expired' as const
      if (!e.tooFrequent) throw e
      const wait = BACKOFF_MS[attempt]
      if (wait === undefined) return 'busy' as const
      await deps.sleep(wait)
    }
  }
}
```

`apps/api/src/app.ts`:

```ts
import { historyParams } from '@pull-census/core'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { stream } from 'hono/streaming'
import * as v from 'valibot'
import { type FetchDeps, fetchHistory } from './fetch.ts'
import { clientIp, LIMITS, tokenBucket } from './limits.ts'

export type Deps = FetchDeps

const FetchBody = v.object({
  game: v.picklist(['genshin', 'hsr', 'zzz']),
  url: v.pipe(v.string(), v.maxLength(4096)),
})

const tooBig = (c: { json: (b: unknown, s: 413) => Response }) => c.json({ error: 'too-big' }, 413)

export function createApp(deps: Deps): Hono {
  const app = new Hono()
  const buckets = Object.fromEntries(
    Object.entries(LIMITS).map(([k, l]) => [k, tokenBucket(l.capacity, l.perMs, deps.now)]),
  ) as Record<keyof typeof LIMITS, (key: string) => boolean>
  const limited = (name: keyof typeof LIMITS, c: Parameters<typeof clientIp>[0]) =>
    !buckets[name](clientIp(c, deps.env))

  // Referrer-Policy: no-referrer keeps history URLs out of any Referer header (spec section 6).
  app.use(
    '*',
    secureHeaders({ referrerPolicy: 'no-referrer', crossOriginResourcePolicy: 'cross-origin' }),
  )
  app.use(
    '*',
    cors({ origin: deps.env.siteOrigin, allowMethods: ['GET', 'POST', 'DELETE'], maxAge: 600 }),
  )
  // Never log request bodies or URLs: a history URL is a secret (spec section 15).
  app.onError((err, c) => {
    console.error(`api error on ${c.req.method} ${c.req.routePath}: ${err.name}`)
    return c.json({ error: 'server' }, 500)
  })

  app.post('/fetch', bodyLimit({ maxSize: 16 * 1024, onError: tooBig }), async (c) => {
    if (limited('fetch', c)) return c.json({ error: 'rate-limited' }, 429)
    const body = v.safeParse(FetchBody, await c.req.json().catch(() => null))
    if (!body.success) return c.json({ error: 'bad-request' }, 400)
    const params = historyParams(body.output.game, body.output.url)
    if (!params) return c.json({ error: 'bad-url' }, 400)
    c.header('Content-Type', 'application/x-ndjson')
    c.header('Cache-Control', 'no-store')
    return stream(c, async (s) => {
      for await (const line of fetchHistory(body.output.game, params, deps))
        await s.write(`${JSON.stringify(line)}\n`)
    })
  })

  return app
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test apps/api/test/ && npm run typecheck`

Expected: PASS (15 tests); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src apps/api/test
git commit -m "feat(api): /fetch proxy with host queue and content receipts"
```


### Task 10: /contribute and /delete

**Files:**
- Create: `apps/api/src/contribute.ts`
- Modify: `apps/api/src/app.ts` (full file below), `apps/api/test/fixtures.ts`
- Test: `apps/api/test/contribute.test.ts`, `apps/api/test/delete.test.ts`

**Interfaces:**
- Consumes: `rowsToPulls`, `parseUigf`, `regionForUid`, `HoyoRowSchema`, `compareIds` (core); `rowsDigest`, `verifyReceipt` (Task 9); the database helpers (Task 8).
- Produces:
  - `ContributeBody` (valibot), `MAX_PULLS`, `type GameData = { rules, dict }`, `contribute(db, env, games, input, nowMs)`, `implausible(pulls, nowMs)`
  - `lookupToken(db, token)`, `deleteByToken(db, token, nowMs)`, `hashToken(token)`
  - routes `POST /contribute`, `POST /delete/lookup`, `POST /delete`; `Deps` gains `db` and `games`

`/contribute` is the trust boundary (spec section 15). The server derives the pulls itself from the raw rows or the UIGF file (ruling R19). Pulls keep their own tier, and only a new account or a verified upload gets a delete token (R20, R21). `/delete` is two steps, lookup then delete, as on board V7Delete (R22).

- [ ] **Step 1: Give the harness a database**

In `apps/api/test/fixtures.ts`, replace:

```ts
// Test harness: an app with a fake clock
```

with:

```ts
// Test harness: an app with an in-memory database, a fake clock
```

In `apps/api/test/fixtures.ts`, replace:

```ts
import { createApp } from '../src/app.ts'
```

with:

```ts
import { dict } from '../../../packages/core/test/fixtures/hoyo.ts'
import { fixtureRules } from '../../../packages/core/test/fixtures/rules.ts'
import { createApp } from '../src/app.ts'
import { openDb } from '../src/db.ts'
```

In `apps/api/test/fixtures.ts`, replace:

```ts
  const env = testEnv()
  let t =
```

with:

```ts
  const env = testEnv()
  const db = openDb(':memory:')
  let t =
```

In `apps/api/test/fixtures.ts`, replace:

```ts
  const app = createApp({
    env,
    queue:
```

with:

```ts
  const app = createApp({
    env,
    db,
    games: { genshin: { rules: fixtureRules, dict } },
    queue:
```

In `apps/api/test/fixtures.ts`, replace:

```ts
  return { app, env, clock, sleeps, post }
```

with:

```ts
  return { app, db, env, clock, sleeps, post }
```

- [ ] **Step 2: Write the failing tests**

`apps/api/test/contribute.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { implausible, MAX_PULLS } from '../src/contribute.ts'
import { fakeHoyo, HISTORY_URL, harness, history, ndjson } from './fixtures.ts'

/** Fetch rows through /fetch, so the receipt is a real one. */
async function fetched(h: ReturnType<typeof harness>) {
  const lines = await ndjson(await h.post('/fetch', { game: 'genshin', url: HISTORY_URL }))
  return {
    rows: lines.filter((l) => l.type === 'page').flatMap((l) => l.rows),
    receipt: lines.at(-1).receipt,
  }
}
const setup = (rows = history(120)) => harness(fakeHoyo({ '301': rows }).upstream)
const contribute = (h: ReturnType<typeof harness>, extra: object) =>
  h.post('/contribute', { game: 'genshin', source: 'hoyo', timeZone: 8, ...extra })

test('a fetched history with its receipt lands verified, under a salted hash, with a delete token', async () => {
  const h = setup()
  const { rows, receipt } = await fetched(h)
  const res = await contribute(h, { rows, receipt })
  assert.equal(res.status, 200)
  const out = await res.json()
  assert.equal(out.tier, 'verified')
  assert.equal(out.added, 120)
  assert.equal(out.total, 120)
  assert.match(out.token, /^[A-Za-z0-9_-]{43}$/)
  const acc = h.db.prepare('SELECT * FROM accounts').get() as Record<string, unknown>
  assert.equal(acc.tier, 'verified')
  assert.equal(acc.region, 'asia')
  assert.equal(acc.uid_coarse, 812)
  assert.ok(!JSON.stringify(acc).includes('812345678'), 'the UID itself is never stored')
  const pulls = h.db.prepare('SELECT count(*) AS n, min(verified) AS v FROM pulls').get() as {
    n: number
    v: number
  }
  assert.deepEqual({ ...pulls }, { n: 120, v: 1 })
})

test('editing any row breaks the receipt', async () => {
  const h = setup()
  const { rows, receipt } = await fetched(h)
  const edited = rows.map((r: { rank_type: string }, i: number) =>
    i === 7 ? { ...r, rank_type: '5' } : r,
  )
  const res = await contribute(h, { rows: edited, receipt })
  assert.equal(res.status, 400)
  assert.deepEqual(await res.json(), { error: 'bad-receipt' })
  assert.equal((h.db.prepare('SELECT count(*) AS n FROM pulls').get() as { n: number }).n, 0)
})

test('without a receipt the upload is self-reported, and only a verified upload replaces the token', async () => {
  const h = setup()
  const { rows, receipt } = await fetched(h)
  const first = await (await contribute(h, { rows: rows.slice(0, 60), receipt: null })).json()
  assert.equal(first.tier, 'self')
  assert.ok(first.token)
  // Anyone can claim a UID in a file: a second self-reported upload adds pulls but never gets a token.
  const second = await (await contribute(h, { rows, receipt: null })).json()
  assert.deepEqual([second.tier, second.added, second.token], ['self', 60, null])
  const verified = await (await contribute(h, { rows, receipt })).json()
  assert.equal(verified.tier, 'verified')
  assert.ok(verified.token && verified.token !== first.token)
  const old = await h.post('/delete', { token: first.token })
  assert.equal(old.status, 410)
  assert.equal((await old.json()).error, 'replaced-token')
  const counts = h.db.prepare('SELECT sum(verified) AS v, count(*) AS n FROM pulls').get() as {
    v: number
    n: number
  }
  assert.deepEqual({ ...counts }, { v: 120, n: 120 }) // verified rows replaced the self-reported ones
})

test('a self-reported upload never overwrites a verified pull', async () => {
  const h = setup()
  const { rows, receipt } = await fetched(h)
  await contribute(h, { rows, receipt })
  // Same ids, one pull edited into a 5★, no receipt.
  const edited = rows.map((r: { rank_type: string; name: string }, i: number) =>
    i === 7 ? { ...r, rank_type: '5', name: 'Fixture Hero' } : r,
  )
  const res = await (await contribute(h, { rows: edited, receipt: null })).json()
  assert.deepEqual([res.tier, res.added], ['self', 0])
  const fives = h.db.prepare('SELECT count(*) AS n FROM pulls WHERE rarity = 5').get() as {
    n: number
  }
  assert.equal(fives.n, 2) // pulls 50 and 100 only
  const tier = h.db.prepare('SELECT tier FROM accounts').get() as { tier: string }
  assert.equal(tier.tier, 'verified')
})

test('implausible histories are refused', () => {
  const ok = {
    game: 'genshin' as const,
    pool: 'standard',
    bannerId: null,
    itemId: '1',
    rarity: 3 as const,
    multi: false,
  }
  const now = Date.parse('2026-10-12T00:00:00Z')
  assert.equal(implausible([], now), 'no-pulls')
  assert.equal(
    implausible(
      [
        { ...ok, sourceId: '2', time: '2026-09-01T12:00:00+08:00' },
        { ...ok, sourceId: '10', time: '2026-09-01T11:00:00+08:00' },
      ],
      now,
    ),
    'out-of-order',
  )
  assert.equal(
    implausible([{ ...ok, sourceId: '1', time: '2026-11-01T00:00:00+08:00' }], now),
    'future-time',
  )
  const many = Array.from({ length: MAX_PULLS + 1 }, (_, i) => ({
    ...ok,
    sourceId: String(i + 1),
    time: '2026-09-01T12:00:00+08:00',
  }))
  assert.equal(implausible(many, now), 'too-many-pulls')
})

test("a 10-pull's ten rows share one timestamp, and that is plausible", () => {
  const ok = {
    game: 'genshin' as const,
    pool: 'standard',
    bannerId: null,
    itemId: '1',
    rarity: 3 as const,
    multi: true,
  }
  const ten = Array.from({ length: 10 }, (_, i) => ({
    ...ok,
    sourceId: String(100 + i),
    time: '2026-09-01T12:00:00+08:00',
  }))
  assert.equal(implausible(ten, Date.parse('2026-10-12T00:00:00Z')), null)
})

test('an out-of-order upload is refused over HTTP too', async () => {
  const h = setup()
  const rows = history(5)
  rows[4] = { ...rows[4]!, time: '2026-08-01 00:00:00' }
  const res = await contribute(h, { rows, receipt: null })
  assert.equal(res.status, 422)
  assert.deepEqual(await res.json(), { error: 'out-of-order' })
})

test('a UIGF file must hold exactly one Genshin account, and lands self-reported', async () => {
  const h = setup()
  const list = history(10).map((r) => ({
    uigf_gacha_type: '301',
    gacha_type: '301',
    item_id: r.rank_type === '5' ? '10000089' : '11301',
    time: r.time,
    rank_type: r.rank_type,
    id: r.id,
  }))
  const file = (accounts: number) => ({
    info: { version: 'v4.2' },
    hk4e: Array.from({ length: accounts }, (_, i) => ({ uid: `81234567${i}`, timezone: 8, list })),
  })
  const two = await h.post('/contribute', { game: 'genshin', source: 'uigf', file: file(2) })
  assert.equal(two.status, 422)
  assert.deepEqual(await two.json(), { error: 'one-account' })
  const one = await (
    await h.post('/contribute', { game: 'genshin', source: 'uigf', file: file(1) })
  ).json()
  assert.deepEqual([one.tier, one.added], ['self', 10])
})

test('malformed bodies are refused without detail', async () => {
  const h = setup()
  for (const b of [
    null,
    { game: 'genshin' },
    { game: 'zzz', source: 'hoyo', timeZone: 8, rows: [], receipt: null },
  ]) {
    const res = await h.post('/contribute', b)
    assert.equal(res.status, 400)
    assert.deepEqual(await res.json(), { error: 'bad-request' })
  }
})
```

`apps/api/test/delete.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fakeHoyo, harness, history } from './fixtures.ts'

async function uploaded() {
  const h = harness(fakeHoyo({}).upstream)
  const res = await h.post('/contribute', {
    game: 'genshin',
    source: 'hoyo',
    timeZone: 8,
    rows: history(80),
    receipt: null,
  })
  return { h, token: (await res.json()).token as string }
}

test('lookup says what a token would delete, then delete removes it all, once', async () => {
  const { h, token } = await uploaded()
  const look = await h.post('/delete/lookup', { token })
  assert.equal(look.status, 200)
  assert.deepEqual(await look.json(), {
    game: 'genshin',
    pulls: 80,
    uploads: 1,
    firstUpload: '2026-10-12T00:00:00.000Z',
  })
  const del = await h.post('/delete', { token })
  assert.deepEqual(await del.json(), { deleted: 80, at: '2026-10-12T00:00:00.000Z' })
  assert.equal((h.db.prepare('SELECT count(*) AS n FROM pulls').get() as { n: number }).n, 0)
  assert.equal((h.db.prepare('SELECT count(*) AS n FROM accounts').get() as { n: number }).n, 0)
  const again = await h.post('/delete', { token })
  assert.equal(again.status, 410)
  assert.deepEqual(await again.json(), { error: 'used-token', at: '2026-10-12T00:00:00.000Z' })
  assert.equal((await h.post('/delete/lookup', { token })).status, 410)
})

test('an unknown or malformed token deletes nothing', async () => {
  const { h } = await uploaded()
  for (const token of ['A'.repeat(43), 'short', '']) {
    const res = await h.post('/delete', { token })
    assert.equal(res.status, 404)
    assert.equal((await res.json()).error, 'unknown-token')
  }
  assert.equal((h.db.prepare('SELECT count(*) AS n FROM pulls').get() as { n: number }).n, 80)
})

test('delete shares the per-IP limit of contribute: ten an hour', async () => {
  const { h } = await uploaded()
  const codes = []
  for (let i = 0; i < 11; i++)
    codes.push((await h.post('/delete', { token: 'A'.repeat(43) })).status)
  assert.equal(codes.at(-1), 429)
  assert.ok(codes.slice(0, 10).every((c) => c === 404))
})
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `node --test apps/api/test/contribute.test.ts apps/api/test/delete.test.ts`

Expected: FAIL: `ERR_MODULE_NOT_FOUND` for `src/contribute.ts`.

- [ ] **Step 4: Write contribute and delete, and route them**

`apps/api/src/contribute.ts`:

```ts
import { createHash, createHmac, randomBytes } from 'node:crypto'
import {
  compareIds,
  type Game,
  HoyoRowSchema,
  type ItemDict,
  type Pull,
  parseUigf,
  type Rules,
  regionForUid,
  rowsToPulls,
} from '@pull-census/core'
import * as v from 'valibot'
import { countPulls, type Db, findAccount, transaction, upsertPulls } from './db.ts'
import type { Env } from './env.ts'
import { rowsDigest, verifyReceipt } from './receipt.ts'

/** Spec section 15: at most 50k pulls per upload. */
export const MAX_PULLS = 50_000
/** Pull times may run ahead of the server clock by at most this much (clock skew, time zones). */
const FUTURE_SLACK_MS = 86_400_000

const ReceiptSchema = v.object({
  kid: v.pipe(v.string(), v.maxLength(16)),
  fetchedAt: v.pipe(v.string(), v.isoTimestamp()),
  uid: v.pipe(v.string(), v.regex(/^\d{1,12}$/)),
  timeZone: v.pipe(v.number(), v.integer()),
  digest: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
  sig: v.pipe(v.string(), v.maxLength(64)),
})

export const ContributeBody = v.variant('source', [
  v.object({
    game: v.literal('genshin'),
    source: v.literal('hoyo'),
    timeZone: v.pipe(v.number(), v.integer(), v.minValue(-12), v.maxValue(14)),
    rows: v.pipe(v.array(HoyoRowSchema), v.minLength(1), v.maxLength(MAX_PULLS)),
    receipt: v.nullable(ReceiptSchema),
  }),
  v.object({
    game: v.literal('genshin'),
    source: v.literal('uigf'),
    file: v.unknown(),
  }),
])
export type ContributeInput = v.InferOutput<typeof ContributeBody>

export type GameData = { rules: Rules; dict: ItemDict }

export type ContributeResult =
  | { ok: true; tier: 'verified' | 'self'; added: number; total: number; token: string | null }
  | { ok: false; status: 400 | 413 | 422; error: string }

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
const newToken = () => randomBytes(32).toString('base64url')

/** Reasons a set of pulls can't be real history; null if it looks fine. */
export function implausible(pulls: Pull[], nowMs: number): string | null {
  if (pulls.length === 0) return 'no-pulls'
  if (pulls.length > MAX_PULLS) return 'too-many-pulls'
  const byId = [...pulls].sort((a, b) => compareIds(a.sourceId, b.sourceId))
  let prev = Number.NEGATIVE_INFINITY
  for (const p of byId) {
    const t = Date.parse(p.time)
    // Ids grow with time in every HoYo history; a pull older than an earlier id was edited.
    if (!(t >= prev)) return 'out-of-order'
    if (t > nowMs + FUTURE_SLACK_MS) return 'future-time'
    prev = t
  }
  return null
}

/**
 * The server derives pulls itself from the raw rows or file, so the census never trusts a browser's parsing.
 * Delete tokens are issued only to a new account or to a verified upload: anyone can claim a UID in a UIGF file,
 * so a self-reported upload must never take over an existing account's token.
 */
export function contribute(
  db: Db,
  env: Env,
  games: Partial<Record<Game, GameData>>,
  input: ContributeInput,
  nowMs: number,
): ContributeResult {
  const g = games[input.game]
  if (!g) return { ok: false, status: 400, error: 'unsupported-game' }

  let uid: string
  let pulls: Pull[]
  let verified = false
  if (input.source === 'hoyo') {
    let digest: string
    try {
      digest = rowsDigest(input.rows)
      ;({ uid, pulls } = rowsToPulls(input.rows, input.timeZone, g.rules, g.dict))
    } catch {
      return { ok: false, status: 422, error: 'implausible' } // conflicting rows or two accounts
    }
    if (input.receipt) {
      if (!verifyReceipt(env, input.game, input.receipt, { uid, timeZone: input.timeZone, digest }))
        return { ok: false, status: 400, error: 'bad-receipt' }
      verified = true
    }
  } else {
    let parsed: ReturnType<typeof parseUigf>
    try {
      parsed = parseUigf(input.file, g.rules)
    } catch {
      return { ok: false, status: 422, error: 'bad-file' }
    }
    if (parsed.accounts.length !== 1) return { ok: false, status: 422, error: 'one-account' }
    ;({ uid, pulls } = parsed.accounts[0]!)
  }

  const problem = implausible(pulls, nowMs)
  if (problem === 'too-many-pulls') return { ok: false, status: 413, error: problem }
  if (problem) return { ok: false, status: 422, error: problem }

  const uidHash = createHmac('sha256', env.uidSalt).update(`${input.game}${uid}`).digest('hex')
  const now = new Date(nowMs).toISOString()
  return transaction(db, () => {
    const existing = findAccount(db, input.game, uidHash)
    let token: string | null = null
    let accountId: number
    if (!existing) {
      token = newToken()
      accountId = Number(
        db
          .prepare(
            `INSERT INTO accounts (uid_hash, game, region, uid_coarse, tier, delete_token_hash, first_upload, last_upload)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            uidHash,
            input.game,
            regionForUid(g.rules, uid),
            Math.floor(Number(uid) / 1e6),
            verified ? 'verified' : 'self',
            hashToken(token),
            now,
            now,
          ).lastInsertRowid,
      )
    } else {
      accountId = existing.id
      if (verified) {
        token = newToken()
        db.prepare('INSERT OR IGNORE INTO used_tokens (hash, reason, at) VALUES (?, ?, ?)').run(
          existing.delete_token_hash,
          'replaced',
          now,
        )
      }
      db.prepare(
        `UPDATE accounts SET last_upload = ?, uploads = uploads + 1, tier = ?,
           delete_token_hash = coalesce(?, delete_token_hash)
         WHERE id = ?`,
      ).run(
        now,
        verified || existing.tier === 'verified' ? 'verified' : 'self',
        token && hashToken(token),
        accountId,
      )
    }
    const added = upsertPulls(db, accountId, pulls, verified)
    return {
      ok: true,
      tier: verified ? 'verified' : 'self',
      added,
      total: countPulls(db, accountId),
      token,
    }
  })
}

/** What a token would delete, so /delete can ask before it acts (board V7Delete). */
export type TokenLookup =
  | { ok: true; game: string; pulls: number; uploads: number; firstUpload: string }
  | { ok: false; status: 404 | 410; error: string; at?: string }

function usedToken(db: Db, hash: string): TokenLookup {
  const used = db.prepare('SELECT reason, at FROM used_tokens WHERE hash = ?').get(hash) as
    | { reason: 'used' | 'replaced'; at: string }
    | undefined
  if (!used) return { ok: false, status: 404, error: 'unknown-token' }
  return {
    ok: false,
    status: 410,
    error: used.reason === 'used' ? 'used-token' : 'replaced-token',
    at: used.at,
  }
}

export function lookupToken(db: Db, token: string): TokenLookup {
  const hash = hashToken(token)
  const acc = db
    .prepare('SELECT id, game, uploads, first_upload FROM accounts WHERE delete_token_hash = ?')
    .get(hash) as { id: number; game: string; uploads: number; first_upload: string } | undefined
  if (!acc) return usedToken(db, hash)
  return {
    ok: true,
    game: acc.game,
    pulls: countPulls(db, acc.id),
    uploads: acc.uploads,
    firstUpload: acc.first_upload,
  }
}

export type DeleteResult =
  | { ok: true; deleted: number; at: string }
  | { ok: false; status: 404 | 410; error: string; at?: string }

/** Delete every pull of the account a token was issued to, and the account row (spec section 15). */
export function deleteByToken(db: Db, token: string, nowMs: number): DeleteResult {
  const hash = hashToken(token)
  return transaction(db, () => {
    const acc = db.prepare('SELECT id FROM accounts WHERE delete_token_hash = ?').get(hash) as
      | { id: number }
      | undefined
    if (!acc) return usedToken(db, hash) as DeleteResult
    const deleted = countPulls(db, acc.id)
    db.prepare('DELETE FROM accounts WHERE id = ?').run(acc.id) // pulls cascade
    const at = new Date(nowMs).toISOString()
    db.prepare('INSERT INTO used_tokens (hash, reason, at) VALUES (?, ?, ?)').run(hash, 'used', at)
    return { ok: true, deleted, at }
  })
}
```

`apps/api/src/app.ts`:

```ts
import { type Game, historyParams } from '@pull-census/core'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { stream } from 'hono/streaming'
import * as v from 'valibot'
import {
  ContributeBody,
  contribute,
  deleteByToken,
  type GameData,
  lookupToken,
} from './contribute.ts'
import type { Db } from './db.ts'
import { type FetchDeps, fetchHistory } from './fetch.ts'
import { clientIp, LIMITS, tokenBucket } from './limits.ts'

export type Deps = FetchDeps & {
  db: Db
  games: Partial<Record<Game, GameData>>
}

const FetchBody = v.object({
  game: v.picklist(['genshin', 'hsr', 'zzz']),
  url: v.pipe(v.string(), v.maxLength(4096)),
})
const DeleteBody = v.object({ token: v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]{43}$/)) })

const tooBig = (c: { json: (b: unknown, s: 413) => Response }) => c.json({ error: 'too-big' }, 413)

export function createApp(deps: Deps): Hono {
  const app = new Hono()
  const buckets = Object.fromEntries(
    Object.entries(LIMITS).map(([k, l]) => [k, tokenBucket(l.capacity, l.perMs, deps.now)]),
  ) as Record<keyof typeof LIMITS, (key: string) => boolean>
  const limited = (name: keyof typeof LIMITS, c: Parameters<typeof clientIp>[0]) =>
    !buckets[name](clientIp(c, deps.env))

  // Referrer-Policy: no-referrer keeps history URLs out of any Referer header (spec section 6).
  app.use(
    '*',
    secureHeaders({ referrerPolicy: 'no-referrer', crossOriginResourcePolicy: 'cross-origin' }),
  )
  app.use(
    '*',
    cors({ origin: deps.env.siteOrigin, allowMethods: ['GET', 'POST', 'DELETE'], maxAge: 600 }),
  )
  // Never log request bodies or URLs: a history URL is a secret (spec section 15).
  app.onError((err, c) => {
    console.error(`api error on ${c.req.method} ${c.req.routePath}: ${err.name}`)
    return c.json({ error: 'server' }, 500)
  })

  app.post('/fetch', bodyLimit({ maxSize: 16 * 1024, onError: tooBig }), async (c) => {
    if (limited('fetch', c)) return c.json({ error: 'rate-limited' }, 429)
    const body = v.safeParse(FetchBody, await c.req.json().catch(() => null))
    if (!body.success) return c.json({ error: 'bad-request' }, 400)
    const params = historyParams(body.output.game, body.output.url)
    if (!params) return c.json({ error: 'bad-url' }, 400)
    c.header('Content-Type', 'application/x-ndjson')
    c.header('Cache-Control', 'no-store')
    return stream(c, async (s) => {
      for await (const line of fetchHistory(body.output.game, params, deps))
        await s.write(`${JSON.stringify(line)}\n`)
    })
  })

  app.post('/contribute', bodyLimit({ maxSize: 16 * 1024 * 1024, onError: tooBig }), async (c) => {
    if (limited('contribute', c)) return c.json({ error: 'rate-limited' }, 429)
    const body = v.safeParse(ContributeBody, await c.req.json().catch(() => null))
    if (!body.success) return c.json({ error: 'bad-request' }, 400)
    const r = contribute(deps.db, deps.env, deps.games, body.output, deps.now())
    if (!r.ok) return c.json({ error: r.error }, r.status)
    return c.json({ tier: r.tier, added: r.added, total: r.total, token: r.token })
  })

  // Two steps, as on /delete: look the token up, then delete. Both share one rate limit.
  app.post('/delete/lookup', bodyLimit({ maxSize: 4 * 1024, onError: tooBig }), async (c) => {
    if (limited('delete', c)) return c.json({ error: 'rate-limited' }, 429)
    const body = v.safeParse(DeleteBody, await c.req.json().catch(() => null))
    if (!body.success) return c.json({ error: 'unknown-token' }, 404)
    const r = lookupToken(deps.db, body.output.token)
    if (!r.ok) return c.json({ error: r.error, at: r.at }, r.status)
    return c.json({ game: r.game, pulls: r.pulls, uploads: r.uploads, firstUpload: r.firstUpload })
  })

  app.post('/delete', bodyLimit({ maxSize: 4 * 1024, onError: tooBig }), async (c) => {
    if (limited('delete', c)) return c.json({ error: 'rate-limited' }, 429)
    const body = v.safeParse(DeleteBody, await c.req.json().catch(() => null))
    if (!body.success) return c.json({ error: 'unknown-token' }, 404)
    const r = deleteByToken(deps.db, body.output.token, deps.now())
    if (!r.ok) return c.json({ error: r.error, at: r.at }, r.status)
    return c.json({ deleted: r.deleted, at: r.at })
  })

  return app
}
```

- [ ] **Step 5: Run the tests**

Run: `node --test apps/api/test/ && npm run typecheck`

Expected: PASS (27 tests); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src apps/api/test
git commit -m "feat(api): /contribute with derived pulls and per-pull tiers, two-step /delete"
```


### Task 11: Card fonts, /share and /card

**Files:**
- Create: `scripts/card-fonts.sh`, `apps/api/fonts/` (generated TTFs and their OFL licences)
- Create: `apps/api/src/share.ts`
- Modify: `apps/api/src/app.ts` (full file below), `apps/api/test/fixtures.ts`
- Test: `apps/api/test/share.test.ts`

**Interfaces:**
- Consumes: `CardSummary`, `skyCardSvg` (Task 7); `Resvg` from `@resvg/resvg-js`.
- Produces: `CODE_RE`, `createShare(db, summary, nowMs)`, `getShare(db, code)`, `deleteShare(db, cardDir, code, key)`, `cardPng(db, cardDir, fontFiles, code)`; routes `POST /share`, `GET /share/:code`, `DELETE /share/:code`, `GET /card/:code.png`; `Deps` gains `fontFiles`.

resvg-js 2.6.2 renders only a variable font's default instance, and takes font files by path (`fontFiles`; it has no `fontBuffers`). So the script cuts static instances, Bodoni Moda at opsz 14 as section 13 asks, and subsets them. Martian Mono and Shantell Sans need `--update-name-table` and `--name-IDs='*'`, or their family names come out wrong and resvg silently falls back. No card font has ★, so a one-glyph Noto Sans Symbols 2 subset carries it (ruling R13). Share codes are 8 characters with no look-alikes (R25); the postmark is the share day only (R14).

- [ ] **Step 1: Build the card fonts**

`scripts/card-fonts.sh`:

```sh
#!/usr/bin/env sh
# Rebuild the sky card fonts in apps/api/fonts (spec section 12). resvg-js renders only a variable font's default
# instance, so this cuts static instances (Bodoni Moda at opsz 14, as section 13 asks for numerals) and subsets
# them to the characters a card uses. All four families are OFL; their licences sit next to the files.
# Usage: sh scripts/card-fonts.sh   (needs curl and uv)
set -eu
SHA=bd8f81ddb5c74d5c8897b36ad88b440266245103 # google/fonts commit, 2026-10-12
OUT=apps/api/fonts
TMP=$(mktemp -d)
FT="uvx --from fonttools==4.60.1 fonttools"
TEXT='U+0020-007E,U+00B7,U+2013,U+2014,U+2026,U+2192,U+203A'

get() { curl -fsSL -o "$TMP/$2" "https://raw.githubusercontent.com/google/fonts/$SHA/$1"; }
# cut <source> <output> <axis=value...>: instance, then subset. Martian Mono and Shantell Sans need their name
# tables rewritten or they keep the default instance's family name ("Martian Mono SemiExpanded"); Bodoni Moda's
# opsz 14 has no named STAT value to rewrite from, and its names are already right.
cut() {
  src=$1 out=$2
  shift 2
  names=''
  case $src in bodoni*) ;; *) names=--update-name-table ;; esac
  $FT varLib.instancer -q $names "$TMP/$src" "$@" -o "$TMP/instance.ttf"
  $FT subset "$TMP/instance.ttf" --unicodes="$TEXT" --layout-features='*' --name-IDs='*' --output-file="$OUT/$out"
}

mkdir -p "$OUT"
get 'ofl/bodonimoda/BodoniModa%5Bopsz,wght%5D.ttf' bodoni.ttf
get 'ofl/bodonimoda/BodoniModa-Italic%5Bopsz,wght%5D.ttf' bodoni-italic.ttf
get 'ofl/martianmono/MartianMono%5Bwdth,wght%5D.ttf' martian.ttf
get 'ofl/shantellsans/ShantellSans%5BBNCE,INFM,SPAC,wght%5D.ttf' shantell.ttf
get 'ofl/notosanssymbols2/NotoSansSymbols2-Regular.ttf' symbols.ttf
for f in bodonimoda martianmono shantellsans notosanssymbols2; do
  curl -fsSL -o "$OUT/OFL-$f.txt" "https://raw.githubusercontent.com/google/fonts/$SHA/ofl/$f/OFL.txt"
done

cut bodoni.ttf BodoniModa-Regular.ttf opsz=14 wght=400
cut bodoni.ttf BodoniModa-SemiBold.ttf opsz=14 wght=600
cut bodoni-italic.ttf BodoniModa-Italic.ttf opsz=14 wght=400
cut bodoni-italic.ttf BodoniModa-SemiBoldItalic.ttf opsz=14 wght=600
cut martian.ttf MartianMono-Regular.ttf wdth=100 wght=400
cut martian.ttf MartianMono-SemiBold.ttf wdth=100 wght=600
cut shantell.ttf ShantellSans-Regular.ttf BNCE=0 INFM=0 SPAC=0 wght=400
# Only the ★ in "5★": no card font has it.
$FT subset "$TMP/symbols.ttf" --unicodes=U+2605 --output-file="$OUT/NotoSansSymbols2-Star.ttf"
rm -rf "$TMP"
ls -l "$OUT"
```

Run:

```bash
sh scripts/card-fonts.sh
fc-scan --format "%{file}: %{family}\n" apps/api/fonts/*.ttf
```

- [ ] **Step 2: Check the font names**

Expected: every file lists `Bodoni Moda`, `Martian Mono`, `Shantell Sans` or `Noto Sans Symbols 2` as a family. A name like "Martian Mono SemiExpanded" or "Shantell Sans Light" means the name tables weren't rewritten, and the card would render in the wrong font with no error.

- [ ] **Step 3: Give the harness the fonts, and write the failing tests**

In `apps/api/test/fixtures.ts`, replace:

```ts
import { mkdtempSync } from 'node:fs'
```

with:

```ts
import { mkdtempSync, readdirSync } from 'node:fs'
```

In `apps/api/test/fixtures.ts`, replace:

```ts
export function harness(
```

with:

```ts
const fontDir = new URL('../fonts/', import.meta.url).pathname

export function harness(
```

In `apps/api/test/fixtures.ts`, replace:

```ts
    games: { genshin: { rules: fixtureRules, dict } },
    queue:
```

with:

```ts
    games: { genshin: { rules: fixtureRules, dict } },
    fontFiles: readdirSync(fontDir)
      .filter((f) => f.endsWith('.ttf'))
      .map((f) => fontDir + f),
    queue:
```

`apps/api/test/share.test.ts`:

```ts
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { cardSummary, pityCheck } from '@pull-census/core'
import { boardPulls } from '../../../packages/core/test/fixtures/report.ts'
import { fixtureRules } from '../../../packages/core/test/fixtures/rules.ts'
import { harness } from './fixtures.ts'

const summary = cardSummary(pityCheck(boardPulls(), fixtureRules)[0]!)!

test('share a card, read it back with its postmark day, and get its PNG', async () => {
  const h = harness()
  const res = await h.post('/share', { summary })
  assert.equal(res.status, 201)
  const { code, key } = await res.json()
  assert.match(code, /^[a-hjkmnp-z2-9]{8}$/)
  assert.ok(key.length >= 32)
  const got = await (await h.app.request(`/share/${code}`)).json()
  assert.deepEqual(got, { summary, day: '2026-10-12' })
  const png = await h.app.request(`/card/${code}.png`)
  assert.equal(png.status, 200)
  assert.equal(png.headers.get('content-type'), 'image/png')
  const bytes = new Uint8Array(await png.arrayBuffer())
  assert.deepEqual([...bytes.slice(1, 4)].map((b) => String.fromCharCode(b)).join(''), 'PNG')
  const view = new DataView(bytes.buffer)
  assert.deepEqual([view.getUint32(16), view.getUint32(20)], [1200, 630])
  assert.ok(existsSync(join(h.env.cardDir, `${code}.png`)), 'cached on disk')
})

test('a summary with anything extra is refused', async () => {
  const h = harness()
  for (const s of [{ ...summary, uid: '812345678' }, { ...summary, nights: [] }, null]) {
    const res = await h.post('/share', { summary: s })
    assert.equal(res.status, 400)
  }
})

test('only the key deletes a card; then the link and the image are gone', async () => {
  const h = harness()
  const { code, key } = await (await h.post('/share', { summary })).json()
  await h.app.request(`/card/${code}.png`)
  const del = (k: string) =>
    h.app.request(`/share/${code}`, {
      method: 'DELETE',
      body: JSON.stringify({ key: k }),
      headers: { 'content-type': 'application/json' },
    })
  assert.equal((await del('wrong')).status, 403)
  assert.equal((await del(key)).status, 204)
  assert.equal((await h.app.request(`/share/${code}`)).status, 404)
  assert.equal((await h.app.request(`/card/${code}.png`)).status, 404)
  assert.ok(!existsSync(join(h.env.cardDir, `${code}.png`)))
  assert.equal((await del(key)).status, 404)
})

test('codes that cannot exist never touch the database or the disk', async () => {
  const h = harness()
  for (const path of [
    '/share/..%2F..%2Fetc',
    '/card/abc.png',
    '/card/abcdefgh.svg',
    '/share/ABCDEFGH',
  ])
    assert.equal((await h.app.request(path)).status, 404, path)
})
```

- [ ] **Step 4: Run them to make sure they fail**

Run: `node --test apps/api/test/share.test.ts`

Expected: FAIL: the routes don't exist yet (404 where 201 was expected).

- [ ] **Step 5: Write share and route it**

`apps/api/src/share.ts`:

```ts
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CardSummary, skyCardSvg } from '@pull-census/core'
import { Resvg } from '@resvg/resvg-js'
import * as v from 'valibot'
import type { Db } from './db.ts'

/** Share codes skip look-alike characters (0/o, 1/l/i) so a code read aloud still works. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
export const CODE_RE = /^[a-hjkmnp-z2-9]{8}$/

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

function newCode(): string {
  let out = ''
  while (out.length < 8) {
    // 248 = 8 × 31: rejecting bytes above it keeps every character equally likely.
    for (const b of randomBytes(16)) if (b < 248 && out.length < 8) out += ALPHABET[b % 31]
  }
  return out
}

/** Store a card summary; the delete key goes back once and lives only in the sharer's browser (pc-shares). */
export function createShare(
  db: Db,
  summary: CardSummary,
  nowMs: number,
): { code: string; key: string } {
  const key = randomBytes(24).toString('base64url')
  for (;;) {
    const code = newCode()
    const r = db
      .prepare(
        'INSERT OR IGNORE INTO shares (code, summary_json, delete_key_hash, created_at) VALUES (?, ?, ?, ?)',
      )
      .run(code, JSON.stringify(summary), sha256(key), new Date(nowMs).toISOString())
    if (r.changes === 1) return { code, key }
  }
}

/** The summary and the day it was shared (the postmark; never a time). */
export function getShare(db: Db, code: string): { summary: CardSummary; day: string } | null {
  const row = db.prepare('SELECT summary_json, created_at FROM shares WHERE code = ?').get(code) as
    | { summary_json: string; created_at: string }
    | undefined
  if (!row) return null
  return {
    summary: v.parse(CardSummary, JSON.parse(row.summary_json)),
    day: row.created_at.slice(0, 10),
  }
}

export function deleteShare(
  db: Db,
  cardDir: string,
  code: string,
  key: string,
): 'deleted' | 'not-found' | 'wrong-key' {
  const row = db.prepare('SELECT delete_key_hash FROM shares WHERE code = ?').get(code) as
    | { delete_key_hash: string }
    | undefined
  if (!row) return 'not-found'
  const want = Buffer.from(row.delete_key_hash)
  const got = Buffer.from(sha256(key))
  if (!timingSafeEqual(want, got)) return 'wrong-key'
  db.prepare('DELETE FROM shares WHERE code = ?').run(code)
  rmSync(join(cardDir, `${code}.png`), { force: true })
  return 'deleted'
}

/** The card PNG, rendered once per code and cached on disk (spec section 12). */
export function cardPng(db: Db, cardDir: string, fontFiles: string[], code: string): Buffer | null {
  const file = join(cardDir, `${code}.png`)
  if (existsSync(file)) return readFileSync(file)
  const share = getShare(db, code)
  if (!share) return null
  const png = new Resvg(skyCardSvg(share.summary), {
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Martian Mono' },
  })
    .render()
    .asPng()
  writeFileSync(file, png)
  return png
}
```

`apps/api/src/app.ts`:

```ts
import { CardSummary, type Game, historyParams } from '@pull-census/core'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { stream } from 'hono/streaming'
import * as v from 'valibot'
import {
  ContributeBody,
  contribute,
  deleteByToken,
  type GameData,
  lookupToken,
} from './contribute.ts'
import type { Db } from './db.ts'
import { type FetchDeps, fetchHistory } from './fetch.ts'
import { clientIp, LIMITS, tokenBucket } from './limits.ts'
import { CODE_RE, cardPng, createShare, deleteShare, getShare } from './share.ts'

export type Deps = FetchDeps & {
  db: Db
  games: Partial<Record<Game, GameData>>
  /** Card fonts for resvg (apps/api/fonts). */
  fontFiles: string[]
}

const FetchBody = v.object({
  game: v.picklist(['genshin', 'hsr', 'zzz']),
  url: v.pipe(v.string(), v.maxLength(4096)),
})
const DeleteBody = v.object({ token: v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]{43}$/)) })
const ShareBody = v.object({ summary: CardSummary })
const KeyBody = v.object({ key: v.pipe(v.string(), v.maxLength(64)) })

const tooBig = (c: { json: (b: unknown, s: 413) => Response }) => c.json({ error: 'too-big' }, 413)

export function createApp(deps: Deps): Hono {
  const app = new Hono()
  const buckets = Object.fromEntries(
    Object.entries(LIMITS).map(([k, l]) => [k, tokenBucket(l.capacity, l.perMs, deps.now)]),
  ) as Record<keyof typeof LIMITS, (key: string) => boolean>
  const limited = (name: keyof typeof LIMITS, c: Parameters<typeof clientIp>[0]) =>
    !buckets[name](clientIp(c, deps.env))

  // Referrer-Policy: no-referrer keeps history URLs out of any Referer header (spec section 6).
  app.use(
    '*',
    secureHeaders({ referrerPolicy: 'no-referrer', crossOriginResourcePolicy: 'cross-origin' }),
  )
  app.use(
    '*',
    cors({ origin: deps.env.siteOrigin, allowMethods: ['GET', 'POST', 'DELETE'], maxAge: 600 }),
  )
  // Never log request bodies or URLs: a history URL is a secret (spec section 15).
  app.onError((err, c) => {
    console.error(`api error on ${c.req.method} ${c.req.routePath}: ${err.name}`)
    return c.json({ error: 'server' }, 500)
  })

  app.post('/fetch', bodyLimit({ maxSize: 16 * 1024, onError: tooBig }), async (c) => {
    if (limited('fetch', c)) return c.json({ error: 'rate-limited' }, 429)
    const body = v.safeParse(FetchBody, await c.req.json().catch(() => null))
    if (!body.success) return c.json({ error: 'bad-request' }, 400)
    const params = historyParams(body.output.game, body.output.url)
    if (!params) return c.json({ error: 'bad-url' }, 400)
    c.header('Content-Type', 'application/x-ndjson')
    c.header('Cache-Control', 'no-store')
    return stream(c, async (s) => {
      for await (const line of fetchHistory(body.output.game, params, deps))
        await s.write(`${JSON.stringify(line)}\n`)
    })
  })

  app.post('/contribute', bodyLimit({ maxSize: 16 * 1024 * 1024, onError: tooBig }), async (c) => {
    if (limited('contribute', c)) return c.json({ error: 'rate-limited' }, 429)
    const body = v.safeParse(ContributeBody, await c.req.json().catch(() => null))
    if (!body.success) return c.json({ error: 'bad-request' }, 400)
    const r = contribute(deps.db, deps.env, deps.games, body.output, deps.now())
    if (!r.ok) return c.json({ error: r.error }, r.status)
    return c.json({ tier: r.tier, added: r.added, total: r.total, token: r.token })
  })

  // Two steps, as on /delete: look the token up, then delete. Both share one rate limit.
  app.post('/delete/lookup', bodyLimit({ maxSize: 4 * 1024, onError: tooBig }), async (c) => {
    if (limited('delete', c)) return c.json({ error: 'rate-limited' }, 429)
    const body = v.safeParse(DeleteBody, await c.req.json().catch(() => null))
    if (!body.success) return c.json({ error: 'unknown-token' }, 404)
    const r = lookupToken(deps.db, body.output.token)
    if (!r.ok) return c.json({ error: r.error, at: r.at }, r.status)
    return c.json({ game: r.game, pulls: r.pulls, uploads: r.uploads, firstUpload: r.firstUpload })
  })

  app.post('/delete', bodyLimit({ maxSize: 4 * 1024, onError: tooBig }), async (c) => {
    if (limited('delete', c)) return c.json({ error: 'rate-limited' }, 429)
    const body = v.safeParse(DeleteBody, await c.req.json().catch(() => null))
    if (!body.success) return c.json({ error: 'unknown-token' }, 404)
    const r = deleteByToken(deps.db, body.output.token, deps.now())
    if (!r.ok) return c.json({ error: r.error, at: r.at }, r.status)
    return c.json({ deleted: r.deleted, at: r.at })
  })

  app.post('/share', bodyLimit({ maxSize: 32 * 1024, onError: tooBig }), async (c) => {
    if (limited('share', c)) return c.json({ error: 'rate-limited' }, 429)
    const body = v.safeParse(ShareBody, await c.req.json().catch(() => null))
    if (!body.success) return c.json({ error: 'bad-summary' }, 400)
    return c.json(createShare(deps.db, body.output.summary, deps.now()), 201)
  })

  app.get('/share/:code', (c) => {
    const code = c.req.param('code')
    const share = CODE_RE.test(code) ? getShare(deps.db, code) : null
    if (!share) return c.json({ error: 'not-found' }, 404)
    return c.json(share)
  })

  app.delete('/share/:code', bodyLimit({ maxSize: 4 * 1024, onError: tooBig }), async (c) => {
    const code = c.req.param('code')
    const body = v.safeParse(KeyBody, await c.req.json().catch(() => null))
    if (!CODE_RE.test(code)) return c.json({ error: 'not-found' }, 404)
    if (!body.success) return c.json({ error: 'wrong-key' }, 403)
    const r = deleteShare(deps.db, deps.env.cardDir, code, body.output.key)
    if (r === 'not-found') return c.json({ error: r }, 404)
    if (r === 'wrong-key') return c.json({ error: r }, 403)
    return c.body(null, 204)
  })

  app.get('/card/:file', (c) => {
    const code = c.req.param('file').replace(/\.png$/, '')
    if (!c.req.param('file').endsWith('.png') || !CODE_RE.test(code))
      return c.json({ error: 'not-found' }, 404)
    const png = cardPng(deps.db, deps.env.cardDir, deps.fontFiles, code)
    if (!png) return c.json({ error: 'not-found' }, 404)
    c.header('Content-Type', 'image/png')
    // Short cache: a deleted card should stop showing soon (chats keep their own copies regardless).
    c.header('Cache-Control', 'public, max-age=3600')
    return c.body(new Uint8Array(png))
  })

  return app
}
```

- [ ] **Step 6: Run the tests**

Run: `node --test apps/api/test/ && npm run typecheck && npm run lint`

Expected: PASS (31 tests); typecheck and lint clean.

- [ ] **Step 7: Look at a card**

Render the sample once and open `/tmp/sky-card.png`. It should match board V6SkyCard: the taped dark print, the Milky Way band at 74–85, "An early star.", "of simulated skies", the SEEING · SIMULATED stamp inside the frame, and hand notes in Shantell Sans.

Run:

```bash
node --input-type=module -e "
import { writeFileSync, readdirSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'
import { cardSummary, pityCheck, skyCardSvg } from '@pull-census/core'
import { boardPulls } from './packages/core/test/fixtures/report.ts'
import { fixtureRules } from './packages/core/test/fixtures/rules.ts'
const dir = 'apps/api/fonts/'
const fontFiles = readdirSync(dir).filter((f) => f.endsWith('.ttf')).map((f) => dir + f)
const svg = skyCardSvg(cardSummary(pityCheck(boardPulls(), fixtureRules)[0]))
writeFileSync('/tmp/sky-card.png', new Resvg(svg, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Martian Mono' } }).render().asPng())
"
```

- [ ] **Step 8: Commit**

```bash
git add scripts/card-fonts.sh apps/api/fonts apps/api/src apps/api/test
git commit -m "feat(api): sky card fonts, /share and /card PNG"
```


### Task 12: Server entry, CORS and error hygiene, docs

**Files:**
- Create: `apps/api/src/server.ts`, `apps/api/.env.example`
- Modify: `README.md`
- Test: `apps/api/test/app.test.ts`

**Interfaces:**
- Consumes: `createApp`, `openDb`, `loadEnv`, `HostQueue`, `loadRules`.
- Produces: `npm start -w @pull-census/api` (reads `apps/api/.env`).

The app-wide promises get their own tests: CORS answers only the site's origin, and a server error tells the caller nothing and logs only the route pattern and the error's class name, never a body or URL (spec section 15).

- [ ] **Step 1: Write the tests**

`apps/api/test/app.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { harness } from './fixtures.ts'

test('CORS allows the site origin only', async () => {
  const { app } = harness()
  const pre = (origin: string) =>
    app.request('/contribute', {
      method: 'OPTIONS',
      headers: {
        origin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    })
  assert.equal(
    (await pre('https://pullcensus.test')).headers.get('access-control-allow-origin'),
    'https://pullcensus.test',
  )
  assert.notEqual(
    (await pre('https://evil.example')).headers.get('access-control-allow-origin'),
    'https://evil.example',
  )
})

test('a server error answers with no detail and logs no body', async () => {
  const { app, db } = harness()
  db.close() // every query now throws
  const logged: string[] = []
  const orig = console.error
  console.error = (...a: unknown[]) => logged.push(a.join(' '))
  try {
    const res = await app.request('/share/abcdefgh')
    assert.equal(res.status, 500)
    assert.deepEqual(await res.json(), { error: 'server' })
  } finally {
    console.error = orig
  }
  assert.equal(logged.length, 1)
  assert.match(logged[0]!, /^api error on GET \/share\/:code: \w+$/)
})
```

- [ ] **Step 2: Run them**

Run: `node --test apps/api/test/app.test.ts`

Expected: PASS (2 tests). These pin behaviour built in Tasks 9 to 11, so they pass at once. To see one fail, change the `onError` log line to include `err.message`.

- [ ] **Step 3: Write the entry point and the example environment**

`apps/api/src/server.ts`:

```ts
// Entry point: `npm start -w @pull-census/api`, which reads apps/api/.env (see .env.example).
import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { serve } from '@hono/node-server'
import { loadRules } from '@pull-census/core'
import { createApp } from './app.ts'
import { openDb } from './db.ts'
import { loadEnv } from './env.ts'
import { HostQueue } from './queue.ts'

const env = loadEnv(process.env)
mkdirSync(dirname(env.dbPath), { recursive: true })
mkdirSync(env.cardDir, { recursive: true })
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const fontDir = new URL('../fonts/', import.meta.url).pathname
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const app = createApp({
  env,
  db: openDb(env.dbPath),
  games: {
    genshin: {
      rules: loadRules(read('../../../rules/genshin.json')),
      dict: read('../../../rules/dict/genshin-en.json'),
    },
  },
  fontFiles: readdirSync(fontDir)
    .filter((f) => f.endsWith('.ttf'))
    .map((f) => fontDir + f),
  queue: new HostQueue(500, Date.now, sleep),
  upstream: fetch,
  now: Date.now,
  sleep,
})

serve({ fetch: app.fetch, port: env.port }, (info) => console.log(`api listening on ${info.port}`))
```

`apps/api/.env.example`:

```sh
# Copy to .env (never committed). Generate each secret with:
#   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
SITE_ORIGIN=https://pullcensus.example
# Behind Caddy: 1, so the client IP comes from X-Forwarded-For.
TRUST_PROXY=1
PORT=8787
DB_PATH=data/census.db
CARD_DIR=data/cards
# Receipt signing keys, "kid:secret", newest first. Old keys stay listed so old receipts still verify.
RECEIPT_KEYS=k1:replace-with-a-32-byte-base64url-secret
UID_SALT=replace-with-a-32-byte-base64url-secret
```

In `README.md`, replace:

```markdown
- `rules/`: the Rules Registry, one sourced JSON file per game.
```

with:

```markdown
- `apps/api`: the API (Hono, node:sqlite): `/fetch`, `/contribute`, `/delete`, `/share`, `/card`. AGPL-3.0.
- `rules/`: the Rules Registry, one sourced JSON file per game. `rules/dict/` holds the vendored UIGF item dictionaries.
```

In `README.md`, replace:

```markdown
Licences: core MIT, apps AGPL-3.0, dataset CC BY 4.0.
```

with:

```markdown
Run the API locally: copy `apps/api/.env.example` to `apps/api/.env`, fill in the secrets, then
`npm start -w @pull-census/api`. The card fonts in `apps/api/fonts` are built by `sh scripts/card-fonts.sh`
(OFL; licences alongside).

Licences: core MIT, apps AGPL-3.0, dataset CC BY 4.0.
```

- [ ] **Step 4: Start it once**

With a filled-in `apps/api/.env`, `npm start -w @pull-census/api` prints `api listening on 8787`. Then `curl -s localhost:8787/share/abcdefgh` answers `{"error":"not-found"}`. (During planning the sandbox blocked localhost connections; startup was checked, and every route is covered through `app.request`.)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/server.ts apps/api/.env.example apps/api/test/app.test.ts README.md
git commit -m "feat(api): server entry, example environment and docs"
```


### Task 13: Settle the pre-registration and tag methods-v1

**Files:**
- Modify: `methods/v1.md` (section 9 precision table)
- Modify: `docs/superpowers/specs/2026-10-09-pull-census-design.md` (the rulings that change the spec)

**Interfaces:**
- Produces: the annotated git tag `methods-v1`. `/contribute` must not accept uploads on any deployment before this tag exists (spec section 8.1).

Spec section 8.6 asks the methods to record the precision the beta gate gives. Then the spec catches up with the rulings that change it, so it stays the source of truth. Then the tag, which the user pushes.

- [ ] **Step 1: Record the beta-gate precision**

In `methods/v1.md`, replace:

```markdown
The first mechanic published is that pool's soft pity curve.
```

with:

```markdown
The first mechanic published is that pool's soft pity curve.

Precision this count gives, if the census follows the public soft-pity model (0.6% a pull, rising 6 points a pull from pull 74): the streaks expected to reach each pull, and the half-width of the 95% Clopper–Pearson interval on the hazard there.

| Pull | Streaks reaching it | Hazard | 95% interval |
|---|---|---|---|
| 1 | 1,500 | 0.6% | ±0.4 points |
| 60 | 1,052 | 0.6% | ±0.5 points |
| 73 | 973 | 0.6% | ±0.6 points |
| 74 | 967 | 6.6% | ±1.6 points |
| 76 | 789 | 18.6% | ±2.8 points |
| 78 | 484 | 30.6% | ±4.2 points |
| 80 | 213 | 42.6% | ±6.8 points |
| 82 | 63 | 54.6% | ±12.8 points |
| 85 | 4 | 72.6% | ±40.0 points |
```

- [ ] **Step 2: Bring the spec in line with the rulings**

In `docs/superpowers/specs/2026-10-09-pull-census-design.md`, replace:

```markdown
                          routes: /fetch /contribute /share /card /delete /results /discord
```

with:

```markdown
                          routes: /fetch /contribute /share /card /delete /delete/lookup /results /discord
```

In `docs/superpowers/specs/2026-10-09-pull-census-design.md`, replace:

```markdown
- `accounts(id, uid_hash, game, region, uid_coarse, tier, delete_token_hash, first_upload, last_upload)`
```

with:

```markdown
- `accounts(id, uid_hash, game, region, uid_coarse, tier, delete_token_hash, first_upload, last_upload, uploads)`
```

In `docs/superpowers/specs/2026-10-09-pull-census-design.md`, replace:

```markdown
- `pulls(account_id, source_id, pool, banner_id, item_id, rarity, time, multi)`, unique on `(account_id, source_id)`
```

with:

```markdown
- `pulls(account_id, source_id, pool, banner_id, item_id, rarity, time, multi, verified)`, unique on `(account_id, source_id)`
```

In `docs/superpowers/specs/2026-10-09-pull-census-design.md`, replace:

```markdown
- `shares(code, summary_json, delete_key_hash, created_at)`
```

with:

```markdown
- `shares(code, summary_json, delete_key_hash, created_at)`
- `used_tokens(hash, reason, at)`: spent or replaced delete tokens, as hashes, so `/delete` can say which
```

In `docs/superpowers/specs/2026-10-09-pull-census-design.md`, replace:

```markdown
Re-uploads merge by `source_id`, so older history fills in over time. A verified re-upload upgrades the account's tier.
```

with:

```markdown
Re-uploads merge by `source_id`, so older history fills in over time. Each pull keeps its own tier: a verified upload replaces self-reported rows with the same id, never the reverse, and the account's tier is the best it has seen. Delete tokens are issued only to a new account or to a verified upload, which replaces the old token: anyone can type a UID into a UIGF file.
```

In `docs/superpowers/specs/2026-10-09-pull-census-design.md`, replace:

```markdown
- **Forwarded parameters:** only `authkey`, `authkey_ver`, `sign_type`, `lang`, `game_biz` and `region`. The server sets the path itself (HSR also calls `getLdGachaLog` for collab banners).
```

with:

```markdown
- **Forwarded parameters:** only `authkey`, `authkey_ver`, `sign_type`, `game_biz` and `region`. The server sets the path itself (HSR also calls `getLdGachaLog` for collab banners), `auth_appid`, and `lang=en-us` so names match the vendored English item dictionary. Redirects are refused. `-100` (broken authkey) is treated like `-101`.
```

In `docs/superpowers/specs/2026-10-09-pull-census-design.md`, replace:

```markdown
  - `HMAC-SHA256(key, game | uid | sha256(sorted sourceIds) | fetchedAt)`, plus a key id so keys can rotate.
```

with:

```markdown
  - `HMAC-SHA256(key, game | uid | timeZone | sha256(every row's content, sorted by id) | fetchedAt)`, plus a key id so keys can rotate. Hashing content, not just ids, stops a contributor from editing outcomes under a valid receipt.
  - `/contribute` takes the raw rows (or the UIGF file) and derives the pulls itself.
```

In `docs/superpowers/specs/2026-10-09-pull-census-design.md`, replace:

```markdown
Until then it comes from a simulation of the measured model (or the disclosed model before any measurement), labelled as simulated.
```

with:

```markdown
Until then it comes from the public soft-pity model (0.6% a pull, rising 6 points a pull from pull 74; 0.7% and 7 points from 63 for weapons), which methods §10 checks against OneBST, labelled as simulated. "Waited longer" means strictly longer.
```

In `docs/superpowers/specs/2026-10-09-pull-census-design.md`, replace:

```markdown
  - The user's 5★ in order, with brightness set by how low the pity was.
  - Greek letters are assigned by pity rank.
```

with:

```markdown
  - The user's 5★ in order, with brightness set by how rare the night is, early or late (law 4).
  - Greek letters are assigned by rarity rank, α the rarest.
  - The first night of an import started before the history: it is listed with its pity as a lower bound and kept out of every statistic, as in the census.
```

In `docs/superpowers/specs/2026-10-09-pull-census-design.md`, replace:

```markdown
  - An account-level p-value for the user's 50/50 losses and mean pity, under the measured model.
```

with:

```markdown
  - Per pool, two shares from 10,000 skies simulated with seed 20261009: skies with an average night at least as long, and skies with at least as many 50/50 losses (at the disclosed 50/50 rate). They are never combined.
```

In `docs/superpowers/specs/2026-10-09-pull-census-design.md`, replace:

```markdown
  - game, percentile, featured x of y, early-star count, longest night
  - the list of 5★ pities, with no times or ids
```

with:

```markdown
  - game, pool, percentile and whether it is simulated, the first plate number and the method version
  - each complete night's pity and 50/50 result, in order, with no times or ids; everything else on the card is derived from these
```

In `docs/superpowers/specs/2026-10-09-pull-census-design.md`, replace:

```markdown
- **Fonts:** Bodoni Moda and Martian Mono (both OFL), embedded.
```

with:

```markdown
- **Fonts:** Bodoni Moda (opsz 14), Martian Mono and Shantell Sans, plus a one-glyph Noto Sans Symbols 2 subset for ★, all OFL, embedded as static instances.
```

- [ ] **Step 3: Run everything**

Run: `npm test && npm run typecheck && npm run lint`

Expected: PASS: every test (one slow test skipped), typecheck and lint clean.

Also run `npm run test:slow` and `npm run calibrate -- data/onebst/player_data` (OneBST is local only). Calibration must still print character-event onset 74 / 0.644% and weapon-event onset 63 / 0.737%. Task 1 touches only Census Tests, so neither result should move.

- [ ] **Step 4: Commit**

```bash
git add methods/v1.md docs/superpowers/specs/2026-10-09-pull-census-design.md
git commit -m "docs: beta-gate precision in methods v1; spec follows the Plan 2A rulings"
```

- [ ] **Step 5: Tag the pre-registration**

Run:

```bash
git tag -a methods-v1 -m "Pull Census methods v1: pre-registered before the first contribution"
git show --stat methods-v1 | head -5
```


---

## After the last task

**Live check (the user runs this; the history link never goes into a chat or a log).** Planning used no real authkey, so one real import closes the loop. The two snippets below print counts only.

1. Copy `apps/api/.env.example` to `apps/api/.env`. Generate the two secrets as its first line says, and set `SITE_ORIGIN=http://localhost:4321` and `TRUST_PROXY=0`.
2. Start the API with `npm start -w @pull-census/api`.
3. In a second terminal, from the repo root, run:

```bash
node --input-type=module -e "
import { canonicalHistoryUrl } from '@pull-census/core'
import { createInterface } from 'node:readline/promises'
const rl = createInterface({ input: process.stdin, output: process.stdout })
const raw = await rl.question('Paste your Genshin history link (stays on this machine): ')
rl.close()
const c = canonicalHistoryUrl('genshin', raw)
if (!('url' in c)) { console.log('problem:', c.problem); process.exit(1) }
const res = await fetch('http://localhost:8787/fetch', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ game: 'genshin', url: c.url }),
})
let pages = 0, rows = 0, end
for (const line of (await res.text()).trim().split('\n').map((l) => JSON.parse(l)))
  if (line.type === 'page') { pages++; rows += line.rows.length } else end = line
console.log({ pages, rows, error: end.error, receipt: end.receipt ? 'signed' : null })
"
```

Expected: `error: null`, `receipt: 'signed'`, and `rows` equal to the wish count shown in game for the last year. To check the cache-file path too, pass your `data_2` path (it prints only whether a link was found):

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs'
import { findHistoryUrl } from '@pull-census/core'
console.log(findHistoryUrl(readFileSync(process.argv[1]), 'genshin') ? 'history link found' : 'no history link: open the wish history in game first')
" "<path to data_2>"
```

If either check fails, the likely suspects are:
- the forced `lang=en-us` or `auth_appid` (ruling R23)
- the cache scanner's `getGachaLog` match

Fix whichever one it is with a test before Plan 2B.

**Finishing:**
- Use superpowers:finishing-a-development-branch.
- The user pushes `main` and the tag when the remote exists: `git push origin main methods-v1`.
- `methods-v1` must exist before any deployment accepts `/contribute`.

**What Plan 2B consumes from here:**
- From core: `canonicalHistoryUrl`, `findHistoryUrl`, `parseHoyoPage`, `rowsToPulls`, `parseUigf`, `pityCheck`, `almanac`, `cloudedOut`, `omenCheck`, `aboutPhrase`, `pct`, `cardSummary`, `cardVariant`, `skyCardSvg`, plus the vendored `rules/dict/genshin-en.json` for the browser.
- From the API:
  - `POST /fetch` (NDJSON `FetchLine`s)
  - `POST /contribute` (`{ tier, added, total, token }`)
  - `POST /delete/lookup` and `POST /delete` (errors `unknown-token`, `used-token` / `replaced-token` with `at`)
  - `POST /share` (`{ code, key }`, key kept in `pc-shares`), `GET /share/:code` (`{ summary, day }`), `DELETE /share/:code`
  - `GET /card/:code.png`
- 2B also owns:
  - the deploy files (compose, Caddy, Litestream)
  - the `/r/<code>` link preview (static hosting can't set per-code `og:image`; a small Pages Function or the API must)
  - the board copy for every error code above

**Deferred on purpose:**
- Seeing grades by sample size, census-based references at 500 accounts, and how mixed-tier accounts enter verdicts: Plan 3.
- HSR and ZZZ entries in `HISTORY_API` and `PUBLIC_MODEL`: Plan 4.
- A depth cap on the host queue (marked `ponytail:` in `queue.ts`).
- FFT for percentiles past 100 nights (marked in `model.ts`).
