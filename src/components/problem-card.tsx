'use client'

import type { RefObject } from 'react'
import { ArrowUp, ArrowDown, Plus, Pencil, Trash2 } from 'lucide-react'
import type { Problem, Answer, Review } from '@/lib/types'
import { parseDuration, fmtDiff } from '@/lib/duration'
import { toJSTDate, jstDayDiff } from '@/lib/date-utils'
import { computeForgettingInfo } from '@/lib/forgetting-curve'
import { useLookup } from '@/hooks/use-project'
import { Markdown } from '@/components/markdown'
import { DurationSparkline } from '@/components/duration-sparkline'
import { RetentionBar } from '@/components/retention-bar'
import { ProblemPdfLink } from '@/components/problem-pdf-link'
import { StatusTag } from '@/components/color-tags'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export type AnswerWithReviews = Answer & { reviews: Review[] }
export type ProblemWithAnswers = Problem & { answers: AnswerWithReviews[] }

/* ── Card list with infinite scroll ── */

interface ProblemCardListProps {
  problems: ProblemWithAnswers[]
  now: Date
  onCheck: ProblemCardProps['onCheck']
  onEditProblem: ProblemCardProps['onEditProblem']
  onEditAnswer: ProblemCardProps['onEditAnswer']
  onDelete: ProblemCardProps['onDelete']
  onPdfLinked: ProblemCardProps['onPdfLinked']
  sentinelRef: RefObject<HTMLDivElement | null>
  loadingMore: boolean
  emptyMessage?: string
}

export function ProblemCardList({
  problems,
  now,
  onCheck,
  onEditProblem,
  onEditAnswer,
  onDelete,
  onPdfLinked,
  sentinelRef,
  loadingMore,
  emptyMessage = 'データがありません',
}: ProblemCardListProps) {
  return (
    <>
      <div className="space-y-4">
        {problems.map((p) => (
          <ProblemCard
            key={p.id}
            problem={p}
            now={now}
            onCheck={onCheck}
            onEditProblem={onEditProblem}
            onEditAnswer={onEditAnswer}
            onDelete={onDelete}
            onPdfLinked={onPdfLinked}
          />
        ))}
        {problems.length === 0 && (
          <p className="text-center text-muted-foreground py-8">{emptyMessage}</p>
        )}
      </div>
      <div ref={sentinelRef} className="h-1" />
      {loadingMore && (
        <p className="text-center text-muted-foreground text-sm py-2">読み込み中...</p>
      )}
    </>
  )
}

/* ── Single card ── */

interface ProblemCardProps {
  problem: ProblemWithAnswers
  now: Date
  /** Called when the check button is clicked to log a new answer */
  onCheck: (problem: ProblemWithAnswers) => void
  /** Called when the edit (pencil) button on the problem header is clicked */
  onEditProblem: (problem: Problem) => void
  /** Called when the edit (pencil) button on an answer timeline entry is clicked */
  onEditAnswer: (answer: AnswerWithReviews, problem: ProblemWithAnswers) => void
  /** Called when the delete button is clicked. If omitted, the delete button is hidden. */
  onDelete?: (id: string) => void
  /** Called after a PDF is linked via Drive Picker. If omitted, PDF section is hidden. */
  onPdfLinked?: (problemId: string) => void
}

