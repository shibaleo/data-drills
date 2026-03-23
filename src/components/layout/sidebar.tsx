"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_NAME } from "@/lib/site";
import {
  FolderKanban,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  Key,
  Bookmark,
  Shield,
  Tag,
  CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "./user-menu";

const EXPANDED_WIDTH = 224;
const COLLAPSED_WIDTH = 56;

interface NavItem {
  href: string;
  label: string;
  icon: typeof PenLine;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: "Transaction",
    items: [
      { href: "/answers", label: "Answers", icon: PenLine },
      { href: "/flashcards", label: "Flashcards", icon: Bookmark },
    ],
  },
  {
    label: "Master",
    items: [
      { href: "/masters", label: "Masters", icon: LayoutGrid },
      { href: "/tags", label: "Tags", icon: Tag },
      { href: "/statuses", label: "Statuses", icon: CircleDot },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/users", label: "Users", icon: Shield },
      { href: "/api-keys", label: "API Keys", icon: Key },
    ],
  },
];

export function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
        {navSections.map((section, idx) => (
          <div key={section.label}>
            {idx > 0 && <div className="my-2 border-t border-sidebar-border/50" />}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center rounded-md pl-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-primary"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    <span
                      className={cn(
                        "whitespace-nowrap transition-opacity duration-200",
                        collapsed
                          ? "opacity-0 w-0 overflow-hidden"
                          : "opacity-100 ml-3",
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <UserMenu collapsed={collapsed} />
    </>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <aside
      className="hidden md:flex h-screen flex-col border-r border-sidebar-border bg-sidebar overflow-hidden transition-all duration-300"
      style={{ width: sidebarWidth }}
    >
      <div className="flex h-14 items-center border-b border-sidebar-border px-3 gap-2">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex shrink-0 size-8 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </button>
        <span
          className={cn(
            "truncate text-lg font-semibold text-primary whitespace-nowrap transition-opacity duration-200",
            collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100",
          )}
        >
          {SITE_NAME}
        </span>
      </div>

      <SidebarNav collapsed={collapsed} />
    </aside>
  );
}
