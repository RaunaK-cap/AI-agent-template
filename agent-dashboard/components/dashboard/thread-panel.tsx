// GLOBAL TEMPLATE — right thread panel (screenshot 1, right side).
// Renders `code` fragments, reactions, and the Fix approval card.
// Approve/Reject bubble up so Banners + logs stay in sync (single parent state).
"use client";

import { ArrowRight } from "@phosphor-icons/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { PendingApproval, ThreadMessage } from "@/lib/agent-types";

// Render `backtick` fragments as inline code chips (mono, muted bg).
function RichText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <p className="font-mono text-[11px] leading-relaxed">
      {parts.map((p, i) =>
        p.startsWith("`") ? (
          <code key={i} className="bg-muted px-1 py-0.5 text-[11px]">
            {p.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </p>
  );
}

interface Props {
  messages: ThreadMessage[];
  approval: PendingApproval | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function ThreadPanel({ messages, approval, onApprove, onReject }: Props) {
  return (
    <Card className="flex min-h-0 flex-1 flex-col">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="font-mono text-xs">
            thread on <Badge variant="secondary">tool</Badge> {approval?.toolName ?? "add_member"}
          </CardTitle>
          <span className="font-mono text-[11px] text-muted-foreground">{messages.length} replies</span>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        {messages.map((m) => (
          <div key={m.id} className="flex gap-2">
            <Avatar className="size-6 shrink-0">
              <AvatarFallback className="font-mono text-[10px]">
                {m.isSystem ? "nl" : m.author.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="font-mono text-[11px]">
                <span className="font-medium">{m.author}</span>{" "}
                <span className="text-muted-foreground">{m.time}</span>
              </p>
              <RichText text={m.body} />
              {m.reactions ? (
                <div className="flex gap-1">
                  {m.reactions.map((r) => (
                    <Badge key={r.emoji} variant="outline" className="font-mono text-[10px]">
                      {r.emoji} {r.count}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {approval ? (
          <>
            <Separator />
            {/* Fix card mirrors the screenshot: summary + file + Preview/Approve */}
            <div className="flex flex-col gap-2 rounded-none border p-3">
              <p className="font-mono text-xs font-medium">{approval.summary.split("—")[0]}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{approval.summary}</p>
              <code className="w-fit bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                {approval.filePath}
              </code>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost">
                  Preview
                </Button>
                <Button size="sm" onClick={() => onApprove(approval.id)}>
                  Approve
                </Button>
              </div>
            </div>
          </>
        ) : (
          <p className="font-mono text-[11px] text-muted-foreground">
            no pending approvals — decisions appear here with full log context.
          </p>
        )}

        {/* Reply box: posts to thread (local for template; POST to backend later) */}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => e.preventDefault()}
        >
          <Input placeholder="Reply..." className="font-mono text-xs" aria-label="Reply to thread" />
          <Button type="submit" size="icon-sm" aria-label="Send reply">
            <ArrowRight data-icon="inline-start" />
          </Button>
        </form>
        <div className="hidden">
          {/* keep reject reachable for a11y even when card shows Approve only */}
          <button onClick={() => approval && onReject(approval.id)} />
        </div>
      </CardContent>
    </Card>
  );
}