export function ProblemCard({
  problem: p,
  now,
  onCheck,
  onEditProblem,
  onEditAnswer,
  onDelete,
  onPdfLinked,
}: ProblemCardProps) {
  const lookup = useLookup()
  const answers = [...p.answers].sort(
    (a, b) => (b.date ?? '').localeCompare(a.date ?? ''),
  )
  const info = computeForgettingInfo(p.answers, now)

  return (
    <Card className="py-4">
      <CardContent className="relative space-y-3">
        {/* Header: code + edit (left) | subject, level (right) */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-mono font-medium text-sm whitespace-nowrap">{p.code}</span>
          <button
            type="button"
            onClick={() => onEditProblem(p)}
            title="問題を編集"
            className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            <Pencil className="size-3" />
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <Badge variant="secondary" className="text-xs text-foreground/70">{lookup.subjectName(p.subject_id)}</Badge>
            <Badge variant="secondary" className="text-xs text-foreground/70">{lookup.levelName(p.level_id)}</Badge>
          </div>
        </div>

        {p.name && (
          <div className="-mt-2">
            <span className="text-sm font-medium text-foreground">{p.name}</span>
          </div>
        )}

        {/* Retention bar + Sparkline */}
        {info ? (
          <div className="-mt-1 flex items-end overflow-visible">
            <RetentionBar info={info} />
            <div className="ml-auto opacity-60 leading-[0]">
              <DurationSparkline durations={answers.slice().reverse().map((a) => a.duration)} />
            </div>
          </div>
        ) : (
          <div className="flex items-end overflow-visible">
            <span className="text-[10px] text-muted-foreground">未回答</span>
            <div className="ml-auto opacity-60 leading-[0]">
              <DurationSparkline durations={answers.slice().reverse().map((a) => a.duration)} />
            </div>
          </div>
        )}

        {/* Checkpoint */}
        {p.checkpoint && (
          <div className="text-xs text-foreground">
            <Markdown>{p.checkpoint}</Markdown>
          </div>
        )}

        {/* Answers — timeline style */}
        {answers.length > 0 && (
          <div className="relative ml-5">
            {answers.map((a, i) => {
              const reviews = [...a.reviews].sort(
                (x, y) => (x.created_at ?? '').localeCompare(y.created_at ?? ''),
              )
              let dayGap: number | null = null
              if (i > 0 && a.date && answers[i - 1].date) {
                dayGap = jstDayDiff(answers[i - 1].date!, a.date)
              }
              return (
                <div key={a.id}>
                  {dayGap !== null && dayGap > 0 && (
                    <div className="relative h-5">
                      <div className="absolute left-[-1px] -translate-x-1/2 top-0 bottom-0 w-0.5 bg-border" />
                      <span className="absolute left-[-1px] -translate-x-1/2 top-1/2 -translate-y-1/2 bg-card px-1.5 text-[10px] text-foreground/60 whitespace-nowrap">
                        {dayGap}日
                      </span>
                    </div>
                  )}
                  <div className="relative pl-9 py-1.5 space-y-2">
                    {i > 0 && <div className="absolute left-[-1px] -translate-x-1/2 top-0 h-[12px] w-0.5 bg-border" />}
                    <div className="absolute left-[-1px] -translate-x-1/2 top-[12px] bottom-0 w-0.5 bg-border" />
                    <div className="absolute left-[-1px] -translate-x-1/2 top-[12px] -translate-y-1/2 whitespace-nowrap">
                      {a.status ? <StatusTag status={a.status} opaque /> : <span className="inline-block size-2 rounded-full bg-foreground/40" />}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-foreground/60">{a.date ? toJSTDate(a.date) : '-'}</span>
                      <span className="ml-auto text-foreground/60">{a.duration ?? ''}</span>
                      {(() => {
                        const prev = answers[i + 1]
                        const cur = parseDuration(a.duration)
                        const pre = parseDuration(prev?.duration)
                        if (cur === null || pre === null || cur - pre === 0) {
                          return <span className="w-12" />
                        }
                        const diff = cur - pre
                        const faster = diff < 0
                        return (
                          <span className={`inline-flex w-12 items-center justify-end gap-0.5 ${faster ? 'text-green-400' : 'text-red-400'}`}>
                            {faster ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />}
                            <span className="text-[10px] tabular-nums">{fmtDiff(diff)}</span>
                          </span>
                        )
                      })()}
                      <button
                        type="button"
                        onClick={() => onEditAnswer(a, p)}
                        title="編集"
                        className="inline-flex size-5 items-center justify-center rounded text-muted-foreground/40 hover:text-foreground transition-colors"
                      >
                        <Pencil className="size-3" />
                      </button>
                    </div>
                    {reviews.map((rv) => (
                      <div key={rv.id} className="py-1 text-xs">
                        {rv.review_type && (
                          <Badge variant="secondary" className="-ml-6 text-xs text-foreground">{rv.review_type}</Badge>
                        )}
                        {rv.content && (
                          <div className="text-sm text-foreground mt-1 leading-relaxed">
                            <Markdown>{rv.content}</Markdown>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Action row: dustbox, link | pdf, show, + */}
        {onPdfLinked ? (
          <ProblemPdfLink
            problemFiles={p.problem_files}
            problemId={p.id}
            onLinked={onPdfLinked}
            startActions={
              onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(p.id)}
                  title="削除"
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/40 hover:text-destructive transition-colors"
                >
                  <Trash2 className="size-3" />
                </button>
              )
            }
            endActions={
              <button
                type="button"
                onClick={() => onCheck(p)}
                title="解答を登録"
                className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/40 hover:text-foreground transition-colors"
              >
                <Plus className="size-3" />
              </button>
            }
          />
        ) : (
          <div className="flex items-center">
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(p.id)}
                title="削除"
                className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/40 hover:text-destructive transition-colors"
              >
                <Trash2 className="size-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onCheck(p)}
              title="解答を登録"
              className="ml-auto inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/40 hover:text-foreground transition-colors"
            >
              <Plus className="size-3" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
