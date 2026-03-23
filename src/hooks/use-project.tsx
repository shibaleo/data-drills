"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api, fetchAllPages } from "@/lib/api-client";

interface Project {
  id: string;
  code: string;
  name: string;
}

interface ProjectContextValue {
  projects: Project[];
  currentProject: Project | null;
  setCurrentProject: (p: Project) => void;
  refresh: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}

const STORAGE_KEY = "dd_current_project";

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProjectState] = useState<Project | null>(null);

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

  const setCurrentProject = useCallback((p: Project) => {
    setCurrentProjectState(p);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, p.id);
    }
  }, []);

  return (
    <ProjectContext.Provider value={{ projects, currentProject, setCurrentProject, refresh }}>
      {children}
    </ProjectContext.Provider>
  );
}
