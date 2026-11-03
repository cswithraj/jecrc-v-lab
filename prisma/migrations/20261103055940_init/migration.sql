-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'HOD', 'FACULTY', 'STUDENT');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('C', 'CPP', 'JAVA', 'PYTHON', 'JAVASCRIPT', 'HTML', 'CSS', 'SQL', 'SHELL', 'NONE');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('CODE', 'WEB', 'SQL', 'SHELL', 'NETWORK', 'DSA_VISUAL', 'NOTEBOOK', 'ANDROID', 'WRITTEN');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "AttemptKind" AS ENUM ('RUN', 'TEST', 'SUBMIT');

-- CreateEnum
CREATE TYPE "Verdict" AS ENUM ('ACCEPTED', 'WRONG_ANSWER', 'COMPILATION_ERROR', 'RUNTIME_ERROR', 'TIME_LIMIT_EXCEEDED', 'MEMORY_LIMIT_EXCEEDED', 'OUTPUT_LIMIT_EXCEEDED', 'PARTIAL', 'INTERNAL_ERROR', 'PENDING', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'EVALUATED', 'FINALIZED', 'REOPENED');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "enrollmentNo" TEXT,
    "employeeId" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "departmentId" TEXT,
    "batchId" TEXT,
    "extraTimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hodId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationSem" INTEGER NOT NULL DEFAULT 6,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Semester" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,

    CONSTRAINT "Semester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicSession" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AcademicSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "semesterId" TEXT,
    "academicSessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'code',
    "color" TEXT NOT NULL DEFAULT '#1d4ed8',
    "credits" INTEGER NOT NULL DEFAULT 1,
    "requiredExperiments" INTEGER NOT NULL DEFAULT 15,
    "hoursPerWeek" INTEGER NOT NULL DEFAULT 4,
    "sessionMinutes" INTEGER NOT NULL DEFAULT 120,
    "defaultLanguage" "Language" NOT NULL DEFAULT 'C',
    "languages" "Language"[],
    "defaultEnvironment" "Environment" NOT NULL DEFAULT 'CODE',
    "easyTarget" INTEGER NOT NULL DEFAULT 0,
    "mediumTarget" INTEGER NOT NULL DEFAULT 0,
    "hardTarget" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "departmentId" TEXT NOT NULL,
    "semesterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectFaculty" (
    "subjectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isCoordinator" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SubjectFaculty_pkey" PRIMARY KEY ("subjectId","userId")
);

-- CreateTable
CREATE TABLE "SubjectOffering" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "facultyId" TEXT,
    "requiredExperiments" INTEGER,
    "resultsFinalized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubjectOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentEnrollment" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentTopic" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ExperimentTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 120,
    "topicId" TEXT,
    "language" "Language" NOT NULL,
    "environment" "Environment" NOT NULL DEFAULT 'CODE',
    "objectives" TEXT[],
    "courseOutcomes" TEXT[],
    "learningOutcome" TEXT,
    "theory" JSONB NOT NULL,
    "problemStatement" TEXT NOT NULL,
    "algorithm" TEXT[],
    "pseudocode" TEXT,
    "flowchart" TEXT,
    "flowchartImage" TEXT,
    "starterCode" TEXT,
    "referenceCode" TEXT,
    "codeExplanation" TEXT,
    "sampleInput" TEXT,
    "sampleOutput" TEXT,
    "conclusion" TEXT,
    "showSolution" BOOLEAN NOT NULL DEFAULT false,
    "rubric" JSONB NOT NULL,
    "maxMarks" INTEGER NOT NULL DEFAULT 100,
    "timeLimitMs" INTEGER NOT NULL DEFAULT 2000,
    "memoryLimitKb" INTEGER NOT NULL DEFAULT 131072,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentVersion" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "editedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentResource" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "expected" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    "compareMode" TEXT NOT NULL DEFAULT 'TRIM',

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VivaQuestion" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VivaQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabSchedule" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 120,
    "room" TEXT,

    CONSTRAINT "LabSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticalSession" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 120,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startedAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "conductedById" TEXT,
    "isAssessment" BOOLEAN NOT NULL DEFAULT true,
    "marksReleaseAt" TIMESTAMP(3),
    "allowLate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticalSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionExtension" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionExtension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'AUTO',

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeDraft" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "code" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionAttempt" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "submissionId" TEXT,
    "kind" "AttemptKind" NOT NULL,
    "language" "Language" NOT NULL,
    "code" TEXT NOT NULL,
    "stdin" TEXT,
    "verdict" "Verdict" NOT NULL DEFAULT 'PENDING',
    "stdout" TEXT,
    "stderr" TEXT,
    "compileOutput" TEXT,
    "timeMs" INTEGER,
    "memoryKb" INTEGER,
    "testsPassed" INTEGER NOT NULL DEFAULT 0,
    "testsTotal" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "sessionId" TEXT,
    "language" "Language" NOT NULL,
    "code" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reopenCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationResult" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "verdict" "Verdict" NOT NULL,
    "testsPassed" INTEGER NOT NULL,
    "testsTotal" INTEGER NOT NULL,
    "weightPassed" INTEGER NOT NULL,
    "weightTotal" INTEGER NOT NULL,
    "timeMs" INTEGER,
    "memoryKb" INTEGER,
    "components" JSONB NOT NULL,
    "autoMarks" DOUBLE PRECISION NOT NULL,
    "manualMarks" DOUBLE PRECISION,
    "totalMarks" DOUBLE PRECISION NOT NULL,
    "maxMarks" INTEGER NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarkOverride" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "oldValue" DOUBLE PRECISION,
    "newValue" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarkOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacultyFeedback" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacultyFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "problemStatement" TEXT NOT NULL,
    "objectives" TEXT[],
    "requirements" TEXT[],
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "maxTeamSize" INTEGER NOT NULL DEFAULT 1,
    "rubric" JSONB NOT NULL,
    "maxMarks" INTEGER NOT NULL DEFAULT 100,
    "dueDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMilestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTeam" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "evaluation" JSONB,
    "marks" DOUBLE PRECISION,
    "vivaMarks" DOUBLE PRECISION,
    "evaluatedById" TEXT,
    "evaluatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTeamMember" (
    "teamId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "isLeader" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProjectTeamMember_pkey" PRIMARY KEY ("teamId","studentId")
);

