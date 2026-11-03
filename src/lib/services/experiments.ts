import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, badRequest, forbidden, notFound } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";
import { canManageSubject } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { DEFAULT_RUBRIC, rubricTotal } from "@/lib/evaluation";
import { LanguageEnum, DifficultyEnum, EnvironmentEnum } from "@/lib/schemas";

const str = (max = 20000) => z.string().max(max);
export const TheorySchema = z.object({
  introduction: str(), definition: str(), concepts: z.array(str(1000)).max(50).default([]),
  terminology: z.array(z.tuple([str(200), str(1000)])).max(50).default([]), working: str(), applications: z.array(str(1000)).max(50).default([]), examples: str().optional(),
});
export const RubricSchema = z.object({ correctness: z.number().min(0), logic: z.number().min(0), quality: z.number().min(0), efficiency: z.number().min(0), compilation: z.number().min(0), submission: z.number().min(0) });
export const TestCaseSchema = z.object({ id: z.string().optional(), input: str(1_000_000), expected: str(1_000_000), isHidden: z.boolean().default(false), weight: z.number().int().min(1).max(100).default(1), compareMode: z.enum(["EXACT", "TRIM", "TOKENS", "FLOAT"]).default("TRIM") });
export const ExperimentInput = z.object({
  subjectId: z.string(),
  number: z.number().int().min(1).max(999),
  title: z.string().trim().min(3).max(200),
  difficulty: DifficultyEnum,
  estimatedMinutes: z.number().int().min(10).max(600).default(120),
  topic: z.string().trim().max(100).optional().nullable(),
  language: LanguageEnum,
  environment: EnvironmentEnum.default("CODE"),
  objectives: z.array(str(500)).max(20).default([]),
  courseOutcomes: z.array(z.string().max(20)).max(20).default([]),
  learningOutcome: str(500).nullish(),
  theory: TheorySchema,
  problemStatement: z.string().trim().min(5).max(20000),
  algorithm: z.array(str(1000)).max(100).default([]),
  pseudocode: str().nullish(),
  flowchart: str().nullish(),
  flowchartImage: z.string().url().max(2000).nullish().or(z.literal("").transform(() => null)),
  starterCode: str(65536).nullish(),
  referenceCode: str(65536).nullish(),
  codeExplanation: str().nullish(),
  sampleInput: str().nullish(),
  sampleOutput: str().nullish(),
  conclusion: str().nullish(),
  showSolution: z.boolean().default(false),
  rubric: RubricSchema.default(DEFAULT_RUBRIC),
  maxMarks: z.number().int().min(1).max(1000).default(100),
  timeLimitMs: z.number().int().min(100).max(10000).default(2000),
  memoryLimitKb: z.number().int().min(16384).max(524288).default(131072),
  testCases: z.array(TestCaseSchema).max(50).default([]),
  vivaQuestions: z.array(z.object({ question: str(1000).min(3), answer: str(4000).nullish() })).max(30).default([]),
});
export type ExperimentInputT = z.infer<typeof ExperimentInput>;

async function topicId(subjectId: string, name?: string | null) {
  if (!name) return null;
  return (await prisma.experimentTopic.upsert({ where: { subjectId_name: { subjectId, name } }, update: {}, create: { subjectId, name } })).id;
}

function validateForPublish(e: { rubric: unknown; maxMarks: number; theory: unknown; problemStatement: string; language: string; testCases?: unknown[]; vivaCount: number }) {
  const problems: string[] = [];
  const t = e.theory as { introduction?: string };
  if (!t?.introduction) problems.push("theory introduction");
  if (rubricTotal(e.rubric as never) !== e.maxMarks) problems.push(`rubric must total ${e.maxMarks}`);
  if (e.vivaCount < 5) problems.push("at least 5 viva questions");
  return problems;
}

function snapshot(e: object) { return JSON.parse(JSON.stringify(e)) as Prisma.InputJsonValue; }

export async function createExperiment(user: SessionUser, input: ExperimentInputT) {
  if (!(await canManageSubject(user, input.subjectId))) throw forbidden();
  const subject = await prisma.subject.findUniqueOrThrow({ where: { id: input.subjectId } });
  const { testCases, vivaQuestions, topic, ...rest } = input;
  const code = `${subject.code.replace(/^CA-|-LAB$/g, "")}-EXP-${String(input.number).padStart(2, "0")}`;
  const e = await prisma.experiment.create({
    data: {
      ...rest, code, topicId: await topicId(input.subjectId, topic), authorId: user.id, status: "DRAFT",
      theory: rest.theory as Prisma.InputJsonValue, rubric: rest.rubric as Prisma.InputJsonValue,
      testCases: { create: testCases.map(({ id: _i, ...t }, order) => ({ ...t, order })) },
      vivaQs: { create: vivaQuestions.map((v, order) => ({ ...v, order })) },
    },
  });
  await audit({ actorId: user.id, action: "EXPERIMENT_CREATE", entityType: "Experiment", entityId: e.id, after: { code, title: e.title } });
  return e;
}

