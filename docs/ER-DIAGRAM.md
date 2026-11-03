# Entity-relationship diagram

Primary keys are `id` (cuid) unless noted; composite keys are marked. Full constraints and indexes are in `prisma/schema.prisma`.

```mermaid
erDiagram
  Department ||--o{ Course : offers
  Department ||--o{ Subject : owns
  Department ||--o{ User : employs
  Course ||--o{ Semester : has
  Course ||--o{ Batch : has
  AcademicSession ||--o{ Batch : runs
  Semester ||--o{ Subject : maps
  Batch ||--o{ User : "students (home batch)"
  Subject ||--o{ ExperimentTopic : groups
  Subject ||--o{ Experiment : contains
  Subject ||--o{ SubjectFaculty : "assigned faculty"
  User ||--o{ SubjectFaculty : teaches
  Subject ||--o{ SubjectOffering : "taught as"
  Batch ||--o{ SubjectOffering : takes
  AcademicSession ||--o{ SubjectOffering : in
  SubjectOffering ||--o{ StudentEnrollment : enrolls
  User ||--o{ StudentEnrollment : "is enrolled"
  SubjectOffering ||--o{ LabSchedule : "weekly slots"
  SubjectOffering ||--o{ PracticalSession : schedules
  Experiment ||--o{ PracticalSession : "assigned to"
  ExperimentTopic ||--o{ Experiment : tags
  Experiment ||--o{ TestCase : "public & hidden"
  Experiment ||--o{ VivaQuestion : has
  Experiment ||--o{ ExperimentResource : has
  Experiment ||--o{ ExperimentVersion : "history"
  PracticalSession ||--o{ Attendance : records
  PracticalSession ||--o{ SessionExtension : grants
  PracticalSession ||--o{ Submission : receives
  User ||--o{ Submission : submits
  User ||--o{ CodeDraft : autosaves
  User ||--o{ SubmissionAttempt : runs
  Submission ||--o{ SubmissionAttempt : "graded attempt"
  Submission ||--o| EvaluationResult : "evaluated as"
  EvaluationResult ||--o{ MarkOverride : "audited changes"
  Submission ||--o{ FacultyFeedback : receives
  Subject ||--o{ Project : "final project"
  Project ||--o{ ProjectMilestone : has
  Project ||--o{ ProjectTeam : "allocated to"
  SubjectOffering ||--o{ ProjectTeam : within
  ProjectTeam ||--o{ ProjectTeamMember : has
  ProjectTeam ||--o{ ProjectSubmission : uploads
  ProjectMilestone ||--o{ ProjectSubmission : for
  SubjectOffering ||--o{ FinalResult : produces
  User ||--o{ FinalResult : "result & rank"
  GradingPolicy ||--o{ FinalResult : "computed with"
  User ||--o{ Notification : receives
  User ||--o{ AuditLog : performs
  User ||--o{ AuthSession : "logged in"
```

## Key constraints

| Table | Unique / constraint | Purpose |
|---|---|---|
| User | email, enrollmentNo, employeeId | One account per person |
| Experiment | (subjectId, number), code | Stable experiment numbering per lab |
| SubjectOffering | (subjectId, batchId, academicSessionId) | One class per lab/batch/term |
| StudentEnrollment | (offeringId, studentId) | No duplicate enrollment |
| PracticalSession | (offeringId, sequence) | Practical #1..N per class |
| Attendance | (sessionId, studentId) | One record per student per practical |
| Submission | (studentId, sessionId) | **One graded submission per practical** (practice submissions have no session) |
| EvaluationResult | submissionId | One evaluation per submission |
| CodeDraft | (studentId, experimentId, language) | Autosave slot |
| FinalResult | (offeringId, studentId) | One result per student per class |
| ProjectTeamMember | (teamId, studentId) PK | Team membership |
| SubjectFaculty | (subjectId, userId) PK | Faculty assignment |

Indexes cover role/department lookups, experiment filtering (subject, difficulty, status), attempt history
(student, experiment), sessions by status/date, notifications by (user, read), audit by entity/actor/date.
