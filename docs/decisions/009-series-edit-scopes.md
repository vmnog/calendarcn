# ADR-009: Ask Which Dates of a Repeating Event a Change Applies To

## Status

Accepted

## Context

ADR-007 draws every date of a repeating event and stores an edited date apart, with `seriesId` and `originalStart`. Editing any date changed that date only, and editing the series' first date changed the whole series, with no way to tell the two apart on screen.

Notion Calendar asks instead (observed 2026-11-16): "This event", "This and following events" or "All events", in a question titled `Edit repeat event “<title>”` or `Delete repeat event “<title>”`. It holds changes made in the details, marked with a dot, until the event is left, and then asks once with a summary of what changed. Google Calendar asks the same three options at the end of a drag.

## Decision

A change to one date of a repeating event goes through a question, `EventSeriesScopeDialog`, which every view renders once.

- **The options.** This event, This and following events, All events, the first selected. On the series' first date only This event and All events. A repeat rule change (including "Does not repeat") can't apply to one date, so it leaves out This event.
- **When it asks.** A change in the details waits: the date is drawn with the change and a dot before its title, and the question comes when the event is left (Escape, a click elsewhere, another event, the series arrows), listing every changed field. A drag, a resize, an Alt+arrow move and a change from the right-click menu ask at once.
- **The answers.** Save event applies the change to the chosen dates. Discard change drops it. Continue editing keeps it waiting, with the date selected; Escape does the same, and never discards. A delete asks with Cancel and Delete event; Escape cancels.
- **This event** stores the date as an exception (`seriesId`, `originalStart`, under `<seriesId>-<yyyy-MM-dd>` or the id it already has). A delete adds the date to the series' `excludedDates` and deletes its stored exception.
- **This and following events** ends the series the day before (`end: { type: "on" }`), and starts a new series with a new id (`crypto.randomUUID()`) from the date. A count end keeps the count left. A delete only ends the series.
- **All events** changes the series event: a new time moves every date by the same time of day and days; dates with a time of their own keep it, and other changed fields reach the stored dates that still had the series' value. A delete removes the series and its stored dates.
- **Stored and excluded dates** move along with a split or an All events edit when the dates keep their days, rule, all-day and time zone, and are removed when they don't: their days no longer name dates of the series.
- **One answer is one undo step**, applied in one `onEventsChange`, then reported as `onEventDelete`, `onEventUpdate` and `onEventCreate`, in that order, so a new series reaches an app before its dates. An answer never merges with the edit before it in the history.
- **On the calendar's clock** (`timeZone`, ADR-008), a change the views or the details hand over is mapped back to instants before it waits or is answered, so the question works on the events as stored. The views draw the waiting change, and the question lists its times, on the calendar's clock.
- **Without a question mounted, nothing waits.** A change applies to the first option offered. `updateEvent(event, scope)` and `deleteEvent(id, scope)` take the answer and never ask; `editEvent(event)` is the details' way to change an event, holding a repeating date back as above.

## Consequences

### Positive

- One answer is one undo step and one set of callbacks, so apps that save one change at a time stay in sync, and Undo in the toast takes back the whole answer.
- The question matches Notion Calendar's wording and behavior, so the calendar behaves the way people who use it expect.

### Negative

- A change that waits isn't reported until the event is left, so a reload loses it.
- Moving a series to other days drops its stored dates rather than moving them.
- A new series' id is random, so a server that keeps its own ids maps it on `onEventCreate`.
- `updateEvent` and `deleteEvent` on a repeating date now ask while a view is mounted, which changes what existing callers do (a breaking change in the changelog).

### Neutral

- `getSeriesEditChanges()` and `getSeriesDeleteChanges()` in `src/lib/recurrence.ts` are pure and work without a provider; the provider only applies and records what they return.
