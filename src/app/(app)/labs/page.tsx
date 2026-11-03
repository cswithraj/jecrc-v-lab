import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { visibleSubjectIds, isStaff } from "@/lib/rbac";
import { Card, PageHeader, Badge, Input } from "@/components/ui";
import { SubjectIcon } from "@/components/labs/subject-icon";

export const metadata = { title: "All laboratories" };

export default async function LabsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q } = await searchParams;
  const mine = await visibleSubjectIds(user);
  const subjects = await prisma.subject.findMany({
    where: { isActive: true, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] } : {}) },
    orderBy: { name: "asc" },
    include: { _count: { select: { experiments: { where: { status: "PUBLISHED" } } } }, experiments: { where: { status: "DRAFT" }, select: { id: true } } },
  });
  return (
    <>
      <PageHeader eyebrow="Laboratory" title="All laboratories" description="Each laboratory has its own experiment collection, credit allocation and final project." />
      <form className="mb-6 max-w-sm"><Input name="q" defaultValue={q} placeholder="Search laboratories…" aria-label="Search laboratories" /></form>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {subjects.map((s) => {
          const assigned = mine === "ALL" || mine.includes(s.id);
          return (
            <Link key={s.id} href={`/labs/${s.slug}`} className="group">
              <Card className="h-full p-5 transition-shadow group-hover:shadow-md">
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-white" style={{ background: s.color }}><SubjectIcon name={s.icon} className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <h2 className="font-semibold leading-tight group-hover:text-primary">{s.name}</h2>
                    <p className="text-xs text-muted-foreground">{s.code}</p>
                  </div>
                </div>
                <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{s.description}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{s.credits} credit{s.credits > 1 ? "s" : ""} · {s.requiredExperiments} practicals</Badge>
                  <Badge variant="outline">{s._count.experiments} published</Badge>
                  {isStaff(user) && s.experiments.length > 0 && <Badge variant="warning">{s.experiments.length} drafts</Badge>}
                  {assigned && user.role !== "SUPER_ADMIN" && <Badge>{user.role === "STUDENT" ? "Enrolled" : "Assigned"}</Badge>}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
