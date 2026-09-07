// simple dashboard - all api calls here with axios
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import axios from "axios";
import { Circle } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar, type DashboardView } from "@/components/dashboard/app-sidebar";
import { Banners } from "@/components/dashboard/banners";
import { ChatPanel } from "@/components/dashboard/chat-panel";
import { LiveLogStream } from "@/components/dashboard/live-logs";
import { PromptVersions } from "@/components/dashboard/prompt-versions";
import { ThreadPanel } from "@/components/dashboard/thread-panel";
import { TraceTimeline } from "@/components/dashboard/trace-timeline";
import { ThemeToggle } from "@/components/theme";
import { useLiveLogs } from "@/lib/use-live-logs";
import type { PendingApproval, PromptVersion, TraceSpan } from "@/lib/agent-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type ApprovalApiResponse = {
  status: string;
  output?: string;
  approval?: { id: string; toolName: string; arguments?: unknown };
};

const VIEW_META: Record<DashboardView, { title: string; desc: string }> = {
  overview: { title: "overview", desc: "run health · alerts · metrics" },
  trace: { title: "trace", desc: "timeline + thread" },
  pipeline: { title: "pipeline", desc: "detect → act" },
  prompts: { title: "prompts", desc: "version history" },
  logs: { title: "logs", desc: "live stream" },
  chat: { title: "chat", desc: "talk to agent" },
};

