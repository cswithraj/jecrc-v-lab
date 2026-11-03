import { requireUser } from "@/lib/auth";
import { getInstitution, getExamRules } from "@/lib/settings";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui";
import { EntityForm } from "@/components/common/entity-form";

export const metadata = { title: "Platform settings" };

export default async function SettingsPage() {
  await requireUser(["SUPER_ADMIN"]);
  const [inst, rules] = await Promise.all([getInstitution(), getExamRules()]);
  return (
    <>
      <PageHeader eyebrow="Administration" title="Platform settings" description="Branding, institution details and default exam rules. Logos can be site paths (files in public/brand) or https URLs." />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader><CardTitle>Institution & branding</CardTitle></CardHeader>
          <CardContent>
            <EntityForm url="/api/v1/admin/settings" method="PUT" extra={{ key: "institution" }} nestUnder="value" columns={3} initial={inst as unknown as Record<string, unknown>} fields={[
              { name: "platformName", label: "Platform name", required: true, span: 2 }, { name: "shortName", label: "Short name", required: true },
              { name: "tagline", label: "Tagline" }, { name: "university", label: "University", required: true }, { name: "city", label: "City" },
              { name: "department", label: "Department" }, { name: "academicYear", label: "Academic year" }, { name: "motto", label: "Motto" },
              { name: "primaryColor", label: "Primary colour", type: "color", required: true },
              { name: "logoUrl", label: "Logo (light)" }, { name: "logoDarkUrl", label: "Logo (dark)" }, { name: "crestUrl", label: "Crest / icon" },
              { name: "supportEmail", label: "Support email", type: "email", required: true }, { name: "supportPhone", label: "Support phone" },
              { name: "projectOwner", label: "Project owner" }, { name: "projectOwnerTitle", label: "Owner title", span: 2 },
            ]} />
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader><CardTitle>Exam rules</CardTitle><CardDescription>Defaults for new practical sessions.</CardDescription></CardHeader>
          <CardContent>
            <EntityForm url="/api/v1/admin/settings" method="PUT" extra={{ key: "examRules" }} nestUnder="value" initial={rules as unknown as Record<string, unknown>} columns={1} fields={[
              { name: "defaultSessionMinutes", label: "Practical length (minutes)", type: "number", required: true, min: 30, max: 360 },
              { name: "autosaveSeconds", label: "Autosave interval (seconds)", type: "number", required: true, min: 5, max: 120 },
              { name: "maxRunsPerMinute", label: "Code runs per student per minute", type: "number", required: true, min: 5, max: 120 },
              { name: "allowLateByDefault", label: "Allow late submission by default", type: "checkbox" },
            ]} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
