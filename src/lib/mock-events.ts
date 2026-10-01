import { addDays, startOfWeek } from "date-fns";

import type {
  CalendarEvent,
  EventColor,
  EventReminder,
} from "@/components/week-view-types";

/** Weekday the demo weeks start on (Sunday), matching the calendar views. */
const WEEK_STARTS_ON = 0;

/**
 * Builds a date relative to the current week: `dayOffset` days after the
 * Sunday that starts the week containing `today`, at `hour:minute` local time.
 * Offset 0 is this week's Sunday, 4 is this Thursday, -7 is last Sunday.
 */
type RelativeDate = (dayOffset: number, hour: number, minute?: number) => Date;

function createRelativeDate(today: Date): RelativeDate {
  const weekStart = startOfWeek(today, { weekStartsOn: WEEK_STARTS_ON });
  return (dayOffset, hour, minute = 0) => {
    const day = addDays(weekStart, dayOffset);
    return new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      hour,
      minute,
    );
  };
}

/** Builds an absolute local date, for events tied to real calendar dates. */
function onDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
): Date {
  return new Date(year, month - 1, day, hour, minute);
}

interface EventOpts {
  isAllDay?: boolean;
  description?: string;
  location?: string;
  timezone?: string;
  recurrence?: string;
  reminders?: EventReminder[];
  status?: "busy" | "free";
  visibility?: "default" | "public" | "private";
  calendarEmail?: string;
}

function ev(
  id: string,
  title: string,
  start: Date,
  end: Date,
  color: EventColor,
  calendarId: string,
  opts?: EventOpts,
): CalendarEvent {
  return { id, title, start, end, color, calendarId, ...opts };
}

/**
 * Demo events, placed relative to the current week with `rel(dayOffset, …)`
 * (0 = this Sunday, 4 = this Thursday, negative = earlier weeks). Holidays
 * use `onDate()` because they sit on real calendar dates.
 *
 * Calendar mapping:
 *   me@vmnog.com       → red     (main email)
 *   Work               → blue    (work projects)
 *   Personal           → purple  (personal)
 *   Family             → orange  (family)
 *   Side Projects      → yellow  (side projects)
 *   Fitness            → green   (gym/sports)
 *   Holidays in Brazil → green   (subscribed)
 */
