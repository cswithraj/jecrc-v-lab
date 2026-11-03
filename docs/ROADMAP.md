# Phased implementation status

Legend: ✅ done and tested · 🟡 partial · ⬜ not started. See [TESTING.md](TESTING.md) for what "tested" means for each item.

## Phase 1 — Requirements & architecture ✅
Architecture and risks (`ARCHITECTURE.md`), relational schema with constraints and migrations, ER diagram.

## Phase 2 — UI/UX & frontend ✅
JECRC theme (configurable branding), light/dark mode, responsive layout; landing, login, dashboards for every role, lab and experiment pages.

## Phase 3 — Backend & database ✅
Session auth with hashing and lockout, RBAC with ownership checks, REST APIs for every module, audit log, seed with 14 labs × 40 experiments (46 full, 514 draft outlines) and demo data.

## Phase 4 — Online compiler ✅
Sandboxed runner (C, C++, Java, Python, JavaScript, SQL, Bash) and Judge0 option; Monaco editor with run/test/submit, autosave, formatting; HTML/CSS/JS preview.
🟡 Notebook, network simulator, DSA visualiser and Android environments are selectable per experiment but run as code/written work; dedicated tools are future work.

## Phase 5 — Practical assessment ✅
Scheduling, server-side timer and warnings, start/end, extensions, extra time, reopen, live monitor, automatic + faculty evaluation, overrides with reason, feedback, finalize, timed marks release.

## Phase 6 — Projects ✅
Individual and group projects, milestones, link/file submissions (local storage driver), rubric evaluation feeding final results.

## Phase 7 — Results & analytics ✅
Final result computation by grading policy, detention/incomplete rules, competition ranking, draft → finalize → unlock, PDF/Excel/CSV export, reports, faculty and admin dashboards.

## Phase 8 — Testing & deployment 🟡
✅ Unit, runner security, content and end-to-end API suites; production build verified; Docker Compose, Nginx, deployment/API/testing docs.
⬜ Docker images built on a real server (blocked in the build environment), load test, cross-browser testing.

## Known limitations / next steps
- Only the `local` file storage driver is implemented (S3 is not).
- Rate limiting is in-memory per instance; use Redis before running several web instances.
- 514 of the 560 catalogued experiments are draft outlines that faculty need to complete (editor or CSV/Excel import) before publishing.
- Email notifications are not sent; notifications are in-app only.
