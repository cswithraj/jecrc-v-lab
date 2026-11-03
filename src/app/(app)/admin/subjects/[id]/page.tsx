import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui";
import { EntityForm } from "@/components/common/entity-form";
import { FacultyPicker } from "@/components/admin/faculty-picker";

export const metadata = { title: "Configure laboratory" };

export default async function SubjectConfig({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["SUPER_ADMIN", "HOD"]);
  const { id } = await params;
  const s = await prisma.subject.findUnique({ where: { id }, include: { faculty: { orderBy: { isCoordinator: "desc" } } } });
  if (!s || (user.role === "HOD" && s.departmentId !== user.departmentId)) notFound();
  const [faculty, byLevel] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: ["FACULTY", "HOD"] }, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.experiment.groupBy({ by: ["difficulty"], where: { subjectId: id, status: "PUBLISHED" }, _count: true }),
  ]);
  const n = (d: string) => byLevel.find((x) => x.difficulty === d)?._count ?? 0;
  return (
    <>
      <PageHeader eyebrow={<Link href="/admin/subjects" className="hover:underline">Laboratories & credits</Link>} title={s.name} description={`${s.code} · published: ${n("EASY")} easy, ${n("MEDIUM")} medium, ${n("HARD")} hard`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader><CardTitle>Credits and practicals</CardTitle><CardDescription>Changing credits resets required practicals to credits × 15 unless you also enter a number below.</CardDescription></CardHeader>
          <CardContent>
            <EntityForm url={`/api/v1/admin/subjects/${s.id}`} method="PATCH" initial={{ ...s, requiredExperiments: "" }} fields={[
              { name: "name", label: "Name", required: true, span: 2 },
              { name: "credits", label: "Credits", type: "number", required: true, min: 1, max: 4 },
              { name: "requiredExperiments", label: `Required practicals (now ${s.requiredExperiments})`, type: "number", min: 1, max: 120, hint: "Leave empty to keep the current value or apply the credit rule" },
              { name: "hoursPerWeek", label: "Hours per week", type: "number", min: 1, max: 12 }, { name: "sessionMinutes", label: "Session length (minutes)", type: "number", min: 30, max: 360 },
              { name: "easyTarget", label: "Easy experiments target", type: "number", min: 0 }, { name: "mediumTarget", label: "Medium target", type: "number", min: 0 }, { name: "hardTarget", label: "Hard target", type: "number", min: 0 },
              { name: "isActive", label: "Laboratory active", type: "checkbox" },
            ]} />
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader><CardTitle>Faculty</CardTitle><CardDescription>Assigned faculty can edit this laboratory&apos;s experiments. The first one ticked is the coordinator.</CardDescription></CardHeader>
          <CardContent><FacultyPicker subjectId={s.id} faculty={faculty} assigned={s.faculty.map((f) => f.userId)} /></CardContent>
        </Card>
      </div>
    </>
  );
}
