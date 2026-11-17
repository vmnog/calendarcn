"use client";

import * as React from "react";
import { Link2, PanelLeftIcon, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCalendar } from "@/components/calendar-provider";
import { CalendarList } from "@/components/calendar-list";
import { CalendarSidebarPeople } from "@/components/calendar-sidebar-people";
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

/** "Soon" badge of a sidebar control that isn't built yet, as in the command menu */
const CALENDAR_SIDEBAR_SOON_CLASS =
  "bg-sidebar-foreground/10 text-sidebar-foreground/60 ml-auto shrink-0 rounded px-1 py-0.5 text-[10px] leading-none font-medium";

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
  /** Adds "Add calendar account" below the calendars, which calls it */
  onAddCalendarAccount?: () => void;
  /** Classes for the inline sidebar's fixed column */
  className?: string;
}

/**
 * Notion Calendar's left sidebar: the mini calendar, scheduling, the
 * "Meet with..." field with the people you meet with and the teammates
 * shown, the calendar list and a theme toggle. Inline it's a fixed column that pushes
 * the page over; with `overlay` it's a sheet from the left. Reads the
 * calendar's date and view from the nearest `CalendarProvider`, and needs
 * shadcn/ui's `SidebarProvider` around it. "Add calendar account" shows
 * when you pass `onAddCalendarAccount`. The scheduling row isn't built: it
 * is disabled and marked "Soon".
 */
export function CalendarSidebar({
  open = true,
  onOpenChange,
  overlay = false,
  footerActions,
  hiddenCalendarIds,
  defaultHiddenCalendarIds,
  onHiddenCalendarIdsChange,
  onAddCalendarAccount,
  className,
}: CalendarSidebarProps) {
  const {
    view,
    currentDate,
    displayMonth,
    visibleDays,
    weekStartsOn,
    numberOfDays,
    viewSettings,
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
              showWeekNumber={viewSettings.showWeekNumbers}
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
        {/* "Meet with...", meeting participants and team calendars */}
        <CalendarSidebarPeople />
        <CalendarList
          hiddenCalendarIds={hiddenCalendarIds}
          defaultHiddenCalendarIds={defaultHiddenCalendarIds}
          onHiddenCalendarIdsChange={onHiddenCalendarIdsChange}
        />
        {onAddCalendarAccount && (
          <>
            <SidebarSeparator className="mx-0" />
            <SidebarGroup className="py-0">
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="text-calendar-sidebar-muted-foreground hover:text-sidebar-foreground gap-1.5 text-sm rounded-sm"
                      onClick={onAddCalendarAccount}
                    >
                      <Plus className="size-4" />
                      <span className="min-w-0 flex-1 truncate">
                        Add calendar account
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
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
