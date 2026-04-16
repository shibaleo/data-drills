"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
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
import type { DDProblem, DDAnswer, DDReview, DDReviewTag, DDTag, DDProblemFile } from "@/lib/api-types";
import { OpaqueTag, type ProblemWithAnswers } from "@/components/problem-card";
import type { Answer, Review, ProblemFile } from "@/lib/types";
import { useProblemDialogs } from "@/hooks/use-problem-dialogs";
import {
  STATUS_COLORS,
  computeNextReview,
  computeDaysOverdue,
} from "@/lib/fsrs";
import { problemColor } from "@/lib/problem-color";
import { SortHeader } from "@/app/(pages)/problems/columns";
import { toJSTDateString } from "@/lib/date-utils";
import { StatusTag } from "@/components/color-tags";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AnswerStatus } from "@/lib/types";

/* ── Helpers ── */

function secondsToDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ── Row type ── */

interface ScheduleRow {
  problemId: string;
  code: string;
  name: string;
  subjectName: string;
  subjectColor: string | null;
  levelName: string;
  levelColor: string | null;
  color: string;
  lastStatus: AnswerStatus;
  statusColor: string;
  nextReview: string;
  daysUntil: number;
  reviewCount: number;
}

/* ── Schedule Chart (SVG) ── */

const CELL = 14;
const GAP = 2;
const STEP = CELL + GAP;
const STATUS_ORDER: Record<AnswerStatus, number> = {
  Yet: 0,
  Repeat: 1,
  Check: 2,
  Recall: 3,
  Done: 4,
};

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

type ChartColorMode = "problem" | "status";

