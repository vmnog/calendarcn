"use client";

import * as React from "react";
import {
  addDays,
  addMinutes,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isFriday,
  isWeekend,
} from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, RotateCwIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { AgendaView } from "@/components/agenda-view";
import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { MonthView } from "@/components/month-view";
import { TimeGrid } from "@/components/time-grid";
import { Button } from "@/components/ui/button";
import type {
  CalendarEvent,
  EventColor,
  ViewType,
  VisibleRange,
} from "@/components/calendar-types";

/** How long the pretend server takes to answer, in milliseconds */
const SERVER_DELAY_MS = 800;

/** Log entries kept on screen, newest first */
const MAX_LOG_ENTRIES = 8;

/** Day the pretend server counts from, so a day always gets the same events */
const SERVER_EPOCH = new Date(2026, 0, 1);

/** Views offered by the header's switcher, in display order */
const VIEW_OPTIONS: { value: ViewType; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "agenda", label: "Agenda" },
];

/** Meetings the pretend server spreads over weekdays */
const MEETINGS: {
  title: string;
  hour: number;
  minutes: number;
  color: EventColor;
}[] = [
  { title: "Design review", hour: 10, minutes: 60, color: "purple" },
  { title: "Customer call", hour: 11, minutes: 30, color: "green" },
  { title: "Lunch and learn", hour: 12, minutes: 60, color: "orange" },
  { title: "1:1", hour: 14, minutes: 30, color: "gray" },
  { title: "Planning", hour: 15, minutes: 60, color: "red" },
  { title: "Pairing", hour: 16, minutes: 90, color: "yellow" },
];

/** One `onVisibleRangeChange` call, as the log shows it */
interface RangeLogEntry {
  id: number;
  range: VisibleRange;
  status: "loading" | "loaded" | "cached";
  /** Events the server returned, once loaded */
  count: number | null;
}

export function RangeLoadingDemo() {
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [pendingRequests, setPendingRequests] = React.useState(0);
  const [log, setLog] = React.useState<RangeLogEntry[]>([]);
  /** Ranges already requested: a tiny client-side cache, keyed by range */
  const fetchedRangesRef = React.useRef(new Set<string>());
  /** Range on screen, so Reload can fetch it again */
  const currentRangeRef = React.useRef<VisibleRange | null>(null);
  const nextLogIdRef = React.useRef(0);

  // The calendar calls this once on mount and whenever the visible dates
  // change: fetch the range unless it was fetched before
  const loadRange = React.useCallback((range: VisibleRange) => {
    currentRangeRef.current = range;
    const id = nextLogIdRef.current++;
    const addEntry = (entry: RangeLogEntry) =>
      setLog((prev) => [entry, ...prev].slice(0, MAX_LOG_ENTRIES));

    const key = `${range.start.toISOString()}/${range.end.toISOString()}`;
    if (fetchedRangesRef.current.has(key)) {
      addEntry({ id, range, status: "cached", count: null });
      return;
    }
    fetchedRangesRef.current.add(key);
    addEntry({ id, range, status: "loading", count: null });
    setPendingRequests((count) => count + 1);

    fetchEvents(range).then((fetched) => {
      // Keep what the calendar already has (and any edits to it), add the rest
      setEvents((prev) => {
        const knownIds = new Set(prev.map((event) => event.id));
        return [...prev, ...fetched.filter((event) => !knownIds.has(event.id))];
      });
      setLog((prev) =>
        prev.map((entry) =>
          entry.id === id
            ? { ...entry, status: "loaded", count: fetched.length }
            : entry,
        ),
      );
      setPendingRequests((count) => count - 1);
    });
  }, []);

  /** Forgets every fetched range and event, then loads the visible range again */
  const reload = React.useCallback(() => {
    fetchedRangesRef.current.clear();
    setEvents([]);
    setLog([]);
    if (currentRangeRef.current) loadRange(currentRangeRef.current);
  }, [loadRange]);

  return (
    <CalendarProvider
      events={events}
      onEventsChange={setEvents}
      onVisibleRangeChange={loadRange}
      loading={pendingRequests > 0}
    >
      {/* The log sits beside the calendar when there's room, below it otherwise */}
      <div className="@container h-full">
        <div className="flex h-full flex-col @2xl:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <CalendarHeader />
            <div className="min-h-0 flex-1">
              <CalendarBody />
            </div>
          </div>
          <RangeLog entries={log} onReload={reload} />
        </div>
      </div>
    </CalendarProvider>
  );
}

