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
import { useAnswerForm, useEditAnswerForm } from "@/hooks/use-answer-form";
import { usePageTitle } from "@/lib/page-context";
import { Fab } from "@/components/shared/fab";
import { ProblemDetailDialog } from "@/components/problem-detail-dialog";
import { ProblemEditDialog } from "@/components/problem-edit-dialog";
import { AnswerDialog } from "@/components/answer-dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getColumns } from "./columns";
import type { ProblemWithAnswers } from "@/components/problem-card";
import type { Problem, Answer, AnswerStatus, Review, ProblemFile } from "@/lib/types";

interface DDProblem {
  id: string;
  code: string;
  name: string | null;
  subjectId: string | null;
  levelId: string | null;
  checkpoint: string | null;
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

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailProblemId, setDetailProblemId] = useState<string | null>(null);
  const detailProblem = detailProblemId ? problems.find(p => p.id === detailProblemId) ?? null : null;

  // Problem edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editProblem, setEditProblem] = useState<Problem | null>(null);

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

  // Answer create/edit forms
  const answerForm = useAnswerForm(() => { fetchData(); });
  const editForm = useEditAnswerForm(() => { fetchData(); });

  const handleEditProblem = (p: Problem) => {
    setDetailOpen(false);
    setEditProblem(p);
    setEditDialogOpen(true);
  };

  const handleDeleteProblem = useCallback(async (id: string) => {
    try {
      await api.delete(`/problems/${id}`);
      toast.success("削除しました");
      setDetailOpen(false);
      fetchData();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.body.error : "削除に失敗しました");
    }
  }, [fetchData]);

  const handleRowClick = (p: ProblemWithAnswers) => {
    setDetailProblemId(p.id);
    setDetailOpen(true);
  };

  const columns = useMemo(
    () => getColumns({ subjectMap, levelMap, now, onDelete: handleDeleteProblem }),
    [subjectMap, levelMap, now, handleDeleteProblem],
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
                      onClick={() => handleRowClick(row.original)}
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

      {/* Problem detail dialog (ProblemCard) */}
      <ProblemDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        problem={detailProblem}
        now={now}
        onEditProblem={handleEditProblem}
        onEditAnswer={(answer, problem) => {
          setDetailOpen(false);
          editForm.openFor(answer, problem);
        }}
        onCheck={(problem) => {
          setDetailOpen(false);
          answerForm.openForProblem(problem as Problem & { answers: { date: string | null; status: AnswerStatus | null }[] });
        }}
        onDelete={handleDeleteProblem}
        onPdfLinked={() => fetchData()}
      />

      {/* Problem edit dialog */}
      <ProblemEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        problem={editProblem ? {
          id: editProblem.id,
          code: editProblem.code,
          name: editProblem.name,
          subjectId: editProblem.subject_id,
          levelId: editProblem.level_id,
          checkpoint: editProblem.checkpoint,
        } : null}
        projectId={currentProject.id}
        subjects={subjects}
        levels={levels}
        onSaved={() => { setEditDialogOpen(false); fetchData(); }}
        onDelete={editProblem ? () => handleDeleteProblem(editProblem.id) : undefined}
      />

      {/* Answer create dialog */}
      <AnswerDialog
        open={answerForm.open}
        onOpenChange={answerForm.setOpen}
        title="解答を登録"
        subject={answerForm.subject}
        onSubjectChange={answerForm.setSubject}
        level={answerForm.level}
        onLevelChange={answerForm.setLevel}
        code={answerForm.code}
        onCodeChange={answerForm.setCode}
        codeSuggestions={answerForm.codeSuggestions}
        checkpointMap={answerForm.checkpointMap}
        nameMap={answerForm.nameMap}
        status={answerForm.status}
        onStatusChange={answerForm.setStatus}
        duration={answerForm.duration}
        onDurationChange={answerForm.setDuration}
        reviews={answerForm.reviews}
        onAddReview={answerForm.addReview}
        onUpdateReview={answerForm.updateReview}
        onRemoveReview={answerForm.removeReview}
        saveLabel="登録"
        onSave={answerForm.save}
      />

      {/* Answer edit dialog */}
      <AnswerDialog
        open={editForm.open}
        onOpenChange={editForm.setOpen}
        title="解答を編集"
        subject={editForm.subject}
        onSubjectChange={editForm.setSubject}
        level={editForm.level}
        onLevelChange={editForm.setLevel}
        code={editForm.code}
        onCodeChange={editForm.setCode}
        codeSuggestions={editForm.codeSuggestions}
        checkpointMap={editForm.checkpointMap}
        nameMap={editForm.nameMap}
        status={editForm.status}
        onStatusChange={editForm.setStatus}
        duration={editForm.duration}
        onDurationChange={editForm.setDuration}
        reviews={editForm.reviews}
        onAddReview={editForm.addReview}
        onUpdateReview={editForm.updateReview}
        onRemoveReview={editForm.removeReview}
        saveLabel="保存"
        onSave={editForm.save}
      />

      <Fab onClick={() => { setEditProblem(null); setEditDialogOpen(true); }} />
    </div>
  );
}