-- CreateTable
CREATE TABLE "ProjectSubmission" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "kind" TEXT NOT NULL,
    "url" TEXT,
    "fileKey" TEXT,
    "fileName" TEXT,
    "notes" TEXT,
    "submittedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradingPolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "weights" JSONB NOT NULL,
    "bands" JSONB NOT NULL,
    "passPercent" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "minAttendancePercent" DOUBLE PRECISION NOT NULL DEFAULT 75,
    "tieBreak" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradingPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalResult" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "experimentsDone" INTEGER NOT NULL,
    "experimentsRequired" INTEGER NOT NULL,
    "experimentTotal" DOUBLE PRECISION NOT NULL,
    "experimentAvg" DOUBLE PRECISION NOT NULL,
    "attendancePercent" DOUBLE PRECISION NOT NULL,
    "projectMarks" DOUBLE PRECISION,
    "vivaMarks" DOUBLE PRECISION,
    "weightedScore" DOUBLE PRECISION NOT NULL,
    "grade" TEXT NOT NULL,
    "gradePoints" DOUBLE PRECISION NOT NULL,
    "outcome" TEXT NOT NULL,
    "rank" INTEGER,
    "status" "ResultStatus" NOT NULL DEFAULT 'DRAFT',
    "policyId" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedById" TEXT,
    "finalizedAt" TIMESTAMP(3),

    CONSTRAINT "FinalResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_enrollmentNo_key" ON "User"("enrollmentNo");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");

-- CreateIndex
CREATE INDEX "User_batchId_idx" ON "User"("batchId");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Department_hodId_key" ON "Department"("hodId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Semester_courseId_number_key" ON "Semester"("courseId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicSession_name_key" ON "AcademicSession"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_code_key" ON "Batch"("code");

