// GLOBAL TEMPLATE — prompt version history (screenshot 4).
// Left: version list. Right: line diff + Rollback / Promote.
// Keep versions in your DB later; this UI already supports it via props.
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PromptVersion } from "@/lib/agent-types";

export function PromptVersions({ versions }: { versions: PromptVersion[] }) {
  // Selected version shown in the diff pane. Defaults to current.
  const [selected, setSelected] = useState(
    versions.find((v) => v.current)?.version ?? versions[versions.length - 1]?.version,
  );
  const active = versions.find((v) => v.version === selected) ?? versions[0];

  return (
    <Card>
      <CardContent className="grid gap-2 p-3 sm:grid-cols-[120px_1fr]">
        {/* Version list */}
        <div className="flex gap-1 sm:flex-col" role="listbox" aria-label="Prompt versions">
          {versions.map((v) => (
            <button
              key={v.version}
              role="option"
              aria-selected={v.version === selected}
              onClick={() => setSelected(v.version)}
              className={cn(
                "border-l-2 px-2 py-1 text-left font-mono text-[11px]",
                v.version === selected
                  ? "border-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {v.version}
              {v.current ? " · live" : ""}
            </button>
          ))}
        </div>
        {/* Diff pane */}
        <div className="flex min-w-0 flex-col gap-2">
          <p className="font-mono text-[11px] text-muted-foreground">
            {versions[versions.length - 1]?.version} → {selected}
          </p>
          <ol className="flex flex-col gap-1">
            {active?.lines.map((line, i) => (
              <li key={i} className="flex gap-2 font-mono text-[11px]">
                <span className="w-4 shrink-0 text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{line}</span>
              </li>
            ))}
          </ol>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline">
              Rollback to v14
            </Button>
            <Button size="sm">Promote</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
