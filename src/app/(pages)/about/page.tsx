"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { usePageTitle } from "@/lib/page-context";
import {
  STATUS_STABILITY,
} from "@/lib/fsrs";
import type { AnswerStatus } from "@/lib/types";

/* ── KaTeX helpers ── */

function Tex({ children, display }: { children: string; display?: boolean }) {
  const html = useMemo(
    () =>
      katex.renderToString(children, {
        throwOnError: false,
        displayMode: display ?? false,
      }),
    [children, display],
  );
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function TexBlock({ children }: { children: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-4 py-3 my-2 overflow-x-auto">
      <Tex display>{children}</Tex>
    </div>
  );
}

/* ── Inline editable value ── */

function V({
  value,
  onChange,
  suffix,
  fmt,
}: {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  fmt?: (v: number) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const n = parseFloat(draft);
    if (!isNaN(n)) onChange(n);
    setEditing(false);
  };

  const display = fmt ? fmt(value) : String(value);
  const shared =
    "inline-flex items-center justify-center tabular-nums font-medium text-sm leading-6 h-6";

  if (editing) {
    return (
      <input
        ref={ref}
        type="text"
        className={`${shared} px-0 text-center rounded border border-primary/50 bg-transparent text-primary focus:outline-none focus:ring-1 focus:ring-primary`}
        style={{ width: width ? Math.max(width, 28) : 40 }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      ref={spanRef}
      className={`${shared} cursor-pointer text-primary border-b border-dashed border-primary/40 hover:border-primary transition-colors`}
      onClick={() => {
        if (spanRef.current) setWidth(spanRef.current.offsetWidth + 8);
        setDraft(String(value));
        setEditing(true);
      }}
    >
      {display}
      {suffix}
    </span>
  );
}

/* ── Constants ── */

const STATUS_TEXT_COLORS: Record<AnswerStatus, string> = {
  Yet: "text-red-400",
  Repeat: "text-orange-400",
  Check: "text-yellow-400",
  Recall: "text-green-400",
  Done: "text-blue-400",
};

const STATUSES: AnswerStatus[] = ["Yet", "Repeat", "Check", "Recall", "Done"];
const STATUS_DESCRIPTIONS: Record<AnswerStatus, string> = {
  Yet: "解けなかった・全く思い出せない",
  Repeat: "正解できたがまだ繰り返しが必要",
  Check: "自力で解けたが少し不安が残る",
  Recall: "確実に再現できた・自信あり",
  Done: "完全に定着した・考えなくても解ける",
};

/* ── Page ── */

export default function AboutPage() {
  usePageTitle("About");

  // Score params
  const [timeCoeff, setTimeCoeff] = useState(0.5);
  const [ceExponent, setCeExponent] = useState(0.5);

  // Retention params
  const [baseStability, setBaseStability] = useState(1);
  const [growthFactor, setGrowthFactor] = useState(0.4);
  const [yetPenalty, setYetPenalty] = useState(0.5);

  // FSRS params
  const [fVal, setFVal] = useState(19 / 81);
  const [cVal, setCVal] = useState(-0.5);
  const [stability, setStability] = useState({ ...STATUS_STABILITY });

  const setStab = (s: AnswerStatus, v: number) =>
    setStability((p) => ({ ...p, [s]: v }));

  // Derived multipliers
  const multipliers: Record<AnswerStatus, string> = {
    Yet: `\\times ${yetPenalty}`,
    Repeat: "\\times 1.0",
    Check: `\\times ${(1 + (3 - 2) * growthFactor).toFixed(1)}`,
    Recall: `\\times ${(1 + (4 - 2) * growthFactor).toFixed(1)}`,
    Done: `\\times ${(1 + (5 - 2) * growthFactor).toFixed(1)}`,
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <article className="prose prose-sm prose-invert max-w-none space-y-6">
        {/* ── 評価の定義 ── */}
        <section>
          <h2 className="text-base font-semibold mb-2">評価（ステータス）</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            各問題の解答後に自己評価として付けるステータスです。
            「あと何日くらいこの結果を再現できそうか」を主観で判断します。
          </p>
          <table className="text-xs mt-2 w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="pr-4 py-1 text-left font-medium">評価</th>
                <th className="pr-4 py-1 text-left font-medium">自己判断の基準</th>
                <th className="py-1 text-left font-medium">復習間隔 <Tex>{"I_i"}</Tex></th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              {STATUSES.map((s) => (
                <tr key={s} className="border-b border-border/50 last:border-0">
                  <td className={`pr-4 py-1 ${STATUS_TEXT_COLORS[s]}`}>{s}</td>
                  <td className="pr-4 py-1">{STATUS_DESCRIPTIONS[s]}</td>
                  <td className="py-1">
                    <V
                      value={stability[s]}
                      onChange={(v) => setStab(s, v)}
                      suffix="日"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <hr className="border-border" />

        {/* ── Score ── */}
        <section>
          <h2 className="text-base font-semibold mb-2">Score（問題スコア）</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            問題スコアは<strong>評価点</strong> <Tex>{"P_i"}</Tex> を
            <strong>時間係数</strong> <Tex>{"C_T"}</Tex> で増減して計算されます。
          </p>
          <TexBlock>
            {"\\text{Score} = P_i \\times C_T"}
          </TexBlock>
          <div className="grid grid-cols-2 gap-4 mt-3">
            {/* P_i */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                <Tex>{"P_i"}</Tex> : 評価点（復習間隔から導出）
              </p>
              <TexBlock>
                {`P_i = \\left(\\frac{I_i}{I_{\\max}}\\right)^{\\gamma} \\times 100`}
              </TexBlock>
              <p className="text-xs text-muted-foreground -mt-1 mb-1">
                <Tex>{"I_i"}</Tex>: 各評価の復習間隔（<Tex>{"i"}</Tex> = Repeat, Check, Recall, Done）
              </p>
              <p className="text-sm text-foreground mt-1">
                <Tex>{"\\gamma"}</Tex> ={" "}
                <V value={ceExponent} onChange={setCeExponent} fmt={(v) => String(v)} />
              </p>
              <table className="text-xs w-full mt-1">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pr-3 py-1 text-left font-medium">評価</th>
                    <th className="pr-3 py-1 text-left font-medium">
                      <Tex>{"P_i"}</Tex>
                    </th>
                    <th className="py-1 text-left font-medium">
                      <Tex>{"I_i"}</Tex>
                    </th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  {STATUSES.map((s) => {
                    const sMax = Math.max(...Object.values(stability));
                    const pe = sMax > 0 ? Math.pow(stability[s] / sMax, ceExponent) * 100 : 0;
                    return (
                      <tr key={s} className="border-b border-border/50 last:border-0">
                        <td className={`pr-3 py-1 ${STATUS_TEXT_COLORS[s]}`}>{s}</td>
                        <td className="pr-3 py-1 tabular-nums font-medium">{Math.round(pe)}</td>
                        <td className="py-1 tabular-nums">{stability[s]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* C_T */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                <Tex>{"C_T"}</Tex> : 時間係数
              </p>
              <TexBlock>
                {`C_T = \\frac{c \\cdot t_{\\text{std}}}{t_{\\text{dur}}}`}
              </TexBlock>
              <p className="text-sm text-foreground mt-1">
                <Tex>{"c"}</Tex> ={" "}
                <V value={timeCoeff} onChange={setTimeCoeff} fmt={(v) => v.toFixed(1)} />
              </p>
              <p className="text-sm text-foreground mt-1">
                <Tex>{"c"}</Tex> は標準時間に対する回答時間の目標比率
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            <Tex>{"\\gamma"}</Tex> は復習間隔と直感的な点数が対応するように調整するべき指数（Stevens&apos; Power Law）。
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mt-2">
            <Tex>{"\\text{Score} \\geq 100"}</Tex> が基礎問題の完成基準です。
          </p>
        </section>

        <hr className="border-border" />

        {/* ── Retention ── */}
        <section>
          <h2 className="text-base font-semibold mb-2">
            保持率（Retention）
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            保持率は記憶の定着度を0〜100%で推定します。指数減衰モデルを使用し、初期安定性{" "}
            <Tex>{"S_0"}</Tex> ={" "}
            <V value={baseStability} onChange={setBaseStability} suffix="日" />
            {" "}です。
          </p>
          <TexBlock>{"R(t) = e^{\\,-t / S}"}</TexBlock>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <Tex>{"t"}</Tex> = 最終復習からの経過日数、
            <Tex>{"S"}</Tex> = 安定性。
            復習のたびに評価に応じて <Tex>{"S"}</Tex> が成長します。
            成長率 <Tex>{"\\alpha"}</Tex> ={" "}
            <V
              value={growthFactor}
              onChange={setGrowthFactor}
              fmt={(v) => v.toFixed(1)}
            />
          </p>
          <TexBlock>
            {`S' = S \\times \\bigl(1 + (q - 2) \\times ${growthFactor.toFixed(1)}\\bigr)`}
          </TexBlock>
          <table className="text-xs mt-2">
            <thead>
              <tr className="border-b border-border">
                <th className="pr-4 py-1 text-left font-medium">評価</th>
                <th className="pr-4 py-1 text-left font-medium">
                  <Tex>{"q"}</Tex>
                </th>
                <th className="py-1 text-left font-medium">
                  <Tex>{"S"}</Tex> 倍率
                </th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b border-border/50">
                <td className="pr-4 py-1 text-red-400">Yet</td>
                <td className="pr-4 py-1 tabular-nums">1</td>
                <td className="py-1">
                  <V
                    value={yetPenalty}
                    onChange={setYetPenalty}
                    fmt={(v) => `\u00d7${v}`}
                  />
                  <span className="text-muted-foreground ml-1">（後退）</span>
                </td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="pr-4 py-1 text-orange-400">Repeat</td>
                <td className="pr-4 py-1 tabular-nums">2</td>
                <td className="py-1">
                  <Tex>{"\\times 1.0"}</Tex>
                  <span className="text-muted-foreground ml-1">（維持）</span>
                </td>
              </tr>
              {(["Check", "Recall", "Done"] as const).map((s) => (
                <tr key={s} className="border-b border-border/50 last:border-0">
                  <td className={`pr-4 py-1 ${STATUS_TEXT_COLORS[s]}`}>{s}</td>
                  <td className="pr-4 py-1 tabular-nums">
                    {{ Check: 3, Recall: 4, Done: 5 }[s]}
                  </td>
                  <td className="py-1">
                    <Tex>{multipliers[s]}</Tex>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <hr className="border-border" />

        {/* ── 復習スケジュール ── */}
        <section>
          <h2 className="text-base font-semibold mb-2">
            復習スケジュール
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            最終解答日から復習間隔 <Tex>{"I_i"}</Tex> 日後が次の復習予定日です。
            Yet（<Tex>{"I = 0"}</Tex>）は即日復習が必要です。
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Overdue = 今日 - 復習予定日。正の値は期限超過（復習が必要）を意味します。
          </p>
          {/* FSRS 保持率モデル（補足） */}
          <details className="mt-3">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              FSRS 保持率モデル（詳細）
            </summary>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                復習予定日の背景にはFSRS準拠のべき乗関数による保持率推定があります。
              </p>
              <TexBlock>
                {`R(t, S) = \\left(1 + ${fVal.toFixed(4)} \\times \\frac{t}{S}\\right)^{${cVal.toFixed(1)}}`}
              </TexBlock>
              <p className="text-sm text-foreground -mt-1">
                <Tex>{"F"}</Tex> ={" "}
                <V value={fVal} onChange={setFVal} fmt={(v) => v.toFixed(4)} />
                {" "}<Tex>{"C"}</Tex> ={" "}
                <V value={cVal} onChange={setCVal} fmt={(v) => v.toFixed(1)} />
              </p>
            </div>
          </details>
        </section>

        <hr className="border-border" />

        {/* ── Sort ── */}
        <section>
          <h2 className="text-base font-semibold mb-2">
            並び替え（Overdue順）
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            スコアダッシュボードのデフォルト並び替えは
            <strong>Overdue降順</strong>
            （期限超過日数が大きい順）です。復習優先度は以下の通りです。
          </p>
          <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1 mt-2">
            <li>
              Recall / Check で期限切れ（<Tex>{"S"}</Tex>日数超過）— 忘却直前、最優先
            </li>
            <li>Repeat で{stability.Repeat}日以上経過 — 忘却リスク高</li>
            <li>Yet で複数回着手済み — 定着しかけている</li>
            <li>新規問題 — 時間が余った場合のみ</li>
          </ol>
          <p className="text-sm text-muted-foreground leading-relaxed mt-2">
            1日の配分目安: 復習75%、新規25%。新規投入を抑制し「広く浅く」を防ぎます。
          </p>
        </section>
      </article>
    </div>
  );
}
