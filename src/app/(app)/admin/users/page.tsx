import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Card, CardHeader, CardTitle, CardContent, Select, Input, Button, Table, THead, TBody, TR, TH, TD, Badge, EmptyState } from "@/components/ui";
import { Pagination } from "@/components/common/pagination";
import { EntityForm } from "@/components/common/entity-form";
import { UserImport } from "@/components/admin/user-tools";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Users" };
const PAGE = 30;
const ROLE_LABEL = { SUPER_ADMIN: "Super admin", HOD: "HOD", FACULTY: "Faculty", STUDENT: "Student" } as const;

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(["SUPER_ADMIN", "HOD"]);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page || 1));
  const where: Prisma.UserWhereInput = {};
  if (user.role === "HOD") where.departmentId = user.departmentId;
  if (sp.role) where.role = sp.role as never;
  if (sp.status === "inactive") where.isActive = false;
  if (sp.q) where.OR = (["name", "email", "enrollmentNo", "employeeId"] as const).map((k) => ({ [k]: { contains: sp.q, mode: "insensitive" } }));
  const [total, rows, departments, batches] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, skip: (page - 1) * PAGE, take: PAGE, orderBy: [{ role: "asc" }, { name: "asc" }], select: { id: true, name: true, email: true, role: true, enrollmentNo: true, employeeId: true, isActive: true, isDemo: true, lastLoginAt: true, batch: { select: { code: true } } } }),
    prisma.department.findMany({ select: { id: true, name: true } }),
    prisma.batch.findMany({ select: { id: true, code: true }, orderBy: { code: "asc" } }),
  ]);
  const roles = user.role === "SUPER_ADMIN" ? ["STUDENT", "FACULTY", "HOD", "SUPER_ADMIN"] : ["STUDENT", "FACULTY"];
  return (
    <>
      <PageHeader eyebrow="Administration" title="Users" description={user.role === "HOD" ? "Faculty and students in your department." : "All accounts on the platform."} />
      <form className="mb-4 flex flex-wrap gap-2">
        <Select name="role" defaultValue={sp.role ?? ""} className="w-40" aria-label="Role"><option value="">All roles</option>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select name="status" defaultValue={sp.status ?? ""} className="w-36" aria-label="Status"><option value="">Any status</option><option value="inactive">Deactivated</option></Select>
        <Input name="q" defaultValue={sp.q ?? ""} placeholder="Name, email or ID" className="w-60" aria-label="Search" />
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      <Card>
        {rows.length === 0 ? <div className="p-6"><EmptyState title="No users found" /></div> : (
          <Table>
            <THead><tr><TH>Name</TH><TH>Email</TH><TH>Role</TH><TH>ID</TH><TH>Last sign-in</TH><TH /></tr></THead>
            <TBody>{rows.map((u) => (
              <TR key={u.id}>
                <TD className="font-medium">{u.name} {!u.isActive && <Badge variant="destructive">deactivated</Badge>}</TD>
                <TD className="text-sm">{u.email}</TD>
                <TD><Badge variant="secondary">{ROLE_LABEL[u.role]}</Badge></TD>
                <TD className="text-sm tabular-nums">{u.enrollmentNo ?? u.employeeId ?? "—"}{u.batch && <span className="text-muted-foreground"> · {u.batch.code}</span>}</TD>
                <TD className="text-sm">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "never"}</TD>
                <TD className="text-right"><Link className="text-sm font-medium text-primary hover:underline" href={`/admin/users/${u.id}`}>Edit</Link></TD>
              </TR>))}
            </TBody>
          </Table>
        )}
      </Card>
      <Pagination page={page} pageSize={PAGE} total={total} params={sp} />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Add a user</CardTitle></CardHeader>
          <CardContent>
            <EntityForm url="/api/v1/admin/users" submitLabel="Create account" successText="{message}" resetOnSuccess fields={[
              { name: "name", label: "Full name", required: true }, { name: "email", label: "Email", type: "email", required: true },
              { name: "role", label: "Role", type: "select", required: true, options: roles.map((r) => ({ value: r, label: ROLE_LABEL[r as keyof typeof ROLE_LABEL] })) },
              { name: "enrollmentNo", label: "Enrollment no. (students)" }, { name: "employeeId", label: "Employee ID (staff)" },
              { name: "batchId", label: "Batch (students)", type: "select", options: batches.map((b) => ({ value: b.id, label: b.code })) },
              ...(user.role === "SUPER_ADMIN" ? [{ name: "departmentId", label: "Department", type: "select" as const, options: departments.map((d) => ({ value: d.id, label: d.name })) }] : []),
              { name: "password", label: "Password (optional)", type: "password", hint: "Leave empty to generate a temporary password" },
            ]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Import users from CSV</CardTitle></CardHeader>
          <CardContent><UserImport /></CardContent>
        </Card>
      </div>
    </>
  );
}
