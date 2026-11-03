"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Play, FlaskConical, Send, RotateCcw, Wand2, CheckCircle2, XCircle, Cloud, CloudOff, Loader2, Eye } from "lucide-react";
import type { Language } from "@prisma/client";
import { Button, Select, Textarea, Badge, VerdictBadge, Alert } from "@/components/ui";
import { CodeEditor, type MonacoEditorInstance } from "./monaco";
import { reindentBraces } from "./format";
import { LANGUAGE_META } from "@/lib/languages";
import { cn } from "@/lib/utils";

interface TestRow { testId: string; hidden: boolean; passed: boolean; status: string; timeMs: number; memoryKb: number | null; stdout?: string; stderr?: string; expected?: string; input?: string }
type Panel = "output" | "errors" | "tests" | "preview";

export interface WorkspaceProps {
  experimentId?: string;
  languages: Language[];
  initial: Partial<Record<Language, string>>;
  starter: Partial<Record<Language, string>>;
  isStudent: boolean;
  hasPublicTests?: boolean;
  sessionId?: string | null;
  submitLabel?: string;
  submitDisabledReason?: string | null;
  autosaveSeconds?: number;
  height?: string;
  onSubmitted?: (r: SubmitResult) => void;
}
export interface SubmitResult { verdict: string; testsPassed: number; testsTotal: number; submittedAt: string; late: boolean; tests: TestRow[]; compileOk: boolean; compileOutput: string; marks: { auto: number; max: number } | null }

const BRACE = new Set<Language>(["C", "CPP", "JAVA", "JAVASCRIPT"]);
const draftKey = (exp: string | undefined, lang: Language) => `vlab-draft:${exp ?? "playground"}:${lang}`;

