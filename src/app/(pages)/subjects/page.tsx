"use client";

import { List } from "lucide-react";
import { ProjectMasterPage } from "@/components/shared/project-master-page";

export default function SubjectsPage() {
  return (
    <ProjectMasterPage
      makeConfig={(projectId) => ({
        title: "科目",
        endpoint: `/projects/${projectId}/subjects`,
        entityName: "科目",
        hasColor: true,
        icon: <List className="size-5" />,
      })}
    />
  );
}
