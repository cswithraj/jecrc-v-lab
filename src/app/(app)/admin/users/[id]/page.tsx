import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent, Alert } from "@/components/ui";
import { EntityForm } from "@/components/common/entity-form";
import { ResetPasswordButton } from "@/components/admin/user-tools";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Edit user" };
const ROLE_LABEL = { SUPER_ADMIN: "Super admin", HOD: "HOD", FACULTY: "Faculty", STUDENT: "Student" } as const;

export default async function EditUser({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireUser(["SUPER_ADMIN", "HOD"]);
  const { id } = await params;
  const u = await prisma.user.findUnique({ where: { id }, include: { department: { select: { name: true } } } });
  if (!u || (actor.role === "HOD" && u.departmentId !== actor.departmentId)) notFound();
  const editable = actor.role === "SUPER_ADMIN" || ["FACULTY", "STUDENT"].includes(u.role);
  const [batches, departments, audits] = await Promise.all([
    prisma.batch.findMany({ select: { id: true, code: true }, orderBy: { code: "asc" } }),
    prisma.department.findMany({ select: { id: true, name: true } }),
    prisma.auditLog.findMany({ where: { entityType: "User", entityId: id }, orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { name: true } } } }),
  ]);
  const roles = actor.role === "SUPER_ADMIN" ? Object.keys(ROLE_LABEL) : ["STUDENT", "FACULTY"];
  return (
    <>
      <PageHeader eyebrow={<Link href="/admin/users" className="hover:underline">Users</Link>} title={u.name} description={`${u.email} · ${ROLE_LABEL[u.role]}${u.department ? ` · ${u.department.name}` : ""} · created ${fmtDateTime(u.createdAt)}`} />
      {u.isDemo && <Alert tone="info" className="mb-4">Demo account created by the seed script.</Alert>}
      {u.lockedUntil && u.lockedUntil > new Date() && <Alert tone="warning" className="mb-4">Locked after repeated failed sign-ins until {fmtDateTime(u.lockedUntil)}. Resetting the password unlocks it.</Alert>}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle><CardDescription>Changes are recorded in the audit log.</CardDescription></CardHeader>
          <CardContent>
            {!editable ? <p className="text-sm text-muted-foreground">Only a super administrator can edit this account.</p> : (
              <EntityForm url={`/api/v1/admin/users/${u.id}`} method="PATCH" initial={{ ...u, extraTimeMinutes: u.extraTimeMinutes || "" }} fields={[
                { name: "name", label: "Full name", required: true },
                { name: "role", label: "Role", type: "select", required: true, options: roles.map((r) => ({ value: r, label: ROLE_LABEL[r as keyof typeof ROLE_LABEL] })) },
                { name: "enrollmentNo", label: "Enrollment no." }, { name: "employeeId", label: "Employee ID" },
                { name: "batchId", label: "Batch", type: "select", options: batches.map((b) => ({ value: b.id, label: b.code })) },
                ...(actor.role === "SUPER_ADMIN" ? [{ name: "departmentId", label: "Department", type: "select" as const, options: departments.map((d) => ({ value: d.id, label: d.name })) }] : []),
                { name: "extraTimeMinutes", label: "Extra exam time (minutes)", type: "number", min: 0, max: 240, hint: "Accessibility accommodation added to every timed practical" },
                { name: "isActive", label: "Account active", type: "checkbox" },
              ]} />
            )}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card><CardHeader><CardTitle>Password</CardTitle></CardHeader><CardContent><ResetPasswordButton userId={u.id} disabled={!editable || u.id === actor.id} /></CardContent></Card>
          <Card>
            <CardHeader><CardTitle>History</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">{audits.length ? audits.map((a) => <p key={a.id}><span className="font-medium">{a.action}</span> <span className="text-muted-foreground">by {a.actor?.name ?? "system"} · {fmtDateTime(a.createdAt)}</span></p>) : <p className="text-muted-foreground">No changes recorded.</p>}</CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
