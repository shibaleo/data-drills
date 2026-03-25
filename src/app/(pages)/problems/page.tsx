"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, fetchAllPages } from "@/lib/api-client";
import { useProject } from "@/hooks/use-project";
import { useAnswerForm, useEditAnswerForm } from "@/hooks/use-answer-form";
import { usePageTitle } from "@/lib/page-context";
import { Fab } from "@/components/shared/fab";
import { ProblemDetailDialog } from "@/components/problem-detail-dialog";
import { ProblemEditDialog } from "@/components/problem-edit-dialog";
import { AnswerDialog } from "@/components/answer-dialog";
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

  const subjectMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of subjects) m.set(s.id, s.name);
    return m;
  }, [subjects]);

  const levelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of levels) m.set(l.id, l.name);
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
      // Fetch in 2 batches to avoid exhausting DB connections on Vercel
      const [ddProblems, ddAnswers, ddTags] = await Promise.all([
        fetchAllPages<DDProblem>("/problems", { project_id: currentProject.id }),
        fetchAllPages<DDAnswer>("/answers"),
        fetchAllPages<DDTag>("/tags"),
      ]);
      const [ddReviews, ddReviewTags, ddFiles] = await Promise.all([
        fetchAllPages<DDReview>("/reviews"),
        fetchAllPages<DDReviewTag>("/review-tags"),
        fetchAllPages<DDProblemFile>("/problem-files"),
      ]);

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

  const handleRowClick = (p: ProblemWithAnswers) => {
    setDetailProblemId(p.id);
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
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No problems found</div>
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="py-2 px-3 font-medium">Code</th>
                <th className="py-2 px-3 font-medium">Name</th>
                <th className="py-2 px-3 font-medium">Subject</th>
                <th className="py-2 px-3 font-medium">Level</th>
                <th className="py-2 px-3 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border/30 transition-colors cursor-pointer hover:bg-accent/20"
                  onClick={() => handleRowClick(p)}
                >
                  <td className="py-2 px-3 font-mono text-xs">{p.code}</td>
                  <td className="py-2 px-3">{p.name ?? ""}</td>
                  <td className="py-2 px-3 text-muted-foreground">{p.subject_id ? subjectMap.get(p.subject_id) ?? "" : ""}</td>
                  <td className="py-2 px-3 text-muted-foreground">{p.level_id ? levelMap.get(p.level_id) ?? "" : ""}</td>
                  <td className="py-2 px-3">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteProblem(p.id); }}
                      className="inline-flex size-6 items-center justify-center rounded text-muted-foreground/40 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
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

      <Fab onClick={() => { setEditProblem(null); setEditDialogOpen(true); }} />
    </div>
  );
}
