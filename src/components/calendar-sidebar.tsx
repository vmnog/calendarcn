"use client";

import * as React from "react";
import { Link2, PanelLeftIcon, Plus, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCalendar } from "@/components/calendar-provider";
import {
  CALENDAR_SIDEBAR_SOON_CLASS,
  CalendarList,
} from "@/components/calendar-list";
import { MiniCalendar } from "@/components/mini-calendar";
import {
  CALENDAR_SIDEBAR_COLORS_CLASS,
  SidebarOverlay,
} from "@/components/sidebar-overlay";
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
import { getPeriodStart } from "@/lib/event-utils";

/** Width of the calendar sidebar, inline and as an overlay */
export const CALENDAR_SIDEBAR_WIDTH = "15rem";

/** No days to highlight: month view and the agenda */
const NO_VISIBLE_DAYS: Date[] = [];

interface CalendarSidebarProps {
  /** Whether the sidebar shows. Defaults to true */
  open?: boolean;
  /** Called when the overlay asks to close (outside tap, Escape, close button, a day picked) */
  onOpenChange?: (open: boolean) => void;
  /** Render as a modal sheet instead of an inline column (phones) */
  overlay?: boolean;
  /** Buttons shown in the footer before the theme toggle, e.g. links */
  footerActions?: React.ReactNode;
  /** Ids of the hidden calendars (controlled), see `CalendarList` */
  hiddenCalendarIds?: string[];
  /** Ids of the calendars hidden at first (uncontrolled) */
  defaultHiddenCalendarIds?: string[];
  /** Called with the new hidden ids when a calendar is shown or hidden */
  onHiddenCalendarIdsChange?: (hiddenCalendarIds: string[]) => void;
  /**
   * Marks the calendar list's eye buttons "Soon", for an app that doesn't
   * take hidden calendars' events off its views yet. See `CalendarList`.
   * Defaults to false
   */
  calendarVisibilitySoon?: boolean;
  /** Classes for the inline sidebar's fixed column */
  className?: string;
}

/**
 * Notion Calendar's left sidebar: the mini calendar, scheduling, the
 * calendar list and a theme toggle. Inline it's a fixed column that pushes
 * the page over; with `overlay` it's a sheet from the left. Reads the
 * calendar's date and view from the nearest `CalendarProvider`, and needs
 * shadcn/ui's `SidebarProvider` around it. The scheduling row, the "Meet
 * with..." field and "Add calendar account" aren't built: they are disabled
 * and marked "Soon".
 */
export function CalendarSidebar({
  open = true,
  onOpenChange,
  overlay = false,
  footerActions,
  hiddenCalendarIds,
  defaultHiddenCalendarIds,
  onHiddenCalendarIdsChange,
  calendarVisibilitySoon = false,
  className,
}: CalendarSidebarProps) {
  const {
    view,
    currentDate,
    displayMonth,
    visibleDays,
    weekStartsOn,
    numberOfDays,
    goToDate,
  } = useCalendar();

  const sidebarStyle = {
    "--sidebar-width": CALENDAR_SIDEBAR_WIDTH,
  } as React.CSSProperties;

  /** Mini calendar day pick: go to its period, and get the overlay out of the way */
  const handleDateSelect = (date: Date) => {
    goToDate(getPeriodStart(date, view, weekStartsOn, numberOfDays));
    if (overlay) onOpenChange?.(false);
  };

  const content = (
    <>
      {/* Spacing set here, not left to the shadcn/ui style (nova has none) */}
      <SidebarContent className="gap-2">
        <SidebarGroup className="px-0">
          <SidebarGroupContent>
            <MiniCalendar
              onDateSelect={handleDateSelect}
              currentDate={
                view === "month" && displayMonth ? displayMonth : currentDate
              }
              visibleDays={
                view === "month" || view === "agenda"
                  ? NO_VISIBLE_DAYS
                  : visibleDays
              }
              weekStartsOn={weekStartsOn}
            />
          </SidebarGroupContent>
        </SidebarGroup>
        {/* Scheduling Section */}
        <SidebarGroup className="py-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                {/* Not built yet */}
                <SidebarMenuButton
                  disabled
                  className="text-sidebar-foreground rounded-sm disabled:opacity-100"
                >
                  <Link2 className="size-4 text-calendar-sidebar-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm opacity-50">
                    Scheduling
                  </span>
                  <span className={CALENDAR_SIDEBAR_SOON_CLASS}>Soon</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {/* Meet with input: not built yet */}
        <SidebarGroup className="py-2 px-2">
          <div className="flex items-center gap-2 rounded-sm bg-[#EFEFEE] dark:bg-sidebar px-2 py-1.5">
            <UserRound className="size-4 shrink-0 text-calendar-sidebar-muted-foreground" />
            <input
              type="text"
              disabled
              placeholder="Meet with..."
              className="min-w-0 flex-1 bg-transparent text-sm text-sidebar-foreground placeholder:text-calendar-sidebar-muted-foreground outline-none"
            />
            <span className={CALENDAR_SIDEBAR_SOON_CLASS}>Soon</span>
          </div>
        </SidebarGroup>
        <CalendarList
          hiddenCalendarIds={hiddenCalendarIds}
          defaultHiddenCalendarIds={defaultHiddenCalendarIds}
          onHiddenCalendarIdsChange={onHiddenCalendarIdsChange}
          visibilitySoon={calendarVisibilitySoon}
        />
        <SidebarSeparator className="mx-0" />
        <SidebarGroup className="py-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                {/* Not built yet */}
                <SidebarMenuButton
                  disabled
                  className="text-sidebar-foreground gap-1.5 text-sm rounded-sm disabled:opacity-100"
                >
                  <Plus className="size-4 opacity-50" />
                  <span className="min-w-0 flex-1 truncate opacity-50">
                    Add calendar account
                  </span>
                  <span className={CALENDAR_SIDEBAR_SOON_CLASS}>Soon</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center justify-start gap-1 px-2 py-2">
          {footerActions}
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
      className={cn(
        CALENDAR_SIDEBAR_COLORS_CLASS,
        "text-sidebar-foreground group peer hidden md:block",
      )}
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
          className,
        )}
      >
        {content}
      </div>
    </div>
  );
}
