import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadTeam, PROJECT_RUBRIC_LABELS } from "@/lib/services/projects";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, EmptyState } from "@/components/ui";
import { ActionButton } from "@/components/common/action-button";
import { SubmissionForm } from "@/components/projects/submission-form";
import { EvaluateForm } from "@/components/projects/evaluate-form";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { uploadsEnabled } from "@/lib/storage";

export const metadata = { title: "Project" };
const KIND: Record<string, string> = { REPO: "Repository", DOCUMENT: "Document", DEMO: "Demo", NOTE: "Note" };

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const r = await loadTeam(user, id).catch(() => null);
  if (!r) notFound();
  const { team, member, staff } = r;
  const p = team.project;
  const ev = (team.evaluation ?? null) as Record<string, number | string> | null;
  const raw = p.rubric as Record<string, number>;
  // jsonb does not keep key order; show components in the canonical rubric order
  const order = Object.keys(PROJECT_RUBRIC_LABELS);
  const rubric = Object.fromEntries(Object.entries(raw).sort(([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)));
  return (
    <>
      <PageHeader eyebrow={<Link href={staff ? `/projects?offering=${team.offeringId}` : "/projects"} className="hover:underline">Projects · {team.offering.subject.name}</Link>}
        title={p.title} description={`${p.isGroup ? team.name : "Individual project"} · ${team.offering.batch.name}${p.dueDate ? ` · due ${fmtDate(p.dueDate)}` : ""}`}
        actions={staff && team.status !== "EVALUATED" ? <ActionButton url={`/api/v1/projects/teams/${team.id}`} method="DELETE" redirectTo={`/projects?offering=${team.offeringId}`} variant="outline" confirm="Delete this team? Its submissions are removed too.">Delete team</ActionButton> : undefined} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Brief</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>{p.problemStatement}</p>
              {p.objectives.length > 0 && <div><p className="font-medium">Objectives</p><ul className="mt-1 list-disc pl-5 text-muted-foreground">{p.objectives.map((x) => <li key={x}>{x}</li>)}</ul></div>}
              {p.requirements.length > 0 && <div><p className="font-medium">Requirements</p><ul className="mt-1 list-disc pl-5 text-muted-foreground">{p.requirements.map((x) => <li key={x}>{x}</li>)}</ul></div>}
              {p.milestones.length > 0 && <div><p className="font-medium">Milestones</p><ol className="mt-1 list-decimal pl-5 text-muted-foreground">{p.milestones.map((m) => <li key={m.id}>{m.title}{m.dueDate ? ` · ${fmtDate(m.dueDate)}` : ""}{team.submissions.some((s) => s.milestoneId === m.id) && <Badge variant="success" className="ml-2">submitted</Badge>}</li>)}</ol></div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Submissions</CardTitle><CardDescription>Newest first.</CardDescription></CardHeader>
            <CardContent>
              {team.submissions.length === 0 ? <EmptyState title="Nothing submitted yet" /> : (
                <ul className="divide-y text-sm">{team.submissions.map((s) => (
                  <li key={s.id} className="py-3">
                    <p className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{KIND[s.kind] ?? s.kind}</Badge><span className="text-muted-foreground">{s.milestone?.title ?? "Final"} · {fmtDateTime(s.createdAt)} · {team.members.find((m) => m.studentId === s.submittedById)?.student.name ?? "staff"}</span></p>
                    {s.url && <a className="mt-1 block break-all text-primary hover:underline" href={s.url} target="_blank" rel="noopener noreferrer nofollow">{s.url}</a>}
                    {s.fileKey && <a className="mt-1 block text-primary hover:underline" href={`/api/v1/projects/files/${s.id}`}>Download {s.fileName}</a>}
                    {s.notes && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{s.notes}</p>}
                  </li>))}
                </ul>
              )}
            </CardContent>
          </Card>
          {member && team.status !== "EVALUATED" && (
            <Card>
              <CardHeader><CardTitle>Add a submission</CardTitle><CardDescription>Share a repository link, upload your report, or post a progress note.</CardDescription></CardHeader>
              <CardContent><SubmissionForm teamId={team.id} milestones={p.milestones.map((m) => ({ id: m.id, title: m.title }))} maxMb={Number(process.env.MAX_UPLOAD_MB || 20)} uploads={uploadsEnabled()} /></CardContent>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{p.isGroup ? "Team" : "Student"}</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">{team.members.map((m) => <p key={m.studentId}>{m.student.name} <span className="text-muted-foreground">{m.student.enrollmentNo}</span>{m.isLeader && p.isGroup && <Badge variant="secondary" className="ml-2">leader</Badge>}</p>)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Evaluation</CardTitle><CardDescription>{team.status === "EVALUATED" ? `Evaluated ${fmtDateTime(team.evaluatedAt)}` : "Not evaluated yet"}</CardDescription></CardHeader>
            <CardContent>
              {staff ? <EvaluateForm teamId={team.id} rubric={rubric} labels={PROJECT_RUBRIC_LABELS} initial={ev} maxMarks={p.maxMarks} locked={team.offering.resultsFinalized} />
                : team.status === "EVALUATED" && ev ? (
                  <div className="space-y-1 text-sm">
                    {Object.entries(rubric).map(([k, max]) => <p key={k} className="flex justify-between"><span>{PROJECT_RUBRIC_LABELS[k] ?? k}</span><span className="tabular-nums">{ev[k] ?? "—"} / {max}</span></p>)}
                    <p className="flex justify-between border-t pt-2 font-semibold"><span>Total</span><span className="tabular-nums">{team.marks} / {p.maxMarks}</span></p>
                    {typeof ev.feedback === "string" && <p className="pt-2 text-muted-foreground">“{ev.feedback}”</p>}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Your faculty will evaluate the project after the final submission.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
