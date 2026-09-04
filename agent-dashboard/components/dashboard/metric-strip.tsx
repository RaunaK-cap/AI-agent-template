// GLOBAL TEMPLATE — metric strip. 4 small cards, mono labels.
// Wire `metrics` to your /health + usage endpoint later; props already match.
import { Card, CardContent } from "@/components/ui/card";
import type { Metric } from "@/lib/agent-types";

export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {metrics.map((m) => (
        <Card key={m.label} size="sm">
          <CardContent className="flex flex-col gap-1">
            <span className="font-mono text-[11px] text-muted-foreground">{m.label}</span>
            <span className="font-mono text-sm font-medium">{m.value}</span>
            <span className="truncate font-mono text-[11px] text-muted-foreground">{m.hint}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
