import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent, Table, THead, TBody, TR, TH, TD, Badge } from "@/components/ui";
import { EntityForm } from "@/components/common/entity-form";
import { ActionButton } from "@/components/common/action-button";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Academic structure" };

export default async function AcademicsPage() {
  const user = await requireUser(["SUPER_ADMIN", "HOD"]);
  const deptWhere = user.role === "HOD" ? { id: user.departmentId ?? "" } : {};
  const [departments, courses, sessions, batches, subjects, faculty, offerings] = await Promise.all([
    prisma.department.findMany({ where: deptWhere, include: { _count: { select: { courses: true, subjects: true, users: true } } }, orderBy: { name: "asc" } }),
    prisma.course.findMany({ where: user.role === "HOD" ? { departmentId: user.departmentId ?? "" } : {}, include: { department: { select: { code: true } }, _count: { select: { batches: true } } }, orderBy: { code: "asc" } }),
    prisma.academicSession.findMany({ orderBy: { startDate: "desc" }, include: { _count: { select: { offerings: true } } } }),
    prisma.batch.findMany({ include: { course: { select: { code: true } }, semester: { select: { number: true } }, academicSession: { select: { name: true } }, _count: { select: { students: true } } }, orderBy: { code: "asc" } }),
    prisma.subject.findMany({ where: user.role === "HOD" ? { departmentId: user.departmentId ?? "" } : {}, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: { in: ["FACULTY", "HOD"] }, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.subjectOffering.findMany({ where: user.role === "HOD" ? { subject: { departmentId: user.departmentId ?? "" } } : {}, include: { subject: { select: { name: true } }, batch: { select: { code: true } }, academicSession: { select: { name: true } }, _count: { select: { enrollments: true, sessions: true } } }, orderBy: [{ academicSession: { startDate: "desc" } }, { subject: { name: "asc" } }] }),
  ]);
  const facultyName = new Map(faculty.map((f) => [f.id, f.name]));
  const opt = <T extends { id: string }>(xs: T[], label: (x: T) => string) => xs.map((x) => ({ value: x.id, label: label(x) }));

  return (
    <>
      <PageHeader eyebrow="Administration" title="Academic structure" description="Departments, courses, academic sessions, batches and the classes that link a laboratory to a batch." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Departments & courses</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Table><THead><tr><TH>Code</TH><TH>Course</TH><TH>Dept.</TH><TH className="text-right">Semesters</TH><TH className="text-right">Batches</TH></tr></THead>
              <TBody>{courses.map((c) => <TR key={c.id}><TD className="font-medium">{c.code}</TD><TD>{c.name}</TD><TD>{c.department.code}</TD><TD className="text-right">{c.durationSem}</TD><TD className="text-right">{c._count.batches}</TD></TR>)}</TBody></Table>
            <p className="text-sm text-muted-foreground">{departments.map((d) => `${d.name} (${d.code}): ${d._count.users} users, ${d._count.subjects} labs`).join(" · ")}</p>
            <details><summary className="cursor-pointer text-sm font-medium">Add a course</summary><div className="mt-3"><EntityForm url="/api/v1/admin/academics/courses" submitLabel="Add course" resetOnSuccess fields={[
              { name: "code", label: "Code", required: true, placeholder: "BCA" }, { name: "name", label: "Name", required: true },
              { name: "durationSem", label: "Semesters", type: "number", required: true, min: 1, max: 12 }, { name: "departmentId", label: "Department", type: "select", required: true, options: opt(departments, (d) => d.name) },
            ]} /></div></details>
            {user.role === "SUPER_ADMIN" && <details><summary className="cursor-pointer text-sm font-medium">Add a department</summary><div className="mt-3"><EntityForm url="/api/v1/admin/academics/departments" submitLabel="Add department" resetOnSuccess fields={[{ name: "code", label: "Code", required: true }, { name: "name", label: "Name", required: true }]} /></div></details>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Academic sessions</CardTitle><CardDescription>The current session is the default for new classes.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <Table><THead><tr><TH>Session</TH><TH>Dates</TH><TH className="text-right">Classes</TH><TH /></tr></THead>
              <TBody>{sessions.map((s) => <TR key={s.id}><TD className="font-medium">{s.name} {s.isCurrent && <Badge variant="success">current</Badge>}</TD><TD className="text-sm">{fmtDate(s.startDate)} – {fmtDate(s.endDate)}</TD><TD className="text-right">{s._count.offerings}</TD><TD className="text-right">{!s.isCurrent && <ActionButton url={`/api/v1/admin/sessions/${s.id}/current`} size="sm" variant="ghost">Make current</ActionButton>}</TD></TR>)}</TBody></Table>
            <details><summary className="cursor-pointer text-sm font-medium">Add a session</summary><div className="mt-3"><EntityForm url="/api/v1/admin/academics/sessions" submitLabel="Add session" resetOnSuccess fields={[
              { name: "name", label: "Name", required: true, placeholder: "2027-28 Odd Semester", span: 2 }, { name: "startDate", label: "Starts", type: "date", required: true }, { name: "endDate", label: "Ends", type: "date", required: true }, { name: "isCurrent", label: "Make current", type: "checkbox" },
            ]} /></div></details>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Batches</CardTitle><CardDescription>A batch is a group of students who take labs together.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <Table><THead><tr><TH>Code</TH><TH>Name</TH><TH>Course · sem</TH><TH className="text-right">Students</TH></tr></THead>
              <TBody>{batches.map((b) => <TR key={b.id}><TD className="font-medium">{b.code}</TD><TD>{b.name}</TD><TD>{b.course.code}{b.semester ? ` · ${b.semester.number}` : ""}</TD><TD className="text-right">{b._count.students}</TD></TR>)}</TBody></Table>
            <details><summary className="cursor-pointer text-sm font-medium">Add a batch</summary><div className="mt-3"><EntityForm url="/api/v1/admin/academics/batches" submitLabel="Add batch" resetOnSuccess fields={[
              { name: "code", label: "Code", required: true, placeholder: "BCA-2026-B" }, { name: "name", label: "Name", required: true },
              { name: "courseId", label: "Course", type: "select", required: true, options: opt(courses, (c) => c.code) }, { name: "semesterNumber", label: "Semester", type: "number", min: 1, max: 12 },
              { name: "academicSessionId", label: "Academic session", type: "select", required: true, options: opt(sessions, (s) => s.name) },
            ]} /></div></details>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Classes</CardTitle><CardDescription>Laboratory × batch × session, with the teaching faculty.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <Table><THead><tr><TH>Laboratory</TH><TH>Batch</TH><TH>Faculty</TH><TH className="text-right">Students</TH></tr></THead>
              <TBody>{offerings.map((o) => <TR key={o.id}><TD className="font-medium">{o.subject.name}<p className="text-xs font-normal text-muted-foreground">{o.academicSession.name}</p></TD><TD>{o.batch.code}</TD><TD className="text-sm">{o.facultyId ? facultyName.get(o.facultyId) ?? "—" : "—"}</TD><TD className="text-right">{o._count.enrollments}</TD></TR>)}</TBody></Table>
            <details><summary className="cursor-pointer text-sm font-medium">Create a class</summary><div className="mt-3"><EntityForm url="/api/v1/admin/offerings" submitLabel="Create class" successText="Class created; {enrolled} student(s) enrolled." resetOnSuccess initial={{ enrollBatch: true, academicSessionId: sessions.find((s) => s.isCurrent)?.id ?? "" }} fields={[
              { name: "subjectId", label: "Laboratory", type: "select", required: true, options: opt(subjects, (s) => s.name) }, { name: "batchId", label: "Batch", type: "select", required: true, options: opt(batches, (b) => b.code) },
              { name: "academicSessionId", label: "Academic session", type: "select", required: true, options: opt(sessions, (s) => s.name) }, { name: "facultyId", label: "Faculty", type: "select", options: opt(faculty, (f) => f.name) },
              { name: "requiredExperiments", label: "Required practicals (override)", type: "number", min: 1, max: 120, hint: "Leave empty to use the laboratory's credits × 15" }, { name: "enrollBatch", label: "Enroll every student in the batch", type: "checkbox" },
            ]} /></div></details>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
