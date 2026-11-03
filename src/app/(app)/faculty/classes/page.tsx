import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { managedOfferings } from "@/lib/services/offerings";
import { Card, PageHeader, Badge, EmptyState, Progress } from "@/components/ui";
import { SubjectIcon } from "@/components/labs/subject-icon";

export const metadata = { title: "My classes" };

export default async function ClassesPage() {
  const user = await requireUser(["FACULTY", "HOD", "SUPER_ADMIN"]);
  const offerings = await managedOfferings(user);
  const ended = await prisma.practicalSession.groupBy({ by: ["offeringId"], where: { offeringId: { in: offerings.map((o) => o.id) }, status: "ENDED" }, _count: true });
  const held = new Map(ended.map((e) => [e.offeringId, e._count]));
  return (
    <>
      <PageHeader eyebrow="Teaching" title="My classes" description="Each class is one laboratory taught to one batch in an academic session." />
      {offerings.length === 0 ? <EmptyState title="No classes assigned" description="An administrator assigns classes under Laboratories & credits." /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {offerings.map((o) => {
            const req = o.requiredExperiments ?? o.subject.requiredExperiments;
            const h = held.get(o.id) ?? 0;
            return (
              <Link key={o.id} href={`/faculty/classes/${o.id}`} className="group">
                <Card className="h-full p-5 transition-colors group-hover:border-primary/50">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-white" style={{ background: o.subject.color }}><SubjectIcon name={o.subject.icon} className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-tight">{o.subject.name}</p>
                      <p className="text-sm text-muted-foreground">{o.batch.name}</p>
                    </div>
                    {o.resultsFinalized && <Badge variant="success">results final</Badge>}
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">{o.academicSession.name} · {o.subject.credits} credit(s) · {o._count.enrollments} students</p>
                  <div className="mt-3 flex items-center gap-3"><Progress value={(h / Math.max(1, req)) * 100} className="flex-1" /><span className="text-xs tabular-nums text-muted-foreground">{h}/{req} held</span></div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
