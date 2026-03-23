"use client";

import { type ReactNode } from "react";
import { useProject } from "@/hooks/use-project";
import { ProjectSelector } from "./project-selector";
import { MasterPage, type MasterPageConfig } from "./master-page";

interface ProjectMasterPageProps {
  makeConfig: (projectId: string) => MasterPageConfig;
}

export function ProjectMasterPage({ makeConfig }: ProjectMasterPageProps) {
  const { currentProject } = useProject();

  if (!currentProject) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-12 text-muted-foreground">
          Please select a project
        </div>
      </div>
    );
  }

  const config = makeConfig(currentProject.id);

  return (
    <div>
      <div className="px-4 md:px-6 pt-4 md:pt-6">
        <ProjectSelector />
      </div>
      <MasterPage key={currentProject.id} config={config} />
    </div>
  );
}
