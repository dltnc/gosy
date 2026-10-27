import React from 'react'

/** Compact KPI tiles. `tone` colours the delta/help line, not the number itself. */
export interface StatTile {
  key: string
  label: string
  value: string
  help?: string
  tone?: 'default' | 'negative' | 'positive' | 'warning'
}

const TONE_COLORS: Record<NonNullable<StatTile['tone']>, string> = {
  default: 'var(--theme-elevation-400)',
  positive: 'var(--theme-success-500)',
  negative: 'var(--theme-error-500)',
  warning: 'var(--theme-warning-500)',
}

export function StatTiles({ tiles }: { tiles: StatTile[] }) {
  return (
    <dl
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
        gap: 10,
        margin: 0,
      }}
    >
      {tiles.map((tile) => (
        <div
          key={tile.key}
          style={{
            padding: '10px 12px',
            border: '1px solid var(--theme-elevation-100)',
            borderRadius: 'var(--style-radius-s, 4px)',
            background: 'var(--theme-elevation-50)',
            minWidth: 0,
          }}
        >
          <dt
            style={{
              margin: 0,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--theme-elevation-450)',
            }}
          >
            {tile.label}
          </dt>
          <dd
            style={{
              margin: '4px 0 0',
              fontSize: 19,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
              color: 'var(--theme-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {tile.value}
          </dd>
          {tile.help ? (
            <p
              style={{
                margin: '2px 0 0',
                fontSize: 10,
                lineHeight: 1.35,
                color: TONE_COLORS[tile.tone ?? 'default'],
              }}
            >
              {tile.help}
            </p>
          ) : null}
        </div>
      ))}
    </dl>
  )
}
