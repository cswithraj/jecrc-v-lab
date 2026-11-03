# Phased implementation checklist

Status legend: ✅ done and tested · 🟡 partial · ⬜ not started. This file is updated at the end of each phase.

## Phase 1 — Requirements & architecture
- ✅ Reference analysis, decisions, architecture, risks (`ARCHITECTURE.md`)
- ✅ Relational schema with constraints/indexes, migrations (`prisma/`)
- ✅ ER diagram (`ER-DIAGRAM.md`)
- ✅ Roadmap and dependencies

## Phase 2 — UI/UX & frontend
- ✅ Design system (JECRC theme, light/dark, components)
- ⬜ Landing, login, dashboards, lab and experiment pages, responsive layout

## Phase 3 — Backend & database
- ✅ Session auth, password hashing, lockout; RBAC matrix + ownership checks
- ✅ Seed: 14 labs × 40 experiments (46 full, 514 draft outlines), demo users/batches/classes/history
- ⬜ REST APIs for subjects, experiments, scheduling, enrollment, admin

## Phase 4 — Online compiler
- ✅ Sandbox runner: C, C++, Java, Python, JavaScript, SQL (SQLite), Bash; security smoke tests
- ✅ Judge0 provider (configurable)
- ✅ Content verification: all reference solutions pass their own tests
- ⬜ Monaco editor UI, run/test/submit, history; web preview; notebook

## Phase 5 — Practical assessment
- ✅ Server-side timer logic, rubric/evaluation logic
- ⬜ Session start/stop, extensions, monitoring, faculty review, overrides

## Phase 6 — Projects  ⬜
## Phase 7 — Results & analytics  🟡 (grading/ranking logic done)
## Phase 8 — Testing & deployment  ⬜
