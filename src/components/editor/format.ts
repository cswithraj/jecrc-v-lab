/**
 * Lightweight re-indenter for brace languages (C, C++, Java, JS) used by the Format button when
 * Monaco has no built-in formatter for the language. It normalises indentation only; it never
 * changes tokens, so it cannot alter program behaviour.
 */
export function reindentBraces(code: string, unit = "    "): string {
  let depth = 0;
  const out: string[] = [];
  for (const raw of code.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) { out.push(""); continue; }
    const stripped = line.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "\"\"").replace(/\/\/.*$/, "");
    const leadingClose = /^[}\])]/.test(stripped) ? 1 : 0;
    const level = Math.max(0, depth - leadingClose);
    const isLabel = /^(case\b.*|default\s*):$/.test(stripped) || /^(public|private|protected)\s*:$/.test(stripped);
    out.push(unit.repeat(isLabel ? Math.max(0, level - (/^(public|private|protected)/.test(stripped) ? 1 : 0)) : level) + line);
    for (const ch of stripped) { if (ch === "{") depth++; else if (ch === "}") depth = Math.max(0, depth - 1); }
  }
  return out.join("\n").replace(/\n*$/, "\n");
}
