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
import { usePageTitle } from "@/lib/page-context";
import { OpaqueTag, type ProblemWithAnswers } from "@/components/problem-card";
import { useProblemDialogs } from "@/hooks/use-problem-dialogs";
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
import type { ScheduleRow as ScheduleApiRow } from "@/lib/api-responses";
import { CheckboxFilter } from "@/components/shared/checkbox-filter";

/* ── Row types ── */

/** Display row — adds reviewCount for the "next 4 weeks" forecast cell. */
interface ScheduleRow extends Omit<ScheduleApiRow, "answerCount"> {
  reviewCount: number;
  standardTime: number | null;
}

/* ── Schedule Chart (SVG) ── */

const CELL = 14;
const GAP = 2;
const STEP = CELL + GAP;

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
  onOpen,
  selectedId,
  colorMode = "problem",
  statusOrderMap,
}: {
  items: ScheduleRow[];
  today: string;
  onSelect?: (problemId: string) => void;
  onOpen?: (problemId: string) => void;
  selectedId?: string | null;
  colorMode?: ChartColorMode;
  statusOrderMap: Map<string, number>;
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
      list.sort((a, b) => (statusOrderMap.get(a.lastStatus) ?? 0) - (statusOrderMap.get(b.lastStatus) ?? 0));
    }
    return map;
  }, [items]);

  // Date range: cover all data with padding
  const { dates, todayIdx } = useMemo(() => {
    const reviewDates = items.map((i) => i.nextReview);
    const allDates = [today, ...reviewDates];
    const minDate = allDates.reduce((a, b) => (a < b ? a : b));
    const maxDate = allDates.reduce((a, b) => (a > b ? a : b));

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

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let i = 5; i <= maxStack; i += 5) ticks.push(i);
    return ticks;
  }, [maxStack]);

  return (
    <div className="flex">
      <svg width={Y_AXIS_W} height={chartHeight} className="block shrink-0">
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
      <svg width={chartWidth} height={chartHeight} className="block">
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
              {/* Today column highlight */}
              {isToday && (
                <rect
                  x={x - 1}
                  y={TOP_AXIS_H}
                  width={CELL + 2}
                  height={maxStack * STEP}
                  fill="hsl(var(--foreground))"
                  opacity={0.06}
                />
              )}
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
                      onClick={() => isSelected ? onOpen?.(item.problemId) : onSelect?.(item.problemId)}
                      onDoubleClick={() => onOpen?.(item.problemId)}
                    >
                      <title>
                        {item.code} {item.name}
                      </title>
                    </rect>
                  </g>
                );
              })}
              {/* Top axis: relative days (every 7 days from today, plus today itself) */}
              {(() => {
                const diff = todayIdx >= 0 ? colIdx - todayIdx : 0;
                if (diff % 7 !== 0) return null;
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
              {/* Bottom axis: absolute dates (same cadence) */}
              {(() => {
                const diff = todayIdx >= 0 ? colIdx - todayIdx : 0;
                if (diff % 7 !== 0) return null;
                return (
                  <text
                    x={x + CELL / 2}
                    y={chartHeight - 4}
                    textAnchor="middle"
                    className="fill-muted-foreground"
                    fontSize={9}
                    fontWeight={isToday ? 700 : 400}
                  >
                    {`${new Date(date + "T12:00:00").getMonth() + 1} / ${new Date(date + "T12:00:00").getDate()}`}
                  </text>
                );
              })()}
            </g>
          );
        })}
      </svg>
      </div>
    </div>
  );
}

/* ── Summary Card ── */

type SummaryFilter = "today" | "week";

