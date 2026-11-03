import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { loadSubmission } from "@/lib/services/review";
import { Card, CardHeader, CardTitle, CardContent, PageHeader, VerdictBadge, Badge } from "@/components/ui";
import { MarksForm } from "@/components/practical/marks-form";
import { DEFAULT_RUBRIC, type RubricKey, type TestOutcome } from "@/lib/evaluation";
import { LANGUAGE_META } from "@/lib/languages";
import { fmtDateTime } from "@/lib/utils";
import { CodeViewer } from "@/components/editor/code-viewer";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["FACULTY", "HOD", "SUPER_ADMIN"]);
  const { id } = await params;
  const sub = await loadSubmission(user, id).catch(() => null);
  if (!sub) notFound();
  const ev = sub.evaluation;
  const latest = sub.attempts[0];
  const tests = (latest?.details ?? []) as unknown as TestOutcome[];
  const rubric = { ...DEFAULT_RUBRIC, ...(sub.experiment.rubric as Partial<Record<RubricKey, number>>) };
  return (
    <>
      <PageHeader eyebrow={<Link href="/faculty/review" className="hover:underline">Review submissions</Link>} title={`${sub.student.name} · ${sub.experiment.title}`}
        description={<>{sub.student.enrollmentNo} · {sub.session ? `Practical #${sub.session.sequence}` : "Practice"} · submitted {fmtDateTime(sub.submittedAt)} {sub.isLate && <Badge variant="warning">late</Badge>} {sub.reopenCount > 0 && <Badge variant="secondary">reopened {sub.reopenCount}×</Badge>} <Badge variant={sub.status === "FINALIZED" ? "success" : "secondary"}>{sub.status.toLowerCase()}</Badge></>} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader><CardTitle>Submitted code <span className="text-sm font-normal text-muted-foreground">· {LANGUAGE_META[sub.language].label}</span></CardTitle></CardHeader>
            <CardContent><CodeViewer code={sub.code} language={LANGUAGE_META[sub.language].monaco} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2">Test results {ev && <VerdictBadge v={ev.verdict} />}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {ev && <p className="text-sm text-muted-foreground">{ev.testsPassed}/{ev.testsTotal} passed (weighted {ev.weightPassed}/{ev.weightTotal}) · max time {ev.timeMs ?? "—"} ms · max memory {ev.memoryKb ? `${Math.round(ev.memoryKb / 102.4) / 10} MB` : "—"}</p>}
              {latest?.compileOutput && <pre className="code-block max-h-48 text-xs text-destructive">{latest.compileOutput}</pre>}
              {tests.map((t, i) => (
                <details key={t.testId} className="rounded-md border px-3 py-2 text-sm">
                  <summary className="flex cursor-pointer items-center gap-2">{t.passed ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />} Test {i + 1} {t.hidden && <Badge variant="secondary">hidden</Badge>}<span className="ml-auto text-xs text-muted-foreground">{t.status?.replaceAll("_", " ").toLowerCase()} · {t.timeMs} ms</span></summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <div><p className="text-xs text-muted-foreground">Input</p><pre className="code-block p-2 text-xs">{t.input || "(empty)"}</pre></div>
                    <div><p className="text-xs text-muted-foreground">Expected</p><pre className="code-block p-2 text-xs">{t.expected}</pre></div>
                    <div><p className="text-xs text-muted-foreground">Actual</p><pre className="code-block p-2 text-xs">{t.stdout || t.stderr || "(empty)"}</pre></div>
                  </div>
                </details>
              ))}
              {!tests.length && <p className="text-sm text-muted-foreground">No automatic tests for this submission — evaluate correctness manually.</p>}
            </CardContent>
          </Card>
          {sub.attempts.length > 1 && (
            <Card><CardHeader><CardTitle>Submission history</CardTitle></CardHeader><CardContent className="space-y-1 text-sm">{sub.attempts.map((a) => <p key={a.id}>{fmtDateTime(a.createdAt)} · <VerdictBadge v={a.verdict} /> {a.testsPassed}/{a.testsTotal}</p>)}</CardContent></Card>
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Marks</CardTitle></CardHeader>
            <CardContent>{ev ? <MarksForm submissionId={sub.id} rubric={rubric} components={ev.components as Record<RubricKey, number | null>} finalized={sub.status === "FINALIZED"} canEditFinal={user.role !== "FACULTY"} /> : <p className="text-sm text-muted-foreground">Not evaluated yet.</p>}</CardContent>
          </Card>
          {sub.feedback.length > 0 && <Card><CardHeader><CardTitle>Feedback sent</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{sub.feedback.map((f) => <p key={f.id}><strong>{f.author.name}</strong> · {fmtDateTime(f.createdAt)}<br />{f.comment}</p>)}</CardContent></Card>}
          {ev && ev.overrides.length > 0 && (
            <Card><CardHeader><CardTitle>Mark changes (audit)</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{ev.overrides.map((o) => <p key={o.id}>{fmtDateTime(o.createdAt)} · {o.actor.name}: <strong>{o.component}</strong> {o.oldValue ?? "—"} → {o.newValue}<br /><span className="text-muted-foreground">Reason: {o.reason}</span></p>)}</CardContent></Card>
          )}
        </div>
      </div>
    </>
  );
}
