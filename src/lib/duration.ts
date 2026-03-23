// Re-export from forgetting-curve to avoid duplication
export { parseDurationSec as parseDuration } from './forgetting-curve'

/** Format seconds difference as HH:MM:SS (leading zero segments omitted) */
export function fmtDiff(sec: number): string {
  const abs = Math.abs(sec)
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = abs % 60
  const ss = String(s).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  if (h > 0) return `${h}:${mm}:${ss}`
  if (m >= 10) return `${mm}:${ss}`
  return `${m}:${ss}`
}
