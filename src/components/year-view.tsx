"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import type { ComponentProps } from "react";
import { addDays, addYears, format, startOfYear } from "date-fns";
import { DayPicker, type DayButton, type Modifiers } from "react-day-picker";

import { cn } from "@/lib/utils";
import { useToday } from "@/hooks/use-now";
import { CalendarLoadingBar } from "./calendar-loading-bar";
import {
  useCalendar,
  useCalendarConfig,
  useCalendarViewSync,
} from "./calendar-provider";
import {
  countEventsByDay,
  formatCellDate,
  formatFullDate,
} from "@/lib/event-utils";
import { expandRecurringEvents } from "@/lib/recurrence";
import type { YearViewProps } from "./week-view-types";

/**
 * Stand-in for "today" on the server and during hydration, where the
 * viewer's date is unknown. No year the view shows contains it, so no day
 * is marked as today and server and client markup match.
 */
const UNKNOWN_TODAY = new Date(0);

/** Month grids the view draws: the whole year, from January */
const MONTHS_PER_YEAR = 12;

/** DayPicker modifier set on the days that have events */
const HAS_EVENTS_MODIFIER = "hasEvents";

/**
 * Classes for DayPicker's parts. Months flow two to a row, three from a
 * 42rem wide view and four from 64rem: container queries on the view, so an
 * open sidebar counts. A month shows only its own days.
 */
const YEAR_VIEW_CLASS_NAMES = {
  root: "w-full",
  months:
    "grid grid-cols-2 gap-x-4 gap-y-6 p-4 @2xl/year:grid-cols-3 @2xl/year:gap-x-8 @5xl/year:grid-cols-4 @5xl/year:p-6",
  month: "flex min-w-0 flex-col gap-1",
  month_caption: "px-1 pb-1",
  caption_label: "text-sm font-semibold text-foreground",
  month_grid: "w-full table-fixed border-collapse",
  weekday: "h-6 p-0 text-center text-xxs font-normal text-muted-foreground",
  week_number_header: "w-5 p-0",
  week_number: "w-5 p-0 text-center text-xxs text-muted-foreground",
  day: "h-7 p-0 text-center",
  hidden: "invisible",
};

/** A day: a 28px box, narrower when its month is, with room for a dot under the number */
const DAY_BUTTON_CLASS =
  "relative mx-auto flex h-7 w-full max-w-7 cursor-pointer items-center justify-center rounded-sm text-xs tabular-nums text-foreground outline-none select-none hover:bg-calendar-day-hover focus-visible:ring-2 focus-visible:ring-ring";

/** Today, in red like the mini calendar and month view */
const TODAY_BUTTON_CLASS =
  "bg-primary font-semibold text-primary-foreground hover:bg-primary/80";

/** The dot under the number of a day with events */
const EVENT_DOT_CLASS =
  "pointer-events-none absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-muted-foreground";

/** Props DayPicker gives a day's button */
type YearViewDayButtonProps = ComponentProps<typeof DayButton>;

/**
 * A day of the year grid: its number, a dot when it has events, today in
 * red. DayPicker moves focus between days by marking one `focused`, so the
 * button focuses itself then, as DayPicker's own day button does.
 */
function YearViewDayButton({
  day,
  modifiers,
  className,
  children,
  ...buttonProps
}: YearViewDayButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  const isToday = modifiers.today === true;

  return (
    <button
      {...buttonProps}
      ref={ref}
      type="button"
      aria-current={isToday ? "date" : undefined}
      data-date={formatCellDate(day.date)}
      className={cn(DAY_BUTTON_CLASS, isToday && TODAY_BUTTON_CLASS, className)}
    >
      {children}
      {modifiers[HAS_EVENTS_MODIFIER] && (
        <span
          aria-hidden
          className={cn(EVENT_DOT_CLASS, isToday && "bg-primary-foreground")}
        />
      )}
    </button>
  );
}

/**
 * The provider's year as twelve month grids, like Google Calendar's year
 * view (Notion Calendar has none): today in red, a dot under every day with
 * events, and a click, Enter or Space on a day opens it (`showDay()`, unless
 * `onDayClick` is set). Arrow keys move between days, Page Up and Page Down
 * by a month, Home and End to the week's ends, and none of them leave the
 * year. Date, events, week start, locale and week numbers come from the
 * surrounding CalendarProvider, which navigates by year while it is mounted.
 */
