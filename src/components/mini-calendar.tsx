"use client";

import * as React from "react";
import { isSameDay, isSameMonth } from "date-fns";
import { ChevronDownIcon, ChevronUpIcon, Undo2Icon } from "lucide-react";
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
} from "react-day-picker";

import { cn } from "@/lib/utils";
import { useToday } from "@/hooks/use-now";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { WeekStartsOn } from "@/components/calendar-types";

/**
 * Stand-in for "today" on the server and during hydration, where the viewer's
 * date is unknown. It lies outside any month the calendar shows, so no day is
 * marked as today and server and client markup match (React error #418).
 */
const UNKNOWN_TODAY = new Date(0);

/** Class the cells of the days the calendar view shows get */
const IN_VIEW_DAY_CLASS = "in-view-day";

/**
 * The month navigation buttons (back to today, previous, next): a 24px
 * ghost button whose hover matches the days'
 */
const NAV_BUTTON_CLASS =
  "inline-flex size-6 shrink-0 items-center justify-center rounded-sm p-0 whitespace-nowrap outline-none select-none transition-none hover:bg-calendar-day-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:pointer-events-none [&_svg]:shrink-0";

interface MiniCalendarProps {
  /**
   * Day the calendar is on. Picks the month shown when there are no
   * `visibleDays` (month view, agenda).
   */
  currentDate?: Date;
  /**
   * Days the calendar view shows. They're highlighted, and the month of the
   * last one is shown.
   */
  visibleDays?: Date[];
  /** Called with the day picked, or with today from "Go back to today" */
  onDateSelect?: (date: Date) => void;
  /** First day of the week, 0 (Sunday) to 6. Defaults to Sunday */
  weekStartsOn?: WeekStartsOn;
  className?: string;
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

/**
 * Notion Calendar's mini calendar: week numbers, today in red, the visible
 * days highlighted, up/down chevrons to browse months, and a button back to
 * today once you browse away.
 */
export function MiniCalendar({
  currentDate,
  visibleDays,
  onDateSelect,
  weekStartsOn = 0,
  className,
}: MiniCalendarProps) {
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

  const monthLabel = isTodayMonth
    ? undefined
    : displayedMonth.toLocaleDateString("default", {
        month: "long",
        year: "numeric",
      });

  const goBackToToday = () => {
    if (!today) return;
    setDisplayedMonth(today);
    onDateSelect?.(today);
  };

  // Highlight the days the calendar view shows
  const modifiers = React.useMemo(() => {
    if (!visibleDays || visibleDays.length === 0) return undefined;

    return {
      inView: (date: Date) => visibleDays.some((d) => isSameDay(d, date)),
    };
  }, [visibleDays]);

  const modifiersClassNames = React.useMemo(() => {
    if (!modifiers) return undefined;
    return { inView: IN_VIEW_DAY_CLASS };
  }, [modifiers]);

  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
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
      weekStartsOn={weekStartsOn}
      showOutsideDays
      showWeekNumber
      fixedWeeks
      captionLayout="label"
      modifiers={modifiers}
      modifiersClassNames={modifiersClassNames}
      className={cn(
        "group/calendar bg-transparent px-2 py-1 [--cell-size:--spacing(6)]",
        className,
      )}
      formatters={{
        formatWeekNumber: (weekNumber) => String(weekNumber),
      }}
      classNames={{
        root: cn("w-full relative", defaultClassNames.root),
        months: cn("flex gap-2 flex-col", defaultClassNames.months),
        month: cn("flex flex-col w-full gap-0", defaultClassNames.month),
        nav: cn(
          "flex w-full items-center justify-end gap-0",
          defaultClassNames.nav,
        ),
        month_caption: cn("hidden", defaultClassNames.month_caption),
        table: "w-full border-collapse",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground rounded-sm flex-1 font-normal text-xxs select-none",
          defaultClassNames.weekday,
        ),
        week: cn(
          "flex w-full items-center relative group/week mb-0.5",
          defaultClassNames.week,
        ),
        week_number_header: cn(
          "select-none w-5",
          defaultClassNames.week_number_header,
        ),
        week_number: cn(
          "text-xxs select-none text-muted-foreground w-5",
          defaultClassNames.week_number,
        ),
        day: cn(
          "relative flex items-center justify-center w-full h-7 p-0 text-center [&:last-child[data-selected=true]_button]:before:rounded-r-md group/day select-none",
          // The visible days share one band, rounded at its ends
          "[&.in-view-day]:bg-calendar-current-week",
          "[&.in-view-day:not(.in-view-day+.in-view-day)]:rounded-l-md",
          "[&.in-view-day:not(:has(+.in-view-day))]:rounded-r-md",
          // The first day column comes after the week number
          "[&:nth-child(2)[data-selected=true]_button]:before:rounded-l-md",
          defaultClassNames.day,
        ),
        today: cn("rounded-sm", defaultClassNames.today),
        outside: cn(
          "text-muted-foreground/40 aria-selected:text-muted-foreground",
          defaultClassNames.outside,
        ),
        disabled: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames.disabled,
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (
            <div
              data-slot="mini-calendar"
              ref={rootRef}
              className={cn(className)}
              {...props}
            />
          );
        },
        Nav: ({
          className,
          onPreviousClick,
          onNextClick,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          previousMonth,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          nextMonth,
          ...navProps
        }) => {
          return (
            <nav
              className={cn("flex w-full items-center", className)}
              {...navProps}
            >
              {/* Week number space - same as week_number_header */}
              <div className="w-5" />

              {/* Month label - spans 4 columns worth (Su-We) */}
              {monthLabel && (
                <span className="text-foreground flex-[4] text-sm font-medium">
                  {monthLabel}
                </span>
              )}
              {!monthLabel && <span className="flex-[4]" />}

              {/* Th column - Undo button or empty space */}
              {monthLabel ? (
                <div className="flex-1 flex justify-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={goBackToToday}
                        className={NAV_BUTTON_CLASS}
                      >
                        <Undo2Icon className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Go back to today
                    </TooltipContent>
                  </Tooltip>
                </div>
              ) : (
                <span className="flex-1" />
              )}

              {/* Fr column - Up chevron */}
              <div className="flex-1 flex justify-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={NAV_BUTTON_CLASS}
                      aria-label="Go to previous month"
                      onClick={onPreviousClick}
                    >
                      <ChevronUpIcon className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Go to previous month
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Sa column - Down chevron */}
              <div className="flex-1 flex justify-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={NAV_BUTTON_CLASS}
                      aria-label="Go to next month"
                      onClick={onNextClick}
                    >
                      <ChevronDownIcon className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Go to next month
                  </TooltipContent>
                </Tooltip>
              </div>
            </nav>
          );
        },
        DayButton: MiniCalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex h-(--cell-size) w-5 items-center justify-center text-center text-xxs">
                {children}
              </div>
            </td>
          );
        },
      }}
    />
  );
}

