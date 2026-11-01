"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { AgendaView } from "@/components/agenda-view";
import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { MonthView } from "@/components/month-view";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import type { ViewType } from "@/components/calendar-types";
import { AGENDA_DAYS } from "@/lib/event-utils";
import { createSampleEvents } from "@/lib/sample-events";

/** Views offered by the header's switcher, in display order */
const VIEW_OPTIONS: { value: ViewType; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "agenda", label: "Agenda" },
];

/** What previous and next move by in each view, for their labels */
const PERIOD_LABELS: Record<ViewType, string> = {
  day: "day",
  week: "week",
  month: "month",
  agenda: `${AGENDA_DAYS} days`,
};

export function CalendarDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultEvents={initialEvents}>
      <div className="flex h-full flex-col">
        <CalendarHeader />
        <div className="min-h-0 flex-1">
          <CalendarBody />
        </div>
      </div>
    </CalendarProvider>
  );
}

/** Title, today, previous and next, and the view switcher */
function CalendarHeader() {
  const {
    view,
    monthName,
    year,
    weekNumber,
    goToToday,
    goToPrev,
    goToNext,
    switchView,
  } = useCalendar();
  const periodLabel = PERIOD_LABELS[view];

  return (
    <header className="flex items-center gap-2 border-b px-3 py-2">
      <h2 className="min-w-0 flex-1 truncate text-base font-semibold">
        {monthName} {year}
        {view === "week" && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            Week {weekNumber}
          </span>
        )}
      </h2>
      <div
        role="group"
        aria-label="View"
        className="flex items-center rounded-md bg-muted p-0.5"
      >
        {VIEW_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={view === option.value}
            onClick={() => switchView(option.value)}
            className={cn(
              "h-7 rounded-sm px-2.5 text-xs font-medium text-muted-foreground transition-[color,background-color,box-shadow,scale] duration-150 ease-out outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.96] motion-reduce:active:scale-100",
              view === option.value &&
                "bg-background text-foreground shadow-xs dark:bg-input",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <Button variant="secondary" size="sm" onClick={goToToday}>
        Today
      </Button>
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Previous ${periodLabel}`}
          onClick={goToPrev}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Next ${periodLabel}`}
          onClick={goToNext}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </header>
  );
}

/** The view the provider is on */
function CalendarBody() {
  const { view } = useCalendar();

  if (view === "month") {
    return <MonthView />;
  }

  if (view === "agenda") {
    return <AgendaView />;
  }

  return <WeekView scrollToHour={8} />;
}
