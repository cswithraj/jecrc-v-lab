import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent, Table, THead, TBody, TR, TH, TD, Badge } from "@/components/ui";
import { EntityForm } from "@/components/common/entity-form";
import { LANGUAGE_META } from "@/lib/languages";

export const metadata = { title: "Laboratories & credits" };

export default async function SubjectsAdmin() {
  const user = await requireUser(["SUPER_ADMIN", "HOD"]);
  const where = user.role === "HOD" ? { departmentId: user.departmentId ?? "" } : {};
  const [subjects, counts, departments] = await Promise.all([
    prisma.subject.findMany({ where, orderBy: { name: "asc" }, include: { faculty: { include: { user: { select: { name: true } } } }, _count: { select: { offerings: true } } } }),
    prisma.experiment.groupBy({ by: ["subjectId", "status"], _count: true }),
    prisma.department.findMany({ where: user.role === "HOD" ? { id: user.departmentId ?? "" } : {}, select: { id: true, name: true } }),
  ]);
  const c = (id: string, st: string) => counts.find((x) => x.subjectId === id && x.status === st)?._count ?? 0;
  return (
    <>
      <PageHeader eyebrow="Administration" title="Laboratories & credits" description="Credit rule: 1 credit = 15 practicals, 2 credits = 30. Labs run 4 hours a week as two 2-hour sessions, one experiment per session. Required practicals can be overridden per laboratory or per class." />
      <Card className="mb-6">
        <Table>
          <THead><tr><TH>Laboratory</TH><TH className="text-right">Credits</TH><TH className="text-right">Required</TH><TH className="text-right">Published</TH><TH className="text-right">Draft</TH><TH>Faculty</TH><TH className="text-right">Classes</TH><TH /></tr></THead>
          <TBody>{subjects.map((s) => (
            <TR key={s.id}>
              <TD><p className="font-medium">{s.name} {!s.isActive && <Badge variant="secondary">inactive</Badge>}</p><p className="text-xs text-muted-foreground">{s.code} · {LANGUAGE_META[s.defaultLanguage]?.label}</p></TD>
              <TD className="text-right tabular-nums">{s.credits}</TD>
              <TD className="text-right tabular-nums">{s.requiredExperiments}{s.requiredExperiments !== s.credits * 15 && <span className="text-xs text-warning"> (override)</span>}</TD>
              <TD className="text-right tabular-nums">{c(s.id, "PUBLISHED")}</TD>
              <TD className="text-right tabular-nums">{c(s.id, "DRAFT")}</TD>
              <TD className="text-sm">{s.faculty.map((f) => f.user.name).join(", ") || "—"}</TD>
              <TD className="text-right tabular-nums">{s._count.offerings}</TD>
              <TD className="text-right"><Link className="text-sm font-medium text-primary hover:underline" href={`/admin/subjects/${s.id}`}>Configure</Link></TD>
            </TR>))}
          </TBody>
        </Table>
      </Card>
      <Card>
        <CardHeader><CardTitle>Add a laboratory</CardTitle><CardDescription>Required practicals start at credits × 15.</CardDescription></CardHeader>
        <CardContent>
          <EntityForm url="/api/v1/admin/subjects" submitLabel="Add laboratory" resetOnSuccess columns={3} initial={{ credits: 1, defaultLanguage: "C", defaultEnvironment: "CODE", color: "#C00010" }} fields={[
            { name: "code", label: "Code", required: true, placeholder: "CA-RUST-LAB" }, { name: "name", label: "Name", required: true }, { name: "shortName", label: "Short name", required: true },
            { name: "departmentId", label: "Department", type: "select", required: true, options: departments.map((d) => ({ value: d.id, label: d.name })) },
            { name: "credits", label: "Credits", type: "select", required: true, options: [1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n} (${n * 15} practicals)` })) },
            { name: "defaultLanguage", label: "Default language", type: "select", required: true, options: Object.values(LANGUAGE_META).map((l) => ({ value: l.id, label: l.label })) },
            { name: "defaultEnvironment", label: "Environment", type: "select", required: true, options: ["CODE", "WEB", "SQL", "SHELL", "NETWORK", "DSA_VISUAL", "NOTEBOOK", "ANDROID", "WRITTEN"].map((e) => ({ value: e, label: e.replace("_", " ").toLowerCase() })) },
            { name: "color", label: "Colour", type: "color" },
            { name: "description", label: "Description", type: "textarea", span: 3 },
          ]} />
        </CardContent>
      </Card>
    </>
  );
}
