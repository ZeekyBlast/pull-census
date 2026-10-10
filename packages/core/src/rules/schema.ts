import * as v from 'valibot'

/** Every registry entry carries where it came from (spec section 9). */
export const Source = v.object({
  url: v.pipe(v.string(), v.url(), v.startsWith('https://')),
  archive: v.pipe(v.string(), v.startsWith('https://web.archive.org/web/')),
  retrieved: v.pipe(v.string(), v.isoDate()),
})

const Probability = v.pipe(v.number(), v.minValue(0), v.maxValue(1))
const PositiveInt = v.pipe(v.number(), v.integer(), v.minValue(1))
const sourced = <T extends v.GenericSchema>(value: T) => v.object({ value, source: Source })

/** An instant (version-update phases start after a global maintenance) or a server-local wall clock. */
export const TimePoint = v.union([
  v.object({ utc: v.pipe(v.string(), v.isoTimestamp()) }),
  v.object({ serverLocal: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)) }),
])

export const PoolRules = v.object({
  /** API gacha_type values that share this pool's pity. */
  gachaTypes: v.pipe(v.array(v.string()), v.minLength(1)),
  /** false for pools the census never tests (the beginner wish). */
  inCensus: v.boolean(),
  base5: sourced(Probability),
  consolidated5: sourced(Probability),
  hardPity5: sourced(PositiveInt),
  base4: sourced(Probability),
  guarantee4Every: sourced(PositiveInt),
  /** P(featured | not guaranteed); null for pools without a featured 5★. */
  featuredRate: v.nullable(sourced(Probability)),
  /** A disclosed catch-up mechanic (e.g. Capturing Radiance). Makes the featured-rate test one-sided. */
  catchUp: v.nullable(sourced(v.string())),
  guaranteeAfterLoss: v.boolean(),
  /** A chart course with Fate Points (Epitomized Path): the state after a featured 5★ can't be known from history. */
  chartPath: v.nullable(sourced(PositiveInt)),
  source: Source,
})

export const Phase = v.object({
  id: v.string(),
  gachaType: v.string(),
  version: v.string(),
  start: TimePoint,
  /** Inclusive, as published (e.g. 17:59:59 server time). */
  end: TimePoint,
  featured5: v.pipe(v.array(v.string()), v.minLength(1)),
  featured4: v.array(v.string()),
  source: Source,
})

export const Rules = v.object({
  game: v.picklist(['genshin', 'hsr', 'zzz']),
  pools: v.record(v.string(), PoolRules),
  standard5: v.array(
    v.object({
      itemId: v.string(),
      name: v.string(),
      from: v.pipe(v.string(), v.isoDate()),
      to: v.nullable(v.pipe(v.string(), v.isoDate())),
      source: Source,
    }),
  ),
  schedule: v.array(Phase),
  regions: v.array(
    v.object({
      prefix: v.pipe(v.string(), v.regex(/^\d+$/)),
      /** UID length this prefix applies to; null for any length. */
      digits: v.nullable(PositiveInt),
      region: v.string(),
      source: Source,
    }),
  ),
  patches: v.array(v.object({ version: v.string(), start: TimePoint, source: Source })),
})

export type Rules = v.InferOutput<typeof Rules>
export type PoolRules = v.InferOutput<typeof PoolRules>
export type Phase = v.InferOutput<typeof Phase>
export type TimePoint = v.InferOutput<typeof TimePoint>
