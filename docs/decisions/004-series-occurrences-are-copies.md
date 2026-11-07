# ADR-004: Series Occurrences Are Copies

## Status

Accepted

## Context

The details panel's repeat row has Notion Calendar's previous / next arrows, which step through an event's series. A series can have occurrences the app has no event for: a rule set in the repeat row ("Every 2 weeks on Sat, 6 times") or imported from `.ics` lives on one event, and CalendarCN doesn't expand rules (the roadmap's "Recurring events").

Two ways to make the arrows reach those occurrences:

- **Virtual occurrences**: expand every rule into events the views draw for the dates on screen, generated from the rule and never stored, with edits saved as exceptions to the series (RFC 5545's `RECURRENCE-ID` and `EXDATE`).
- **Copies**: when an arrow steps to an occurrence the events don't have, add a copy of the selected event for it, through `onEventsChange` and `onEventCreate`, and select it.

Virtual occurrences need an exceptions model, "this event / this and following / all events" edits, and changes to every view's layout and drag code. They are the larger "Recurring events" item on the roadmap. The arrows needed to work now, in every view.

## Decision

The arrows copy. `CalendarProvider` finds the selected event's neighbors with `findSeriesOccurrence` (`src/lib/recurrence.ts`) and `showSeriesOccurrence` adds a missing one with `createSeriesOccurrence` before selecting it.

- A series is the events with the same title, calendar and repeat rule. Occurrences are counted from its earliest event, by calendar day, in the event's `timeZone`.
- A copy's id is the series' first event's id and the day it stands for (`launch-2026-06-20`). That id, not the copy's start, says which occurrence it is.
- An occurrence is the series' event on that day, else the event with that id. A new copy is added only when neither exists.
- A series known only by display text (`recurrence: "Every week on Mon"`, the demo's routines) steps between the events the app has.

## Consequences

### Positive

- The arrows work in every view with no change to layout, drag or resize: a copy is an ordinary event.
- Apps see each copy like a clicked-in event (`onEventCreate`) and can save it.
- A copy that was moved to another day or renamed stays its day's occurrence: the arrows open it again instead of adding a second copy, and count from its day, not from where it moved.

### Negative

- Only occurrences someone stepped to exist. The grid shows a repeating event once, at its first date, plus any copies; the others are not drawn.
- A copy is its own event: editing the series' rule or title doesn't change copies made before, and a copy whose rule is changed starts a series of its own.
- Matching by title, calendar and rule can join unrelated events that happen to share all three.
- Ids carry a date suffix, so an app that also expands rules on its server has to map them to its own occurrence ids.

### Neutral

- Expanding rules into virtual occurrences later can reuse `findSeriesOccurrence`'s rule math (`getAdjacentOccurrence`, RRULE parsing, zone-aware days), and copies made until then map to its exceptions by the day in their id.
