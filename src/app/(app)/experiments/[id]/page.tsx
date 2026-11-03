import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Language } from "@prisma/client";
import { Pencil } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isStaff, canManageSubject } from "@/lib/rbac";
import { getExamRules } from "@/lib/settings";
import { Card, Badge, DifficultyBadge, LinkButton, VerdictBadge, Alert } from "@/components/ui";
import { MermaidDiagram } from "@/components/labs/mermaid";
import { CodeWorkspace } from "@/components/editor/workspace";
import { LANGUAGE_META } from "@/lib/languages";
import { RUBRIC_LABELS, type RubricKey } from "@/lib/evaluation";
import { fmtDateTime } from "@/lib/utils";

interface Theory { introduction?: string; definition?: string; concepts?: string[]; terminology?: [string, string][]; working?: string; applications?: string[]; examples?: string }

function Section({ n, id, title, children }: { n: number; id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <Card className="p-5 sm:p-6">
        <h2 className="mb-3 flex items-baseline gap-3 font-display text-xl font-semibold"><span className="text-sm font-sans font-semibold text-primary">{String(n).padStart(2, "0")}</span>{title}</h2>
        <div className="prose-lab">{children}</div>
      </Card>
    </section>
  );
}

export default async function ExperimentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const exp = await prisma.experiment.findUnique({
    where: { id },
    include: { subject: true, topic: true, testCases: { orderBy: { order: "asc" } }, vivaQs: { orderBy: { order: "asc" } }, resources: true },
  });
  if (!exp) notFound();
  const staff = isStaff(user);
  if (exp.status !== "PUBLISHED" && !staff) notFound();
  const manage = staff && (await canManageSubject(user, exp.subjectId));

  // Is this experiment part of an active/upcoming assessment for this student? Then the solution stays hidden.
  const activeAssessment = user.role === "STUDENT" ? await prisma.practicalSession.findFirst({ where: { experimentId: exp.id, isAssessment: true, status: { in: ["LIVE", "SCHEDULED"] }, offering: { enrollments: { some: { studentId: user.id } } } }, select: { id: true, status: true, sequence: true } }) : null;
  const showSolution = staff || (exp.showSolution && !activeAssessment);

  const [drafts, latest, rules] = await Promise.all([
    user.role === "STUDENT" ? prisma.codeDraft.findMany({ where: { studentId: user.id, experimentId: exp.id } }) : Promise.resolve([]),
    user.role === "STUDENT" ? prisma.submission.findFirst({ where: { studentId: user.id, experimentId: exp.id }, orderBy: { submittedAt: "desc" }, include: { evaluation: true, session: { select: { marksReleaseAt: true, sequence: true } }, feedback: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" } } } }) : Promise.resolve(null),
    getExamRules(),
  ]);
  const theory = exp.theory as Theory;
  const langs = [...new Set<Language>([exp.language, ...exp.subject.languages])].filter((l) => l !== "NONE" || exp.language === "NONE");
  const initial = Object.fromEntries(drafts.map((d) => [d.language, d.code]));
  const starter: Partial<Record<Language, string>> = { [exp.language]: exp.starterCode ?? LANGUAGE_META[exp.language].template };
  const publicTests = exp.testCases.filter((t) => !t.isHidden);
  const hiddenCount = exp.testCases.length - publicTests.length;
  const released = latest && (!latest.session || (latest.session.marksReleaseAt && latest.session.marksReleaseAt <= new Date()));
  const comps = (latest?.evaluation?.components ?? {}) as Record<RubricKey, number | null>;
  const rubric = exp.rubric as Record<RubricKey, number>;

  const nav = [["info", "Experiment information"], ["theory", "Theory"], ["problem", "Problem statement"], ["algorithm", "Algorithm"], ["pseudocode", "Pseudocode"], ["flowchart", "Flowchart"], ["code", "Source code & editor"], ["io", "Input & output"], ["tests", "Test cases"], ["result", "Result & conclusion"], ["viva", "Viva questions"]];

  return (
    <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden xl:block">
        <nav className="sticky top-24 space-y-0.5 text-sm" aria-label="Experiment sections">
          {nav.map(([h, l], i) => <a key={h} href={`#${h}`} className="block rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"><span className="mr-2 text-xs tabular-nums text-primary">{i + 1}</span>{l}</a>)}
        </nav>
      </aside>
      <div className="min-w-0 space-y-5">
        <div>
          <Link href={`/labs/${exp.subject.slug}`} className="text-xs font-semibold uppercase tracking-wider text-primary hover:underline">{exp.subject.name}</Link>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
            <h1 className="font-display text-3xl font-semibold">Experiment {exp.number}: {exp.title}</h1>
            {manage && <LinkButton href={`/faculty/experiments/${exp.id}`} variant="outline" size="sm"><Pencil className="h-4 w-4" /> Edit experiment</LinkButton>}
          </div>
          {exp.status !== "PUBLISHED" && <Alert tone="warning" className="mt-3">This experiment is a <strong>{exp.status.toLowerCase()}</strong> and is not visible to students{exp.status === "DRAFT" && !exp.theory ? "" : ""}. {!theory?.introduction && "Its theory and test cases still need to be written."}</Alert>}
          {activeAssessment && <Alert tone="info" className="mt-3">This experiment is assigned to {activeAssessment.status === "LIVE" ? "a live" : "an upcoming"} practical (#{activeAssessment.sequence}). The model solution is hidden. <Link className="font-medium text-primary underline" href={`/practicals/${activeAssessment.id}`}>Open the practical</Link></Alert>}
        </div>

        <Section n={1} id="info" title="Experiment information">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <div><dt className="text-muted-foreground">Experiment ID</dt><dd className="font-mono">{exp.code}</dd></div>
            <div><dt className="text-muted-foreground">Subject</dt><dd>{exp.subject.name}</dd></div>
            <div><dt className="text-muted-foreground">Experiment number</dt><dd>{exp.number}</dd></div>
            <div><dt className="text-muted-foreground">Difficulty</dt><dd><DifficultyBadge d={exp.difficulty} /></dd></div>
            <div><dt className="text-muted-foreground">Estimated time</dt><dd>{exp.estimatedMinutes} minutes</dd></div>
            <div><dt className="text-muted-foreground">Topic</dt><dd>{exp.topic?.name ?? "—"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-muted-foreground">Learning objectives</dt><dd><ul>{exp.objectives.map((o) => <li key={o}>{o}</li>)}</ul></dd></div>
            <div><dt className="text-muted-foreground">Course outcome mapping</dt><dd className="flex flex-wrap gap-1">{exp.courseOutcomes.length ? exp.courseOutcomes.map((c) => <Badge key={c} variant="secondary">{c}</Badge>) : "—"}</dd></div>
          </dl>
        </Section>

        <Section n={2} id="theory" title="Theory">
          {theory?.introduction ? (
            <>
              <h3 className="font-semibold">Introduction</h3><p>{theory.introduction}</p>
              <h3 className="mt-3 font-semibold">Definition</h3><p>{theory.definition}</p>
              {!!theory.concepts?.length && <><h3 className="mt-3 font-semibold">Important concepts</h3><ul>{theory.concepts.map((c) => <li key={c}>{c}</li>)}</ul></>}
              {!!theory.terminology?.length && <><h3 className="mt-3 font-semibold">Key terminology</h3><dl className="grid gap-1 sm:grid-cols-[180px_1fr]">{theory.terminology.map(([t, m]) => <Fragment key={t}><dt className="font-medium">{t}</dt><dd className="text-muted-foreground">{m}</dd></Fragment>)}</dl></>}
              <h3 className="mt-3 font-semibold">Working principle</h3><p>{theory.working}</p>
              {!!theory.applications?.length && <><h3 className="mt-3 font-semibold">Real-world applications</h3><ul>{theory.applications.map((a) => <li key={a}>{a}</li>)}</ul></>}
              {theory.examples && <><h3 className="mt-3 font-semibold">Example</h3><p>{theory.examples}</p></>}
            </>
          ) : <p className="text-muted-foreground">Theory has not been written yet.</p>}
        </Section>

        <Section n={3} id="problem" title="Problem statement"><p className="whitespace-pre-line">{exp.problemStatement}</p></Section>
        <Section n={4} id="algorithm" title="Algorithm">{exp.algorithm.length ? <ol>{exp.algorithm.map((s, i) => <li key={i}>{s}</li>)}</ol> : <p className="text-muted-foreground">Not provided.</p>}</Section>
        <Section n={5} id="pseudocode" title="Pseudocode">{exp.pseudocode ? <pre className="code-block whitespace-pre">{exp.pseudocode}</pre> : <p className="text-muted-foreground">Not applicable for this experiment.</p>}</Section>
        <Section n={6} id="flowchart" title="Flowchart / logic diagram">
          {exp.flowchart ? <MermaidDiagram source={exp.flowchart} className="flex justify-center overflow-x-auto [&_svg]:max-w-full" /> : <p className="text-muted-foreground">No diagram yet.</p>}
          {exp.flowchartImage && /* eslint-disable-next-line @next/next/no-img-element */ <img src={exp.flowchartImage} alt={`Diagram for ${exp.title}`} className="mt-4 max-w-full rounded border" />}
          {exp.resources.filter((r) => r.kind === "IMAGE" || r.kind === "DIAGRAM").map((r) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={r.id} src={r.url} alt={r.title} className="mt-4 max-w-full rounded border" />)}
        </Section>

        <Section n={7} id="code" title="Source code & editor">
          {showSolution && exp.referenceCode ? (
            <details className="mb-4 rounded-md border p-3" open={staff}>
              <summary className="cursor-pointer text-sm font-medium">Example code {staff && !exp.showSolution && <Badge variant="warning" className="ml-2">hidden from students</Badge>}</summary>
              <pre className="code-block mt-3 max-h-[480px]">{exp.referenceCode}</pre>
              {exp.codeExplanation && <p className="mt-2 text-sm text-muted-foreground"><strong className="text-foreground">Explanation:</strong> {exp.codeExplanation}</p>}
            </details>
          ) : exp.referenceCode ? <p className="mb-3 text-sm text-muted-foreground">The model solution is hidden by your faculty. Write your own solution below.</p> : null}
          {exp.language === "NONE" && user.role === "STUDENT" && <p className="mb-3 text-sm text-muted-foreground">Write your response in the editor (Markdown is fine) and submit it for faculty evaluation.</p>}
          <div className="not-prose">
            <CodeWorkspace experimentId={exp.id} languages={langs} initial={initial} starter={starter} isStudent={user.role === "STUDENT"} hasPublicTests={publicTests.length > 0} submitLabel="Submit (practice)" autosaveSeconds={rules.autosaveSeconds} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Practice submissions are graded automatically but do not count toward practical completion. Graded practicals are submitted from the practical session page.</p>
        </Section>

        <Section n={8} id="io" title="Input and output">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><p className="text-sm font-medium">Sample input</p><pre className="code-block mt-1">{exp.sampleInput || "(none)"}</pre></div>
            <div><p className="text-sm font-medium">Expected output</p><pre className="code-block mt-1">{exp.sampleOutput || "(none)"}</pre></div>
          </div>
        </Section>

        <Section n={9} id="tests" title="Test cases">
          {exp.testCases.length === 0 ? <p className="text-muted-foreground">This experiment is evaluated by faculty (no automatic test cases).</p> : (
            <>
              <p className="text-sm">{publicTests.length} public sample test{publicTests.length === 1 ? "" : "s"} · {hiddenCount} hidden assessment test{hiddenCount === 1 ? "" : "s"} (inputs not shown{staff ? " to students" : ""}).</p>
              <div className="mt-3 space-y-2">
                {(staff ? exp.testCases : publicTests).map((t, i) => (
                  <div key={t.id} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[80px_1fr_1fr]">
                    <div className="text-sm font-medium">#{i + 1} {t.isHidden && <Badge variant="secondary">hidden</Badge>}<p className="text-xs text-muted-foreground">weight {t.weight}</p></div>
                    <pre className="code-block p-2 text-xs">{t.input || "(empty)"}</pre>
                    <pre className="code-block p-2 text-xs">{t.expected}</pre>
                  </div>
                ))}
              </div>
            </>
          )}
        </Section>

        <Section n={10} id="result" title="Result and conclusion">
          {user.role !== "STUDENT" ? <p className="text-muted-foreground">Students see their latest evaluation here. Faculty review submissions from <Link className="text-primary underline" href="/faculty/review">Review submissions</Link>.</p> : !latest ? <p className="text-muted-foreground">No submission yet. Submit your code to see compilation status, test results and marks.</p> : (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <VerdictBadge v={latest.evaluation?.verdict ?? "PENDING"} />
                <span>Submitted {fmtDateTime(latest.submittedAt)}{latest.session ? ` · Practical #${latest.session.sequence}` : " · practice"}{latest.isLate ? " · late" : ""}</span>
              </div>
              <dl className="grid gap-2 sm:grid-cols-4">
                <div><dt className="text-muted-foreground">Compilation</dt><dd>{latest.evaluation?.verdict === "COMPILATION_ERROR" ? "Failed" : "Successful"}</dd></div>
                <div><dt className="text-muted-foreground">Tests passed</dt><dd>{latest.evaluation?.testsPassed ?? 0} / {latest.evaluation?.testsTotal ?? 0}</dd></div>
                <div><dt className="text-muted-foreground">Execution time</dt><dd>{latest.evaluation?.timeMs != null ? `${latest.evaluation.timeMs} ms` : "—"}</dd></div>
                <div><dt className="text-muted-foreground">Marks</dt><dd className="font-semibold">{released && latest.evaluation ? `${latest.evaluation.totalMarks} / ${latest.evaluation.maxMarks}` : "Not released yet"}</dd></div>
              </dl>
              {released && latest.evaluation && (
                <table className="w-full max-w-lg text-sm"><tbody>
                  {(Object.keys(RUBRIC_LABELS) as RubricKey[]).map((k) => <tr key={k} className="border-b"><td className="py-1">{RUBRIC_LABELS[k]}</td><td className="py-1 text-right tabular-nums">{comps[k] ?? <span className="text-muted-foreground">pending faculty</span>} / {rubric[k] ?? 0}</td></tr>)}
                </tbody></table>
              )}
              {latest.feedback.map((f) => <Alert key={f.id}><strong>{f.author.name}:</strong> {f.comment}</Alert>)}
            </div>
          )}
          {exp.conclusion && <p className="mt-4"><strong>Conclusion:</strong> {exp.conclusion}</p>}
        </Section>

        <Section n={11} id="viva" title="Viva questions">
          {exp.vivaQs.length === 0 ? <p className="text-muted-foreground">No viva questions yet.</p> : (
            <ol>{exp.vivaQs.map((v) => <li key={v.id} className="mb-2"><p className="font-medium">{v.question}</p>{v.answer && <details><summary className="cursor-pointer text-sm text-muted-foreground">Show answer</summary><p className="text-sm">{v.answer}</p></details>}</li>)}</ol>
          )}
        </Section>
      </div>
    </div>
  );
}
