"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Field, Alert } from "@/components/ui";

const DEMO = [
  { label: "Student", email: "student@vlab.demo" },
  { label: "Faculty", email: "faculty@vlab.demo" },
  { label: "HOD", email: "hod@vlab.demo" },
  { label: "Super Admin", email: "admin@vlab.demo" },
];

export function LoginForm({ showDemo }: { showDemo: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Sign-in failed."); return; }
      const next = params.get("next");
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : data.redirect);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="University email" htmlFor="email">
        <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@jecrcu.edu.in" />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={loading}>Sign in</Button>
      {showDemo && (
        <div className="rounded-md border border-dashed p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Demo accounts (development only) · password <code className="font-mono">Demo@1234</code></p>
          <div className="flex flex-wrap gap-2">
            {DEMO.map((d) => (
              <Button key={d.email} type="button" variant="outline" size="sm" onClick={() => { setEmail(d.email); setPassword("Demo@1234"); }}>{d.label}</Button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
