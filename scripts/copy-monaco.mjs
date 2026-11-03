// Copies Monaco's AMD build into public/ so the editor is self-hosted (no CDN at runtime).
import { cpSync, existsSync, rmSync } from "node:fs";
const src = "node_modules/monaco-editor/min/vs";
const dst = "public/monaco/vs";
if (!existsSync(src)) { console.error("monaco-editor not installed"); process.exit(0); }
rmSync(dst, { recursive: true, force: true });
cpSync(src, dst, { recursive: true });
console.log("Monaco copied to", dst);
