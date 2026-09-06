// Minimal sidebar for agent dashboard — stays in same mono / neutral style
// as the rest of the dashboard. Uses shadcn Sidebar primitives (base-lyra).
// Each menu item switches the main view instead of showing everything
// on a single tabbed page.
"use client";

import {
  ChatCircle,
  ClockCounterClockwise,
  Kanban,
  SquaresFour,
  Terminal,
  GitBranch,
  Circle,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme";

export type DashboardView = "overview" | "trace" | "pipeline" | "prompts" | "logs" | "chat";

interface AppSidebarProps {
  active: DashboardView;
  onChange: (v: DashboardView) => void;
  live: boolean;
  hasApproval: boolean;
  runId?: string;
}

const NAV = [
  { id: "chat" as const, label: "chat", icon: ChatCircle, hint: "agent" },
  { id: "overview" as const, label: "overview", icon: SquaresFour, hint: "metrics & alerts" },
  { id: "trace" as const, label: "trace", icon: GitBranch, hint: "timeline + thread" },
  { id: "pipeline" as const, label: "pipeline", icon: Kanban, hint: "detect → act" },
  { id: "prompts" as const, label: "prompts", icon: ClockCounterClockwise, hint: "versions" },
  { id: "logs" as const, label: "logs", icon: Terminal, hint: "live stream" },
] satisfies { id: DashboardView; label: string; icon: React.ElementType; hint: string }[];

export function AppSidebar({ active, onChange, live, hasApproval, runId = "#4821" }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" className="border-r font-mono">
      <SidebarHeader className="gap-1">
        <div className="flex items-center gap-2 px-1 py-1">
          <span className="flex size-6 shrink-0 items-center justify-center bg-primary text-[11px] font-bold text-primary-foreground">
            nl
          </span>
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <p className="truncate text-xs font-medium leading-none">agent dashboard</p>
            <p className="truncate text-[11px] text-muted-foreground">run {runId}</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[11px]">navigate</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={active === item.id}
                    onClick={() => onChange(item.id)}
                    tooltip={item.label}
                    className="font-mono"
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                  {/* pending approval dot — only on trace (where approval lives) */}
                  {item.id === "trace" && hasApproval ? (
                    <SidebarMenuBadge className="bg-foreground text-background">•</SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel className="font-mono text-[11px]">run {runId}</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="flex flex-col gap-1 rounded-none border bg-muted/30 px-2 py-2">
              <div className="flex items-center gap-1.5">
                <Circle weight="fill" className="size-2 text-foreground" />
                <span className="font-mono text-[11px]">{live ? "live" : "paused"}</span>
                {hasApproval ? (
                  <Badge variant="secondary" className="ml-auto font-mono text-[10px]">
                    approval
                  </Badge>
                ) : null}
              </div>
              <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                cmd+b to toggle · sidebar collapses to icons on desktop.
              </p>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2">
        <SidebarSeparator className="mx-0" />
        <div className="flex items-center justify-between gap-2 px-1 group-data-[collapsible=icon]:justify-center">
          <Badge variant="outline" className="font-mono text-[11px] group-data-[collapsible=icon]:hidden">
            <Circle weight="fill" className="size-2" data-icon="inline-start" />
            {live ? "live" : "paused"}
          </Badge>
          <ThemeToggle />
        </div>
        <p className="px-1 font-mono text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden">
          minimal · mono · neutral
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
