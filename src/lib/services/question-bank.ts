import "server-only";
import ExcelJS from "exceljs";
import type { Prisma, Difficulty, Language } from "@prisma/client";
import { prisma } from "@/lib/db";
import { badRequest, forbidden } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";
import { canManageSubject } from "@/lib/rbac";
import { parseCsv, toCsv } from "@/lib/csv";
import { audit } from "@/lib/audit";
import { DEFAULT_RUBRIC } from "@/lib/evaluation";
import { LANGUAGE_META } from "@/lib/languages";

/**
 * Question-bank exchange format (one row per experiment). List fields use " | " separators.
 * public_tests / hidden_tests: "input ==> expected" items separated by " || " (use \n for newlines).
 * viva: "question ::: answer" items separated by " | ".
 */
export const QB_COLUMNS = ["number", "title", "difficulty", "topic", "language", "estimated_minutes", "objectives", "course_outcomes", "problem_statement", "introduction", "definition", "concepts", "working", "applications", "algorithm", "pseudocode", "sample_input", "sample_output", "public_tests", "hidden_tests", "viva", "status"] as const;

const split = (s: string, sep = "|") => s.split(sep).map((x) => x.trim()).filter(Boolean);
const nl = (s: string) => s.replace(/\\n/g, "\n");
const tests = (s: string, hidden: boolean) => split(s, "||").map((p, order) => {
  const [input, expected] = p.split("==>");
  if (expected === undefined) throw badRequest(`Test case "${p.slice(0, 40)}" must be "input ==> expected".`);
  return { input: nl(input.trim()), expected: nl(expected.trim()), isHidden: hidden, weight: hidden ? 2 : 1, order };
});

async function readRows(file: File): Promise<string[][]> {
  if (file.size > 5 * 1024 * 1024) throw badRequest("File too large (5 MB max).");
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return parseCsv(await file.text());
  if (name.endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await file.arrayBuffer()) as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    const rows: string[][] = [];
    ws.eachRow((r) => rows.push((r.values as unknown[]).slice(1).map((v) => (v == null ? "" : typeof v === "object" && "text" in (v as object) ? String((v as { text: string }).text) : String(v)))));
    return rows;
  }
  throw badRequest("Upload a .csv or .xlsx file.");
}

