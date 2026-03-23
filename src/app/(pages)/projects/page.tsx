"use client";

import { FolderKanban } from "lucide-react";
import { MasterPage } from "@/components/shared/master-page";

export default function ProjectsPage() {
  return (
    <MasterPage
      config={{
        title: "Projects",
        endpoint: "/projects",
        entityName: "Project",
        icon: <FolderKanban className="size-5" />,
      }}
    />
  );
}