function SummaryCard({
  label,
  count,
  minutes,
  active,
  onClick,
  variant,
}: {
  label: string;
  count: number;
  minutes?: number;
  active: boolean;
  onClick: () => void;
  variant: "default" | "muted";
}) {
  const base = "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors select-none";
  const variants = {
    default: active
      ? "bg-foreground/10 border-foreground/30 text-foreground"
      : "hover:bg-foreground/5 text-foreground/70",
    muted: active
      ? "bg-accent border-accent-foreground/20 text-accent-foreground"
      : "hover:bg-muted text-muted-foreground",
  };
  return (
    <button type="button" className={`${base} ${variants[variant]}`} onClick={onClick}>
      <span>{label}</span>
      <span className="tabular-nums font-bold">{count}</span>
      {minutes != null && minutes > 0 && (
        <span className="tabular-nums text-muted-foreground font-normal">
          ~{minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 > 0 ? `${minutes % 60}m` : ""}` : `${minutes}m`}
        </span>
      )}
    </button>
  );
}

/* ── Column defs ── */

const columns: ColumnDef<ScheduleRow>[] = [
  {
    accessorKey: "lastStatus",
    header: ({ column }) => <SortHeader column={column}>Status</SortHeader>,
    cell: ({ row }) => {
      return <StatusTag status={row.original.lastStatus} color={row.original.statusColor} opaque className="text-[10px]" />;
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
    size: 270,
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
    size: 64,
  },
];

/* ── Page ── */

export default function SchedulePage() {
  usePageTitle("復習スケジュール");
  const { currentProject, subjects, levels, statuses } = useProject();

  // Build status name → sortOrder map from DB statuses
  const statusOrderMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of statuses) m.set(s.name, s.sortOrder);
    return m;
  }, [statuses]);

  // Schedule data (fast path via /schedule API)
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog data (background path via /problems-list)
  const [allProblems, setAllProblems] = useState<ProblemWithAnswers[]>([]);

  // UI state
  const [sorting, setSorting] = useState<SortingState>([
    { id: "daysUntil", desc: false },
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chartColorMode, setChartColorMode] = useState<ChartColorMode>("status");
  const tableRef = useRef<HTMLDivElement>(null);

  // Filter state
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter | null>(null);
  const [filterSubjects, setFilterSubjects] = useState<Set<string>>(new Set());
  const [filterLevels, setFilterLevels] = useState<Set<string>>(new Set());
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());

  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toJSTDateString(now), [now]);

  /* ── Fast path: /schedule API ── */
  const fetchSchedule = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const res = await api.get<{ data: ScheduleApiRow[] }>(
        `/schedule?project_id=${currentProject.id}`,
      );
      const built: ScheduleRow[] = res.data.map((r) => ({
        problemId: r.problemId,
        code: r.code,
        name: r.name,
        subjectId: r.subjectId,
        subjectName: r.subjectName,
        subjectColor: r.subjectColor,
        levelId: r.levelId,
        levelName: r.levelName,
        levelColor: r.levelColor,
        color: r.color,
        lastStatus: r.lastStatus,
        statusColor: r.statusColor,
        nextReview: r.nextReview,
        daysUntil: r.daysUntil,
        reviewCount: r.answerCount,
        standardTime: r.standardTime,
        answerHistory: r.answerHistory,
      }));
      setRows(built);
    } catch {
      toast.error("Failed to fetch schedule");
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  /* ── Background: /problems-list for dialogs ── */
  const fetchDialogData = useCallback(async () => {
    if (!currentProject) return;
    try {
      const res = await api.get<{ data: ProblemWithAnswers[] }>(
        `/problems-list?project_id=${currentProject.id}`,
      );
      setAllProblems(res.data);
    } catch {
      // Dialog data is non-critical
    }
  }, [currentProject]);

  // Fetch schedule first (fast), then dialog data in background
  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);
  useEffect(() => { if (currentProject) fetchDialogData(); }, [currentProject, fetchDialogData]);

  const handleDataChanged = useCallback(() => {
    fetchSchedule();
    fetchDialogData();
  }, [fetchSchedule, fetchDialogData]);

  const { openDetail, renderDialogs } = useProblemDialogs({
    allProblems,
    onDataChanged: handleDataChanged,
  });

  /* ── Filtered rows ── */

  const baseFilteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (filterSubjects.size > 0 && (!r.subjectId || !filterSubjects.has(r.subjectId))) return false;
      if (filterLevels.size > 0 && (!r.levelId || !filterLevels.has(r.levelId))) return false;
      if (filterStatuses.size > 0 && !filterStatuses.has(r.lastStatus)) return false;
      return true;
    });
  }, [rows, filterSubjects, filterLevels, filterStatuses]);

  const summaryCounts = useMemo(() => {
    const todayRows = baseFilteredRows.filter((r) => r.daysUntil <= 0);
    const weekRows = baseFilteredRows.filter((r) => r.daysUntil > 0 && r.daysUntil <= 7);
    const sumTime = (rs: ScheduleRow[]) =>
      rs.reduce((s, r) => s + (r.standardTime ?? 0), 0);
    return {
      today: todayRows.length,
      todayMin: Math.round(sumTime(todayRows) / 60),
      week: weekRows.length,
      weekMin: Math.round(sumTime(weekRows) / 60),
    };
  }, [baseFilteredRows]);

  const displayRows = useMemo(() => {
    if (!summaryFilter) return baseFilteredRows;
    if (summaryFilter === "today") return baseFilteredRows.filter((r) => r.daysUntil <= 0);
    return baseFilteredRows.filter((r) => r.daysUntil > 0 && r.daysUntil <= 7);
  }, [baseFilteredRows, summaryFilter]);

  const chartRows = useMemo(
    () => baseFilteredRows.filter((r) => r.reviewCount > 0),
    [baseFilteredRows],
  );

  const handleSelect = useCallback((problemId: string) => {
    setSelectedId((prev) => (prev === problemId ? null : problemId));
    requestAnimationFrame(() => {
      const row = tableRef.current?.querySelector(
        `[data-problem-id="${problemId}"]`,
      );
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  const table = useReactTable({
    data: displayRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const availableStatuses = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.lastStatus);
    return Array.from(set).sort((a, b) => (statusOrderMap.get(a) ?? 0) - (statusOrderMap.get(b) ?? 0));
  }, [rows, statusOrderMap]);

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
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No data</div>
      ) : (
        <>
          {/* Summary cards + Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <SummaryCard
              label="今日"
              count={summaryCounts.today}
              minutes={summaryCounts.todayMin}
              active={summaryFilter === "today"}
              onClick={() => setSummaryFilter((p) => p === "today" ? null : "today")}
              variant="default"
            />
            <SummaryCard
              label="7日以内"
              count={summaryCounts.week}
              minutes={summaryCounts.weekMin}
              active={summaryFilter === "week"}
              onClick={() => setSummaryFilter((p) => p === "week" ? null : "week")}
              variant="muted"
            />

            <div className="h-4 w-px bg-border mx-1" />

            {subjects.length > 0 && (
              <CheckboxFilter
                items={subjects.map((s) => ({ value: s.id, label: s.name }))}
                selected={filterSubjects}
                onChange={setFilterSubjects}
                allLabel="All Subjects"
              />
            )}
            {levels.length > 0 && (
              <CheckboxFilter
                items={levels.map((l) => ({ value: l.id, label: l.name }))}
                selected={filterLevels}
                onChange={setFilterLevels}
                allLabel="All Levels"
              />
            )}
            {availableStatuses.length > 1 && (
              <CheckboxFilter
                items={availableStatuses.map((s) => ({ value: s, label: s }))}
                selected={filterStatuses}
                onChange={setFilterStatuses}
                allLabel="All Statuses"
              />
            )}
          </div>

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
            <ScheduleChart items={chartRows} today={todayStr} onSelect={handleSelect} onOpen={openDetail} selectedId={selectedId} colorMode={chartColorMode} statusOrderMap={statusOrderMap} />
          </div>

          {/* Table */}
          <div
            ref={tableRef}
            className="rounded-md border overflow-auto resize-y"
            style={{ height: "calc(10 * 2.25rem)", minHeight: "6rem", maxHeight: "80vh" }}
          >
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
                          : flexRender(header.column.columnDef.header, header.getContext())}
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
                    onDoubleClick={() => openDetail(pid)}
                  >
                    <TableCell className="w-4 px-2">
                      <div
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: row.original.color }}
                      />
                    </TableCell>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} style={{ width: cell.column.getSize() !== 150 ? cell.column.getSize() : undefined }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
