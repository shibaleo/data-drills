"use client";

import { Layers } from "lucide-react";
import { ProjectMasterPage } from "@/components/shared/project-master-page";

export default function LevelsPage() {
  return (
    <ProjectMasterPage
      makeConfig={(projectId) => ({
        title: "難易度",
        endpoint: `/projects/${projectId}/levels`,
        entityName: "難易度",
        hasColor: true,
        icon: <Layers className="size-5" />,
      })}
    />
  );
}
