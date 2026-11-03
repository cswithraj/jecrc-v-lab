import { prisma } from "./db";

export interface InstitutionSettings {
  platformName: string;
  shortName: string;
  tagline: string;
  university: string;
  city: string;
  department: string;
  academicYear: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  crestUrl: string | null;
  motto: string;
  primaryColor: string;
  supportEmail: string;
  supportPhone: string;
  projectOwner: string;
  projectOwnerTitle: string;
}

export interface ExamRules {
  defaultSessionMinutes: number;
  autosaveSeconds: number;
  allowLateByDefault: boolean;
  maxRunsPerMinute: number;
}

export const DEFAULT_INSTITUTION: InstitutionSettings = {
  platformName: "JECRC Virtual Computer Laboratory",
  shortName: "JECRC VLab",
  tagline: "Learn. Experiment. Code. Evaluate. Innovate.",
  university: "JECRC University",
  city: "Jaipur, Rajasthan, India",
  department: "Department of Computer Applications",
  academicYear: "2026-27",
  logoUrl: "/brand/jecrc-university-logo.png",
  logoDarkUrl: "/brand/jecrc-university-logo-dark.png",
  crestUrl: "/brand/jecrc-crest.png",
  motto: "Build Your World",
  primaryColor: "#E30613",
  supportEmail: "vlab-support@example.edu",
  supportPhone: "+91-00000-00000",
  projectOwner: "Rajkumar Sharma",
  projectOwnerTitle: "Assistant Professor, Department of Computer Applications",
};
export const DEFAULT_EXAM_RULES: ExamRules = { defaultSessionMinutes: 120, autosaveSeconds: 15, allowLateByDefault: false, maxRunsPerMinute: 20 };

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } }).catch(() => null);
  return row ? { ...fallback, ...(row.value as object) } : fallback;
}
export const getInstitution = () => getSetting("institution", DEFAULT_INSTITUTION);
export const getExamRules = () => getSetting("examRules", DEFAULT_EXAM_RULES);