export async function updateExperiment(user: SessionUser, id: string, input: ExperimentInputT) {
  const before = await prisma.experiment.findUnique({ where: { id }, include: { testCases: true, vivaQs: true } });
  if (!before) throw notFound();
  if (!(await canManageSubject(user, before.subjectId))) throw forbidden();
  if (input.subjectId !== before.subjectId) throw badRequest("Experiments cannot be moved between laboratories; duplicate it instead.");
  const { testCases, vivaQuestions, topic, ...rest } = input;
  const version = before.version + 1;
  const e = await prisma.$transaction(async (tx) => {
    await tx.experimentVersion.create({ data: { experimentId: id, version: before.version, snapshot: snapshot(before), editedById: user.id } });
    await tx.testCase.deleteMany({ where: { experimentId: id } });
    await tx.vivaQuestion.deleteMany({ where: { experimentId: id } });
    return tx.experiment.update({
      where: { id },
      data: {
        ...rest, version, topicId: await topicId(input.subjectId, topic), theory: rest.theory as Prisma.InputJsonValue, rubric: rest.rubric as Prisma.InputJsonValue,
        testCases: { create: testCases.map(({ id: _i, ...t }, order) => ({ ...t, order })) },
        vivaQs: { create: vivaQuestions.map((v, order) => ({ ...v, order })) },
      },
    });
  });
  if (e.status === "PUBLISHED") {
    const problems = validateForPublish({ ...e, vivaCount: vivaQuestions.length });
    if (problems.length) await prisma.experiment.update({ where: { id }, data: { status: "DRAFT" } });
  }
  await audit({ actorId: user.id, action: "EXPERIMENT_UPDATE", entityType: "Experiment", entityId: id, before: { version: before.version }, after: { version } });
  return e;
}

export async function setStatus(user: SessionUser, id: string, status: "PUBLISHED" | "DRAFT" | "ARCHIVED") {
  const e = await prisma.experiment.findUnique({ where: { id }, include: { _count: { select: { vivaQs: true, testCases: true } } } });
  if (!e) throw notFound();
  if (!(await canManageSubject(user, e.subjectId))) throw forbidden();
  if (status === "PUBLISHED") {
    const problems = validateForPublish({ ...e, vivaCount: e._count.vivaQs });
    if (problems.length) throw new ApiError(422, `Cannot publish yet — missing: ${problems.join(", ")}.`);
  }
  const u = await prisma.experiment.update({ where: { id }, data: { status } });
  await audit({ actorId: user.id, action: `EXPERIMENT_${status}`, entityType: "Experiment", entityId: id, before: { status: e.status }, after: { status } });
  return u;
}

export async function duplicateExperiment(user: SessionUser, id: string) {
  const e = await prisma.experiment.findUnique({ where: { id }, include: { testCases: true, vivaQs: true, subject: true } });
  if (!e) throw notFound();
  if (!(await canManageSubject(user, e.subjectId))) throw forbidden();
  const max = await prisma.experiment.aggregate({ where: { subjectId: e.subjectId }, _max: { number: true } });
  const number = (max._max.number ?? 0) + 1;
  const { id: _id, code: _c, createdAt: _ca, updatedAt: _ua, testCases, vivaQs, subject, version: _v, status: _s, ...rest } = e;
  const copy = await prisma.experiment.create({
    data: {
      ...rest, number, title: `${e.title} (copy)`, code: `${subject.code.replace(/^CA-|-LAB$/g, "")}-EXP-${String(number).padStart(2, "0")}`, status: "DRAFT", authorId: user.id,
      theory: rest.theory as Prisma.InputJsonValue, rubric: rest.rubric as Prisma.InputJsonValue,
      testCases: { create: testCases.map(({ id: _i, experimentId: _e, ...t }) => t) },
      vivaQs: { create: vivaQs.map(({ id: _i, experimentId: _e, ...v }) => v) },
    },
  });
  await audit({ actorId: user.id, action: "EXPERIMENT_DUPLICATE", entityType: "Experiment", entityId: copy.id, before: { source: id } });
  return copy;
}

/** Hard delete only when nothing references it; otherwise archive to preserve academic records. */
export async function deleteExperiment(user: SessionUser, id: string) {
  const e = await prisma.experiment.findUnique({ where: { id }, include: { _count: { select: { submissions: true, sessions: true } } } });
  if (!e) throw notFound();
  if (!(await canManageSubject(user, e.subjectId))) throw forbidden();
  if (e._count.submissions || e._count.sessions) {
    await prisma.experiment.update({ where: { id }, data: { status: "ARCHIVED" } });
    await audit({ actorId: user.id, action: "EXPERIMENT_ARCHIVE", entityType: "Experiment", entityId: id, reason: "Has sessions/submissions; archived instead of deleted" });
    return { archived: true };
  }
  await prisma.experiment.delete({ where: { id } });
  await audit({ actorId: user.id, action: "EXPERIMENT_DELETE", entityType: "Experiment", entityId: id, before: { code: e.code, title: e.title } });
  return { deleted: true };
}
