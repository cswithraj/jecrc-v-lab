import { requireUser } from "@/lib/auth";
import { activePolicy } from "@/lib/services/results";
import { PageHeader, Card, CardContent } from "@/components/ui";
import { PolicyForm } from "@/components/admin/policy-form";

export const metadata = { title: "Grading policy" };

export default async function GradingPage() {
  await requireUser(["SUPER_ADMIN", "HOD"]);
  const p = await activePolicy();
  return (
    <>
      <PageHeader eyebrow="Administration" title="Grading policy" description="How final laboratory results are computed. Missing practicals count as zero. Changes are audited and apply only to results computed afterwards." />
      <Card className="max-w-3xl"><CardContent className="pt-6"><PolicyForm initial={{ name: p.name, weights: { ...p.weights }, bands: p.bands, passPercent: p.passPercent, minAttendancePercent: p.minAttendancePercent, tieBreak: p.tieBreak }} /></CardContent></Card>
    </>
  );
}
