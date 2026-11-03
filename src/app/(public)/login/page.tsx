import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, HOME_FOR_ROLE } from "@/lib/auth";
import { getInstitution } from "@/lib/settings";
import { UniversityLogo } from "@/components/shell/brand";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(HOME_FOR_ROLE[user.role]);
  const inst = await getInstitution();
  const showDemo = process.env.SHOW_DEMO_LOGINS !== "false" && process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_LOGINS === "true";
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-secondary p-10 text-secondary-foreground lg:flex">
        <div className="absolute inset-y-0 left-0 w-2 bg-primary" />
        <Link href="/" className="font-display text-2xl font-bold">{inst.shortName}</Link>
        <div>
          <p className="font-display text-4xl font-semibold leading-tight">{inst.tagline}</p>
          <p className="mt-4 max-w-md text-secondary-foreground/70">{inst.platformName} — practical labs, timed assessments and results for {inst.university}, {inst.city}.</p>
        </div>
        <p className="text-sm uppercase tracking-[0.3em] text-primary">{inst.motto}</p>
      </div>
      <div className="flex flex-col">
        <div className="flex justify-end p-4"><ThemeToggle /></div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 pb-16">
          <UniversityLogo inst={inst} className="mb-8 h-20 w-auto self-start" />
          <h1 className="font-display text-3xl font-semibold">Sign in</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">Students, faculty and administrators use the same sign-in.</p>
          <Suspense><LoginForm showDemo={showDemo} /></Suspense>
          <p className="mt-6 text-xs text-muted-foreground">Forgot your password? Contact {inst.supportEmail}.</p>
        </div>
      </div>
    </div>
  );
}