function demoEvents(rel: RelativeDate): CalendarEvent[] {
  return [
    // ── 19 to 16 weeks ago ──

    // Week -19 (days -133 to -127)
    ev(
      "j01",
      "New Year Planning",
      rel(-132, 9),
      rel(-132, 10, 30),
      "blue",
      "Work",
      {
        description:
          "Align on Q1 goals and key deliverables for the engineering team",
        reminders: [{ amount: 1, unit: "hours" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "j02",
      "Team Standup",
      rel(-132, 10, 30),
      rel(-132, 11),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Mon",
        description: "Daily sync — blockers, progress, priorities",
        reminders: [{ amount: 5, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
        status: "busy",
      },
    ),
    ev(
      "j03",
      "Lunch with Alex",
      rel(-131, 12),
      rel(-131, 13),
      "purple",
      "Personal",
      { location: "Ichiran Ramen", calendarEmail: "me@vmnog.com" },
    ),
    ev(
      "j04",
      "Client Onboarding",
      rel(-130, 14),
      rel(-130, 15, 30),
      "blue",
      "Work",
      {
        description:
          "Walk through platform setup and API integration with Acme Corp",
        reminders: [
          { amount: 15, unit: "minutes" },
          { amount: 1, unit: "hours" },
        ],
        calendarEmail: "me@vmnog.com",
        status: "busy",
      },
    ),
    ev(
      "j04b",
      "1:1 with Manager",
      rel(-130, 15, 30),
      rel(-130, 16),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Wed",
        description: "First 1:1 of the year — set annual goals",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("j05", "Gym", rel(-129, 18), rel(-129, 19, 30), "green", "Fitness", {
      recurrence: "Every week on Thu",
      reminders: [{ amount: 30, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("j06", "Friday Wrap-up", rel(-128, 16), rel(-128, 17), "blue", "Work", {
      recurrence: "Every week on Fri",
      description: "Review weekly accomplishments and set Monday priorities",
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "j06b",
      "Happy Hour",
      rel(-128, 17),
      rel(-128, 19),
      "purple",
      "Personal",
      {
        recurrence: "Every week on Fri",
        location: "The Draft House",
        reminders: [{ amount: 30, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),

    // Week -18 (days -126 to -120)
    ev(
      "j07",
      "Team Standup",
      rel(-125, 9),
      rel(-125, 9, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Mon",
        description: "Daily sync — blockers, progress, priorities",
        reminders: [{ amount: 5, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
        status: "busy",
      },
    ),
    ev(
      "j08",
      "Product Roadmap Review",
      rel(-125, 10),
      rel(-125, 11, 30),
      "blue",
      "Work",
      {
        description:
          "Review H1 roadmap with product and design leads. Bring updated estimates.",
        reminders: [{ amount: 15, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "j09",
      "Design Sync",
      rel(-124, 11),
      rel(-124, 12),
      "yellow",
      "Side Projects",
      { calendarEmail: "me@vmnog.com" },
    ),
    ev(
      "j10",
      "1:1 with Manager",
      rel(-123, 15),
      rel(-123, 15, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Wed",
        description: "Career growth discussion, Q1 goals check-in",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("j10b", "Gym", rel(-122, 18), rel(-122, 19, 30), "green", "Fitness", {
      recurrence: "Every week on Thu",
      reminders: [{ amount: 30, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("j11", "Dentist", rel(-122, 10), rel(-122, 11), "purple", "Personal", {
      description: "Regular cleaning + check-up. Bring insurance card.",
      location: "SmileCare Dental",
      reminders: [
        { amount: 1, unit: "hours" },
        { amount: 1, unit: "days" },
      ],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "j12",
      "Movie Night",
      rel(-121, 19),
      rel(-121, 21, 30),
      "orange",
      "Family",
      {
        description:
          "Watching the new sci-fi movie everyone's been talking about",
        location: "AMC Theater",
        reminders: [{ amount: 30, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("j12b", "Friday Wrap-up", rel(-121, 16), rel(-121, 17), "blue", "Work", {
      recurrence: "Every week on Fri",
      description: "Review weekly accomplishments and set Monday priorities",
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "j12c",
      "Happy Hour",
      rel(-121, 17),
      rel(-121, 19),
      "purple",
      "Personal",
      {
        recurrence: "Every week on Fri",
        location: "The Draft House",
        reminders: [{ amount: 30, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "j13",
      "MLK Day",
      onDate(2026, 1, 19, 0),
      onDate(2026, 1, 19, 0),
      "green",
      "Holidays in Brazil",
      { isAllDay: true, calendarEmail: "me@vmnog.com" },
    ),

    // Week -17 (days -119 to -113)
    ev(
      "j14",
      "Team Standup",
      rel(-118, 9),
      rel(-118, 9, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Mon",
        description: "Daily sync — blockers, progress, priorities",
        reminders: [{ amount: 5, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
        status: "busy",
      },
    ),
    ev(
      "j15",
      "Sprint Planning",
      rel(-118, 10),
      rel(-118, 11, 30),
      "blue",
      "Work",
      {
        recurrence: "Every 2 weeks on Mon",
        description: "Scope sprint 3 stories, assign points and owners",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "j16",
      "Coffee Chat",
      rel(-117, 14),
      rel(-117, 14, 30),
      "purple",
      "Personal",
      { location: "Blue Bottle Coffee", calendarEmail: "me@vmnog.com" },
    ),
    ev(
      "j17",
      "Architecture Review",
      rel(-116, 13),
      rel(-116, 14, 30),
      "blue",
      "Work",
      {
        description:
          "Review proposed microservice migration plan. Discuss trade-offs with team.",
        reminders: [{ amount: 15, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "j17b",
      "1:1 with Manager",
      rel(-116, 15),
      rel(-116, 15, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Wed",
        description: "Weekly sync — project assignments and growth plan",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("j18", "Gym", rel(-115, 18), rel(-115, 19, 30), "green", "Fitness", {
      recurrence: "Every week on Thu",
      reminders: [{ amount: 30, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("j18b", "Friday Wrap-up", rel(-114, 16), rel(-114, 17), "blue", "Work", {
      recurrence: "Every week on Fri",
      description: "Review weekly accomplishments and set Monday priorities",
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "j19",
      "Happy Hour",
      rel(-114, 17),
      rel(-114, 19),
      "purple",
      "Personal",
      {
        recurrence: "Every week on Fri",
        description: "Drinks with the team at the usual spot",
        location: "The Draft House",
        reminders: [{ amount: 30, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("j20", "Brunch", rel(-113, 11), rel(-113, 13), "orange", "Family", {
      description: "Monthly family brunch — Mom's picking the place",
      location: "Café Lola",
      reminders: [{ amount: 1, unit: "hours" }],
      calendarEmail: "me@vmnog.com",
    }),

    // Week -16 (days -112 to -106)
    ev(
      "j21",
      "Team Standup",
      rel(-111, 9),
      rel(-111, 9, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Mon",
        description: "Daily sync — blockers, progress, priorities",
        reminders: [{ amount: 5, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
        status: "busy",
      },
    ),
    ev(
      "j22",
      "Quarterly Review Prep",
      rel(-111, 11),
      rel(-111, 12, 30),
      "blue",
      "Work",
      {
        description: "Prepare slides and metrics for Q4 review presentation",
        reminders: [{ amount: 15, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "j23",
      "Client Demo",
      rel(-110, 14),
      rel(-110, 15),
      "red",
      "me@vmnog.com",
      {
        description: "Demo new dashboard features to Acme Corp stakeholders",
        reminders: [
          { amount: 30, unit: "minutes" },
          { amount: 1, unit: "hours" },
        ],
        calendarEmail: "me@vmnog.com",
        status: "busy",
      },
    ),
    ev(
      "j24",
      "Open Source Contrib",
      rel(-109, 13),
      rel(-109, 14),
      "yellow",
      "Side Projects",
      { calendarEmail: "me@vmnog.com" },
    ),
    ev(
      "j24b",
      "1:1 with Manager",
      rel(-109, 15),
      rel(-109, 15, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Wed",
        description: "Quarterly review prep discussion",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("j25", "Retro", rel(-108, 14), rel(-108, 15), "blue", "Work", {
      recurrence: "Every 2 weeks on Thu",
      description: "Sprint 2 retrospective — what went well, what to improve",
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("j26", "Gym", rel(-108, 18), rel(-108, 19, 30), "green", "Fitness", {
      recurrence: "Every week on Thu",
      description: "Full body circuit training",
      reminders: [{ amount: 30, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("j26b", "Friday Wrap-up", rel(-107, 16), rel(-107, 17), "blue", "Work", {
      recurrence: "Every week on Fri",
      description: "Review weekly accomplishments and set Monday priorities",
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "j26c",
      "Happy Hour",
      rel(-107, 17),
      rel(-107, 19),
      "purple",
      "Personal",
      {
        recurrence: "Every week on Fri",
        location: "The Draft House",
        reminders: [{ amount: 30, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "j27",
      "Month-End Report",
      rel(-107, 10),
      rel(-107, 11, 30),
      "red",
      "me@vmnog.com",
      {
        description: "Compile January metrics and submit to finance",
        reminders: [{ amount: 1, unit: "hours" }],
        calendarEmail: "me@vmnog.com",
      },
    ),

    // ── 15 to 12 weeks ago ──

    // Week -15 (days -105 to -99)
    ev(
      "f01",
      "Team Standup",
      rel(-104, 9),
      rel(-104, 9, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Mon",
        description: "Daily sync — blockers, progress, priorities",
        reminders: [{ amount: 5, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
        status: "busy",
      },
    ),
    ev("f02", "Q1 Kickoff", rel(-104, 10), rel(-104, 12), "blue", "Work", {
      description: "Company-wide Q1 kickoff. CEO presenting vision and OKRs.",
      location: "Conference Room A",
      reminders: [
        { amount: 30, unit: "minutes" },
        { amount: 1, unit: "days" },
      ],
      calendarEmail: "me@vmnog.com",
      status: "busy",
      timezone: "GMT-3 Sao Paulo",
    }),
    ev(
      "f03",
      "Lunch with Sarah",
      rel(-103, 12),
      rel(-103, 13),
      "purple",
      "Personal",
      {
        description: "She wants to chat about switching jobs — bring advice",
        location: "Sweetgreen",
        reminders: [{ amount: 15, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "f03b",
      "1:1 with Manager",
      rel(-102, 15),
      rel(-102, 15, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Wed",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "f04",
      "Design Review",
      rel(-102, 14),
      rel(-102, 15, 30),
      "yellow",
      "Side Projects",
      {
        description:
          "Review component library updates — new button variants and color tokens",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("f05", "Workshop", rel(-101, 9), rel(-101, 12), "blue", "Work", {
      description:
        "React Patterns Workshop — advanced hooks, composition, and performance",
      location: "Main Hall",
      reminders: [{ amount: 1, unit: "hours" }],
      calendarEmail: "me@vmnog.com",
      status: "busy",
      visibility: "public",
    }),
    ev("f06", "Gym", rel(-101, 18), rel(-101, 19, 30), "green", "Fitness", {
      recurrence: "Every week on Thu",
      reminders: [{ amount: 30, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("f06b", "Friday Wrap-up", rel(-100, 16), rel(-100, 17), "blue", "Work", {
      recurrence: "Every week on Fri",
      description: "Review weekly accomplishments and set Monday priorities",
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "f06c",
      "Happy Hour",
      rel(-100, 17),
      rel(-100, 19),
      "purple",
      "Personal",
      {
        recurrence: "Every week on Fri",
        location: "The Brewery",
        reminders: [{ amount: 30, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "f07",
      "Family Dinner",
      rel(-100, 12),
      rel(-100, 13, 30),
      "orange",
      "Family",
      {
        description: "Dad's birthday celebration dinner",
        location: "Olive Garden",
        reminders: [
          { amount: 1, unit: "hours" },
          { amount: 1, unit: "days" },
        ],
        calendarEmail: "me@vmnog.com",
      },
    ),

    // Week -14 (days -98 to -92)
    ev(
      "f08",
      "Team Standup",
      rel(-97, 9),
      rel(-97, 9, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Mon",
        description: "Daily sync — blockers, progress, priorities",
        reminders: [{ amount: 5, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
        status: "busy",
      },
    ),
    ev(
      "f09",
      "Project Planning",
      rel(-97, 10),
      rel(-97, 11, 30),
      "blue",
      "Work",
      {
        recurrence: "Every 2 weeks on Mon",
        description:
          "Scope new auth service project — timeline, resources, dependencies",
        reminders: [{ amount: 15, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "f09b",
      "Budget Review",
      rel(-97, 10, 30),
      rel(-97, 11),
      "red",
      "me@vmnog.com",
      {
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "f10",
      "Client Call",
      rel(-96, 14, 30),
      rel(-96, 15, 30),
      "red",
      "me@vmnog.com",
      {
        description:
          "Monthly sync with Acme Corp — review integration progress and blockers",
        reminders: [
          { amount: 10, unit: "minutes" },
          { amount: 1, unit: "hours" },
        ],
        calendarEmail: "me@vmnog.com",
        timezone: "GMT-3 Sao Paulo",
        status: "busy",
      },
    ),
    ev("f10b", "Infra Sync", rel(-96, 14), rel(-96, 15), "blue", "Work", {
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "f11",
      "1:1 with Manager",
      rel(-95, 15),
      rel(-95, 15, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Wed",
        description: "Mid-quarter check-in, discuss promotion timeline",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "f11b",
      "Security Review",
      rel(-95, 14),
      rel(-95, 15, 30),
      "blue",
      "Work",
      {
        description: "Review auth flow security audit findings",
        reminders: [{ amount: 15, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("f12", "Sprint Review", rel(-94, 10), rel(-94, 11), "blue", "Work", {
      recurrence: "Every 2 weeks on Thu",
      description: "Demo sprint 3 deliverables to stakeholders",
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "f12b",
      "Perf Monitoring Setup",
      rel(-94, 10, 30),
      rel(-94, 11, 30),
      "yellow",
      "Side Projects",
      {
        description: "Set up Lighthouse CI for the component library",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("f12c", "Gym", rel(-94, 18), rel(-94, 19, 30), "green", "Fitness", {
      recurrence: "Every week on Thu",
      reminders: [{ amount: 30, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("f12d", "Friday Wrap-up", rel(-93, 16), rel(-93, 17), "blue", "Work", {
      recurrence: "Every week on Fri",
      description: "Review weekly accomplishments and set Monday priorities",
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("f12e", "Happy Hour", rel(-93, 17), rel(-93, 19), "purple", "Personal", {
      recurrence: "Every week on Fri",
      location: "Wine Bar",
      reminders: [{ amount: 30, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "f13",
      "Valentine's Dinner",
      rel(-92, 19),
      rel(-92, 21),
      "purple",
      "Personal",
      {
        description:
          "Reservation at that Italian place — don't forget flowers!",
        location: "Trattoria Roma",
        reminders: [
          { amount: 2, unit: "hours" },
          { amount: 1, unit: "days" },
        ],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "f14",
      "Valentine's Day",
      onDate(2026, 2, 14, 0),
      onDate(2026, 2, 14, 0),
      "green",
      "Holidays in Brazil",
      { isAllDay: true, calendarEmail: "me@vmnog.com" },
    ),

    // Week -13 (days -91 to -85)
    ev(
      "f15",
      "Team Standup",
      rel(-90, 9),
      rel(-90, 9, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Mon",
        description: "Daily sync — blockers, progress, priorities",
        reminders: [{ amount: 5, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
        status: "busy",
      },
    ),
    ev("f16", "Roadmap Sync", rel(-90, 11), rel(-90, 12), "blue", "Work", {
      description:
        "Align engineering and product on H1 priorities and delivery dates",
      reminders: [{ amount: 15, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "f17",
      "Lunch with Alex",
      rel(-89, 12),
      rel(-89, 13),
      "purple",
      "Personal",
      {
        description:
          "He's launching his startup next month — wants feedback on the pitch",
        location: "Chipotle",
        reminders: [{ amount: 15, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "f18",
      "Architecture Deep Dive",
      rel(-88, 13),
      rel(-88, 15),
      "blue",
      "Work",
      {
        description:
          "Deep dive into event-driven architecture for the notifications service",
        reminders: [{ amount: 15, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("f19", "Gym", rel(-87, 18), rel(-87, 19, 30), "green", "Fitness", {
      recurrence: "Every week on Thu",
      description: "HIIT class + core work",
      reminders: [{ amount: 30, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("f19b", "Friday Wrap-up", rel(-86, 16), rel(-86, 17), "blue", "Work", {
      recurrence: "Every week on Fri",
      description: "Review weekly accomplishments and set Monday priorities",
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("f20", "Happy Hour", rel(-86, 17), rel(-86, 19), "purple", "Personal", {
      recurrence: "Every week on Fri",
      description: "Celebrating Jake's promotion",
      location: "Rooftop Bar",
      reminders: [{ amount: 30, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "f21",
      "Presidents' Day",
      onDate(2026, 2, 16, 0),
      onDate(2026, 2, 16, 0),
      "green",
      "Holidays in Brazil",
      { isAllDay: true, calendarEmail: "me@vmnog.com" },
    ),
    ev("f22", "Brunch", rel(-85, 11), rel(-85, 13), "orange", "Family", {
      description: "Sister's visiting from out of town",
      location: "The Breakfast Club",
      reminders: [{ amount: 1, unit: "hours" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "f23",
      "Blog Post Draft",
      rel(-88, 10),
      rel(-88, 11),
      "yellow",
      "Side Projects",
      {
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),

    // Week -12 (days -84 to -78) — busy week with overlaps
    ev(
      "f24",
      "Team Standup",
      rel(-83, 9),
      rel(-83, 9, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Mon",
        description: "Daily sync — blockers, progress, priorities",
        reminders: [{ amount: 5, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
        status: "busy",
      },
    ),
    ev(
      "f25",
      "Sprint Planning",
      rel(-83, 10),
      rel(-83, 11, 30),
      "blue",
      "Work",
      {
        recurrence: "Every 2 weeks on Mon",
        description: "Plan sprint 4 — finalize scope and capacity",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "f25b",
      "Investor Update Call",
      rel(-83, 10, 30),
      rel(-83, 11),
      "red",
      "me@vmnog.com",
      {
        description: "Quick sync with CFO before investor email goes out",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
        status: "busy",
      },
    ),
    ev(
      "f26",
      "UX Research Debrief",
      rel(-82, 14),
      rel(-82, 15),
      "blue",
      "Work",
      {
        description:
          "Go over user interview findings from last week's research sessions",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "f26b",
      "Design Critique",
      rel(-82, 14, 30),
      rel(-82, 15, 30),
      "yellow",
      "Side Projects",
      {
        description: "Review new onboarding flow wireframes with design team",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "f26c",
      "Candidate Interview",
      rel(-82, 15),
      rel(-82, 16),
      "red",
      "me@vmnog.com",
      {
        description: "Senior frontend engineer — system design round",
        reminders: [{ amount: 15, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
        status: "busy",
      },
    ),
    ev(
      "f27",
      "Coffee Chat",
      rel(-81, 9, 30),
      rel(-81, 10),
      "purple",
      "Personal",
      { location: "Starbucks Reserve", calendarEmail: "me@vmnog.com" },
    ),
    ev("f27b", "Platform Sync", rel(-81, 9), rel(-81, 10, 30), "blue", "Work", {
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("f27c", "API Review", rel(-81, 10), rel(-81, 11), "blue", "Work", {
      description: "Review REST→GraphQL migration proposal",
      reminders: [{ amount: 5, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "f27d",
      "Hiring Debrief",
      rel(-81, 14),
      rel(-81, 15),
      "red",
      "me@vmnog.com",
      {
        description: "Debrief on yesterday's candidate — collect scorecards",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "f27e",
      "1:1 with Manager",
      rel(-81, 15),
      rel(-81, 15, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Wed",
        description: "Weekly sync — promotion timeline update",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("f28", "Demo Day", rel(-80, 14), rel(-80, 16), "red", "me@vmnog.com", {
      description: "Present Q1 progress to leadership — bring laptop charger",
      location: "Auditorium",
      reminders: [
        { amount: 1, unit: "hours" },
        { amount: 1, unit: "days" },
      ],
      calendarEmail: "me@vmnog.com",
      status: "busy",
      visibility: "public",
    }),
    ev(
      "f28b",
      "Stakeholder Check-in",
      rel(-80, 14, 30),
      rel(-80, 15, 30),
      "blue",
      "Work",
      {
        description: "Quick sync with product on demo feedback",
        reminders: [{ amount: 5, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "f28c",
      "Side Project Standup",
      rel(-80, 15),
      rel(-80, 15, 30),
      "yellow",
      "Side Projects",
      {
        reminders: [{ amount: 5, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("f29", "Retro", rel(-79, 14), rel(-79, 15), "blue", "Work", {
      recurrence: "Every 2 weeks on Fri",
      description: "Sprint 3 retro — focus on deployment pipeline improvements",
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "f29b",
      "Tech Talk",
      rel(-79, 14, 30),
      rel(-79, 15, 30),
      "yellow",
      "Side Projects",
      {
        description: "Internal talk on building accessible UI components",
        reminders: [{ amount: 15, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("f29c", "Friday Wrap-up", rel(-79, 16), rel(-79, 17), "blue", "Work", {
      recurrence: "Every week on Fri",
      description: "Review weekly accomplishments and set Monday priorities",
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("f29d", "Happy Hour", rel(-79, 17), rel(-79, 19), "purple", "Personal", {
      recurrence: "Every week on Fri",
      description: "End-of-sprint celebration",
      location: "The Draft House",
      reminders: [{ amount: 30, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("f30", "Gym", rel(-80, 18), rel(-80, 19, 30), "green", "Fitness", {
      recurrence: "Every week on Thu",
      description: "Yoga + meditation session",
      reminders: [{ amount: 30, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),

    // ── 11 to 7 weeks ago ──

    // Week -11 (days -77 to -71)
    ev(
      "m01",
      "Team Standup",
      rel(-76, 9),
      rel(-76, 9, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Mon",
        description: "Daily sync — blockers, progress, priorities",
        reminders: [{ amount: 5, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "m02",
      "March Priorities",
      rel(-76, 10),
      rel(-76, 11, 30),
      "blue",
      "Work",
      {
        description:
          "Set engineering priorities for March — focus on performance and reliability",
        reminders: [{ amount: 15, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "m03",
      "Vendor Meeting",
      rel(-75, 13),
      rel(-75, 14),
      "red",
      "me@vmnog.com",
      {
        reminders: [{ amount: 15, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "m03b",
      "1:1 with Manager",
      rel(-74, 15),
      rel(-74, 15, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Wed",
        description: "Q2 role expectations discussion",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "m04",
      "Lunch with Sarah",
      rel(-74, 12),
      rel(-74, 13),
      "purple",
      "Personal",
      {
        description: "She got the new job! Celebration lunch",
        location: "Sushi Nakazawa",
        reminders: [{ amount: 15, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("m05", "Workshop: Testing", rel(-73, 9), rel(-73, 12), "blue", "Work", {
      description:
        "Testing Best Practices — unit tests, integration tests, E2E with Playwright",
      location: "Room 4B",
      reminders: [{ amount: 30, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("m06", "Gym", rel(-73, 18), rel(-73, 19, 30), "green", "Fitness", {
      recurrence: "Every week on Thu",
      reminders: [{ amount: 30, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("m06b", "Friday Wrap-up", rel(-72, 16), rel(-72, 17), "blue", "Work", {
      recurrence: "Every week on Fri",
      description: "Review weekly accomplishments and set Monday priorities",
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("m06c", "Happy Hour", rel(-72, 17), rel(-72, 19), "purple", "Personal", {
      recurrence: "Every week on Fri",
      location: "The Draft House",
      reminders: [{ amount: 30, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("m07", "Game Night", rel(-72, 19), rel(-72, 22), "orange", "Family", {
      description:
        "Board games at our place — picking up snacks on the way home",
      reminders: [{ amount: 2, unit: "hours" }],
      calendarEmail: "me@vmnog.com",
    }),

    // Week -10 (days -70 to -64) — triple-booked Tuesday
    ev(
      "m08",
      "Team Standup",
      rel(-69, 9),
      rel(-69, 9, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Mon",
        description: "Daily sync — blockers, progress, priorities",
        reminders: [{ amount: 5, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("m09", "OKR Review", rel(-69, 10), rel(-69, 11, 30), "blue", "Work", {
      description: "Mid-quarter OKR progress review with leadership",
      reminders: [{ amount: 15, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "m09b",
      "Eng All-Hands",
      rel(-69, 10),
      rel(-69, 11),
      "red",
      "me@vmnog.com",
      {
        description:
          "Engineering org all-hands — CTO presenting new tech strategy",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "m10",
      "Client Call",
      rel(-68, 14),
      rel(-68, 15),
      "red",
      "me@vmnog.com",
      {
        description:
          "Acme Corp escalation — discuss SLA concerns and resolution plan",
        reminders: [
          { amount: 10, unit: "minutes" },
          { amount: 1, unit: "hours" },
        ],
        calendarEmail: "me@vmnog.com",
        timezone: "GMT-3 Sao Paulo",
      },
    ),
    ev(
      "m10b",
      "Sales Enablement",
      rel(-68, 13, 30),
      rel(-68, 14, 30),
      "orange",
      "Family",
      {
        reminders: [{ amount: 15, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "m10c",
      "Database Migration Plan",
      rel(-68, 14),
      rel(-68, 16),
      "blue",
      "Work",
      {
        description: "Plan PostgreSQL → CockroachDB migration with infra team",
        reminders: [{ amount: 15, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "m11",
      "1:1 with Manager",
      rel(-67, 15),
      rel(-67, 15, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Wed",
        description: "Discuss tech lead role transition and team restructuring",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "m11b",
      "Incident Post-mortem",
      rel(-67, 14, 30),
      rel(-67, 15, 30),
      "red",
      "me@vmnog.com",
      {
        description: "Review Tuesday's production outage — identify root cause",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
        status: "busy",
      },
    ),
    ev(
      "m11c",
      "Frontend Guild",
      rel(-67, 15),
      rel(-67, 16),
      "yellow",
      "Side Projects",
      {
        description: "Monthly frontend guild — discuss React 19 migration plan",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "m12",
      "Design Review",
      rel(-66, 11),
      rel(-66, 12, 30),
      "yellow",
      "Side Projects",
      {
        description:
          "Review new dark mode color palette for the component library",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("m12b", "Gym", rel(-66, 18), rel(-66, 19, 30), "green", "Fitness", {
      recurrence: "Every week on Thu",
      reminders: [{ amount: 30, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("m13", "Team Offsite", rel(-66, 0), rel(-65, 0), "blue", "Work", {
      isAllDay: true,
      description: "Annual team offsite — team building and strategy sessions",
      calendarEmail: "me@vmnog.com",
    }),
    ev("m13b", "Friday Wrap-up", rel(-65, 16), rel(-65, 17), "blue", "Work", {
      recurrence: "Every week on Fri",
      description: "Review weekly accomplishments and set Monday priorities",
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("m14", "Happy Hour", rel(-65, 17), rel(-65, 19), "purple", "Personal", {
      recurrence: "Every week on Fri",
      description: "Post-offsite drinks to unwind",
      location: "The Pub",
      reminders: [{ amount: 30, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),

    // Week -9 (days -63 to -57)
    ev(
      "m15",
      "Team Standup",
      rel(-62, 9),
      rel(-62, 9, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Mon",
        description: "Daily sync — blockers, progress, priorities",
        reminders: [{ amount: 5, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "m16",
      "Sprint Planning",
      rel(-62, 10),
      rel(-62, 11, 30),
      "blue",
      "Work",
      {
        recurrence: "Every 2 weeks on Mon",
        description: "Sprint 5 planning — final sprint before Q1 wrap",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "m17",
      "Lunch with Alex",
      rel(-61, 12),
      rel(-61, 13),
      "purple",
      "Personal",
      {
        description: "Trying the new Thai place he keeps recommending",
        location: "Thai Basil",
        reminders: [{ amount: 15, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "m17b",
      "1:1 with Manager",
      rel(-60, 15),
      rel(-60, 15, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Wed",
        description: "Annual review prep discussion",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "m18",
      "Perf Review Prep",
      rel(-60, 14),
      rel(-60, 15, 30),
      "red",
      "me@vmnog.com",
      {
        description:
          "Write self-review and gather peer feedback for annual review cycle",
        reminders: [{ amount: 30, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "m19",
      "Side Project Sync",
      rel(-59, 13),
      rel(-59, 14),
      "yellow",
      "Side Projects",
      {
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("m20", "Gym", rel(-59, 18), rel(-59, 19, 30), "green", "Fitness", {
      recurrence: "Every week on Thu",
      description: "Spin class + abs",
      reminders: [{ amount: 30, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("m20b", "Friday Wrap-up", rel(-58, 16), rel(-58, 17), "blue", "Work", {
      recurrence: "Every week on Fri",
      description: "Review weekly accomplishments and set Monday priorities",
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("m20c", "Happy Hour", rel(-58, 17), rel(-58, 19), "purple", "Personal", {
      recurrence: "Every week on Fri",
      location: "Irish Pub",
      reminders: [{ amount: 30, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "m21",
      "St. Patrick's Day",
      onDate(2026, 3, 17, 0),
      onDate(2026, 3, 17, 0),
      "green",
      "Holidays in Brazil",
      { isAllDay: true, calendarEmail: "me@vmnog.com" },
    ),

    // Week -8 (days -56 to -50)
    ev(
      "m22",
      "Team Standup",
      rel(-55, 9),
      rel(-55, 9, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Mon",
        description: "Daily sync — blockers, progress, priorities",
        reminders: [{ amount: 5, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("m23", "Q1 Wrap-up", rel(-55, 10), rel(-55, 12), "blue", "Work", {
      description:
        "Final Q1 summary meeting — present achievements, lessons learned, and Q2 outlook",
      reminders: [
        { amount: 15, unit: "minutes" },
        { amount: 1, unit: "days" },
      ],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "m24",
      "Client Demo",
      rel(-54, 14),
      rel(-54, 15, 30),
      "red",
      "me@vmnog.com",
      {
        description: "Final demo of the new reporting dashboard to Acme Corp",
        reminders: [{ amount: 30, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
        status: "busy",
      },
    ),
    ev(
      "m24b",
      "1:1 with Manager",
      rel(-53, 15),
      rel(-53, 15, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Wed",
        description: "Q1 wrap-up and Q2 expectations",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "m25",
      "Architecture Review",
      rel(-53, 13),
      rel(-53, 14, 30),
      "blue",
      "Work",
      {
        description: "Review database sharding proposal and caching strategy",
        reminders: [{ amount: 15, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("m26", "Sprint Review", rel(-52, 10), rel(-52, 11), "blue", "Work", {
      recurrence: "Every 2 weeks on Thu",
      description: "Demo sprint 5 features — focus on performance improvements",
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("m27", "Retro", rel(-51, 14), rel(-51, 15), "blue", "Work", {
      recurrence: "Every 2 weeks on Fri",
      description:
        "Q1 final retro — what worked, what didn't, action items for Q2",
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("m27b", "Friday Wrap-up", rel(-51, 16), rel(-51, 17), "blue", "Work", {
      recurrence: "Every week on Fri",
      description: "Review weekly accomplishments and set Monday priorities",
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("m27c", "Happy Hour", rel(-51, 17), rel(-51, 19), "purple", "Personal", {
      recurrence: "Every week on Fri",
      description: "End-of-quarter celebration drinks",
      location: "The Rooftop",
      reminders: [{ amount: 30, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("m28", "Gym", rel(-52, 18), rel(-52, 19, 30), "green", "Fitness", {
      recurrence: "Every week on Thu",
      description: "Boxing class + cool down",
      reminders: [{ amount: 30, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "m29",
      "Birthday Party",
      rel(-50, 15),
      rel(-50, 18),
      "orange",
      "Family",
      {
        description: "Nephew's 5th birthday — bring the Lego set we got him",
        location: "Fun Zone",
        reminders: [
          { amount: 2, unit: "hours" },
          { amount: 1, unit: "days" },
        ],
        calendarEmail: "me@vmnog.com",
      },
    ),

    // Week -7 (days -49 to -43)
    ev(
      "m30",
      "Team Standup",
      rel(-48, 9),
      rel(-48, 9, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Mon",
        description: "Daily sync — blockers, progress, priorities",
        reminders: [{ amount: 5, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("m31", "Q2 Planning", rel(-48, 10), rel(-48, 12), "blue", "Work", {
      description:
        "Kick off Q2 planning — define themes, allocate resources, set milestones",
      reminders: [
        { amount: 15, unit: "minutes" },
        { amount: 1, unit: "days" },
      ],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "m31b",
      "1:1 with Manager",
      rel(-46, 15),
      rel(-46, 15, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Wed",
        description: "Q2 kickoff goals alignment",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("m31c", "Gym", rel(-45, 18), rel(-45, 19, 30), "green", "Fitness", {
      recurrence: "Every week on Thu",
      reminders: [{ amount: 30, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("m31d", "Friday Wrap-up", rel(-44, 16), rel(-44, 17), "blue", "Work", {
      recurrence: "Every week on Fri",
      description: "Review weekly accomplishments and set Monday priorities",
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "m32",
      "Month-End Report",
      rel(-47, 10),
      rel(-47, 11, 30),
      "red",
      "me@vmnog.com",
      {
        description:
          "Compile March metrics, budget reconciliation, and Q1 summary for finance",
        reminders: [{ amount: 1, unit: "hours" }],
        calendarEmail: "me@vmnog.com",
      },
    ),

    // ── Month-view test events (all-day, spanning week boundaries) ──

    // Multi-day all-day event crossing a weekend boundary: Thu (day -52) – Mon (day -48)
    ev("mv01", "Q1 Wrap Week", rel(-52, 0), rel(-48, 0), "purple", "Personal", {
      isAllDay: true,
      description:
        "End-of-quarter wrap-up period spanning the weekend — cross-week boundary test",
      calendarEmail: "me@vmnog.com",
    }),

    // Single-day all-day event
    ev(
      "mv02",
      "Company Holiday",
      onDate(2026, 3, 17, 0),
      onDate(2026, 3, 17, 0),
      "green",
      "Holidays in Brazil",
      {
        isAllDay: true,
        description: "St. Patrick's Day — office closed",
        calendarEmail: "me@vmnog.com",
      },
    ),

    // 3-day all-day event within a single week: Tue (day -68) – Thu (day -66)
    ev(
      "mv03",
      "Offsite Prep Days",
      rel(-68, 0),
      rel(-66, 0),
      "orange",
      "Work",
      {
        isAllDay: true,
        description:
          "Three-day preparation window for the team offsite — within-week all-day test",
        calendarEmail: "me@vmnog.com",
      },
    ),

    // ── Dense days for month-view overflow testing ──

    // Day -69 (Mon) — stack 10+ events to trigger "+N more" at all viewport sizes
    ev(
      "dense01",
      "Morning Standup",
      rel(-69, 8),
      rel(-69, 8, 30),
      "red",
      "me@vmnog.com",
    ),
    ev(
      "dense02",
      "Backlog Grooming",
      rel(-69, 8, 30),
      rel(-69, 9, 30),
      "blue",
      "Work",
    ),
    ev(
      "dense03",
      "Design Sync",
      rel(-69, 10),
      rel(-69, 10, 30),
      "purple",
      "Personal",
    ),
    ev(
      "dense04",
      "Lunch with Sarah",
      rel(-69, 12),
      rel(-69, 13),
      "orange",
      "Family",
    ),
    ev(
      "dense05",
      "Code Review Session",
      rel(-69, 14),
      rel(-69, 15),
      "blue",
      "Work",
    ),
    ev(
      "dense06",
      "Product Roadmap",
      rel(-69, 15),
      rel(-69, 16),
      "yellow",
      "Side Projects",
    ),
    ev(
      "dense07",
      "Gym — Upper Body",
      rel(-69, 17),
      rel(-69, 18),
      "green",
      "Fitness",
    ),
    ev(
      "dense08",
      "Dinner Plans",
      rel(-69, 19),
      rel(-69, 20, 30),
      "orange",
      "Family",
    ),
    ev(
      "dense09",
      "Side Project Work",
      rel(-69, 20, 30),
      rel(-69, 22),
      "yellow",
      "Side Projects",
    ),

    // Day -73 (Thu) — stack 8+ events
    ev("dense10", "Sprint Review", rel(-73, 9), rel(-73, 10), "blue", "Work"),
    ev("dense11", "Retrospective", rel(-73, 10), rel(-73, 11), "blue", "Work"),
    ev(
      "dense12",
      "Lunch Run",
      rel(-73, 12),
      rel(-73, 12, 45),
      "green",
      "Fitness",
    ),
    ev(
      "dense13",
      "Interview — Frontend",
      rel(-73, 14),
      rel(-73, 15),
      "red",
      "me@vmnog.com",
    ),
    ev(
      "dense14",
      "Mentoring Session",
      rel(-73, 16),
      rel(-73, 16, 30),
      "purple",
      "Personal",
    ),

    // Day -66 (Thu) — add more to create overflow
    ev(
      "dense15",
      "Quarterly Business Review",
      rel(-66, 9),
      rel(-66, 10, 30),
      "red",
      "me@vmnog.com",
    ),
    ev(
      "dense16",
      "Investor Update Prep",
      rel(-66, 11),
      rel(-66, 12),
      "blue",
      "Work",
    ),
    ev(
      "dense17",
      "Lunch & Learn",
      rel(-66, 12),
      rel(-66, 13),
      "yellow",
      "Side Projects",
    ),
    ev(
      "dense18",
      "Platform Migration",
      rel(-66, 14),
      rel(-66, 15, 30),
      "blue",
      "Work",
    ),
    ev(
      "dense19",
      "Team Happy Hour",
      rel(-66, 17),
      rel(-66, 18, 30),
      "purple",
      "Personal",
    ),

    // Week 3 spanning event: Tue (day -61) – Thu (day -59)
    ev(
      "mv04",
      "St. Patrick's Day",
      onDate(2026, 3, 17, 0),
      onDate(2026, 3, 17, 0),
      "green",
      "Holidays in Brazil",
      {
        isAllDay: true,
        calendarEmail: "me@vmnog.com",
      },
    ),

    // Day -62 (Mon) — add more events
    ev("dense20", "Weekly Planning", rel(-62, 9), rel(-62, 10), "blue", "Work"),
    ev(
      "dense21",
      "1:1 with Director",
      rel(-62, 11),
      rel(-62, 11, 45),
      "red",
      "me@vmnog.com",
    ),
    ev(
      "dense22",
      "Cross-team Sync",
      rel(-62, 14),
      rel(-62, 15),
      "blue",
      "Work",
    ),
    ev(
      "dense23",
      "Gym — Cardio",
      rel(-62, 17, 30),
      rel(-62, 18, 30),
      "green",
      "Fitness",
    ),
    ev(
      "dense24",
      "Book Club",
      rel(-62, 19),
      rel(-62, 20, 30),
      "purple",
      "Personal",
    ),
    ev(
      "dense25",
      "Meal Prep",
      rel(-62, 20, 30),
      rel(-62, 21, 30),
      "orange",
      "Family",
    ),

    // ── Historical Sprint events (for search testing) ──
    ev(
      "h01",
      "Sprint Kickoff — Q2 Platform Migration Initiative",
      rel(-706, 9),
      rel(-706, 10, 30),
      "blue",
      "Work",
      {
        description: "Q2 2024 sprint kickoff — defining team velocity baseline",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "h02",
      "Sprint Retrospective — Process Improvements and Velocity Analysis",
      rel(-429, 14),
      rel(-429, 15),
      "blue",
      "Work",
      {
        description: "Q1 2025 sprint retro — process improvements discussion",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),

    // ── Extra Sprint events on day -83 (Mon) ──
    ev(
      "f25c",
      "Sprint Demo — Presenting New Dashboard Features to Stakeholders",
      rel(-83, 14),
      rel(-83, 15),
      "red",
      "me@vmnog.com",
      {
        description: "Demo sprint 4 deliverables to product team",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "f25d",
      "Sprint Retro",
      rel(-83, 15, 30),
      rel(-83, 16, 30),
      "yellow",
      "Side Projects",
      {
        description: "Sprint 4 retrospective — team feedback session",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),

    // ── Sprint events on days -60 (Wed) and -59 (Thu) ──
    ev(
      "m17c",
      "Sprint Standup",
      rel(-60, 9, 30),
      rel(-60, 10),
      "red",
      "me@vmnog.com",
      {
        description: "Mid-sprint sync — check blockers and progress",
        reminders: [{ amount: 5, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "m19b",
      "Sprint Grooming — Backlog Refinement and Story Estimation Session",
      rel(-59, 10),
      rel(-59, 11),
      "blue",
      "Work",
      {
        description:
          "Backlog grooming for next sprint — estimate and prioritize stories",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),

    // ── Recent weeks, this week and next week ──

    // Labor Day (Brazil national holiday, fixed date)
    ev(
      "may01",
      "Labor Day",
      onDate(2026, 5, 1, 0),
      onDate(2026, 5, 1, 0),
      "green",
      "Holidays in Brazil",
      {
        isAllDay: true,
        description: "Dia do Trabalhador — national holiday",
        calendarEmail: "me@vmnog.com",
      },
    ),

    // Week -2 (days -14 to -8) — offsite week
    ev(
      "may02",
      "Company Offsite",
      rel(-13, 0),
      rel(-11, 0),
      "purple",
      "Personal",
      {
        isAllDay: true,
        description:
          "Annual leadership offsite — strategy, planning, team building",
        location: "Catskills Retreat Center",
        reminders: [{ amount: 1, unit: "days" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "may03",
      "Offsite Travel Day",
      rel(-14, 13),
      rel(-14, 18),
      "blue",
      "Work",
      {
        description: "Drive up to Catskills — leaving early to beat traffic",
        location: "I-87 N",
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "may04",
      "Offsite Welcome Dinner",
      rel(-14, 19),
      rel(-14, 21, 30),
      "orange",
      "Family",
      {
        description: "Group dinner kicking off the offsite",
        location: "Catskills Retreat Center",
        reminders: [{ amount: 30, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("may05", "Gym", rel(-10, 18), rel(-10, 19, 30), "green", "Fitness", {
      recurrence: "Every week on Thu",
      reminders: [{ amount: 30, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("may06", "Friday Wrap-up", rel(-9, 16), rel(-9, 17), "blue", "Work", {
      recurrence: "Every week on Fri",
      description: "Review weekly accomplishments and set Monday priorities",
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "may07",
      "Happy Hour",
      rel(-9, 17, 30),
      rel(-9, 19, 30),
      "purple",
      "Personal",
      {
        recurrence: "Every week on Fri",
        location: "The Draft House",
        reminders: [{ amount: 30, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),

    // Week -1 (days -7 to -1) — Mother's Day week
    ev(
      "may08",
      "Mother's Day",
      onDate(2026, 5, 10, 0),
      onDate(2026, 5, 10, 0),
      "green",
      "Holidays in Brazil",
      {
        isAllDay: true,
        description: "Dia das Mães — call mom and send flowers",
        reminders: [{ amount: 1, unit: "days" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "may09",
      "Brunch with Mom",
      rel(-7, 11),
      rel(-7, 13),
      "orange",
      "Family",
      {
        description: "Mother's Day brunch — reservation under Nogueira",
        location: "Balthazar",
        reminders: [{ amount: 1, unit: "hours" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "may10",
      "Team Standup",
      rel(-6, 9),
      rel(-6, 9, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Mon",
        description: "Daily sync — blockers, progress, priorities",
        reminders: [{ amount: 5, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
        status: "busy",
      },
    ),
    ev(
      "may11",
      "Post-Offsite Recap",
      rel(-6, 10),
      rel(-6, 11, 30),
      "blue",
      "Work",
      {
        description:
          "Debrief offsite outcomes — decisions, action items, next steps",
        reminders: [{ amount: 15, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "may12",
      "Dentist",
      rel(-5, 8, 30),
      rel(-5, 9, 30),
      "red",
      "me@vmnog.com",
      {
        description: "6-month cleaning",
        location: "Dr. Park, 5th Ave",
        reminders: [
          { amount: 1, unit: "hours" },
          { amount: 1, unit: "days" },
        ],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "may13",
      "Lunch with Alex",
      rel(-5, 12, 30),
      rel(-5, 13, 30),
      "purple",
      "Personal",
      {
        location: "Ichiran Ramen",
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "may14",
      "1:1 with Manager",
      rel(-4, 15),
      rel(-4, 15, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Wed",
        description: "Weekly check-in — career growth and priorities",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "may15",
      "Calendar Demo to Stakeholders",
      rel(-3, 11),
      rel(-3, 12),
      "yellow",
      "Side Projects",
      {
        description:
          "Demo CalendarCN month view to design and product stakeholders",
        location: "Zoom",
        reminders: [{ amount: 30, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("may16", "Gym", rel(-3, 18), rel(-3, 19, 30), "green", "Fitness", {
      recurrence: "Every week on Thu",
      reminders: [{ amount: 30, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("may17", "Friday Wrap-up", rel(-2, 16), rel(-2, 17), "blue", "Work", {
      recurrence: "Every week on Fri",
      description: "Review weekly accomplishments and set Monday priorities",
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "may18",
      "Movie Night",
      rel(-2, 20),
      rel(-2, 22, 30),
      "orange",
      "Family",
      {
        description: "Picking up snacks on the way home",
        location: "AMC Lincoln Square",
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "may19",
      "Saturday Long Run",
      rel(-1, 8),
      rel(-1, 10),
      "green",
      "Fitness",
      {
        description: "12 miles — half marathon prep",
        location: "Central Park Loop",
        reminders: [{ amount: 30, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),

    // Week 0 (days 0 to 6) — current week (today is day 4, Thu)
    ev(
      "may20",
      "Team Standup",
      rel(1, 9),
      rel(1, 9, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Mon",
        description: "Daily sync — blockers, progress, priorities",
        reminders: [{ amount: 5, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
        status: "busy",
      },
    ),
    ev("may21", "Sprint Planning", rel(1, 10), rel(1, 12), "blue", "Work", {
      description:
        "Sprint 6 planning — story estimation, capacity check, commitments",
      reminders: [
        { amount: 15, unit: "minutes" },
        { amount: 1, unit: "days" },
      ],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "may22",
      "Coffee with Recruiter",
      rel(2, 9, 30),
      rel(2, 10, 15),
      "yellow",
      "Side Projects",
      {
        description: "Catching up with Priya — exploring senior IC roles",
        location: "Blue Bottle Bryant Park",
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("may23", "Design Critique", rel(2, 14), rel(2, 15, 30), "blue", "Work", {
      description: "Review week-view drag interactions and edge cases",
      location: "Room 3A",
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "may24",
      "1:1 with Manager",
      rel(3, 15),
      rel(3, 15, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Wed",
        description: "Weekly check-in",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "may25",
      "Tech Talk: React Server Components",
      rel(3, 17),
      rel(3, 18),
      "yellow",
      "Side Projects",
      {
        description: "Internal tech talk — RSC adoption patterns",
        location: "Main Auditorium",
        reminders: [{ amount: 15, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "may26",
      "Architecture Review",
      rel(4, 10),
      rel(4, 11, 30),
      "blue",
      "Work",
      {
        description:
          "Review proposed changes to event positioning engine — column assignment algorithm",
        reminders: [{ amount: 15, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "may27",
      "Lunch with Sarah",
      rel(4, 12, 30),
      rel(4, 13, 30),
      "purple",
      "Personal",
      {
        location: "Joe's Pizza",
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("may28", "Gym", rel(4, 18), rel(4, 19, 30), "green", "Fitness", {
      recurrence: "Every week on Thu",
      reminders: [{ amount: 30, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev("may29", "Friday Wrap-up", rel(5, 16), rel(5, 17), "blue", "Work", {
      recurrence: "Every week on Fri",
      description: "Review weekly accomplishments and set Monday priorities",
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),

    // Multi-day weekend trip: Fri (day 5) – Sun (day 7)
    ev(
      "may30",
      "Weekend in Hudson Valley",
      rel(5, 0),
      rel(7, 0),
      "orange",
      "Family",
      {
        isAllDay: true,
        description:
          "Long weekend getaway — hiking, antique shops, farm-to-table dinners",
        location: "Hudson, NY",
        reminders: [{ amount: 1, unit: "days" }],
        calendarEmail: "me@vmnog.com",
      },
    ),

    // Week 1 (days 7 to 13)
    ev(
      "may31",
      "Team Standup",
      rel(8, 9),
      rel(8, 9, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Mon",
        description: "Daily sync — blockers, progress, priorities",
        reminders: [{ amount: 5, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("may32", "Roadmap Sync", rel(8, 14), rel(8, 15), "blue", "Work", {
      description: "Align on Q3 roadmap themes before exec review",
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "may33",
      "React Conf 2026",
      rel(9, 0),
      rel(11, 0),
      "yellow",
      "Side Projects",
      {
        isAllDay: true,
        description:
          "React Conf — keynotes, workshops, hallway track networking",
        location: "Henderson, NV",
        reminders: [{ amount: 2, unit: "days" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "may34",
      "Conference Opening Keynote",
      rel(9, 9),
      rel(9, 10, 30),
      "yellow",
      "Side Projects",
      {
        description: "React Conf opening keynote — what's new in React 20",
        location: "Henderson Convention Center",
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "may35",
      "Workshop: Concurrent Rendering",
      rel(10, 13),
      rel(10, 16),
      "yellow",
      "Side Projects",
      {
        description: "Deep dive into useTransition, useDeferredValue patterns",
        location: "Room 204",
        reminders: [{ amount: 15, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "may36",
      "1:1 with Manager",
      rel(10, 15),
      rel(10, 15, 30),
      "red",
      "me@vmnog.com",
      {
        recurrence: "Every week on Wed",
        description: "Async — reschedule from conference",
        reminders: [{ amount: 10, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "may37",
      "Conference Dinner",
      rel(10, 19),
      rel(10, 22),
      "purple",
      "Personal",
      {
        description: "Hosted dinner with React core team and maintainers",
        location: "STK Las Vegas",
        reminders: [{ amount: 1, unit: "hours" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev("may38", "Friday Wrap-up", rel(12, 16), rel(12, 17), "blue", "Work", {
      recurrence: "Every week on Fri",
      description: "Travel-day wrap from the airport",
      reminders: [{ amount: 10, unit: "minutes" }],
      calendarEmail: "me@vmnog.com",
    }),
    ev(
      "may39",
      "Dinner with Parents",
      rel(13, 19),
      rel(13, 21, 30),
      "orange",
      "Family",
      {
        description: "Catching up after the trip",
        location: "Mom's house",
        reminders: [{ amount: 30, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),

    // Sunday after next
    ev(
      "may40",
      "Side Project: CalendarCN v1.0 polish",
      rel(14, 10),
      rel(14, 13),
      "yellow",
      "Side Projects",
      {
        description: "Final pass on month view before tagging v1.0",
        calendarEmail: "me@vmnog.com",
      },
    ),
    ev(
      "may41",
      "Sunday Long Run",
      rel(14, 8),
      rel(14, 10),
      "green",
      "Fitness",
      {
        description: "14 miles — half marathon final long run",
        location: "Brooklyn Bridge Park",
        reminders: [{ amount: 30, unit: "minutes" }],
        calendarEmail: "me@vmnog.com",
      },
    ),
  ];
}
/**
 * Generates the demo events relative to `today`, so the current week always
 * has the same layout. Weekday-specific events (gym splits, weekend runs)
 * keep their weekdays because offsets are counted from the week's Sunday.
 */
export function generateMockEvents(today: Date = new Date()): CalendarEvent[] {
  return demoEvents(createRelativeDate(today));
}
