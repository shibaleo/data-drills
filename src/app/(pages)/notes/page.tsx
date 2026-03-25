"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Pin,
  PinOff,
  Plus,
  Trash2,
  FileText,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError, fetchAllPages } from "@/lib/api-client";
import { useProject } from "@/hooks/use-project";
import { usePageTitle } from "@/lib/page-context";
import { MarkdownEditor } from "@/components/markdown-editor";
import { cn } from "@/lib/utils";

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

  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const contentRef = useRef("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          title: title.trim() || "無題",
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
        title: "新しいノート",
        content: "",
      });
      await fetchData();
      setSelectedId(res.data.id);
      setEditTitle(res.data.title);
      contentRef.current = res.data.content;
    } catch (e) {
      toast.error(e instanceof ApiError ? e.body?.error : "作成に失敗");
    }
  }

  async function handleDelete(id: string) {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    try {
      await api.delete(`/notes/${id}`);
      toast.success("削除しました");
      if (selectedId === id) {
        setSelectedId(null);
      }
      fetchData();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.body?.error : "削除に失敗");
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
      {/* Title bar — shown when a note is selected */}
      {selectedNote && (
        <div className="flex items-center gap-2 p-3 border-b border-border shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="md:hidden size-8"
            onClick={() => {
              flushSave();
              setSelectedId(null);
            }}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="タイトル"
            className="text-lg font-semibold flex-1"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => togglePin(selectedNote)}
            title={selectedNote.pinned ? "ピン解除" : "ピン留め"}
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

      {/* Two-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel: note list */}
        <div
          className={cn(
            "w-full md:w-64 shrink-0 border-r border-border flex flex-col",
            selectedId ? "hidden md:flex" : "flex",
          )}
        >
          <div className="p-2 border-b border-border">
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1"
              onClick={handleCreate}
            >
              <Plus className="size-3.5" /> 新規ノート
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                読み込み中...
              </p>
            ) : notes.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                ノートがありません
              </p>
            ) : (
              notes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => selectNote(n.id)}
                  className={cn(
                    "w-full text-left rounded-md px-2.5 py-2 text-sm transition-colors",
                    selectedId === n.id
                      ? "bg-sidebar-accent text-primary"
                      : "text-foreground/70 hover:bg-sidebar-accent/50",
                  )}
                >
                  <div className="flex items-center gap-1">
                    {n.pinned && (
                      <Pin className="size-3 text-primary shrink-0" />
                    )}
                    <span className="truncate font-medium">{n.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {n.content.slice(0, 60) || "（空）"}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right panel: editor */}
        <div
          className={cn(
            "flex-1 flex flex-col min-h-0",
            !selectedId ? "hidden md:flex" : "flex",
          )}
        >
          {!selectedNote ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileText className="size-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">ノートを選択してください</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4">
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
      </div>
    </div>
  );
}
