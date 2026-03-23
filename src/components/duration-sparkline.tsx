import { parseDuration } from '@/lib/duration'

/** Tiny SVG sparkline for duration trend (oldest→newest, evenly spaced) */
export function DurationSparkline({ durations }: { durations: (string | null)[] }) {
  const secs = durations.map(parseDuration).filter((v): v is number => v !== null)
  if (secs.length < 2) return null
  const min = Math.min(...secs)
  const max = Math.max(...secs)
  const range = max - min || 1
  const w = 64
  const h = 20
  const pad = 2
  const points = secs.map((v, i) => {
    const x = pad + (i / (secs.length - 1)) * (w - pad * 2)
    const y = pad + (1 - (v - min) / range) * (h - pad * 2)
    return `${x},${y}`
  }).join(' ')
  const trend = secs[secs.length - 1] - secs[0]
  const color = trend < 0 ? '#4ade80' : trend > 0 ? '#f87171' : '#888'
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