export function CodeWorkspace(props: WorkspaceProps) {
  const { experimentId, languages, isStudent, sessionId } = props;
  const [lang, setLang] = useState<Language>(languages[0]);
  const meta = LANGUAGE_META[lang];
  const [codes, setCodes] = useState<Partial<Record<Language, string>>>(() => {
    const init: Partial<Record<Language, string>> = {};
    for (const l of languages) {
      let local: string | null = null;
      try { local = typeof window !== "undefined" ? localStorage.getItem(draftKey(experimentId, l)) : null; } catch {}
      init[l] = props.initial[l] ?? local ?? props.starter[l] ?? LANGUAGE_META[l].template;
    }
    return init;
  });
  const code = codes[lang] ?? "";
  const [stdin, setStdin] = useState("");
  const [busy, setBusy] = useState<null | "run" | "test" | "submit">(null);
  const [panel, setPanel] = useState<Panel>(meta.browserOnly ? "preview" : "output");
  const [out, setOut] = useState<{ stdout: string; stderr: string; compile: string; status: string; timeMs?: number; memoryKb?: number | null } | null>(null);
  const [tests, setTests] = useState<{ rows: TestRow[]; verdict: string; passed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty" | "offline">("saved");
  const [submitted, setSubmitted] = useState<SubmitResult | null>(null);
  const [preview, setPreview] = useState("");
  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const dirty = useRef(false);

  const setCode = (v: string) => {
    setCodes((c) => ({ ...c, [lang]: v }));
    dirty.current = true;
    setSaveState("dirty");
    try { localStorage.setItem(draftKey(experimentId, lang), v); } catch {}
  };

  const save = useCallback(async () => {
    if (!isStudent || !experimentId || !dirty.current) return;
    dirty.current = false;
    setSaveState("saving");
    try {
      const r = await fetch("/api/v1/drafts", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ experimentId, language: lang, code: codes[lang] ?? "" }) });
      setSaveState(r.ok ? "saved" : "offline");
      if (!r.ok) dirty.current = true;
    } catch { dirty.current = true; setSaveState("offline"); }
  }, [isStudent, experimentId, lang, codes]);

  // Periodic autosave + save on tab hide; retries automatically after network loss.
  useEffect(() => {
    const id = setInterval(save, (props.autosaveSeconds ?? 15) * 1000);
    const onHide = () => { if (document.visibilityState === "hidden") save(); };
    const onOnline = () => { dirty.current = true; save(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("online", onOnline);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onHide); window.removeEventListener("online", onOnline); };
  }, [save, props.autosaveSeconds]);

  useEffect(() => { if (meta.browserOnly) setPreview(code); }, [meta.browserOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  async function call(path: string, body: object) {
    setError(null);
    const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({ error: "Unexpected response from server." }));
    if (!r.ok) throw new Error(data.error ?? `Request failed (${r.status})`);
    return data;
  }

  async function run() {
    if (meta.browserOnly) { setPreview(code); setPanel("preview"); return; }
    setBusy("run");
    try {
      const d = await call("/api/v1/run", { language: lang, code, stdin, experimentId });
      setOut({ stdout: d.run?.stdout ?? "", stderr: d.run?.stderr ?? "", compile: d.compile.output, status: !d.compile.ok ? "Compilation error" : d.run?.status === "OK" ? "Executed successfully" : (d.run?.status ?? "").replaceAll("_", " ").toLowerCase(), timeMs: d.run?.timeMs, memoryKb: d.run?.memoryKb });
      setPanel(!d.compile.ok || d.run?.stderr ? "errors" : "output");
      if (!d.compile.ok) setPanel("errors");
      else setPanel("output");
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  async function test() {
    setBusy("test");
    try {
      const d = await call("/api/v1/test", { language: lang, code, experimentId });
      setTests({ rows: d.tests, verdict: d.verdict, passed: d.testsPassed, total: d.testsTotal });
      if (!d.compileOk) setOut({ stdout: "", stderr: "", compile: d.compileOutput, status: "Compilation error" });
      setPanel(d.compileOk ? "tests" : "errors");
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  async function submitCode() {
    if (!confirm(sessionId ? "Submit this practical? You can submit only once unless faculty reopen it." : "Submit for evaluation?")) return;
    setBusy("submit");
    try {
      await save();
      const d = await call("/api/v1/submissions", { language: lang, code, experimentId, sessionId: sessionId ?? null });
      setSubmitted(d);
      setTests({ rows: d.tests, verdict: d.verdict, passed: d.testsPassed, total: d.testsTotal });
      if (!d.compileOk) setOut({ stdout: "", stderr: "", compile: d.compileOutput, status: "Compilation error" });
      setPanel(d.compileOk ? "tests" : "errors");
      props.onSubmitted?.(d);
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  function reset() {
    if (!confirm("Reset the editor to the starter code? Your current code for this language will be replaced.")) return;
    setCode(props.starter[lang] ?? meta.template);
  }

  async function format() {
    const ed = editorRef.current;
    if (ed && ["javascript", "html", "css"].includes(meta.monaco)) { await ed.getAction("editor.action.formatDocument")?.run(); return; }
    if (BRACE.has(lang)) setCode(reindentBraces(code));
  }

  const panels: { id: Panel; label: string; show: boolean }[] = [
    { id: "preview", label: "Preview", show: !!meta.browserOnly || lang === "JAVASCRIPT" && false },
    { id: "output", label: "Output", show: !meta.browserOnly },
    { id: "errors", label: "Errors", show: !meta.browserOnly },
    { id: "tests", label: tests ? `Tests ${tests.passed}/${tests.total}` : "Tests", show: !!experimentId && !meta.browserOnly },
  ];

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2">
        <label className="sr-only" htmlFor="lang">Language</label>
        <Select id="lang" className="h-8 w-auto" value={lang} onChange={(e) => { setLang(e.target.value as Language); setPanel(LANGUAGE_META[e.target.value as Language].browserOnly ? "preview" : "output"); }}>
          {languages.map((l) => <option key={l} value={l}>{LANGUAGE_META[l].label}</option>)}
        </Select>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {isStudent && experimentId && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
              {saveState === "saving" ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving</> : saveState === "offline" ? <><CloudOff className="h-3 w-3 text-warning" /> Offline — kept locally</> : saveState === "dirty" ? <><Cloud className="h-3 w-3" /> Unsaved</> : <><Cloud className="h-3 w-3 text-success" /> Saved</>}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={format} title="Format code"><Wand2 className="h-4 w-4" /> Format</Button>
          <Button variant="ghost" size="sm" onClick={reset}><RotateCcw className="h-4 w-4" /> Reset</Button>
          <Button variant="outline" size="sm" onClick={run} loading={busy === "run"} disabled={!!busy}>{meta.browserOnly ? <Eye className="h-4 w-4" /> : <Play className="h-4 w-4" />} {meta.browserOnly ? "Preview" : "Run"}</Button>
          {experimentId && props.hasPublicTests && meta.executable && <Button variant="outline" size="sm" onClick={test} loading={busy === "test"} disabled={!!busy}><FlaskConical className="h-4 w-4" /> Test</Button>}
          {isStudent && experimentId && (
            <Button size="sm" onClick={submitCode} loading={busy === "submit"} disabled={!!busy || !!props.submitDisabledReason || (!!sessionId && !!submitted)} title={props.submitDisabledReason ?? undefined}>
              <Send className="h-4 w-4" /> {props.submitLabel ?? "Submit"}
            </Button>
          )}
        </div>
      </div>
      {props.submitDisabledReason && isStudent && <div className="border-b bg-warning/10 px-3 py-1.5 text-xs">{props.submitDisabledReason}</div>}
      <CodeEditor value={code} onChange={setCode} language={meta.monaco} height={props.height ?? "440px"} onMount={(ed) => { editorRef.current = ed; ed.onDidBlurEditorText(() => save()); }} />
      {error && <Alert tone="error" className="m-3">{error}</Alert>}
      {submitted && (
        <Alert tone={submitted.verdict === "ACCEPTED" ? "success" : "info"} className="m-3">
          <p className="font-medium">Submitted at {new Date(submitted.submittedAt).toLocaleTimeString("en-IN")}{submitted.late ? " (late)" : ""}. Verdict: {submitted.verdict.replaceAll("_", " ").toLowerCase()}{submitted.testsTotal ? ` · ${submitted.testsPassed}/${submitted.testsTotal} tests passed` : ""}.</p>
          <p className="mt-1 text-xs text-muted-foreground">{submitted.marks ? `Automatic marks: ${submitted.marks.auto}. Logic, code quality and efficiency are assessed by faculty.` : "Marks will be visible after your faculty reviews and releases them."}</p>
        </Alert>
      )}
      <div className="grid border-t lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {!meta.browserOnly && (
          <div className="border-b p-3 lg:border-b-0 lg:border-r">
            <label htmlFor="stdin" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Input (stdin)</label>
            <Textarea id="stdin" value={stdin} onChange={(e) => setStdin(e.target.value)} className="h-36 font-mono text-[13px]" placeholder={lang === "SQL" ? "Setup SQL (CREATE TABLE / INSERT) runs before your query" : "Program input"} />
          </div>
        )}
        <div className={cn("min-w-0", meta.browserOnly && "lg:col-span-2")}>
          <div className="flex items-center gap-1 border-b px-2" role="tablist">
            {panels.filter((p) => p.show).map((p) => (
              <button key={p.id} role="tab" aria-selected={panel === p.id} onClick={() => setPanel(p.id)} className={cn("border-b-2 px-3 py-2 text-xs font-medium", panel === p.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{p.label}</button>
            ))}
            {out && panel !== "preview" && <span className="ml-auto truncate pr-2 text-xs text-muted-foreground">{out.status}{out.timeMs != null ? ` · ${out.timeMs} ms` : ""}{out.memoryKb ? ` · ${Math.round(out.memoryKb / 1024 * 10) / 10} MB` : ""}</span>}
          </div>
          <div className="max-h-72 min-h-36 overflow-auto p-3">
            {panel === "output" && <pre className="whitespace-pre-wrap font-mono text-[13px]">{out?.stdout || <span className="text-muted-foreground">Run your program to see output.</span>}</pre>}
            {panel === "errors" && <pre className="whitespace-pre-wrap font-mono text-[13px] text-destructive">{(out?.compile || "") + (out?.stderr || "") || <span className="text-muted-foreground">No errors.</span>}</pre>}
            {panel === "preview" && <iframe title="Preview" sandbox="allow-scripts allow-forms allow-modals" srcDoc={preview} className="h-72 w-full rounded border bg-white" />}
            {panel === "tests" && (
              tests ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm"><VerdictBadge v={tests.verdict} /> <span>{tests.passed} of {tests.total} passed</span></div>
                  {tests.rows.map((t, i) => (
                    <details key={t.testId} className="rounded-md border px-3 py-2 text-sm">
                      <summary className="flex cursor-pointer items-center gap-2">
                        {t.passed ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
                        <span>Test {i + 1}</span>{t.hidden && <Badge variant="secondary">hidden</Badge>}
                        <span className="ml-auto text-xs text-muted-foreground">{t.status.replaceAll("_", " ").toLowerCase()} · {t.timeMs} ms</span>
                      </summary>
                      {!t.hidden && (
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          <div><p className="text-xs text-muted-foreground">Input</p><pre className="code-block p-2 text-xs">{t.input || "(empty)"}</pre></div>
                          <div><p className="text-xs text-muted-foreground">Expected</p><pre className="code-block p-2 text-xs">{t.expected}</pre></div>
                          <div><p className="text-xs text-muted-foreground">Your output</p><pre className="code-block p-2 text-xs">{t.stdout || t.stderr || "(empty)"}</pre></div>
                        </div>
                      )}
                      {t.hidden && <p className="mt-1 text-xs text-muted-foreground">Hidden test inputs are not shown.</p>}
                    </details>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">Use Test to check your code against the sample test cases.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
