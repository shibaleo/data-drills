"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Pin,
  PinOff,
  Trash2,
  FileText,
  StickyNote,
  List,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError, fetchAllPages } from "@/lib/api-client";
import { useProject } from "@/hooks/use-project";
import { usePageTitle, usePageContext } from "@/lib/page-context";
import { MarkdownEditor } from "@/components/markdown-editor";
import { MasterList } from "@/components/shared/master-page";
import { Fab } from "@/components/shared/fab";
import { cn } from "@/lib/utils";

type NotesTab = "notes" | "masters";

/* ── Types ── */

interface NoteRow {
  id: string;
  projectId: string;
  topicId: string | null;
  title: string;
  content: string;
  pinned: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/* ── Page ── */

export default function NotesPage() {
  usePageTitle("Notes");
  const { currentProject } = useProject();

  const [tab, setTab] = useState<NotesTab>("notes");
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const contentRef = useRef("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollTop = useRef(0);
  const flushSaveRef = useRef<() => void>(() => {});
  const { setHeaderSlot, scrollingDown, setScrollingDown } = usePageContext();

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null;

  const fetchData = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const noteData = await fetchAllPages<NoteRow>("/notes", {
        project_id: currentProject.id,
      });
      setNotes(noteData);
    } catch {
      toast.error("Failed to fetch notes");
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Auto-save on note switch / unmount ── */

  const saveNote = useCallback(
    async (noteId: string, title: string, content: string) => {
      try {
        await api.put(`/notes/${noteId}`, {
          title: title.trim() || "Untitled",
          content,
        });
      } catch {
        /* silent */
      }
    },
    [],
  );

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (selectedId) {
      saveNote(selectedId, editTitle, contentRef.current);
    }
  }, [selectedId, editTitle, saveNote]);

  flushSaveRef.current = flushSave;

  // Inject tab buttons into the layout header
  useEffect(() => {
    setHeaderSlot(
      <div className="inline-flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
        {([
          { key: "notes" as const, label: "Notes", icon: StickyNote },
          { key: "masters" as const, label: "Masters", icon: List },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              if (key === tab) return;
              if (tab === "notes") flushSaveRef.current();
              setTab(key);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>,
    );
    return () => setHeaderSlot(null);
  }, [tab, setHeaderSlot]);

  function handleEditorScroll(e: React.UIEvent<HTMLDivElement>) {
    const st = e.currentTarget.scrollTop;
    setScrollingDown(st > lastScrollTop.current && st > 10);
    lastScrollTop.current = st;
  }

  // Save before switching notes
  function selectNote(id: string) {
    if (selectedId && selectedId !== id) {
      flushSave();
    }
    const note = notes.find((n) => n.id === id);
    if (note) {
      setSelectedId(id);
      setEditTitle(note.title);
      contentRef.current = note.content;
    }
  }

  // Debounced auto-save on content change
  function handleContentChange(markdown: string) {
    contentRef.current = markdown;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (selectedId) {
        saveNote(selectedId, editTitle, contentRef.current).then(() =>
          fetchData(),
        );
      }
    }, 2000);
  }

  // Save on title blur
  function handleTitleBlur() {
    if (selectedId) {
      saveNote(selectedId, editTitle, contentRef.current).then(() =>
        fetchData(),
      );
    }
  }

  /* ── Handlers ── */

  async function handleCreate() {
    if (!currentProject) return;
    try {
      const res = await api.post<{ data: NoteRow }>("/notes", {
        project_id: currentProject.id,
        title: "Untitled",
        content: "",
      });
      await fetchData();
      setSelectedId(res.data.id);
      setEditTitle(res.data.title);
      contentRef.current = res.data.content;
    } catch (e) {
      toast.error(e instanceof ApiError ? e.body?.error : "Failed to create");
    }
  }

  async function handleDelete(id: string) {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    try {
      await api.delete(`/notes/${id}`);
      toast.success("Deleted");
      if (selectedId === id) {
        setSelectedId(null);
      }
      fetchData();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.body?.error : "Failed to delete");
    }
  }

  async function togglePin(n: NoteRow) {
    try {
      await api.put(`/notes/${n.id}`, { pinned: !n.pinned });
      fetchData();
    } catch {
      /* ignore */
    }
  }

  if (!currentProject) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-12 text-muted-foreground">
          Please select a project
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Notes view */}
      <div className={cn("flex flex-col min-h-0", tab === "notes" ? "flex-1" : "hidden")}>
        {/* Title bar — shown when a note is selected */}
      {selectedNote && (
        <div className={cn(
          "flex items-center gap-2 border-b border-border shrink-0 transition-all duration-200 overflow-hidden",
          scrollingDown ? "max-h-0 py-0 border-transparent" : "max-h-20 p-3",
        )}>
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="Title"
            className="text-lg font-semibold flex-1"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => togglePin(selectedNote)}
            title={selectedNote.pinned ? "Unpin" : "Pin"}
          >
            {selectedNote.pinned ? (
              <PinOff className="size-3.5" />
            ) : (
              <Pin className="size-3.5" />
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => handleDelete(selectedNote.id)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Editor */}
      {!selectedNote ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <FileText className="size-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Select a note</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4" onScroll={handleEditorScroll}>
          <div className="mx-auto max-w-3xl">
            <MarkdownEditor
              key={selectedNote.id}
              defaultValue={selectedNote.content}
              onChange={handleContentChange}
            />
          </div>
        </div>
      )}
      </div>

      {/* Masters view */}
      <div className={cn("overflow-y-auto p-4 md:p-6", tab === "masters" ? "flex-1" : "hidden")}>
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Notes list */}
          <div className="border border-border rounded-lg">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
              <h3 className="text-sm font-semibold" style={{ color: 'hsl(var(--primary))' }}>Notes</h3>
            </div>
            {loading ? (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">Loading...</div>
            ) : notes.length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">No notes</div>
            ) : (
              notes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => { selectNote(n.id); setScrollingDown(false); setTab("notes"); }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm border-b border-border/30 transition-colors hover:bg-accent/20",
                    selectedId === n.id && "bg-sidebar-accent text-primary",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {n.pinned && <Pin className="size-3 text-primary shrink-0" />}
                    <span className="truncate font-medium">{n.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {n.content.slice(0, 60) || "(empty)"}
                  </p>
                </button>
              ))
            )}
          </div>
          {/* Topics + Tags */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MasterList
              key={`topics-${currentProject.id}`}
              config={{ title: "Topics", endpoint: `/projects/${currentProject.id}/topics`, entityName: "Topic", hasColor: true }}
            />
            <MasterList
              config={{ title: "Tags", endpoint: "/tags", entityName: "Tag", hasColor: true }}
            />
          </div>
        </div>
      </div>

      <Fab onClick={handleCreate} />
    </div>
  );
}
