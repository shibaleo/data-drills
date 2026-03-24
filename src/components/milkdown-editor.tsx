"use client";

import { useEffect, useRef } from "react";
import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import "katex/dist/katex.min.css";

interface MilkdownEditorProps {
  defaultValue: string;
  onChange: (markdown: string) => void;
}

export function MilkdownEditor({ defaultValue, onChange }: MilkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    const crepe = new Crepe({
      root: containerRef.current,
      defaultValue,
      features: {
        [Crepe.Feature.Latex]: true,
      },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: {
          text: "ノートを書き始めましょう...",
        },
      },
    });

    crepe.on((listener: any) => {
      listener.markdownUpdated((_ctx: any, markdown: string) => {
        if (!cancelled) {
          onChangeRef.current(markdown);
        }
      });
    });

    crepe.create().then(() => {
      if (cancelled) {
        try { crepe.destroy(); } catch { /* already torn down */ }
      } else {
        crepeRef.current = crepe;
      }
    });

    return () => {
      cancelled = true;
      if (crepeRef.current) {
        crepeRef.current.destroy();
        crepeRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="milkdown-editor min-h-[300px] rounded-md border border-input bg-background text-sm"
    />
  );
}
