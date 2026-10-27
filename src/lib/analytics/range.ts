import type { AnalyticsRange, Granularity, RangePreset } from './types'

/**
 * Date maths for the admin dashboard.
 *
 * Every bucket boundary is computed in **market-local time** (Asia/Dhaka, UTC+6) rather than
 * UTC. This matters: a reservation created at 03:00 Dhaka time is stored as 21:00 UTC the
 * previous day, so UTC bucketing would file six hours of every day under yesterday. Labels are
 * formatted by hand instead of with `Intl` so the output is stable across runtimes and in tests.
 */

export const MARKET_UTC_OFFSET_MINUTES = 360

const MARKET_OFFSET_MS = MARKET_UTC_OFFSET_MINUTES * 60_000
export const MS_PER_DAY = 86_400_000

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

interface MarketParts {
  year: number
  month: number
  day: number
}

function marketParts(date: Date): MarketParts {
  const shifted = new Date(date.getTime() + MARKET_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  }
}

/** The absolute instant at which the given market-local calendar day begins. */
function marketMidnight({ year, month, day }: MarketParts): Date {
  return new Date(Date.UTC(year, month, day) - MARKET_OFFSET_MS)
}

export function startOfMarketDay(date: Date): Date {
  return marketMidnight(marketParts(date))
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

export function addMonths(date: Date, months: number): Date {
  const { year, month, day } = marketParts(date)
  return marketMidnight({ year, month: month + months, day })
}

/** YYYY-MM-DD for the market-local calendar day containing `value`. */
export function marketDayKey(value: Date | string): string {
  const { year, month, day } = marketParts(new Date(value))
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Sunday-anchored week start, matching the Bangladeshi working week. */
export function startOfMarketWeek(date: Date): Date {
  const start = startOfMarketDay(date)
  const weekday = new Date(start.getTime() + MARKET_OFFSET_MS).getUTCDay()
  return addDays(start, -weekday)
}

export function startOfMarketMonth(date: Date): Date {
  const { year, month } = marketParts(date)
  return marketMidnight({ year, month, day: 1 })
}

export function bucketStart(date: Date, granularity: Granularity): Date {
  if (granularity === 'month') return startOfMarketMonth(date)
  if (granularity === 'week') return startOfMarketWeek(date)
  return startOfMarketDay(date)
}

/** Stable bucket identity for a timestamp — the market-local day the bucket opens on. */
export function bucketKey(value: Date | string, granularity: Granularity): string {
  return marketDayKey(bucketStart(new Date(value), granularity))
}

export function bucketLabel(start: Date, granularity: Granularity): string {
  const { year, month, day } = marketParts(start)
  if (granularity === 'month') return `${MONTHS[month]} ${year}`
  return `${day} ${MONTHS[month]}`
}

export const RANGE_PRESETS: { label: string; value: RangePreset }[] = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Last 12 months', value: '12m' },
  { label: 'Year to date', value: 'ytd' },
]

const GRANULARITY_BY_PRESET: Record<RangePreset, Granularity> = {
  '7d': 'day',
  '30d': 'day',
  '90d': 'week',
  '12m': 'month',
  ytd: 'month',
}

export function isRangePreset(value: unknown): value is RangePreset {
  return typeof value === 'string' && value in GRANULARITY_BY_PRESET
}

/**
 * Resolve a preset into an absolute window. `to` is the start of tomorrow (market time) so the
 * current day is always fully included, and `from` is inclusive.
 */
export function resolveRange(preset: RangePreset, now: Date = new Date()): AnalyticsRange {
  const to = addDays(startOfMarketDay(now), 1)
  let from: Date

  switch (preset) {
    case '7d':
      from = addDays(to, -7)
      break
    case '30d':
      from = addDays(to, -30)
      break
    case '90d':
      from = addDays(to, -90)
      break
    case '12m':
      from = addMonths(startOfMarketMonth(now), -11)
      break
    case 'ytd':
      from = marketMidnight({ ...marketParts(now), month: 0, day: 1 })
      break
  }

  const label = RANGE_PRESETS.find((entry) => entry.value === preset)?.label ?? preset

  return {
    from,
    to,
    granularity: GRANULARITY_BY_PRESET[preset],
    preset,
    label,
    days: Math.max(1, Math.round((to.getTime() - from.getTime()) / MS_PER_DAY)),
  }
}

/** Every bucket in the window, in order, including empty ones. */
export function enumerateBuckets(range: AnalyticsRange): { key: string; label: string }[] {
  const buckets: { key: string; label: string }[] = []
  const { granularity } = range
  let cursor = bucketStart(range.from, granularity)

  // Guard against a pathological config producing an unbounded loop.
  for (let i = 0; cursor.getTime() < range.to.getTime() && i < 400; i += 1) {
    buckets.push({ key: marketDayKey(cursor), label: bucketLabel(cursor, granularity) })
    cursor =
      granularity === 'month'
        ? addMonths(cursor, 1)
        : addDays(cursor, granularity === 'week' ? 7 : 1)
  }

  return buckets
}

/**
 * Whole nights of a stay that fall inside the window. Used for occupancy, where the stay dates
 * matter, unlike revenue metrics which are counted at reservation date.
 */
export function nightsWithinRange(
  checkInDate: Date | string,
  checkOutDate: Date | string,
  range: AnalyticsRange,
): number {
  const start = Math.max(startOfMarketDay(new Date(checkInDate)).getTime(), range.from.getTime())
  const end = Math.min(startOfMarketDay(new Date(checkOutDate)).getTime(), range.to.getTime())
  if (end <= start) return 0
  return Math.round((end - start) / MS_PER_DAY)
}
