import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CodeWorkspace } from "@/components/editor/workspace";
import type { Language } from "@prisma/client";

export const metadata = { title: "Online compiler" };
const LANGS: Language[] = ["C", "CPP", "JAVA", "PYTHON", "JAVASCRIPT", "SQL", "SHELL", "HTML"];

export default async function CompilerPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader eyebrow="Online compiler" title="Code playground" description="Write, compile and run programs in an isolated sandbox. HTML runs in a sandboxed browser preview. Playground code is not graded." />
      <CodeWorkspace languages={LANGS} initial={{}} starter={{}} isStudent={user.role === "STUDENT"} height="480px" />
      <p className="mt-3 text-xs text-muted-foreground">Limits: 2 s CPU time, 128 MB memory, 64 KB output, no network access. Java code must use <code>public class Main</code>.</p>
    </>
  );
}
