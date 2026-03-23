"use client";

import { FolderKanban } from "lucide-react";
import { MasterPage } from "@/components/shared/master-page";

export default function ProjectsPage() {
  return (
    <MasterPage
      config={{
        title: "プロジェクト",
        endpoint: "/projects",
        entityName: "プロジェクト",
        icon: <FolderKanban className="size-5" />,
      }}
    />
  );
}
