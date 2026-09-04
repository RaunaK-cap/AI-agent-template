// GLOBAL TEMPLATE — left trace timeline (screenshot 1, left side).
// Workflow header -> agent rows -> prompt/context/tool/llm spans on a rail.
// Minimal B&W: rail + dots via borders, badges for tags, mono small text.
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TraceSpan } from "@/lib/agent-types";

function SpanRow({ span }: { span: TraceSpan }) {
  return (
    <div className="relative flex gap-2 pl-4">
      {/* Timeline rail dot */}
      <span className="absolute top-1.5 left-[3px] size-1.5 rounded-full bg-foreground" />
      <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-none border bg-card px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="font-mono text-[10px]">
            {span.kind}
          </Badge>
          <span className="truncate font-mono text-xs font-medium">{span.title}</span>
          {span.duration ? (
            <span className="font-mono text-[11px] text-muted-foreground">{span.duration}</span>
          ) : null}
          {span.cost ? (
            <span className="font-mono text-[11px] text-muted-foreground">{span.cost}</span>
          ) : null}
          {span.badges?.map((b) => (
            <Badge key={b} variant="secondary" className="font-mono text-[10px]">
              {b}
            </Badge>
          ))}
        </div>
        {span.detail ? (
          <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">{span.detail}</p>
        ) : null}
        {span.input ? (
          <p className="font-mono text-[11px]">
            <span className="text-muted-foreground">input · </span>
            {span.input}
          </p>
        ) : null}
        {span.output ? (
          <p className="font-mono text-[11px]">
            <span className="text-muted-foreground">output · </span>
            {span.output}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function TraceTimeline({ spans }: { spans: TraceSpan[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono text-xs">workflow · support access · 4.8s</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Vertical rail */}
        <div className="flex flex-col gap-2 border-l pl-0">
          {spans.map((s) => (
            <SpanRow key={s.id} span={s} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
