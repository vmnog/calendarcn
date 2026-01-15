"use client"

import * as React from "react"
import { CalendarSearch, PanelRightIcon } from "lucide-react"

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

export function SidebarLeft({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { toggleSidebar } = useSidebar()

  return (
    <Sidebar side="right" className="border-l bg-white dark:bg-[#191919]" {...props}>
      <SidebarHeader className="p-3">
        <div className="flex items-center gap-2">
          <CalendarSearch className="text-muted-foreground size-4 shrink-0" />
          <input
            type="text"
            placeholder="Search events"
            className="text-muted-foreground placeholder:text-muted-foreground h-9 w-full bg-transparent text-xs outline-none"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleSidebar}
                className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
              >
                <PanelRightIcon className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Close context panel <Kbd className="ml-1">/</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </SidebarHeader>
      <SidebarContent>
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
