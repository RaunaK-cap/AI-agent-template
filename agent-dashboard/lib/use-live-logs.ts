// GLOBAL TEMPLATE — live log streaming seam.
// Today this simulates the agent backend so the UI can be built standalone.
// To go live: replace `pushSimulatedLine` with an EventSource fetch to
// `POST /api/chat/stream` on your Express agent server (SSE events:
// `agent-event` / `completed` / `error`). Nothing else in the UI changes.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LogLine } from "./agent-types";

const SIMULATED = [
  { source: "agent-event", text: "runner.run started · session demo-session" },
  { source: "tool", text: "tool call add_member(email=agency@partner.co) 0.6s" },
  { source: "agent-event", text: "llm chunk · model 1.7s $0.0058" },
  { source: "completed", text: "run #4821 completed · awaiting approval" },
];

export function useLiveLogs(autoStart = true) {
  // Log buffer shown in LiveLogStream. Cap length to keep DOM light.
  const [lines, setLines] = useState<LogLine[]>([]);
  const [live, setLive] = useState(autoStart);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Append one line with timestamp. Reused by both simulator and future SSE handler.
  const push = useCallback((source: string, text: string) => {
    setLines((prev) =>
      [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          time: new Date().toLocaleTimeString(),
          source,
          text,
        },
      ].slice(-200),
    );
  }, []);

  useEffect(() => {
    if (!live) return;
    let i = 0;
    timer.current = setInterval(() => {
      const s = SIMULATED[i % SIMULATED.length];
      push(s.source, s.text);
      i += 1;
    }, 1800);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [live, push]);

  return {
    lines,
    live,
    setLive,
    push, // expose so ChatPanel can mirror user/agent turns into the stream
    clear: () => setLines([]),
  };
}

export type LiveLogs = ReturnType<typeof useLiveLogs>;