export default function Home() {
  const [view, setView] = useState<DashboardView>("overview");
  const [approval, setApproval] = useState<PendingApproval | null>(null);
  const logs = useLiveLogs();
  const [spans] = useState<TraceSpan[]>([]);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const chatId = "demo";

  useEffect(() => {
    axios.get(`${API_URL}/health`).then((r) => {
      logs.push("agent-event", "backend: " + r.data.message);
    }).catch(() => logs.push("error", "backend not reachable"));

    axios.get(`${API_URL}/api/prompts`).then((r) => {
      if (Array.isArray(r.data)) setVersions(r.data);
    }).catch(() => {});
  }, []);

  const decide = (decision: "approved" | "rejected") => async (id: string) => {
    console.log("[FE] decide clicked", decision, id);
    const apiDecision = decision === "approved" ? "approve" : "reject";
    try {
      const res = await axios.post<ApprovalApiResponse>(`${API_URL}/api/approvals/${id}`, { decision: apiDecision });
      console.log("[FE] approval response", res.data);
      if (res.data.approval) {
        const next = res.data.approval;
        setApproval({ id: next.id, toolName: next.toolName, summary: `Need approval for ${next.toolName}`, filePath: `tools/${next.toolName}.md`, logExcerpt: JSON.stringify(next.arguments || "").slice(0, 80) });
      } else {
        setApproval(null);
      }
      logs.push("agent-event", decision === "approved" ? "Approval resolved" : "Email send rejected");
      toast(decision === "approved" ? "Approval resolved" : "Rejected");
      return { output: res.data.output };
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? (typeof error.response?.data === "object" && error.response?.data && "error" in error.response.data
          ? String(error.response.data.error)
          : error.message)
        : "Unable to resolve approval";
      console.log("[FE] approval error", message);
      // Keep the card visible so the user can retry a transient failure.
      toast("approval failed: " + message);
      return { output: `Approval failed: ${message}` };
    }
  };

  // Each request resolves to a normal JSON response. Approval state is stored
  // server-side, so no open HTTP stream can get stranded in the browser.
  const handleStreamChat = async (message: string, onDelta: (d: string) => void, onDone: (t: string) => void) => {
    try {
      const res = await axios.post<ApprovalApiResponse>(`${API_URL}/api/chat`, { message, chatId });
      if (res.data.approval) {
        const pending = res.data.approval;
        setApproval({ id: pending.id, toolName: pending.toolName, summary: `Need approval for ${pending.toolName}`, filePath: `tools/${pending.toolName}.md`, logExcerpt: JSON.stringify(pending.arguments || "").slice(0, 80) });
        onDone(`I’m ready to ${pending.toolName}. Please approve the action below.`);
        return;
      }
      onDelta(res.data.output || "");
      onDone(res.data.output || "The agent completed without a response.");
    } catch (error: unknown) {
      const message = axios.isAxiosError(error) && typeof error.response?.data === "object" && error.response?.data && "error" in error.response.data
        ? String(error.response.data.error)
        : "Backend request failed";
      logs.push("error", message);
      onDone(message);
    }
  };

  const meta = VIEW_META[view];

  return (
    <SidebarProvider className="font-mono">
      <AppSidebar active={view} onChange={setView} live={logs.live} hasApproval={!!approval} runId={chatId} />
      <SidebarInset className="flex h-screen max-h-screen flex-col overflow-hidden bg-background font-mono text-foreground">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b bg-background px-3 py-2">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-4" />
            <p className="font-mono text-xs font-medium">{meta.title}</p>
            <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">{meta.desc}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[11px]"><Circle weight="fill" className="size-2" data-icon="inline-start" />{logs.live ? "live" : "paused"}</Badge>
            <ThemeToggle />
          </div>
        </header>

        <main className={view === "overview" || view === "chat" || view === "logs" ? "flex w-full flex-1 min-h-0 flex-col gap-3 overflow-y-auto px-3 py-3 lg:overflow-hidden" : "flex w-full flex-1 flex-col gap-3 overflow-y-auto px-3 py-3"}>
          <Banners approval={approval} notice={null} onApprove={decide("approved")} onReject={decide("rejected")} onDismissNotice={() => {}} />

          {view === "overview" ? (
            <div className="flex flex-1 min-h-0 flex-col gap-3 lg:overflow-hidden">
              <Card size="sm"><CardContent className="p-6 text-center font-mono text-[11px] text-muted-foreground">no data available — run a chat to see metrics</CardContent></Card>
              <div className="grid shrink-0 gap-2 lg:grid-cols-3">
                <Card size="sm" className="cursor-pointer hover:border-foreground/30" onClick={() => setView("trace")}><CardHeader><CardTitle className="font-mono text-xs">trace</CardTitle><CardDescription className="font-mono text-[11px]">from agent</CardDescription></CardHeader><CardContent><p className="font-mono text-[11px] text-muted-foreground">{spans.length ? `${spans.length} spans` : "no data available"}</p><span className="font-mono text-[11px]">open trace →</span></CardContent></Card>
                <Card size="sm" className="cursor-pointer hover:border-foreground/30" onClick={() => setView("pipeline")}><CardHeader><CardTitle className="font-mono text-xs">pipeline</CardTitle><CardDescription className="font-mono text-[11px]">from agent</CardDescription></CardHeader><CardContent><p className="font-mono text-[11px] text-muted-foreground">no data available</p><span className="font-mono text-[11px]">open pipeline →</span></CardContent></Card>
                <Card size="sm" className="cursor-pointer hover:border-foreground/30" onClick={() => setView("prompts")}><CardHeader><CardTitle className="font-mono text-xs">prompts</CardTitle><CardDescription className="font-mono text-[11px]">{versions.length ? `${versions.length} versions` : "no data"}</CardDescription></CardHeader><CardContent><p className="font-mono text-[11px] text-muted-foreground">{versions.length ? "live" : "no data available"}</p><span className="font-mono text-[11px]">open prompts →</span></CardContent></Card>
              </div>
              <div className="grid gap-2 lg:flex-1 lg:min-h-0 lg:grid-cols-[1.55fr_1fr]">
                <LiveLogStream logs={logs} className="flex min-h-[280px] flex-col overflow-hidden lg:min-h-0 lg:h-full" scrollClassName="flex-1 min-h-0 overflow-auto rounded-none border bg-muted/30 p-2" />
                <ChatPanel logs={logs} onStreamChat={handleStreamChat} approval={approval} onApprove={decide("approved")} onReject={decide("rejected")} className="flex min-h-[320px] flex-col overflow-hidden lg:min-h-0 lg:h-full" scrollClassName="flex-1 min-h-0 overflow-auto rounded-none border p-2" />
              </div>
            </div>
          ) : null}

          {view === "trace" ? (
            spans.length ? (
              <div className="grid gap-2 lg:grid-cols-2">
                <TraceTimeline spans={spans} />
                <ThreadPanel messages={[]} approval={approval} onApprove={decide("approved")} onReject={decide("rejected")} />
              </div>
            ) : (
              <Empty className="border"><EmptyHeader><EmptyTitle className="font-mono text-xs">no data available</EmptyTitle><EmptyDescription className="font-mono text-[11px]">start a chat, trace will stream</EmptyDescription></EmptyHeader></Empty>
            )
          ) : null}

          {view === "pipeline" ? (
            <Empty className="border"><EmptyHeader><EmptyTitle className="font-mono text-xs">no data available</EmptyTitle><EmptyDescription className="font-mono text-[11px]">pipeline will stream from agent</EmptyDescription></EmptyHeader></Empty>
          ) : null}

          {view === "prompts" ? (
            versions.length ? <PromptVersions versions={versions} /> : (
              <Empty className="border"><EmptyHeader><EmptyTitle className="font-mono text-xs">no data available</EmptyTitle><EmptyDescription className="font-mono text-[11px]">prompt versions from backend</EmptyDescription></EmptyHeader></Empty>
            )
          ) : null}

          {view === "logs" ? (
            <div className="flex flex-1 min-h-0 flex-col gap-2 overflow-hidden">
              <LiveLogStream logs={logs} className="flex flex-1 min-h-0 flex-col overflow-hidden" scrollClassName="flex-1 min-h-0 overflow-auto rounded-none border bg-muted/30 p-2" />
            </div>
          ) : null}

          {view === "chat" ? (
            <div className="flex flex-1 min-h-0 flex-col gap-2 overflow-hidden">
              <ChatPanel logs={logs} onStreamChat={handleStreamChat} approval={approval} onApprove={decide("approved")} onReject={decide("rejected")} className="flex flex-1 min-h-0 flex-col overflow-hidden" scrollClassName="flex-1 min-h-0 overflow-auto rounded-none border p-2" />
            </div>
          ) : null}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
