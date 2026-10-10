# Pull Census: design spec

- Date: 2026-10-09
- Status: draft for review
- Inputs:
  - the five design sections approved on 2026-10-08/09
  - `~/Projects/pull-census-spikes/research-notes.md`, including the approved feature sort
  - the homework report: https://claude.ai/code/artifact/2ad321bf-5fb4-4a16-96b1-f66f4b113b01
  - the concept boards: https://claude.ai/artifact/Q4M3MFGMWQ7wM3oPoQZJJR

## 1. Summary

Pull Census is a free, open-source gacha stats site with its own Discord bot.

- **PityCheck:** players import their pull history and get a personal luck report.
- **The census:** pulls they opt in join a pooled census.
- **Verdicts:** pre-registered tests check the census against each game's disclosed rates.
- **Measured mechanics:** the census also measures what isn't disclosed, such as the soft pity curve and the real 50/50.
- **Open dataset:** the data is published monthly.

v1 covers Genshin Impact, Honkai: Star Rail and Zenless Zone Zero.

## 2. Goals and success criteria

v1 is done when all of these are true:

1. Import works for all three games, on the verified path (history URL through the proxy) and the self-reported path (UIGF v4.2).
2. PityCheck renders every piece listed in section 7 on phone, tablet and PC widths.
3. `methods/v1.md` was tagged before the first contribution was accepted.
4. The census holds at least 1,500 complete verified Genshin character-event streaks, which is the beta gate (section 8.6).
5. The soft pity curve for that pool is published, along with the first verdicts.
6. The first monthly dataset release is out.
7. The launch post is up with a link to the dataset.

Non-goals for v1:
- user accounts
- any feature that rewards pulling or spending
- games other than the three above

## 3. Scope

v1 is staged. Alpha is Genshin only. Beta adds HSR and ZZZ. Release opens to everyone.

| Feature | Stage |
|---|---|
| Import (cache file, pasted URL, UIGF file) | Alpha |
| PityCheck: percentile, pity, 50/50 record, constellation, lucky stars | Alpha |
| Dry List, "am I cursed?" test, after-a-loss block | Alpha |
| Share cards | Alpha |
| Census Tests, pre-registered (results once data allows) | Alpha |
| Rules Registry with daily snapshots | Alpha |
| Discord bot | Beta |
| Combined view across imported games | Beta |
| Live banner pages | Beta |
| Measured mechanics with per-game explainers | Beta |
| Home page, "Tonight's sky" | Beta |
| Open dataset with a methods page | Release |
| Planner (first to cut if we slip) | Release |

v1.1, later and cut items are listed in research-notes.md under "Feature sort (APPROVED)". They're out of scope here.

## 4. Architecture

```
pull-census/              npm workspaces, TypeScript, public repo from day one
  packages/core           pure TS, no I/O, runs in browser and Node
    rules/                typed loader for the registry files
    parse/                HoYo API pages and UIGF v4.2 → Pull[]
    report/               PityCheck maths (percentile, Dry List, cursed test, lucky stars, planner)
    stats/                log-gamma, incomplete beta, Clopper–Pearson, hazard curves,
                          cluster bootstrap, Holm
    tests/                frozen pre-registered test definitions
    sim/                  simulator for disclosed and measured rules
  apps/web                Astro 7.3 + Svelte 5 islands, static build on Cloudflare
  apps/api                Hono 4.13 + valibot, node:sqlite
                          routes: /fetch /contribute /share /card /delete /results /discord
                          scripts: batch.ts (nightly), snapshot.ts (daily), register-commands.ts
  rules/                  Rules Registry: one JSON file per game, every entry sourced
  methods/                v1.md, the pre-registration
```

Data flow:
1. The user imports pulls in one of three ways:
   - picks the game's cache file, and the browser finds the newest history URL in it
   - pastes the URL
   - drops a UIGF file
2. **URL path:**
   - The browser POSTs `{game, url}` to `/fetch`.
   - The API checks the host and parameters, queues the request, and pages through the official API.
   - It streams each page back, then a signed receipt.
   - Nothing is stored or logged.
3. `core` parses the pulls in the browser, and PityCheck renders client-side.
4. **Opt-in** (an unticked checkbox):
   - The browser POSTs the pulls plus the receipt to `/contribute`.
   - The API verifies and validates them, then stores them under a salted UID hash.
   - It returns a delete token once.
