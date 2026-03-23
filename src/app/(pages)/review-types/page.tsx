"use client";

import { Tag } from "lucide-react";
import { ProjectMasterPage } from "@/components/shared/project-master-page";

export default function ReviewTypesPage() {
  return (
    <ProjectMasterPage
      makeConfig={(projectId) => ({
        title: "レビュー分類",
        endpoint: `/projects/${projectId}/review-types`,
        entityName: "レビュー分類",
        hasColor: true,
        icon: <Tag className="size-5" />,
      })}
    />
  );
}
