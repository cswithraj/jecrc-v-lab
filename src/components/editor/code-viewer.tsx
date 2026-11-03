"use client";
import { CodeEditor } from "./monaco";
export function CodeViewer({ code, language, height = "420px" }: { code: string; language: string; height?: string }) {
  return <div className="overflow-hidden rounded-md border"><CodeEditor value={code} language={language} readOnly height={height} /></div>;
}
