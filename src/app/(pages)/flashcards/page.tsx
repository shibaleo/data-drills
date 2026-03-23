"use client";

import { useState, useEffect, useCallback } from "react";
import { Bookmark, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { api, ApiError, fetchAllPages } from "@/lib/api-client";
import { useProject } from "@/hooks/use-project";
import { ProjectSelector } from "@/components/shared/project-selector";
import { ColorBadge } from "@/components/shared/color-badge";
import { randomCode } from "@/lib/utils";

interface Flashcard {
  id: string;
  code: string;
  project_id: string;
  topic_id: string | null;
  front: string;
  back: string;
  created_at: string;
}

interface MasterItem {
  id: string;
  code: string;
  name: string;
  color: string | null;
}

export default function FlashcardsPage() {
  const { currentProject } = useProject();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [topics, setTopics] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Flashcard | null>(null);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [topicId, setTopicId] = useState("__none__");
  const [saving, setSaving] = useState(false);

  // Study mode
  const [studyIndex, setStudyIndex] = useState<number | null>(null);
  const [showBack, setShowBack] = useState(false);

  const fetchData = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const [cs, ts] = await Promise.all([
        fetchAllPages<Flashcard>("/flashcards", { project_id: currentProject.id }),
        fetchAllPages<MasterItem>(`/projects/${currentProject.id}/topics`),
      ]);
      setCards(cs);
      setTopics(ts);
    } catch {
      toast.error("データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditItem(null);
    setFront("");
    setBack("");
    setTopicId("__none__");
    setDialogOpen(true);
  };

  const openEdit = (c: Flashcard) => {
    setEditItem(c);
    setFront(c.front);
    setBack(c.back);
    setTopicId(c.topic_id ?? "__none__");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!front.trim() || !back.trim()) {
      toast.error("表面と裏面は必須です");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        front: front.trim(),
        back: back.trim(),
        topic_id: topicId === "__none__" ? null : topicId,
      };
      if (editItem) {
        await api.put(`/flashcards/${editItem.id}`, payload);
        toast.success("フラッシュカードを更新しました");
      } else {
        payload.project_id = currentProject!.id;
        payload.code = randomCode();
        await api.post("/flashcards", payload);
        toast.success("フラッシュカードを作成しました");
      }
      setDialogOpen(false);
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editItem) return;
    try {
      await api.delete(`/flashcards/${editItem.id}`);
      toast.success("フラッシュカードを削除しました");
      setDialogOpen(false);
      fetchData();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.body.error : "削除に失敗しました");
    }
  };

  const startStudy = () => {
    if (cards.length === 0) return;
    setStudyIndex(0);
    setShowBack(false);
  };

  const recordReview = async (quality: number) => {
    if (studyIndex === null) return;
    const card = cards[studyIndex];
    try {
      await api.post(`/flashcards/${card.id}/reviews`, {
        quality,
        reviewed_at: new Date().toISOString(),
      });
    } catch { /* ignore */ }

    if (studyIndex < cards.length - 1) {
      setStudyIndex(studyIndex + 1);
      setShowBack(false);
    } else {
      setStudyIndex(null);
      toast.success("学習完了!");
    }
  };

  if (!currentProject) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-12 text-muted-foreground">プロジェクトを選択してください</div>
      </div>
    );
  }

  // Study mode UI
  if (studyIndex !== null && cards[studyIndex]) {
    const card = cards[studyIndex];
    return (
      <div className="p-4 md:p-6 flex flex-col items-center gap-6">
        <div className="text-sm text-muted-foreground">
          {studyIndex + 1} / {cards.length}
        </div>
        <div className="w-full max-w-lg border border-border rounded-lg p-6 min-h-[200px] flex flex-col justify-center">
          <div className="text-center text-lg mb-4">{card.front}</div>
          {showBack && (
            <div className="text-center text-muted-foreground border-t border-border pt-4 mt-4">
              {card.back}
            </div>
          )}
        </div>
        {!showBack ? (
          <Button onClick={() => setShowBack(true)}>答えを表示</Button>
        ) : (
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((q) => (
              <Button key={q} variant={q <= 2 ? "destructive" : q >= 4 ? "default" : "secondary"} onClick={() => recordReview(q)}>
                {q}
              </Button>
            ))}
          </div>
        )}
        <Button variant="outline" onClick={() => setStudyIndex(null)}>終了</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground"><Bookmark className="size-5" /></span>
          <h2 className="text-xl font-semibold">フラッシュカード</h2>
        </div>
        <div className="flex gap-2">
          <ProjectSelector />
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
          {cards.length > 0 && (
            <Button variant="secondary" size="sm" onClick={startStudy}>学習開始</Button>
          )}
          <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />新規作成</Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">読み込み中...</div>
      ) : cards.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">フラッシュカードがありません</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => {
            const top = topics.find((t) => t.id === c.topic_id);
            return (
              <div
                key={c.id}
                className="border border-border rounded-lg p-4 cursor-pointer transition-colors hover:bg-accent/20"
                onClick={() => openEdit(c)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
                  {top?.color && <ColorBadge color={top.color}>{top.name}</ColorBadge>}
                </div>
                <div className="text-sm font-medium line-clamp-2">{c.front}</div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{c.back}</div>
              </div>
            );
          })}
        </div>
      )}

      <Button className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg" size="icon" onClick={openCreate}>
        <Plus className="h-6 w-6" />
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? "フラッシュカードの編集" : "フラッシュカードの新規作成"}</DialogTitle>
            {editItem && <DialogDescription><span className="font-mono">{editItem.code}</span></DialogDescription>}
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>表面（質問）</Label>
              <Input value={front} onChange={(e) => setFront(e.target.value)} placeholder="質問を入力" />
            </div>
            <div className="space-y-2">
              <Label>裏面（答え）</Label>
              <Input value={back} onChange={(e) => setBack(e.target.value)} placeholder="答えを入力" />
            </div>
            <div className="space-y-2">
              <Label>トピック</Label>
              <Select value={topicId} onValueChange={setTopicId}>
                <SelectTrigger><SelectValue placeholder="なし" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">なし</SelectItem>
                  {topics.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            {editItem && (
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive mr-auto" onClick={handleDelete}>
                削除
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "保存中..." : editItem ? "更新" : "作成"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
