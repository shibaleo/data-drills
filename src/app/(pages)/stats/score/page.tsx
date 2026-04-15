"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import { api } from "@/lib/api-client";
import { useProject } from "@/hooks/use-project";
import { useLookupMaps } from "@/hooks/use-lookup-maps";
import { usePageTitle } from "@/lib/page-context";
import type { DDProblem, DDAnswer, DDReview, DDReviewTag, DDTag, DDProblemFile, ProblemsDetailResponse } from "@/lib/api-types";
import {
  STATUS_COLORS,
  computeScore,
  computeNextReview,
  computeDaysOverdue,
  computeScoreHistory,
  fitPredictionLine,
  type ScorePoint,
} from "@/lib/fsrs";
import { problemColor } from "@/lib/problem-color";
import { SortHeader } from "@/app/(pages)/problems/columns";
import { toJSTDateString } from "@/lib/date-utils";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent } from "@/components/ui/card";
import { StatusTag } from "@/components/color-tags";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProblemCard, type ProblemWithAnswers } from "@/components/problem-card";
import { ANSWER_STATUSES, type AnswerStatus, type Answer, type Review, type ProblemFile } from "@/lib/types";

function secondsToDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ── Table row type ── */

interface RowData {
  problemId: string;
  code: string;
  name: string;
  color: string;
  lastStatus: AnswerStatus;
  score: number;
  nextReview: string;
  daysOverdue: number;
  timeScore: number | null;
  reviewCount: number;
  standardTime: number | null;
  scoreHistory: ScorePoint[];
}

/* ── Column defs ── */

const columns: ColumnDef<RowData>[] = [
  {
    id: "color",
    cell: ({ row }) => (
      <div
        className="size-2.5 rounded-full"
        style={{ backgroundColor: row.original.color }}
      />
    ),
    size: 32,
  },
  {
    accessorKey: "code",
    header: ({ column }) => <SortHeader column={column}>Code</SortHeader>,
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: "name",
    header: ({ column }) => <SortHeader column={column}>Name</SortHeader>,
    cell: ({ getValue }) => (
      <span className="max-w-[180px] truncate block text-xs">
        {getValue<string>()}
      </span>
    ),
  },
  {
    accessorKey: "lastStatus",
    header: ({ column }) => <SortHeader column={column}>Status</SortHeader>,
    cell: ({ getValue }) => {
      const status = getValue<AnswerStatus>();
      return <StatusTag status={status} opaque className="text-[10px]" />;
    },
  },
  {
    accessorKey: "score",
    header: ({ column }) => <SortHeader column={column}>Score</SortHeader>,
    cell: ({ getValue }) => {
      const score = getValue<number>();
      return (
        <span
          className={`text-xs tabular-nums font-medium ${score >= 100 ? "text-blue-500" : ""}`}
        >
          {score.toFixed(1)}
        </span>
      );
    },
  },
  {
    accessorKey: "nextReview",
    header: ({ column }) => <SortHeader column={column}>Next</SortHeader>,
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {getValue<string>()}
      </span>
    ),
  },
  {
    accessorKey: "daysOverdue",
    header: ({ column }) => <SortHeader column={column}>Retry After</SortHeader>,
    cell: ({ getValue }) => {
      const overdue = getValue<number>();
      const retryAfter = -overdue;
      return (
        <span
          className={`text-xs tabular-nums font-medium ${retryAfter < 0 ? "text-red-500" : "text-muted-foreground"}`}
        >
          {retryAfter < 0 ? `▲ ${Math.abs(retryAfter)} d` : `${retryAfter} d`}
        </span>
      );
    },
  },
  {
    accessorKey: "timeScore",
    header: ({ column }) => <SortHeader column={column}>dur/std</SortHeader>,
    cell: ({ getValue }) => {
      const v = getValue<number | null>();
      if (v === null) return <span className="text-xs text-muted-foreground">—</span>;
      return (
        <span className="text-xs tabular-nums text-muted-foreground">
          {v.toFixed(2)}
        </span>
      );
    },
  },
  {
    accessorKey: "reviewCount",
    header: ({ column }) => <SortHeader column={column}>Cnt</SortHeader>,
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {getValue<number>()}
      </span>
    ),
  },
];

/* ── Custom scatter tooltip ── */

function ScoreTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ScorePoint }[];
}) {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload;
  return (
    <div className="rounded-md border bg-background px-3 py-1.5 text-xs shadow-md">
      <p className="font-medium">{pt.date}</p>
      <p>
        Score: <span className="tabular-nums font-medium">{pt.score.toFixed(1)}</span>
      </p>
      <p>
        Status:{" "}
        <span style={{ color: STATUS_COLORS[pt.status] }}>{pt.status}</span>
      </p>
    </div>
  );
}

