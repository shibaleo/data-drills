"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api-client";
import { useProject } from "@/hooks/use-project";
import { usePageTitle } from "@/lib/page-context";
import {
  buildRetentionMeta,
  buildAverageRetentionSeries,
  type ProblemRetentionMeta,
} from "@/lib/retention-series";
import { BarChart3, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { AnswerStatus } from "@/lib/types";
import type { DDProblem, DDAnswer } from "@/lib/api-types";
import { useLookupMaps } from "@/hooks/use-lookup-maps";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function StatsPage() {
  usePageTitle("Stats");
  const router = useRouter();
  const { currentProject, filterSubjectId } = useProject();
  const { statusMap, statusPointMap } = useLookupMaps();
  const [metas, setMetas] = useState<ProblemRetentionMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const now = useMemo(() => new Date(), []);

  const fetchData = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const res = await api.get<{
        data: { problems: DDProblem[]; answers: DDAnswer[] };
      }>(`/problems-detail?project_id=${currentProject.id}`);
      const { problems, answers } = res.data;

      const answersByProblem = new Map<
        string,
        { date: string; status: AnswerStatus | null; point?: number }[]
      >();
      for (const a of answers) {
        const status = a.answerStatusId
          ? ((statusMap.get(a.answerStatusId) as AnswerStatus) ?? null)
          : null;
        const point = a.answerStatusId
          ? statusPointMap.get(a.answerStatusId)
          : undefined;
        const list = answersByProblem.get(a.problemId) ?? [];
        list.push({ date: a.date, status, point });
        answersByProblem.set(a.problemId, list);
      }

      const built: ProblemRetentionMeta[] = [];
      for (const p of problems) {
        const m = buildRetentionMeta(
          p.id, p.code, p.name ?? "", p.subjectId ?? "", p.levelId ?? "",
          answersByProblem.get(p.id) ?? [], now,
        );
        if (m) built.push(m);
      }

      setMetas(built);
    } catch {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [currentProject, statusMap, statusPointMap, now]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(
    () => metas.filter((m) => !filterSubjectId || m.subjectId === filterSubjectId),
    [metas, filterSubjectId],
  );

  const avgSeries = useMemo(
    () => buildAverageRetentionSeries(filtered, now),
    [filtered, now],
  );

  const avgChartConfig: ChartConfig = {
    retention: { label: "平均保持率", color: "hsl(var(--chart-1))" },
  };

  if (!currentProject) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-12 text-muted-foreground">Please select a project</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : avgSeries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No data</div>
      ) : (
        <Card
          className="cursor-pointer transition-colors hover:bg-card/90"
          onClick={() => router.push("/stats/retention")}
        >
          <CardHeader>
            <CardTitle className="text-sm font-medium">保持率推移</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={avgChartConfig} className="h-[200px] w-full">
              <AreaChart data={avgSeries} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatDate} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={32} tickFormatter={(v) => `${v}%`} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => [`${value}%`, "平均保持率"]} />} />
                <Area dataKey="retention" type="monotone" fill="hsl(var(--chart-1))" fillOpacity={0.2} stroke="hsl(var(--chart-1))" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
            <p className="text-xs text-muted-foreground mt-2">
              {filtered.length} 問題の平均 · クリックで詳細
            </p>
          </CardContent>
        </Card>
      )}

        {/* Score dashboard card */}
        {!loading && (
          <Card
            className="cursor-pointer transition-colors hover:bg-card/90"
            onClick={() => router.push("/stats/score")}
          >
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="size-4" />
                スコアダッシュボード
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                FSRS準拠のスコア計算・復習スケジュール · クリックで詳細
              </p>
            </CardContent>
          </Card>
        )}

        {/* Schedule card */}
        {!loading && (
          <Card
            className="cursor-pointer transition-colors hover:bg-card/90"
            onClick={() => router.push("/schedule")}
          >
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CalendarDays className="size-4" />
                復習スケジュール
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                次回復習日の一覧とタイムライン · クリックで詳細
              </p>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
