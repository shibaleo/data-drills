"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, fetchAllPages } from "@/lib/api-client";
import { useProject } from "@/hooks/use-project";
import { usePageTitle } from "@/lib/page-context";
import { Fab } from "@/components/shared/fab";
import { ProblemEditDialog } from "@/components/problem-edit-dialog";

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

export default function ProblemsPage() {
  usePageTitle("Problems");
  const { currentProject, subjects, levels, filterSubjectId, filterLevelId } = useProject();
  const [problems, setProblems] = useState<DDProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editProblem, setEditProblem] = useState<DDProblem | null>(null);

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

  const fetchData = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const data = await fetchAllPages<DDProblem>("/problems", { project_id: currentProject.id });
      setProblems(data);
    } catch {
      toast.error("Failed to fetch problems");
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => problems.filter((p) => {
    if (filterSubjectId && p.subjectId !== filterSubjectId) return false;
    if (filterLevelId && p.levelId !== filterLevelId) return false;
    return true;
  }), [problems, filterSubjectId, filterLevelId]);

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/problems/${id}`);
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
                  onClick={() => { setEditProblem(p); setEditDialogOpen(true); }}
                >
                  <td className="py-2 px-3 font-mono text-xs">{p.code}</td>
                  <td className="py-2 px-3">{p.name ?? ""}</td>
                  <td className="py-2 px-3 text-muted-foreground">{p.subjectId ? subjectMap.get(p.subjectId) ?? "" : ""}</td>
                  <td className="py-2 px-3 text-muted-foreground">{p.levelId ? levelMap.get(p.levelId) ?? "" : ""}</td>
                  <td className="py-2 px-3">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
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

      <ProblemEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        problem={editProblem ? {
          id: editProblem.id,
          code: editProblem.code,
          name: editProblem.name,
          subjectId: editProblem.subjectId,
          levelId: editProblem.levelId,
          checkpoint: editProblem.checkpoint,
        } : null}
        projectId={currentProject.id}
        subjects={subjects}
        levels={levels}
        onSaved={() => { setEditDialogOpen(false); fetchData(); }}
        onDelete={editProblem ? () => handleDelete(editProblem.id) : undefined}
      />

      <Fab onClick={() => { setEditProblem(null); setEditDialogOpen(true); }} />
    </div>
  );
}
