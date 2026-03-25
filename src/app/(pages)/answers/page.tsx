"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, fetchAllPages } from "@/lib/api-client";
import { useProject } from "@/hooks/use-project";
import { useAnswerForm, useEditAnswerForm } from "@/hooks/use-answer-form";
import { usePageTitle } from "@/lib/page-context";
import { ProblemDetailDialog } from "@/components/problem-detail-dialog";
import { ProblemEditDialog } from "@/components/problem-edit-dialog";
import { AnswerDialog } from "@/components/answer-dialog";
import { StatusTag } from "@/components/color-tags";
import type { ProblemWithAnswers } from "@/components/problem-card";
import type { Problem, Answer, AnswerStatus, Review, ProblemFile } from "@/lib/types";
import { toJSTDate } from "@/lib/date-utils";

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

function fmtDuration(seconds: number | null): string {
  if (seconds === null) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function AnswersPage() {
  usePageTitle("Answers");
  const { currentProject, statuses, subjects, levels, filterSubjectId, filterLevelId } = useProject();
  const [problemsWithAnswers, setProblemsWithAnswers] = useState<ProblemWithAnswers[]>([]);
  const [rawAnswers, setRawAnswers] = useState<DDAnswer[]>([]);
  const [rawProblems, setRawProblems] = useState<DDProblem[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailProblemId, setDetailProblemId] = useState<string | null>(null);
  const detailProblem = detailProblemId ? problemsWithAnswers.find(p => p.id === detailProblemId) ?? null : null;

  // Problem edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editProblem, setEditProblem] = useState<Problem | null>(null);

  const statusIdMap = useMemo(() => {
    const m = new Map<string, { name: string; color: string | null; point: number }>();
    for (const s of statuses) m.set(s.id, { name: s.name, color: s.color ?? null, point: s.point ?? 0 });
    return m;
  }, [statuses]);

  const statusNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of statuses) m.set(s.id, s.name);
    return m;
  }, [statuses]);

  const statusPointMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of statuses) m.set(s.id, s.point ?? 0);
    return m;
  }, [statuses]);

  const problemMap = useMemo(() => {
    const m = new Map<string, DDProblem>();
    for (const p of rawProblems) m.set(p.id, p);
    return m;
  }, [rawProblems]);

  const now = useMemo(() => new Date(), []);

  const fetchData = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const [ddProblems, ddAnswers, ddReviews, ddReviewTags, ddTags, ddFiles] = await Promise.all([
        fetchAllPages<DDProblem>("/problems", { project_id: currentProject.id }),
        fetchAllPages<DDAnswer>("/answers"),
        fetchAllPages<DDReview>("/reviews"),
        fetchAllPages<DDReviewTag>("/review-tags"),
        fetchAllPages<DDTag>("/tags"),
        fetchAllPages<DDProblemFile>("/problem-files"),
      ]);

      setRawProblems(ddProblems);

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
          status: (a.answerStatusId ? statusNameMap.get(a.answerStatusId) as AnswerStatus ?? null : null),
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

      setProblemsWithAnswers(combined);

      // Filter answers to current project
      const problemIds = new Set(ddProblems.map((p) => p.id));
      const filtered = ddAnswers
        .filter((a) => problemIds.has(a.problemId))
        .sort((a, b) => b.date.localeCompare(a.date));
      setRawAnswers(filtered);
    } catch {
      toast.error("Failed to fetch answers");
    } finally {
      setLoading(false);
    }
  }, [currentProject, statusNameMap, statusPointMap]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredAnswers = useMemo(() => rawAnswers.filter((a) => {
    const prob = problemMap.get(a.problemId);
    if (!prob) return true;
    if (filterSubjectId && prob.subjectId !== filterSubjectId) return false;
    if (filterLevelId && prob.levelId !== filterLevelId) return false;
    return true;
  }), [rawAnswers, problemMap, filterSubjectId, filterLevelId]);

  // Answer create/edit forms
  const answerForm = useAnswerForm(() => { fetchData(); });
  const editForm = useEditAnswerForm(() => { fetchData(); });

  const handleEditProblem = (p: Problem) => {
    setDetailOpen(false);
    setEditProblem(p);
    setEditDialogOpen(true);
  };

  const handleDeleteProblem = async (id: string) => {
    try {
      await api.delete(`/problems/${id}`);
      toast.success("削除しました");
      setDetailOpen(false);
      fetchData();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.body.error : "削除に失敗しました");
    }
  };

  const handleDeleteAnswer = async (id: string) => {
    try {
      await api.delete(`/answers/${id}`);
      toast.success("削除しました");
      fetchData();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.body.error : "削除に失敗しました");
    }
  };

  const handleRowClick = (a: DDAnswer) => {
    setDetailProblemId(a.problemId);
    setDetailOpen(true);
  };

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
      ) : filteredAnswers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No answers found</div>
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="py-2 px-3 font-medium">Date</th>
                <th className="py-2 px-3 font-medium">Duration</th>
                <th className="py-2 px-3 font-medium">Status</th>
                <th className="py-2 px-3 font-medium">Problem</th>
                <th className="py-2 px-3 font-medium">Subject</th>
                <th className="py-2 px-3 font-medium">Level</th>
                <th className="py-2 px-3 font-medium">Code</th>
                <th className="py-2 px-3 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredAnswers.map((a) => {
                const prob = problemMap.get(a.problemId);
                const statusEntry = a.answerStatusId ? statusIdMap.get(a.answerStatusId) : null;
                return (
                  <tr
                    key={a.id}
                    className="border-b border-border/30 transition-colors cursor-pointer hover:bg-accent/20"
                    onClick={() => handleRowClick(a)}
                  >
                    <td className="py-2 px-3 text-xs">{a.date ? toJSTDate(a.date) : ""}</td>
                    <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{fmtDuration(a.duration)}</td>
                    <td className="py-2 px-3">
                      {statusEntry && <StatusTag status={statusEntry.name as AnswerStatus} color={statusEntry.color} opaque />}
                    </td>
                    <td className="py-2 px-3">{prob?.name ?? ""}</td>
                    <td className="py-2 px-3 text-muted-foreground">{prob?.subjectId ? (() => { const s = subjects.find((x) => x.id === prob.subjectId); return s?.name ?? ""; })() : ""}</td>
                    <td className="py-2 px-3 text-muted-foreground">{prob?.levelId ? (() => { const l = levels.find((x) => x.id === prob.levelId); return l?.name ?? ""; })() : ""}</td>
                    <td className="py-2 px-3 font-mono text-xs">{prob?.code ?? ""}</td>
                    <td className="py-2 px-3">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteAnswer(a.id); }}
                        className="inline-flex size-6 items-center justify-center rounded text-muted-foreground/40 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
    </div>
  );
}
