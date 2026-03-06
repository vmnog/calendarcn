# src/lib/ — Local Context

## What Lives Here

Pure utility functions and data:

- `event-utils.ts` — event positioning algorithms (column assignment, pixel calculations)
- `mock-events.ts` — sample event data for development
- `utils.ts` — general utilities (`cn()` class merger)

## Gotchas

### event-utils.ts — The Positioning Engine

This file contains the core math for laying out events in the calendar grid. Changes here affect every event's visual position.

**Key functions:**

- `getEventsForDay(events, day)` — filters events that overlap a specific day. Handles all-day, multi-day, and single-day events. Be careful with boundary conditions (events that start at exactly midnight).
- `assignColumns(events)` — determines how overlapping events stack side-by-side. Uses a greedy algorithm: sort by start time, group overlapping events, assign column indices. Bug-prone area — always verify with overlapping test cases.
- `calculatePositionedEvents(events, day)` — combines filtering + column assignment + pixel math. Returns `PositionedEvent[]` with `top`, `height`, `left`, `width`, and `segmentPosition`.
- `calculateAllDayEventRows(events, days)` — stacks all-day events into rows. Returns occupied rows and max row count for height calculation.

**When modifying:**

1. Test with overlapping events (2, 3, 4+ events at same time)
2. Test with multi-day events spanning week boundaries
3. Test with all-day events mixed with timed events
4. Verify calculations in both standard and edge times (midnight, noon)

### utils.ts — cn() Helper

The `cn()` function merges Tailwind classes using `clsx` + `tailwind-merge`. Always use this instead of template literals for conditional classes:

```ts
// Correct
cn("base-class", isActive && "active-class")

// Wrong
`base-class ${isActive ? "active-class" : ""}`
```

### mock-events.ts

Sample data for development. Events here should cover all edge cases: single-day, multi-day, all-day, overlapping, different colors. Update when adding new event properties to `CalendarEvent`.
