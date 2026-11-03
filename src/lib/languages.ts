import type { Language } from "@prisma/client";

export interface LanguageMeta {
  id: Language;
  label: string;
  monaco: string; // Monaco language id
  executable: boolean; // runs on the sandbox
  browserOnly?: boolean; // runs only in the sandboxed preview iframe
  template: string;
}

export const LANGUAGE_META: Record<Language, LanguageMeta> = {
  C: { id: "C", label: "C (GCC, C17)", monaco: "c", executable: true, template: '#include <stdio.h>\n\nint main(void) {\n    // write your code here\n    return 0;\n}\n' },
  CPP: { id: "CPP", label: "C++ (G++, C++17)", monaco: "cpp", executable: true, template: "#include <iostream>\nusing namespace std;\n\nint main() {\n    // write your code here\n    return 0;\n}\n" },
  JAVA: { id: "JAVA", label: "Java (OpenJDK)", monaco: "java", executable: true, template: "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // write your code here\n    }\n}\n" },
  PYTHON: { id: "PYTHON", label: "Python 3", monaco: "python", executable: true, template: "# write your code here\n" },
  JAVASCRIPT: { id: "JAVASCRIPT", label: "JavaScript (Node.js)", monaco: "javascript", executable: true, template: "const input = require('fs').readFileSync(0, 'utf8');\n// write your code here\n" },
  SQL: { id: "SQL", label: "SQL (SQLite)", monaco: "sql", executable: true, template: "-- write your query here\n" },
  SHELL: { id: "SHELL", label: "Bash shell", monaco: "shell", executable: true, template: "#!/bin/bash\n# write your script here\n" },
  HTML: { id: "HTML", label: "HTML", monaco: "html", executable: false, browserOnly: true, template: "<!doctype html>\n<html>\n<head><title>Page</title></head>\n<body>\n  <h1>Hello</h1>\n</body>\n</html>\n" },
  CSS: { id: "CSS", label: "CSS", monaco: "css", executable: false, browserOnly: true, template: "body {\n  font-family: sans-serif;\n}\n" },
  NONE: { id: "NONE", label: "Written response", monaco: "markdown", executable: false, template: "" },
};

export const EXECUTABLE_LANGUAGES = Object.values(LANGUAGE_META).filter((l) => l.executable).map((l) => l.id);
