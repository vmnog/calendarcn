import type { CalendarEvent, EventColor } from "@/components/week-view-types";

function d(month: number, day: number, hour: number, minute = 0): Date {
  return new Date(2026, month - 1, day, hour, minute);
}

function ev(
  id: string,
  title: string,
  start: Date,
  end: Date,
  color: EventColor,
  calendarId: string,
  opts?: { isAllDay?: boolean; description?: string; location?: string }
): CalendarEvent {
  return { id, title, start, end, color, calendarId, ...opts };
}

/**
 * Generates mock events with fixed dates across January–March 2026.
 */
export function generateMockEvents(): CalendarEvent[] {
  return [
    // ── January 2026 ──

    // Week of Jan 4 (Sun Jan 4 – Sat Jan 10)
    ev("j01", "New Year Planning", d(1, 5, 9), d(1, 5, 10, 30), "blue", "work"),
    ev("j02", "Team Standup", d(1, 5, 10, 30), d(1, 5, 11), "blue", "work"),
    ev("j03", "Lunch with Alex", d(1, 6, 12), d(1, 6, 13), "green", "personal"),
    ev("j04", "Client Onboarding", d(1, 7, 14), d(1, 7, 15, 30), "orange", "work"),
    ev("j05", "Gym", d(1, 8, 18), d(1, 8, 19, 30), "purple", "personal"),
    ev("j06", "Friday Wrap-up", d(1, 9, 16), d(1, 9, 17), "blue", "work"),

    // Week of Jan 11 (Sun Jan 11 – Sat Jan 17)
    ev("j07", "Team Standup", d(1, 12, 9), d(1, 12, 9, 30), "blue", "work"),
    ev("j08", "Product Roadmap Review", d(1, 12, 10), d(1, 12, 11, 30), "purple", "work"),
    ev("j09", "Design Sync", d(1, 13, 11), d(1, 13, 12), "orange", "work"),
    ev("j10", "1:1 with Manager", d(1, 14, 15), d(1, 14, 15, 30), "purple", "work"),
    ev("j11", "Dentist", d(1, 15, 10), d(1, 15, 11), "red", "personal"),
    ev("j12", "Movie Night", d(1, 16, 19), d(1, 16, 21, 30), "yellow", "personal"),
    ev("j13", "MLK Day", d(1, 19, 0), d(1, 19, 0), "red", "work", { isAllDay: true }),

    // Week of Jan 18 (Sun Jan 18 – Sat Jan 24)
    ev("j14", "Team Standup", d(1, 19, 9), d(1, 19, 9, 30), "blue", "work"),
    ev("j15", "Sprint Planning", d(1, 19, 10), d(1, 19, 11, 30), "blue", "work"),
    ev("j16", "Coffee Chat", d(1, 20, 14), d(1, 20, 14, 30), "green", "personal"),
    ev("j17", "Architecture Review", d(1, 21, 13), d(1, 21, 14, 30), "purple", "work"),
    ev("j18", "Gym", d(1, 22, 18), d(1, 22, 19, 30), "purple", "personal"),
    ev("j19", "Happy Hour", d(1, 23, 17), d(1, 23, 19), "yellow", "personal"),
    ev("j20", "Brunch", d(1, 24, 11), d(1, 24, 13), "orange", "personal"),

    // Week of Jan 25 (Sun Jan 25 – Sat Jan 31)
    ev("j21", "Team Standup", d(1, 26, 9), d(1, 26, 9, 30), "blue", "work"),
    ev("j22", "Quarterly Review Prep", d(1, 26, 11), d(1, 26, 12, 30), "orange", "work"),
    ev("j23", "Client Demo", d(1, 27, 14), d(1, 27, 15), "red", "work"),
    ev("j24", "Blocked Time", d(1, 28, 13), d(1, 28, 14), "gray", "personal"),
    ev("j25", "Retro", d(1, 29, 14), d(1, 29, 15), "blue", "work"),
    ev("j26", "Gym", d(1, 29, 18), d(1, 29, 19, 30), "purple", "personal"),
    ev("j27", "Month-End Report", d(1, 30, 10), d(1, 30, 11, 30), "orange", "work"),

    // ── February 2026 ──

    // Week of Feb 1 (Sun Feb 1 – Sat Feb 7)
    ev("f01", "Team Standup", d(2, 2, 9), d(2, 2, 9, 30), "blue", "work"),
    ev("f02", "Q1 Kickoff", d(2, 2, 10), d(2, 2, 12), "purple", "work", { location: "Conference Room A" }),
    ev("f03", "Lunch with Sarah", d(2, 3, 12), d(2, 3, 13), "green", "personal"),
    ev("f04", "Design Review", d(2, 4, 14), d(2, 4, 15, 30), "orange", "work"),
    ev("f05", "Workshop", d(2, 5, 9), d(2, 5, 12), "green", "work", { description: "React Patterns Workshop", location: "Main Hall" }),
    ev("f06", "Gym", d(2, 5, 18), d(2, 5, 19, 30), "purple", "personal"),
    ev("f07", "Team Lunch", d(2, 6, 12), d(2, 6, 13, 30), "yellow", "work"),

    // Week of Feb 8 (Sun Feb 8 – Sat Feb 14)
    ev("f08", "Team Standup", d(2, 9, 9), d(2, 9, 9, 30), "blue", "work"),
    ev("f09", "Project Planning", d(2, 9, 10), d(2, 9, 11, 30), "purple", "work"),
    ev("f10", "Client Call", d(2, 10, 14, 30), d(2, 10, 15, 30), "red", "work"),
    ev("f11", "1:1 with Manager", d(2, 11, 15), d(2, 11, 15, 30), "purple", "work"),
    ev("f12", "Sprint Review", d(2, 12, 10), d(2, 12, 11), "blue", "work"),
    ev("f13", "Valentine's Dinner", d(2, 14, 19), d(2, 14, 21), "red", "personal"),
    ev("f14", "Valentine's Day", d(2, 14, 0), d(2, 14, 0), "red", "personal", { isAllDay: true }),

    // Week of Feb 15 (Sun Feb 15 – Sat Feb 21)
    ev("f15", "Team Standup", d(2, 16, 9), d(2, 16, 9, 30), "blue", "work"),
    ev("f16", "Roadmap Sync", d(2, 16, 11), d(2, 16, 12), "purple", "work"),
    ev("f17", "Lunch with Alex", d(2, 17, 12), d(2, 17, 13), "green", "personal"),
    ev("f18", "Architecture Deep Dive", d(2, 18, 13), d(2, 18, 15), "purple", "work"),
    ev("f19", "Gym", d(2, 19, 18), d(2, 19, 19, 30), "purple", "personal"),
    ev("f20", "Happy Hour", d(2, 20, 17), d(2, 20, 19), "yellow", "personal"),
    ev("f21", "Presidents' Day", d(2, 16, 0), d(2, 16, 0), "red", "work", { isAllDay: true }),
    ev("f22", "Brunch", d(2, 21, 11), d(2, 21, 13), "orange", "personal"),
    ev("f23", "Blocked Time", d(2, 18, 10), d(2, 18, 11), "gray", "personal"),

    // Week of Feb 22 (Sun Feb 22 – Sat Feb 28)
    ev("f24", "Team Standup", d(2, 23, 9), d(2, 23, 9, 30), "blue", "work"),
    ev("f25", "Sprint Planning", d(2, 23, 10), d(2, 23, 11, 30), "blue", "work"),
    ev("f26", "UX Research Debrief", d(2, 24, 14), d(2, 24, 15), "orange", "work"),
    ev("f27", "Coffee Chat", d(2, 25, 9, 30), d(2, 25, 10), "green", "personal"),
    ev("f28", "Demo Day", d(2, 26, 14), d(2, 26, 16), "purple", "work", { location: "Auditorium" }),
    ev("f29", "Retro", d(2, 27, 14), d(2, 27, 15), "blue", "work"),
    ev("f30", "Gym", d(2, 26, 18), d(2, 26, 19, 30), "purple", "personal"),

    // ── March 2026 ──

    // Week of Mar 1 (Sun Mar 1 – Sat Mar 7)
    ev("m01", "Team Standup", d(3, 2, 9), d(3, 2, 9, 30), "blue", "work"),
    ev("m02", "March Priorities", d(3, 2, 10), d(3, 2, 11, 30), "purple", "work"),
    ev("m03", "Vendor Meeting", d(3, 3, 13), d(3, 3, 14), "orange", "work"),
    ev("m04", "Lunch with Sarah", d(3, 4, 12), d(3, 4, 13), "green", "personal"),
    ev("m05", "Workshop: Testing", d(3, 5, 9), d(3, 5, 12), "green", "work", { description: "Testing Best Practices" }),
    ev("m06", "Gym", d(3, 5, 18), d(3, 5, 19, 30), "purple", "personal"),
    ev("m07", "Game Night", d(3, 6, 19), d(3, 6, 22), "yellow", "personal"),

    // Week of Mar 8 (Sun Mar 8 – Sat Mar 14)
    ev("m08", "Team Standup", d(3, 9, 9), d(3, 9, 9, 30), "blue", "work"),
    ev("m09", "OKR Review", d(3, 9, 10), d(3, 9, 11, 30), "purple", "work"),
    ev("m10", "Client Call", d(3, 10, 14), d(3, 10, 15), "red", "work"),
    ev("m11", "1:1 with Manager", d(3, 11, 15), d(3, 11, 15, 30), "purple", "work"),
    ev("m12", "Design Review", d(3, 12, 11), d(3, 12, 12, 30), "orange", "work"),
    ev("m13", "Team Offsite", d(3, 12, 0), d(3, 13, 0), "purple", "work", { isAllDay: true }),
    ev("m14", "Happy Hour", d(3, 13, 17), d(3, 13, 19), "yellow", "personal"),

    // Week of Mar 15 (Sun Mar 15 – Sat Mar 21)
    ev("m15", "Team Standup", d(3, 16, 9), d(3, 16, 9, 30), "blue", "work"),
    ev("m16", "Sprint Planning", d(3, 16, 10), d(3, 16, 11, 30), "blue", "work"),
    ev("m17", "Lunch with Alex", d(3, 17, 12), d(3, 17, 13), "green", "personal"),
    ev("m18", "Perf Review Prep", d(3, 18, 14), d(3, 18, 15, 30), "orange", "work"),
    ev("m19", "Blocked Time", d(3, 19, 13), d(3, 19, 14), "gray", "personal"),
    ev("m20", "Gym", d(3, 19, 18), d(3, 19, 19, 30), "purple", "personal"),
    ev("m21", "St. Patrick's Day", d(3, 17, 0), d(3, 17, 0), "green", "personal", { isAllDay: true }),

    // Week of Mar 22 (Sun Mar 22 – Sat Mar 28)
    ev("m22", "Team Standup", d(3, 23, 9), d(3, 23, 9, 30), "blue", "work"),
    ev("m23", "Q1 Wrap-up", d(3, 23, 10), d(3, 23, 12), "purple", "work"),
    ev("m24", "Client Demo", d(3, 24, 14), d(3, 24, 15, 30), "red", "work"),
    ev("m25", "Architecture Review", d(3, 25, 13), d(3, 25, 14, 30), "purple", "work"),
    ev("m26", "Sprint Review", d(3, 26, 10), d(3, 26, 11), "blue", "work"),
    ev("m27", "Retro", d(3, 27, 14), d(3, 27, 15), "blue", "work"),
    ev("m28", "Gym", d(3, 26, 18), d(3, 26, 19, 30), "purple", "personal"),
    ev("m29", "Birthday Party", d(3, 28, 15), d(3, 28, 18), "red", "personal"),

    // Week of Mar 29 (Sun Mar 29 – Sat Apr 4)
    ev("m30", "Team Standup", d(3, 30, 9), d(3, 30, 9, 30), "blue", "work"),
    ev("m31", "Q2 Planning", d(3, 30, 10), d(3, 30, 12), "orange", "work"),
    ev("m32", "Month-End Report", d(3, 31, 10), d(3, 31, 11, 30), "orange", "work"),
  ];
}
