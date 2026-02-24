"use client"

import * as React from "react"
import { CalendarSearch, PanelRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { EventDetailPanel } from "./event-detail-panel"
import type { CalendarEvent } from "./week-view-types"

interface SidebarLeftProps extends React.ComponentProps<typeof Sidebar> {
  selectedEvent?: CalendarEvent | null;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
}

export function SidebarLeft({
  selectedEvent,
  onPrevWeek,
  onNextWeek,
  ...props
}: SidebarLeftProps) {
  const { toggleSidebar } = useSidebar()

  return (
    <Sidebar side="right" className="border-l !bg-context-panel [&_[data-slot=sidebar-inner]]:!bg-context-panel" style={{ "--muted-foreground": "#C7C5C1" } as React.CSSProperties} {...props}>
      <SidebarHeader className="h-14 justify-center px-4">
        <div className="flex items-center gap-2">
          {!selectedEvent && (
            <>
              <CalendarSearch className="text-muted-foreground size-4 shrink-0" />
              <input
                type="text"
                placeholder="Search events"
                className="text-muted-foreground placeholder:text-muted-foreground h-9 w-full bg-transparent text-xs outline-none"
              />
            </>
          )}
          {selectedEvent && <div className="flex-1" />}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                onClick={toggleSidebar}
              >
                <PanelRightIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Close context panel <Kbd className="ml-1">/</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {selectedEvent ? (
          <EventDetailPanel event={selectedEvent} onPrevWeek={onPrevWeek} onNextWeek={onNextWeek} />
        ) : (
          <SidebarGroup className="px-3 pt-6">
            <SidebarGroupLabel className="text-foreground text-xs font-semibold px-0">
              Useful shortcuts
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="flex flex-col">
                <ShortcutRow label="Command menu">
                  <Kbd>⌘</Kbd>
                  <Kbd>K</Kbd>
                </ShortcutRow>
                <ShortcutRow label="Menu bar calendar">
                  <Kbd>control</Kbd>
                  <Kbd>⌘</Kbd>
                  <Kbd>K</Kbd>
                </ShortcutRow>
                <ShortcutRow label="Toggle sidebar">
                  <Kbd>`</Kbd>
                </ShortcutRow>
                <ShortcutRow label="Show teammate calendar">
                  <Kbd>P</Kbd>
                </ShortcutRow>
                <ShortcutRow label="Go to date">
                  <Kbd>.</Kbd>
                </ShortcutRow>
                <ShortcutRow label="All keyboard shortcuts">
                  <Kbd>?</Kbd>
                </ShortcutRow>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

function ShortcutRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="text-muted-foreground flex items-center justify-between py-1 text-xs">
      <span>{label}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  )
}
