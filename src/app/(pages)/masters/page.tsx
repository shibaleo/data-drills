"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, RefreshCw, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { api, ApiError, fetchAllPages } from "@/lib/api-client";
import { useProject } from "@/hooks/use-project";
import { ProjectSelector } from "@/components/shared/project-selector";
import {
  MasterItemDialog,
  type MasterRow,
  type MasterPageConfig,
} from "@/components/shared/master-page";
import { ProblemEditDialog } from "@/components/problem-edit-dialog";

interface SectionDef {
  key: string;
  entityName: string;
  pluralName: string;
  path: string;
  hasColor: boolean;
  colSpan?: number;
  /** If true, uses top-level endpoint /path?project_id= instead of /projects/:id/path */
  topLevel?: boolean;
}

const SECTIONS: SectionDef[] = [
  { key: "subjects", entityName: "Subject", pluralName: "Subjects", path: "subjects", hasColor: true },
  { key: "levels", entityName: "Level", pluralName: "Levels", path: "levels", hasColor: true },
  { key: "problems", entityName: "Problem", pluralName: "Problems", path: "problems", hasColor: false, topLevel: true },
  { key: "topics", entityName: "Topic", pluralName: "Topics", path: "topics", hasColor: true },
  { key: "statuses", entityName: "Status", pluralName: "Statuses", path: "statuses", hasColor: false, topLevel: true },
  { key: "projects", entityName: "Project", pluralName: "Projects", path: "projects", hasColor: false, topLevel: true },
];

function MasterSection({
  def,
  projectId,
  items,
  onRefresh,
  lookups,
}: {
  def: SectionDef;
  projectId: string;
  items: MasterRow[];
  onRefresh: () => void;
  lookups?: { subjects: MasterRow[]; levels: MasterRow[] };
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogItem, setDialogItem] = useState<MasterRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MasterRow | null>(null);

  const endpoint = def.topLevel ? `/${def.path}` : `/projects/${projectId}/${def.path}`;

  const config: MasterPageConfig = {
    title: def.entityName,
    endpoint,
    entityName: def.entityName,
    hasColor: def.hasColor,
    extraCreatePayload: def.topLevel ? { project_id: projectId } : undefined,
  };

  const handleCreate = () => { setDialogItem(null); setDialogOpen(true); };
  const handleRowClick = (item: MasterRow) => { setDialogItem(item); setDialogOpen(true); };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`${endpoint}/${confirmDelete.id}`);
      toast.success(`${def.entityName} deleted`);
      setConfirmDelete(null);
      setDialogOpen(false);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.body.error : "Failed to delete");
    }
  };

  const handleSaved = () => {
    setDialogOpen(false);
    onRefresh();
  };

  const isProblem = def.key === "problems" && lookups;

  return (
    <div className="border border-border rounded-lg">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <h3 className="text-sm font-semibold">{def.pluralName}</h3>
        <Button variant="ghost" size="icon" className="size-7" onClick={handleCreate}>
          <Plus className="size-3.5" />
        </Button>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {items.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground text-center">Empty</div>
        ) : (
          items.map((item) => {
            if (isProblem) {
              const subj = lookups.subjects.find((s) => s.id === (item as Record<string, unknown>).subjectId);
              const lvl = lookups.levels.find((l) => l.id === (item as Record<string, unknown>).levelId);
              return (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-accent/20 text-left"
                  onClick={() => handleRowClick(item)}
                >
                  {subj && (
                    <span
                      className="inline-block shrink-0 rounded px-1 py-0.5 text-[10px] font-medium"
                      style={subj.color ? { backgroundColor: subj.color as string, color: "#fff" } : undefined}
                    >{subj.name}</span>
                  )}
                  {lvl && (
                    <span
                      className="inline-block shrink-0 rounded px-1 py-0.5 text-[10px] font-medium"
                      style={lvl.color ? { backgroundColor: lvl.color as string, color: "#fff" } : undefined}
                    >{lvl.name}</span>
                  )}
                  <span className="font-mono text-[10px] text-muted-foreground">{item.code}</span>
                  <span className="truncate">{item.name}</span>
                </button>
              );
            }
            return (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-accent/20 text-left"
                onClick={() => handleRowClick(item)}
              >
                {def.hasColor && item.color && (
                  <span
                    className="inline-block size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color as string }}
                  />
                )}
                <span className="font-mono text-[10px] text-muted-foreground">{item.code}</span>
                <span className="truncate">{item.name}</span>
              </button>
            );
          })
        )}
      </div>

      {isProblem ? (
        <ProblemEditDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          problem={dialogItem as unknown as { id: string; code: string; name: string | null; subjectId: string | null; levelId: string | null; checkpoint: string | null } | null}
          projectId={projectId}
          subjects={lookups.subjects}
          levels={lookups.levels}
          onSaved={handleSaved}
          onDelete={dialogItem ? () => setConfirmDelete(dialogItem) : undefined}
        />
      ) : (
        <MasterItemDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          item={dialogItem}
          config={config}
          onSaved={() => { handleSaved(); toast.success(dialogItem ? `${def.entityName} updated` : `${def.entityName} created`); }}
          onDeleted={() => dialogItem && setConfirmDelete(dialogItem)}
        />
      )}

      <Dialog open={confirmDelete !== null} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{confirmDelete?.name}&quot;?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={executeDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function MastersPage() {
  const { currentProject } = useProject();
  const [data, setData] = useState<Record<string, MasterRow[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const results = await Promise.all(
        SECTIONS.map(async (s) => {
          const endpoint = s.topLevel ? `/${s.path}` : `/projects/${currentProject.id}/${s.path}`;
          const params = s.topLevel ? { project_id: currentProject.id } : undefined;
          const items = await fetchAllPages<MasterRow>(endpoint, params);
          return [s.key, items] as const;
        }),
      );
      setData(Object.fromEntries(results));
    } catch {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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
          <span className="text-muted-foreground"><LayoutGrid className="size-5" /></span>
          <h2 className="text-xl font-semibold">Masters</h2>
        </div>
        <div className="flex gap-2">
          <ProjectSelector />
          <Button variant="outline" size="sm" onClick={fetchAll}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SECTIONS.map((s) => (
            <div key={s.key} className={s.colSpan === 2 ? "md:col-span-2" : undefined}>
              <MasterSection
                def={s}
                projectId={currentProject.id}
                items={data[s.key] ?? []}
                onRefresh={fetchAll}
                lookups={s.key === "problems" ? { subjects: data.subjects ?? [], levels: data.levels ?? [] } : undefined}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
