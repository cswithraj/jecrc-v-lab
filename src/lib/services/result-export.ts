import "server-only";
import path from "node:path";
import fs from "node:fs";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { getInstitution } from "@/lib/settings";
import { fmtDateTime } from "@/lib/utils";
import { exportRows, RESULT_COLUMNS } from "./results";

type Format = "csv" | "xlsx" | "pdf";

async function header(offeringId: string) {
  const o = await prisma.subjectOffering.findUniqueOrThrow({ where: { id: offeringId }, include: { subject: { select: { name: true, code: true, credits: true } }, batch: { select: { name: true, code: true } }, academicSession: { select: { name: true } } } });
  const faculty = o.facultyId ? await prisma.user.findUnique({ where: { id: o.facultyId }, select: { name: true } }) : null;
  return { ...o, faculty };
}

export async function exportResults(offeringId: string, format: Format) {
  const [o, rows, inst] = await Promise.all([header(offeringId), exportRows(offeringId), getInstitution()]);
  const status = o.resultsFinalized ? "FINAL" : "DRAFT";
  const base = `${o.subject.code}-${o.batch.code}-results-${status.toLowerCase()}`;
  const cols = RESULT_COLUMNS;
  const matrix = rows.map((r) => cols.map(([k]) => (r as Record<string, unknown>)[k] ?? ""));

  if (format === "csv") {
    return { body: Buffer.from(toCsv(cols.map((c) => c[1]), matrix)), type: "text/csv; charset=utf-8", filename: `${base}.csv` };
  }

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    wb.creator = inst.shortName;
    const ws = wb.addWorksheet("Results");
    ws.addRow([`${inst.university} · ${inst.department}`]).font = { bold: true, size: 13 };
    ws.addRow([`${o.subject.name} (${o.subject.code}) · ${o.batch.name} · ${o.academicSession.name}`]);
    ws.addRow([`Status: ${status}${o.resultsFinalized ? "" : " (not final, subject to change)"} · exported ${fmtDateTime(new Date())}`]);
    ws.addRow([]);
    const h = ws.addRow(cols.map((c) => c[1]));
    h.font = { bold: true, color: { argb: "FFFFFFFF" } };
    h.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC00010" } }; });
    for (const m of matrix) ws.addRow(m);
    ws.columns.forEach((c, i) => { c.width = i === 2 ? 28 : i === 1 ? 18 : 13; });
    ws.views = [{ state: "frozen", ySplit: 5 }];
    return { body: Buffer.from(await wb.xlsx.writeBuffer()), type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename: `${base}.xlsx` };
  }

  // PDF — landscape A4 marksheet
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36, info: { Title: `${o.subject.name} results`, Author: inst.shortName } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));

  const logo = path.join(process.cwd(), "public", (inst.logoUrl ?? "").replace(/^\//, ""));
  if (inst.logoUrl && fs.existsSync(logo)) { try { doc.image(logo, 36, 28, { height: 40 }); } catch { /* unsupported image: skip */ } }
  doc.font("Helvetica-Bold").fontSize(14).text(`${o.subject.name} — Laboratory result`, 260, 30, { align: "right" });
  doc.font("Helvetica").fontSize(9).fillColor("#444")
    .text(`${inst.department} · ${o.batch.name} · ${o.academicSession.name} · ${o.subject.credits} credit(s)`, 260, 50, { align: "right" })
    .text(`Faculty: ${o.faculty?.name ?? "—"} · ${status}${o.resultsFinalized ? "" : " — not final"} · generated ${fmtDateTime(new Date())}`, { align: "right" });

  const widths = [36, 90, 150, 50, 50, 60, 60, 50, 45, 55, 40, 45, 70];
  const x0 = 36; let y = 90;
  const drawRow = (vals: unknown[], bold = false, fill?: string) => {
    if (fill) doc.rect(x0, y - 3, widths.reduce((a, b) => a + b, 0), 16).fill(fill);
    doc.fillColor(bold && fill ? "#fff" : "#111").font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8);
    let x = x0;
    vals.forEach((v, i) => { doc.text(String(v ?? "—"), x + 2, y, { width: widths[i] - 4, lineBreak: false, ellipsis: true }); x += widths[i]; });
    y += 16;
  };
  const watermark = () => { if (!o.resultsFinalized) { doc.save().rotate(-20, { origin: [420, 300] }).font("Helvetica-Bold").fontSize(110).fillColor("#E30613").opacity(0.07).text("DRAFT", 230, 230, { lineBreak: false }).restore(); doc.opacity(1); } };
  const head = () => drawRow(cols.map((c) => c[2]), true, "#C00010");
  head();
  matrix.forEach((m, i) => {
    if (y > 540) { watermark(); doc.addPage(); y = 40; head(); }
    if (i % 2) doc.rect(x0, y - 3, widths.reduce((a, b) => a + b, 0), 16).fill("#f5f5f5");
    drawRow(m.map((v) => (v === "" ? "—" : v)));
  });
  watermark();
  y += 30;
  if (y > 520) { doc.addPage(); y = 60; }
  doc.font("Helvetica").fontSize(9).fillColor("#111");
  doc.text("Faculty signature: ____________________", x0, y);
  doc.text("HOD signature: ____________________", 330, y);
  doc.text("Controller of Examinations: ____________________", 580, y);
  doc.end();
  return { body: await done, type: "application/pdf", filename: `${base}.pdf` };
}
