"use client";

import { BookOpen } from "lucide-react";
import { ProjectMasterPage } from "@/components/shared/project-master-page";

export default function TopicsPage() {
  return (
    <ProjectMasterPage
      makeConfig={(projectId) => ({
        title: "トピック",
        endpoint: `/projects/${projectId}/topics`,
        entityName: "トピック",
        hasColor: true,
        icon: <BookOpen className="size-5" />,
      })}
    />
  );
}
