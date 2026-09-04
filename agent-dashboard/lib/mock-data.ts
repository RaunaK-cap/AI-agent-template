// GLOBAL TEMPLATE — mock data shaped exactly like the Neatlogs screenshots
// you provided, so the layout can be validated without a backend.
// Swap these exports for fetch() calls to your agent server later;
// component props already match the real shapes in `agent-types.ts`.

import type {
  Metric,
  PendingApproval,
  PipelineStage,
  PromptVersion,
  ThreadMessage,
  TraceSpan,
} from "./agent-types";

// Top strip: keep to 4 cards, small mono labels. Values update per run.
export const mockMetrics: Metric[] = [
  { label: "run", value: "#4821", hint: "4.8s wall" },
  { label: "latency", value: "1.7s", hint: "slow llm response" },
  { label: "cost", value: "$0.0058", hint: "per run" },
  { label: "auto-close", value: "98%", hint: "2 awaiting review" },
];

// Left timeline: Workflow -> Agents -> Prompt -> Context -> Tool -> LLM.
export const mockSpans: TraceSpan[] = [
  {
    id: "w1",
    kind: "agent",
    title: "Support Access Workflow",
    duration: "4.8s",
    badges: ["workflow"],
  },
  {
    id: "a1",
    kind: "agent",
    title: "Question Extraction Agent",
  },
  {
    id: "a2",
    kind: "agent",
    title: "Support Operations Agent",
    badges: ["Access request", "Billing"],
  },
  {
    id: "p1",
    kind: "prompt",
    title: "Prompt",
    detail:
      "You are the Support Operations Agent. Read the customer's email, figure out what they need, choose the right tool, and confirm what was done.",
  },
  {
    id: "c1",
    kind: "context",
    title: "Context",
    detail: "Unexpected charge for external agency — dashboard access billed as paid seat.",
    input: "to @billing-support · cc @design-agency",
    output: "billing-screenshot.png attached",
  },
  {
    id: "t1",
    kind: "tool",
    title: "add_member",
    duration: "0.6s",
    badges: ["4 comments"],
    input: "email agency@partner.co",
    output: "member Created",
  },
  {
    id: "l1",
    kind: "llm",
    title: "Model",
    duration: "1.7s",
    cost: "$0.0058",
    badges: ["Paid seat created", "Slow LLM Response"],
    detail:
      "Chose add_member to give the agency access as a viewer. Result: the user was added as a billable member.",
  },
];

// Right thread: discussion on the tool call + proposed fix card.
export const mockThread: ThreadMessage[] = [
  {
    id: "m1",
    author: "Sara",
    time: "2:43 PM",
    body: "I found the issue. This should have used the `guest invite` flow. The agent used `add_member`, so the customer ended up with a paid seat.",
    reactions: [
      { emoji: "🎯", count: 2 },
      { emoji: "👀", count: 1 },
    ],
  },
  {
    id: "m2",
    author: "Marcus",
    time: "2:43 PM",
    body: "That makes sense. @neatlogs, can you check why it picked `add_member` instead of `invite_guest`?",
    reactions: [{ emoji: "👍", count: 1 }],
  },
  {
    id: "m3",
    author: "neatlogs AI",
    time: "2:43 PM",
    isSystem: true,
    body: "I found the likely cause. The tool descriptions are too vague — they explain what the tools do, but not when to use one instead of the other. Nothing clearly told the model that external, non-billable access should go through `invite_guest`.",
    reactions: [{ emoji: "💡", count: 1 }],
  },
  {
    id: "m4",
    author: "neatlogs AI",
    time: "2:43 PM",
    isSystem: true,
    body: "Here's a fix updating the tool description so the model can tell `billable members` apart from `non-billable guests`.",
  },
];

export const mockApproval: PendingApproval = {
  id: "appr-01",
  toolName: "add_member",
  summary: "Fix Tool Selection Logic — distinguish paid members from guest collaborators",
  filePath: "tools/add_member.md",
  logExcerpt: "run #4821 · add_member 0.6s · member Created",
};

// Detect / Investigate / Act stages.
export const mockStages: PipelineStage[] = [
  {
    index: "01",
    name: "DETECT",
    title: "Catch the spike early",
    body: "neatlogs spots unusual patterns in production and alerts the right person before the issue spreads.",
    active: true,
  },
  {
    index: "02",
    name: "INVESTIGATE",
    title: "Find out what went wrong",
    body: "Ask neatlogs to investigate, and it uses the trace to find the likely cause and suggest a fix.",
  },
  {
    index: "03",
    name: "ACT",
    title: "Move from insight to action",
    body: "Send the fix to your task board or straight to a coding agent.",
  },
];

export const mockVersions: PromptVersion[] = [
  { version: "v12", lines: ["You are a billing support agent."] },
  { version: "v13", lines: ["Use the knowledge base to answer."] },
  { version: "v14", lines: ["Always cite the source and date."] },
  {
    version: "v15",
    current: true,
    lines: [
      "You are a billing support agent.",
      "Use the knowledge base to answer.",
      "Always cite the source and date.",
      "Escalate if confidence is low.",
      "Escalate to a human when confidence is low.",
    ],
  },
];
