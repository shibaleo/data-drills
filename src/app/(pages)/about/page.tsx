"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { usePageTitle } from "@/lib/page-context";
import { useProject } from "@/hooks/use-project";

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


/* ── Page ── */

export default function AboutPage() {
  usePageTitle("About");
  const { statuses } = useProject();

  // Score params
  const [timeCoeff, setTimeCoeff] = useState(0.5);
  const [ceExponent, setCeExponent] = useState(0.5);

  // Retention params
  const [baseStability, setBaseStability] = useState(1);
  const [growthFactor, setGrowthFactor] = useState(0.4);
  const [missPenalty, setMissPenalty] = useState(0.5);

  // FSRS params
  const [fVal, setFVal] = useState(19 / 81);
  const [cVal, setCVal] = useState(-0.5);

  // Editable stability per status (initialised from DB)
  const [stabilityOverrides, setStabilityOverrides] = useState<Map<string, number>>(new Map());
  const getStab = (name: string, dbDays: number) => stabilityOverrides.get(name) ?? dbDays;
  const setStab = (name: string, v: number) =>
    setStabilityOverrides((p) => new Map(p).set(name, v));

  // Derived: max stability for P_i computation
  const maxStab = useMemo(
    () => Math.max(...statuses.map((s) => getStab(s.name, s.stabilityDays)), 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statuses, stabilityOverrides],
  );

  // First status (lowest sortOrder) for "incorrect" description
  const firstStatus = statuses[0];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <article className="prose prose-sm prose-invert max-w-none space-y-6">
        {/* ── 評価の定義 ── */}
        <section>
          <h2 className="text-base font-semibold mb-2">ステータス（評価）</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            ステータスは各問題の解答後に自己評価される、問題ごとの状態です。<br />
            {firstStatus && (
              <>不正解の場合はすべて <span style={{ color: firstStatus.color ?? "#888" }}>{firstStatus.name}</span> と評価されます。<br /></>
            )}
            正解の場合は「あと何日くらいこの結果を再現できそうか」を主観で評価します。
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
              {statuses.map((s) => (
                <tr key={s.name} className="border-b border-border/50 last:border-0">
                  <td className="pr-4 py-1" style={{ color: s.color ?? "#888" }}>{s.name}</td>
                  <td className="pr-4 py-1">{s.description ?? ""}</td>
                  <td className="py-1">
                    <V
                      value={getStab(s.name, s.stabilityDays)}
                      onChange={(v) => setStab(s.name, v)}
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
                <Tex>{"I_i"}</Tex>: 各評価の復習間隔（<Tex>{"i"}</Tex> = {statuses.map((s) => s.name).join(", ")})
              </p>
              <p className="text-sm text-foreground mt-1">
                <Tex>{"\\gamma"}</Tex> ={" "}
                <V value={ceExponent} onChange={setCeExponent} fmt={(v) => String(v)} />
                <span className="text-xs text-muted-foreground ml-2">
                  Stevens&apos; Power Law — 復習間隔と直感的な点数を対応させる指数
                </span>
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
                  {statuses.map((s) => {
                    const stab = getStab(s.name, s.stabilityDays);
                    const pe = maxStab > 0 ? Math.pow(stab / maxStab, ceExponent) * 100 : 0;
                    return (
                      <tr key={s.name} className="border-b border-border/50 last:border-0">
                        <td className="pr-3 py-1" style={{ color: s.color ?? "#888" }}>{s.name}</td>
                        <td className="pr-3 py-1 tabular-nums font-medium">{Math.round(pe)}</td>
                        <td className="py-1 tabular-nums">{stab}</td>
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
          <p className="text-sm text-muted-foreground leading-relaxed mt-3">
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
              {statuses.map((s) => {
                const q = s.sortOrder + 1;
                const mult = q < 2
                  ? `\\times ${missPenalty}`
                  : q === 2
                    ? "\\times 1.0"
                    : `\\times ${(1 + (q - 2) * growthFactor).toFixed(1)}`;
                const note = q < 2 ? "（後退）" : q === 2 ? "（維持）" : null;
                return (
                  <tr key={s.name} className="border-b border-border/50 last:border-0">
                    <td className="pr-4 py-1" style={{ color: s.color ?? "#888" }}>{s.name}</td>
                    <td className="pr-4 py-1 tabular-nums">{q}</td>
                    <td className="py-1">
                      {q < 2 ? (
                        <>
                          <V
                            value={missPenalty}
                            onChange={setMissPenalty}
                            fmt={(v) => `\u00d7${v}`}
                          />
                          <span className="text-muted-foreground ml-1">{note}</span>
                        </>
                      ) : (
                        <>
                          <Tex>{mult}</Tex>
                          {note && <span className="text-muted-foreground ml-1">{note}</span>}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
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
            {firstStatus && (
              <>{firstStatus.name}（<Tex>{"I = 0"}</Tex>）は即日復習が必要です。</>
            )}
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
            <li>高評価で期限切れ（<Tex>{"S"}</Tex>日数超過）— 忘却直前、最優先</li>
            <li>低評価で数日経過 — 忘却リスク高</li>
            <li>最低評価で複数回着手済み — 定着しかけている</li>
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
