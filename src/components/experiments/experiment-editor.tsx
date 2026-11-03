"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { Button, Input, Textarea, Select, Field, Alert, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from "@/components/ui";
import { CodeEditor } from "@/components/editor/monaco";
import { MermaidDiagram } from "@/components/labs/mermaid";
import { LANGUAGE_META } from "@/lib/languages";
import { RUBRIC_LABELS, DEFAULT_RUBRIC, type RubricKey } from "@/lib/evaluation";

type Test = { input: string; expected: string; isHidden: boolean; weight: number; compareMode: "EXACT" | "TRIM" | "TOKENS" | "FLOAT" };
type Viva = { question: string; answer: string };
export interface EditorValue {
  subjectId: string; number: number; title: string; difficulty: "EASY" | "MEDIUM" | "HARD"; estimatedMinutes: number; topic: string; language: string; environment: string;
  objectives: string; courseOutcomes: string; learningOutcome: string;
  introduction: string; definition: string; concepts: string; terminology: string; working: string; applications: string; examples: string;
  problemStatement: string; algorithm: string; pseudocode: string; flowchart: string; starterCode: string; referenceCode: string; codeExplanation: string;
  sampleInput: string; sampleOutput: string; conclusion: string; showSolution: boolean;
  rubric: Record<RubricKey, number>; maxMarks: number; timeLimitMs: number; memoryLimitKb: number;
  testCases: Test[]; vivaQuestions: Viva[];
}

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const ENVIRONMENTS = ["CODE", "WEB", "SQL", "SHELL", "NETWORK", "DSA_VISUAL", "NOTEBOOK", "ANDROID", "WRITTEN"];

function toPayload(v: EditorValue) {
  return {
    subjectId: v.subjectId, number: Number(v.number), title: v.title, difficulty: v.difficulty, estimatedMinutes: Number(v.estimatedMinutes), topic: v.topic || null,
    language: v.language, environment: v.environment,
    objectives: lines(v.objectives), courseOutcomes: lines(v.courseOutcomes.replace(/,/g, "\n")), learningOutcome: v.learningOutcome || null,
    theory: {
      introduction: v.introduction, definition: v.definition, concepts: lines(v.concepts), working: v.working, applications: lines(v.applications), examples: v.examples || undefined,
      terminology: lines(v.terminology).map((l) => { const i = l.indexOf(":"); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : [l, ""]; }),
    },
    problemStatement: v.problemStatement, algorithm: lines(v.algorithm), pseudocode: v.pseudocode || null, flowchart: v.flowchart || null,
    starterCode: v.starterCode || null, referenceCode: v.referenceCode || null, codeExplanation: v.codeExplanation || null,
    sampleInput: v.sampleInput || null, sampleOutput: v.sampleOutput || null, conclusion: v.conclusion || null, showSolution: v.showSolution,
    rubric: Object.fromEntries(Object.entries(v.rubric).map(([k, n]) => [k, Number(n)])), maxMarks: Number(v.maxMarks), timeLimitMs: Number(v.timeLimitMs), memoryLimitKb: Number(v.memoryLimitKb),
    testCases: v.testCases.map((t) => ({ ...t, weight: Number(t.weight) })), vivaQuestions: v.vivaQuestions.filter((q) => q.question.trim()).map((q) => ({ question: q.question, answer: q.answer || null })),
  };
}

type ValidateResult = { verdict: string; compileOk: boolean; compileOutput: string; testsPassed: number; testsTotal: number; tests: { passed: boolean; status: string; stdout: string; expected: string; timeMs: number }[] };

