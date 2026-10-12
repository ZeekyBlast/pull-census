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
