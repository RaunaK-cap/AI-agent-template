// GLOBAL TEMPLATE — banners stacked under the top bar.
// 1) Notification banner (spike / system notice) via Alert.
// 2) Approval banner with the trace excerpt + Approve/Reject actions.
// Both collapse after action; parent owns state so approval syncs with ThreadPanel.
"use client";

import { Bell, Check, X } from "@phosphor-icons/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PendingApproval } from "@/lib/agent-types";

interface Props {
  approval: PendingApproval | null;
  notice: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDismissNotice: () => void;
}

export function Banners({ approval, notice, onApprove, onReject, onDismissNotice }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {notice ? (
        <Alert className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <Bell data-icon="inline-start" className="mt-0.5 shrink-0" />
            <div>
              <AlertTitle className="font-mono text-xs">spike detected</AlertTitle>
              <AlertDescription className="font-mono text-[11px]">{notice}</AlertDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon-xs" onClick={onDismissNotice} aria-label="Dismiss">
            <X data-icon="inline-start" />
          </Button>
        </Alert>
      ) : null}

      {approval ? (
        <Card size="sm" className="border-foreground/20">
          <CardHeader>
            <CardTitle className="font-mono text-xs">approval required · {approval.toolName}</CardTitle>
            <CardDescription className="font-mono text-[11px]">{approval.summary}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {/* Trace excerpt ties the banner to the live log stream below */}
            <code className="truncate bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
              {approval.logExcerpt}
            </code>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onApprove(approval.id)}>
                <Check data-icon="inline-start" /> Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => onReject(approval.id)}>
                <X data-icon="inline-start" /> Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
