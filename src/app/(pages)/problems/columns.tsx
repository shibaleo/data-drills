"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import type { ProblemWithAnswers } from "@/components/problem-card";
import { computeForgettingInfo } from "@/lib/forgetting-curve";
import { toJSTDate } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";

const TAG_BASE = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs";

function OpaqueTag({ name, color }: { name: string; color: string | null }) {
  if (!color) {
    return <span className={`${TAG_BASE} bg-muted text-muted-foreground`}>{name}</span>;
  }
  return (
    <span
      className={TAG_BASE}
      style={{
        color,
        backgroundColor: `color-mix(in srgb, hsl(var(--card)) 80%, ${color})`,
      }}
    >
      {name}
    </span>
  );
}

interface ColumnOpts {
  subjectMap: Map<string, { name: string; color: string | null }>;
  levelMap: Map<string, { name: string; color: string | null }>;
  now: Date;
  onDelete: (id: string) => void;
}

function SortHeader({ column, children }: { column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (desc: boolean) => void }; children: React.ReactNode }) {
  const sorted = column.getIsSorted();
  return (
    <Button
      variant="ghost"
      className="-ml-3 h-8"
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {children}
      {sorted === "asc" ? <ArrowUp className="ml-1 size-3.5" />
        : sorted === "desc" ? <ArrowDown className="ml-1 size-3.5" />
        : <ArrowUpDown className="ml-1 size-3.5 opacity-40" />}
    </Button>
  );
}

export function getColumns({ subjectMap, levelMap, now, onDelete }: ColumnOpts): ColumnDef<ProblemWithAnswers>[] {
  return [
    {
      accessorKey: "code",
      header: ({ column }) => <SortHeader column={column}>Code</SortHeader>,
      cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>,
    },
    {
      accessorKey: "name",
      header: ({ column }) => <SortHeader column={column}>Name</SortHeader>,
      cell: ({ getValue }) => <span className="max-w-[200px] truncate block">{getValue<string>()}</span>,
    },
    {
      id: "subject",
      accessorFn: (row) => subjectMap.get(row.subject_id)?.name ?? "",
      header: ({ column }) => <SortHeader column={column}>Subject</SortHeader>,
      cell: ({ row }) => {
        const info = subjectMap.get(row.original.subject_id);
        if (!info?.name) return null;
        return <OpaqueTag name={info.name} color={info.color} />;
      },
    },
    {
      id: "level",
      accessorFn: (row) => levelMap.get(row.level_id)?.name ?? "",
      header: ({ column }) => <SortHeader column={column}>Level</SortHeader>,
      cell: ({ row }) => {
        const info = levelMap.get(row.original.level_id);
        if (!info?.name) return null;
        return <OpaqueTag name={info.name} color={info.color} />;
      },
    },
    {
      id: "answerCount",
      accessorFn: (row) => row.answers.length,
      header: ({ column }) => <SortHeader column={column}>Ans</SortHeader>,
      cell: ({ getValue }) => <span className="text-xs text-muted-foreground tabular-nums">{getValue<number>()}</span>,
    },
    {
      id: "lastAnswerDate",
      accessorFn: (row) => {
        if (row.answers.length === 0) return null;
        return row.answers.reduce((latest, a) =>
          (a.date && (!latest || a.date > latest)) ? a.date : latest,
          null as string | null,
        );
      },
      header: ({ column }) => <SortHeader column={column}>Last</SortHeader>,
      cell: ({ getValue }) => {
        const date = getValue<string | null>();
        if (!date) return <span className="text-muted-foreground text-xs">--</span>;
        return <span className="text-xs tabular-nums">{toJSTDate(date)}</span>;
      },
      sortUndefined: "last",
    },
    {
      id: "retention",
      accessorFn: (row) => computeForgettingInfo(row.answers, now)?.retention ?? -1,
      header: ({ column }) => <SortHeader column={column}>Ret</SortHeader>,
      cell: ({ getValue }) => {
        const ret = getValue<number>();
        if (ret < 0) return <span className="text-muted-foreground text-xs">--</span>;
        const pct = Math.round(ret * 100);
        const hue = ret * 120;
        return (
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-10 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: `hsl(${hue}, 80%, 50%)` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
          </div>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(row.original.id); }}
          className="inline-flex size-6 items-center justify-center rounded text-muted-foreground/40 hover:text-destructive transition-colors"
        >
          <Trash2 className="size-3.5" />
        </button>
      ),
    },
  ];
}
