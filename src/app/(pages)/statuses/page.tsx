"use client";

import { CircleDot } from "lucide-react";
import { MasterPage } from "@/components/shared/master-page";

export default function StatusesPage() {
  return (
    <MasterPage
      config={{
        title: "Statuses",
        endpoint: "/statuses",
        entityName: "Status",
        hasColor: true,
        icon: <CircleDot className="size-5" />,
      }}
    />
  );
}
