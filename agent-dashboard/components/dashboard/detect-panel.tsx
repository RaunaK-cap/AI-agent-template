// GLOBAL TEMPLATE — Detect / Investigate / Act + spike + checklist (screenshots 2-3).
// Left: 3 stage cards (active highlighted). Right: spike alert + investigation
// steps + Accept/Reject. Shows "measurable improvement" story judges want.
"use client";

import { Check } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PipelineStage } from "@/lib/agent-types";

const STEPS = [
  { label: "Analyzing trace context", time: "0ms" },
  { label: "Gathering trace data", time: "683ms" },
  { label: "Categorizing issue type", time: "2.4s" },
];

export function DetectPanel({ stages }: { stages: PipelineStage[] }) {
  return (
    <div className="grid gap-2 lg:grid-cols-[240px_1fr]">
      {/* Stage list */}
      <div className="flex flex-col gap-2">
        {stages.map((s) => (
          <Card key={s.index} size="sm" className={s.active ? "border-foreground/30" : "opacity-70"}>
            <CardContent className="flex flex-col gap-1">
              <p className="font-mono text-[10px] text-muted-foreground">
                {s.index} · {s.name}
              </p>
              <p className="font-mono text-xs font-medium">{s.title}</p>
              <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">{s.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Spike + investigation */}
      <Card className="flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-mono text-[11px] text-muted-foreground">
              neatlogs trace
            </CardTitle>
            <span className="font-mono text-[11px] text-muted-foreground">02 / 03</span>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-center justify-between border-b pb-2">
            <p className="font-mono text-xs font-medium">neatlogs agent · thread</p>
            <Badge variant="destructive" className="font-mono text-[10px]">
              spike detected
            </Badge>
          </div>
          <div className="flex flex-col gap-1 border-l-2 pl-2">
            <p className="font-mono text-xs font-medium">Spike detected. Outdated source cited</p>
            <CardDescription className="font-mono text-[11px]">
              Quality regression in Revenue Q&amp;A, trending higher than usual.
            </CardDescription>
            <div className="grid grid-cols-2 gap-1 font-mono text-[11px]">
              <span className="text-muted-foreground">volume</span>
              <span className="text-muted-foreground">seen in</span>
              <span className="font-medium">3.4x vs. last 7 days</span>
              <span className="font-medium">3 runs</span>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">latest run #4821</span>
          </div>
          {/* Checklist mirrors "Investigation Complete — 13 steps" */}
          <div className="flex flex-col gap-1 rounded-none border p-2">
            <p className="font-mono text-[11px] font-medium">
              Investigation Complete <span className="text-muted-foreground">— 13 steps · 51.6s</span>
            </p>
            {STEPS.map((s) => (
              <p key={s.label} className="flex items-center justify-between font-mono text-[11px]">
                <span className="flex items-center gap-1.5">
                  <Check weight="bold" data-icon="inline-start" /> {s.label}
                </span>
                <span className="text-muted-foreground">{s.time}</span>
              </p>
            ))}
          </div>
          <div className="flex flex-col gap-2 rounded-none border p-2">
            <p className="font-mono text-[11px] font-medium">
              Resolve Zero-Duration Span Instrumentation and Extreme Latency
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">
              Severity: critical | Category: config
            </p>
            <div className="flex gap-2">
              <Button size="sm">
                <Check data-icon="inline-start" /> Accept
              </Button>
              <Button size="sm" variant="outline">
                Reject
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
