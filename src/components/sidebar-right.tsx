"use client"

import * as React from "react"
import { Eye, Github, Link2, Plus, UserRound } from "lucide-react"

import { cn } from "@/lib/utils"
import { Calendars } from "@/components/calendars"
import { DatePicker } from "@/components/date-picker"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const SIDEBAR_WIDTH = "15rem"

export type CalendarColor = "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "gray"

export interface CalendarItem {
  name: string
  color: CalendarColor
  visible: boolean
  isSubscribed?: boolean
}

export interface CalendarAccount {
  email: string
  calendars: CalendarItem[]
}

// Sample data grouped by email accounts
const data: { accounts: CalendarAccount[] } = {
  accounts: [
    {
      email: "me@vmnog.com",
      calendars: [
        { name: "me@vmnog.com", color: "red", visible: true },
        { name: "Personal", color: "purple", visible: true },
        { name: "Family", color: "yellow", visible: false },
        { name: "Holidays in Brazil", color: "green", visible: true, isSubscribed: true },
      ],
    },
  ],
}

interface SidebarRightProps {
  open?: boolean
  onDateSelect?: (date: Date) => void
  currentDate?: Date
  visibleDays?: Date[]
}

export function SidebarRight({ open = true, onDateSelect, currentDate, visibleDays }: SidebarRightProps) {
  return (
    <div
      data-state={open ? "expanded" : "collapsed"}
      className="text-sidebar-foreground group peer hidden md:block"
      style={{ "--sidebar-width": SIDEBAR_WIDTH } as React.CSSProperties}
    >
      {/* Gap element that handles the space transition */}
      <div
        className={cn(
          "relative bg-transparent",
          open ? "w-(--sidebar-width)" : "w-0"
        )}
      />
      {/* Sidebar container */}
      <div
        className={cn(
          "bg-sidebar fixed inset-y-0 left-0 z-10 hidden h-svh w-(--sidebar-width) flex-col border-r md:flex",
          open ? "left-0" : "left-[calc(var(--sidebar-width)*-1)]"
        )}
      >
        <SidebarContent>
          <DatePicker onDateSelect={onDateSelect} currentDate={currentDate} visibleDays={visibleDays} />
          {/* Scheduling Section */}
          <SidebarGroup className="py-0">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton className="text-sidebar-foreground">
                    <Link2 className="size-4 text-sidebar-muted-foreground" />
                    <span className="flex-1 text-sm">Scheduling</span>
                    <Eye className="size-4 text-sidebar-muted-foreground" />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {/* Meet with input */}
          <SidebarGroup className="py-2 px-2">
            <div className="flex items-center gap-2 rounded-md bg-[#EFEFEE] dark:bg-sidebar px-2 py-1.5">
              <UserRound className="size-4 shrink-0 text-sidebar-muted-foreground" />
              <input
                type="text"
                placeholder="Meet with..."
                className="flex-1 bg-transparent text-sm text-sidebar-foreground placeholder:text-sidebar-muted-foreground outline-none"
              />
            </div>
          </SidebarGroup>
          <Calendars accounts={data.accounts} />
          <SidebarSeparator className="mx-0" />
          <SidebarGroup className="py-0">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton className="text-sidebar-foreground text-sm">
                    <Plus className="size-4" />
                    <span>Add calendar account</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border">
          <div className="flex items-center justify-start gap-1 px-2 py-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7 text-sidebar-foreground" asChild>
                  <a href="https://github.com/vmnog/calendarcn" target="_blank" rel="noopener noreferrer">
                    <Github className="size-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Go to repo</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <ThemeToggle className="text-sidebar-foreground" />
              </TooltipTrigger>
              <TooltipContent side="top">Toggle theme</TooltipContent>
            </Tooltip>
          </div>
        </SidebarFooter>
      </div>
    </div>
  )
}
