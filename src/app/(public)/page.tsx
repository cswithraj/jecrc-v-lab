import Link from "next/link";
import { ArrowRight, BookOpenCheck, Code2, Timer, Gauge, Trophy, ShieldCheck, Workflow, Mail, Phone, MapPin } from "lucide-react";
import { prisma } from "@/lib/db";
import { getInstitution } from "@/lib/settings";
import { getCurrentUser, HOME_FOR_ROLE } from "@/lib/auth";
import { UniversityLogo, BrandMark } from "@/components/shell/brand";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { LinkButton, Card } from "@/components/ui";
import { SubjectIcon } from "@/components/labs/subject-icon";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const [inst, user, subjects, stats] = await Promise.all([
    getInstitution(),
    getCurrentUser(),
    prisma.subject.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { slug: true, name: true, description: true, icon: true, color: true, credits: true, _count: { select: { experiments: { where: { status: "PUBLISHED" } } } } } }),
    Promise.all([
      prisma.subject.count({ where: { isActive: true } }),
      prisma.experiment.count({ where: { status: "PUBLISHED" } }),
      prisma.experiment.count(),
      prisma.user.count({ where: { role: "STUDENT", isActive: true } }),
      prisma.submission.count(),
    ]),
  ]);
  const [labCount, publishedCount, catalogCount, studentCount, submissionCount] = stats;
  const home = user ? HOME_FOR_ROLE[user.role] : "/login";

  const steps = [
    { icon: BookOpenCheck, title: "Learn the concept", text: "Read theory, objectives, algorithm, pseudocode and flowchart for each experiment." },
    { icon: Code2, title: "Write and run code", text: "Use the in-browser editor to compile and run C, C++, Java, Python, JavaScript, SQL and shell." },
    { icon: Timer, title: "Attend the practical", text: "Faculty start a timed 2-hour session; your work autosaves and the timer is kept by the server." },
    { icon: Gauge, title: "Get evaluated", text: "Hidden test cases score correctness automatically; faculty assess logic, quality and viva." },
    { icon: Trophy, title: "Track results", text: "See progress against your credits, marks, attendance, project status and rank." },
  ];
  const benefits = [
    { icon: Workflow, title: "Credit-aware tracking", text: "1 credit = 15 practicals, 2 credits = 30. Completion and pending work are calculated automatically." },
    { icon: ShieldCheck, title: "Secure execution", text: "Student code runs in an isolated sandbox with time, memory, output and network limits." },
    { icon: Gauge, title: "Transparent marking", text: "Every mark has a breakdown. Overrides require a reason and are recorded in the audit log." },
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <BrandMark inst={inst} />
          <nav className="flex items-center gap-1 text-sm" aria-label="Primary">
            <a href="#labs" className="hidden rounded-md px-3 py-2 hover:bg-muted sm:block">Laboratories</a>
            <a href="#how" className="hidden rounded-md px-3 py-2 hover:bg-muted sm:block">How it works</a>
            <a href="#contact" className="hidden rounded-md px-3 py-2 hover:bg-muted md:block">Contact</a>
            <ThemeToggle />
            <LinkButton href={home} size="sm">{user ? "Open dashboard" : "Sign in"}</LinkButton>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-primary" />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">{inst.department}</p>
            <h1 className="mt-3 font-display text-4xl font-bold leading-[1.05] sm:text-6xl">{inst.platformName}</h1>
            <p className="mt-4 text-xl text-muted-foreground">{inst.tagline}</p>
            <p className="mt-6 max-w-xl text-[15px] leading-7 text-foreground/80">
              A virtual laboratory where students learn concepts, visualise logic, write and execute programs, complete timed practical
              examinations and final projects — and where faculty schedule, evaluate and publish results in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href={user ? home : "/login"} size="lg">Student login <ArrowRight className="h-4 w-4" /></LinkButton>
              <LinkButton href={user ? home : "/login"} size="lg" variant="outline">Faculty login</LinkButton>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <Card className="w-full max-w-md p-8">
              <UniversityLogo inst={inst} className="mx-auto h-28 w-auto" />
              <dl className="mt-8 grid grid-cols-2 gap-4 text-center">
                {[[labCount, "Laboratories"], [publishedCount, "Published experiments"], [catalogCount, "Experiments in catalogue"], [studentCount, "Registered students"]].map(([v, l]) => (
                  <div key={l as string} className="rounded-md bg-muted/60 p-3">
                    <dt className="text-xs text-muted-foreground">{l}</dt>
                    <dd className="text-2xl font-semibold tabular-nums">{(v as number).toLocaleString("en-IN")}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-center text-xs text-muted-foreground">{submissionCount.toLocaleString("en-IN")} practical submissions evaluated · live figures</p>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-3xl font-semibold">What is a virtual lab?</h2>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          A virtual laboratory brings the computer lab to any browser. Every experiment follows the same academic format — objectives, theory,
          problem statement, algorithm, pseudocode, flowchart, code, input/output, test cases, result and viva — so learning and assessment stay consistent across subjects.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {benefits.map((b) => (
            <Card key={b.title} className="p-5">
              <b.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{b.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{b.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section id="labs" className="border-y bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-3xl font-semibold">Laboratories</h2>
          <p className="mt-2 text-muted-foreground">{labCount} subject laboratories, each with its own experiment collection and final project.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((s) => (
              <Card key={s.slug} className="flex gap-4 p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-white" style={{ background: s.color }}><SubjectIcon name={s.icon} className="h-5 w-5" /></span>
                <div>
                  <h3 className="font-semibold leading-tight">{s.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{s.credits} credit{s.credits > 1 ? "s" : ""} · {s._count.experiments} published experiments</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-3xl font-semibold">How it works</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-5">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-lg border bg-card p-5">
              <span className="text-xs font-semibold text-primary">Step {i + 1}</span>
              <s.icon className="mt-2 h-6 w-6" />
              <h3 className="mt-2 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer id="contact" className="bg-secondary text-secondary-foreground">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          <div>
            <p className="font-display text-2xl font-bold">{inst.shortName}</p>
            <p className="mt-2 text-sm opacity-70">{inst.university}, {inst.city}</p>
            <p className="mt-1 text-sm opacity-70">{inst.department}</p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold">Contact &amp; support</p>
            <p className="flex items-center gap-2 opacity-80"><Mail className="h-4 w-4" /> {inst.supportEmail}</p>
            <p className="flex items-center gap-2 opacity-80"><Phone className="h-4 w-4" /> {inst.supportPhone}</p>
            <p className="flex items-center gap-2 opacity-80"><MapPin className="h-4 w-4" /> {inst.city}</p>
          </div>
          <div className="text-sm">
            <p className="font-semibold">Project</p>
            <p className="mt-2 opacity-80">{inst.projectOwner}</p>
            <p className="opacity-60">{inst.projectOwnerTitle}</p>
            <p className="mt-4 text-xs uppercase tracking-[0.25em] text-primary">{inst.motto}</p>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs opacity-60">© {new Date().getFullYear()} {inst.university}. Academic year {inst.academicYear}.</div>
      </footer>
    </div>
  );
}
