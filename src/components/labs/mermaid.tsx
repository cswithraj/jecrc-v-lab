"use client";
import { useEffect, useId, useState } from "react";
import { quoteMermaidLabels } from "@/lib/mermaid-sanitize";

/** Renders Mermaid flowchart source to SVG (client-side, strict security level). */
export function MermaidDiagram({ source, className }: { source: string; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        const dark = document.documentElement.classList.contains("dark");
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", suppressErrorRendering: true, theme: dark ? "dark" : "neutral", flowchart: { htmlLabels: false, curve: "basis" }, themeVariables: { primaryColor: dark ? "#2a1214" : "#fff1f1", primaryBorderColor: "#E30613", lineColor: dark ? "#aaa" : "#555" } });
        const { svg } = await mermaid.render(`m${id}${Date.now()}`, quoteMermaidLabels(source));
        if (alive) { setSvg(svg); setErr(null); }
      } catch (e) {
        if (alive) setErr((e as Error).message?.split("\n")[0] ?? "Invalid diagram");
      }
    })();
    return () => { alive = false; };
  }, [source, id]);
  if (err) return <p className="text-sm text-destructive">Diagram error: {err}</p>;
  if (!svg) return <p className="text-sm text-muted-foreground">Rendering diagram…</p>;
  return <div className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}
