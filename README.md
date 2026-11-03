# JECRC Virtual Computer Laboratory (JECRC VLab)

**Learn. Experiment. Code. Evaluate. Innovate.**

A web platform for JECRC University's Department of Computer Applications where students learn lab concepts, write and run code in the browser, sit timed practical examinations and complete final projects, and where faculty schedule practicals, evaluate work and publish results.

Project owner: Rajkumar Sharma, Assistant Professor, Department of Computer Applications, JECRC University, Jaipur.

## What it does

| Area | Highlights |
|---|---|
| Laboratories | 14 labs, 40 catalogued experiments each (46 fully written and published, the rest drafts for faculty to complete or import). Every experiment uses the 11-section format: aim, theory, problem, algorithm, pseudocode, flowchart, code, I/O, test cases, result, viva. |
| Online compiler | Monaco editor; C, C++, Java, Python, JavaScript, SQL (SQLite), Bash run in an isolated sandbox; HTML/CSS/JS preview in a sandboxed frame. |
| Timed practicals | 120-minute sessions with a server-side clock, warnings at 30/15/5/1 minutes, autosave, per-student extensions and accessibility extra time, reopen with reason, absentees marked automatically. |
| Evaluation | Configurable rubric (default 40/20/10/10/10/10). Test cases, compilation and on-time submission are marked automatically; logic, quality and efficiency by faculty. Overrides need a reason and are audited. Marks are released to students only when faculty release them. |
| Credits | 1 credit = 15 practicals, 2 credits = 30. Labs run 4 h/week as two 2-hour sessions, one experiment per session. Overridable per lab or class. |
| Projects | Individual or group projects, milestones, link/file submissions, rubric evaluation. |
| Results | Weighted final score (practicals 55, project 25, viva 10, attendance 10 by default), grade bands, detention below minimum attendance, competition ranking with shared ranks for ties, draft → finalize → (admin) unlock, PDF/Excel/CSV export. |
| Faculty tools | Dashboard, class roster and viva marks, live practical monitor, review queue, question bank with CSV/Excel import/export and version history, experiment editor with live flowchart preview and reference-solution check, reports. |
| Administration | Users (create, import, reset password, deactivate), academic structure (departments, courses, sessions, batches, classes), laboratories and credits, faculty assignment, grading policy, branding and exam rules, audit log. |

## Get a public link (about 15 minutes)

1. Rent a small Linux server: Ubuntu 24.04, 2+ vCPU, 4 GB RAM (for example Hetzner CX22, DigitalOcean, AWS Lightsail or a university VM).
2. Open the server's web console (or SSH) and run:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/cswithraj/jecrc-v-lab/main/deploy/install.sh | sudo bash
   ```
3. Wait for the build to finish, then open the printed link, e.g. `https://203-0-113-5.sslip.io`. HTTPS is set up automatically.

Use `DOMAIN=vlab.your-college.edu` before `bash` (with the domain's DNS pointing at the server) for your own address, and `DEMO=false` for a clean install without demo accounts.

### Free option: Netlify

No server? Deploy free on Netlify + Neon (database) + Judge0 on RapidAPI (code running). Good for demos and small trials: about 50 code runs a day and no file uploads. Step-by-step guide: [docs/NETLIFY.md](docs/NETLIFY.md).

## Quick start with Docker (recommended)

Requirements: Docker 24+ with Compose.

```bash
git clone https://github.com/cswithraj/jecrc-v-lab.git && cd jecrc-v-lab
cp .env.docker.example .env.docker      # then edit the passwords/secrets
# For a demo install with sample data, set SEED_DEMO=true in .env.docker
docker compose --env-file .env.docker up -d --build
```

Open http://localhost (or the `APP_URL` you set). First start takes a few minutes to build images.

## Demo accounts

Created only when `SEED_DEMO=true` (or `npm run db:seed`). All use the password **`Demo@1234`** and cannot change it. Remove them before going live.

| Role | Email |
|---|---|
| Super admin | admin@vlab.demo |
| HOD | hod@vlab.demo |
| Faculty (C++, DSA, C, Web) | faculty@vlab.demo |
| Faculty (Python, OS, Java, AI/ML, Crypto) | faculty2@vlab.demo |
| Student (BCA) | student@vlab.demo, student02…student24@vlab.demo |
| Student (MCA) | mca01…mca10@vlab.demo |

## Local development

Requirements: Node.js 22, PostgreSQL 16, and for code execution gcc/g++, JDK 17+, Python 3 and util-linux on Linux.

```bash
npm install                     # also generates the Prisma client and copies Monaco into public/
cp .env.example .env            # set DATABASE_URL and RUNNER_SECRET
npm run db:migrate && npm run db:seed
npm run runner                  # terminal 1: code runner on :4100 (run as root on Linux for full isolation)
npm run dev                     # terminal 2: app on http://localhost:3000
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md): components, decisions, security model, risks
- [ER diagram](docs/ER-DIAGRAM.md): data model and constraints
- [API reference](docs/API.md)
- [Deployment](docs/DEPLOYMENT.md): Docker, HTTPS, backups, scaling, hardening checklist
- [Free Netlify deploy](docs/NETLIFY.md): Netlify + Neon + Judge0, free-tier limits
- [Testing](docs/TESTING.md): what is tested and how to run it
- [Roadmap](docs/ROADMAP.md): phase status and known limitations

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · PostgreSQL 16 + Prisma · Monaco Editor · Recharts · Mermaid · ExcelJS · PDFKit · a separate sandboxed runner service (or Judge0).

## Branding

The JECRC University logo and red theme are defaults. Administrators can change the name, logos, colours, motto and contact details under **Platform settings** without touching code. The learning approach is inspired by the national Virtual Labs initiative; no code, content or design from vlab.co.in is used.
