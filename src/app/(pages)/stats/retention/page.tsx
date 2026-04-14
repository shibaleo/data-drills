"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronsUpDown, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { useProject } from "@/hooks/use-project";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { usePageTitle } from "@/lib/page-context";
import {
  buildRetentionMeta,
  buildRetentionSeries,
  type ProblemRetentionMeta,
} from "@/lib/retention-series";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { problemColor as computeProblemColor } from "@/lib/problem-color";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ANSWER_STATUSES, type AnswerStatus } from "@/lib/types";

interface DDProblem {
  id: string;
  code: string;
  name: string | null;
  subjectId: string | null;
  levelId: string | null;
  projectId: string;
}
interface DDAnswer {
  id: string;
  problemId: string;
  date: string;
  answerStatusId: string | null;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/* ── Table row type ── */

interface RowData {
  problemId: string;
  code: string;
  name: string;
  subjectName: string;
  levelName: string;
  answerCount: number;
  retention: number;
  color: string;
}

/* ── Sort header ── */

function SortHeader({
  column,
  children,
}: {
  column: {
    getIsSorted: () => false | "asc" | "desc";
    toggleSorting: (desc: boolean) => void;
  };
  children: React.ReactNode;
}) {
  const sorted = column.getIsSorted();
  return (
    <Button
      variant="ghost"
      className="-ml-3 h-8"
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {children}
      {sorted === "asc" ? (
        <ArrowUp className="ml-1 size-3.5" />
      ) : sorted === "desc" ? (
        <ArrowDown className="ml-1 size-3.5" />
      ) : (
        <ArrowUpDown className="ml-1 size-3.5 opacity-40" />
      )}
    </Button>
  );
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
      <span className="max-w-[200px] truncate block text-xs">
        {getValue<string>()}
      </span>
    ),
  },
  {
    accessorKey: "subjectName",
    header: ({ column }) => <SortHeader column={column}>Subject</SortHeader>,
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground">
        {getValue<string>()}
      </span>
    ),
  },
  {
    accessorKey: "levelName",
    header: ({ column }) => <SortHeader column={column}>Level</SortHeader>,
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground">
        {getValue<string>()}
      </span>
    ),
  },
  {
    accessorKey: "answerCount",
    header: ({ column }) => <SortHeader column={column}>Ans</SortHeader>,
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {getValue<number>()}
      </span>
    ),
  },
  {
    accessorKey: "retention",
    header: ({ column }) => <SortHeader column={column}>Ret</SortHeader>,
    cell: ({ getValue }) => {
      const ret = getValue<number>();
      const hue = (ret / 100) * 120;
      return (
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-10 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${ret}%`,
                backgroundColor: `hsl(${hue}, 80%, 50%)`,
              }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {ret}%
          </span>
        </div>
      );
    },
  },
];

/* ── Page ── */

export default function RetentionDetailPage() {
  usePageTitle("保持率推移");
  const { currentProject, subjects, levels, statuses } = useProject();
  const [allMetas, setAllMetas] = useState<ProblemRetentionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "retention", desc: false },
  ]);
  const [filterSubjects, setFilterSubjects] = useState<Set<string>>(new Set());
  const [filterLevels, setFilterLevels] = useState<Set<string>>(new Set());
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(() => new Set(["Yet"]));
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);

  const now = useMemo(() => new Date(), []);

  const statusMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of statuses) m.set(s.id, s.name);
    return m;
  }, [statuses]);

  const statusPointMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of statuses) m.set(s.id, s.point ?? 0);
    return m;
  }, [statuses]);

  const subjectColorMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of subjects) m.set(s.id, s.color ?? "");
    return m;
  }, [subjects]);

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

  const fetchData = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const res = await api.get<{
        data: { problems: DDProblem[]; answers: DDAnswer[] };
      }>(`/problems-detail?project_id=${currentProject.id}`);
      const { problems, answers } = res.data;

      const answersByProblem = new Map<
        string,
        { date: string; status: AnswerStatus | null; point?: number }[]
      >();
      for (const a of answers) {
        const status = a.answerStatusId
          ? ((statusMap.get(a.answerStatusId) as AnswerStatus) ?? null)
          : null;
        const point = a.answerStatusId
          ? statusPointMap.get(a.answerStatusId)
          : undefined;
        const list = answersByProblem.get(a.problemId) ?? [];
        list.push({ date: a.date, status, point });
        answersByProblem.set(a.problemId, list);
      }

      const built: ProblemRetentionMeta[] = [];
      for (const p of problems) {
        const m = buildRetentionMeta(
          p.id,
          p.code,
          p.name ?? "",
          p.subjectId ?? "",
          p.levelId ?? "",
          answersByProblem.get(p.id) ?? [],
          now,
        );
        if (m) built.push(m);
      }

      setAllMetas(built);
    } catch {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [currentProject, statusMap, statusPointMap, now]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter by subject + level + last status
  const visible = useMemo(() => {
    return allMetas.filter((m) => {
      if (filterSubjects.size > 0 && !filterSubjects.has(m.subjectId)) return false;
      if (filterLevels.size > 0 && !filterLevels.has(m.levelId)) return false;
      if (filterStatuses.size > 0 && filterStatuses.size < ANSWER_STATUSES.length) {
        const lastStatus = m.dated[m.dated.length - 1]?.status;
        if (!lastStatus || !filterStatuses.has(lastStatus)) return false;
      }
      return true;
    });
  }, [allMetas, filterSubjects, filterLevels, filterStatuses]);

  // Color map
  const problemColorMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const meta of visible) {
      m.set(
        meta.problemId,
        computeProblemColor(meta.code, meta.name, subjectColorMap.get(meta.subjectId) ?? null),
      );
    }
    return m;
  }, [visible, subjectColorMap]);

  // Chart data
  const chartData = useMemo(() => {
    if (visible.length === 0) return [];
    const dateMap = new Map<string, Record<string, number>>();
    for (const meta of visible) {
      const series = buildRetentionSeries(meta, now);
      for (const pt of series) {
        const row = dateMap.get(pt.date) ?? {};
        row[meta.problemId] = pt.retention;
        dateMap.set(pt.date, row);
      }
    }
    return [...dateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .filter(([date]) => {
        if (dateFrom && date < dateFrom) return false;
        if (dateTo && date > dateTo) return false;
        return true;
      })
      .map(([date, vals]) => ({ date, ...vals }));
  }, [visible, now, dateFrom, dateTo]);

  const chartConfig = useMemo(() => {
    const cfg: ChartConfig = {};
    for (const m of visible) {
      cfg[m.problemId] = {
        label: m.code,
        color: problemColorMap.get(m.problemId) ?? "#888",
      };
    }
    return cfg;
  }, [visible, problemColorMap]);

  // Table data
  const tableData: RowData[] = useMemo(
    () =>
      visible.map((m) => ({
        problemId: m.problemId,
        code: m.code,
        name: m.name,
        subjectName: subjectNameMap.get(m.subjectId) ?? "",
        levelName: levelNameMap.get(m.levelId) ?? "",
        answerCount: m.dated.length,
        retention: m.currentRetention,
        color: problemColorMap.get(m.problemId) ?? "#888",
      })),
    [visible, subjectNameMap, levelNameMap, problemColorMap],
  );

  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Scroll selected row into view
  useEffect(() => {
    if (!selectedId || !tableRef.current) return;
    const row = tableRef.current.querySelector(`[data-problem-id="${selectedId}"]`);
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

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
    <div className="p-4 md:p-6 flex flex-col flex-1 min-h-0 gap-4">
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading...
        </div>
      ) : chartData.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No data</div>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap shrink-0">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-8 w-[160px] justify-between text-xs font-normal">
                  {filterSubjects.size === 0
                    ? "All Subjects"
                    : `${filterSubjects.size} Subject${filterSubjects.size > 1 ? "s" : ""}`}
                  <ChevronsUpDown className="ml-1 size-3 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-2 max-h-60 overflow-y-auto">
                {subjects.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-sm hover:bg-accent cursor-pointer"
                  >
                    <Checkbox
                      checked={filterSubjects.has(s.id)}
                      onCheckedChange={(checked) => {
                        setFilterSubjects((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(s.id);
                          else next.delete(s.id);
                          return next;
                        });
                      }}
                    />
                    {s.name}
                  </label>
                ))}
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-8 w-[160px] justify-between text-xs font-normal">
                  {filterLevels.size === 0
                    ? "All Levels"
                    : `${filterLevels.size} Level${filterLevels.size > 1 ? "s" : ""}`}
                  <ChevronsUpDown className="ml-1 size-3 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-2 max-h-60 overflow-y-auto">
                {levels.map((l) => (
                  <label
                    key={l.id}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-sm hover:bg-accent cursor-pointer"
                  >
                    <Checkbox
                      checked={filterLevels.has(l.id)}
                      onCheckedChange={(checked) => {
                        setFilterLevels((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(l.id);
                          else next.delete(l.id);
                          return next;
                        });
                      }}
                    />
                    {l.name}
                  </label>
                ))}
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-8 w-[160px] justify-between text-xs font-normal">
                  {filterStatuses.size === 0 || filterStatuses.size === ANSWER_STATUSES.length
                    ? "All Statuses"
                    : `${filterStatuses.size} Status${filterStatuses.size > 1 ? "es" : ""}`}
                  <ChevronsUpDown className="ml-1 size-3 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-2 max-h-60 overflow-y-auto">
                {ANSWER_STATUSES.map((s) => (
                  <label
                    key={s}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-sm hover:bg-accent cursor-pointer"
                  >
                    <Checkbox
                      checked={filterStatuses.has(s)}
                      onCheckedChange={(checked) => {
                        setFilterStatuses((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(s);
                          else next.delete(s);
                          return next;
                        });
                      }}
                    />
                    {s}
                  </label>
                ))}
              </PopoverContent>
            </Popover>
            <div className="ml-auto flex items-center gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-[140px] text-xs"
            />
            <span className="text-xs text-muted-foreground">~</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-[140px] text-xs"
            />
            {(dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => { setDateFrom(""); setDateTo(""); }}
              >
                <X className="size-3.5" />
              </Button>
            )}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {visible.length} 問題
            </span>
          </div>

          <ChartContainer
            config={chartConfig}
            className="h-[35vh] min-h-[200px] w-full shrink-0"
          >
            <LineChart
              data={chartData}
              margin={{ left: 0, right: 8, top: 4, bottom: 0 }}
              onClick={(e) => {
                if (!e?.activePayload?.length) return;
                const payload = e.activePayload[0]?.payload as Record<string, unknown> | undefined;
                if (!payload) return;
                const chartY = e.chartY ?? 0;
                const offset = (e as unknown as { offset?: { top: number; height: number } }).offset;
                // Compute retention value at click position
                const plotH = offset?.height;
                const plotTop = offset?.top ?? 0;
                const clickedRet = plotH ? (1 - (chartY - plotTop) / plotH) * 100 : null;
                let bestId: string | null = null;
                let bestDist = Infinity;
                for (const m of visible) {
                  const val = payload[m.problemId];
                  if (typeof val !== "number") continue;
                  const dist = clickedRet !== null ? Math.abs(val - clickedRet) : 0;
                  if (dist < bestDist) { bestDist = dist; bestId = m.problemId; }
                }
                if (bestId) setSelectedId((prev) => prev === bestId ? null : bestId);
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
                width={32}
                tickFormatter={(v) => `${v}%`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => {
                      const cfg = chartConfig[name as string];
                      return [`${value}%`, cfg?.label ?? name];
                    }}
                  />
                }
              />
              {visible.map((m) => {
                const color = problemColorMap.get(m.problemId) ?? "#888";
                const dimmed =
                  selectedId !== null && selectedId !== m.problemId;
                return (
                  <Line
                    key={m.problemId}
                    dataKey={m.problemId}
                    type="monotone"
                    stroke={color}
                    strokeWidth={selectedId === m.problemId ? 2.5 : 1.5}
                    strokeOpacity={dimmed ? 0.1 : 1}
                    dot={false}
                    activeDot={{ r: 3, cursor: "pointer" }}
                  />
                );
              })}
            </LineChart>
          </ChartContainer>

          {/* Problems table — scrolls independently */}
          <div ref={tableRef} className="flex-1 min-h-0 rounded-md border overflow-y-auto overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead key={header.id}>
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
