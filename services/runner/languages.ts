// Language registry for the sandbox runner. Add a language by adding an entry here
// (and its metadata in src/lib/languages.ts on the web app side).
export interface LanguageSpec {
  file: string; // source file name inside the job dir
  compile?: string[]; // compile command (cwd = job dir)
  run: string[]; // run command
  /** Address-space limit multiplier (JVM reserves far more virtual memory than it uses) */
  memoryMode?: "as" | "jvm";
  /** For SQL/Shell: the source is fed on stdin instead of the program's stdin */
  sourceAsStdin?: boolean;
}

export const LANGUAGES: Record<string, LanguageSpec> = {
  C: { file: "main.c", compile: ["gcc", "-O2", "-std=c17", "-Wall", "-Wno-unused-result", "-o", "main", "main.c", "-lm"], run: ["./main"] },
  CPP: { file: "main.cpp", compile: ["g++", "-O2", "-std=c++17", "-Wall", "-Wno-unused-result", "-o", "main", "main.cpp"], run: ["./main"] },
  JAVA: { file: "Main.java", compile: ["javac", "-J-Xmx256m", "Main.java"], run: ["java", "-Xmx{MEM}k", "-Xss64m", "-XX:+UseSerialGC", "-XX:TieredStopAtLevel=1", "Main"], memoryMode: "jvm" },
  PYTHON: { file: "main.py", run: ["python3", "-I", "-S", "main.py"] },
  JAVASCRIPT: { file: "main.js", run: ["node", "--max-old-space-size=128", "main.js"], memoryMode: "jvm" },
  SHELL: { file: "main.sh", run: ["bash", "--noprofile", "--norc", "main.sh"] },
  SQL: { file: "script.sql", run: ["python3", "-I", "-S", "{RUNNER_DIR}/sqlrun.py"], sourceAsStdin: true },
};
