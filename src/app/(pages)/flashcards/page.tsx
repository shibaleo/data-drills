"use client";

import { useState, useEffect, useCallback } from "react";
import { Bookmark, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { randomCode } from "@/lib/utils";
import {
  FlashcardCard,
  type FlashcardWithReviews,
  type FlashcardRow,
  type FlashcardReviewRow,
} from "@/components/flashcard-card";

interface TopicItem {
  id: string;
  name: string;
  color?: string | null;
}

export default function FlashcardsPage() {
  const { currentProject } = useProject();
  const [flashcardsWithReviews, setFlashcardsWithReviews] = useState<FlashcardWithReviews[]>([]);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<FlashcardRow | null>(null);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [topicId, setTopicId] = useState("__none__");
  const [saving, setSaving] = useState(false);

  // Study mode
  const [studyMode, setStudyMode] = useState(false);
  const [studyIndex, setStudyIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);

  const fetchData = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const [cards, reviews, tops] = await Promise.all([
        fetchAllPages<FlashcardRow>("/flashcards", { project_id: currentProject.id }),
        fetchAllPages<FlashcardReviewRow>("/flashcard-reviews"),
        fetchAllPages<TopicItem>(`/projects/${currentProject.id}/topics`),
      ]);

      // Group reviews by flashcardId
      const reviewMap = new Map<string, FlashcardReviewRow[]>();
      for (const r of reviews) {
        const list = reviewMap.get(r.flashcardId) ?? [];
        list.push(r);
        reviewMap.set(r.flashcardId, list);
      }

      const combined: FlashcardWithReviews[] = cards.map((fc) => ({
        ...fc,
        reviews: reviewMap.get(fc.id) ?? [],
      }));

      // Sort by most recent review date (desc), cards with no reviews last
      combined.sort((a, b) => {
        const aMax = a.reviews.reduce((m, x) => (x.reviewedAt > m ? x.reviewedAt : m), "");
        const bMax = b.reviews.reduce((m, x) => (x.reviewedAt > m ? x.reviewedAt : m), "");
        if (!aMax && !bMax) return 0;
        if (!aMax) return 1;
        if (!bMax) return -1;
        return bMax.localeCompare(aMax);
      });

      setFlashcardsWithReviews(combined);
      setTopics(tops);
    } catch {
      toast.error("Failed to fetch data");
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

  const openEdit = (fc: FlashcardRow) => {
    setEditItem(fc);
    setFront(fc.front);
    setBack(fc.back);
    setTopicId(fc.topicId ?? "__none__");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!front.trim() || !back.trim()) {
      toast.error("Front and back are required");
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
        toast.success("更新しました");
      } else {
        payload.project_id = currentProject!.id;
        payload.code = randomCode();
        await api.post("/flashcards", payload);
        toast.success("作成しました");
      }
      setDialogOpen(false);
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editItem) return;
    try {
      await api.delete(`/flashcards/${editItem.id}`);
      toast.success("削除しました");
      setDialogOpen(false);
      fetchData();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.body.error : "削除に失敗しました");
    }
  };

  const handleAddReview = (fc: FlashcardWithReviews) => {
    const idx = flashcardsWithReviews.findIndex((f) => f.id === fc.id);
    if (idx >= 0) {
      setStudyIndex(idx);
      setShowBack(false);
      setStudyMode(true);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    try {
      await api.delete(`/flashcard-reviews/${reviewId}`);
      toast.success("削除しました");
      fetchData();
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  const recordReview = async (quality: number) => {
    const card = flashcardsWithReviews[studyIndex];
    if (!card) return;
    try {
      await api.post(`/flashcards/${card.id}/reviews`, {
        quality,
        reviewed_at: new Date().toISOString(),
      });
    } catch { /* ignore */ }

    if (studyIndex < flashcardsWithReviews.length - 1) {
      setStudyIndex(studyIndex + 1);
      setShowBack(false);
    } else {
      setStudyMode(false);
      toast.success("Study complete!");
      fetchData();
    }
  };

  const startStudy = () => {
    if (flashcardsWithReviews.length === 0) return;
    setStudyIndex(0);
    setShowBack(false);
    setStudyMode(true);
  };

  if (!currentProject) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-12 text-muted-foreground">Please select a project</div>
      </div>
    );
  }

  // Study mode UI
  if (studyMode && flashcardsWithReviews[studyIndex]) {
    const card = flashcardsWithReviews[studyIndex];
    return (
      <div className="p-4 md:p-6 flex flex-col items-center gap-6">
        <div className="text-sm text-muted-foreground">
          {studyIndex + 1} / {flashcardsWithReviews.length}
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
          <Button onClick={() => setShowBack(true)}>Show Answer</Button>
        ) : (
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((q) => (
              <Button key={q} variant={q <= 2 ? "destructive" : q >= 4 ? "default" : "secondary"} onClick={() => recordReview(q)}>
                {q}
              </Button>
            ))}
          </div>
        )}
        <Button variant="outline" onClick={() => { setStudyMode(false); fetchData(); }}>Exit</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground"><Bookmark className="size-5" /></span>
          <h2 className="text-xl font-semibold">Flashcards</h2>
        </div>
        <div className="flex gap-2">
          <ProjectSelector />
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
          {flashcardsWithReviews.length > 0 && (
            <Button variant="secondary" size="sm" onClick={startStudy}>Study</Button>
          )}
          <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />New</Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : flashcardsWithReviews.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No flashcards found</div>
      ) : (
        <div className="space-y-4">
          {flashcardsWithReviews.map((fc) => (
            <FlashcardCard
              key={fc.id}
              flashcard={fc}
              topics={topics}
              onEdit={openEdit}
              onAddReview={handleAddReview}
              onDeleteReview={handleDeleteReview}
            />
          ))}
        </div>
      )}

      <Button className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg" size="icon" onClick={openCreate}>
        <Plus className="h-6 w-6" />
      </Button>

      {/* Edit / Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? "Flashcardを編集" : "新規Flashcard"}</DialogTitle>
            <DialogDescription className="sr-only">{editItem ? "Edit flashcard" : "Create a new flashcard"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Front (Question)</Label>
              <Textarea value={front} onChange={(e) => setFront(e.target.value)} placeholder="Enter question" rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Back (Answer)</Label>
              <Textarea value={back} onChange={(e) => setBack(e.target.value)} placeholder="Enter answer" rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Topic</Label>
              <Select value={topicId} onValueChange={setTopicId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
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
