"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import { api, ApiError } from "@/lib/api-client";
import { useProject } from "@/hooks/use-project";
import { usePageTitle } from "@/lib/page-context";
import { useProblemDialogs } from "@/hooks/use-problem-dialogs";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getColumns } from "./columns";
import type { ProblemWithAnswers } from "@/components/problem-card";
import type { Answer, AnswerStatus, Review, ProblemFile } from "@/lib/types";

interface DDProblem {
  id: string;
  code: string;
  name: string | null;
  subjectId: string | null;
  levelId: string | null;
  checkpoint: string | null;
  standardTime: number | null;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}
interface DDAnswer {
  id: string;
  problemId: string;
  date: string;
  duration: number | null;
  answerStatusId: string | null;
  createdAt: string;
}
interface DDReview {
  id: string;
  answerId: string;
  content: string | null;
  createdAt: string;
}
interface DDReviewTag { reviewId: string; tagId: string; }
interface DDTag { id: string; name: string; }
interface DDProblemFile {
  id: string;
  problemId: string;
  gdriveFileId: string;
  fileName: string | null;
  createdAt: string;
}

function secondsToDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function ProblemsPage() {
  usePageTitle("Problems");
  const { currentProject, subjects, levels, statuses, filterSubjectId, filterLevelId } = useProject();
  const [problems, setProblems] = useState<ProblemWithAnswers[]>([]);
  const [loading, setLoading] = useState(true);

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const subjectMap = useMemo(() => {
    const m = new Map<string, { name: string; color: string | null }>();
    for (const s of subjects) m.set(s.id, { name: s.name, color: s.color ?? null });
    return m;
  }, [subjects]);

  const levelMap = useMemo(() => {
    const m = new Map<string, { name: string; color: string | null }>();
    for (const l of levels) m.set(l.id, { name: l.name, color: l.color ?? null });
    return m;
  }, [levels]);

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

  const now = useMemo(() => new Date(), []);

  const fetchData = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const res = await api.get<{ data: {
        problems: DDProblem[];
        answers: DDAnswer[];
        reviews: DDReview[];
        reviewTags: DDReviewTag[];
        tags: DDTag[];
        problemFiles: DDProblemFile[];
      } }>(`/problems-detail?project_id=${currentProject.id}`);
      const { problems: ddProblems, answers: ddAnswers, reviews: ddReviews, reviewTags: ddReviewTags, tags: ddTags, problemFiles: ddFiles } = res.data;

      const tagMap = new Map<string, string>();
      for (const t of ddTags) tagMap.set(t.id, t.name);

      const reviewTagsMap = new Map<string, string[]>();
      for (const rt of ddReviewTags) {
        const list = reviewTagsMap.get(rt.reviewId) ?? [];
        list.push(tagMap.get(rt.tagId) ?? "");
        reviewTagsMap.set(rt.reviewId, list);
      }

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

      const answersByProblem = new Map<string, (Answer & { reviews: Review[] })[]>();
      for (const a of ddAnswers) {
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
        const list = answersByProblem.get(a.problemId) ?? [];
        list.push(ldAnswer);
        answersByProblem.set(a.problemId, list);
      }

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

      const combined: ProblemWithAnswers[] = ddProblems.map((p) => ({
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
      }));

      setProblems(combined);
    } catch {
      toast.error("Failed to fetch problems");
    } finally {
      setLoading(false);
    }
  }, [currentProject, statusMap, statusPointMap]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => problems.filter((p) => {
    if (filterSubjectId && p.subject_id !== filterSubjectId) return false;
    if (filterLevelId && p.level_id !== filterLevelId) return false;
    return true;
  }), [problems, filterSubjectId, filterLevelId]);

  // Shared dialogs (detail, edit, answer create/edit, fab)
  const { openDetail, renderDialogs } = useProblemDialogs({
    allProblems: problems,
    onDataChanged: fetchData,
  });

  const handleDeleteProblem = useCallback(async (id: string) => {
    try {
      await api.delete(`/problems/${id}`);
      toast.success("削除しました");
      fetchData();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.body.error : "削除に失敗しました");
    }
  }, [fetchData]);

  const handleCellUpdate = useCallback(async (id: string, field: string, value: unknown) => {
    try {
      await api.put(`/problems/${id}`, { [field]: value });
      setProblems((prev) => prev.map((p) =>
        p.id === id ? { ...p, [field]: value } : p,
      ));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.body.error : "更新に失敗しました");
    }
  }, []);

  const columns = useMemo(
    () => getColumns({ subjectMap, levelMap, now, onDelete: handleDeleteProblem, onCellUpdate: handleCellUpdate }),
    [subjectMap, levelMap, now, handleDeleteProblem, handleCellUpdate],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = (filterValue as string).toLowerCase();
      const code = row.original.code.toLowerCase();
      const name = (row.original.name ?? "").toLowerCase();
      return code.includes(search) || name.includes(search);
    },
  });

  if (!currentProject) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-12 text-muted-foreground">Please select a project</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search code or name..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9 h-8"
            />
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => openDetail(row.original.id)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No problems found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="text-xs text-muted-foreground">
            {table.getFilteredRowModel().rows.length} problems
          </div>
        </div>
      )}

      {renderDialogs()}
    </div>
  );
}
