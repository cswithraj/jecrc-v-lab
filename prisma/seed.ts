/* eslint-disable no-console */
/**
 * Development seed. Everything created here is DEMO DATA: demo users carry isDemo=true and
 * an "(Demo)" suffix, emails use the reserved .demo domain. Never run against production.
 */
import { PrismaClient, type Prisma, type Language, type Difficulty } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SUBJECTS } from "./seed-data/subjects";
import { CATALOG } from "./seed-data/catalog";
import { RICH } from "./seed-data/rich-index";
import { DEFAULT_RUBRIC } from "../src/lib/evaluation";
import { DEFAULT_POLICY } from "../src/lib/grading";
import { DEFAULT_INSTITUTION, DEFAULT_EXAM_RULES } from "../src/lib/settings";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "Demo@1234";
const PROJECT_RUBRIC = { understanding: 10, design: 15, implementation: 30, testing: 15, documentation: 10, viva: 20 };

// Deterministic pseudo-random so demo data is stable between runs
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

const FIRST = ["Aarav", "Ananya", "Vihaan", "Diya", "Arjun", "Ishita", "Kabir", "Meera", "Rohan", "Saanvi", "Aditya", "Kavya", "Yash", "Riya", "Dev", "Nisha", "Harsh", "Pooja", "Kunal", "Tanvi", "Manav", "Sneha", "Laksh", "Priya"];
const LAST = ["Sharma", "Agarwal", "Jain", "Gupta", "Choudhary", "Mathur", "Saxena", "Meena", "Rathore", "Verma", "Kumawat", "Singh"];

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") throw new Error("Refusing to seed demo data in production");
  console.log("Seeding demo data…");
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await prisma.setting.upsert({ where: { key: "institution" }, update: {}, create: { key: "institution", value: DEFAULT_INSTITUTION as unknown as Prisma.InputJsonValue } });
  await prisma.setting.upsert({ where: { key: "examRules" }, update: {}, create: { key: "examRules", value: DEFAULT_EXAM_RULES as unknown as Prisma.InputJsonValue } });
  await prisma.gradingPolicy.upsert({
    where: { name: "JECRC Default (10-point)" }, update: {},
    create: { name: "JECRC Default (10-point)", isDefault: true, weights: DEFAULT_POLICY.weights as unknown as Prisma.InputJsonValue, bands: DEFAULT_POLICY.bands as unknown as Prisma.InputJsonValue, passPercent: DEFAULT_POLICY.passPercent, minAttendancePercent: DEFAULT_POLICY.minAttendancePercent, tieBreak: DEFAULT_POLICY.tieBreak },
  });

  const dept = await prisma.department.upsert({ where: { code: "CA" }, update: {}, create: { code: "CA", name: "Department of Computer Applications" } });
  const bca = await prisma.course.upsert({ where: { code: "BCA" }, update: {}, create: { code: "BCA", name: "Bachelor of Computer Applications", durationSem: 6, departmentId: dept.id } });
  const mca = await prisma.course.upsert({ where: { code: "MCA" }, update: {}, create: { code: "MCA", name: "Master of Computer Applications", durationSem: 4, departmentId: dept.id } });
  const sems: Record<string, string> = {};
  for (const [c, n] of [[bca, 6], [mca, 4]] as const) for (let i = 1; i <= n; i++) {
    const s = await prisma.semester.upsert({ where: { courseId_number: { courseId: c.id, number: i } }, update: {}, create: { courseId: c.id, number: i } });
    sems[`${c.code}-${i}`] = s.id;
  }
  const ay = await prisma.academicSession.upsert({ where: { name: "2026-27 Odd Semester" }, update: {}, create: { name: "2026-27 Odd Semester", startDate: new Date("2026-07-15"), endDate: new Date("2026-12-20"), isCurrent: true } });
  const bcaBatch = await prisma.batch.upsert({ where: { code: "BCA-2025-A" }, update: {}, create: { code: "BCA-2025-A", name: "BCA 2025 Section A (Sem 3)", courseId: bca.id, semesterId: sems["BCA-3"], academicSessionId: ay.id } });
  const mcaBatch = await prisma.batch.upsert({ where: { code: "MCA-2026-A" }, update: {}, create: { code: "MCA-2026-A", name: "MCA 2026 Section A (Sem 1)", courseId: mca.id, semesterId: sems["MCA-1"], academicSessionId: ay.id } });

  const mkUser = (email: string, data: Omit<Prisma.UserUncheckedCreateInput, "email" | "passwordHash">) =>
    prisma.user.upsert({ where: { email }, update: {}, create: { email, passwordHash: hash, isDemo: true, departmentId: dept.id, ...data } });
  const admin = await mkUser("admin@vlab.demo", { name: "Super Admin (Demo)", role: "SUPER_ADMIN", employeeId: "DEMO-ADM-01" });
  const hod = await mkUser("hod@vlab.demo", { name: "HOD Computer Applications (Demo)", role: "HOD", employeeId: "DEMO-HOD-01" });
  await prisma.department.update({ where: { id: dept.id }, data: { hodId: hod.id } });
  const fac1 = await mkUser("faculty@vlab.demo", { name: "Prof. Neha Mathur (Demo)", role: "FACULTY", employeeId: "DEMO-FAC-01" });
  const fac2 = await mkUser("faculty2@vlab.demo", { name: "Dr. Vikram Rathore (Demo)", role: "FACULTY", employeeId: "DEMO-FAC-02" });

  const students: Awaited<ReturnType<typeof mkUser>>[] = [];
  for (let i = 0; i < 24; i++) {
    const email = i === 0 ? "student@vlab.demo" : `student${String(i + 1).padStart(2, "0")}@vlab.demo`;
    students.push(await mkUser(email, { name: `${FIRST[i]} ${LAST[i % LAST.length]} (Demo)`, role: "STUDENT", enrollmentNo: `DEMO25BCA${String(i + 1).padStart(3, "0")}`, batchId: bcaBatch.id, extraTimeMinutes: i === 5 ? 20 : 0 }));
  }
  const mcaStudents = [];
  for (let i = 0; i < 10; i++) {
    mcaStudents.push(await mkUser(`mca${String(i + 1).padStart(2, "0")}@vlab.demo`, { name: `${FIRST[(i + 7) % 24]} ${LAST[(i + 3) % LAST.length]} (Demo)`, role: "STUDENT", enrollmentNo: `DEMO26MCA${String(i + 1).padStart(3, "0")}`, batchId: mcaBatch.id }));
  }

  // ── Subjects, experiments, projects ──
  const subjectIds: Record<string, string> = {};
  const expIds: Record<string, Record<number, string>> = {};
  let richCount = 0, draftCount = 0;
  for (const s of SUBJECTS) {
    const subject = await prisma.subject.upsert({
      where: { slug: s.slug }, update: {},
      create: {
        slug: s.slug, code: s.code, name: s.name, shortName: s.shortName, description: s.description, icon: s.icon, color: s.color,
        credits: s.credits, requiredExperiments: s.credits * 15, hoursPerWeek: 4, sessionMinutes: 120,
        defaultLanguage: s.language, languages: s.languages, defaultEnvironment: s.environment,
        easyTarget: s.credits === 2 ? 10 : 5, mediumTarget: s.credits === 2 ? 12 : 6, hardTarget: s.credits === 2 ? 8 : 4,
        departmentId: dept.id, semesterId: s.slug.startsWith("java") || s.slug.startsWith("ai-ml") || s.slug.startsWith("crypto") ? sems["MCA-1"] : sems["BCA-3"],
      },
    });
    subjectIds[s.slug] = subject.id;
    expIds[s.slug] = {};
    const rich = new Map((RICH[s.slug] ?? []).map((r) => [r.n, r]));
    const catalog = CATALOG[s.slug];
    for (let i = 0; i < catalog.length; i++) {
      const n = i + 1;
      const [title, difficulty, topicName] = catalog[i];
      const topic = await prisma.experimentTopic.upsert({ where: { subjectId_name: { subjectId: subject.id, name: topicName } }, update: {}, create: { subjectId: subject.id, name: topicName } });
      const r = rich.get(n);
      const code = `${s.code.replace(/^CA-|-LAB$/g, "")}-EXP-${String(n).padStart(2, "0")}`;
      const existing = await prisma.experiment.findUnique({ where: { subjectId_number: { subjectId: subject.id, number: n } } });
      if (existing) { expIds[s.slug][n] = existing.id; continue; }
      const lang: Language = r?.language ?? s.language;
      const data: Prisma.ExperimentUncheckedCreateInput = r
        ? {
            code, subjectId: subject.id, number: n, title: r.title ?? title, difficulty: difficulty as Difficulty, topicId: topic.id,
            estimatedMinutes: r.minutes ?? 120, language: lang, environment: r.env ?? s.environment, objectives: r.objectives, courseOutcomes: r.cos ?? ["CO1"],
            learningOutcome: r.objectives[0], theory: r.theory as unknown as Prisma.InputJsonValue, problemStatement: r.problem, algorithm: r.algorithm,
            pseudocode: r.pseudocode ?? null, flowchart: r.flowchart ?? null, starterCode: r.starter ?? null, referenceCode: r.reference ?? null,
            codeExplanation: r.explanation ?? null, sampleInput: r.sampleInput ?? null, sampleOutput: r.sampleOutput ?? null,
            conclusion: r.conclusion ?? `The experiment "${r.title ?? title}" was implemented and verified against the given test cases, reinforcing: ${r.objectives.join("; ").toLowerCase()}.`,
            rubric: (r.tests?.length ? DEFAULT_RUBRIC : { ...DEFAULT_RUBRIC }) as unknown as Prisma.InputJsonValue,
            status: "PUBLISHED", isDemo: false, authorId: fac1.id,
            testCases: { create: (r.tests ?? []).map(([input, expected, hidden], idx) => ({ input, expected, isHidden: !!hidden, weight: hidden ? 2 : 1, order: idx, compareMode: r.compareMode ?? "TRIM" })) },
            vivaQs: { create: r.viva.map(([question, answer], idx) => ({ question, answer, order: idx })) },
          }
        : {
            code, subjectId: subject.id, number: n, title, difficulty: difficulty as Difficulty, topicId: topic.id, language: lang, environment: s.environment,
            objectives: [`Understand and apply: ${title.toLowerCase()}`], courseOutcomes: [], learningOutcome: null,
            theory: { introduction: "", definition: "", concepts: [], working: "", applications: [] } as Prisma.InputJsonValue,
            problemStatement: `${title}.`, algorithm: [], rubric: DEFAULT_RUBRIC as unknown as Prisma.InputJsonValue, status: "DRAFT",
          };
      const e = await prisma.experiment.create({ data });
      expIds[s.slug][n] = e.id;
      if (r) richCount++; else draftCount++;
    }
    if (!(await prisma.project.findFirst({ where: { subjectId: subject.id } }))) {
      await prisma.project.create({
        data: {
          subjectId: subject.id, title: s.project.title, problemStatement: s.project.problem, objectives: s.project.objectives, requirements: s.project.requirements,
          isGroup: s.project.isGroup, maxTeamSize: s.project.maxTeamSize, rubric: PROJECT_RUBRIC, dueDate: new Date("2026-12-05T18:00:00+05:30"),
          milestones: { create: s.project.milestones.map((t, i) => ({ title: t, order: i, dueDate: new Date(Date.UTC(2026, 8 + i, 25, 12)) })) },
        },
      });
    }
  }
  console.log(`  experiments: ${richCount} full write-ups (published), ${draftCount} outlines (draft)`);

  // Faculty assignments
  const assign = async (slug: string, userId: string, coord = false) => prisma.subjectFaculty.upsert({ where: { subjectId_userId: { subjectId: subjectIds[slug], userId } }, update: {}, create: { subjectId: subjectIds[slug], userId, isCoordinator: coord } });
  for (const slug of ["cpp-programming", "dsa", "c-programming", "web-technology"]) await assign(slug, fac1.id, true);
  for (const slug of ["python-programming", "operating-systems", "java-programming", "ai-ml-model-development", "cryptography-network-security"]) await assign(slug, fac2.id, true);

  // ── Offerings (classes) ──
  const offer = async (slug: string, batchId: string, facultyId: string, studs: { id: string }[]) => {
    const o = await prisma.subjectOffering.upsert({ where: { subjectId_batchId_academicSessionId: { subjectId: subjectIds[slug], batchId, academicSessionId: ay.id } }, update: {}, create: { subjectId: subjectIds[slug], batchId, academicSessionId: ay.id, facultyId } });
    for (const st of studs) await prisma.studentEnrollment.upsert({ where: { offeringId_studentId: { offeringId: o.id, studentId: st.id } }, update: {}, create: { offeringId: o.id, studentId: st.id } });
    await prisma.labSchedule.deleteMany({ where: { offeringId: o.id } });
    return o;
  };
  const oCpp = await offer("cpp-programming", bcaBatch.id, fac1.id, students);
  const oPy = await offer("python-programming", bcaBatch.id, fac2.id, students);
  const oDsa = await offer("dsa", bcaBatch.id, fac1.id, students);
  const oOs = await offer("operating-systems", bcaBatch.id, fac2.id, students);
  const oJava = await offer("java-programming", mcaBatch.id, fac2.id, mcaStudents);
  await prisma.labSchedule.createMany({ data: [
    { offeringId: oCpp.id, weekday: 1, startTime: "10:00", durationMin: 120, room: "Lab 4 (Block A)" }, { offeringId: oCpp.id, weekday: 4, startTime: "10:00", durationMin: 120, room: "Lab 4 (Block A)" },
    { offeringId: oPy.id, weekday: 2, startTime: "14:00", durationMin: 120, room: "Lab 2 (Block A)" }, { offeringId: oPy.id, weekday: 5, startTime: "14:00", durationMin: 120, room: "Lab 2 (Block A)" },
    { offeringId: oDsa.id, weekday: 3, startTime: "10:00", durationMin: 120, room: "Lab 4 (Block A)" }, { offeringId: oDsa.id, weekday: 6, startTime: "10:00", durationMin: 120, room: "Lab 4 (Block A)" },
    { offeringId: oOs.id, weekday: 2, startTime: "10:00", durationMin: 120, room: "Linux Lab" }, { offeringId: oOs.id, weekday: 4, startTime: "14:00", durationMin: 120, room: "Linux Lab" },
  ] });

  // ── Past practical sessions with evaluated submissions (demo history) ──
  if ((await prisma.practicalSession.count()) === 0) {
    const now = Date.now();
    const day = 86400_000;
    const history = async (o: { id: string }, slug: string, nums: number[], facultyId: string, startDaysAgo: number) => {
      for (let k = 0; k < nums.length; k++) {
        const exp = await prisma.experiment.findUniqueOrThrow({ where: { id: expIds[slug][nums[k]] }, include: { testCases: true } });
        const start = new Date(now - (startDaysAgo - k * 4) * day);
        const sess = await prisma.practicalSession.create({ data: { offeringId: o.id, experimentId: exp.id, sequence: k + 1, scheduledStart: start, durationMin: 120, status: "ENDED", startedAt: start, endsAt: new Date(start.getTime() + 120 * 60_000), endedAt: new Date(start.getTime() + 120 * 60_000), conductedById: facultyId, marksReleaseAt: new Date(start.getTime() + day) } });
        for (const st of students) {
          const r = rand();
          if (r < 0.08) { await prisma.attendance.create({ data: { sessionId: sess.id, studentId: st.id, status: "ABSENT", source: "AUTO" } }); continue; }
          await prisma.attendance.create({ data: { sessionId: sess.id, studentId: st.id, status: r < 0.14 ? "LATE" : "PRESENT" } });
          const skill = 0.45 + ((FIRST.indexOf(st.name.split(" ")[0]) * 37) % 55) / 100; // stable per student
          const total = exp.testCases.length;
          const wTotal = exp.testCases.reduce((a, t) => a + t.weight, 0);
          const passedTests = exp.testCases.filter(() => rand() < skill);
          const wPassed = passedTests.reduce((a, t) => a + t.weight, 0);
          const compiled = rand() < 0.95;
          const correctness = compiled ? Math.round((40 * wPassed) / wTotal * 100) / 100 : 0;
          const comps = { correctness, compilation: compiled ? 10 : 0, submission: 10, logic: Math.round(10 + skill * 10), quality: Math.round(5 + skill * 5), efficiency: Math.round(4 + skill * 6) };
          const auto = comps.correctness + comps.compilation + comps.submission;
          const manual = comps.logic + comps.quality + comps.efficiency;
          const verdict = !compiled ? "COMPILATION_ERROR" : passedTests.length === total ? "ACCEPTED" : passedTests.length ? "PARTIAL" : "WRONG_ANSWER";
          const sub = await prisma.submission.create({ data: { studentId: st.id, experimentId: exp.id, sessionId: sess.id, language: exp.language, code: exp.referenceCode ?? exp.starterCode ?? "", submittedAt: new Date(start.getTime() + (60 + rand() * 55) * 60_000), status: "FINALIZED" } });
          await prisma.evaluationResult.create({ data: { submissionId: sub.id, verdict, testsPassed: compiled ? passedTests.length : 0, testsTotal: total, weightPassed: compiled ? wPassed : 0, weightTotal: wTotal, timeMs: Math.round(5 + rand() * 40), memoryKb: Math.round(2000 + rand() * 3000), components: comps, autoMarks: auto, manualMarks: manual, totalMarks: auto + manual, maxMarks: 100, reviewedById: facultyId, reviewedAt: new Date(start.getTime() + day / 2) } });
        }
      }
    };
    await history(oCpp, "cpp-programming", [2, 10, 16, 19], fac1.id, 20);
    await history(oDsa, "dsa", [6, 11, 12], fac1.id, 18);
    await history(oPy, "python-programming", [4, 6, 13], fac2.id, 17);

    // Live Python session (started 10 minutes ago) for trying the exam flow as a student
    const liveStart = new Date(now - 10 * 60_000);
    await prisma.practicalSession.create({ data: { offeringId: oPy.id, experimentId: expIds["python-programming"][19], sequence: 4, scheduledStart: liveStart, durationMin: 120, status: "LIVE", startedAt: liveStart, endsAt: new Date(liveStart.getTime() + 120 * 60_000), conductedById: fac2.id, marksReleaseAt: new Date(now + day) } });
    // Scheduled sessions faculty can start
    await prisma.practicalSession.create({ data: { offeringId: oCpp.id, experimentId: expIds["cpp-programming"][25], sequence: 5, scheduledStart: new Date(now + 30 * 60_000), durationMin: 120, conductedById: fac1.id } });
    await prisma.practicalSession.create({ data: { offeringId: oDsa.id, experimentId: expIds["dsa"][29], sequence: 4, scheduledStart: new Date(now + 2 * day), durationMin: 120, conductedById: fac1.id } });
    await prisma.practicalSession.create({ data: { offeringId: oOs.id, experimentId: expIds["operating-systems"][12], sequence: 1, scheduledStart: new Date(now + 1 * day), durationMin: 120, conductedById: fac2.id } });
    await prisma.practicalSession.create({ data: { offeringId: oJava.id, experimentId: expIds["java-programming"][3], sequence: 1, scheduledStart: new Date(now + 3 * day), durationMin: 120, conductedById: fac2.id } });
  }

  // ── Project teams for C++ (group) and Python (individual) ──
  if ((await prisma.projectTeam.count()) === 0) {
    const cppProject = await prisma.project.findFirstOrThrow({ where: { subjectId: subjectIds["cpp-programming"] } });
    for (let t = 0; t < 8; t++) {
      const members = students.slice(t * 3, t * 3 + 3);
      const evaluated = t < 3;
      const ev = evaluated ? { understanding: 8, design: 12 + t, implementation: 24 - t, testing: 11, documentation: 8, viva: 15 + t } : null;
      await prisma.projectTeam.create({ data: {
        projectId: cppProject.id, offeringId: oCpp.id, name: `Team ${String.fromCharCode(65 + t)}`, status: evaluated ? "EVALUATED" : t < 6 ? "SUBMITTED" : "IN_PROGRESS",
        evaluation: ev ?? undefined, marks: ev ? Object.values(ev).reduce((a, b) => a + b, 0) : null, vivaMarks: ev ? Math.round((ev.viva / 20) * 100) : null, evaluatedById: evaluated ? fac1.id : null, evaluatedAt: evaluated ? new Date() : null,
        members: { create: members.map((m, i) => ({ studentId: m.id, isLeader: i === 0 })) },
        submissions: t < 6 ? { create: [{ kind: "REPO", url: `https://github.com/example/library-mgmt-team-${String.fromCharCode(97 + t)}`, notes: "Demo repository link", submittedById: members[0].id }] } : undefined,
      } });
    }
  }

  // ── Notifications ──
  if ((await prisma.notification.count()) === 0) {
    await prisma.notification.createMany({ data: students.flatMap((s) => [
      { userId: s.id, type: "SESSION_UPCOMING", title: "C++ Lab practical starts soon", body: "Practical 5 (STL map word frequency) starts in 30 minutes in Lab 4.", link: "/practicals" },
      { userId: s.id, type: "MARKS_RELEASED", title: "Marks released: DSA practical 3", body: "Your marks for Infix to Postfix are now available.", link: "/student" },
      { userId: s.id, type: "ANNOUNCEMENT", title: "Welcome to JECRC VLab", body: "This is a demo environment populated with sample data.", link: "/labs" },
    ]) });
  }
  await prisma.auditLog.create({ data: { actorId: admin.id, action: "SEED", entityType: "System", reason: "Development demo data seeded" } });
  console.log(`Done. Demo password for all accounts: ${DEMO_PASSWORD}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
