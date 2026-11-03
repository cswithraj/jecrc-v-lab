import "server-only";
import path from "node:path";
import fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { ApiError } from "./api";

/**
 * File storage for project uploads. Only the "local" driver is implemented: files go under STORAGE_DIR
 * (default ./storage), which must be a persistent volume in production. Keys are random and never derived from user input.
 */
const ROOT = path.resolve(process.env.STORAGE_DIR || "./storage");
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB || 20) * 1024 * 1024;
export const ALLOWED_EXT = [".pdf", ".zip", ".docx", ".pptx", ".xlsx", ".png", ".jpg", ".jpeg", ".txt", ".md"];

function assertDriver() {
  const d = process.env.STORAGE_DRIVER || "local";
  if (d !== "local") throw new ApiError(503, `Storage driver "${d}" is not implemented; set STORAGE_DRIVER=local and mount a persistent volume at STORAGE_DIR.`);
}

export async function saveUpload(file: File, prefix: string) {
  assertDriver();
  if (file.size === 0) throw new ApiError(400, "The file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, `File too large (max ${process.env.MAX_UPLOAD_MB || 20} MB).`);
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) throw new ApiError(400, `File type not allowed. Allowed: ${ALLOWED_EXT.join(", ")}`);
  const key = `${prefix.replace(/[^a-z0-9-]/gi, "")}/${randomBytes(16).toString("hex")}${ext}`;
  const full = path.join(ROOT, key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, Buffer.from(await file.arrayBuffer()));
  return { key, name: file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 200) };
}

export async function readUpload(key: string) {
  assertDriver();
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new ApiError(400, "Invalid file key.");
  return fs.readFile(full);
}
