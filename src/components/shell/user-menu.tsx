"use client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button variant="ghost" size="sm" loading={busy} onClick={async () => { setBusy(true); await fetch("/api/v1/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }}>
      <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
    </Button>
  );
}