/** Title, today, previous and next, and the view switcher below them */
function CalendarHeader() {
  const { view, monthName, year, goToToday, goToPrev, goToNext, switchView } =
    useCalendar();

  return (
    <header className="flex flex-col gap-2 border-b px-3 py-2">
      {/* The switcher gets its own row: four views don't fit beside the
          title in the half of the example the calendar gets */}
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {monthName} {year}
        </h2>
        <Button variant="secondary" size="sm" onClick={goToToday}>
          Today
        </Button>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Previous ${view}`}
            onClick={goToPrev}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Next ${view}`}
            onClick={goToNext}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
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
              "h-7 flex-1 rounded-sm px-2.5 text-xs font-medium text-muted-foreground transition-[color,background-color,box-shadow,scale] duration-150 ease-out outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.96] motion-reduce:active:scale-100",
              view === option.value &&
                "bg-background text-foreground shadow-xs dark:bg-input",
            )}
          >
            {option.label}
          </button>
        ))}
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

  return <TimeGrid view={view} scrollToHour={8} />;
}

interface RangeLogProps {
  entries: RangeLogEntry[];
  onReload: () => void;
}

/** Every range the calendar reported, and whether it came from the server or the cache */
function RangeLog({ entries, onReload }: RangeLogProps) {
  return (
    <aside className="flex h-44 shrink-0 flex-col border-t @2xl:h-auto @2xl:w-60 @2xl:border-t-0 @2xl:border-l">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <h3 className="truncate font-mono text-xs font-medium">
            onVisibleRangeChange
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Newest first, end exclusive
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onReload}
          aria-label="Clear the cache and reload"
          title="Clear the cache and reload"
        >
          <RotateCwIcon />
        </Button>
      </div>
      <ul aria-label="Visible ranges" className="flex-1 overflow-y-auto p-1">
        {entries.map((entry) => (
          <li
            key={entry.id}
            data-testid="range-log-entry"
            data-start={format(entry.range.start, "yyyy-MM-dd")}
            data-end={format(entry.range.end, "yyyy-MM-dd")}
            data-status={entry.status}
            className="rounded-sm px-2 py-1.5"
          >
            <span className="block text-xs font-medium tabular-nums">
              {format(entry.range.start, "EEE, MMM d")} →{" "}
              {format(entry.range.end, "EEE, MMM d")}
            </span>
            <span className="block text-[11px] text-muted-foreground tabular-nums">
              {differenceInCalendarDays(entry.range.end, entry.range.start)}{" "}
              days · {describeStatus(entry)}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** "Loading…", "12 events" or "From cache" */
function describeStatus(entry: RangeLogEntry): string {
  if (entry.status === "loading") return "Loading…";
  if (entry.status === "cached") return "From cache";
  return `${entry.count} events`;
}

/** Pretend API: answers after SERVER_DELAY_MS with the events in `range` */
function fetchEvents(range: VisibleRange): Promise<CalendarEvent[]> {
  const days = eachDayOfInterval({
    start: range.start,
    end: addDays(range.end, -1),
  });
  const events = days.flatMap(getServerEvents);
  return new Promise((resolve) => {
    setTimeout(() => resolve(events), SERVER_DELAY_MS);
  });
}

/**
 * The pretend server's events for one day: a standup and one or two meetings
 * on weekdays, a release every other Friday, a long run on some weekends.
 * Ids are stable, so loading a day twice never duplicates its events.
 */
function getServerEvents(day: Date): CalendarEvent[] {
  const seed = differenceInCalendarDays(day, SERVER_EPOCH);
  const dayKey = format(day, "yyyy-MM-dd");
  const at = (hour: number, minute = 0) =>
    new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);

  if (isWeekend(day)) {
    if (modulo(seed, 3) !== 0) return [];
    return [
      {
        id: `${dayKey}-run`,
        title: "Long run",
        start: at(8),
        end: at(9, 30),
        color: "green",
      },
    ];
  }

  const events: CalendarEvent[] = [
    {
      id: `${dayKey}-standup`,
      title: "Standup",
      start: at(9, 30),
      end: at(9, 45),
      color: "blue",
    },
  ];
  // All-day events end at the start of their last day
  if (isFriday(day) && modulo(seed, 2) === 0) {
    events.push({
      id: `${dayKey}-release`,
      title: "Release",
      start: at(0),
      end: at(0),
      isAllDay: true,
      color: "purple",
    });
  }
  const picks = new Set([
    modulo(seed, MEETINGS.length),
    modulo(seed * 5 + 2, MEETINGS.length),
  ]);
  for (const index of picks) {
    const meeting = MEETINGS[index];
    events.push({
      id: `${dayKey}-meeting-${index}`,
      title: meeting.title,
      start: at(meeting.hour),
      end: addMinutes(at(meeting.hour), meeting.minutes),
      color: meeting.color,
    });
  }
  return events;
}

/** Remainder that stays positive for days before SERVER_EPOCH */
function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
