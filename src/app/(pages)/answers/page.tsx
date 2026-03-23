"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { PenLine, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchAllPages } from "@/lib/api-client";
import { useProject } from "@/hooks/use-project";
import { ProjectSelector } from "@/components/shared/project-selector";
import { ProblemCard, type ProblemWithAnswers } from "@/components/problem-card";
import { ProblemEditDialog } from "@/components/problem-edit-dialog";
import type { Problem, Answer, AnswerStatus, Review, ProblemFile } from "@/lib/types";

// DD API response types (camelCase from Drizzle)
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
  duration: number | null; // seconds
  answerStatusId: string | null;
  createdAt: string;
}

interface DDReview {
  id: string;
  answerId: string;
  content: string | null;
  createdAt: string;
}

interface DDReviewTag {
  reviewId: string;
  tagId: string;
}

interface DDTag {
  id: string;
  name: string;
}

interface DDProblemFile {
  id: string;
  problemId: string;
  gdriveFileId: string;
  fileName: string | null;
  createdAt: string;
}

/** Convert integer seconds → "HH:MM:SS" string for LD compatibility */
function secondsToDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function AnswersPage() {
  const { currentProject, subjects, levels, statuses } = useProject();
  const [problems, setProblems] = useState<ProblemWithAnswers[]>([]);
  const [loading, setLoading] = useState(true);

  // Problem edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editProblem, setEditProblem] = useState<Problem | null>(null);

  // Build status ID → name map
  const statusMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of statuses) m.set(s.id, s.name);
    return m;
  }, [statuses]);

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

      // Build tag lookup
      const tagMap = new Map<string, string>();
      for (const t of ddTags) tagMap.set(t.id, t.name);

      // Build review → tags map
      const reviewTagsMap = new Map<string, string[]>();
      for (const rt of ddReviewTags) {
        const list = reviewTagsMap.get(rt.reviewId) ?? [];
        list.push(tagMap.get(rt.tagId) ?? "");
        reviewTagsMap.set(rt.reviewId, list);
      }

      // Convert DD reviews → LD reviews, grouped by answerId
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

      // Convert DD answers → LD answers, grouped by problemId
      const answersByProblem = new Map<string, (Answer & { reviews: Review[] })[]>();
      for (const a of ddAnswers) {
        const ldAnswer: Answer & { reviews: Review[] } = {
          id: a.id,
          date: a.date,
          duration: secondsToDuration(a.duration),
          status: (a.answerStatusId ? statusMap.get(a.answerStatusId) as AnswerStatus ?? null : null),
          problem_id: a.problemId,
          created_at: a.createdAt,
          updated_at: a.createdAt,
          reviews: reviewsByAnswer.get(a.id) ?? [],
        };
        const list = answersByProblem.get(a.problemId) ?? [];
        list.push(ldAnswer);
        answersByProblem.set(a.problemId, list);
      }

      // Convert DD problem files → LD format, grouped by problemId
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

      // Convert DD problems → LD problems with answers, sorted by most recent answer
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

      // Sort by most recent answer date (desc) — Answers page specific
      combined.sort((a, b) => {
        const aMax = a.answers.reduce((m, x) => (x.date && x.date > m ? x.date : m), "");
        const bMax = b.answers.reduce((m, x) => (x.date && x.date > m ? x.date : m), "");
        return bMax.localeCompare(aMax);
      });

      setProblems(combined);
    } catch {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [currentProject, statusMap]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleEditProblem = (p: Problem) => {
    setEditProblem(p);
    setEditDialogOpen(true);
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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground"><PenLine className="size-5" /></span>
          <h2 className="text-xl font-semibold">Answers</h2>
        </div>
        <div className="flex gap-2">
          <ProjectSelector />
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : problems.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">データがありません</div>
      ) : (
        <div className="space-y-4">
          {problems.map((p) => (
            <ProblemCard
              key={p.id}
              problem={p}
              now={now}
              onCheck={() => { /* TODO: answer dialog */ }}
              onEditProblem={handleEditProblem}
              onEditAnswer={() => { /* TODO: answer edit dialog */ }}
              onDelete={async (id) => {
                try {
                  await (await import("@/lib/api-client")).api.delete(`/answers/${id}`);
                  toast.success("削除しました");
                  fetchData();
                } catch { toast.error("削除に失敗しました"); }
              }}
              onPdfLinked={() => fetchData()}
            />
          ))}
        </div>
      )}

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
      />
    </div>
  );
}
