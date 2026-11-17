# ADR-008: The Calendar's Time Zone Is Mapped at the Provider

## Status

Accepted

## Context

The views and `src/lib/event-utils.ts` lay events out with local getters and date-fns (`getHours()`, `startOfDay`, `new Date(y, m, d, h)`). So the calendar always drew on the viewer's clock. Notion Calendar draws on a primary time zone the person picks, and "Travel to time zone" switches it for a while. CalendarCN needed a `timeZone` on `CalendarProvider` that every view follows, and a way to change it from the time axis and the command menu.

Three ways to draw on another zone's clock:

- **Wall-clock dates at the provider.** The provider hands the views `Date`s whose local time reads the zone's clock, and turns every change back into instants. No layout code changes.
- **`TZDate` from `@date-fns/tz`.** A new dependency for every registry item, and every `new Date(...)` in about 15 view files becomes a place where the zone silently drops.
- **Dates read through UTC getters.** Rewrites all the layout, drag, resize and keyboard code.

Since plan 015, repeating events are expanded in each view (`expandRecurringEvents`, ADR-007), not in the provider, so the views see the events before their occurrences exist.

## Decision

The provider maps dates at its boundary.

- **Props carry instants.** `events`, `onEventsChange`, `onEventCreate`, `onEventUpdate`, the range `createEvent` gets and the range `onVisibleRangeChange` gets (the instants the visible days start and end in the zone).
- **Inside, times read on the calendar's clock.** `useCalendar().events`, `selectedEvent`, the series arrows, the render slots and the details get `toDisplayEvent()` copies: a timed event's `start` and `end` as `Date`s whose local time reads the zone's clock. `updateEvent` and `addEventFromRange` take them that way and map back with `fromDisplayEvent()` and `fromDisplayRange()`. A copy nothing changed maps back to its exact instants (a reverse cache), and a time that still reads as before keeps its instant, so a time the zone's clocks show twice, or one the viewer's clocks skip, survives an edit of another field.
- **Days are calendar dates** and never mapped: `date`, `currentDate`, `visibleDays`, `visibleRange` and all-day events.
- **Repeats are expanded on instants.** `expandRecurringEvents(events, range, timeZone)` and `findEventOrOccurrence(events, id, timeZone)` take the calendar's zone: they map the events back, expand over the instants the days span, and draw the result on the zone's clock again. Each series still repeats in its own zone.
- **An event without its own zone stays in the viewer's.** Plan 018 proposed putting it in the calendar's zone, as Google Calendar does with a calendar's default zone. That would move a zoneless weekly meeting to the travel zone's clock while travelling, which Notion Calendar never does, and it would thread a default zone through every series helper.
- **Now and today follow the zone.** `useNow(timeZone)`, `useToday(timeZone)`, `useIsPast(date, timeZone)` and `getZonedNow(timeZone)`.
- **Zones are provider state.** `timeZone` / `defaultTimeZone` / `onTimeZoneChange` and `secondaryTimeZones` / `defaultSecondaryTimeZones` / `onSecondaryTimeZonesChange` are controllable like `view`. `travelToTimeZone(zone)` draws in another zone until `travelToTimeZone(null)`, with the home zone beside it. `changeTimeZones(change)` takes a pure helper from `@/lib/time-zones` (`addTimeZone`, `removeTimeZone`, `makeTimeZonePrimary`, `makeTimeZoneSecondary`, `replaceTimeZone`).
- **The details follow Notion Calendar** when the calendar draws in another zone than an event's: the times read on the calendar's clock and the time zone row names the calendar's zone, with "Switch to event's time zone to edit" to show the times on the event's own clock and change its zone.
- **Without `timeZone`, or with one the runtime doesn't know**, nothing is mapped and the calendar behaves as before.

## Consequences

### Positive

- No layout, drag, resize or keyboard code changed, and no dependency was added.
- The time grid's labels, the command menu and the shortcuts change zones without the app holding any state.
- The server and the browser lay events out alike when `timeZone` is set.

### Negative

- Dates inside the provider are not instants when `timeZone` is set: custom code converts with `fromZonedWallClock(date, timeZone)`.
- The one hour a year the viewer's own clocks skip can't be drawn when the calendar's zone isn't the viewer's: an event there is drawn from the hour after.
- `toIcs()` still writes a repeating event without a zone in the viewer's zone.
