import "server-only";
import type { Language, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getExecutionProvider } from "@/lib/execution";
import { LANGUAGE_META } from "@/lib/languages";
import { ApiError, badRequest, forbidden, notFound } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";
import { gradeRuns, autoComponentMarks, totals, redactForStudent, DEFAULT_RUBRIC, type Rubric, type TestSpec } from "@/lib/evaluation";
import { canSubmit, personalDeadline } from "@/lib/timer";
import { isStaff } from "@/lib/rbac";
import { getExamRules } from "@/lib/settings";
import { rateLimit } from "@/lib/api";

const toSpec = (t: { id: string; input: string; expected: string; weight: number; isHidden: boolean; compareMode: string }): TestSpec => ({ id: t.id, input: t.input, expected: t.expected, weight: t.weight, isHidden: t.isHidden, compareMode: t.compareMode });

async function loadExperiment(experimentId: string, user: SessionUser) {
  const exp = await prisma.experiment.findUnique({ where: { id: experimentId }, include: { subject: { select: { languages: true, id: true } }, testCases: { orderBy: { order: "asc" } } } });
  if (!exp) throw notFound("Experiment not found.");
  if (exp.status !== "PUBLISHED" && !isStaff(user)) throw notFound("Experiment not found.");
  return exp;
}

function assertLanguage(lang: Language, allowed: Language[]) {
  if (!allowed.includes(lang)) throw badRequest(`Language ${LANGUAGE_META[lang].label} is not enabled for this experiment.`);
}

async function guardRate(user: SessionUser) {
  const rules = await getExamRules();
  rateLimit(`run:${user.id}`, rules.maxRunsPerMinute, 60_000);
}

/** Free run with custom stdin (compiler page or experiment workspace). */
export async function runCustom(user: SessionUser, input: { language: Language; code: string; stdin: string; experimentId?: string }) {
  if (!LANGUAGE_META[input.language].executable) throw badRequest("This language runs in the browser preview, not on the server.");
  await guardRate(user);
  let limits = { timeLimitMs: 2000, memoryLimitKb: 131072 };
  if (input.experimentId) {
    const exp = await loadExperiment(input.experimentId, user);
    assertLanguage(input.language, [exp.language, ...exp.subject.languages]);
    limits = { timeLimitMs: exp.timeLimitMs, memoryLimitKb: exp.memoryLimitKb };
  }
  const res = await getExecutionProvider().execute({ language: input.language, source: input.code, inputs: [input.stdin], ...limits });
  const run = res.runs[0];
  if (input.experimentId && user.role === "STUDENT") {
    await prisma.submissionAttempt.create({ data: {
      studentId: user.id, experimentId: input.experimentId, kind: "RUN", language: input.language, code: input.code, stdin: input.stdin.slice(0, 10000),
      verdict: !res.compile.ok ? "COMPILATION_ERROR" : run?.status === "OK" ? "ACCEPTED" : run?.status === "TIME_LIMIT_EXCEEDED" ? "TIME_LIMIT_EXCEEDED" : "RUNTIME_ERROR",
      stdout: run?.stdout.slice(0, 10000), stderr: run?.stderr.slice(0, 10000), compileOutput: res.compile.output.slice(0, 10000), timeMs: run?.timeMs, memoryKb: run?.memoryKb ?? undefined,
    } });
  }
  return { compile: res.compile, run: run ?? null };
}

/** Run against the public (sample) test cases only. */
export async function runPublicTests(user: SessionUser, input: { experimentId: string; language: Language; code: string }) {
  await guardRate(user);
  const exp = await loadExperiment(input.experimentId, user);
  assertLanguage(input.language, [exp.language, ...exp.subject.languages]);
  const tests = exp.testCases.filter((t) => !t.isHidden).map(toSpec);
  if (!tests.length) throw badRequest("This experiment has no public test cases.");
  const res = await getExecutionProvider().execute({ language: input.language, source: input.code, inputs: tests.map((t) => t.input), timeLimitMs: exp.timeLimitMs, memoryLimitKb: exp.memoryLimitKb });
  const g = gradeRuns(tests, res);
  if (user.role === "STUDENT") {
    await prisma.submissionAttempt.create({ data: { studentId: user.id, experimentId: exp.id, kind: "TEST", language: input.language, code: input.code, verdict: g.verdict, testsPassed: g.testsPassed, testsTotal: g.testsTotal, compileOutput: g.compileOutput.slice(0, 10000), timeMs: g.maxTimeMs, memoryKb: g.maxMemoryKb, details: g.tests as unknown as Prisma.InputJsonValue } });
  }
  return { verdict: g.verdict, compileOk: g.compileOk, compileOutput: g.compileOutput, tests: g.tests, testsPassed: g.testsPassed, testsTotal: g.testsTotal, timeMs: g.maxTimeMs, memoryKb: g.maxMemoryKb };
}

export async function saveDraft(user: SessionUser, input: { experimentId: string; language: Language; code: string }) {
  if (input.code.length > 64 * 1024) throw badRequest("Code is too large (64 KB max).");
  const d = await prisma.codeDraft.upsert({
    where: { studentId_experimentId_language: { studentId: user.id, experimentId: input.experimentId, language: input.language } },
    update: { code: input.code },
    create: { studentId: user.id, experimentId: input.experimentId, language: input.language, code: input.code },
  });
  return { savedAt: d.updatedAt };
}

/** Resolve the student's deadline and submission window for a practical session (server time). */
export async function sessionWindow(studentId: string, sessionId: string, extraTimeMinutes: number) {
  const s = await prisma.practicalSession.findUnique({ where: { id: sessionId }, include: { extensions: { where: { studentId } } } });
  if (!s) throw notFound("Practical session not found.");
  const extMin = s.extensions.reduce((a, e) => a + e.minutes, 0);
  const deadline = personalDeadline(s, extMin, extraTimeMinutes);
  return { session: s, deadline, extensionMinutes: extMin };
}

