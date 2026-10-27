'use client'

interface RevenueChartProps {
  values: number[]
  rangeLabel: string
}

function buildPath(values: number[], width: number, height: number): { line: string; area: string } {
  if (values.length < 2) return { line: '', area: '' }
  const max = Math.max(...values, 1)
  const step = width / (values.length - 1)
  const points = values.map((value, index) => {
    const x = index * step
    const y = height - (value / max) * (height - 4) - 2
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
  const line = `M${points.join(' L')}`
  const area = `${line} L${width},${height} L0,${height} Z`
  return { line, area }
}

export function RevenueChart({ values, rangeLabel }: RevenueChartProps) {
  const width = 100
  const height = 40
  const { line, area } = buildPath(values, width, height)
  const hasData = values.some((value) => value > 0)

  const ticks = [0, Math.floor(values.length / 3), Math.floor((values.length * 2) / 3), values.length - 1]

  return (
    <div>
      <div className="relative h-56 w-full">
        {hasData ? (
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`Revenue over the ${rangeLabel.toLowerCase()}`}
          >
            <path d={area} className="fill-primary-fixed/40" />
            <path d={line} className="fill-none stroke-primary-container" strokeWidth={0.8} />
          </svg>
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
            No check-ins in this period yet. New bookings appear here once their check-in
            date arrives.
          </div>
        )}
      </div>
      <div className="mt-3 flex justify-between border-t border-outline pt-3">
        {ticks.map((tick) => (
          <span key={tick} className="text-[11px] font-semibold text-muted-foreground">
            Day {tick + 1}
          </span>
        ))}
      </div>
    </div>
  )
}
