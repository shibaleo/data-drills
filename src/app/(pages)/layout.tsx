"use client";

import { AuthGate } from "@/components/auth/auth-gate";
import { ProjectProvider } from "@/hooks/use-project";
import { AppLayout } from "@/components/layout/app-layout";

export default function PagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <ProjectProvider>
        <AppLayout>{children}</AppLayout>
      </ProjectProvider>
    </AuthGate>
  );
}
