import type { AnswerStatus } from './types'
import { ANSWER_STATUSES } from './types'

/** Determine next status based on the most recent answer */
export function nextStatus(
  answers: { date: string | null; status: AnswerStatus | null }[],
): AnswerStatus {
  const sorted = [...answers]
    .filter((a) => a.date)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  const last = sorted[0]?.status as AnswerStatus | undefined
  if (!last) return 'Yet'
  const idx = ANSWER_STATUSES.indexOf(last)
  return idx >= 0 && idx < ANSWER_STATUSES.length - 1
    ? ANSWER_STATUSES[idx + 1]
    : ANSWER_STATUSES[ANSWER_STATUSES.length - 1]
}
