// GLOBAL TEMPLATE — live log stream viewer.
// Renders SSE lines from useLiveLogs in a mono scroll area with pause/clear.
// This is the "user sees the agent thinking live" panel you asked for.
"use client";

import { Pause, Play, Trash } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { LiveLogs } from "@/lib/use-live-logs";

export function LiveLogStream({ logs }: { logs: LiveLogs }) {
  return (
    <Card className="flex min-h-0 flex-1 flex-col">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="font-mono text-xs">
            live logs{" "}
            <Badge variant={logs.live ? "secondary" : "outline"} className="font-mono text-[10px]">
              {logs.live ? "streaming" : "paused"}
            </Badge>
          </CardTitle>
          <div className="flex gap-1">
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => logs.setLive(!logs.live)}
              aria-label={logs.live ? "Pause stream" : "Resume stream"}
            >
              {logs.live ? <Pause data-icon="inline-start" /> : <Play data-icon="inline-start" />}
            </Button>
            <Button size="icon-xs" variant="ghost" onClick={logs.clear} aria-label="Clear logs">
              <Trash data-icon="inline-start" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        <ScrollArea className="h-56 rounded-none border bg-muted/30 p-2">
          <div className="flex flex-col gap-1">
            {logs.lines.length === 0 ? (
              <p className="font-mono text-[11px] text-muted-foreground">
                waiting for agent events… run the backend or wait for the simulator.
              </p>
            ) : (
              logs.lines.map((l) => (
                <p key={l.id} className="font-mono text-[11px] leading-relaxed">
                  <span className="text-muted-foreground">{l.time} · </span>
                  <span className="text-muted-foreground">[{l.source}] </span>
                  <span>{l.text}</span>
                </p>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
