import type { AnswerStatus } from '@/lib/types'

const TAG_BASE = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium'
const FALLBACK_COLOR = 'bg-muted text-muted-foreground'

/* ── Status ── */
const STATUS_COLORS: Record<AnswerStatus, string> = {
  Yet:    'bg-red-500/20 text-red-400',
  Repeat: 'bg-orange-500/20 text-orange-400',
  Check:  'bg-amber-400/20 text-amber-300',
  Recall: 'bg-green-500/20 text-green-400',
  Done:   'bg-blue-500/20 text-blue-400',
}

/** Opaque variant — colour-mixed onto --card so no bleed-through on timeline lines */
const STATUS_COLORS_OPAQUE: Record<AnswerStatus, string> = {
  Yet:    'text-red-400 bg-[color-mix(in_srgb,var(--card),theme(colors.red.500)_20%)]',
  Repeat: 'text-orange-400 bg-[color-mix(in_srgb,var(--card),theme(colors.orange.500)_20%)]',
  Check:  'text-amber-300 bg-[color-mix(in_srgb,var(--card),theme(colors.amber.400)_20%)]',
  Recall: 'text-green-400 bg-[color-mix(in_srgb,var(--card),theme(colors.green.500)_20%)]',
  Done:   'text-blue-400 bg-[color-mix(in_srgb,var(--card),theme(colors.blue.500)_20%)]',
}

export const STATUS_DOT_COLORS: Record<AnswerStatus, string> = {
  Yet:    'bg-red-400',
  Repeat: 'bg-orange-400',
  Check:  'bg-amber-300',
  Recall: 'bg-green-400',
  Done:   'bg-blue-400',
}

export function StatusTag({ status, className, opaque }: { status: AnswerStatus; className?: string; opaque?: boolean }) {
  const colors = opaque ? STATUS_COLORS_OPAQUE[status] : STATUS_COLORS[status]
  return <span className={`${TAG_BASE} ${colors} ${className ?? ''}`}>{status}</span>
}

/* ── Level (color from project) ── */
export function LevelTag({ level, color }: { level: string; color?: string }) {
  return <span className={`${TAG_BASE} ${color ?? FALLBACK_COLOR}`}>{level}</span>
}

/* ── Subject (color from project) ── */
export function SubjectTag({ subject, color }: { subject: string; color?: string }) {
  return <span className={`${TAG_BASE} ${color ?? FALLBACK_COLOR}`}>{subject}</span>
}