export async function importQuestionBank(user: SessionUser, subjectId: string, file: File) {
  if (!(await canManageSubject(user, subjectId))) throw forbidden();
  const subject = await prisma.subject.findUniqueOrThrow({ where: { id: subjectId } });
  const rows = await readRows(file);
  if (rows.length < 2) throw badRequest("The file has no data rows.");
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (r: string[], k: (typeof QB_COLUMNS)[number]) => (header.indexOf(k) >= 0 ? (r[header.indexOf(k)] ?? "").trim() : "");
  for (const req of ["number", "title", "difficulty"] as const) if (!header.includes(req)) throw badRequest(`Missing required column "${req}".`);
  const errors: string[] = [];
  let created = 0, updated = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    try {
      const number = Number(col(r, "number"));
      const difficulty = col(r, "difficulty").toUpperCase() as Difficulty;
      if (!Number.isInteger(number) || number < 1) throw new Error("number must be a positive integer");
      if (!["EASY", "MEDIUM", "HARD"].includes(difficulty)) throw new Error("difficulty must be EASY, MEDIUM or HARD");
      const language = (col(r, "language").toUpperCase() || subject.defaultLanguage) as Language;
      if (!(language in LANGUAGE_META)) throw new Error(`unknown language ${language}`);
      const topicName = col(r, "topic");
      const topicId = topicName ? (await prisma.experimentTopic.upsert({ where: { subjectId_name: { subjectId, name: topicName } }, update: {}, create: { subjectId, name: topicName } })).id : null;
      const vivas = split(col(r, "viva")).map((v, order) => { const [question, answer] = v.split(":::"); return { question: question.trim(), answer: answer?.trim() ?? null, order }; });
      const tcs = [...tests(col(r, "public_tests"), false), ...tests(col(r, "hidden_tests"), true)].map((t, order) => ({ ...t, order }));
      const data = {
        title: col(r, "title"), difficulty, language, topicId,
        estimatedMinutes: Number(col(r, "estimated_minutes")) || 120,
        objectives: split(col(r, "objectives")), courseOutcomes: split(col(r, "course_outcomes")),
        problemStatement: nl(col(r, "problem_statement")) || `${col(r, "title")}.`,
        theory: { introduction: nl(col(r, "introduction")), definition: nl(col(r, "definition")), concepts: split(col(r, "concepts")), working: nl(col(r, "working")), applications: split(col(r, "applications")) } as Prisma.InputJsonValue,
        algorithm: split(col(r, "algorithm")), pseudocode: nl(col(r, "pseudocode")) || null,
        sampleInput: nl(col(r, "sample_input")) || null, sampleOutput: nl(col(r, "sample_output")) || null,
      };
      if (!data.title) throw new Error("title is required");
      const existing = await prisma.experiment.findUnique({ where: { subjectId_number: { subjectId, number } } });
      if (existing) {
        await prisma.$transaction(async (tx) => {
          await tx.experimentVersion.create({ data: { experimentId: existing.id, version: existing.version, snapshot: JSON.parse(JSON.stringify(existing)), editedById: user.id } });
          if (tcs.length) { await tx.testCase.deleteMany({ where: { experimentId: existing.id } }); await tx.testCase.createMany({ data: tcs.map((t) => ({ ...t, experimentId: existing.id })) }); }
          if (vivas.length) { await tx.vivaQuestion.deleteMany({ where: { experimentId: existing.id } }); await tx.vivaQuestion.createMany({ data: vivas.map((v) => ({ ...v, experimentId: existing.id })) }); }
          await tx.experiment.update({ where: { id: existing.id }, data: { ...data, version: existing.version + 1 } });
        });
        updated++;
      } else {
        await prisma.experiment.create({ data: { ...data, subjectId, number, code: `${subject.code.replace(/^CA-|-LAB$/g, "")}-EXP-${String(number).padStart(2, "0")}`, rubric: DEFAULT_RUBRIC as unknown as Prisma.InputJsonValue, status: "DRAFT", authorId: user.id, testCases: { create: tcs }, vivaQs: { create: vivas } } });
        created++;
      }
    } catch (e) {
      errors.push(`Row ${i + 1}: ${(e as Error).message}`);
    }
  }
  await audit({ actorId: user.id, action: "QUESTION_BANK_IMPORT", entityType: "Subject", entityId: subjectId, after: { created, updated, errors: errors.length, file: file.name } });
  return { created, updated, errors };
}

export async function exportQuestionBank(user: SessionUser, subjectId: string, format: "csv" | "xlsx", includeHidden: boolean) {
  if (!(await canManageSubject(user, subjectId))) throw forbidden();
  const exps = await prisma.experiment.findMany({ where: { subjectId }, orderBy: { number: "asc" }, include: { topic: true, testCases: { orderBy: { order: "asc" } }, vivaQs: { orderBy: { order: "asc" } } } });
  const en = (s: string) => s.replace(/\n/g, "\\n");
  const rows = exps.map((e) => {
    const t = e.theory as { introduction?: string; definition?: string; concepts?: string[]; working?: string; applications?: string[] };
    const fmt = (h: boolean) => e.testCases.filter((x) => x.isHidden === h).map((x) => `${en(x.input)} ==> ${en(x.expected)}`).join(" || ");
    return [e.number, e.title, e.difficulty, e.topic?.name ?? "", e.language, e.estimatedMinutes, e.objectives.join(" | "), e.courseOutcomes.join(" | "), e.problemStatement, t.introduction ?? "", t.definition ?? "", (t.concepts ?? []).join(" | "), t.working ?? "", (t.applications ?? []).join(" | "), e.algorithm.join(" | "), e.pseudocode ?? "", e.sampleInput ?? "", e.sampleOutput ?? "", fmt(false), includeHidden ? fmt(true) : "", e.vivaQs.map((v) => `${v.question} ::: ${v.answer ?? ""}`).join(" | "), e.status];
  });
  if (format === "csv") return { body: toCsv([...QB_COLUMNS], rows), type: "text/csv; charset=utf-8", ext: "csv" };
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Question bank");
  ws.addRow([...QB_COLUMNS]).font = { bold: true };
  rows.forEach((r) => ws.addRow(r.map((v) => (typeof v === "string" && /^[=+\-@]/.test(v) ? "'" + v : v))));
  ws.columns.forEach((c) => { c.width = 24; });
  return { body: Buffer.from(await wb.xlsx.writeBuffer()), type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx" };
}
