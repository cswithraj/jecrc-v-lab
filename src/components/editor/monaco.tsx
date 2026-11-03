"use client";
import Editor, { loader, type OnMount } from "@monaco-editor/react";
import { useEffect, useState } from "react";

// Self-hosted Monaco (copied to /public/monaco by scripts/copy-monaco.mjs) — no CDN dependency.
loader.config({ paths: { vs: "/monaco/vs" } });

export type MonacoEditorInstance = Parameters<OnMount>[0];

export function CodeEditor({ value, onChange, language, height = "420px", readOnly, onMount }: { value: string; onChange?: (v: string) => void; language: string; height?: string; readOnly?: boolean; onMount?: OnMount }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const update = () => setDark(document.documentElement.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return (
    <Editor
      height={height}
      language={language}
      value={value}
      theme={dark ? "vs-dark" : "light"}
      onChange={(v) => onChange?.(v ?? "")}
      onMount={onMount}
      loading={<div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading editor…</div>}
      options={{
        readOnly, minimap: { enabled: false }, fontSize: 14, fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace",
        lineNumbers: "on", automaticLayout: true, tabSize: 4, insertSpaces: true, scrollBeyondLastLine: false, wordWrap: "on",
        formatOnPaste: true, autoIndent: "full", renderLineHighlight: "line", padding: { top: 10 },
      }}
    />
  );
}
