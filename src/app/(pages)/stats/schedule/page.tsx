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
import type { DDProblem, DDAnswer } from "@/lib/api-types";
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

/* ── Row type ── */

interface ScheduleRow {
  problemId: string;
  code: string;
  name: string;
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

function ScheduleChart({
  items,
  today,
  onSelect,
}: {
  items: ScheduleRow[];
  today: string;
  onSelect?: (problemId: string) => void;
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

  const MIN_ROWS = 15;
  const maxStack = Math.max(
    MIN_ROWS,
    ...dates.map((d) => (grouped.get(d) ?? []).length),
  );
  const chartWidth = dates.length * STEP;
  const chartHeight = maxStack * STEP + 28;
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
            y={chartHeight - 28 - n * STEP + CELL / 2}
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
            y1={0}
            x2={todayIdx * STEP + CELL / 2}
            y2={chartHeight - 24}
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
                  y={chartHeight - 28 - (i + 1) * STEP}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  fill="none"
                  stroke="hsl(var(--border))"
                  strokeWidth={0.5}
                />
              ))}
              {/* Filled blocks */}
              {dayItems.map((item, stackIdx) => (
                <rect
                  key={item.problemId}
                  x={x}
                  y={chartHeight - 28 - (stackIdx + 1) * STEP}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  fill={item.statusColor}
                  opacity={0.85}
                  className="cursor-pointer"
                  onClick={() => onSelect?.(item.problemId)}
                >
                  <title>
                    {item.code} {item.name}
                  </title>
                </rect>
              ))}
              {/* Date labels: every 7 days + today */}
              {(colIdx % 7 === 0 || isToday) && (
                <text
                  x={x + CELL / 2}
                  y={chartHeight - 6}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontSize={9}
                  fontWeight={isToday ? 700 : 400}
                >
                  {isToday
                    ? "今日"
                    : `${new Date(date + "T12:00:00").getMonth() + 1}/${new Date(date + "T12:00:00").getDate()}`}
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
      <span className="max-w-[200px] truncate block text-xs">
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
    accessorKey: "nextReview",
    header: ({ column }) => <SortHeader column={column}>Next</SortHeader>,
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {getValue<string>()}
      </span>
    ),
  },
  {
    accessorKey: "daysUntil",
    header: ({ column }) => <SortHeader column={column}>Days</SortHeader>,
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
    header: ({ column }) => <SortHeader column={column}>Cnt</SortHeader>,
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {getValue<number>()}
      </span>
    ),
  },
];

/* ── Page ── */

export default function SchedulePage() {
  usePageTitle("復習スケジュール");
  const { currentProject } = useProject();
  const { statusMap, subjectColorMap } = useLookupMaps();
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "daysUntil", desc: false },
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toJSTDateString(now), [now]);

  const fetchData = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const res = await api.get<{
        data: { problems: DDProblem[]; answers: DDAnswer[] };
      }>(`/problems-detail?project_id=${currentProject.id}`);
      const { problems, answers } = res.data;

      const answersByProblem = new Map<string, DDAnswer[]>();
      for (const a of answers) {
        const list = answersByProblem.get(a.problemId) ?? [];
        list.push(a);
        answersByProblem.set(a.problemId, list);
      }

      const built: ScheduleRow[] = [];

      for (const p of problems) {
        const pAnswers = answersByProblem.get(p.id) ?? [];
        if (pAnswers.length === 0) continue;

        const sorted = [...pAnswers].sort((a, b) =>
          a.date.localeCompare(b.date),
        );
        const latest = sorted[sorted.length - 1];
        const lastStatus =
          (latest.answerStatusId
            ? (statusMap.get(latest.answerStatusId) as AnswerStatus)
            : null) ?? "Yet";

        const nextReview = computeNextReview(latest.date, lastStatus);
        const daysUntil = -computeDaysOverdue(nextReview, todayStr);

        const color = problemColor(
          p.code,
          p.name ?? "",
          p.subjectId ? subjectColorMap.get(p.subjectId) ?? null : null,
        );

        built.push({
          problemId: p.id,
          code: p.code,
          name: p.name ?? "",
          color,
          lastStatus,
          statusColor: STATUS_COLORS[lastStatus],
          nextReview,
          daysUntil,
          reviewCount: sorted.length,
        });
      }

      setRows(built);
    } catch {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [currentProject, statusMap, subjectColorMap, todayStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSelect = useCallback((problemId: string) => {
    setSelectedId((prev) => (prev === problemId ? null : problemId));
    // Scroll to the row in the table
    requestAnimationFrame(() => {
      const row = tableRef.current?.querySelector(
        `[data-problem-id="${problemId}"]`,
      );
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

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
    <div className="p-3 md:p-4 flex flex-col gap-2 flex-1 min-h-0">
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
            <ScheduleChart items={rows} today={todayStr} onSelect={handleSelect} />
          </div>

          {/* Table */}
          <div ref={tableRef} className="flex-1 min-h-0 rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="sticky top-0 z-10 bg-background"
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
                    className={pid === selectedId ? "bg-accent" : undefined}
                    onClick={() => setSelectedId((prev) => (prev === pid ? null : pid))}
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
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