export function ExperimentEditor({ id, initial, subjects, status }: { id: string | null; initial: EditorValue; subjects: { id: string; name: string }[]; status?: string }) {
  const router = useRouter();
  const [v, setV] = useState<EditorValue>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error" | "warning"; text: string; details?: string[] } | null>(null);
  const [check, setCheck] = useState<ValidateResult | null>(null);
  const [checking, setChecking] = useState(false);
  const set = <K extends keyof EditorValue>(k: K, val: EditorValue[K]) => setV((p) => ({ ...p, [k]: val }));
  const rubricTotal = useMemo(() => Object.values(v.rubric).reduce((a, b) => a + Number(b || 0), 0), [v.rubric]);
  const monacoLang = LANGUAGE_META[v.language as keyof typeof LANGUAGE_META]?.monaco ?? "plaintext";
  const executable = LANGUAGE_META[v.language as keyof typeof LANGUAGE_META]?.executable;

  async function save() {
    setBusy(true); setMsg(null);
    const res = await fetch(id ? `/api/v1/experiments/${id}` : "/api/v1/experiments", { method: id ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(toPayload(v)) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      const fe = d.details?.fieldErrors as Record<string, string[]> | undefined;
      setMsg({ tone: "error", text: d.error ?? "Could not save.", details: fe ? Object.entries(fe).map(([k, e]) => `${k}: ${e.join(", ")}`) : undefined });
      return;
    }
    if (!id) { router.push(`/faculty/experiments/${d.id}`); return; }
    if (status === "PUBLISHED" && d.status === "DRAFT") setMsg({ tone: "warning", text: `Saved as version ${d.version}, but it no longer meets the publishing checks (introduction, rubric total, five viva questions), so it was moved back to draft.` });
    else setMsg({ tone: "success", text: `Saved as version ${d.version}. The previous version is kept in history.` });
    router.refresh();
  }

  async function validate() {
    setChecking(true); setCheck(null); setMsg(null);
    const p = toPayload(v);
    const res = await fetch("/api/v1/experiments/validate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ language: p.language, code: p.referenceCode ?? "", timeLimitMs: p.timeLimitMs, memoryLimitKb: p.memoryLimitKb, tests: p.testCases }) });
    const d = await res.json().catch(() => ({}));
    setChecking(false);
    if (!res.ok) { setMsg({ tone: "error", text: d.error ?? "Check failed." }); return; }
    setCheck(d);
  }

  const T = (k: keyof EditorValue, label: string, rows = 3, hint?: string) => (
    <Field label={label} htmlFor={`f-${k}`} hint={hint}><Textarea id={`f-${k}`} rows={rows} value={String(v[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} /></Field>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>1 · Basics</CardTitle><CardDescription>Title, level and environment.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="Laboratory" htmlFor="f-subject"><Select id="f-subject" value={v.subjectId} disabled={!!id} onChange={(e) => set("subjectId", e.target.value)}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label="Experiment number" htmlFor="f-number"><Input id="f-number" type="number" min={1} value={v.number} onChange={(e) => set("number", Number(e.target.value))} /></Field>
          <Field label="Difficulty" htmlFor="f-diff"><Select id="f-diff" value={v.difficulty} onChange={(e) => set("difficulty", e.target.value as EditorValue["difficulty"])}><option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option></Select></Field>
          <Field label="Title" htmlFor="f-title" className="md:col-span-2"><Input id="f-title" value={v.title} onChange={(e) => set("title", e.target.value)} /></Field>
          <Field label="Topic" htmlFor="f-topic"><Input id="f-topic" value={v.topic} onChange={(e) => set("topic", e.target.value)} /></Field>
          <Field label="Language" htmlFor="f-lang"><Select id="f-lang" value={v.language} onChange={(e) => set("language", e.target.value)}>{Object.values(LANGUAGE_META).map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</Select></Field>
          <Field label="Environment" htmlFor="f-env"><Select id="f-env" value={v.environment} onChange={(e) => set("environment", e.target.value)}>{ENVIRONMENTS.map((x) => <option key={x} value={x}>{x.replace("_", " ").toLowerCase()}</option>)}</Select></Field>
          <Field label="Estimated minutes" htmlFor="f-min"><Input id="f-min" type="number" min={10} max={600} value={v.estimatedMinutes} onChange={(e) => set("estimatedMinutes", Number(e.target.value))} /></Field>
          <div className="md:col-span-2">{T("objectives", "Aim / objectives", 3, "One per line")}</div>
          <Field label="Course outcomes" htmlFor="f-co" hint="e.g. CO1, CO3"><Input id="f-co" value={v.courseOutcomes} onChange={(e) => set("courseOutcomes", e.target.value)} /></Field>
          <div className="md:col-span-3">{T("learningOutcome", "Learning outcome", 2)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2 · Theory</CardTitle><CardDescription>An introduction is required before publishing.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {T("introduction", "Introduction", 4)}{T("definition", "Definition", 4)}
          {T("concepts", "Key concepts", 4, "One per line")}{T("terminology", "Terminology", 4, "One per line, as term: meaning")}
          {T("working", "How it works", 4)}{T("applications", "Real-world applications", 4, "One per line")}
          <div className="md:col-span-2">{T("examples", "Examples (optional)", 3)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>3 · Problem, algorithm, flowchart</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">{T("problemStatement", "Problem statement", 4)}</div>
          {T("algorithm", "Algorithm", 8, "One step per line")}{T("pseudocode", "Pseudocode", 8)}
          <Field label="Flowchart (Mermaid)" htmlFor="f-flow" hint="flowchart TD syntax; the preview updates as you type">
            <Textarea id="f-flow" rows={12} className="font-mono text-xs" value={v.flowchart} onChange={(e) => set("flowchart", e.target.value)} />
          </Field>
          <div className="min-h-40 rounded-md border bg-muted/30 p-3"><p className="mb-2 text-xs font-medium text-muted-foreground">Preview</p>{v.flowchart.trim() ? <MermaidDiagram source={v.flowchart} /> : <p className="text-sm text-muted-foreground">No flowchart yet.</p>}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>4 · Code</CardTitle><CardDescription>Students start from the starter code. The reference solution is never shown to students unless you allow it below.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div><p className="mb-1.5 text-sm font-medium">Starter code</p><CodeEditor value={v.starterCode} onChange={(x) => set("starterCode", x)} language={monacoLang} height="300px" /></div>
          <div><p className="mb-1.5 text-sm font-medium">Reference solution</p><CodeEditor value={v.referenceCode} onChange={(x) => set("referenceCode", x)} language={monacoLang} height="300px" /></div>
          <div className="lg:col-span-2">{T("codeExplanation", "Code explanation", 3)}</div>
          <label className="flex items-center gap-2 text-sm lg:col-span-2"><input type="checkbox" checked={v.showSolution} onChange={(e) => set("showSolution", e.target.checked)} /> Show the reference solution to students on the experiment page</label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>5 · Sample I/O and test cases</CardTitle><CardDescription>Hidden tests are used only for evaluation. Weight sets each test&apos;s share of the correctness marks.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">{T("sampleInput", "Sample input", 3)}{T("sampleOutput", "Sample output", 3)}</div>
          {v.testCases.map((t, i) => (
            <div key={i} className="rounded-md border p-3">
              <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">Test {i + 1}</span>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={t.isHidden} onChange={(e) => set("testCases", v.testCases.map((x, j) => (j === i ? { ...x, isHidden: e.target.checked } : x)))} /> hidden</label>
                <label className="flex items-center gap-1.5">weight <Input type="number" min={1} max={100} className="h-8 w-16" value={t.weight} onChange={(e) => set("testCases", v.testCases.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)))} /></label>
                <label className="flex items-center gap-1.5">compare <Select className="h-8 w-32" value={t.compareMode} onChange={(e) => set("testCases", v.testCases.map((x, j) => (j === i ? { ...x, compareMode: e.target.value as Test["compareMode"] } : x)))}><option value="TRIM">trim lines</option><option value="EXACT">exact</option><option value="TOKENS">tokens</option><option value="FLOAT">numbers ±1e-6</option></Select></label>
                <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => set("testCases", v.testCases.filter((_, j) => j !== i))} aria-label={`Remove test ${i + 1}`}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <Textarea rows={3} className="font-mono text-xs" aria-label={`Test ${i + 1} input`} placeholder="stdin" value={t.input} onChange={(e) => set("testCases", v.testCases.map((x, j) => (j === i ? { ...x, input: e.target.value } : x)))} />
                <Textarea rows={3} className="font-mono text-xs" aria-label={`Test ${i + 1} expected output`} placeholder="expected stdout" value={t.expected} onChange={(e) => set("testCases", v.testCases.map((x, j) => (j === i ? { ...x, expected: e.target.value } : x)))} />
              </div>
              {check?.tests[i] && <p className={`mt-2 flex items-center gap-1.5 text-xs ${check.tests[i].passed ? "text-success" : "text-destructive"}`}>{check.tests[i].passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}{check.tests[i].passed ? "reference passes" : `reference got ${check.tests[i].status.toLowerCase().replace("_", " ")}: ${check.tests[i].stdout.slice(0, 120) || "(no output)"}`}</p>}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => set("testCases", [...v.testCases, { input: "", expected: "", isHidden: false, weight: 1, compareMode: "TRIM" }])}><Plus className="h-4 w-4" /> Add test case</Button>
            {executable && <Button type="button" variant="secondary" loading={checking} disabled={!v.referenceCode.trim() || !v.testCases.length} onClick={validate}>Check reference solution</Button>}
          </div>
          {check && <Alert tone={check.testsPassed === check.testsTotal ? "success" : "error"}>Reference solution: {check.testsPassed}/{check.testsTotal} tests pass{!check.compileOk && <pre className="mt-2 whitespace-pre-wrap text-xs">{check.compileOutput}</pre>}</Alert>}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Time limit per test (ms)" htmlFor="f-tl"><Input id="f-tl" type="number" min={100} max={10000} value={v.timeLimitMs} onChange={(e) => set("timeLimitMs", Number(e.target.value))} /></Field>
            <Field label="Memory limit (KB)" htmlFor="f-ml"><Input id="f-ml" type="number" min={16384} max={524288} value={v.memoryLimitKb} onChange={(e) => set("memoryLimitKb", Number(e.target.value))} /></Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>6 · Viva questions</CardTitle><CardDescription>At least five are required before publishing.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {v.vivaQuestions.map((q, i) => (
            <div key={i} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <Input aria-label={`Viva question ${i + 1}`} placeholder={`Question ${i + 1}`} value={q.question} onChange={(e) => set("vivaQuestions", v.vivaQuestions.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))} />
              <Input aria-label={`Viva answer ${i + 1}`} placeholder="Model answer (optional)" value={q.answer} onChange={(e) => set("vivaQuestions", v.vivaQuestions.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))} />
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove viva question ${i + 1}`} onClick={() => set("vivaQuestions", v.vivaQuestions.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={() => set("vivaQuestions", [...v.vivaQuestions, { question: "", answer: "" }])}><Plus className="h-4 w-4" /> Add question</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>7 · Evaluation rubric and conclusion</CardTitle><CardDescription>Components must add up to the maximum marks.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(DEFAULT_RUBRIC) as RubricKey[]).map((k) => (
              <Field key={k} label={RUBRIC_LABELS[k]} htmlFor={`r-${k}`}><Input id={`r-${k}`} type="number" min={0} value={v.rubric[k]} onChange={(e) => set("rubric", { ...v.rubric, [k]: Number(e.target.value) })} /></Field>
            ))}
            <Field label="Maximum marks" htmlFor="f-max"><Input id="f-max" type="number" min={1} value={v.maxMarks} onChange={(e) => set("maxMarks", Number(e.target.value))} /></Field>
          </div>
          <p className="text-sm">Rubric total: <span className={rubricTotal === v.maxMarks ? "font-semibold text-success" : "font-semibold text-destructive"}>{rubricTotal}</span> of {v.maxMarks}</p>
          {T("conclusion", "Conclusion", 3)}
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} loading={busy}>{id ? "Save changes" : "Create draft"}</Button>
          {status && <Badge variant={status === "PUBLISHED" ? "success" : "warning"}>{status.toLowerCase()}</Badge>}
          {status === "PUBLISHED" && <span className="text-xs text-muted-foreground">Edits to a published experiment apply immediately; the earlier version stays in history.</span>}
        </div>
        {msg && <Alert tone={msg.tone} className="mt-3">{msg.text}{msg.details && <ul className="mt-1 list-disc pl-5 text-xs">{msg.details.map((d) => <li key={d}>{d}</li>)}</ul>}</Alert>}
      </div>
    </div>
  );
}