/**
 * A day of the mini calendar. The button fills its cell, so the pointer never
 * crosses a dead zone between days; the visible 28px box is its `::before`.
 */
function MiniCalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames();

  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  const isInView = "inView" in modifiers && modifiers.inView === true;

  return (
    <button
      ref={ref}
      type="button"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={modifiers.selected}
      data-outside={modifiers.outside}
      data-today={modifiers.today}
      data-in-view={isInView}
      className={cn(
        // Hit area: the whole cell plus half of the week row's mb-0.5 gap above
        // and below, so the pointer never crosses a dead zone between days
        "absolute inset-x-0 -inset-y-px isolate flex size-auto shrink-0 items-center justify-center gap-2 rounded-none text-sm leading-none font-normal whitespace-nowrap transition-none outline-none",
        "text-foreground hover:text-accent-foreground data-[outside=true]:text-muted-foreground/40 data-[selected-single=true]:text-primary-foreground data-[today=true]:hover:!text-primary-foreground",
        // Visible box: a size-7 ::before centered in the hit area, behind the label
        "before:absolute before:inset-0 before:-z-10 before:m-auto before:size-7 before:rounded-sm hover:before:bg-calendar-day-hover data-[in-view=true]:hover:before:bg-calendar-day-hover-current-week data-[selected-single=true]:before:bg-primary data-[today=true]:hover:before:!bg-primary",
        // Keyboard focus ring on the visible box, not the hit area: a 2px
        // inset border-ring, like EVENT_FOCUS_RING_CLASS
        "focus-visible:before:border-2 focus-visible:before:border-ring",
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  );
}
