"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { addDays, format, isSameDay, isSameMonth, isWeekend } from "date-fns";
import { CalendarCheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { useEventKeyboard } from "@/hooks/use-event-keyboard";
import { useIsPast, useNow, useToday } from "@/hooks/use-now";
import { EventContextMenu } from "./event-context-menu";
import { EventDetailPopover } from "./event-detail-popover";
import {
  CalendarPopoverBoundaryProvider,
  isInsideCalendarPopover,
} from "./calendar-popover-context";
import { CalendarLoadingBar } from "./calendar-loading-bar";
import {
  EventContentSlot,
  useCalendar,
  useCalendarConfig,
  useCalendarViewSync,
} from "./calendar-provider";
import {
  EVENT_FOCUS_RING_CLASS,
  eventColorStyles,
} from "./calendar-event-item";
import {
  AGENDA_DAYS,
  formatAgendaDayOfSpan,
  formatAgendaTime,
  formatFullDate,
  getAgendaDays,
  getEventLabel,
  getVisibleDays,
} from "@/lib/event-utils";
import type {
  AgendaDay,
  AgendaEntry,
  CalendarEvent,
  DetailedCalendarEvent,
} from "./calendar-types";
import type { AgendaViewProps } from "./week-view-types";

/**
 * Box for custom `renderEventContent` output: fills the row after the color
 * accent, inset like the default content
 */
const AGENDA_SLOT_CLASS =
  "flex min-w-0 flex-1 items-center overflow-hidden px-2.5 py-1.5";

interface ContextMenuState {
  x: number;
  y: number;
  event: CalendarEvent;
}

/** The agenda's days of one month, under that month's label */
interface AgendaMonth {
  /** Start of the first listed day of the month */
  date: Date;
  days: AgendaDay[];
}

interface AgendaEventRowProps {
  entry: AgendaEntry;
  isSelected: boolean;
  /** Whether this row opens the details popover of the selected event */
  showPopover: boolean;
  onSelect: (event: CalendarEvent) => void;
  onContextMenu: (e: React.MouseEvent, event: CalendarEvent) => void;
  onEventChange: (event: CalendarEvent) => void;
  /** Closes the given event's popover (clears it only while it is still selected) */
  onPopoverClose: (eventId: string) => void;
  /** Callback for the popover's expand button (hidden when absent) */
  onPopoverExpand?: () => void;
}

interface AgendaDayGroupProps {
  day: AgendaDay;
  isToday: boolean;
  /** Draws one of the day's entries */
  renderRow: (day: AgendaDay, entry: AgendaEntry) => React.ReactNode;
}

interface AgendaTodayRowsProps {
  day: AgendaDay;
  renderRow: (day: AgendaDay, entry: AgendaEntry) => React.ReactNode;
}

interface AgendaEmptyStateProps {
  /** First day of the agenda */
  from: Date;
  /** Last day of the agenda */
  to: Date;
}

/** Splits the listed days into months, in order */
function groupByMonth(days: AgendaDay[]): AgendaMonth[] {
  const months: AgendaMonth[] = [];
  for (const day of days) {
    const current = months[months.length - 1];
    if (current && isSameMonth(current.date, day.date)) {
      current.days.push(day);
      continue;
    }
    months.push({ date: day.date, days: [day] });
  }
  return months;
}

/** Stable key for an entry: an event is listed at most once per day */
function getEntryKey(day: Date, entry: AgendaEntry): string {
  return `${format(day, "yyyy-MM-dd")}:${entry.event.id}`;
}

/**
 * Index in today's entries where the current-time line goes: before the
 * first timed entry that starts after `now`, or after the last entry
 */
function getNowLineIndex(entries: AgendaEntry[], now: Date): number {
  const index = entries.findIndex(
    (entry) =>
      !entry.isAllDayOnThisDay &&
      entry.dayIndex === 1 &&
      entry.event.start > now,
  );
  return index === -1 ? entries.length : index;
}

/**
 * Scrolling list of the coming days' events, grouped by day: `AGENDA_DAYS`
 * days from the provider's date, skipping days without events (today is
 * always shown). Date, events, selection and view settings come from the
 * surrounding CalendarProvider.
 */
export function AgendaView({
  showEventPopover = true,
  onEventPopoverExpand,
  className,
}: AgendaViewProps) {
  const {
    view,
    currentDate,
    events,
    viewSettings,
    selectedEventId,
    selectEvent,
    clearSelection,
    updateEvent,
    goToDate,
    loading,
  } = useCalendar();
  const { locale } = useCalendarConfig();
  const { reportView, reportVisibleDays, closeEventPopover } =
    useCalendarViewSync();
  // `null` on the server and during hydration, so no day is marked as today
  const today = useToday();
  /**
   * Whether the provider navigates by the agenda's range. False for the
   * commit before it adopts this view (on mount, or right after a switch it
   * doesn't follow).
   */
  const isProviderInSync = view === "agenda";
  const boundaryRef = useRef<HTMLDivElement | null>(null);
  /**
   * Never attached: nothing sits above the list, so the details popover may
   * use the agenda's full height
   */
  const headerRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const { showWeekends } = viewSettings;

  // Tell the provider which view is on screen. `reportView` changes with the
  // provider's state, so this also re-checks after every switch. A layout
  // effect: the provider adopts the agenda before the first paint.
  useLayoutEffect(() => {
    reportView({ view: "agenda" });
  }, [reportView]);

  const rangeDays = useMemo(
    () => getVisibleDays(currentDate, "agenda", AGENDA_DAYS),
    [currentDate],
  );
  const rangeStart = rangeDays[0];
  const rangeEnd = rangeDays[rangeDays.length - 1];

  // Report the covered days to the provider (header and range consumers).
  // Not while it is adopting this view: the date is about to change.
  useEffect(() => {
    if (!isProviderInSync) return;
    reportVisibleDays(rangeDays);
  }, [isProviderInSync, rangeDays, reportVisibleDays]);

  // A new range starts at the top of the list
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0 });
  }, [currentDate]);

  const listedDays = useMemo(() => {
    const days = getAgendaDays(events, currentDate, AGENDA_DAYS);
    return days.filter((day) => {
      if (!showWeekends && isWeekend(day.date)) return false;
      if (day.entries.length > 0) return true;
      return today !== null && isSameDay(day.date, today);
    });
  }, [events, currentDate, showWeekends, today]);

  const months = useMemo(() => groupByMonth(listedDays), [listedDays]);
  const hasEvents = listedDays.some((day) => day.entries.length > 0);

  /**
   * Row that opens the selected event's popover: its first listed day, so
   * a multi-day event opens it once
   */
  const popoverEntryKey = useMemo(() => {
    if (!selectedEventId || !showEventPopover) return null;
    for (const day of listedDays) {
      const entry = day.entries.find((e) => e.event.id === selectedEventId);
      if (entry) return getEntryKey(day.date, entry);
    }
    return null;
  }, [listedDays, selectedEventId, showEventPopover]);

  const handleSelect = useCallback(
    (event: CalendarEvent) => selectEvent(event.id),
    [selectEvent],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, event: CalendarEvent) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, event });
    },
    [],
  );

  /** Whether a day is in the agenda's range */
  const isDayVisible = useCallback(
    (date: Date) => date >= rangeStart && date < addDays(rangeEnd, 1),
    [rangeStart, rangeEnd],
  );

  /** Moves the range a day toward a day just outside it (keyboard moves go a day at most) */
  const revealDay = useCallback(
    (date: Date) => {
      goToDate(addDays(currentDate, date < rangeStart ? -1 : 1));
    },
    [currentDate, rangeStart, goToDate],
  );

  const handleEventKeyDown = useEventKeyboard({
    containerRef: boundaryRef,
    scrollContainerRef,
    isDayVisible,
    revealDay,
  });

  const handleRootClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (
        isInsideCalendarPopover(target) ||
        target.closest("button") ||
        target.closest("[role='button']")
      ) {
        return;
      }
      clearSelection();
    },
    [clearSelection],
  );

  const renderRow = (day: AgendaDay, entry: AgendaEntry) => {
    const key = getEntryKey(day.date, entry);
    return (
      <AgendaEventRow
        key={key}
        entry={entry}
        isSelected={entry.event.id === selectedEventId}
        showPopover={key === popoverEntryKey}
        onSelect={handleSelect}
        onContextMenu={handleContextMenu}
        onEventChange={updateEvent}
        onPopoverClose={closeEventPopover}
        onPopoverExpand={onEventPopoverExpand}
      />
    );
  };

  return (
    <CalendarPopoverBoundaryProvider
      boundaryRef={boundaryRef}
      headerRef={headerRef}
      view="agenda"
    >
      <div
        ref={boundaryRef}
        className={cn(
          "@container/agenda relative flex h-full flex-col overflow-hidden bg-background",
          className,
        )}
        aria-busy={loading || undefined}
        onClick={handleRootClick}
        onKeyDown={handleEventKeyDown}
      >
        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          {hasEvents ? (
            months.map((month) => (
              <div key={month.date.toISOString()}>
                {/* The day groups' labels carry the month for screen readers */}
                <div
                  aria-hidden
                  className="sticky top-0 z-10 border-b border-border bg-background/95 px-3 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur @xl/agenda:px-6"
                >
                  {format(month.date, "MMMM yyyy", { locale })}
                </div>
                {month.days.map((day) => (
                  <AgendaDayGroup
                    key={day.date.toISOString()}
                    day={day}
                    isToday={today !== null && isSameDay(day.date, today)}
                    renderRow={renderRow}
                  />
                ))}
              </div>
            ))
          ) : (
            <AgendaEmptyState from={rangeStart} to={rangeEnd} />
          )}
        </div>
        {/* No header to sit under, so the bar runs along the top, above the
            sticky month labels */}
        {loading && <CalendarLoadingBar className="top-0 bottom-auto z-20" />}

        {contextMenu && (
          <EventContextMenu
            event={contextMenu.event}
            position={{ x: contextMenu.x, y: contextMenu.y }}
            onClose={() => setContextMenu(null)}
            onEventChange={updateEvent}
          />
        )}
      </div>
    </CalendarPopoverBoundaryProvider>
  );
}

