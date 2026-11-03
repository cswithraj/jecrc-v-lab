/**
 * Make faculty-written Mermaid flowcharts robust: wrap every node label in quotes so characters such
 * as ( ) [ ] { } ; : inside labels (very common in code, e.g. "A[mid] == key?") do not break parsing.
 * Handles shapes: id[..] id(..) id([..]) id[/../] id{..} id((..)). Already-quoted labels are left alone.
 */
const OPEN_TO_CLOSE: Record<string, string> = { "[": "]", "(": ")", "{": "}" };

export function quoteMermaidLabels(src: string): string {
  return src.split("\n").map((line) => {
    if (/^\s*(flowchart|graph|classDef|class|style|linkStyle|subgraph|end|%%)/.test(line)) return line;
    let out = "";
    let i = 0;
    while (i < line.length) {
      const m = /^[A-Za-z_][\w-]*/.exec(line.slice(i));
      const prev = i > 0 ? line[i - 1] : " ";
      if (m && !/[\w"]/.test(prev)) {
        const id = m[0];
        let j = i + id.length;
        const open = line[j];
        if (open && OPEN_TO_CLOSE[open]) {
          // find matching close of the outermost bracket, counting all bracket kinds
          let depth = 0, k = j;
          for (; k < line.length; k++) {
            const c = line[k];
            if (c === "[" || c === "(" || c === "{") depth++;
            else if (c === "]" || c === ")" || c === "}") { depth--; if (depth === 0) break; }
          }
          if (k < line.length) {
            const whole = line.slice(j, k + 1);
            // shape delimiters: ([ ]) , [/ /] , (( )) , [ ] , ( ) , { }
            const shapes: [string, string][] = [["([", "])"], ["[/", "/]"], ["((", "))"], ["[", "]"], ["(", ")"], ["{", "}"]];
            const shape = shapes.find(([a, b]) => whole.startsWith(a) && whole.endsWith(b) && whole.length >= a.length + b.length);
            if (shape) {
              const inner = whole.slice(shape[0].length, whole.length - shape[1].length);
              const label = /^".*"$/.test(inner.trim()) ? inner : `"${inner.replace(/"/g, "#quot;")}"`;
              out += id + shape[0] + label + shape[1];
              i = k + 1;
              continue;
            }
          }
        }
        out += id;
        i = j;
        continue;
      }
      // edge labels |text| → quote too
      if (line[i] === "|") {
        const end = line.indexOf("|", i + 1);
        if (end > i) {
          const inner = line.slice(i + 1, end);
          out += "|" + (/^".*"$/.test(inner) ? inner : `"${inner.replace(/"/g, "#quot;")}"`) + "|";
          i = end + 1;
          continue;
        }
      }
      out += line[i++];
    }
    return out;
  }).join("\n");
}
