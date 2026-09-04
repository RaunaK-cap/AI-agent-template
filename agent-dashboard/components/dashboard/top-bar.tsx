// GLOBAL TEMPLATE — top bar. Sticky, minimal, mono.
// Left: product mark + run selector. Right: connection status + theme toggle.
// Reuse everywhere; only the title + run id change per project.
"use client";

import { Circle } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme";

export function TopBar({ runId = "#4821", live = true }: { runId?: string; live?: boolean }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        {/* Product mark: black square in light, white in dark via primary token */}
        <span className="flex size-6 shrink-0 items-center justify-center bg-primary font-mono text-[11px] font-bold text-primary-foreground">
          nl
        </span>
        <p className="truncate text-xs font-medium">agent dashboard</p>
        <Badge variant="secondary" className="font-mono text-[11px]">
          run {runId}
        </Badge>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant="outline" className="font-mono text-[11px]">
          <Circle weight="fill" className="size-2" data-icon="inline-start" />
          {live ? "live" : "paused"}
        </Badge>
        <ThemeToggle />
      </div>
    </header>
  );
}