5. **Nightly batch:**
   - Runs SQLite through the `core` tests and mechanics.
   - Writes `results/<date>.json`.
   - Calls the Cloudflare deploy hook. The site build fetches the latest results.
6. **Sharing:**
   - The browser posts summary numbers and gets back a short code and a per-card delete key. The key stays in the sharer's browser (`pc-shares`).
   - `/card/<code>.png` renders the share card.
   - The bot's `/report <code>` embeds it.

## 5. Data model

```ts
type Game = 'genshin' | 'hsr' | 'zzz'        // v1.1 adds 'wuwa' | 'arknights'

type Pull = {
  game: Game
  pool: string             // pity group, e.g. 'character-event' | 'weapon-event' | 'standard'
  bannerId: string | null  // HSR/ZZZ: gacha_id. Genshin: resolved from the registry's
                           // banner schedule by time and gacha_type
  itemId: string           // Genshin returns an empty item_id: map the name through the UIGF dictionary
  rarity: 3 | 4 | 5        // ZZZ S/A/B map to 5/4/3
  time: string             // ISO 8601 with the server's UTC offset
  sourceId: string         // the game's per-pull id, 19 digits, always a string
  multi: boolean           // part of a 10-pull (10 rows sharing one timestamp)
}
```

**Streaks.** Derived per pool:
- pity at each 5★, the guarantee state, and whether the 50/50 was won or lost
- The first streak in an import starts at unknown pity, so it's dropped from census statistics.
- The last streak is still open, so it's marked censored. Censored streaks count toward base-rate exposure only.

**Account facts.** Used by Census Tests:
- **region:** from the UID prefix, mapped per game in the registry
- **uidCoarse:** `floor(uid / 1e6)`, a proxy for registration order. About a million accounts share each value.
- **Pull volume** and **gaps** come from the pulls themselves.

**Stored tables (node:sqlite, opt-in data only):**
- `accounts(id, uid_hash, game, region, uid_coarse, tier, delete_token_hash, first_upload, last_upload)`
  - `uid_hash = HMAC-SHA256(salt, game + uid)`
  - tier is `verified` or `self`
- `pulls(account_id, source_id, pool, banner_id, item_id, rarity, time, multi)`, unique on `(account_id, source_id)`
- `shares(code, summary_json, delete_key_hash, created_at)`

Re-uploads merge by `source_id`, so older history fills in over time. A verified re-upload upgrades the account's tier.

**Public dataset:**
- A fresh random pseudonym per account per release.
- Dates only, no times.
- No UID hash and no uidCoarse; Census Tests results are published as aggregates.
- Columns include `seq` (order within its pool, so pity can be counted without times) and `verified`. Region and uidCoarse stay out, so the region and account-age programmes can't be rerun from the public data. `/methods` says so.
- Releases can't be linked to each other or back to a player.

## 6. Import

