# ADR-007: Repeating Events Are Expanded, Not Stored

## Status

Accepted

## Context

ADR-004 made the details' series arrows add a copy of the selected event for each occurrence they step to. The views still drew a repeating event once, at its first date, plus any copies: a weekly meeting didn't show next week. Calendars people use every day draw every occurrence and let one date change without the others.

ADR-004 named the alternative, virtual occurrences: expand every rule for the dates on screen, never store the occurrences, and save edits as exceptions (RFC 5545's `RECURRENCE-ID` and `EXDATE`). This record takes it, without the "this event / this and following / all events" prompt, which comes later.

## Decision

Occurrences are generated, never stored. `expandRecurringEvents(events, range)` in `src/lib/recurrence.ts` returns what to draw for a range; every view and the details sidebar's search call it.

- **What repeats.** An event with a `recurrenceRule`, or an RRULE in `recurrence` that a rule can hold, and no `seriesId`. Display text in `recurrence` ("Every week on Thu") stays a label: an app that writes it lays out its occurrences itself, like the demo's weekly routines, and the arrows step between those events as ADR-004 had them.
- **The stored events stay the app's.** `useCalendar().events`, `onEventsChange` and the `.ics` export hold each series as one event.
- **Ids.** An occurrence is `<series id>-<yyyy-MM-dd>`, its day in the series' zone, the id ADR-004's copies already had. The series' event is drawn as its first occurrence under its own id. Generated occurrences carry `seriesId` and `originalStart`, their start in the series.
- **Nothing draws twice.** A date is skipped when `excludedDates` names it, when a stored event has its occurrence id (an edited occurrence, or a copy stored under ADR-004), or when a stored event names its series and date through `seriesId` and `originalStart`. A copy stored under ADR-004 (no `seriesId`, the same rule as the event its id extends) is that date's occurrence, never a series of its own.
- **Editing an occurrence changes that date only**, Google Calendar's "This event" (Notion Calendar asks). `updateEvent` receives an id the events don't have, and the provider adds the occurrence as a stored event, reported through `onEventCreate`. Later edits update it. A new repeat rule takes it out of the series: it repeats on its own from its date and keeps its id, so the old series still skips that date.
- **Editing the series' event changes the series**, Google's "All events". Moved to another day, a weekly rule's days and a monthly weekday of the month move with it.
- **The series arrows select** the occurrence, generated or stored, and move to it. They add nothing.
- **Counting** stays ADR-004's: days in the event's `timeZone`, at the same clock time across daylight saving changes. An all-day series counts whole days in the viewer's calendar.
- **Limits.** A view expands only the dates it draws, at most `MAX_OCCURRENCES_PER_RANGE` (1000) occurrences of one series per range, memoized on the events and the range.
- **.ics.** `EXDATE` is `excludedDates`, `RECURRENCE-ID` is `originalStart` with the series' `UID` as `seriesId`, and a cancelled occurrence is an excluded date. An imported edited occurrence gets the id the calendar gives its date, so exporting and importing again replaces it.

## Consequences

### Positive

- A repeating event shows on every date in every view, and event search lists each date.
- Apps store what people changed, not every date: one event per series plus its edited dates.
- Copies stored under ADR-004 keep working: they stand for their date and don't draw twice.
- `.ics` files carry edited and cancelled dates to and from Google Calendar, Apple Calendar and Outlook.

### Negative

- Until the prompt exists, editing the first date edits the series and editing any other date edits that date alone, and the two look alike on screen.
- An edited occurrence keeps its `originalStart`: moving the series' event to another day doesn't move it.
- A series is walked from its first date, at most 20 years of daily occurrences: a daily series older than that draws nothing today.
- An app that stores every occurrence and sets `recurrenceRule` on each sees them twice until it drops the rule from the copies.

### Neutral

- Joining events into a series by title, calendar and rule (ADR-004) is gone for rule-based series; `seriesId` links them.
- The drag and resize hooks commit an occurrence from the copy the gesture started with, since it isn't in the stored events.
