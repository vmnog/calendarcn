"use client";

import * as React from "react";
import { isSameDay, isSameMonth } from "date-fns";

import { useToday } from "@/hooks/use-now";
import { Calendar } from "@/components/ui/calendar";
import { SidebarGroup, SidebarGroupContent } from "@/components/ui/sidebar";

/**
 * Stand-in for "today" on the server and during hydration, where the viewer's
 * date is unknown. It lies outside any month the calendar shows, so no day is
 * marked as today and server and client markup match (React error #418).
 */
const UNKNOWN_TODAY = new Date(0);

interface DatePickerProps {
  onDateSelect?: (date: Date) => void;
  currentDate?: Date;
  visibleDays?: Date[];
}

/**
 * Month the mini calendar should display for the current navigation state.
 * Week and day views anchor to the LAST visible day, matching the header
 * (a week crossing into a new month shows the new month, like Notion
 * Calendar). Month view passes no visible days and anchors to `currentDate`.
 */
function getAnchorMonth(
  currentDate: Date | undefined,
  visibleDays: Date[] | undefined,
): Date | undefined {
  if (visibleDays && visibleDays.length > 0) {
    return visibleDays[visibleDays.length - 1];
  }
  return currentDate;
}

export function DatePicker({
  onDateSelect,
  currentDate,
  visibleDays,
}: DatePickerProps) {
  // `null` on the server and during hydration
  const today = useToday();
  const [displayedMonth, setDisplayedMonth] = React.useState<Date>(
    () => getAnchorMonth(currentDate, visibleDays) ?? today ?? new Date(),
  );

  // Re-sync the displayed month whenever the calendar navigates. The user can
  // browse months freely with the chevrons; the next navigation (keyboard,
  // header buttons, horizontal scroll, day click, view switch) snaps it back.
  React.useEffect(() => {
    const anchor = getAnchorMonth(currentDate, visibleDays);
    if (!anchor) return;
    setDisplayedMonth((prev) => (isSameMonth(prev, anchor) ? prev : anchor));
  }, [currentDate, visibleDays]);

  // Treat an unknown today as this month, so no "back to today" control renders
  const isTodayMonth = today === null || isSameMonth(displayedMonth, today);

  const monthYearLabel = displayedMonth.toLocaleDateString("default", {
    month: "long",
    year: "numeric",
  });

  const goBackToToday = () => {
    if (!today) return;
    setDisplayedMonth(today);
    onDateSelect?.(today);
  };

  // Build modifiers for visible days highlighting
  const modifiers = React.useMemo(() => {
    if (!visibleDays || visibleDays.length === 0) return undefined;

    return {
      inView: (date: Date) => visibleDays.some((d) => isSameDay(d, date)),
    };
  }, [visibleDays]);

  const modifiersClassNames = React.useMemo(() => {
    if (!modifiers) return undefined;
    return {
      inView: "in-view-day",
    };
  }, [modifiers]);

  return (
    <SidebarGroup className="px-0">
      <SidebarGroupContent>
        <Calendar
          mode="single"
          month={displayedMonth}
          onMonthChange={setDisplayedMonth}
          selected={today ?? undefined}
          today={today ?? UNKNOWN_TODAY}
          onSelect={(date) => {
            if (date) {
              onDateSelect?.(date);
            }
          }}
          showWeekNumber
          fixedWeeks
          showBackToToday={!isTodayMonth}
          onBackToToday={goBackToToday}
          monthLabel={!isTodayMonth ? monthYearLabel : undefined}
          modifiers={modifiers}
          modifiersClassNames={modifiersClassNames}
          className="bg-transparent [&_[role=gridcell].bg-accent]:bg-sidebar-primary [&_[role=gridcell].bg-accent]:text-sidebar-primary-foreground"
        />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
