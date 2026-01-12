"use client"

import * as React from "react"
import { Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Calendars } from "@/components/calendars"
import { DatePicker } from "@/components/date-picker"
import {
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"

const SIDEBAR_WIDTH = "18rem"

// This is sample data.
const data = {
  calendars: [
    {
      name: "My Calendars",
      items: ["Personal", "Work", "Family"],
    },
    {
      name: "Favorites",
      items: ["Holidays", "Birthdays"],
    },
    {
      name: "Other",
      items: ["Travel", "Reminders", "Deadlines"],
    },
  ],
}

interface SidebarRightProps {
  open?: boolean
}

export function SidebarRight({ open = true }: SidebarRightProps) {
  return (
    <div
      data-state={open ? "expanded" : "collapsed"}
      className="text-sidebar-foreground group peer hidden md:block"
      style={{ "--sidebar-width": SIDEBAR_WIDTH } as React.CSSProperties}
    >
      {/* Gap element that handles the space transition */}
      <div
        className={cn(
          "relative bg-transparent transition-[width] duration-200 ease-linear",
          open ? "w-(--sidebar-width)" : "w-0"
        )}
      />
      {/* Sidebar container */}
      <div
        className={cn(
          "bg-sidebar fixed inset-y-0 left-0 z-10 hidden h-svh w-(--sidebar-width) flex-col border-r transition-[left] duration-200 ease-linear md:flex",
          open ? "left-0" : "left-[calc(var(--sidebar-width)*-1)]"
        )}
      >
        <SidebarContent>
          <DatePicker />
          <SidebarSeparator className="mx-0" />
          <Calendars calendars={data.calendars} />
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <Plus />
                <span>New Calendar</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </div>
    </div>
  )
}
