/**
 * FSRS-based scoring utilities.
 *
 * Retention (power-law):
 *   R(t, S) = (1 + F * t / S) ^ C
 *   F = 19/81, C = -0.5
 *
 * Score:
 *   Score = P_i × C_T
 *   P_i = (I_i / I_max)^γ × 100   (Stevens' Power Law)
 *   C_T = c × t_std / t_dur
 */

import type { AnswerStatus } from './types'

/* ── Constants ── */

const F = 19 / 81
const C = -0.5

/** Stevens' Power Law exponent for evaluation points */
const GAMMA = 0.5

/** Target ratio of standard time to answer time */
const TIME_COEFF_C = 0.5

/** Stability initial value (days until R=90%) per status */
export const STATUS_STABILITY: Record<AnswerStatus, number> = {
  Yet: 0,
  Repeat: 7,
  Check: 29,
  Recall: 65,
  Done: 180,
}

export const STATUS_COLORS: Record<AnswerStatus, string> = {
  Yet: '#ef4444',     // red
  Repeat: '#f97316',  // orange
  Check: '#eab308',   // yellow
  Recall: '#22c55e',  // green
  Done: '#3b82f6',    // blue
}

/* ── Core functions ── */

/**
 * Compute evaluation point P_i from status.
 * P_i = (I_i / I_max)^γ × 100
 */
export function computeEvalPoint(status: AnswerStatus): number {
  const I_max = Math.max(...Object.values(STATUS_STABILITY))
  const I_i = STATUS_STABILITY[status]
  if (I_max <= 0 || I_i <= 0) return 0
  return Math.pow(I_i / I_max, GAMMA) * 100
}

/**
 * FSRS power-law retention.
 * Returns 0–1.
 */
export function fsrsRetention(elapsedDays: number, stability: number): number {
  if (stability <= 0 || elapsedDays < 0) return 0
  return Math.pow(1 + F * elapsedDays / stability, C)
}

/**
 * Compute problem score.
 * Score = P_i × C_T
 * P_i = (I_i / I_max)^γ × 100
 * C_T = c × t_std / t_dur  (defaults to 1 if time data missing)
 */
export function computeScore(
  status: AnswerStatus,
  standardTimeSec: number | null,
  durationSec: number | null,
): number {
  const Pi = computeEvalPoint(status)
  if (Pi === 0) return 0
  const Ct =
    standardTimeSec && durationSec && durationSec > 0
      ? TIME_COEFF_C * standardTimeSec / durationSec
      : 1
  return Pi * Ct
}

/**
 * Get stability (days) for a status.
 */
export function getStability(status: AnswerStatus): number {
  return STATUS_STABILITY[status]
}

/**
 * Compute next review date from last answer date and status.
 * When standardTimeSec and durationSec are provided, stability is adjusted:
 *   adjustedStability = base × C_T,  C_T = c × t_std / t_dur
 * Reference point: t_dur = t_std/2 → C_T = 1 (unchanged from base).
 */
export function computeNextReview(
  lastDateStr: string,
  status: AnswerStatus,
  standardTimeSec?: number | null,
  durationSec?: number | null,
): string {
  let s = getStability(status)
  if (s <= 0) {
    // Yet → immediate review needed (next = last answer date)
    return lastDateStr.slice(0, 10)
  }
  if (standardTimeSec && durationSec && durationSec > 0) {
    s = s * TIME_COEFF_C * standardTimeSec / durationSec
  }
  const d = new Date(lastDateStr)
  d.setDate(d.getDate() + Math.round(s))
  return d.toISOString().slice(0, 10)
}

/**
 * Compute days overdue (positive = overdue, negative = days remaining).
 * Returns null if no next review.
 */
export function computeDaysOverdue(
  nextReview: string,
  todayStr: string,
): number {
  const next = new Date(nextReview).getTime()
  const today = new Date(todayStr).getTime()
  return Math.round((today - next) / 86_400_000)
}

/* ── Score history for graph ── */

export interface ScorePoint {
  date: string
  daysSinceFirst: number
  score: number
  status: AnswerStatus
}

/**
 * Build score history from a problem's answers.
 * Each answer produces a score data point.
 */
export function computeScoreHistory(
  answers: {
    date: string
    status: AnswerStatus | null
    durationSec: number | null
  }[],
  standardTimeSec: number | null,
): ScorePoint[] {
  const dated = answers
    .filter((a): a is { date: string; status: AnswerStatus; durationSec: number | null } =>
      a.date !== null && a.status !== null,
    )
    .sort((a, b) => a.date.localeCompare(b.date))

  if (dated.length === 0) return []

  const firstDate = new Date(dated[0].date).getTime()

  return dated.map((a) => {
    const score = computeScore(a.status, standardTimeSec, a.durationSec)
    const daysSinceFirst = Math.round(
      (new Date(a.date).getTime() - firstDate) / 86_400_000,
    )
    return { date: a.date, daysSinceFirst, score, status: a.status }
  })
}

/**
 * Fit prediction line using linear regression on log(score) vs days.
 * Returns { slope, intercept, predictedDay100 } or null if not enough data.
 * predictedDay100 = day when score reaches 100 (from first answer).
 */
export function fitPredictionLine(
  history: ScorePoint[],
): { slope: number; intercept: number; predictedDay100: number | null } | null {
  // Only use points with score > 0
  const pts = history.filter((p) => p.score > 0)
  if (pts.length < 2) return null

  const xs = pts.map((p) => p.daysSinceFirst)
  const ys = pts.map((p) => Math.log(p.score))

  const n = xs.length
  const sumX = xs.reduce((s, v) => s + v, 0)
  const sumY = ys.reduce((s, v) => s + v, 0)
  const sumXY = xs.reduce((s, v, i) => s + v * ys[i], 0)
  const sumX2 = xs.reduce((s, v) => s + v * v, 0)

  const denom = n * sumX2 - sumX * sumX
  if (Math.abs(denom) < 1e-10) return null

  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n

  // Predict day when log(score) = log(100)
  const log100 = Math.log(100)
  let predictedDay100: number | null = null
  if (slope > 0) {
    predictedDay100 = Math.round((log100 - intercept) / slope)
  }

  return { slope, intercept, predictedDay100 }
}