/**
 * Graded submission. With a sessionId it is the practical submission (one per student per session,
 * validated against the server-side deadline); without, it is a practice submission.
 */
export async function submit(user: SessionUser, input: { experimentId: string; language: Language; code: string; sessionId?: string | null }) {
  if (user.role !== "STUDENT") throw forbidden("Only students submit practicals. Use Run/Test to try code.");
  if (input.code.length > 64 * 1024) throw badRequest("Code is too large (64 KB max).");
  rateLimit(`submit:${user.id}`, 10, 60_000);
  const exp = await loadExperiment(input.experimentId, user);
  assertLanguage(input.language, [exp.language, ...exp.subject.languages]);
  const now = new Date();
  let late = false;
  let existingId: string | null = null;

  if (input.sessionId) {
    const { session, deadline } = await sessionWindow(user.id, input.sessionId, user.extraTimeMinutes);
    if (session.experimentId !== exp.id) throw badRequest("This experiment is not the one assigned to the practical session.");
    const enrolled = await prisma.studentEnrollment.findUnique({ where: { offeringId_studentId: { offeringId: session.offeringId, studentId: user.id } } });
    if (!enrolled || enrolled.status !== "ACTIVE") throw forbidden("You are not enrolled in this laboratory class.");
    const existing = await prisma.submission.findUnique({ where: { studentId_sessionId: { studentId: user.id, sessionId: session.id } } });
    if (existing && existing.status !== "REOPENED") throw new ApiError(409, "You have already submitted this practical. Ask your faculty to reopen it if a resubmission is needed.");
    existingId = existing?.id ?? null;
    // A reopened submission may be resubmitted even after the original deadline, as authorised by faculty.
    if (!existing) {
      const w = canSubmit(session, deadline, now, session.allowLate);
      if (!w.allowed) throw new ApiError(403, w.reason);
      late = w.late;
    }
    await prisma.attendance.upsert({ where: { sessionId_studentId: { sessionId: session.id, studentId: user.id } }, update: {}, create: { sessionId: session.id, studentId: user.id, status: "PRESENT" } });
  }

  const executable = LANGUAGE_META[input.language].executable;
  const specs = exp.testCases.map(toSpec);
  const hasAutoTests = executable && specs.length > 0;
  const rubric = { ...DEFAULT_RUBRIC, ...(exp.rubric as Partial<Rubric>) };
  let grade = null as ReturnType<typeof gradeRuns> | null;
  if (hasAutoTests) {
    const res = await getExecutionProvider().execute({ language: input.language, source: input.code, inputs: specs.map((t) => t.input), timeLimitMs: exp.timeLimitMs, memoryLimitKb: exp.memoryLimitKb });
    grade = gradeRuns(specs, res);
  }
  const comps = grade ? autoComponentMarks(rubric, grade, { onTime: !late, hasAutoTests: true }) : { correctness: null, compilation: null, submission: late ? rubric.submission / 2 : rubric.submission, logic: null, quality: null, efficiency: null };
  const t = totals(comps);
  const verdict = grade?.verdict ?? "MANUAL_REVIEW";

  const result = await prisma.$transaction(async (tx) => {
    const sub = existingId
      ? await tx.submission.update({ where: { id: existingId }, data: { code: input.code, language: input.language, submittedAt: now, status: "EVALUATED", isLate: late } })
      : await tx.submission.create({ data: { studentId: user.id, experimentId: exp.id, sessionId: input.sessionId ?? null, language: input.language, code: input.code, submittedAt: now, isLate: late, status: "EVALUATED" } });
    await tx.submissionAttempt.create({ data: {
      studentId: user.id, experimentId: exp.id, submissionId: sub.id, kind: "SUBMIT", language: input.language, code: input.code, verdict,
      testsPassed: grade?.testsPassed ?? 0, testsTotal: grade?.testsTotal ?? 0, compileOutput: grade?.compileOutput.slice(0, 10000), timeMs: grade?.maxTimeMs, memoryKb: grade?.maxMemoryKb,
      details: (grade?.tests ?? []) as unknown as Prisma.InputJsonValue,
    } });
    const evalData = {
      verdict, testsPassed: grade?.testsPassed ?? 0, testsTotal: grade?.testsTotal ?? 0, weightPassed: grade?.weightPassed ?? 0, weightTotal: grade?.weightTotal ?? 0,
      timeMs: grade?.maxTimeMs, memoryKb: grade?.maxMemoryKb, components: comps as unknown as Prisma.InputJsonValue,
      autoMarks: t.autoMarks, manualMarks: null, totalMarks: t.total, maxMarks: exp.maxMarks, reviewedById: null, reviewedAt: null,
    };
    await tx.evaluationResult.upsert({ where: { submissionId: sub.id }, update: evalData, create: { submissionId: sub.id, ...evalData } });
    return sub;
  });

  return {
    submissionId: result.id, submittedAt: result.submittedAt, late, verdict,
    testsPassed: grade?.testsPassed ?? 0, testsTotal: grade?.testsTotal ?? 0,
    compileOk: grade?.compileOk ?? true, compileOutput: grade?.compileOutput ?? "",
    tests: grade ? redactForStudent(grade.tests) : [],
    // Marks are withheld for practical sessions until the release time; practice submissions show auto marks.
    marks: input.sessionId ? null : { auto: t.autoMarks, pendingFaculty: true, max: exp.maxMarks },
  };
}
