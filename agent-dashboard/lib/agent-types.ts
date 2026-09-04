// GLOBAL TEMPLATE — shared domain types for any agent dashboard.
// Reuse this file in future projects: only the tool names / metric labels change,
// the shape (trace -> spans, thread, approval, versions) stays the same.

export type SpanKind = "agent" | "prompt" | "context" | "tool" | "llm";

// One step in the left trace timeline (mirrors Neatlogs workflow view:
// Agent -> Prompt -> Context -> Tool[input/output] -> LLM).
export interface TraceSpan {
  id: string;
  kind: SpanKind;
  title: string;
  detail?: string;
  duration?: string; // e.g. "4.8s", "0.6s"
  cost?: string; // e.g. "$0.0058" — LLM spans only
  badges?: string[]; // small tags like "Billing", "Access request"
  input?: string;
  output?: string;
}

// One comment in the right thread panel (human or agent note on a tool).
export interface ThreadMessage {
  id: string;
  author: string;
  time: string;
  body: string;
  // inline `code` fragments are wrapped in backticks by the renderer
  reactions?: { emoji: string; count: number }[];
  isSystem?: boolean; // system/agent-analysis styling
}

// Pending human decision surfaced as banner + card.
export interface PendingApproval {
  id: string;
  toolName: string;
  summary: string;
  filePath: string; // e.g. "tools/add_member.md"
  logExcerpt: string; // short trace excerpt shown inside the banner
}

// Detect -> Investigate -> Act pipeline stage (second screenshot set).
export interface PipelineStage {
  index: string; // "01"
  name: string; // "DETECT" | "INVESTIGATE" | "ACT"
  title: string;
  body: string;
  active?: boolean;
}

// Prompt version row (fourth screenshot).
export interface PromptVersion {
  version: string; // "v12" ...
  lines: string[];
  current?: boolean;
}

// Top metric strip cards.
export interface Metric {
  label: string;
  value: string;
  hint: string;
}

// Live stream log line. Backend will POST these via SSE
// (`POST /api/chat/stream` on the agent server); the dashboard
// only renders — see `useLiveLogs` for the wiring seam.
export interface LogLine {
  id: string;
  time: string;
  source: string; // "agent-event" | "completed" | "error" | "tool"
  text: string;
}