function ScheduleChart({
  items,
  today,
  onSelect,
  selectedId,
  colorMode = "problem",
}: {
  items: ScheduleRow[];
  today: string;
  onSelect?: (problemId: string) => void;
  selectedId?: string | null;
  colorMode?: ChartColorMode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Group items by nextReview date
  const grouped = useMemo(() => {
    const map = new Map<string, ScheduleRow[]>();
    for (const item of items) {
      const list = map.get(item.nextReview) ?? [];
      list.push(item);
      map.set(item.nextReview, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => STATUS_ORDER[a.lastStatus] - STATUS_ORDER[b.lastStatus]);
    }
    return map;
  }, [items]);

  // Date range: cover all data with padding
  const { dates, todayIdx } = useMemo(() => {
    const reviewDates = items.map((i) => i.nextReview);
    const allDates = [today, ...reviewDates];
    const minDate = allDates.reduce((a, b) => (a < b ? a : b));
    const maxDate = allDates.reduce((a, b) => (a > b ? a : b));

    // Extend range: at least 7 days before min and 14 days after max
    const rangeStart = addDays(minDate < today ? minDate : today, -7);
    const rangeEnd = addDays(maxDate > today ? maxDate : today, 14);

    const ds: string[] = [];
    let d = rangeStart;
    while (d <= rangeEnd) {
      ds.push(d);
      d = addDays(d, 1);
    }
    return { dates: ds, todayIdx: ds.indexOf(today) };
  }, [items, today]);

  // Scroll to position today at ~1/3 from left
  useEffect(() => {
    if (!scrollRef.current || todayIdx < 0) return;
    const todayX = todayIdx * STEP;
    const containerW = scrollRef.current.clientWidth;
    scrollRef.current.scrollLeft = todayX - containerW / 3;
  }, [todayIdx]);

  const MIN_ROWS = 10;
  const maxCount = Math.max(0, ...dates.map((d) => (grouped.get(d) ?? []).length));
  const maxStack = Math.max(MIN_ROWS, maxCount + 2);
  const TOP_AXIS_H = 16;
  const BOTTOM_AXIS_H = 20;
  const chartWidth = dates.length * STEP;
  const chartHeight = maxStack * STEP + TOP_AXIS_H + BOTTOM_AXIS_H;
  const Y_AXIS_W = 28;

  // Y-axis tick values (every 5)
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let i = 5; i <= maxStack; i += 5) ticks.push(i);
    return ticks;
  }, [maxStack]);

  return (
    <div className="flex">
      {/* Y-axis labels (fixed, not scrolling) */}
      <svg
        width={Y_AXIS_W}
        height={chartHeight}
        className="block shrink-0"
      >
        {yTicks.map((n) => (
          <text
            key={n}
            x={Y_AXIS_W - 4}
            y={chartHeight - BOTTOM_AXIS_H - n * STEP + CELL / 2}
            textAnchor="end"
            dominantBaseline="central"
            className="fill-muted-foreground"
            fontSize={9}
          >
            {n}
          </text>
        ))}
      </svg>
      <div ref={scrollRef} className="overflow-x-auto pb-2 flex-1 min-w-0">
      <svg
        width={chartWidth}
        height={chartHeight}
        className="block"
      >
        {/* Today vertical line */}
        {todayIdx >= 0 && (
          <line
            x1={todayIdx * STEP + CELL / 2}
            y1={TOP_AXIS_H}
            x2={todayIdx * STEP + CELL / 2}
            y2={chartHeight - BOTTOM_AXIS_H}
            stroke="hsl(var(--foreground))"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.3}
          />
        )}
        {dates.map((date, colIdx) => {
          const dayItems = grouped.get(date) ?? [];
          const x = colIdx * STEP;
          const isToday = date === today;

          return (
            <g key={date}>
              {/* Empty background blocks */}
              {Array.from({ length: maxStack }, (_, i) => (
                <rect
                  key={`bg-${i}`}
                  x={x}
                  y={chartHeight - BOTTOM_AXIS_H - (i + 1) * STEP}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  fill="none"
                  stroke="hsl(var(--border))"
                  strokeWidth={0.5}
                />
              ))}
              {/* Filled blocks */}
              {dayItems.map((item, stackIdx) => {
                const bx = x;
                const by = chartHeight - BOTTOM_AXIS_H - (stackIdx + 1) * STEP;
                const isSelected = item.problemId === selectedId;
                const blockColor = colorMode === "status" ? item.statusColor : item.color;
                return (
                  <g key={item.problemId}>
                    {isSelected && (
                      <rect
                        x={bx - 2}
                        y={by - 2}
                        width={CELL + 4}
                        height={CELL + 4}
                        rx={3}
                        fill="none"
                        stroke={blockColor}
                        strokeWidth={2}
                        opacity={0.9}
                        className="animate-pulse"
                      />
                    )}
                    <rect
                      x={bx}
                      y={by}
                      width={CELL}
                      height={CELL}
                      rx={2}
                      fill={blockColor}
                      opacity={isSelected ? 1 : 0.85}
                      className="cursor-pointer"
                      onClick={() => onSelect?.(item.problemId)}
                    >
                      <title>
                        {item.code} {item.name}
                      </title>
                    </rect>
                  </g>
                );
              })}
              {/* Top axis: relative days */}
              {(colIdx % 7 === 0 || isToday) && (() => {
                const diff = todayIdx >= 0 ? colIdx - todayIdx : 0;
                const label = diff === 0 ? "今日" : diff > 0 ? `+${diff}` : `▲ ${Math.abs(diff)}`;
                return (
                  <text
                    x={x + CELL / 2}
                    y={10}
                    textAnchor="middle"
                    className="fill-muted-foreground"
                    fontSize={9}
                    fontWeight={isToday ? 700 : 400}
                  >
                    {label}
                  </text>
                );
              })()}
              {/* Bottom axis: absolute dates */}
              {(colIdx % 7 === 0 || isToday) && (
                <text
                  x={x + CELL / 2}
                  y={chartHeight - 4}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontSize={9}
                  fontWeight={isToday ? 700 : 400}
                >
                  {`${new Date(date + "T12:00:00").getMonth() + 1}/${new Date(date + "T12:00:00").getDate()}`}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      </div>
    </div>
  );
}

/* ── Column defs ── */

const columns: ColumnDef<ScheduleRow>[] = [
  {
    accessorKey: "lastStatus",
    header: ({ column }) => <SortHeader column={column}>Status</SortHeader>,
    cell: ({ getValue }) => {
      const status = getValue<AnswerStatus>();
      return <StatusTag status={status} opaque className="text-[10px]" />;
    },
    size: 70,
  },
  {
    accessorKey: "subjectName",
    header: ({ column }) => <SortHeader column={column}>Subject</SortHeader>,
    cell: ({ row }) => row.original.subjectName ? (
      <OpaqueTag name={row.original.subjectName} color={row.original.subjectColor} />
    ) : null,
    size: 70,
  },
  {
    accessorKey: "levelName",
    header: ({ column }) => <SortHeader column={column}>Level</SortHeader>,
    cell: ({ row }) => row.original.levelName ? (
      <OpaqueTag name={row.original.levelName} color={row.original.levelColor} />
    ) : null,
    size: 70,
  },
  {
    accessorKey: "code",
    header: ({ column }) => <SortHeader column={column}>Code</SortHeader>,
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{getValue<string>()}</span>
    ),
    size: 64,
  },
  {
    accessorKey: "name",
    header: ({ column }) => <SortHeader column={column}>Name</SortHeader>,
    cell: ({ getValue }) => (
      <span className="truncate block text-xs">
        {getValue<string>()}
      </span>
    ),
    size: 300,
  },
  {
    accessorKey: "nextReview",
    header: ({ column }) => <SortHeader column={column}>Next</SortHeader>,
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {getValue<string>()}
      </span>
    ),
    size: 100,
  },
  {
    accessorKey: "daysUntil",
    header: ({ column }) => <SortHeader column={column}>Days</SortHeader>,
    size: 64,
    cell: ({ getValue }) => {
      const d = getValue<number>();
      return (
        <span
          className={`text-xs tabular-nums font-medium ${
            d < 0
              ? "text-red-500"
              : d === 0
                ? "text-foreground"
                : "text-muted-foreground"
          }`}
        >
          {d < 0 ? `▲ ${Math.abs(d)} d` : d === 0 ? "今日" : `${d} d`}
        </span>
      );
    },
  },
  {
    accessorKey: "reviewCount",
    header: ({ column }) => <SortHeader column={column}>Ans</SortHeader>,
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {getValue<number>()}
      </span>
    ),
    size: 48,
  },
];

/* ── Page ── */

export default function SchedulePage() {
  usePageTitle("復習スケジュール");
  const { currentProject, subjects, levels } = useProject();
  const { statusMap, statusPointMap, subjectColorMap } = useLookupMaps();
  const subjectNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of subjects) m.set(s.id, s.name);
    return m;
  }, [subjects]);
  const levelNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of levels) m.set(l.id, l.name);
    return m;
  }, [levels]);
  const levelColorMap = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const l of levels) m.set(l.id, l.color ?? null);
    return m;
  }, [levels]);
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [allProblems, setAllProblems] = useState<ProblemWithAnswers[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "daysUntil", desc: false },
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chartColorMode, setChartColorMode] = useState<ChartColorMode>("problem");
  const tableRef = useRef<HTMLDivElement>(null);

  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toJSTDateString(now), [now]);

  const fetchData = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const res = await api.get<{
        data: {
          problems: DDProblem[];
          answers: DDAnswer[];
          reviews: DDReview[];
          reviewTags: DDReviewTag[];
          tags: DDTag[];
          problemFiles: DDProblemFile[];
        };
      }>(`/problems-detail?project_id=${currentProject.id}`);
      const {
        problems,
        answers,
        reviews: ddReviews,
        reviewTags: ddReviewTags,
        tags: ddTags,
        problemFiles: ddFiles,
      } = res.data;

      // Build tag map
      const tagMap = new Map<string, string>();
      for (const t of ddTags) tagMap.set(t.id, t.name);

      const reviewTagsMap = new Map<string, string[]>();
      for (const rt of ddReviewTags) {
        const list = reviewTagsMap.get(rt.reviewId) ?? [];
        list.push(tagMap.get(rt.tagId) ?? "");
        reviewTagsMap.set(rt.reviewId, list);
      }

      // Build reviews by answer
      const reviewsByAnswer = new Map<string, Review[]>();
      for (const r of ddReviews) {
        const tags = reviewTagsMap.get(r.id) ?? [];
        const ldReview: Review = {
          id: r.id,
          content: r.content ?? "",
          review_type: (tags[0] as Review["review_type"]) ?? null,
          answer_id: r.answerId,
          created_at: r.createdAt,
          updated_at: r.createdAt,
        };
        const list = reviewsByAnswer.get(r.answerId) ?? [];
        list.push(ldReview);
        reviewsByAnswer.set(r.answerId, list);
      }

      // Build answers by problem (for ProblemWithAnswers)
      const answersByProblemFull = new Map<string, (Answer & { reviews: Review[] })[]>();
      const answersByProblem = new Map<string, DDAnswer[]>();
      for (const a of answers) {
        // DD format for schedule rows
        const ddList = answersByProblem.get(a.problemId) ?? [];
        ddList.push(a);
        answersByProblem.set(a.problemId, ddList);

        // Full format for ProblemWithAnswers
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
        const fullList = answersByProblemFull.get(a.problemId) ?? [];
        fullList.push(ldAnswer);
        answersByProblemFull.set(a.problemId, fullList);
      }

      // Build files by problem
      const filesByProblem = new Map<string, ProblemFile[]>();
      for (const f of ddFiles) {
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

      // Build ProblemWithAnswers[]
      const combined: ProblemWithAnswers[] = problems.map((p) => ({
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
        answers: answersByProblemFull.get(p.id) ?? [],
      }));
      setAllProblems(combined);

      // Build schedule rows
      const built: ScheduleRow[] = [];
      for (const p of problems) {
        const pAnswers = answersByProblem.get(p.id) ?? [];

        let lastStatus: AnswerStatus;
        let nextReview: string;
        let daysUntil: number;

        if (pAnswers.length === 0) {
          // No answers yet → Yet status, review = today
          lastStatus = "Yet";
          nextReview = todayStr;
          daysUntil = 0;
        } else {
          const sorted = [...pAnswers].sort((a, b) =>
            a.date.localeCompare(b.date),
          );
          const latest = sorted[sorted.length - 1];
          lastStatus =
            (latest.answerStatusId
              ? (statusMap.get(latest.answerStatusId) as AnswerStatus)
              : null) ?? "Yet";
          nextReview = computeNextReview(
            latest.date, lastStatus, p.standardTime, latest.duration,
          );
          daysUntil = -computeDaysOverdue(nextReview, todayStr);
        }

        const color = problemColor(
          p.code,
          p.name ?? "",
          p.subjectId ? subjectColorMap.get(p.subjectId) ?? null : null,
        );

        built.push({
          problemId: p.id,
          code: p.code,
          name: p.name ?? "",
          subjectName: p.subjectId ? subjectNameMap.get(p.subjectId) ?? "" : "",
          subjectColor: p.subjectId ? subjectColorMap.get(p.subjectId) ?? null : null,
          levelName: p.levelId ? levelNameMap.get(p.levelId) ?? "" : "",
          levelColor: p.levelId ? levelColorMap.get(p.levelId) ?? null : null,
          color,
          lastStatus,
          statusColor: STATUS_COLORS[lastStatus],
          nextReview,
          daysUntil,
          reviewCount: pAnswers.length,
        });
      }

      setRows(built);
    } catch {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [currentProject, statusMap, statusPointMap, subjectColorMap, subjectNameMap, levelNameMap, levelColorMap, todayStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { openDetail, renderDialogs } = useProblemDialogs({
    allProblems,
    onDataChanged: fetchData,
  });

  const handleSelect = useCallback((problemId: string) => {
    setSelectedId((prev) => (prev === problemId ? null : problemId));
    requestAnimationFrame(() => {
      const row = tableRef.current?.querySelector(
        `[data-problem-id="${problemId}"]`,
      );
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  const chartRows = useMemo(
    () => rows.filter((r) => r.reviewCount > 0),
    [rows],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

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
    <div className="p-3 md:p-4 flex flex-col gap-2">
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading...
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No data</div>
      ) : (
        <>
          {/* Schedule chart */}
          <div className="shrink-0 rounded-md border p-3">
            <div className="flex justify-end mb-1">
              <div className="inline-flex rounded-md border text-[10px]">
                <button
                  type="button"
                  className={`px-2 py-0.5 rounded-l-md transition-colors ${chartColorMode === "problem" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
                  onClick={() => setChartColorMode("problem")}
                >
                  Problem
                </button>
                <button
                  type="button"
                  className={`px-2 py-0.5 rounded-r-md transition-colors ${chartColorMode === "status" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
                  onClick={() => setChartColorMode("status")}
                >
                  Status
                </button>
              </div>
            </div>
            <ScheduleChart items={chartRows} today={todayStr} onSelect={handleSelect} selectedId={selectedId} colorMode={chartColorMode} />
          </div>

          {/* Table */}
          <div ref={tableRef} className="rounded-md border overflow-auto" style={{ maxHeight: "calc(10 * 2.25rem)" }}>
            <Table className="table-fixed">
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    <TableHead className="sticky top-0 z-10 bg-background w-4 px-2" />
                    {hg.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="sticky top-0 z-10 bg-background"
                        style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                      >
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
                {table.getRowModel().rows.map((row) => {
                  const pid = row.original.problemId;
                  return (
                  <TableRow
                    key={row.id}
                    data-problem-id={pid}
                    className={`cursor-pointer ${pid === selectedId ? "bg-accent" : ""}`}
                    onClick={() => pid === selectedId ? openDetail(pid) : handleSelect(pid)}
                  >
                    <TableCell className="w-4 px-2">
                      <div
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: row.original.color }}
                      />
                    </TableCell>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} style={{ width: cell.column.getSize() !== 150 ? cell.column.getSize() : undefined }}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {renderDialogs()}
    </div>
  );
}
