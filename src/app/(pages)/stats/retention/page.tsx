"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { api } from "@/lib/api-client";
import { useProject } from "@/hooks/use-project";
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
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AnswerStatus } from "@/lib/types";

const MAX_LINES = 30;

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

/* ── Color helpers ── */

function hashToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const r = (hash >> 16) & 0xff;
  const g = (hash >> 8) & 0xff;
  const b = hash & 0xff;
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** hash(20%) + subject(80%), then +20% white */
function problemColor(hashHex: string, subjectHex: string): string {
  const [hr, hg, hb] = parseHex(hashHex);
  const [sr, sg, sb] = parseHex(subjectHex);
  const mr = hr * 0.2 + sr * 0.8;
  const mg = hg * 0.2 + sg * 0.8;
  const mb = hb * 0.2 + sb * 0.8;
  const fr = mr * 0.8 + 255 * 0.2;
  const fg = mg * 0.8 + 255 * 0.2;
  const fb = mb * 0.8 + 255 * 0.2;
  return toHex(fr, fg, fb);
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
  const { currentProject, subjects, statuses, filterSubjectId } = useProject();
  const [allMetas, setAllMetas] = useState<ProblemRetentionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "retention", desc: false },
  ]);

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

  // Filter by subject, sort by lowest retention, cap at MAX_LINES
  const visible = useMemo(() => {
    let list = allMetas;
    if (filterSubjectId) {
      list = list.filter((m) => m.subjectId === filterSubjectId);
    }
    return [...list]
      .sort((a, b) => a.currentRetention - b.currentRetention)
      .slice(0, MAX_LINES);
  }, [allMetas, filterSubjectId]);

  const totalFiltered = useMemo(() => {
    if (!filterSubjectId) return allMetas.length;
    return allMetas.filter((m) => m.subjectId === filterSubjectId).length;
  }, [allMetas, filterSubjectId]);

  // Color map
  const problemColorMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const meta of visible) {
      const hashed = hashToColor(meta.code + meta.name);
      const subjectColor = subjectColorMap.get(meta.subjectId);
      m.set(
        meta.problemId,
        subjectColor ? problemColor(hashed, subjectColor) : hashed,
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
      .map(([date, vals]) => ({ date, ...vals }));
  }, [visible, now]);

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
        answerCount: m.dated.length,
        retention: m.currentRetention,
        color: problemColorMap.get(m.problemId) ?? "#888",
      })),
    [visible, subjectNameMap, problemColorMap],
  );

  const table = useReactTable({
    data: tableData,
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
    <div className="p-4 md:p-6 space-y-4">
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading...
        </div>
      ) : chartData.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No data</div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            保持率が低い順に {visible.length} / {totalFiltered} 問題を表示
          </div>

          <ChartContainer
            config={chartConfig}
            className="h-[50vh] min-h-[250px] w-full"
          >
            <LineChart
              data={chartData}
              margin={{ left: 0, right: 8, top: 4, bottom: 0 }}
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
                  />
                );
              })}
            </LineChart>
          </ChartContainer>

          {/* Problems table */}
          <div className="rounded-md border overflow-x-auto">
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
