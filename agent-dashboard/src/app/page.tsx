// GLOBAL TEMPLATE — dashboard home. Single parent owns shared state so all
// panels stay in sync: approval decision -> banner + thread + toast + log line.
// Layout (responsive, minimal):
//   TopBar (sticky)
//   Banners (notification + approval)
//   MetricStrip (4 cards)
//   Tabs: Trace (timeline + thread) | Pipeline (detect/investigate/act) | Prompts (versions)
//   Live logs + Chat side by side (stack on mobile)
// Backend seam: approval handlers + ChatPanel.send + useLiveLogs.push are the
// only places that need fetch() to your Express agent server. Nothing else changes.
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TopBar } from "@/components/dashboard/top-bar";
import { MetricStrip } from "@/components/dashboard/metric-strip";
import { Banners } from "@/components/dashboard/banners";
import { TraceTimeline } from "@/components/dashboard/trace-timeline";
import { ThreadPanel } from "@/components/dashboard/thread-panel";
import { DetectPanel } from "@/components/dashboard/detect-panel";
import { PromptVersions } from "@/components/dashboard/prompt-versions";
import { LiveLogStream } from "@/components/dashboard/live-logs";
import { ChatPanel } from "@/components/dashboard/chat-panel";
import { mockApproval, mockMetrics, mockSpans, mockStages, mockThread, mockVersions } from "@/lib/mock-data";
import { useLiveLogs } from "@/lib/use-live-logs";
import type { PendingApproval } from "@/lib/agent-types";

export default function Home() {
  // Shared approval state: one decision updates banner, thread card, and logs.
  const [approval, setApproval] = useState<PendingApproval | null>(mockApproval);
  const [notice, setNotice] = useState<string | null>(
    "Quality regression in Revenue Q&A · 3.4x vs last 7 days · run #4821",
  );
  const logs = useLiveLogs(true);

  // POST to /api/approvals/:id on your agent server in production.
  const decide = (decision: "approved" | "rejected") => (id: string) => {
    setApproval(null);
    logs.push("agent-event", `${decision} ${id} · policy saved`);
    toast(decision === "approved" ? "Approved — policy saved" : "Rejected — escalated back");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background font-mono text-foreground">
      <TopBar live={logs.live} />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 px-3 py-3">
        <Banners
          approval={approval}
          notice={notice}
          onApprove={decide("approved")}
          onReject={decide("rejected")}
          onDismissNotice={() => setNotice(null)}
        />

        <MetricStrip metrics={mockMetrics} />

        {/* Tabs keep small screens usable: one concern visible at a time */}
        <Tabs defaultValue="trace" className="flex flex-col gap-2">
          <TabsList className="w-fit">
            <TabsTrigger value="trace">trace</TabsTrigger>
            <TabsTrigger value="pipeline">pipeline</TabsTrigger>
            <TabsTrigger value="prompts">prompts</TabsTrigger>
          </TabsList>

          <TabsContent value="trace">
            <div className="grid gap-2 lg:grid-cols-2">
              <TraceTimeline spans={mockSpans} />
              <ThreadPanel
                messages={mockThread}
                approval={approval}
                onApprove={decide("approved")}
                onReject={decide("rejected")}
              />
            </div>
          </TabsContent>

          <TabsContent value="pipeline">
            <DetectPanel stages={mockStages} />
          </TabsContent>

          <TabsContent value="prompts">
            <PromptVersions versions={mockVersions} />
          </TabsContent>
        </Tabs>

        {/* Live stream + chat: side by side on desktop, stacked on mobile */}
        <div className="grid min-h-0 gap-2 lg:grid-cols-2">
          <LiveLogStream logs={logs} />
          <ChatPanel logs={logs} />
        </div>
      </main>
    </div>
  );
}
