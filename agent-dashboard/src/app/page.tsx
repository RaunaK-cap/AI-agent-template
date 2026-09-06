// GLOBAL TEMPLATE — dashboard home with minimal sidebar navigation.
// Single parent owns shared state so all panels stay in sync:
// approval decision -> banner + thread + toast + log line.
// Layout (shadcn sidebar, base-lyra, mono, minimal):
//   Sidebar (icon-collapsible) — overview | trace | pipeline | prompts | logs | chat
//   SidebarInset header — SidebarTrigger + view title + run badge + live + theme
//   Main — Banners (always visible) + view content
// Backend seam: approval handlers + ChatPanel.send + useLiveLogs.push are the
// only places that need fetch() to your Express agent server. Nothing else changes.
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Circle } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar, type DashboardView } from "@/components/dashboard/app-sidebar";
import { Banners } from "@/components/dashboard/banners";
import { ChatPanel } from "@/components/dashboard/chat-panel";
import { DetectPanel } from "@/components/dashboard/detect-panel";
import { LiveLogStream } from "@/components/dashboard/live-logs";
import { MetricStrip } from "@/components/dashboard/metric-strip";
import { PromptVersions } from "@/components/dashboard/prompt-versions";
import { ThreadPanel } from "@/components/dashboard/thread-panel";
import { TraceTimeline } from "@/components/dashboard/trace-timeline";
import { ThemeToggle } from "@/components/theme";
import {
  mockApproval,
  mockMetrics,
  mockSpans,
  mockStages,
  mockThread,
  mockVersions,
} from "@/lib/mock-data";
import { useLiveLogs } from "@/lib/use-live-logs";
import type { PendingApproval } from "@/lib/agent-types";

const VIEW_META: Record<DashboardView, { title: string; desc: string }> = {
  overview: { title: "overview", desc: "run health · alerts · metrics" },
  trace: { title: "trace", desc: "timeline + thread · 4.8s workflow" },
  pipeline: { title: "pipeline", desc: "detect → investigate → act" },
  prompts: { title: "prompts", desc: "version history · diff · rollback" },
  logs: { title: "logs", desc: "live stream · agent events" },
  chat: { title: "chat", desc: "talk to the agent · upload files" },
};

