# Testing

All results below are from the build of 3 Nov 2026 on Linux (Node 22, PostgreSQL 16).

| Suite | Command | What it covers | Result |
|---|---|---|---|
| Type check | `npm run typecheck` | Whole codebase incl. runner, seed and tests | clean |
| Unit tests | `npm test` | Output comparison modes, test grading and verdicts, rubric marks, student redaction, timer deadlines/extensions/grace, final result computation, detention/incomplete rules, grade bands, competition ranking with ties | 27/27 pass |
| Runner security smoke | `RUNNER_SECRET=… npx tsx tests/runner.smoke.ts` | All 7 languages compile/run; time limit, memory limit, output limit; no network; cannot write outside the job directory; not root; fork bomb contained and the next job still runs; compile errors; bad secret rejected | 17/17 pass |
| Content verification | `npx tsx tests/verify-content.ts` | Every executable reference solution passes its own public and hidden tests | 40/40 pass |
| End-to-end API | `BASE_URL=http://localhost:3000 npx tsx tests/e2e-api.ts` | Auth and lockout basics, RBAC denials, class isolation between faculty, timed practical rules (no submit before start, duplicate 409, wrong experiment 400, end blocks submission, reopen, per-student extension, absentees marked), submission privacy, marks hidden before release, results permissions/compute/ranking/PDF export, viva validation, admin permission boundaries (HOD vs super admin, grading validation, settings), project permissions | 37/37 pass |
| Production build | `npm run build` then `node .next/standalone/server.js` | Standalone server serves pages, Monaco, code execution and PDF/Excel/CSV exports | pass |

The end-to-end suite and runner smoke test need the demo seed (`npm run db:seed`) and the runner (`npm run runner`) running. The e2e suite creates practical sessions in the Python class, so run it against a scratch database.

## Browser checks

Every page was rendered in Chromium (Playwright) at desktop width in light and dark mode as student, faculty, HOD and admin, with no console errors. Interactive flows were driven in the browser: experiment editor (reference-solution check, save as new version, create draft), question bank publish/import, project start → submission with file upload → download → faculty evaluation → isolation from other students, admin settings/grading/user creation.

## Not verified here

- **Docker images were not built in the build environment.** Its network policy blocks the Debian package mirrors that `apt-get` needs inside `docker build`. `docker compose config` validates, and the same production server (standalone build + full production `node_modules`, as the Dockerfile does) was run and tested directly. Run `docker compose --env-file .env.docker up --build` once on the target server and check `/admin` → System status shows the runner online.
- Load testing (many simultaneous practical submissions) has not been done. Recommended before the first full-class examination: 60 virtual students submitting within the same minute with k6 or Artillery against a staging server.
- Mobile Safari and Firefox were not tested; Chromium only.
