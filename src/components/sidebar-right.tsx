"use client";

import * as React from "react";
import {
  Eye,
  Github,
  Link2,
  PanelLeftIcon,
  Plus,
  UserRound,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Calendars } from "@/components/calendars";
import { DatePicker } from "@/components/date-picker";
import { SidebarOverlay } from "@/components/sidebar-overlay";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Width of the calendar sidebar, inline and as an overlay */
const SIDEBAR_WIDTH = "15rem";

export type CalendarColor =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "gray";

export interface CalendarItem {
  name: string;
  color: CalendarColor;
  visible: boolean;
  isSubscribed?: boolean;
}

export interface CalendarAccount {
  email: string;
  calendars: CalendarItem[];
}

// Sample data grouped by email accounts
const data: { accounts: CalendarAccount[] } = {
  accounts: [
    {
      email: "me@vmnog.com",
      calendars: [
        { name: "me@vmnog.com", color: "red", visible: true },
        { name: "Personal", color: "purple", visible: true },
        { name: "Work", color: "blue", visible: true },
        { name: "Family", color: "orange", visible: true },
        { name: "Side Projects", color: "yellow", visible: true },
        { name: "Fitness", color: "green", visible: true },
        {
          name: "Holidays in Brazil",
          color: "green",
          visible: true,
          isSubscribed: true,
        },
      ],
    },
  ],
};

interface SidebarRightProps {
  open?: boolean;
  /** Called when the overlay asks to close (outside tap, Escape, toggle) */
  onOpenChange?: (open: boolean) => void;
  /** Render as a modal sheet instead of an inline column (phones) */
  overlay?: boolean;
  onDateSelect?: (date: Date) => void;
  currentDate?: Date;
  visibleDays?: Date[];
}

export function SidebarRight({
  open = true,
  onOpenChange,
  overlay = false,
  onDateSelect,
  currentDate,
  visibleDays,
}: SidebarRightProps) {
  const sidebarStyle = {
    "--sidebar-width": SIDEBAR_WIDTH,
  } as React.CSSProperties;

  const content = (
    <>
      <SidebarContent>
        <DatePicker
          onDateSelect={onDateSelect}
          currentDate={currentDate}
          visibleDays={visibleDays}
        />
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
          <div className="flex items-center gap-2 rounded-sm bg-[#EFEFEE] dark:bg-sidebar px-2 py-1.5">
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
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-sidebar-foreground"
                asChild
              >
                <a
                  href="https://github.com/vmnog/calendarcn"
                  target="_blank"
                  rel="noopener noreferrer"
                >
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
            <TooltipContent side="top">
              Toggle theme <Kbd className="ml-1">shift</Kbd> <Kbd>M</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </SidebarFooter>
    </>
  );

  if (overlay) {
    return (
      <SidebarOverlay
        open={open}
        onOpenChange={(next) => onOpenChange?.(next)}
        side="left"
        title="Calendar sidebar"
        description="Mini calendar, scheduling and calendar list."
        style={sidebarStyle}
      >
        {/* Same height and position as the header toggle, so tapping the same spot closes it */}
        <div className="flex h-14 shrink-0 items-center pl-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            onClick={() => onOpenChange?.(false)}
          >
            <PanelLeftIcon />
            <span className="sr-only">Close calendar sidebar</span>
          </Button>
        </div>
        {content}
      </SidebarOverlay>
    );
  }

  return (
    <div
      data-state={open ? "expanded" : "collapsed"}
      className="text-sidebar-foreground group peer hidden md:block"
      style={sidebarStyle}
    >
      {/* Gap element that handles the space transition */}
      <div
        className={cn(
          "relative bg-transparent",
          open ? "w-(--sidebar-width)" : "w-0",
        )}
      />
      {/* Sidebar container */}
      <div
        className={cn(
          "bg-sidebar fixed inset-y-0 left-0 z-10 hidden h-svh w-(--sidebar-width) flex-col border-r md:flex",
          open ? "left-0" : "left-[calc(var(--sidebar-width)*-1)]",
        )}
      >
        {content}
      </div>
    </div>
  );
}
