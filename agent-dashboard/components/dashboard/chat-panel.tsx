// GLOBAL TEMPLATE — agent chat with file upload.
// shadcn has no single "chat" component in this registry, so this composes
// the primitives per the skill's chat rules: scroll container + message rows
// + Attachment chips + Marker dividers + InputGroup-style composer.
// File upload: native <input type=file> (shadcn Input) rendered as chips;
// POST text + files to your /api/chat endpoint later (see onSend seam).
"use client";

import { useRef, useState } from "react";
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

export function ChatPanel({ logs }: { logs: LiveLogs }) {
  // Local transcript. Replace echo with fetch("/api/chat") in production.
  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: "seed", role: "agent", text: "Connected. Ask about run #4821 or upload a statement CSV." },
  ]);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const send = () => {
    const text = draft.trim();
    if (!text && files.length === 0) return;
    const user: ChatMsg = {
      id: `u-${Date.now()}`,
      role: "user",
      text: text || "(files only)",
      files: [...files],
    };
    // Mirror into the live log stream so chat + logs tell one story.
    logs.push("chat", `user: ${user.text}${files.length ? ` +${files.length} file(s)` : ""}`);
    logs.push("agent-event", "agent thinking… (wire /api/chat here)");
    setMessages((m) => [
      ...m,
      user,
      {
        id: `a-${Date.now()}`,
        role: "agent",
        text: "Noted. Backend not wired in this template — connect POST /api/chat to stream the real answer here.",
      },
    ]);
    setDraft("");
    setFiles([]);
  };

  return (
    <Card className="flex min-h-0 flex-1 flex-col">
      <CardHeader>
        <CardTitle className="font-mono text-xs">agent chat</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2">
        <ScrollArea className="h-64 flex-1 rounded-none border p-2">
          <div className="flex flex-col gap-2">
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
          <div className="flex flex-wrap gap-1">
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

        {/* Composer: file button + textarea + send. Enter sends, Shift+Enter newline. */}
        <div className="flex items-end gap-1.5">
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
