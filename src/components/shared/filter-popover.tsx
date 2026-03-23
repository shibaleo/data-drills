"use client";

import { useState } from "react";
import { ListFilter } from "lucide-react";
import { useProject } from "@/hooks/use-project";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function FilterPopover() {
  const {
    projects, currentProject, setCurrentProject,
    subjects, levels,
    filterSubjectId, setFilterSubjectId,
    filterLevelId, setFilterLevelId,
  } = useProject();
  const isActive = !!currentProject;
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex size-8 items-center justify-center rounded-md transition-colors hover:bg-accent ${
          isActive ? "text-primary" : "text-muted-foreground/60"
        }`}
      >
        <ListFilter className="size-4" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Filter</DialogTitle>
            <DialogDescription className="sr-only">Filter by project, subject, level</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Project</Label>
              <Select
                value={currentProject?.id ?? ""}
                onValueChange={(id) => {
                  const p = projects.find((p) => p.id === id);
                  if (p) setCurrentProject(p);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {subjects.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Subject</Label>
                <Select
                  value={filterSubjectId ?? "__all__"}
                  onValueChange={(v) => setFilterSubjectId(v === "__all__" ? null : v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All</SelectItem>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {levels.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Level</Label>
                <Select
                  value={filterLevelId ?? "__all__"}
                  onValueChange={(v) => setFilterLevelId(v === "__all__" ? null : v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All</SelectItem>
                    {levels.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
