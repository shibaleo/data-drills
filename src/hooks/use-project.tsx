"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { fetchAllPages } from "@/lib/api-client";

interface Project {
  id: string;
  code: string;
  name: string;
}

interface LookupItem {
  id: string;
  name: string;
  color?: string | null;
}

interface ProjectContextValue {
  projects: Project[];
  currentProject: Project | null;
  setCurrentProject: (p: Project) => void;
  refresh: () => Promise<void>;
  subjects: LookupItem[];
  levels: LookupItem[];
  statuses: LookupItem[];
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}

/** Lookup helpers for level/subject by id (same API as LD) */
export function useLookup() {
  const ctx = useContext(ProjectContext);
  const subjects = ctx?.subjects ?? [];
  const levels = ctx?.levels ?? [];

  function levelName(id: string) { return levels.find((l) => l.id === id)?.name ?? ''; }
  function levelColor(id: string) { return levels.find((l) => l.id === id)?.color ?? ''; }
  function subjectName(id: string) { return subjects.find((s) => s.id === id)?.name ?? ''; }
  function subjectColor(id: string) { return subjects.find((s) => s.id === id)?.color ?? ''; }

  return { levelName, levelColor, subjectName, subjectColor };
}

const STORAGE_KEY = "dd_current_project";

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProjectState] = useState<Project | null>(null);
  const [subjects, setSubjects] = useState<LookupItem[]>([]);
  const [levels, setLevels] = useState<LookupItem[]>([]);
  const [statuses, setStatuses] = useState<LookupItem[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchAllPages<Project>("/projects");
      setProjects(data);
      if (data.length > 0 && !currentProject) {
        const savedId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        const saved = savedId ? data.find((p) => p.id === savedId) : null;
        setCurrentProjectState(saved ?? data[0]);
      }
    } catch {
      // ignore
    }
  }, [currentProject]);

  useEffect(() => { refresh(); }, [refresh]);

  // Fetch subjects, levels, statuses when project changes
  useEffect(() => {
    if (!currentProject) return;
    Promise.all([
      fetchAllPages<LookupItem>(`/projects/${currentProject.id}/subjects`),
      fetchAllPages<LookupItem>(`/projects/${currentProject.id}/levels`),
      fetchAllPages<LookupItem>("/statuses"),
    ]).then(([subs, lvls, stats]) => {
      setSubjects(subs);
      setLevels(lvls);
      setStatuses(stats);
    }).catch(() => { /* ignore */ });
  }, [currentProject]);

  const setCurrentProject = useCallback((p: Project) => {
    setCurrentProjectState(p);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, p.id);
    }
  }, []);

  return (
    <ProjectContext.Provider value={{ projects, currentProject, setCurrentProject, refresh, subjects, levels, statuses }}>
      {children}
    </ProjectContext.Provider>
  );
}
