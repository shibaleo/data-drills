"use client";

import { List } from "lucide-react";
import { ProjectMasterPage } from "@/components/shared/project-master-page";

export default function SubjectsPage() {
  return (
    <ProjectMasterPage
      makeConfig={(projectId) => ({
        title: "Subjects",
        endpoint: `/projects/${projectId}/subjects`,
        entityName: "Subject",
        hasColor: true,
        icon: <List className="size-5" />,
      })}
    />
  );
}
