// End-to-end API checks against a running app (BASE_URL) with demo seed data and the runner up.
// Covers: auth, RBAC denials, timed practical submission rules, duplicate prevention, reopen, extension, data isolation.
const BASE = process.env.BASE_URL || "http://localhost:3000";
let fails = 0;
const check = (name: string, ok: boolean, detail?: unknown) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); if (!ok) { fails++; console.log("      ", JSON.stringify(detail)?.slice(0, 500)); } };

class Client {
  cookie = "";
  async login(email: string) {
    const r = await fetch(`${BASE}/api/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ email, password: "Demo@1234" }) });
    this.cookie = (r.headers.get("set-cookie") ?? "").split(";")[0];
    return r.status;
  }
  async req(method: string, path: string, body?: unknown) {
    const r = await fetch(`${BASE}${path}`, { method, headers: { cookie: this.cookie, "content-type": "application/json", origin: BASE }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, data: await r.json().catch(() => null) };
  }
}

(async () => {
  const anon = new Client();
  check("Unauthenticated API → 401", (await anon.req("POST", "/api/v1/run", { language: "C", code: "", stdin: "" })).status === 401);
  const bad = new Client();
  check("Wrong password → 401", (await fetch(`${BASE}/api/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ email: "student@vlab.demo", password: "nope" }) })).status === 401);

  const fac = new Client(); await fac.login("faculty2@vlab.demo");
  const fac1 = new Client(); await fac1.login("faculty@vlab.demo");
  const stu = new Client(); await stu.login("student03@vlab.demo");
  const stu2 = new Client(); await stu2.login("student04@vlab.demo");

  // Students cannot use staff endpoints
  const list = await fac.req("GET", "/api/v1/faculty/offerings");
  const offerings = list.data?.items ?? [];
  const py = offerings.find((o: { subject: { slug: string } }) => o.subject.slug === "python-programming");
  check("Faculty lists own classes", !!py, list);
  check("Faculty1 cannot see faculty2's Python class", !((await fac1.req("GET", "/api/v1/faculty/offerings")).data?.items ?? []).some((o: { id: string }) => o.id === py?.id));
  check("Student blocked from staff endpoint", (await stu.req("GET", "/api/v1/faculty/offerings")).status === 403);

  // Create a practical, verify students can't submit before start
  const exps = await fac.req("GET", `/api/v1/experiments?subject=python-programming&status=PUBLISHED&pageSize=50`);
  const exp = exps.data.items.find((e: { number: number }) => e.number === 6);
  const created = await fac.req("POST", "/api/v1/sessions", { offeringId: py.id, experimentId: exp.id, scheduledStart: new Date().toISOString(), durationMin: 120 });
  check("Faculty schedules practical", created.status === 200, created);
  const sid = created.data.id;
  check("Faculty1 cannot start faculty2's session", (await fac1.req("POST", `/api/v1/sessions/${sid}/start`)).status === 403);
  const code = 'text = input()\ncounts = {}\nfor w in text.lower().split():\n    counts[w] = counts.get(w, 0) + 1\nfor w in sorted(counts):\n    print(f"{w}: {counts[w]}")\n';
  const early = await stu.req("POST", "/api/v1/submissions", { experimentId: exp.id, language: "PYTHON", code, sessionId: sid });
  check("Submit before start → 403", early.status === 403, early);
  // Another class live? end it first so start succeeds
  const live = (await fac.req("GET", `/api/v1/faculty/offerings/${py.id}/sessions`)).data?.items?.find((s: { status: string; id: string }) => s.status === "LIVE");
  if (live) await fac.req("POST", `/api/v1/sessions/${live.id}/end`);
  const started = await fac.req("POST", `/api/v1/sessions/${sid}/start`);
  check("Faculty starts session", started.status === 200 && started.data.status === "LIVE", started);
  const st = await stu.req("POST", `/api/v1/sessions/${sid}/join`);
  check("Student joins → server deadline ~120 min", st.status === 200 && Math.abs(new Date(st.data.deadline).getTime() - Date.now() - 120 * 60_000) < 60_000, st.data);
  const sub = await stu.req("POST", "/api/v1/submissions", { experimentId: exp.id, language: "PYTHON", code, sessionId: sid });
  check("Practical submission accepted and graded", sub.status === 200 && sub.data.verdict === "ACCEPTED" && sub.data.marks === null, sub.data);
  check("Hidden test inputs redacted for student", sub.data.tests.filter((t: { hidden: boolean }) => t.hidden).every((t: { input?: string }) => t.input === undefined));
  const dup = await stu.req("POST", "/api/v1/submissions", { experimentId: exp.id, language: "PYTHON", code, sessionId: sid });
  check("Duplicate submission → 409", dup.status === 409, dup);
  const wrongExp = await stu2.req("POST", "/api/v1/submissions", { experimentId: exps.data.items[0].id === exp.id ? exps.data.items[1].id : exps.data.items[0].id, language: "PYTHON", code, sessionId: sid });
  check("Submitting a different experiment to the session → 400", wrongExp.status === 400, wrongExp);
  const studentReopen = await stu.req("POST", `/api/v1/sessions/${sid}/reopen`, { studentId: "x", reason: "self" });
  check("Student cannot reopen", studentReopen.status === 404 || studentReopen.status === 403, studentReopen);
  const me = (await stu.req("GET", "/api/v1/auth/me")).data.user;
  const re = await fac.req("POST", `/api/v1/sessions/${sid}/reopen`, { studentId: me.id, reason: "Integration test" });
  check("Faculty reopens submission", re.status === 200 && re.data.status === "REOPENED", re);
  const resub = await stu.req("POST", "/api/v1/submissions", { experimentId: exp.id, language: "PYTHON", code: code.replace("sorted(counts)", "counts"), sessionId: sid });
  check("Resubmission after reopen accepted (graded again)", resub.status === 200, resub);
  const ext = await fac.req("POST", `/api/v1/sessions/${sid}/extend`, { studentId: me.id, minutes: 15, reason: "Integration test" });
  const st2 = await stu.req("GET", `/api/v1/sessions/${sid}/status`);
  check("Per-student extension moves only their deadline", ext.status === 200 && st2.data.extensionMinutes === 15 && new Date(st2.data.deadline).getTime() - new Date(st.data.deadline).getTime() === 15 * 60_000, st2.data);
  const mon = await fac.req("GET", `/api/v1/sessions/${sid}/monitor`);
  check("Monitor shows submission", mon.data.students.some((s: { id: string; submission: unknown }) => s.id === me.id && s.submission), mon.data?.students?.length);
  const ended = await fac.req("POST", `/api/v1/sessions/${sid}/end`);
  check("Faculty ends session", ended.status === 200 && ended.data.status === "ENDED", ended);
  const late = await stu2.req("POST", "/api/v1/submissions", { experimentId: exp.id, language: "PYTHON", code, sessionId: sid });
  check("Submission after end → 403", late.status === 403, late);
  const mon2 = await fac.req("GET", `/api/v1/sessions/${sid}/monitor`);
  check("Absentees marked on end", mon2.data.students.filter((s: { attendance: string }) => s.attendance === "ABSENT").length >= 20);

  // Data isolation: student cannot read another student's submission
  const other = await stu2.req("GET", `/api/v1/submissions/${sub.data.submissionId}`);
  check("Student cannot read another student's submission", other.status === 404 || other.status === 403, other);
  const own = await stu.req("GET", `/api/v1/submissions/${sub.data.submissionId}`);
  check("Student can read own submission", own.status === 200, own);
  // Marks hidden until release
  check("Marks hidden before release", own.data?.evaluation?.totalMarks == null, own.data?.evaluation);

  console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
  process.exit(fails ? 1 : 0);
})();