**Cache file (verified).**
- The import page shows the per-OS path to `webCaches/<version>/Cache/Cache_Data/data_2`. It covers Windows, Steam/Proton and Lutris installs.
- The user picks the file with a file input. If the game has it locked, they copy it first.
- The browser scans it for the last URL that contains `authkey=` and the game's gacha path.
- The file never leaves the browser.
- No downloaded scripts, ever (one tracker's remote script served malware in March 2026).

**Pasted URL (verified).** Manual steps for when the cache file isn't reachable.

**UIGF v4.2 file (self-reported).**
- Comes from Starward, Snap.Hutao and similar apps.
- It feeds PityCheck fully.
- In the census it only counts toward sensitivity checks, never toward verdicts.
- CN-server players use this path in v1.

**`/fetch`:**
- **Request:** POST JSON `{game, url}`. The URL never goes in a query string.
- **Allowed hosts:** the host must exactly match the game's allowlisted host:
  - `public-operation-hk4e-sg.hoyoverse.com`
  - `public-operation-hkrpg-sg.hoyoverse.com`
  - `public-operation-nap-sg.hoyoverse.com`
- **Forwarded parameters:** only `authkey`, `authkey_ver`, `sign_type`, `lang`, `game_biz` and `region`. The server sets the path itself (HSR also calls `getLdGachaLog` for collab banners).
- **Paging:** every pool type in the registry, 20 per page, using `end_id`.
- **Queue:** one global queue per upstream host, one request at a time, at least 500 ms apart.
  - `-110` (too frequent) gets exponential backoff.
  - `-101` (authkey timeout) stops with "reopen your history in game".
- **Response:** NDJSON. Each page streams as it's fetched; the last line is the receipt.
- **Receipt:**
  - `HMAC-SHA256(key, game | uid | sha256(sorted sourceIds) | fetchedAt)`, plus a key id so keys can rotate.
  - Issued only for a complete fetch.
- **Caps:** 30 s timeout per upstream page, and at most 1,000 pages per pool.
- **Headers:** `Referrer-Policy: no-referrer`.

## 7. PityCheck report

Computed in the browser from `core/report`. Each item below is per pool unless it says otherwise.

- **Luck percentile:**
  - The user's mean 5★ pity, compared with accounts that have the same number of complete streaks.
  - The census provides that distribution once it has at least 500 such accounts. Until then it comes from a simulation of the measured model (or the disclosed model before any measurement), labelled as simulated.
- **50/50 record** and the **longest night** (highest pity reached).
- **Constellation:**
  - The user's 5★ in order, with brightness set by how low the pity was.
  - Greek letters are assigned by pity rank.
  - Early stars get a halo and spikes.
- **Lucky stars:**
  - **First Light** is a 5★ at pity 1, about 1 in 167 five-stars.
  - An **early star** is a 5★ at pity 10 or lower, about 1 in 17.
  - Shown with counts and odds, framed as "Rare, not earned".
- **Dry List:**
  - For each featured 5★ the user pulled for, the pulls spent until they got it, or "still dry".
  - Shown as a percentile against the census's pulls-to-featured distribution on that banner. Until that banner has 500 census accounts, the distribution is simulated and labelled that way.
- **"Am I cursed?" test:**
  - An account-level p-value for the user's 50/50 losses and mean pity, under the measured model.
  - Always shown as "about N of the census's M accounts are expected to be at least this unlucky" (N = p × M). Until the census has 500 accounts, it uses "about N in every 10,000 players" instead.
  - Never shown as a yes or no.
- **After a lost 50/50:** when the latest 5★ lost the 50/50, show three things, and no pull button:
  - that the next 5★ is guaranteed featured
  - the median pulls to the next 5★ from current pity
  - the 90th-percentile pulls to the next 5★
- **Combined view (beta):** every game imported in this browser session, side by side. Local only; nothing is linked server-side.
- **Planner (release):**
  - The chance of the featured 5★ within N pulls, given pity and guarantee, on the measured curve.
  - The chance of missing is always shown at the same size as the chance of hitting.

## 8. Census

### 8.1 Pre-registration
- `methods/v1.md` plus the frozen definitions in `core/tests` get the git tag `methods-v1` before `/contribute` accepts its first upload.
- Any change makes a new version. There are no silent edits.
- Every published result cites its method version and commit hash.

### 8.2 Verdict tests (per game × pool)
1. **Base rate:** the hazard at pulls before soft pity, compared with the disclosed base rate. Censored streaks count their pulls.
2. **Hidden floor:** the 5★ count in the first N positions, compared with expected.
3. **Hard pity:** any verified streak longer than the disclosed maximum is flagged. Deterministic.
4. **Featured rate:** P(featured | not guaranteed), compared with the disclosed value.
5. **4★ guarantee:** any 10-pull window without a 4★ or better is flagged. Deterministic.

### 8.3 Census Tests (subgroup comparisons)
Each test compares the base-rate hazard (pulls 1–73) and the 50/50 win rate between groups:
- singles vs 10-pulls (the `multi` flag)
- account age: the lowest vs highest quintile of `uidCoarse`, within each region
- pull volume: the top vs bottom quintile of pulls per 30 days
- returning players: streaks that start after a gap of 60+ days with no pulls, vs all other streaks
- region: the four regions
- before vs after each patch date in the registry

### 8.4 Measured mechanics (no verdict, labelled "measured, not disclosed")
- the soft pity curve: hazard per position with 95% intervals
- the 50/50 win rate after k losses in a row
- the consolidated rate

### 8.5 Rigour
- **Significance:** α = 0.001, with Holm correction across every test in a release.
- **Bootstrap:** clustered by account, with a fixed seed, so anyone can rerun it and get identical numbers.
- **Minimum n:** set per test for 80% power at α = 0.001. The minimum effects to detect are ±25% relative on the base rate and ±5 points on the 50/50. Census Tests use the same thresholds. Below the minimum, the page shows "Seeing too poor: n of needed".
- **Selection bias:**
  - Imports are whole-history only.
  - A sensitivity rerun excludes each account's most recent streak.
  - The verified-only result must agree with the full-pool result, or the page says it doesn't.
  - The methods page publishes the census's own sample statistics.

### 8.6 Beta gate
- Release waits until the census holds at least **1,500 complete verified Genshin character-event streaks**: about 100k pulls from roughly 150 accounts.
- The first mechanic result is the soft pity curve for that pool.
- `methods/v1.md` records the precision this count gives at each position.
- The OneBST dataset (15.6M pulls, no licence) is used for calibration only and is never published.

### 8.7 Verdict wording
Only these fixed strings ever render:
- **Verdict tests:** "Consistent with the disclosed rate", "Differs from the disclosed rate", "Seeing too poor: n of needed".
- **Census Tests:** "No difference found", "Differs", "Seeing too poor: n of needed".

"Differs" always comes with the effect size, the interval, n, and a "what this does and doesn't mean" box. Never "rigged", "lying" or "scam".

### 8.8 Review gate
Any "Differs" verdict, or any hard-pity flag, goes through two steps before it's published:
1. **Maintainer review:** a check of the pipeline for data bugs. It's never a vote on the result. Any bug found is noted on the page.
2. **Publisher notice:** the publisher is told and gets a 14-day reply window. Their reply is published alongside the result.

Both steps can delay publication; neither can stop it.

## 9. Rules Registry

`rules/<game>.json`, validated by a valibot schema in CI, holds:
- disclosed rates, pity rules and 50/50 rules
- the standard-pool list, with effective dates
- the banner schedule: each phase's start, end, pool, and featured 5★ and 4★
- pool type ids, UID-prefix-to-region map, and patch dates

Every entry carries a source URL, an archived (Wayback) URL and a retrieved date. Released data only, never leaks.

- **Daily snapshots:** `snapshot.ts` fetches each source URL and hashes it. On a change, it saves the page to the Wayback Machine and pings the maintainer's webhook. The maintainer updates the rules in a commit, so git history is the tamper-evident record.
- **Change feed:** the `/rules` page is built from the `git log` of `rules/`.
- **Unknown 5★:** if a 5★ isn't in the rules yet, that pool's featured-rate test pauses and shows "rules need update". It never guesses.
- **Upkeep:** one schedule entry per banner phase, about every three weeks per game.

## 10. Site pages

| Path | Content | Stage |
|---|---|---|
| `/import` | game picker, the three import paths, opt-in checkbox | Alpha |
| `/report` | PityCheck (client-side), shown as "Your night". Sub-pages: `/report/clouded` ("Clouded out", the Dry List) and `/report/omen` ("Omen check", the cursed test) | Alpha |
| `/r/<code>` | shared report with the card as og:image | Alpha |
| `/delete` | paste a delete token to wipe your data | Alpha |
| `/methods` | the pre-registration, version history, sample statistics | Alpha |
| `/rules` | "The catalogue": the registry, daily plates with a blink compare, and the change feed | Alpha |
| `/tests` | Census Tests as "observing programmes", with ink corrections and a strip of the latest telegrams | Alpha |
| `/telegrams` | numbered findings feed | Alpha |
| `/` | "Tonight's sky": pull counter, banners running now, latest telegrams, lucky-star counts, Census Tests status | Beta |
| `/games/<game>` | verdicts, mechanics, explainers | Beta |
| `/banners/<game>/<id>` | "Tonight over <game>": n, 50/50 with interval, pity histogram vs disclosed, dated "matches disclosure" status, blink comparator | Beta |
| `/data` | monthly CSV.gz releases with schema and checksum | Release |
| `/planner` | "The sky forecast": the planner | Release |

- **Telegrams** in v1 are findings and aggregate milestones only. Telegrams sent by players come later.
- **The pull counter** reads a cached count endpoint (5-minute cache). Everything else updates nightly and shows an as-of time.
- **Main nav:** Your night (`/report`) · Tonight (the current banner page for the game in view, Genshin by default) · Programmes (`/tests`) · Catalogue (`/rules`) · Forecast (`/planner`) · Log a night (`/import`). The wordmark links to `/`. An item appears only once its page ships: Tonight at beta, Forecast at release. The current page gets `aria-current="page"` and a pencil underline. Clouded out and Omen check sit under Your night as a sub-nav, not in the main nav.
- **Phone nav:** notebook divider tabs fixed at the bottom (Your night, Tonight, Forecast, Contents). Contents opens a ruled sheet listing every page with page numbers, with the sub-pages indented and the current page circled in pencil. It also holds the theme control, red light and a one-line privacy note. The sheet is a modal dialog: background inert, Escape closes it, focus moves in and back. It opens in 320 ms and closes in 220 ms, instantly under reduced motion.
- **Blink comparator** (banner pages and `/rules`): a Blink button swaps plate A and plate B once per press. It never flickers on its own (WCAG 2.3.1), and ink arrows mark what changed. Under reduced motion, or on request, the plates sit side by side.
- **Telegrams:** `/tests` shows the latest few; `/telegrams` keeps the full numbered feed. Telegrams are reachable from the strip and the footer, not the main nav.

## 11. Discord bot

- A new Discord application, separate from Vela.
- **Endpoint:** HTTP interactions at `POST /discord` on the API, verified with Ed25519.
- **Commands:**
  - `/report code:<code>`: embeds a shared report and its card
  - `/odds game:<game>`: census summary
  - `/luck`: an ephemeral link to `/import`
- **No URLs:** command options reject anything URL-shaped without echoing it back.
- **Limit:** the bot has no gateway connection, so it can't read or delete messages. Its install message tells admins how to add a Discord AutoMod keyword rule that blocks `authkey=`.
- **Registration:** `register-commands.ts` registers the commands. The user runs it with their bot token.

## 12. Share cards

- **Design:** "the sky card", a postcard in the style of Dear Data (board V6SkyCard).
  - **Front:** the 1200×630 image. It shows the taped dark sky print with the plate number, game, percentile line, featured x of y, early stars, longest night and the pities in order. It carries no luck ranks.
  - **Back:** on the site only; the card turns over in 600 ms, and crossfades instead under reduced motion. It holds the key of marks, context lines (e.g. "5★ at 81 · census median 76 · catalogue says ≤ 90"), the method version, a postage stamp identical on every card, and a plain line saying the card carries no UID, times or ids.
- **Variants:** standard, early star and First Light, all SVG. A variant changes only the headline and adds a pencil note; nothing else differs.
- **Colours:** the card is an image, so it keeps its postcard colours in light and dark. Red light recolours only the on-site preview, and download is off while red light is on.
- **Rendering:** resvg-js renders them to PNG at `/card/<code>.png` (1200×630), cached on disk by code. The site's Download button fetches this PNG; the browser never rasterises the card.
- **Content:** a summary only:
  - game, percentile, featured x of y, early-star count, longest night
  - the list of 5★ pities, with no times or ids
- **Fonts:** Bodoni Moda and Martian Mono (both OFL), embedded.

## 13. Design system

**Direction: "Observer's notebook" (C v2, locked 2026-10-09).** The site is an astronomer's observing notebook. Each pity cycle is still a night, from dusk at pull 1 to midnight at pull 90. The user's sky is a photo print taped into the notebook.

- **Where to look:**
  - World rules and vocabulary: board V4Lexicon.
  - Reference boards: V5CNight and V5CImport, plus their dark wrappers.
  - Every other screen (rounds 2 and 3, locked 2026-10-09): V6Clouded, V6Omen, V6Tonight, V6Forecast, V6Programmes, V6Catalogue, V6SkyCard, V6Phone, V7Home, V7Game, V7Shared, V7Methods, V7Data and V7Delete, each with a dark wrapper.
  - Research behind it: `pull-census-spikes/research/c-*.md`.
  - Local backup: `pull-census-spikes/concepts/`.
- **Laws** (from V4Lexicon):
  1. Time runs from dusk to midnight.
  2. Amber is measured.
  3. Blue is the catalogue.
  4. Brightness is rarity, early or late.
  5. Wobble or blur is uncertainty.
  6. Clouds mean not enough data, shown as "seeing too poor".
  7. The sky never asks you to pull.

  Privacy, deletion, data rights, errors and money keep plain words, with no metaphor.
- **Themes:**
  - **Light:** grid paper.
  - **Dark:** black paper and gel pens on a night desk. A faint warm lamp glow sits at the top edge, never behind text.
  - **Red light** ("at the telescope") is an extra view, not a theme: red on black, with measured and catalogue told apart by ● and ○.
- **Colour tokens:** every text pair is at least 4.5:1. Amber is always the lighter ink, at least 15 L\* above blue, so the two stay apart in greyscale and for colour-blind readers.

  | Token | Light | Dark |
  |---|---|---|
  | paper | `#EEF0EA` | `#0E1219` |
  | sheet | `#F7F8F4` | `#161B25` |
  | grid (decorative) | `#DCE2EA` | `#1D2532` |
  | ink | `#1B2335` | `#E8ECF2` |
  | ink-2 | `#3B465C` | `#B6BFCD` |
  | muted | `#5A6578` | `#8D97A8` |
  | measured text | `#8C5A00` | `#F2B544` |
  | measured mark (graphics only) | `#B07800` | `#E0A43A` |
  | catalogue text | `#1B3684` | `#5E88D8` |
  | catalogue mark | `#24489E` | `#4F7BD0` |
  | highlight wash | `#F7ECCF` | `#262013` |
  | stamp ink | `#A8322B` | `#E57F72` |
  | tape | `rgb(226 214 170 / .55)` | `rgb(201 188 148 / .12)` |

- **Colour rules:**
  - Tape carries only ink or stamp, never catalogue-blue text.
  - The measured-mark colour is never used for text.
  - Amber and blue marks that touch get a 1–2 px gap and direct labels.
  - Tape, glows and user ink stay neutral, never amber or blue.
  - Never use `filter: invert()`: it swaps amber and blue.
- **Sky print:**
  - Always the dark positive in both themes: gradient `#2E3F63` to `#06080C`, census stars `#F4E6C8`, user stars `#F2B544`. It sits on white photo paper, with a 1 px muted edge in dark mode.
  - "Show as negative plate" is a switch on the figure: a pale plate `#E6E3D8` with dark stars, and user stars ringed in `#8C5A00`. It is drawn from the data, never inverted.
  - The print stylesheet uses the negative.
- **Implementation:**
  - One token list using `light-dark()` and `color-scheme: light dark`, with `[data-theme]` overrides and `.sky-print { color-scheme: dark }`.
  - An `is:inline` head script reads `pc-theme` from localStorage before first paint. The snippet is in `c-light-dark.md`.
  - Don't register tokens with `@property`.
  - Inline SVG charts use CSS-class fills.
- **Theme control:**
  - A plain System / Light / Dark radio group in the footer ("inside the back cover").
  - Captions: "match device", "grid paper", "black paper, gel pens".
  - The switch is instant, with an optional 120 ms cross-fade when the user has no motion preference.
- **Type:**
  - **Bodoni Moda:** headings and big numbers, with `opsz 14` on numerals.
  - **Martian Mono:** data, tables, UI and all small numbers, using `tabular-nums`.
  - **Shantell Sans (OFL):** handwriting for short notes only, about 8 words or fewer, at 16 px or larger.
    - Never used for numbers, links, buttons or labels, and never italic.
    - Instanced at wght 400–700 plus BNCE, with INFM fixed, subset to Basic Latin (about 56–69 KB). Other scripts load through `unicode-range`.
    - A "Neat handwriting" setting switches notes to Martian Mono.
- **Props rule:** every prop stands for a state.
  - **Tape** means a taped-in print.
  - **A stamp** is a recorded fact (LOGGED, AMENDED, SEEING) and is identical for everyone.
  - **Each night gets a plate number** (`GI·C·0417`) and a jacket card: plate, pulls, marks, logged date and source hash.
  - **An abbreviation key "inside the cover"** lists SP, L, P, E and `≥n ›`. An unfinished night is drawn as `≥n ›`.
  - **Census figures carry a seeing stamp** derived from sample size.
  - **No decorative clutter:** no washi tape, coffee rings or spiral bindings.
  - **"Clean plate"** hides all hand notes and tape.
- **Layout:**
  - Fluid, using `clamp()`, auto-fit grids and SVG `viewBox` scaling.
  - On desktop it is a two-page spread: data on the left, the sky and notes on the right. The pages stack on phones.
  - Checked at 360, 768 and 1440 px in both themes.
- **Charts:**
  - Hand-rolled SVG, each with a table view.
  - Data marks are always crisp. Only uncertainty bands and annotations are drawn rough, with a seeded wobble sized to the interval.
  - rough.js runs at build time only, so nothing ships to the client.
- **Motion:**
  - CSS and Web Animations with `linear()` springs and View Transitions. Animate only transform and opacity.
  - **The develop reveal:** the dark sky develops from dusk to midnight at a constant speed, in at most 2.4 s. Stars show in their final colour from the first frame. Tapping the print, pressing any key or Skip finishes it ("agitate the tray").
  - **Pencil circle:** draws itself around the selection in about 550 ms.
  - **Stamp:** lands with a squash in about 360 ms, with a random tilt of up to ±4°.
  - **Self-starting loops** such as line boil stop within 1.5 s; WCAG 2.2.2 allows 5 s at most. Don't use `feTurbulence` on mobile.
  - **Notebook cover:** opens once per visit.
  - **Reduced motion:** fades or no animation.
- **User marks** (optional, never asked for):
  - A margin note per night and pencil doodles (perfect-freehand), stored only on the device.
  - A keyboard "Circle" equivalent, plus Undo and Clear.
  - Cover choice: Graphite, Moss, Clay or Kraft, all available from day one.
- **Sound:** off by default. After a silent reveal, "Replay with sound" loads about 5 ZzFX sounds. The planner is always silent.

## 14. Ethics rules (build-blocking)

- Rare, not earned: luck is never framed as skill or as a reason to pull again.
- No pull button next to a reveal, no near-miss fake-outs, no spending nudges, no luck leaderboards, no casino cues.
- The planner always shows the chance of missing.
- Flashes peak at amber, with at least 150 ms up and 400 ms down.
- Notebook props never reward:
  - Stamps are identical for every import.
  - Nothing unlocks through pulls, imports, streaks or luck.
  - No "x of y" collection counters and no empty slots waiting to be filled.

## 15. Security and privacy

- **The history URL is a secret.**
  - It travels only in POST bodies and is never logged.
  - Caddy logs don't include request bodies.
  - `/fetch` stores nothing.
- **`/fetch`:** host allowlist, parameter allowlist, per-IP rate limit, so it can't be used as an open proxy.
- **`/contribute` is a trust boundary:**
  - valibot schema, size caps
  - plausibility checks (time order, unique `sourceId`, known pool, at most 50k pulls per upload)
  - receipt check, per-IP rate limit
- **Banned inputs:** HAR files, capture tools, account tokens and remote-fetched scripts.
- **Privacy:**
  - No analytics and no cookies.
  - Shared reports hold summary numbers only.
  - Delete tokens wipe an account's data with no account system.
- **Deletion:**
  - A token deletes every stored pull for the game account it was issued to, across all merged uploads, plus the account row. Tokens are stored only as hashes.
  - Deleted pulls drop out of the next nightly run and the next monthly release. Releases already published aren't reissued: they carry per-release pseudonyms and can't be linked back to a player. The opt-in checkbox says this before anything is uploaded.
  - Backups purge deleted pulls within 30 days.
  - A lost token can't be recovered, because there are no accounts. The contribute step says so when it shows the token.
  - `/delete` has the same per-IP rate limit as `/contribute`.
  - **Shared cards:** only the card's delete key, kept in the sharer's browser, deletes it.
  - **On this device:** imported pulls stay in browser storage until the user clears them. `/delete` lists everything stored on the device (pulls, notes, marks, slips, share keys, settings) with one button to clear it.
- **Headers:** strict CSP on the site.
- **Secrets** live in `.env`:
  - the receipt HMAC key (with a key id)
  - the UID salt
  - the Discord public key
  - the Cloudflare deploy hook

## 16. Errors

- **Expired authkey (`-101`) or a bad URL:** "reopen your history in game".
- **Partial fetch:** no receipt, so the pulls can only land in the self-reported tier.
- **Unknown 5★:** the test pauses and the page shows "rules need update" (section 9).
- **Batch failure:** the last good results stay up, and the maintainer gets a webhook ping.
- **Cache file without a history URL:** tell the user to open the history in game first, then pick the file again.
- **Deploy hook failure:** retried once; then a webhook ping, and the site keeps the previous build.
- **Delete token not recognised:** "We couldn't find that token. Check you pasted all of it." Nothing is deleted.
- **Delete token already used:** "This token has already been used, so that data is gone."
- **Delete request can't reach the server:** "Nothing was deleted. Try again in a minute."
- **Shared card code unknown or deleted:** "Card not found." with a link to log your own night.

## 17. Testing

- **Runners:** `node:test` with `fast-check` property tests for parsers and stats. Biome for lint and format.
- **Stats:** golden values precomputed in scipy and committed.
- **Simulation suite:**
  - Each game's disclosed rules, plus planted deviations: a hidden floor, a 45% 50/50, a 0.5% base rate.
  - The tests must catch every planted deviation and must not flag clean runs.
  - A slow suite checks the false-positive rate across many seeds.
- **Calibration:** run against OneBST. It must recover soft pity onset near pull 74 and a base rate near 0.6%.
- **Parsers:** recorded, anonymized responses per game. Fixtures never contain authkeys.
- **API:** the SSRF allowlist, receipt signing and checking, `/contribute` validation, and Discord signature checks.
- **Browser:** Playwright runs the flow from import to report to share at 360, 768 and 1440 px, in light and dark, with and without reduced motion.

## 18. Ops

- **Site:** static build on Cloudflare's free tier. The nightly batch triggers rebuilds through a deploy hook.
- **API host:** Docker compose with Caddy (TLS and reverse proxy), the api, and Litestream (replicating to an S3-compatible bucket the user picks).
- **Schedules:** host cron runs `batch.ts` nightly at 03:00 UTC and `snapshot.ts` daily.
- **Datasets:** generated monthly by the batch.
- **The user's steps:** domains, the Discord bot token, the Cloudflare account, and deploys.

## 19. Build plans

Too big for one implementation plan, so it's split into five, built in order:

1. **core:** Genshin rules (including the banner schedule, which the Dry List needs), parsers, stats, simulator, OneBST calibration, and the first draft of `methods/v1.md`.
2. **Alpha site:**
   - import (`/fetch`, cache file, UIGF) and PityCheck with everything in section 7 marked alpha
   - share cards, `/contribute` and `/delete`
   - `methods-v1` is tagged before `/contribute` goes live
3. **Census:** batch, verdicts, Census Tests, registry snapshots and the change feed, telegrams, and the methods, rules and tests pages.
4. **Beta:** HSR and ZZZ adapters, the bot, banner pages, home page, combined view, and measured mechanics with explainers.
5. **Release:** dataset releases, the planner, hardening, and launch.

## 20. Decisions defaulted here (change at review)

- **Licences:** core MIT, apps AGPL-3.0, dataset CC BY 4.0.
- **Repo:** `ZeekyBlast/pull-census`, public.
- **Publisher reply window:** 14 days.
- **Beta gate:** 1,500 complete verified Genshin character-event streaks.
- **Minimum detectable effects:** ±25% relative on the base rate, ±5 points on the 50/50.
- **Account-age proxy:** UID magnitude, as `uidCoarse`.
- **Deletion:** account-wide tokens, published releases not reissued, backups purged within 30 days (section 15).
- **Dataset columns:** `seq` and `verified` included; region and uidCoarse excluded (section 5).

## 21. Changes from the approved design sections

- **Design direction:** the Observer's notebook (C v2, with light and dark themes) replaces Dusk to Midnight. The night metaphor and the V4Lexicon vocabulary carry over.
- **Round 3 pages:** the remaining six pages (`/`, `/games/<game>`, `/r/<code>`, `/methods`, `/data`, `/delete`) have notebook boards (V7*); `/delete` stays plain. The gaps those boards found are settled: deletion scope and retention, share-card delete keys, device storage, delete errors and dataset columns.
- **Round 2 screens:** the eight missing screens now have locked notebook boards (V6*). The nav uses sky names over plain paths, the report gains the Clouded out and Omen check sub-pages, and the share card becomes the two-sided sky card.
- **Name and games:** the project is Pull Census (repo `pull-census`). v1 covers the three HoYo games; WuWa moves to v1.1.
- **Fewer apps:** `apps/batch` and `apps/bot` are folded into `apps/api` as a script and an HTTP route.
- **Bot:** it uses HTTP interactions, so it can't delete pasted links. Discord AutoMod covers that instead.
- **Share cards** move from v1.1 into v1.
- **Import:** picking the cache file replaces the inline script snippet.
- **Stack:** Hono, valibot, `node:sqlite`, Cloudflare static hosting and Litestream replace discord.js, nightly `.backup` and Caddy-served static files.
- **History window:** Genshin history goes back 1 year (not 6 months).
- **Banner schedule:** banner pages and the Dry List need one, so registry upkeep grows to one entry per banner phase.
- **Added:**
  - verdict strings in the observing-log voice ("Seeing too poor")
  - Census Tests
  - the publisher reply window
  - the beta gate
  - the PityCheck extras from the feature sort
