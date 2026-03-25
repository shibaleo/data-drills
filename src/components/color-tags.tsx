import type { AnswerStatus } from '@/lib/types'
import { ColorBadge } from '@/components/shared/color-badge'

const TAG_BASE = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium'

/* ── Status hex fallback (used when DB color is not available) ── */
const STATUS_HEX: Record<AnswerStatus, string> = {
  Yet:    '#EF4444',
  Repeat: '#F97316',
  Check:  '#EAB308',
  Recall: '#22C55E',
  Done:   '#3B82F6',
}

/** Opaque variant — colour-mixed onto --card so no bleed-through on timeline lines */
const STATUS_COLORS_OPAQUE: Record<AnswerStatus, string> = {
  Yet:    'text-red-400 bg-[color-mix(in_srgb,hsl(var(--card)),theme(colors.red.500)_20%)]',
  Repeat: 'text-orange-400 bg-[color-mix(in_srgb,hsl(var(--card)),theme(colors.orange.500)_20%)]',
  Check:  'text-amber-300 bg-[color-mix(in_srgb,hsl(var(--card)),theme(colors.amber.400)_20%)]',
  Recall: 'text-green-400 bg-[color-mix(in_srgb,hsl(var(--card)),theme(colors.green.500)_20%)]',
  Done:   'text-blue-400 bg-[color-mix(in_srgb,hsl(var(--card)),theme(colors.blue.500)_20%)]',
}

export const STATUS_DOT_COLORS: Record<AnswerStatus, string> = {
  Yet:    'bg-red-400',
  Repeat: 'bg-orange-400',
  Check:  'bg-amber-300',
  Recall: 'bg-green-400',
  Done:   'bg-blue-400',
}

/** Status badge using ColorBadge. Accepts optional hex color override from DB. */
export function StatusTag({ status, color, className, opaque }: { status: AnswerStatus; color?: string | null; className?: string; opaque?: boolean }) {
  if (opaque) {
    const colors = STATUS_COLORS_OPAQUE[status]
    return <span className={`${TAG_BASE} ${colors} ${className ?? ''}`}>{status}</span>
  }
  return <ColorBadge color={color ?? STATUS_HEX[status]} className={className}>{status}</ColorBadge>
}

/** Generic entity badge using ColorBadge (for subjects, levels, tags, topics, etc.) */
export function EntityBadge({ name, color, className }: { name: string; color?: string | null; className?: string }) {
  if (!color) {
    return <span className={`${TAG_BASE} bg-muted text-muted-foreground ${className ?? ''}`}>{name}</span>
  }
  return <ColorBadge color={color} className={className}>{name}</ColorBadge>
}
