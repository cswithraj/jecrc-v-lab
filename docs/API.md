# API reference (v1)

Base path: `/api/v1`. JSON in and out unless noted. All endpoints except `auth/login` need a signed-in session (httpOnly cookie `vlab_session`, set by login).

**Conventions**
- **CSRF:** state-changing requests must send an `Origin` header matching the host (browsers do this automatically).
- **Errors:** `{ "error": "message", "details"?: … }` with 400 (bad input), 401 (not signed in), 403 (not allowed), 404 (not found or not visible to you), 409 (conflict, e.g. finalized), 413 (too large), 422 (validation: `details.fieldErrors`), 429 (rate limited), 503 (code runner unavailable).
- **Pagination:** `?page=1&pageSize=20` → `{ items, total, page, pageSize }`.
- **Authorization:** every handler goes through `route()` in `src/lib/api.ts` (role/permission check) and ownership checks (`canManageSubject`, `canManageOffering`). Students only see their own data; hidden test cases, reference solutions (unless enabled) and unreleased marks are never sent to students.

Example:

```bash
curl -c jar -H 'Origin: http://localhost:3000' -H 'Content-Type: application/json' \
  -d '{"email":"student@vlab.demo","password":"Demo@1234"}' http://localhost:3000/api/v1/auth/login
curl -b jar -H 'Origin: http://localhost:3000' -H 'Content-Type: application/json' \
  -d '{"language":"PYTHON","code":"print(input()[::-1])","stdin":"lab"}' http://localhost:3000/api/v1/run
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | `{ email, password }` → session cookie, `{ ok, redirect }`. 5 failures lock the account for 15 minutes. |
| POST | `/auth/logout` | End the session. |
| POST | `/admin/academics/:kind` | \| courses \| sessions \| batches |
| PUT | `/admin/grading` | update the default grading policy (applies to results computed afterwards). |
| POST | `/admin/offerings` | create a class (lab × batch × session), optionally enrolling the whole batch. |
| POST | `/admin/sessions/:id/current` | mark an academic session as the current one. |
| PUT | `/admin/settings` | { key: "institution" \| "examRules", value } — super admin only. |
| PUT | `/admin/subjects/:id/faculty` | replace the faculty assigned to a laboratory (first = coordinator). |
| PATCH | `/admin/subjects/:id` | credits, required practicals, difficulty targets, timing, status. |
| POST | `/admin/subjects` | new laboratory; required practicals default to credits × 15. |
| POST | `/admin/users/:id/reset-password` | issues a temporary password and signs the user out everywhere. |
| PATCH | `/admin/users/:id` | role, status, IDs, batch, extra exam time (audited). |
| POST | `/admin/users/import` | (multipart file=.csv) — bulk create users. |
| GET/POST | `/admin/users` | HODs see their department only. create; returns a one-time temporary password when none was given. |
| GET | `/auth/me` | Current user. |
| POST | `/auth/password` | change own password; signs out every other session. |
| PUT/GET | `/drafts` | autosave the current student's code. GET ?experimentId= — load drafts. |
| POST | `/experiments/:id/:action` | \| unpublish \| archive \| duplicate |
| GET/PUT/DELETE | `/experiments/:id` | full record for managing staff; student-safe view otherwise. full update; previous version is kept in history. deletes, or archives if it has sessions/submissions. |
| GET | `/experiments/export` | question bank export. |
| POST | `/experiments/import` | (multipart: subjectId, file=.csv\|.xlsx) — bulk create/update as drafts. |
| GET/POST | `/experiments` | GET `?subject=&q=&difficulty=&topic=&language=&status=&page=` (students: published only). POST: create a draft experiment (full experiment JSON, see `ExperimentInput` in `src/lib/services/experiments.ts`). |
| POST | `/experiments/validate` | staff check that a reference solution passes the test cases (nothing is stored). |
| GET | `/faculty/offerings/:id/sessions` | all practicals of a class. |
| GET | `/faculty/offerings` | classes the current staff member manages. |
| POST | `/notifications/announce` | staff announcement to every student in a class. |
| POST | `/notifications/read` | { ids?: string[], all?: true } — mark own notifications read. |
| GET | `/notifications` | the current user's notifications, newest first. |
| POST/GET | `/offerings/:id/results/:action` | \| finalize \| unlock  |
| GET | `/offerings/:id/results` | stored results plus a live preview of what a recompute would give (staff). |
| PUT | `/offerings/:id/viva` | end-of-lab viva marks (out of 100) for students in the class. |
| GET | `/projects/files/:id` | download an uploaded project file (members and managing staff). |
| POST | `/projects/start` | a student starts an individual project. |
| POST | `/projects/teams/:id/evaluate` | staff rubric marks; total and viva are derived. |
| GET/DELETE | `/projects/teams/:id` | team, project brief, milestones, submissions (members and managing staff). staff; not allowed once evaluated. |
| POST | `/projects/teams/:id/submissions` | (multipart: kind, url?, notes?, milestoneId?, file?) — team members. |
| POST | `/projects/teams` | staff form a project team in a class. |
| POST | `/run` | compile & run code with custom input in the sandbox. |
| POST/GET | `/sessions/:id/:action` | POST `start` \| `end` \| `extend` `{studentId?, minutes, reason}` \| `reopen` `{studentId, reason}` \| `release` (staff); POST `join` (student, records attendance). GET `status` (student timer sync with server time) \| `monitor` (staff live board). |
| POST | `/sessions` | schedule a practical session for a class. |
| POST | `/submissions/:id/:action` | \| feedback \| finalize — staff evaluation actions. |
| GET | `/submissions/:id` | students: own only (marks after release); staff: if they manage the class. |
| POST/GET | `/submissions` | graded submission (practical if sessionId, else practice). the current student's own submission history. |
| POST | `/test` | run code against the experiment's public sample tests. |

## Code runner service (internal)

`services/runner` listens on `RUNNER_PORT` (4100) and is reachable only from the web app.

- `GET /health` → `{ ok, active, queued, isRoot, unshareNet, vrun }`
- `POST /execute` with `Authorization: Bearer $RUNNER_SECRET` and `{ language, source, inputs: string[], timeLimitMs, memoryLimitKb }` → compile result plus one result per input (`status` OK / RUNTIME_ERROR / TIME_LIMIT / MEMORY_LIMIT / OUTPUT_LIMIT, stdout, stderr, timeMs, memoryKb). Returns 429 when the queue is full.
