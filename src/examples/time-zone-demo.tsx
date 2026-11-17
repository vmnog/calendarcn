"use client";

import * as React from "react";
import { format } from "date-fns";

import { useToday } from "@/hooks/use-now";
import { Calendar } from "@/components/calendar";
import type { DetailedCalendarEvent } from "@/components/calendar-types";
import { fromZonedWallClock, getZonedNow } from "@/lib/time-zones";

/** The office the calendar is drawn for */
const TIME_ZONE = "Asia/Tokyo";

/** Where the office's other team works: its hours show beside Tokyo's */
const SECOND_TIME_ZONES = ["Asia/Kolkata"];

/**
 * The instant a clock in Tokyo reads `hour`:`minute`, `dayOffset` days from
 * today in Tokyo: what your app stores for a time set there
 */
function inTokyo(dayOffset: number, hour: number, minute = 0): Date {
  const today = getZonedNow(TIME_ZONE);
  return fromZonedWallClock(
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + dayOffset,
      hour,
      minute,
    ),
    TIME_ZONE,
  );
}

/** Two meetings today in Tokyo, lunch tomorrow, an offsite the day after */
function createOfficeEvents(): DetailedCalendarEvent[] {
  const today = getZonedNow(TIME_ZONE);
  // All-day events are calendar dates, not instants: a local midnight
  const offsiteDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 2,
  );
  return [
    {
      id: "standup",
      title: "Team standup",
      start: inTokyo(0, 10),
      end: inTokyo(0, 10, 30),
      color: "blue",
      timeZone: TIME_ZONE,
    },
    {
      id: "bangalore-call",
      title: "Call with Bangalore",
      start: inTokyo(0, 14),
      end: inTokyo(0, 15),
      color: "purple",
      timeZone: TIME_ZONE,
    },
    {
      id: "lunch",
      title: "Lunch with Kenji",
      start: inTokyo(1, 12),
      end: inTokyo(1, 13),
      color: "orange",
      timeZone: TIME_ZONE,
    },
    {
      id: "offsite",
      title: "Offsite",
      start: offsiteDay,
      end: offsiteDay,
      isAllDay: true,
      color: "green",
    },
  ];
}

export function TimeZoneDemo() {
  // Your app keeps instants. The calendar draws them on Tokyo's clock and
  // reports every change as instants again.
  const [events, setEvents] = React.useState(createOfficeEvents);

  return (
    // The list sits beside the calendar when there's room, below it otherwise
    <div className="@container h-full">
      <div className="flex h-full flex-col @2xl:flex-row">
        <div className="min-h-0 min-w-0 flex-1">
          <Calendar
            events={events}
            onEventsChange={setEvents}
            // Owned by the calendar, so the time zone labels can change them
            defaultTimeZone={TIME_ZONE}
            defaultSecondaryTimeZones={SECOND_TIME_ZONES}
            // The week number beside the title follows the zone's week too
            defaultViewSettings={{ showWeekNumbers: true }}
            // Other examples share this page: leave the keys to it
            shortcuts={false}
          />
        </div>
        <YourClock events={events} />
      </div>
    </div>
  );
}

interface YourClockProps {
  events: DetailedCalendarEvent[];
}

/** The app's events as it stores them, read on the viewer's own clock */
function YourClock({ events }: YourClockProps) {
  // The server doesn't know your clock: list nothing until hydration ends
  const today = useToday();
  const sortedEvents = React.useMemo(
    () => [...events].sort((a, b) => a.start.getTime() - b.start.getTime()),
    [events],
  );

  if (!today) return null;

  return (
    <aside className="flex h-40 shrink-0 flex-col border-t @2xl:h-auto @2xl:w-56 @2xl:border-t-0 @2xl:border-l">
      <h3 className="border-b px-3 py-2 text-xs font-medium">Your clock</h3>
      <ul
        aria-label="Your clock"
        className="flex-1 overflow-y-auto p-2 text-xs tabular-nums"
      >
        {sortedEvents.map((event) => (
          <li key={event.id} className="py-1">
            {event.title}, {formatOnYourClock(event)}
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** "Sat 9:00 PM", or "Tue, all day" */
function formatOnYourClock(event: DetailedCalendarEvent): string {
  if (event.isAllDay) return `${format(event.start, "EEE")}, all day`;
  return format(event.start, "EEE p");
}
