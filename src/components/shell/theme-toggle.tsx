"use client";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui";

export function ThemeToggle() {
  const toggle = () => {
    const dark = document.documentElement.classList.toggle("dark");
    try { localStorage.setItem("vlab-theme", dark ? "dark" : "light"); } catch {}
  };
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle dark mode">
      <Sun className="h-4 w-4 dark:hidden" /><Moon className="hidden h-4 w-4 dark:block" />
    </Button>
  );
}