/**
 * One day of the agenda: its date on the left (today in a badge), its
 * events on the right. A labelled group, like the time grid's day columns
 * and month cells.
 */
function AgendaDayGroup({ day, isToday, renderRow }: AgendaDayGroupProps) {
  const { locale } = useCalendarConfig();
  const fullDate = formatFullDate(day.date, locale);

  return (
    <div
      role="group"
      aria-label={isToday ? `${fullDate}, today` : fullDate}
      data-date={format(day.date, "yyyy-MM-dd")}
      className="flex gap-3 border-b border-border px-3 py-2.5 @xl/agenda:gap-5 @xl/agenda:px-6"
    >
      {/* The group's label reads the date out */}
      <div
        aria-hidden
        className="flex w-10 shrink-0 flex-col items-center gap-0.5 pt-1"
      >
        <span
          className={cn(
            "text-[11px] leading-none uppercase",
            isToday ? "font-semibold text-primary" : "text-muted-foreground",
          )}
        >
          {format(day.date, "EEE", { locale })}
        </span>
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-full text-base tabular-nums",
            isToday
              ? "bg-primary font-semibold text-primary-foreground"
              : "text-foreground",
          )}
        >
          {format(day.date, "d", { locale })}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {isToday ? (
          <AgendaTodayRows day={day} renderRow={renderRow} />
        ) : (
          day.entries.map((entry) => renderRow(day, entry))
        )}
      </div>
    </div>
  );
}

