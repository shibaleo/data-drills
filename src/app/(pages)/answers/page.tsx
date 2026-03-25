"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, fetchAllPages } from "@/lib/api-client";
import { useProject } from "@/hooks/use-project";
import { usePageTitle } from "@/lib/page-context";
import { StatusTag } from "@/components/color-tags";
import { Badge } from "@/components/ui/badge";
import type { AnswerStatus } from "@/lib/types";

interface DDProblem {
  id: string;
  code: string;
  name: string | null;
  subjectId: string | null;
  levelId: string | null;
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
  usePageTitle("Answers");
  const { currentProject, statuses, subjects, levels, filterSubjectId, filterLevelId } = useProject();
  const [answers, setAnswers] = useState<DDAnswer[]>([]);
  const [problems, setProblems] = useState<DDProblem[]>([]);
  const [loading, setLoading] = useState(true);

  const statusMap = useMemo(() => {
    const m = new Map<string, { name: string; color: string | null }>();
    for (const s of statuses) m.set(s.id, { name: s.name, color: s.color ?? null });
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

  const filteredAnswers = useMemo(() => answers.filter((a) => {
    const prob = problemMap.get(a.problemId);
    if (!prob) return true;
    if (filterSubjectId && prob.subjectId !== filterSubjectId) return false;
    if (filterLevelId && prob.levelId !== filterLevelId) return false;
    return true;
  }), [answers, problemMap, filterSubjectId, filterLevelId]);

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
                <th className="py-2 px-3 font-medium">Problem</th>
                <th className="py-2 px-3 font-medium">Status</th>
                <th className="py-2 px-3 font-medium">Duration</th>
                <th className="py-2 px-3 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredAnswers.map((a) => {
                const prob = problemMap.get(a.problemId);
                const statusEntry = a.answerStatusId ? statusMap.get(a.answerStatusId) : null;
                return (
                  <tr key={a.id} className="border-b border-border/30 hover:bg-accent/20">
                    <td className="py-2 px-3 text-xs">{a.date ? new Date(a.date).toLocaleDateString("ja-JP") : ""}</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{prob?.code ?? ""}</span>
                        {prob?.name && <span className="text-muted-foreground">{prob.name}</span>}
                        <div className="ml-auto flex items-center gap-1 shrink-0">
                          {prob?.subjectId && (() => { const s = subjects.find((x) => x.id === prob.subjectId); return s ? <Badge variant="secondary" className="text-[10px] text-foreground/70">{s.name}</Badge> : null; })()}
                          {prob?.levelId && (() => { const l = levels.find((x) => x.id === prob.levelId); return l ? <Badge variant="secondary" className="text-[10px] text-foreground/70">{l.name}</Badge> : null; })()}
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      {statusEntry && <StatusTag status={statusEntry.name as AnswerStatus} color={statusEntry.color} opaque />}
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
