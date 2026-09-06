// dashboard with sidebar - all api calls in same file using axios
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
import { DetectPanel } from "@/components/dashboard/detect-panel";
import { LiveLogStream } from "@/components/dashboard/live-logs";
import { MetricStrip } from "@/components/dashboard/metric-strip";
import { PromptVersions } from "@/components/dashboard/prompt-versions";
import { ThreadPanel } from "@/components/dashboard/thread-panel";
import { TraceTimeline } from "@/components/dashboard/trace-timeline";
import { ThemeToggle } from "@/components/theme";
import { useLiveLogs } from "@/lib/use-live-logs";
import type { Metric, PendingApproval, PipelineStage, PromptVersion, ThreadMessage, TraceSpan } from "@/lib/agent-types";

// backend url from .env
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  const [approval, setApproval] = useState<PendingApproval | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const logs = useLiveLogs();
  // empty at start - will fill from real agent when data comes
  const [spans, setSpans] = useState<TraceSpan[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const runId = "#4821";
  const sessionId = "demo-session";

  // check backend health on load - simple axios GET
  useEffect(() => {
    axios
      .get(`${API_URL}/health`)
      .then((res) => {
        logs.push("agent-event", "backend connected: " + res.data.message);
        // metrics from health if available
        if (res.data.metrics) setMetrics(res.data.metrics);
      })
      .catch(() => {
        logs.push("error", "backend not reachable at " + API_URL);
      })

    axios
      .get(`${API_URL}/api/prompts`)
      .then((res) => {
        if (res.data && Array.isArray(res.data)) setVersions(res.data);
      })
      .catch(() => {})

    // optional: fetch stages/thread if you add endpoints
    // axios.get(`${API_URL}/api/pipeline`).then(r=> setStages(r.data))
  }, [])

  // approve / reject - POST /api/approvals/:id using axios
  const decide = (decision: "approved" | "rejected") => async (id: string) => {
    const apiDecision = decision === "approved" ? "approve" : "reject"
    try {
      await axios.post(`${API_URL}/api/approvals/${id}`, { decision: apiDecision })
      logs.push("agent-event", `${decision} ${id} sent to backend`)
      toast(decision === "approved" ? "Approved — sent" : "Rejected — sent")
      setApproval(null)
    } catch {
      setApproval(null)
      logs.push("agent-event", `${decision} ${id} (mock)`)
      toast(decision === "approved" ? "Approved — mock" : "Rejected — mock")
    }
  }

  // chat streaming - POST /api/chat/stream using axios
  const handleStreamChat = async (message: string, onDelta: (d: string) => void, onDone: (t: string) => void) => {
    let fullText = ""
    let buffer = ""
    let lastLen = 0
    try {
      await axios.post(`${API_URL}/api/chat/stream`, { message, sessionId }, {
        headers: { "Content-Type": "application/json" },
        responseType: "text",
        onDownloadProgress: (e) => {
          const xhr = (e as any).event?.target as XMLHttpRequest
          if (!xhr) return
          const text = xhr.responseText
          const chunk = text.slice(lastLen)
          lastLen = text.length
          buffer += chunk
          const parts = buffer.split("\n\n")
          buffer = parts.pop() || ""
          for (const part of parts) {
            if (!part.trim()) continue
            let event = "message"
            let dataStr = ""
            for (const line of part.split("\n")) {
              if (line.startsWith("event:")) event = line.replace("event:", "").trim()
              if (line.startsWith("data:")) dataStr = line.replace("data:", "").trim()
            }
            let data: any = {}
            try { data = dataStr ? JSON.parse(dataStr) : {} } catch {}
            if (event === "chat_delta") {
              const delta = data.text || ""
              fullText += delta
              onDelta(delta)
            }
            if (event === "log") {
              logs.push(data.source || "agent-event", data.text || JSON.stringify(data))
            }
            if (event === "trace") {
              setSpans((prev) => [
                ...prev,
                {
                  id: data.id || `s-${Date.now()}-${Math.random()}`,
                  kind: data.kind || "tool",
                  title: data.title || "step",
                  detail: data.detail || data.input || "",
                  input: data.input,
                  output: data.output,
                },
              ])
            }
            if (event === "approval") {
              setApproval({
                id: data.approvalId,
                toolName: data.toolName,
                summary: `Agent wants to use ${data.toolName}`,
                filePath: `tools/${data.toolName}.md`,
                logExcerpt: JSON.stringify(data.arguments || "").slice(0, 80),
              })
              logs.push("agent-event", `approval needed ${data.toolName}`)
            }
            if (event === "done") {
              onDone(data.output || fullText)
              logs.push("completed", `run ${data.runId || ""} done`)
              if (data.output) setNotice(null)
            }
            if (event === "error") {
              logs.push("error", data.message || "error")
            }
          }
        },
      })
    } catch (err: any) {
      logs.push("error", "backend not reachable")
      throw err
    }
  }

  const meta = VIEW_META[view];

  return (
    <SidebarProvider className="font-mono">
      <AppSidebar active={view} onChange={setView} live={logs.live} hasApproval={!!approval} runId={runId} />
      <SidebarInset className="flex h-screen max-h-screen flex-col overflow-hidden bg-background font-mono text-foreground">
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
          <Banners approval={approval} notice={notice} onApprove={decide("approved")} onReject={decide("rejected")} onDismissNotice={() => setNotice(null)} />

          {view === "overview" ? (
            <div className="flex flex-1 min-h-0 flex-col gap-3 lg:overflow-hidden">
              {metrics.length ? <MetricStrip metrics={metrics} /> : (
                <Card size="sm"><CardContent className="p-6 text-center font-mono text-[11px] text-muted-foreground">no data available — metrics will stream from agent</CardContent></Card>
              )}
              <div className="grid shrink-0 gap-2 lg:grid-cols-3">
                <Card size="sm" className="cursor-pointer hover:border-foreground/30" onClick={() => setView("trace")} role="button" tabIndex={0}>
                  <CardHeader><CardTitle className="font-mono text-xs">trace · support access</CardTitle><CardDescription className="font-mono text-[11px]">from real agent</CardDescription></CardHeader>
                  <CardContent><p className="font-mono text-[11px] text-muted-foreground">{spans.length ? `${spans.length} spans from agent` : "no data available — start a chat"}</p><span className="font-mono text-[11px]">open trace →</span></CardContent>
                </Card>
                <Card size="sm" className="cursor-pointer hover:border-foreground/30" onClick={() => setView("pipeline")} role="button" tabIndex={0}>
                  <CardHeader><CardTitle className="font-mono text-xs">pipeline · detect</CardTitle><CardDescription className="font-mono text-[11px]">from real agent</CardDescription></CardHeader>
                  <CardContent><p className="font-mono text-[11px] text-muted-foreground">{stages.length ? `${stages.length} stages` : "no data available — pipeline will stream"}</p><span className="font-mono text-[11px]">open pipeline →</span></CardContent>
                </Card>
                <Card size="sm" className="cursor-pointer hover:border-foreground/30" onClick={() => setView("prompts")} role="button" tabIndex={0}>
                  <CardHeader><CardTitle className="font-mono text-xs">prompts · versions</CardTitle><CardDescription className="font-mono text-[11px]">{versions.length ? `${versions.length} versions` : "no data available"}</CardDescription></CardHeader>
                  <CardContent><p className="font-mono text-[11px] text-muted-foreground">{versions.length ? `${versions.find((v) => v.current)?.version} live` : "no data available — prompts will load from backend"}</p><span className="font-mono text-[11px]">open prompts →</span></CardContent>
                </Card>
              </div>
              <div className="grid gap-2 lg:flex-1 lg:min-h-0 lg:grid-cols-[1.55fr_1fr] xl:grid-cols-[1.7fr_1fr]">
                <LiveLogStream logs={logs} className="flex min-h-[280px] flex-col overflow-hidden lg:min-h-0 lg:h-full" scrollClassName="flex-1 min-h-0 overflow-auto rounded-none border bg-muted/30 p-2" />
                <ChatPanel logs={logs} onStreamChat={handleStreamChat} className="flex min-h-[320px] flex-col overflow-hidden lg:min-h-0 lg:h-full" scrollClassName="flex-1 min-h-0 overflow-auto rounded-none border p-2" />
              </div>
            </div>
          ) : null}

          {view === "trace" ? (
            spans.length ? (
              <div className="grid gap-2 lg:grid-cols-2">
                <TraceTimeline spans={spans} />
                <ThreadPanel messages={thread} approval={approval} onApprove={decide("approved")} onReject={decide("rejected")} />
              </div>
            ) : (
              <Empty className="border">
                <EmptyHeader><EmptyTitle className="font-mono text-xs">no data available</EmptyTitle><EmptyDescription className="font-mono text-[11px]">trace will stream from agent when you start a chat</EmptyDescription></EmptyHeader>
              </Empty>
            )
          ) : null}

          {view === "pipeline" ? (
            stages.length ? <DetectPanel stages={stages} /> : (
              <Empty className="border">
                <EmptyHeader><EmptyTitle className="font-mono text-xs">no data available</EmptyTitle><EmptyDescription className="font-mono text-[11px]">pipeline stages will stream from agent</EmptyDescription></EmptyHeader>
              </Empty>
            )
          ) : null}

          {view === "prompts" ? (
            versions.length ? <PromptVersions versions={versions} /> : (
              <Empty className="border">
                <EmptyHeader><EmptyTitle className="font-mono text-xs">no data available</EmptyTitle><EmptyDescription className="font-mono text-[11px]">prompt versions will load from backend</EmptyDescription></EmptyHeader>
              </Empty>
            )
          ) : null}

          {view === "logs" ? (
            <div className="flex flex-1 min-h-0 flex-col gap-2 overflow-hidden">
              <Card size="sm" className="shrink-0 border-dashed"><CardContent className="font-mono text-[11px] text-muted-foreground">real logs from agent via POST /api/chat/stream — no demo data</CardContent></Card>
              <LiveLogStream logs={logs} className="flex flex-1 min-h-0 flex-col overflow-hidden" scrollClassName="flex-1 min-h-0 overflow-auto rounded-none border bg-muted/30 p-2" />
            </div>
          ) : null}

          {view === "chat" ? (
            <div className="flex flex-1 min-h-0 flex-col gap-2 overflow-hidden">
              <Card size="sm" className="shrink-0 border-dashed"><CardContent className="font-mono text-[11px] text-muted-foreground">chat via POST /api/chat/stream using axios — stream appears above</CardContent></Card>
              <ChatPanel logs={logs} onStreamChat={handleStreamChat} className="flex flex-1 min-h-0 flex-col overflow-hidden" scrollClassName="flex-1 min-h-0 overflow-auto rounded-none border p-2" />
            </div>
          ) : null}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