/**
 * Today's entries with a current-time line between the past and upcoming
 * ones, or a note when today has none. Its own component, so only today
 * re-renders as the clock ticks.
 */
function AgendaTodayRows({ day, renderRow }: AgendaTodayRowsProps) {
  // `null` on the server and during hydration: no line until then
  const now = useNow();

  if (day.entries.length === 0) {
    return (
      <p className="flex min-h-9 items-center text-sm text-muted-foreground">
        No events today
      </p>
    );
  }

  const lineIndex = now ? getNowLineIndex(day.entries, now) : -1;

  return day.entries.flatMap((entry, index) => {
    const row = renderRow(day, entry);
    const isLastRow = index === day.entries.length - 1;
    if (index === lineIndex) return [<AgendaNowLine key="now" />, row];
    if (isLastRow && lineIndex === day.entries.length) {
      return [row, <AgendaNowLine key="now" />];
    }
    return [row];
  });
}

/** Red line marking the current time between today's events */
function AgendaNowLine() {
  return (
    <div aria-hidden className="relative flex h-0 items-center">
      <span className="absolute -left-1 size-2 rounded-full bg-primary" />
      <span className="h-0.5 flex-1 rounded-full bg-primary" />
    </div>
  );
}

/**
 * An event under one of its days: a tinted row in the event's color with
 * its time, title, location and, for a multi-day event, which day this is.
 * Selects the event on click, Enter or Space, and opens the details popover
 * when it is the selected event's first listed day.
 */
