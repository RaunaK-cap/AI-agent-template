// GLOBAL TEMPLATE — theme provider + toggle (next-themes, class strategy).
// Keep this file as-is across projects; only globals.css tokens change.
"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { Moon, Sun } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}

// Minimal icon toggle driven by next-themes (also themes the sonner toasts).
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="shrink-0"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      <Sun data-icon="inline-start" className="hidden dark:block" />
      <Moon data-icon="inline-start" className="dark:hidden" />
    </Button>
  );
}
