"use client";

import dynamic from "next/dynamic";
import { useRef, useCallback } from "react";

interface MarkdownEditorProps {
  defaultValue: string;
  onChange: (markdown: string) => void;
}

const CodeMirrorEditor = dynamic(
  () => import("./codemirror-editor"),
  { ssr: false, loading: () => <div className="min-h-[300px]" /> },
);

export function MarkdownEditor({ defaultValue, onChange }: MarkdownEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const stableOnChange = useCallback((value: string) => {
    onChangeRef.current(value);
  }, []);

  return (
    <div className="cm-wrapper min-h-[300px] rounded-md border border-input bg-background text-sm">
      <CodeMirrorEditor defaultValue={defaultValue} onChange={stableOnChange} />
    </div>
  );
}
