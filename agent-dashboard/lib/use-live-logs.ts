// simple log store - no demo logs
"use client";

import { useCallback, useState } from "react";
import type { LogLine } from "./agent-types";

export function useLiveLogs() {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [live, setLive] = useState(true);

  // add one log line
  const push = useCallback((source: string, text: string) => {
    setLines((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        time: new Date().toLocaleTimeString(),
        source,
        text,
      },
    ].slice(-200));
  }, []);

  // clear all logs
  const clear = () => setLines([]);

  return { lines, live, setLive, push, clear };
}

export type LiveLogs = ReturnType<typeof useLiveLogs>;