export default function Home() {
  const [view, setView] = useState<DashboardView>("overview");
  const [approval, setApproval] = useState<PendingApproval | null>(mockApproval);
  const [notice, setNotice] = useState<string | null>(
    "Quality regression in Revenue Q&A · 3.4x vs last 7 days · run #4821",
  );
  const logs = useLiveLogs(true);
  const runId = "#4821";

  const decide = (decision: "approved" | "rejected") => (id: string) => {
    setApproval(null);
    logs.push("agent-event", `${decision} ${id} · policy saved`);
    toast(decision === "approved" ? "Approved — policy saved" : "Rejected — escalated back");
  };

  const meta = VIEW_META[view];

  return (
    <SidebarProvider className="font-mono">
      <AppSidebar active={view} onChange={setView} live={logs.live} hasApproval={!!approval} runId={runId} />
      <SidebarInset className="flex h-screen max-h-screen flex-col overflow-hidden bg-background font-mono text-foreground">
        {/* Minimal header — SidebarTrigger + title + live */}
        <header className="flex shrink-0 items-center justify-between gap-2 border-b bg-background px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger className="shrink-0" />
            <Separator orientation="vertical" className="h-4" />
            <p className="truncate font-mono text-xs font-medium">{meta.title}</p>
            <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">{meta.desc}</span>
            <Badge variant="secondary" className="hidden font-mono text-[11px] sm:inline-flex">
              run {runId}
            </Badge>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline" className="font-mono text-[11px]">
              <Circle weight="fill" className="size-2" data-icon="inline-start" />
              {logs.live ? "live" : "paused"}
            </Badge>
            <ThemeToggle />
          </div>
        </header>

        <main
          className={
            view === "overview" || view === "chat" || view === "logs"
              ? "flex w-full flex-1 min-h-0 flex-col gap-3 overflow-y-auto px-3 py-3 lg:overflow-hidden"
              : "flex w-full flex-1 flex-col gap-3 overflow-y-auto px-3 py-3"
          }
        >
          {/* Banners stay global — approval + spike visible from any view */}
          <Banners
            approval={approval}
            notice={notice}
            onApprove={decide("approved")}
            onReject={decide("rejected")}
            onDismissNotice={() => setNotice(null)}
          />

          {/* View content */}
          {view === "overview" ? (
            <div className="flex flex-1 min-h-0 flex-col gap-3 lg:overflow-hidden">
              <MetricStrip metrics={mockMetrics} />
              {/* Few preview — 3 cards with button to go full view, like current */}
              <div className="grid shrink-0 gap-2 lg:grid-cols-3">
                <Card
                  size="sm"
                  className="cursor-pointer transition-colors hover:border-foreground/30"
                  onClick={() => setView("trace")}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setView("trace")}
                >
                  <CardHeader>
                    <CardTitle className="font-mono text-xs">trace · support access</CardTitle>
                    <CardDescription className="font-mono text-[11px]">4.8s workflow · 7 spans</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-1">
                    <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                      {mockSpans.length} spans — prompt, context, tool `add_member`, llm. Rail + thread live.
                    </p>
                    <span className="font-mono text-[11px] text-foreground">open trace →</span>
                  </CardContent>
                </Card>
                <Card
                  size="sm"
                  className="cursor-pointer transition-colors hover:border-foreground/30"
                  onClick={() => setView("pipeline")}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setView("pipeline")}
                >
                  <CardHeader>
                    <CardTitle className="font-mono text-xs">pipeline · detect</CardTitle>
                    <CardDescription className="font-mono text-[11px]">spike 3.4x · 3 stages</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-1">
                    <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                      Neatlogs flagged regression in Revenue Q&A. Review investigate → act with fix proposal.
                    </p>
                    <span className="font-mono text-[11px] text-foreground">open pipeline →</span>
                  </CardContent>
                </Card>
                <Card
                  size="sm"
                  className="cursor-pointer transition-colors hover:border-foreground/30"
                  onClick={() => setView("prompts")}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setView("prompts")}
                >
                  <CardHeader>
                    <CardTitle className="font-mono text-xs">prompts · versions</CardTitle>
                    <CardDescription className="font-mono text-[11px]">
                      {mockVersions.length} versions · {mockVersions.find((v) => v.current)?.version} live
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-1">
                    <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                      Diff v14→v15, rollback / promote. Same mono diff view as prompts tab.
                    </p>
                    <span className="font-mono text-[11px] text-foreground">open prompts →</span>
                  </CardContent>
                </Card>
              </div>
              {/* Logs + chat — fixed to one page, internal scroll only */}
              <div className="grid gap-2 lg:flex-1 lg:min-h-0 lg:grid-cols-[1.55fr_1fr] xl:grid-cols-[1.7fr_1fr]">
                <LiveLogStream
                  logs={logs}
                  className="flex min-h-[280px] flex-col overflow-hidden lg:min-h-0 lg:h-full"
                  scrollClassName="flex-1 min-h-0 overflow-auto rounded-none border bg-muted/30 p-2"
                />
                <ChatPanel
                  logs={logs}
                  className="flex min-h-[320px] flex-col overflow-hidden lg:min-h-0 lg:h-full"
                  scrollClassName="flex-1 min-h-0 overflow-auto rounded-none border p-2"
                />
              </div>
            </div>
          ) : null}

          {view === "trace" ? (
            <div className="grid gap-2 lg:grid-cols-2">
              <TraceTimeline spans={mockSpans} />
              <ThreadPanel
                messages={mockThread}
                approval={approval}
                onApprove={decide("approved")}
                onReject={decide("rejected")}
              />
            </div>
          ) : null}

          {view === "pipeline" ? <DetectPanel stages={mockStages} /> : null}

          {view === "prompts" ? <PromptVersions versions={mockVersions} /> : null}

          {view === "logs" ? (
            <div className="flex flex-1 min-h-0 flex-col gap-2 overflow-hidden">
              <Card size="sm" className="shrink-0 border-dashed">
                <CardContent className="font-mono text-[11px] text-muted-foreground">
                  live stream is global — chat messages and approval decisions append here in real time. Pause to
                  inspect, clear to reset.
                </CardContent>
              </Card>
              <LiveLogStream
                logs={logs}
                className="flex flex-1 min-h-0 flex-col overflow-hidden"
                scrollClassName="flex-1 min-h-0 overflow-auto rounded-none border bg-muted/30 p-2"
              />
            </div>
          ) : null}

          {view === "chat" ? (
            <div className="flex flex-1 min-h-0 flex-col gap-2 overflow-hidden">
              <Card size="sm" className="shrink-0 border-dashed">
                <CardContent className="font-mono text-[11px] text-muted-foreground">
                  agent chat is wired to the same log stream — every user message appears in logs as `[chat]`.
                  Wire `POST /api/chat` in `ChatPanel.send` to stream real answers.
                </CardContent>
              </Card>
              <ChatPanel
                logs={logs}
                className="flex flex-1 min-h-0 flex-col overflow-hidden"
                scrollClassName="flex-1 min-h-0 overflow-auto rounded-none border p-2"
              />
            </div>
          ) : null}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