-- CreateIndex
CREATE INDEX "Batch_courseId_idx" ON "Batch"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_code_key" ON "Subject"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_slug_key" ON "Subject"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectOffering_subjectId_batchId_academicSessionId_key" ON "SubjectOffering"("subjectId", "batchId", "academicSessionId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_studentId_idx" ON "StudentEnrollment"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentEnrollment_offeringId_studentId_key" ON "StudentEnrollment"("offeringId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentTopic_subjectId_name_key" ON "ExperimentTopic"("subjectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Experiment_code_key" ON "Experiment"("code");

-- CreateIndex
CREATE INDEX "Experiment_subjectId_difficulty_idx" ON "Experiment"("subjectId", "difficulty");

-- CreateIndex
CREATE INDEX "Experiment_status_idx" ON "Experiment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Experiment_subjectId_number_key" ON "Experiment"("subjectId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentVersion_experimentId_version_key" ON "ExperimentVersion"("experimentId", "version");

-- CreateIndex
CREATE INDEX "PracticalSession_status_idx" ON "PracticalSession"("status");

-- CreateIndex
CREATE INDEX "PracticalSession_scheduledStart_idx" ON "PracticalSession"("scheduledStart");

-- CreateIndex
CREATE UNIQUE INDEX "PracticalSession_offeringId_sequence_key" ON "PracticalSession"("offeringId", "sequence");

-- CreateIndex
CREATE INDEX "SessionExtension_sessionId_studentId_idx" ON "SessionExtension"("sessionId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_sessionId_studentId_key" ON "Attendance"("sessionId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CodeDraft_studentId_experimentId_language_key" ON "CodeDraft"("studentId", "experimentId", "language");

-- CreateIndex
CREATE INDEX "SubmissionAttempt_studentId_experimentId_idx" ON "SubmissionAttempt"("studentId", "experimentId");

-- CreateIndex
CREATE INDEX "SubmissionAttempt_createdAt_idx" ON "SubmissionAttempt"("createdAt");

-- CreateIndex
CREATE INDEX "Submission_experimentId_idx" ON "Submission"("experimentId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_studentId_sessionId_key" ON "Submission"("studentId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationResult_submissionId_key" ON "EvaluationResult"("submissionId");

-- CreateIndex
CREATE INDEX "ProjectTeamMember_studentId_idx" ON "ProjectTeamMember"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "GradingPolicy_name_key" ON "GradingPolicy"("name");

-- CreateIndex
CREATE INDEX "FinalResult_offeringId_rank_idx" ON "FinalResult"("offeringId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "FinalResult_offeringId_studentId_key" ON "FinalResult"("offeringId", "studentId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Semester" ADD CONSTRAINT "Semester_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectFaculty" ADD CONSTRAINT "SubjectFaculty_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectFaculty" ADD CONSTRAINT "SubjectFaculty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectOffering" ADD CONSTRAINT "SubjectOffering_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectOffering" ADD CONSTRAINT "SubjectOffering_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectOffering" ADD CONSTRAINT "SubjectOffering_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "SubjectOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentTopic" ADD CONSTRAINT "ExperimentTopic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "ExperimentTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentVersion" ADD CONSTRAINT "ExperimentVersion_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentResource" ADD CONSTRAINT "ExperimentResource_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VivaQuestion" ADD CONSTRAINT "VivaQuestion_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabSchedule" ADD CONSTRAINT "LabSchedule_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "SubjectOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticalSession" ADD CONSTRAINT "PracticalSession_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "SubjectOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticalSession" ADD CONSTRAINT "PracticalSession_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticalSession" ADD CONSTRAINT "PracticalSession_conductedById_fkey" FOREIGN KEY ("conductedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExtension" ADD CONSTRAINT "SessionExtension_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PracticalSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExtension" ADD CONSTRAINT "SessionExtension_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExtension" ADD CONSTRAINT "SessionExtension_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PracticalSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeDraft" ADD CONSTRAINT "CodeDraft_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeDraft" ADD CONSTRAINT "CodeDraft_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionAttempt" ADD CONSTRAINT "SubmissionAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionAttempt" ADD CONSTRAINT "SubmissionAttempt_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionAttempt" ADD CONSTRAINT "SubmissionAttempt_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PracticalSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationResult" ADD CONSTRAINT "EvaluationResult_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkOverride" ADD CONSTRAINT "MarkOverride_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "EvaluationResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkOverride" ADD CONSTRAINT "MarkOverride_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacultyFeedback" ADD CONSTRAINT "FacultyFeedback_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacultyFeedback" ADD CONSTRAINT "FacultyFeedback_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTeam" ADD CONSTRAINT "ProjectTeam_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTeam" ADD CONSTRAINT "ProjectTeam_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "SubjectOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTeamMember" ADD CONSTRAINT "ProjectTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ProjectTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTeamMember" ADD CONSTRAINT "ProjectTeamMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSubmission" ADD CONSTRAINT "ProjectSubmission_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ProjectTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSubmission" ADD CONSTRAINT "ProjectSubmission_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ProjectMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalResult" ADD CONSTRAINT "FinalResult_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "SubjectOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalResult" ADD CONSTRAINT "FinalResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
