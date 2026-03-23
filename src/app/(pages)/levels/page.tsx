"use client";

import { Layers } from "lucide-react";
import { ProjectMasterPage } from "@/components/shared/project-master-page";

export default function LevelsPage() {
  return (
    <ProjectMasterPage
      makeConfig={(projectId) => ({
        title: "Levels",
        endpoint: `/projects/${projectId}/levels`,
        entityName: "Level",
        hasColor: true,
        icon: <Layers className="size-5" />,
      })}
    />
  );
}