/* ── Page ── */

export default function ScoreDashboardPage() {
  usePageTitle("スコアダッシュボード");
  const { currentProject } = useProject();
  const { statusMap, statusPointMap, subjectColorMap } = useLookupMaps();
  const [rows, setRows] = useState<RowData[]>([]);
  const [problemMap, setProblemMap] = useState<Map<string, ProblemWithAnswers>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "daysOverdue", desc: true },
  ]);
  const tableRef = useRef<HTMLDivElement>(null);

  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toJSTDateString(now), [now]);

  const fetchData = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const res = await api.get<{ data: ProblemsDetailResponse }>(`/problems-detail?project_id=${currentProject.id}`);
      const { problems, answers, reviews, reviewTags, tags, problemFiles } = res.data;

      // Build tag map
      const tagMap = new Map<string, string>();
      for (const t of tags) tagMap.set(t.id, t.name);

      // Build reviewTags map
      const reviewTagsMap = new Map<string, string[]>();
      for (const rt of reviewTags) {
        const list = reviewTagsMap.get(rt.reviewId) ?? [];
        list.push(tagMap.get(rt.tagId) ?? "");
        reviewTagsMap.set(rt.reviewId, list);
      }

      // Build reviews by answer
      const reviewsByAnswer = new Map<string, Review[]>();
      for (const r of reviews) {
        const rTags = reviewTagsMap.get(r.id) ?? [];
        const ldReview: Review = {
          id: r.id,
          content: r.content ?? "",
          review_type: (rTags[0] as Review["review_type"]) ?? null,
          answer_id: r.answerId,
          created_at: r.createdAt,
          updated_at: r.createdAt,
        };
        const list = reviewsByAnswer.get(r.answerId) ?? [];
        list.push(ldReview);
        reviewsByAnswer.set(r.answerId, list);
      }

      // Build answers by problem (full Answer type for ProblemCard)
      const answersByProblem = new Map<string, (Answer & { reviews: Review[] })[]>();
      const rawAnswersByProblem = new Map<string, DDAnswer[]>();
      for (const a of answers) {
        // Full answer for ProblemCard
        const ldAnswer: Answer & { reviews: Review[] } = {
          id: a.id,
          date: a.date,
          duration: secondsToDuration(a.duration),
          status: (a.answerStatusId ? statusMap.get(a.answerStatusId) as AnswerStatus ?? null : null),
          point: a.answerStatusId ? statusPointMap.get(a.answerStatusId) : undefined,
          problem_id: a.problemId,
          created_at: a.createdAt,
          updated_at: a.createdAt,
          reviews: reviewsByAnswer.get(a.id) ?? [],
        };
        const fullList = answersByProblem.get(a.problemId) ?? [];
        fullList.push(ldAnswer);
        answersByProblem.set(a.problemId, fullList);

        // Raw answer for score computation
        const rawList = rawAnswersByProblem.get(a.problemId) ?? [];
        rawList.push(a);
        rawAnswersByProblem.set(a.problemId, rawList);
      }

      // Build files by problem
      const filesByProblem = new Map<string, ProblemFile[]>();
      for (const f of problemFiles) {
        const ldFile: ProblemFile = {
          id: f.id,
          problem_id: f.problemId,
          gdrive_file_id: f.gdriveFileId,
          file_name: f.fileName ?? "",
          created_at: f.createdAt,
        };
        const list = filesByProblem.get(f.problemId) ?? [];
        list.push(ldFile);
        filesByProblem.set(f.problemId, list);
      }

      const builtRows: RowData[] = [];
      const builtProblemMap = new Map<string, ProblemWithAnswers>();

      for (const p of problems) {
        const rawAnswers = rawAnswersByProblem.get(p.id) ?? [];
        if (rawAnswers.length === 0) continue;

        // Sort chronologically
        const sorted = [...rawAnswers].sort((a, b) =>
          a.date.localeCompare(b.date),
        );
        const latest = sorted[sorted.length - 1];
        const lastStatus =
          (latest.answerStatusId
            ? (statusMap.get(latest.answerStatusId) as AnswerStatus)
            : null) ?? "Yet";

        // Score
        const score = computeScore(
          lastStatus,
          p.standardTime,
          latest.duration,
        );

        // Next review & overdue
        const nextReview = computeNextReview(latest.date, lastStatus);
        const daysOverdue = computeDaysOverdue(nextReview, todayStr);

        // Time ratio = duration / standardTime
        const timeScore =
          p.standardTime && p.standardTime > 0 && latest.duration && latest.duration > 0
            ? latest.duration / p.standardTime
            : null;

        // Score history for graph
        const answersForHistory = sorted.map((a) => ({
          date: a.date,
          status:
            (a.answerStatusId
              ? (statusMap.get(a.answerStatusId) as AnswerStatus)
              : null) ?? ("Yet" as AnswerStatus),
          durationSec: a.duration,
        }));
        const scoreHistory = computeScoreHistory(
          answersForHistory,
          p.standardTime,
        );

        const color = problemColor(p.code, p.name ?? "", p.subjectId ? subjectColorMap.get(p.subjectId) ?? null : null);

        builtRows.push({
          problemId: p.id,
          code: p.code,
          name: p.name ?? "",
          color,
          lastStatus,
          score,
          nextReview,
          daysOverdue,
          timeScore,
          reviewCount: sorted.length,
          standardTime: p.standardTime,
          scoreHistory,
        });

        // Full ProblemWithAnswers for detail panel
        builtProblemMap.set(p.id, {
          id: p.id,
          code: p.code,
          name: p.name ?? "",
          subject_id: p.subjectId ?? "",
          level_id: p.levelId ?? "",
          checkpoint: p.checkpoint,
          standard_time: p.standardTime ?? null,
          project_id: p.projectId,
          created_at: p.createdAt,
          updated_at: p.updatedAt,
          problem_files: filesByProblem.get(p.id),
          answers: answersByProblem.get(p.id) ?? [],
        });
      }

      setRows(builtRows);
      setProblemMap(builtProblemMap);
    } catch {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [currentProject, statusMap, statusPointMap, subjectColorMap, todayStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Scroll selected row
  useEffect(() => {
    if (!selectedId || !tableRef.current) return;
    const row = tableRef.current.querySelector(
      `[data-problem-id="${selectedId}"]`,
    );
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  // Selected problem data
  const selectedRow = useMemo(
    () => rows.find((r) => r.problemId === selectedId) ?? null,
    [rows, selectedId],
  );

  const selectedProblem = useMemo(
    () => (selectedId ? problemMap.get(selectedId) ?? null : null),
    [selectedId, problemMap],
  );

  // Prediction line
  const prediction = useMemo(
    () =>
      selectedRow ? fitPredictionLine(selectedRow.scoreHistory) : null,
    [selectedRow],
  );

  // Explicit Y-axis max for the score chart (avoid Recharts auto-domain bug)
  const chartYMax = useMemo(() => {
    if (!selectedRow) return 100;
    const max = Math.max(...selectedRow.scoreHistory.map((p) => p.score), 0);
    return Math.ceil(Math.max(max * 1.1, 100));
  }, [selectedRow]);

  // Summary stats
  const summary = useMemo(() => {
    const total = rows.length;
    const completed = rows.filter((r) => r.score >= 100).length;
    const overdue = rows.filter((r) => r.daysOverdue > 0).length;

    const dist: Record<AnswerStatus, number> = {
      Yet: 0,
      Repeat: 0,
      Check: 0,
      Recall: 0,
      Done: 0,
    };
    for (const r of rows) dist[r.lastStatus]++;

    const checkPlus = rows.filter(
      (r) =>
        (r.lastStatus === "Check" ||
          r.lastStatus === "Recall" ||
          r.lastStatus === "Done") &&
        r.timeScore !== null,
    );
    const avgTimeScore =
      checkPlus.length > 0
        ? checkPlus.reduce((s, r) => s + (r.timeScore ?? 0), 0) /
          checkPlus.length
        : null;

    return { total, completed, overdue, dist, avgTimeScore };
  }, [rows]);

  const chartConfig: ChartConfig = {
    score: { label: "Score", color: "hsl(var(--chart-1))" },
  };

  // No-op handlers for ProblemCard (read-only in score dashboard)
  const noop = useCallback(() => {}, []);
  const noopProblem = useCallback((_p: unknown) => {}, []);
  const noopAnswer = useCallback((_a: unknown, _p: unknown) => {}, []);

  if (!currentProject) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-12 text-muted-foreground">
          Please select a project
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 flex flex-col gap-2 flex-1 min-h-0">
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading...
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No data</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="flex items-stretch gap-2 shrink-0 flex-wrap">
            <Card className="flex-1 min-w-[140px]">
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground mb-1">
                  完成問題数
                </p>
                <p className="text-lg font-bold tabular-nums">
                  {summary.completed}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    / {summary.total}
                  </span>
                </p>
              </CardContent>
            </Card>
            <Card className="flex-1 min-w-[180px]">
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground mb-1">
                  評価分布
                </p>
                <div className="flex items-center gap-2">
                  <PieChart width={48} height={48}>
                    <Pie
                      data={ANSWER_STATUSES.filter((s) => summary.dist[s] > 0).map((s) => ({
                        name: s,
                        value: summary.dist[s],
                      }))}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={12}
                      outerRadius={22}
                      strokeWidth={0}
                      isAnimationActive={false}
                    >
                      {ANSWER_STATUSES.filter((s) => summary.dist[s] > 0).map((s) => (
                        <Cell key={s} fill={STATUS_COLORS[s]} />
                      ))}
                    </Pie>
                  </PieChart>
                  <div className="flex flex-col gap-0.5">
                    {ANSWER_STATUSES.map((s) => (
                      <div key={s} className="flex items-center gap-1.5">
                        <span
                          className="text-[10px] w-10"
                          style={{ color: STATUS_COLORS[s] }}
                        >
                          {s}
                        </span>
                        <span
                          className="text-[10px] tabular-nums font-medium"
                          style={{ color: STATUS_COLORS[s] }}
                        >
                          {summary.dist[s]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="flex-1 min-w-[120px]">
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground mb-1">
                  本日の復習
                </p>
                <p className="text-lg font-bold tabular-nums text-red-500">
                  {summary.overdue}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    問
                  </span>
                </p>
              </CardContent>
            </Card>
            <Card className="flex-1 min-w-[120px]">
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground mb-1">
                  平均時間比
                </p>
                <p className="text-lg font-bold tabular-nums">
                  {summary.avgTimeScore !== null
                    ? summary.avgTimeScore.toFixed(2)
                    : "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detail panel: graph + ProblemCard */}
          {selectedRow && selectedProblem && (
            <div className="shrink-0 grid grid-cols-2 gap-3">
              {/* Left: Score graph */}
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">
                      {selectedRow.code} {selectedRow.name}
                    </span>
                    {prediction?.predictedDay100 != null && (
                      <span className="text-[10px] text-muted-foreground">
                        100pt予測: Day {prediction.predictedDay100}
                      </span>
                    )}
                  </div>
                  <ChartContainer
                    config={chartConfig}
                    className="h-[25vh] min-h-[140px] w-full"
                  >
                    <ScatterChart
                      margin={{ left: 0, right: 8, top: 4, bottom: 0 }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="date"
                        type="category"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: string) => {
                          const d = new Date(v);
                          return `${d.getMonth() + 1}/${d.getDate()}`;
                        }}
                      />
                      <YAxis
                        dataKey="score"
                        type="number"
                        domain={[0, chartYMax]}
                        tickLine={false}
                        axisLine={false}
                        width={40}
                      />
                      <ChartTooltip
                        content={<ScoreTooltipContent />}
                      />
                      <ReferenceLine
                        y={100}
                        stroke="hsl(var(--muted-foreground))"
                        strokeDasharray="4 4"
                        strokeOpacity={0.5}
                        label={{
                          value: "100pt",
                          position: "right",
                          style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
                        }}
                      />
                      <Scatter
                        data={selectedRow.scoreHistory.map(({ date, score, status }) => ({ date, score, status }))}
                        line={selectedRow.scoreHistory.length >= 2 ? { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeOpacity: 0.3 } : false}
                        isAnimationActive={false}
                      >
                        {selectedRow.scoreHistory.map((pt, i) => (
                          <Cell
                            key={i}
                            fill={STATUS_COLORS[pt.status]}
                            r={5}
                          />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ChartContainer>
                </CardContent>
              </Card>
              {/* Right: ProblemCard (same as detail dialog) */}
              <Card className="max-h-[40vh] overflow-y-auto">
                <CardContent className="p-3" style={{ zoom: 0.85 }}>
                  <ProblemCard
                    problem={selectedProblem}
                    now={now}
                    onEditProblem={noopProblem}
                    onEditAnswer={noopAnswer}
                    onCheck={noop}
                    bare
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Dashboard table */}
          <div
            ref={tableRef}
            className="flex-1 min-h-0 rounded-md border overflow-auto"
          >
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead key={header.id} className="sticky top-0 z-10 bg-background">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    data-problem-id={row.original.problemId}
                    data-state={
                      selectedId === row.original.problemId
                        ? "selected"
                        : undefined
                    }
                    onClick={() =>
                      setSelectedId(
                        selectedId === row.original.problemId
                          ? null
                          : row.original.problemId,
                      )
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
