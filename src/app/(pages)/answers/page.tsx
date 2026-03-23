"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { PenLine, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, ApiError, fetchAllPages } from "@/lib/api-client";
import { useProject } from "@/hooks/use-project";
import { ProjectSelector } from "@/components/shared/project-selector";
import { StatusTag } from "@/components/color-tags";
import type { AnswerStatus } from "@/lib/types";

interface DDProblem {
  id: string;
  code: string;
  name: string | null;
}

interface DDAnswer {
  id: string;
  problemId: string;
  date: string;
  duration: number | null;
  answerStatusId: string | null;
  createdAt: string;
}

/** Convert integer seconds → "HH:MM:SS" display */
function fmtDuration(seconds: number | null): string {
  if (seconds === null) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function AnswersPage() {
  const { currentProject, statuses } = useProject();
  const [answers, setAnswers] = useState<DDAnswer[]>([]);
  const [problems, setProblems] = useState<DDProblem[]>([]);
  const [loading, setLoading] = useState(true);

  const statusMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of statuses) m.set(s.id, s.name);
    return m;
  }, [statuses]);

  const problemMap = useMemo(() => {
    const m = new Map<string, DDProblem>();
    for (const p of problems) m.set(p.id, p);
    return m;
  }, [problems]);

  const fetchData = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const [ddProblems, ddAnswers] = await Promise.all([
        fetchAllPages<DDProblem>("/problems", { project_id: currentProject.id }),
        fetchAllPages<DDAnswer>("/answers"),
      ]);
      setProblems(ddProblems);
      // Filter answers to only those belonging to current project's problems
      const problemIds = new Set(ddProblems.map((p) => p.id));
      const filtered = ddAnswers
        .filter((a) => problemIds.has(a.problemId))
        .sort((a, b) => b.date.localeCompare(a.date));
      setAnswers(filtered);
    } catch {
      toast.error("Failed to fetch answers");
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/answers/${id}`);
      toast.success("削除しました");
      fetchData();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.body.error : "削除に失敗しました");
    }
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
      ) : answers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No answers found</div>
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="py-2 px-3 font-medium">Date</th>
                <th className="py-2 px-3 font-medium">Problem</th>
                <th className="py-2 px-3 font-medium">Status</th>
                <th className="py-2 px-3 font-medium">Duration</th>
                <th className="py-2 px-3 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {answers.map((a) => {
                const prob = problemMap.get(a.problemId);
                const statusName = a.answerStatusId ? statusMap.get(a.answerStatusId) : null;
                return (
                  <tr key={a.id} className="border-b border-border/30 hover:bg-accent/20">
                    <td className="py-2 px-3 text-xs">{a.date ? new Date(a.date).toLocaleDateString("ja-JP") : ""}</td>
                    <td className="py-2 px-3">
                      <span className="font-mono text-xs">{prob?.code ?? ""}</span>
                      {prob?.name && <span className="ml-2 text-muted-foreground">{prob.name}</span>}
                    </td>
                    <td className="py-2 px-3">
                      {statusName && <StatusTag status={statusName as AnswerStatus} />}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{fmtDuration(a.duration)}</td>
                    <td className="py-2 px-3">
                      <button
                        type="button"
                        onClick={() => handleDelete(a.id)}
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
    </div>
  );
}
