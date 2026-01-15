import {
  startOfWeek,
  addDays,
  setHours,
  setMinutes,
} from "date-fns";
import type { CalendarEvent } from "@/components/week-view-types";

/**
 * Generates mock events for the current week
 */
export function generateMockEvents(currentDate: Date): CalendarEvent[] {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });

  return [
    // Monday events
    {
      id: "1",
      title: "Team Standup",
      start: setMinutes(setHours(addDays(weekStart, 1), 9), 0),
      end: setMinutes(setHours(addDays(weekStart, 1), 9), 30),
      color: "blue",
      calendarId: "work",
    },
    {
      id: "2",
      title: "Project Planning",
      start: setMinutes(setHours(addDays(weekStart, 1), 10), 0),
      end: setMinutes(setHours(addDays(weekStart, 1), 11), 30),
      color: "purple",
      calendarId: "work",
    },
    {
      id: "3",
      title: "Lunch with Sarah",
      start: setMinutes(setHours(addDays(weekStart, 1), 12), 0),
      end: setMinutes(setHours(addDays(weekStart, 1), 13), 0),
      color: "green",
      calendarId: "personal",
    },

    // Tuesday events
    {
      id: "4",
      title: "Design Review",
      start: setMinutes(setHours(addDays(weekStart, 2), 14), 0),
      end: setMinutes(setHours(addDays(weekStart, 2), 15), 30),
      color: "orange",
      calendarId: "work",
    },
    {
      id: "5",
      title: "Client Call",
      start: setMinutes(setHours(addDays(weekStart, 2), 14), 30),
      end: setMinutes(setHours(addDays(weekStart, 2), 15), 30),
      color: "red",
      calendarId: "work",
    },

    // Wednesday events
    {
      id: "6",
      title: "Sprint Review",
      start: setMinutes(setHours(addDays(weekStart, 3), 10), 0),
      end: setMinutes(setHours(addDays(weekStart, 3), 11), 0),
      color: "blue",
      calendarId: "work",
    },
    {
      id: "7",
      title: "1:1 with Manager",
      start: setMinutes(setHours(addDays(weekStart, 3), 15), 0),
      end: setMinutes(setHours(addDays(weekStart, 3), 15), 30),
      color: "purple",
      calendarId: "work",
    },
    {
      id: "16",
      title: "Blocked Time",
      start: setMinutes(setHours(addDays(weekStart, 3), 13), 0),
      end: setMinutes(setHours(addDays(weekStart, 3), 14), 0),
      color: "gray",
      calendarId: "personal",
    },

    // Thursday events
    {
      id: "8",
      title: "Workshop",
      start: setMinutes(setHours(addDays(weekStart, 4), 9), 0),
      end: setMinutes(setHours(addDays(weekStart, 4), 12), 0),
      color: "green",
      calendarId: "work",
      description: "React Best Practices Workshop",
      location: "Conference Room A",
    },
    {
      id: "9",
      title: "Gym",
      start: setMinutes(setHours(addDays(weekStart, 4), 18), 0),
      end: setMinutes(setHours(addDays(weekStart, 4), 19), 30),
      color: "purple",
      calendarId: "personal",
    },

    // Friday events
    {
      id: "10",
      title: "Team Retrospective",
      start: setMinutes(setHours(addDays(weekStart, 5), 14), 0),
      end: setMinutes(setHours(addDays(weekStart, 5), 15), 0),
      color: "blue",
      calendarId: "work",
    },
    {
      id: "11",
      title: "Happy Hour",
      start: setMinutes(setHours(addDays(weekStart, 5), 17), 0),
      end: setMinutes(setHours(addDays(weekStart, 5), 19), 0),
      color: "yellow",
      calendarId: "personal",
    },

    // Weekend events
    {
      id: "12",
      title: "Brunch",
      start: setMinutes(setHours(addDays(weekStart, 6), 11), 0),
      end: setMinutes(setHours(addDays(weekStart, 6), 13), 0),
      color: "orange",
      calendarId: "personal",
    },

    // All-day events
    {
      id: "13",
      title: "Company Holiday",
      start: addDays(weekStart, 1),
      end: addDays(weekStart, 1),
      isAllDay: true,
      color: "red",
      calendarId: "work",
    },
    {
      id: "14",
      title: "Team Offsite",
      start: setMinutes(setHours(addDays(weekStart, 3), 8), 45),
      end: addDays(weekStart, 4),
      isAllDay: true,
      color: "purple",
      calendarId: "work",
    },
    {
      id: "15",
      title: "Birthday",
      start: addDays(weekStart, 5),
      end: addDays(weekStart, 5),
      isAllDay: true,
      color: "red",
      calendarId: "personal",
    },
  ];
}
