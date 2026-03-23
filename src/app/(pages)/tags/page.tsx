"use client";

import { Tags } from "lucide-react";
import { ProjectMasterPage } from "@/components/shared/project-master-page";

export default function TagsPage() {
  return (
    <ProjectMasterPage
      makeConfig={(projectId) => ({
        title: "タグ",
        endpoint: `/projects/${projectId}/tags`,
        entityName: "タグ",
        hasColor: true,
        icon: <Tags className="size-5" />,
      })}
    />
  );
}
