import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Card, Input, Button, Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui";
import { Pagination } from "@/components/common/pagination";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Audit logs" };
const PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(["SUPER_ADMIN", "HOD"]);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page || 1));
  const where: Prisma.AuditLogWhereInput = {};
  if (user.role === "HOD") where.actor = { departmentId: user.departmentId };
  if (sp.action) where.action = { contains: sp.action, mode: "insensitive" };
  if (sp.actor) where.actor = { ...(where.actor as object), OR: [{ name: { contains: sp.actor, mode: "insensitive" } }, { email: { contains: sp.actor, mode: "insensitive" } }] };
  if (sp.entity) where.OR = [{ entityType: { contains: sp.entity, mode: "insensitive" } }, { entityId: sp.entity }];
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { actor: { select: { name: true, email: true } } } }),
  ]);
  const short = (v: unknown) => { if (v == null) return ""; const s = JSON.stringify(v); return s.length > 140 ? s.slice(0, 140) + "…" : s; };
  return (
    <>
      <PageHeader eyebrow="Administration" title="Audit logs" description="Every mark override, result finalization, user change and setting change is recorded here. Entries cannot be edited." />
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="action" defaultValue={sp.action ?? ""} placeholder="Action (e.g. results, override)" className="w-56" aria-label="Action" />
        <Input name="actor" defaultValue={sp.actor ?? ""} placeholder="Actor name or email" className="w-56" aria-label="Actor" />
        <Input name="entity" defaultValue={sp.entity ?? ""} placeholder="Entity type or id" className="w-56" aria-label="Entity" />
        <Button type="submit" variant="secondary">Filter</Button>
      </form>
      <Card>
        {rows.length === 0 ? <div className="p-6"><EmptyState title="No entries" /></div> : (
          <Table>
            <THead><tr><TH>When</TH><TH>Actor</TH><TH>Action</TH><TH>Entity</TH><TH>Change / reason</TH></tr></THead>
            <TBody>{rows.map((a) => (
              <TR key={a.id}>
                <TD className="whitespace-nowrap text-sm">{fmtDateTime(a.createdAt)}</TD>
                <TD className="text-sm">{a.actor?.name ?? "System"}{a.ipAddress && <p className="text-xs text-muted-foreground">{a.ipAddress}</p>}</TD>
                <TD className="font-mono text-xs">{a.action}</TD>
                <TD className="text-xs">{a.entityType}{a.entityId && <p className="font-mono text-muted-foreground">{a.entityId.slice(0, 24)}</p>}</TD>
                <TD className="max-w-md text-xs">{a.reason && <p className="font-medium">“{a.reason}”</p>}{a.before != null && <p className="break-all text-muted-foreground">before: {short(a.before)}</p>}{a.after != null && <p className="break-all text-muted-foreground">after: {short(a.after)}</p>}</TD>
              </TR>))}
            </TBody>
          </Table>
        )}
      </Card>
      <Pagination page={page} pageSize={PAGE} total={total} params={sp} />
    </>
  );
}
