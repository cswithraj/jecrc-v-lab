import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent, Alert } from "@/components/ui";
import { PasswordForm } from "@/components/account/password-form";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Profile & settings" };
const ROLE = { SUPER_ADMIN: "Super administrator", HOD: "Head of department", FACULTY: "Faculty", STUDENT: "Student" } as const;

export default async function ProfilePage() {
  const user = await requireUser();
  const u = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { department: { select: { name: true } }, batch: { select: { name: true } }, sessions: { orderBy: { lastSeenAt: "desc" }, take: 5, select: { createdAt: true, lastSeenAt: true, userAgent: true, ipAddress: true } } } });
  const rows: [string, string | null | undefined][] = [
    ["Name", u.name], ["Email", u.email], ["Role", ROLE[u.role]], ["Department", u.department?.name],
    [u.role === "STUDENT" ? "Enrollment no." : "Employee ID", u.role === "STUDENT" ? u.enrollmentNo : u.employeeId],
    ...(u.role === "STUDENT" ? [["Batch", u.batch?.name] as [string, string | undefined]] : []),
    ...(u.extraTimeMinutes ? [["Extra exam time", `${u.extraTimeMinutes} minutes per practical`] as [string, string]] : []),
    ["Last sign-in", u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : null],
  ];
  return (
    <>
      <PageHeader eyebrow="Account" title="Profile & settings" description="Contact your department office to correct your name, enrollment number or batch." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Your details</CardTitle></CardHeader>
          <CardContent>
            <dl className="divide-y text-sm">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v || "—"}</dd></div>)}</dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Change password</CardTitle><CardDescription>Changing your password signs out your other devices.</CardDescription></CardHeader>
          <CardContent>
            {u.isDemo && <Alert tone="info" className="mb-3">This is a shared demo account, so its password cannot be changed.</Alert>}
            <PasswordForm disabled={u.isDemo} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Recent sign-ins</CardTitle><CardDescription>Active sessions on your account.</CardDescription></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {u.sessions.map((s, i) => <p key={i}><span className="font-medium">{s.userAgent?.replace(/\(.*?\)/g, "").slice(0, 80) || "Unknown browser"}</span> <span className="text-muted-foreground">· {s.ipAddress ?? "unknown IP"} · signed in {fmtDateTime(s.createdAt)} · last active {fmtDateTime(s.lastSeenAt)}</span></p>)}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
