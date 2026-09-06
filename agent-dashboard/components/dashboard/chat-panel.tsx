// GLOBAL TEMPLATE — agent chat with file upload.
// shadcn has no single "chat" component in this registry, so this composes
// the primitives per the skill's chat rules: scroll container + message rows
// + Attachment chips + Marker dividers + InputGroup-style composer.
// File upload: native <input type=file> (shadcn Input) rendered as chips;
// POST text + files to your /api/chat endpoint later (see onSend seam).
"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, PaperPlaneRight, X } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { LiveLogs } from "@/lib/use-live-logs";

interface ChatMsg {
  id: string;
  role: "user" | "agent";
  text: string;
  files?: string[];
}

// simple props: parent can give real stream handler
interface ChatPanelProps {
  logs: LiveLogs;
  className?: string;
  scrollClassName?: string;
  onStreamChat?: (message: string, onDelta: (delta: string) => void, onDone: (text: string) => void) => Promise<void>;
}

export function ChatPanel({ logs, className, scrollClassName, onStreamChat }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: "seed", role: "agent", text: "Connected. Ask about run #4821 or upload a statement CSV." },
  ]);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const send = async () => {
    const text = draft.trim();
    if (!text && files.length === 0) return;
    const user: ChatMsg = {
      id: `u-${Date.now()}`,
      role: "user",
      text: text || "(files only)",
      files: [...files],
    };
    logs.push("chat", `user: ${user.text}${files.length ? ` +${files.length} file(s)` : ""}`);
    setMessages((m) => [...m, user]);
    setDraft("");
    setFiles([]);

    // if parent gave real streaming function, use it
    if (onStreamChat) {
      const agentId = `a-${Date.now()}`;
      setMessages((m) => [...m, { id: agentId, role: "agent", text: "" }]);
      setStreamingId(agentId);
      try {
        await onStreamChat(
          text,
          (delta) => {
            // delta comes piece by piece
            setMessages((m) => m.map((msg) => (msg.id === agentId ? { ...msg, text: msg.text + delta } : msg)));
          },
          (finalText) => {
            if (finalText) setMessages((m) => m.map((msg) => (msg.id === agentId ? { ...msg, text: finalText } : msg)));
            setStreamingId(null);
          },
        );
      } catch {
        setMessages((m) => m.map((msg) => (msg.id === agentId ? { ...msg, text: "error connecting to backend" } : msg)));
        setStreamingId(null);
      }
      return;
    }

    // fallback mock if no backend
    logs.push("agent-event", "agent thinking… (wire /api/chat here)");
    setMessages((m) => [
      ...m,
      {
        id: `a-${Date.now()}`,
        role: "agent",
        text: "Noted. Backend not wired — set NEXT_PUBLIC_API_URL to connect.",
      },
    ]);
  };

  // keep scroller pinned to latest message (internal scroll)
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current?.closest('[data-slot="scroll-area"]')?.querySelector(
      '[data-slot="scroll-area-viewport"]',
    ) as HTMLElement | null;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <Card className={`flex min-h-0 flex-1 flex-col overflow-hidden ${className ?? ""}`}>
      <CardHeader className="shrink-0">
        <CardTitle className="font-mono text-xs">agent chat</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <ScrollArea className={scrollClassName ?? "h-64 flex-1 rounded-none border p-2"}>
          <div ref={scrollRef} className="flex flex-col gap-2">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-none border px-2 py-1.5 ${
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/40"
                  }`}
                >
                  <p className="font-mono text-[11px] leading-relaxed">{m.text}</p>
                  {m.files?.map((f) => (
                    <Badge key={f} variant="outline" className="mt-1 font-mono text-[10px]">
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Attachment chips (pending upload) */}
        {files.length > 0 ? (
          <div className="flex shrink-0 flex-wrap gap-1">
            {files.map((f) => (
              <Badge key={f} variant="secondary" className="font-mono text-[10px]">
                {f}
                <button
                  className="ml-1"
                  aria-label={`Remove ${f}`}
                  onClick={() => setFiles((p) => p.filter((x) => x !== f))}
                >
                  <X data-icon="inline-start" />
                </button>
              </Badge>
            ))}
          </div>
        ) : null}

        {/* Composer: fixed at bottom, input bar */}
        <div className="flex shrink-0 items-end gap-1.5 border-t bg-card pt-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const names = Array.from(e.target.files ?? []).map((f) => f.name);
              setFiles((p) => [...p, ...names].slice(0, 5));
              e.target.value = "";
            }}
          />
          <Button
            size="icon-sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            aria-label="Attach files"
          >
            <Paperclip data-icon="inline-start" />
          </Button>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Message agent… (Enter to send)"
            rows={2}
            className="min-h-0 flex-1 font-mono text-xs"
            aria-label="Message agent"
          />
          <Button size="icon-sm" onClick={send} aria-label="Send message">
            <PaperPlaneRight data-icon="inline-start" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
