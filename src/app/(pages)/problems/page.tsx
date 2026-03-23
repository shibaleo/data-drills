"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

interface Problem {
  id: string;
  code: string;
  project_id: string;
  subject_id: string | null;
  level_id: string | null;
  topic_id: string | null;
  name: string | null;
  checkpoint: string | null;
  created_at: string;
}

interface MasterItem {
  id: string;
  code: string;
  name: string;
  color: string | null;
}

interface Answer {
  id: string;
  problem_id: string;
  date: string;
  duration: number | null;
  status: string;
}

const STATUS_OPTIONS = [
  { value: "Yet", label: "Yet" },
  { value: "Repeat", label: "Repeat" },
  { value: "Check", label: "Check" },
  { value: "Recall", label: "Recall" },
  { value: "Done", label: "Done" },
];

const STATUS_COLORS: Record<string, string> = {
  Yet: "#6B7280",
  Repeat: "#EF4444",
  Check: "#F97316",
  Recall: "#3B82F6",
  Done: "#22C55E",
};

export default function ProblemsPage() {
  const { currentProject } = useProject();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [subjects, setSubjects] = useState<MasterItem[]>([]);
  const [levels, setLevels] = useState<MasterItem[]>([]);
  const [topics, setTopics] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Problem | null>(null);
  const [name, setName] = useState("");
  const [checkpoint, setCheckpoint] = useState("");
  const [subjectId, setSubjectId] = useState("__none__");
  const [levelId, setLevelId] = useState("__none__");
  const [topicId, setTopicId] = useState("__none__");
  const [saving, setSaving] = useState(false);

  // Answer dialog
  const [answerDialogOpen, setAnswerDialogOpen] = useState(false);
  const [answerProblem, setAnswerProblem] = useState<Problem | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [answerStatus, setAnswerStatus] = useState("Yet");
  const [answerDuration, setAnswerDuration] = useState("");

  const fetchData = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const [probs, subs, lvls, tops] = await Promise.all([
        fetchAllPages<Problem>("/problems", { project_id: currentProject.id }),
        fetchAllPages<MasterItem>(`/projects/${currentProject.id}/subjects`),
        fetchAllPages<MasterItem>(`/projects/${currentProject.id}/levels`),
        fetchAllPages<MasterItem>(`/projects/${currentProject.id}/topics`),
      ]);
      setProblems(probs);
      setSubjects(subs);
      setLevels(lvls);
      setTopics(tops);
    } catch (e) {
      toast.error("データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditItem(null);
    setName("");
    setCheckpoint("");
    setSubjectId("__none__");
    setLevelId("__none__");
    setTopicId("__none__");
    setDialogOpen(true);
  };

  const openEdit = (p: Problem) => {
    setEditItem(p);
    setName(p.name ?? "");
    setCheckpoint(p.checkpoint ?? "");
    setSubjectId(p.subject_id ?? "__none__");
    setLevelId(p.level_id ?? "__none__");
    setTopicId(p.topic_id ?? "__none__");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim() || null,
        checkpoint: checkpoint.trim() || null,
        subject_id: subjectId === "__none__" ? null : subjectId,
        level_id: levelId === "__none__" ? null : levelId,
        topic_id: topicId === "__none__" ? null : topicId,
      };
      if (editItem) {
        await api.put(`/problems/${editItem.id}`, payload);
        toast.success("問題を更新しました");
      } else {
        payload.project_id = currentProject!.id;
        payload.code = randomCode();
        await api.post("/problems", payload);
        toast.success("問題を作成しました");
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
      await api.delete(`/problems/${editItem.id}`);
      toast.success("問題を削除しました");
      setDialogOpen(false);
      fetchData();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.body.error : "削除に失敗しました");
    }
  };

  const openAnswerDialog = async (p: Problem) => {
    setAnswerProblem(p);
    setAnswerStatus("Yet");
    setAnswerDuration("");
    try {
      const data = await fetchAllPages<Answer>("/answers", { problem_id: p.id });
      setAnswers(data);
    } catch {
      setAnswers([]);
    }
    setAnswerDialogOpen(true);
  };

  const handleAddAnswer = async () => {
    if (!answerProblem) return;
    try {
      await api.post("/answers", {
        problem_id: answerProblem.id,
        date: new Date().toISOString().slice(0, 10),
        status: answerStatus,
        duration: answerDuration ? Number(answerDuration) : null,
      });
      toast.success("解答を記録しました");
      const data = await fetchAllPages<Answer>("/answers", { problem_id: answerProblem.id });
      setAnswers(data);
    } catch (e) {
      toast.error("記録に失敗しました");
    }
  };

  const findMaster = (items: MasterItem[], id: string | null) => items.find((i) => i.id === id);

  if (!currentProject) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-12 text-muted-foreground">プロジェクトを選択してください</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground"><FileText className="size-5" /></span>
          <h2 className="text-xl font-semibold">問題</h2>
        </div>
        <div className="flex gap-2">
          <ProjectSelector />
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
          <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />新規作成</Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">読み込み中...</div>
      ) : problems.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">問題がありません</div>
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {problems.map((p) => {
                const sub = findMaster(subjects, p.subject_id);
                const lvl = findMaster(levels, p.level_id);
                const top = findMaster(topics, p.topic_id);
                return (
                  <tr
                    key={p.id}
                    className="border-b border-border/30 transition-colors cursor-pointer hover:bg-accent/20"
                    onClick={() => openEdit(p)}
                  >
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                        <span>{p.name || "(無題)"}</span>
                        <span className="ml-auto flex items-center gap-1.5">
                          {sub?.color && <ColorBadge color={sub.color}>{sub.name}</ColorBadge>}
                          {lvl?.color && <ColorBadge color={lvl.color}>{lvl.name}</ColorBadge>}
                          {top?.color && <ColorBadge color={top.color}>{top.name}</ColorBadge>}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-6"
                            onClick={(e) => { e.stopPropagation(); openAnswerDialog(p); }}
                          >
                            解答
                          </Button>
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Button className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg" size="icon" onClick={openCreate}>
        <Plus className="h-6 w-6" />
      </Button>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? editItem.name || editItem.code : "問題の新規作成"}</DialogTitle>
            {editItem && <DialogDescription><span className="font-mono">{editItem.code}</span></DialogDescription>}
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>問題名</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 問題1" />
            </div>
            <div className="space-y-2">
              <Label>チェックポイント</Label>
              <Input value={checkpoint} onChange={(e) => setCheckpoint(e.target.value)} placeholder="メモ" />
            </div>
            <div className="space-y-2">
              <Label>科目</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger><SelectValue placeholder="なし" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">なし</SelectItem>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>難易度</Label>
              <Select value={levelId} onValueChange={setLevelId}>
                <SelectTrigger><SelectValue placeholder="なし" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">なし</SelectItem>
                  {levels.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
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

      {/* Answer Dialog */}
      <Dialog open={answerDialogOpen} onOpenChange={setAnswerDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>解答記録: {answerProblem?.name || answerProblem?.code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Select value={answerStatus} onValueChange={setAnswerStatus}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={answerDuration}
                onChange={(e) => setAnswerDuration(e.target.value)}
                placeholder="所要時間(分)"
                className="w-32"
              />
              <Button onClick={handleAddAnswer}>記録</Button>
            </div>
            {answers.length > 0 && (
              <div className="border border-border rounded-md overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {answers.map((a) => (
                      <tr key={a.id} className="border-b border-border/30">
                        <td className="py-1.5 px-3 text-xs text-muted-foreground">{a.date}</td>
                        <td className="py-1.5 px-3">
                          <ColorBadge color={STATUS_COLORS[a.status] ?? "#6B7280"}>{a.status}</ColorBadge>
                        </td>
                        <td className="py-1.5 px-3 text-xs text-muted-foreground">{a.duration ? `${a.duration}分` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
