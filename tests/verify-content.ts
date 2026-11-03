// Assessment-accuracy check: every published experiment's reference solution must pass
// all of its own test cases on the real execution backend. Run with the runner up.
import { PrismaClient } from "@prisma/client";
import { runnerProvider } from "../src/lib/execution/runner";
import { gradeRuns } from "../src/lib/evaluation";

const prisma = new PrismaClient();
(async () => {
  const exps = await prisma.experiment.findMany({ where: { status: "PUBLISHED", referenceCode: { not: null }, testCases: { some: {} } }, include: { testCases: { orderBy: { order: "asc" } }, subject: true } });
  let bad = 0;
  for (const e of exps) {
    const res = await runnerProvider.execute({ language: e.language, source: e.referenceCode!, inputs: e.testCases.map((t) => t.input), timeLimitMs: e.timeLimitMs, memoryLimitKb: e.memoryLimitKb });
    const g = gradeRuns(e.testCases.map((t) => ({ id: t.id, input: t.input, expected: t.expected, weight: t.weight, isHidden: t.isHidden, compareMode: t.compareMode })), res);
    const ok = g.verdict === "ACCEPTED";
    if (!ok) {
      bad++;
      console.log(`FAIL ${e.code} ${e.title} → ${g.verdict} ${g.compileOutput.slice(0, 300)}`);
      g.tests.filter((t) => !t.passed).forEach((t) => console.log(`   in=${JSON.stringify(t.input)} expected=${JSON.stringify(t.expected)} got=${JSON.stringify(t.stdout)} ${t.stderr.slice(0, 200)}`));
    } else console.log(`ok   ${e.code} (${g.testsTotal} tests)`);
  }
  console.log(`\n${exps.length - bad}/${exps.length} reference solutions pass all their test cases`);
  await prisma.$disconnect();
  process.exit(bad ? 1 : 0);
})();
