// Runner smoke + security tests. Run: RUNNER_URL=… RUNNER_SECRET=… npx tsx tests/runner.smoke.ts
const URL = process.env.RUNNER_URL || "http://localhost:4100";
const SECRET = process.env.RUNNER_SECRET || "dev-runner-secret-0123456789";
async function ex(language: string, source: string, inputs: string[] = [""], extra: object = {}) {
  const r = await fetch(`${URL}/execute`, { method: "POST", headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" }, body: JSON.stringify({ language, source, inputs, ...extra }) });
  return r.json();
}
let fails = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) { fails++; console.log("      ", JSON.stringify(detail).slice(0, 600)); }
}
(async () => {
  let r = await ex("C", '#include <stdio.h>\nint main(){int a,b;scanf("%d %d",&a,&b);printf("%d\\n",a+b);}', ["2 3", "10 20"]);
  check("C sum two tests", r.runs?.[0]?.stdout === "5\n" && r.runs?.[1]?.stdout === "30\n", r);
  r = await ex("CPP", "#include <iostream>\nint main(){int n;std::cin>>n;std::cout<<n*n<<std::endl;}", ["7"]);
  check("C++ square", r.runs?.[0]?.stdout === "49\n", r);
  r = await ex("JAVA", "import java.util.*;public class Main{public static void main(String[] a){Scanner s=new Scanner(System.in);System.out.println(s.nextInt()*2);}}", ["21"]);
  check("Java double", r.runs?.[0]?.stdout === "42\n", r);
  r = await ex("PYTHON", "print(sum(map(int,input().split())))", ["1 2 3"]);
  check("Python sum", r.runs?.[0]?.stdout === "6\n", r);
  r = await ex("JAVASCRIPT", "const d=require('fs').readFileSync(0,'utf8');console.log(d.trim().toUpperCase())", ["hi"]);
  check("JS upper", r.runs?.[0]?.stdout === "HI\n", r);
  r = await ex("SQL", "SELECT name FROM s ORDER BY name;", ["CREATE TABLE s(name TEXT); INSERT INTO s VALUES('b'),('a');"]);
  check("SQL select", r.runs?.[0]?.stdout === "name\na\nb\n", r);
  r = await ex("SHELL", "read x; echo $((x+1))", ["41"]);
  check("Shell arithmetic", r.runs?.[0]?.stdout === "42\n", r);
  r = await ex("C", "int main(){int x=1", [""]);
  check("C compile error detected", r.compile?.ok === false && /error/.test(r.compile.output), r);
  // ── security ──
  r = await ex("C", "int main(){while(1);}", [""], { timeLimitMs: 1000 });
  check("Infinite loop -> TLE", r.runs?.[0]?.status === "TIME_LIMIT_EXCEEDED", r);
  r = await ex("PYTHON", "x=bytearray(400*1024*1024)\nprint(len(x))", [""], { memoryLimitKb: 65536 });
  check("Memory bomb -> MLE", r.runs?.[0]?.status === "MEMORY_LIMIT_EXCEEDED", r);
  r = await ex("PYTHON", "while True: print('A'*1000)", [""]);
  check("Output flood -> OLE", r.runs?.[0]?.status === "OUTPUT_LIMIT_EXCEEDED", r);
  r = await ex("PYTHON", "import urllib.request\nurllib.request.urlopen('http://example.com',timeout=3)\nprint('NET')", [""]);
  check("Network blocked", !r.runs?.[0]?.stdout.includes("NET") && r.runs?.[0]?.status === "RUNTIME_ERROR", r);
  r = await ex("PYTHON", "open('/etc/vlab_pwn','w').write('x')\nprint('WROTE')", [""]);
  check("Cannot write outside job dir", !r.runs?.[0]?.stdout.includes("WROTE"), r);
  r = await ex("SHELL", "id -u", [""]);
  check("Runs as unprivileged uid", r.runs?.[0]?.stdout.trim() !== "0", r);
  r = await ex("C", "#include <unistd.h>\nint main(){for(int i=0;i<1000;i++) fork(); return 0;}", [""], { timeLimitMs: 2000 });
  check("Fork bomb contained", r.runs?.length === 1, r);
  const t = Date.now();
  r = await ex("PYTHON", "print('alive')", [""]);
  check("Runner alive after attacks", r.runs?.[0]?.stdout === "alive\n" && Date.now() - t < 5000, r);
  const bad = await fetch(`${URL}/execute`, { method: "POST", headers: { authorization: "Bearer wrong" }, body: "{}" });
  check("Rejects bad secret", bad.status === 401);
  console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
  process.exit(fails ? 1 : 0);
})();