function AgendaEventRow({
  entry,
  isSelected,
  showPopover,
  onSelect,
  onContextMenu,
  onEventChange,
  onPopoverClose,
  onPopoverExpand,
}: AgendaEventRowProps) {
  const { event } = entry;
  const color = event.color ?? "blue";
  const styles = eventColorStyles[color];
  // `false` on the server and during hydration, so the markup matches
  const eventIsPast = useIsPast(event.end);
  const { hourCycle, locale } = useCalendarConfig();
  // Every field is optional: plain events read as details without any
  const { location }: DetailedCalendarEvent = event;
  const timeLabel = formatAgendaTime(entry, hourCycle, locale);
  const dayOfSpan = formatAgendaDayOfSpan(entry);
  const label = getEventLabel(event, hourCycle, locale);
  const details = [location, dayOfSpan].filter(Boolean).join(" · ");
  /** The row: its details popover opens below it */
  const rowRef = useRef<HTMLDivElement>(null);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    onSelect(event);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, event);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onSelect(event);
  }

  const secondaryTextClass = isSelected
    ? "text-white/85"
    : cn(styles.text, "opacity-80 dark:text-white/70 dark:opacity-100");

  return (
    // The row stays first, so opening the details keeps this element (and
    // its focus) instead of re-creating it
    <>
      <div
        ref={rowRef}
        role="button"
        tabIndex={0}
        aria-label={dayOfSpan ? `${label}, ${dayOfSpan.toLowerCase()}` : label}
        aria-pressed={isSelected}
        data-event-id={event.id}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative flex min-h-9 cursor-default overflow-hidden rounded-md select-none",
          "focus:outline-none",
          EVENT_FOCUS_RING_CLASS,
          isSelected ? styles.border : cn(styles.bg, styles.bgHover),
          eventIsPast && !isSelected && "opacity-60",
        )}
      >
        {/* Color accent, merged into the background when selected (kept
              in place so the content doesn't shift) */}
        <span
          aria-hidden
          className={cn(
            "w-1 shrink-0",
            !isSelected &&
              cn(styles.border, "dark:bg-white dark:mix-blend-overlay"),
          )}
        />
        <EventContentSlot
          event={event}
          view="agenda"
          placement="agenda"
          isSelected={isSelected}
          isPast={eventIsPast}
          isDragging={false}
          isResizing={false}
          isCompact={false}
          timeLabel={timeLabel}
          className={AGENDA_SLOT_CLASS}
          fallback={
            <div
              className={cn(
                "grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] content-center gap-x-1 gap-y-0.5 px-2.5 py-1.5 text-xs",
                "@xl/agenda:grid-cols-[8.5rem_minmax(0,1fr)_auto] @xl/agenda:items-center @xl/agenda:gap-x-4",
              )}
            >
              <span
                className={cn(
                  "col-span-2 truncate text-sm font-medium",
                  "@xl/agenda:col-span-1 @xl/agenda:col-start-2 @xl/agenda:row-start-1",
                  isSelected
                    ? "text-white"
                    : cn(styles.text, "dark:text-white/90"),
                )}
              >
                {event.title}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap tabular-nums",
                  "@xl/agenda:col-start-1 @xl/agenda:row-start-1",
                  secondaryTextClass,
                )}
              >
                {timeLabel}
              </span>
              {details && (
                <span
                  className={cn(
                    "truncate before:mr-1 before:content-['·'] @xl/agenda:col-start-3 @xl/agenda:row-start-1 @xl/agenda:max-w-56 @xl/agenda:text-right @xl/agenda:before:content-none",
                    secondaryTextClass,
                  )}
                >
                  {details}
                </span>
              )}
            </div>
          }
        />
      </div>
      {showPopover && (
        <EventDetailPopover
          event={event}
          anchor={rowRef}
          onEventChange={onEventChange}
          onClose={() => onPopoverClose(event.id)}
          onExpand={onPopoverExpand}
          side="bottom"
          align="end"
        />
      )}
    </>
  );
}

/** Shown when no events fall in the agenda's range */
function AgendaEmptyState({ from, to }: AgendaEmptyStateProps) {
  const { locale } = useCalendarConfig();

  return (
    <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CalendarCheckIcon aria-hidden className="size-5" />
      </div>
      <p className="text-sm font-medium text-foreground">Nothing planned</p>
      <p className="max-w-64 text-sm text-muted-foreground">
        No events from {format(from, "MMM d", { locale })} to{" "}
        {format(to, "MMM d", { locale })}.
      </p>
    </div>
  );
}
