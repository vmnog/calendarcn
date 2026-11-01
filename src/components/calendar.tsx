"use client";

import { format } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCalendarShortcuts } from "@/hooks/use-calendar-shortcuts";
import { Button } from "@/components/ui/button";
import { ViewDropdown } from "@/components/view-dropdown";

import {
  CalendarProvider,
  useCalendar,
  useCalendarConfig,
} from "./calendar-provider";
import { MonthView } from "./month-view";
import { TimeGrid } from "./time-grid";
import type {
  CalendarEvent,
  CalendarProviderProps,
  ViewType,
} from "./calendar-types";
import type { CalendarProps } from "./week-view-types";

/** Hour the time grid opens on unless `scrollToHour` says otherwise */
const DEFAULT_SCROLL_HOUR = 8;

/** The period previous and next move by in each view, for their labels */
const PERIOD_LABELS: Record<ViewType, string> = {
  day: "day",
  week: "week",
  month: "month",
};

/**
 * The full calendar: a toolbar with the title, view switcher, today and
 * previous/next, over a day, week or month view. Takes every
 * `CalendarProvider` prop, so events, view and date can be controlled or
 * left to the calendar.
 */
export function Calendar<TEvent extends CalendarEvent = CalendarEvent>(
  props: CalendarProps<TEvent>,
) {
  const {
    scrollToHour = DEFAULT_SCROLL_HOUR,
    shortcuts = true,
    className,
    children,
  } = props;

  // The provider reads only its own props, so the calendar's extra ones pass
  // through harmlessly. Callers are type-checked against `CalendarProps<TEvent>`
  // (which keeps `createEvent` required for custom event types); inside, the
  // event type is erased, as CalendarProvider does itself, because TypeScript
  // can't check JSX props against the generic conditional type.
  const providerProps: CalendarProviderProps = {
    ...(props as CalendarProviderProps),
    children: (
      <>
        <CalendarShortcuts enabled={shortcuts} />
        <div className={cn("flex h-full min-h-0 flex-col", className)}>
          <CalendarToolbar />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <CalendarBody scrollToHour={scrollToHour} />
          </div>
        </div>
        {children}
      </>
    ),
  };

  return <CalendarProvider {...providerProps} />;
}

interface CalendarShortcutsProps {
  enabled: boolean;
}

/** Turns on the single-key shortcuts. A component so the hook runs inside the provider */
function CalendarShortcuts({ enabled }: CalendarShortcutsProps) {
  useCalendarShortcuts({ enabled });
  return null;
}

/** Title, view switcher, today, and previous and next */
function CalendarToolbar() {
  const {
    view,
    currentDate,
    monthName,
    year,
    weekNumber,
    numberOfDays,
    viewSettings,
    goToToday,
    goToPrev,
    goToNext,
    switchView,
    setNumberOfDays,
    toggleWeekends,
    toggleDeclinedEvents,
    toggleWeekNumbers,
  } = useCalendar();
  const { locale } = useCalendarConfig();
  const periodLabel = PERIOD_LABELS[view];

  return (
    <header className="@container/header flex h-12 shrink-0 items-center gap-1 border-b px-2 @md/header:gap-2 @md/header:px-3">
      <h2 className="min-w-0 flex-1 truncate text-sm @xs/header:text-base">
        <span className="font-semibold">
          {monthName} {year}
        </span>
        <span className="ml-2 hidden text-xs text-muted-foreground @lg/header:inline">
          {view === "day" && format(currentDate, "EEEE, MMM d", { locale })}
          {view === "week" && `Week ${weekNumber}`}
        </span>
      </h2>
      <div className="hidden @xs/header:block">
        <ViewDropdown
          view={view}
          numberOfDays={numberOfDays}
          viewSettings={viewSettings}
          onSwitchView={switchView}
          onSetNumberOfDays={setNumberOfDays}
          onToggleWeekends={toggleWeekends}
          onToggleDeclinedEvents={toggleDeclinedEvents}
          onToggleWeekNumbers={toggleWeekNumbers}
        />
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="px-2 @md/header:px-3"
        onClick={goToToday}
      >
        Today
      </Button>
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground"
          onClick={goToPrev}
        >
          <ChevronLeftIcon className="size-4" />
          <span className="sr-only">Previous {periodLabel}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground"
          onClick={goToNext}
        >
          <ChevronRightIcon className="size-4" />
          <span className="sr-only">Next {periodLabel}</span>
        </Button>
      </div>
    </header>
  );
}

interface CalendarBodyProps {
  scrollToHour: number;
}

/** The view the provider is on */
function CalendarBody({ scrollToHour }: CalendarBodyProps) {
  const { view } = useCalendar();

  if (view === "month") {
    return <MonthView />;
  }

  // One grid for day and week: switching re-lays it out instead of
  // remounting, so the vertical scroll position is kept
  return <TimeGrid view={view} scrollToHour={scrollToHour} />;
}
