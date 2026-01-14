"use client"

import * as React from "react"
import { Search, Square } from "lucide-react"

import { Kbd } from "@/components/ui/kbd"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

export function SidebarLeft({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar side="right" className="border-l" {...props}>
      <SidebarHeader className="p-3">
        <div className="flex items-center gap-2">
          <Search className="text-muted-foreground size-4 shrink-0" />
          <input
            type="text"
            placeholder="Search events"
            className="text-muted-foreground placeholder:text-muted-foreground h-9 w-full bg-transparent text-sm outline-none"
          />
          <Square className="text-muted-foreground size-4 shrink-0" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-3">
          <SidebarGroupLabel className="text-foreground text-sm font-semibold">
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
    <div className="text-muted-foreground flex items-center justify-between py-1.5 text-sm">
      <span>{label}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  )
}
