import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent, StatCard, Badge, LinkButton } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Admin dashboard" };
export const dynamic = "force-dynamic";

async function runnerHealth(): Promise<{ ok: boolean; detail: string }> {
  if ((process.env.EXECUTION_PROVIDER || "runner") !== "runner") return { ok: true, detail: `provider: ${process.env.EXECUTION_PROVIDER}` };
  const url = process.env.RUNNER_URL;
  if (!url) return { ok: false, detail: "RUNNER_URL not set" };
  try {
    const r = await fetch(`${url.replace(/\/$/, "")}/health`, { cache: "no-store", signal: AbortSignal.timeout(2500) });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, detail: r.ok ? `${d.active ?? 0} running · ${d.queued ?? 0} queued` : `HTTP ${r.status}` };
  } catch { return { ok: false, detail: "unreachable" }; }
}

export default async function AdminDashboard() {
  const user = await requireUser(["SUPER_ADMIN", "HOD"]);
  const dept = user.role === "HOD" ? { departmentId: user.departmentId ?? "" } : {};
  const since = new Date(Date.now() - 24 * 3600_000);
  const [roles, subjects, offerings, exps, subs24, live, audits, health, locked] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], where: { isActive: true, ...dept }, _count: true }),
    prisma.subject.count({ where: { isActive: true, ...dept } }),
    prisma.subjectOffering.count({ where: user.role === "HOD" ? { subject: dept } : {} }),
    prisma.experiment.groupBy({ by: ["status"], where: user.role === "HOD" ? { subject: dept } : {}, _count: true }),
    prisma.submission.count({ where: { submittedAt: { gte: since } } }),
    prisma.practicalSession.findMany({ where: { status: "LIVE" }, include: { offering: { include: { subject: { select: { shortName: true } }, batch: { select: { code: true } } } }, _count: { select: { attendance: true, submissions: true } } } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: { select: { name: true } } } }),
    runnerHealth(),
    prisma.user.count({ where: { lockedUntil: { gt: new Date() } } }),
  ]);
  const r = (k: string) => roles.find((x) => x.role === k)?._count ?? 0;
  const e = (k: string) => exps.find((x) => x.status === k)?._count ?? 0;
  return (
    <>
      <PageHeader eyebrow={user.role === "HOD" ? "Head of department" : "Administration"} title="Admin dashboard" description={user.role === "HOD" ? "Figures for your department." : "Platform-wide figures."}
        actions={<><LinkButton href="/admin/users" variant="outline">Manage users</LinkButton><LinkButton href="/admin/subjects">Laboratories & credits</LinkButton></>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students" value={r("STUDENT")} hint={`${r("FACULTY")} faculty · ${r("HOD")} HOD · ${r("SUPER_ADMIN")} admin`} />
        <StatCard label="Laboratories" value={subjects} hint={`${offerings} classes`} />
        <StatCard label="Experiments" value={e("PUBLISHED")} hint={`published · ${e("DRAFT")} draft · ${e("ARCHIVED")} archived`} />
        <StatCard label="Submissions (24 h)" value={subs24} hint={locked ? `${locked} account(s) locked out` : "No locked accounts"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>System status</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex justify-between"><span>Code execution service</span><span className="flex items-center gap-2"><span className="text-muted-foreground">{health.detail}</span><Badge variant={health.ok ? "success" : "destructive"}>{health.ok ? "online" : "offline"}</Badge></span></p>
            <p className="flex justify-between"><span>Database</span><Badge variant="success">online</Badge></p>
            <p className="flex justify-between"><span>Live practicals</span><span className="tabular-nums">{live.length}</span></p>
            {live.map((s) => <p key={s.id} className="flex justify-between pl-3 text-muted-foreground"><Link className="hover:underline" href={`/practicals/${s.id}`}>{s.offering.subject.shortName} · {s.offering.batch.code} #{s.sequence}</Link><span>{s._count.attendance} joined · {s._count.submissions} submitted</span></p>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent activity</CardTitle><CardDescription><Link className="text-primary hover:underline" href="/admin/audit">Full audit log</Link></CardDescription></CardHeader>
          <CardContent className="space-y-1.5 text-sm">{audits.map((a) => <p key={a.id} className="flex justify-between gap-3"><span className="truncate"><span className="font-medium">{a.actor?.name ?? "System"}</span> · {a.action}</span><span className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(a.createdAt)}</span></p>)}</CardContent>
        </Card>
      </div>
    </>
  );
}
