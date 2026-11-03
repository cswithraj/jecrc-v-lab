import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { managedOfferings } from "@/lib/services/offerings";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, EmptyState, Select, Button, Table, THead, TBody, TR, TH, TD } from "@/components/ui";
import { ActionButton } from "@/components/common/action-button";
import { TeamForm } from "@/components/projects/team-form";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Projects" };
const STATUS = { IN_PROGRESS: "warning", SUBMITTED: "default", EVALUATED: "success" } as const;
const S = ({ s }: { s: string }) => <Badge variant={STATUS[s as keyof typeof STATUS] ?? "secondary"}>{s.replace("_", " ").toLowerCase()}</Badge>;

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  return user.role === "STUDENT" ? <StudentProjects userId={user.id} /> : <StaffProjects user={user} sp={await searchParams} />;
}

async function StudentProjects({ userId }: { userId: string }) {
  const enr = await prisma.studentEnrollment.findMany({ where: { studentId: userId, status: "ACTIVE" }, include: { offering: { include: { subject: { select: { name: true, projects: { where: { isActive: true }, include: { milestones: { orderBy: { order: "asc" } } } } } }, teams: { where: { members: { some: { studentId: userId } } }, select: { id: true, projectId: true, name: true, status: true, marks: true } } } } } });
  const items = enr.flatMap((e) => e.offering.subject.projects.map((p) => ({ p, o: e.offering, team: e.offering.teams.find((t) => t.projectId === p.id) })));
  return (
    <>
      <PageHeader eyebrow="Laboratory" title="Projects" description="Each laboratory ends with a mini project. Individual projects can be started here; group teams are formed by your faculty." />
      {items.length === 0 ? <EmptyState title="No projects yet" description="Projects appear when you are enrolled in a laboratory that has one." /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map(({ p, o, team }) => (
            <Card key={`${o.id}-${p.id}`}>
              <CardHeader>
                <p className="text-xs font-medium uppercase tracking-wide text-primary">{o.subject.name}</p>
                <CardTitle>{p.title}</CardTitle>
                <CardDescription>{p.isGroup ? `Group project, up to ${p.maxTeamSize} members` : "Individual project"}{p.dueDate ? ` · due ${fmtDate(p.dueDate)}` : ""}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="line-clamp-3 text-sm text-muted-foreground">{p.problemStatement}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {team ? <>
                    <S s={team.status} />{team.marks != null && <span className="text-sm font-semibold">{team.marks}/{p.maxMarks}</span>}
                    <Link className="ml-auto text-sm font-medium text-primary hover:underline" href={`/projects/teams/${team.id}`}>Open {p.isGroup ? team.name : "project"}</Link>
                  </> : p.isGroup ? <span className="text-sm text-muted-foreground">Waiting for your faculty to form teams.</span>
                    : <ActionButton url="/api/v1/projects/start" body={{ offeringId: o.id, projectId: p.id }}>Start project</ActionButton>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

async function StaffProjects({ user, sp }: { user: Awaited<ReturnType<typeof requireUser>>; sp: Record<string, string | undefined> }) {
  const offerings = await managedOfferings(user);
  const o = offerings.find((x) => x.id === sp.offering) ?? offerings[0];
  if (!o) return (<><PageHeader eyebrow="Laboratory" title="Projects" /><EmptyState title="No classes" description="You are not assigned to any class yet." /></>);
  const projects = await prisma.project.findMany({ where: { subjectId: o.subject.id }, include: { milestones: { orderBy: { order: "asc" } }, teams: { where: { offeringId: o.id }, orderBy: { name: "asc" }, include: { members: { include: { student: { select: { name: true } } }, orderBy: { isLeader: "desc" } }, _count: { select: { submissions: true } } } } } });
  const enrolled = await prisma.studentEnrollment.findMany({ where: { offeringId: o.id, status: "ACTIVE" }, select: { student: { select: { id: true, name: true, enrollmentNo: true } } }, orderBy: { student: { enrollmentNo: "asc" } } });
  return (
    <>
      <PageHeader eyebrow="Laboratory" title="Projects" description="Form teams, follow submissions and evaluate against the project rubric. Project marks feed the final result." />
      <form className="mb-4 flex flex-wrap gap-2">
        <Select name="offering" defaultValue={o.id} className="w-72" aria-label="Class">{offerings.map((x) => <option key={x.id} value={x.id}>{x.subject.name} · {x.batch.code}</option>)}</Select>
        <Button type="submit" variant="secondary">Show</Button>
      </form>
      {projects.length === 0 && <EmptyState title="No project defined" description="This laboratory has no project yet." />}
      {projects.map((p) => {
        const inTeam = new Set(p.teams.flatMap((t) => t.members.map((m) => m.studentId)));
        const free = enrolled.map((e) => e.student).filter((s) => !inTeam.has(s.id));
        const done = p.teams.filter((t) => t.status === "EVALUATED").length;
        return (
          <div key={p.id} className="grid gap-6 xl:grid-cols-[1fr_340px]">
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>{p.title}</CardTitle><CardDescription>{p.isGroup ? `Group, up to ${p.maxTeamSize} per team` : "Individual"} · {p.maxMarks} marks{p.dueDate ? ` · due ${fmtDate(p.dueDate)}` : ""} · {p.teams.length} team(s), {done} evaluated, {free.length} student(s) without a team</CardDescription></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>{p.problemStatement}</p>
                  {p.milestones.length > 0 && <p className="text-muted-foreground">Milestones: {p.milestones.map((m) => `${m.title}${m.dueDate ? ` (${fmtDate(m.dueDate)})` : ""}`).join(" → ")}</p>}
                </CardContent>
              </Card>
              <Card>
                {p.teams.length === 0 ? <div className="p-6"><EmptyState title="No teams yet" description="Create teams with the form beside this list." /></div> : (
                  <Table>
                    <THead><tr><TH>Team</TH><TH>Members</TH><TH className="text-right">Submissions</TH><TH>Status</TH><TH className="text-right">Marks</TH><TH /></tr></THead>
                    <TBody>{p.teams.map((t) => (
                      <TR key={t.id}>
                        <TD className="font-medium">{t.name}</TD>
                        <TD className="text-sm">{t.members.map((m) => m.student.name).join(", ")}</TD>
                        <TD className="text-right tabular-nums">{t._count.submissions}</TD>
                        <TD><S s={t.status} /></TD>
                        <TD className="text-right tabular-nums">{t.marks ?? "—"}</TD>
                        <TD className="text-right"><Link className="text-sm font-medium text-primary hover:underline" href={`/projects/teams/${t.id}`}>{t.status === "EVALUATED" ? "Open" : "Evaluate"}</Link></TD>
                      </TR>))}
                    </TBody>
                  </Table>
                )}
              </Card>
            </div>
            <Card className="h-fit">
              <CardHeader><CardTitle>Form a team</CardTitle></CardHeader>
              <CardContent><TeamForm offeringId={o.id} projectId={p.id} maxSize={p.maxTeamSize} students={free} nextName={`Team ${String.fromCharCode(65 + (p.teams.length % 26))}`} /></CardContent>
            </Card>
          </div>
        );
      })}
    </>
  );
}