export function YearView({ onDayClick, className }: YearViewProps) {
  const { currentDate, events, viewSettings, weekStartsOn, showDay, loading } =
    useCalendar();
  const { locale } = useCalendarConfig();
  const { reportView } = useCalendarViewSync();
  // `null` on the server and during hydration, so no day is marked as today
  const today = useToday();
  /** The scrolling months, searched for a day's button by its date */
  const monthsRef = useRef<HTMLDivElement | null>(null);

  // Tell the provider which view is on screen. `reportView` changes with the
  // provider's state, so this also re-checks after every switch. A layout
  // effect: the provider adopts year view before the first paint.
  useLayoutEffect(() => {
    reportView({ view: "year" });
  }, [reportView]);

  const yearStartTime = startOfYear(currentDate).getTime();

  // Each day's event count, worked out once per change of the events or the
  // year rather than on every render: DayPicker asks about all 365 days
  const eventCounts = useMemo(() => {
    const start = new Date(yearStartTime);
    const range = { start, end: addYears(start, 1) };
    // Repeating events count on each of their dates (ADR-007), generated
    // for the year and never stored, as month view draws them
    return countEventsByDay(expandRecurringEvents(events, range), range);
  }, [events, yearStartTime]);

  const modifiers = useMemo(
    () => ({
      [HAS_EVENTS_MODIFIER]: (date: Date) =>
        eventCounts.has(formatCellDate(date)),
    }),
    [eventCounts],
  );

  // A day's name: its date, "today", then how many events it has
  // ("Thursday, June 4, today, 3 events")
  const labels = useMemo(
    () => ({
      labelDayButton: (date: Date, dayModifiers: Modifiers) => {
        const parts = [formatFullDate(date, locale)];
        if (dayModifiers.today) parts.push("today");
        const count = eventCounts.get(formatCellDate(date)) ?? 0;
        if (count === 1) parts.push("1 event");
        if (count > 1) parts.push(`${count} events`);
        return parts.join(", ");
      },
    }),
    [eventCounts, locale],
  );

  const formatters = useMemo(
    () => ({
      // The header names the year, so each month is named alone
      formatCaption: (month: Date) => format(month, "LLLL", { locale }),
      formatWeekNumber: (weekNumber: number) => String(weekNumber),
    }),
    [locale],
  );

  const handleDayClick = useCallback(
    (date: Date) => {
      if (onDayClick) {
        onDayClick(date);
        return;
      }
      showDay(date);
    },
    [onDayClick, showDay],
  );

  /**
   * After a key press on a day, puts focus back on the same day of the year
   * now on screen when the press changed the year (T, J or K): the focused
   * button went with the old year, and focus would fall to the page.
   * February 29 lands on the 28th.
   */
  const keepDayFocus = useCallback((date: Date) => {
    requestAnimationFrame(() => {
      const months = monthsRef.current;
      const active = document.activeElement;
      if (!months || (active && active !== document.body)) return;
      const sameDay = months.querySelector<HTMLElement>(
        `[data-date$="-${format(date, "MM-dd")}"]`,
      );
      const dayBefore = months.querySelector<HTMLElement>(
        `[data-date$="-${format(addDays(date, -1), "MM-dd")}"]`,
      );
      (sameDay ?? dayBefore)?.focus();
    });
  }, []);

  return (
    <div
      className={cn(
        "@container/year relative flex h-full flex-col overflow-hidden bg-background",
        className,
      )}
      aria-busy={loading || undefined}
    >
      <div
        ref={monthsRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <DayPicker
          month={new Date(yearStartTime)}
          numberOfMonths={MONTHS_PER_YEAR}
          disableNavigation
          hideNavigation
          today={today ?? UNKNOWN_TODAY}
          weekStartsOn={weekStartsOn}
          locale={locale}
          showWeekNumber={viewSettings.showWeekNumbers}
          modifiers={modifiers}
          labels={labels}
          formatters={formatters}
          classNames={YEAR_VIEW_CLASS_NAMES}
          components={{ DayButton: YearViewDayButton }}
          onDayClick={handleDayClick}
          onDayKeyDown={keepDayFocus}
        />
      </div>
      {/* No header to sit under, so the bar runs along the top, as in the agenda */}
      {loading && <CalendarLoadingBar className="top-0 bottom-auto z-20" />}
    </div>
  );
}
