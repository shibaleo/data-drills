"use client";

import { Tag } from "lucide-react";
import { MasterPage } from "@/components/shared/master-page";

export default function TagsPage() {
  return (
    <MasterPage
      config={{
        title: "Tags",
        endpoint: "/tags",
        entityName: "Tag",
        hasColor: true,
        icon: <Tag className="size-5" />,
      }}
    />
  );
}
