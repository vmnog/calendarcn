# CalendarCN Architecture

## Overview

CalendarCN is a client-side React calendar component built with Next.js App Router. There is no backend for calendar data — all state lives in React and resets on page reload. The app renders day, week, month, year and agenda views with interactive drag, resize, and selection behaviors.

## System Diagram

```
┌──────────────────────────────────────────────────────────┐
│  CalendarProvider (state owner, read with useCalendar()) │
│  events · view · currentDate · selection · settings      │
│        │                    │                   │        │
│  ┌─────▼────────┐   ┌───────▼─────┐   ┌─────────▼────┐   │
│  │ DayView /    │   │ MonthView   │   │ EventDetail  │   │
│  │ WeekView     │   │ (month grid)│   │ Panel/Popover│   │
│  └─────┬────────┘   └─────────────┘   └──────────────┘   │
│        │ view="day" | "week"                             │
│  ┌─────▼────────┐                                        │
│  │ TimeGrid     │                                        │
│  └─────┬────────┘                                        │
│        ├──────────────┬──────────────┐                   │
│  ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐             │
│  │ AllDayRow │  │ Grid      │  │ TimeAxis  │             │
│  │ (all-day  │  │ (timed    │  │ (hour     │             │
│  │  events)  │  │  events)  │  │  labels)  │             │
│  └───────────┘  └─────┬─────┘  └───────────┘             │
│                       │                                  │
│              ┌────────▼──────────┐                       │
│              │ CalendarEventItem │                       │
│              │ (renders each     │                       │
│              │  event segment)   │                       │
│              └───────────────────┘                       │
└──────────────────────────────────────────────────────────┘
```

## Data Flow

### State Ownership

`CalendarProvider` (`calendar-provider.tsx`) is the single source of truth for calendar state: events, view, `currentDate`, `numberOfDays`, selection and view settings. Each value can be controlled by the app (`value` + `onValueChange`) or owned by the provider (`defaultValue`). Views read state with `useCalendar()` and change it through its actions (`updateEvent`, `addEventFromRange`, `goToDate`, `switchView`, ...).

`page.tsx` is the demo: it renders the `CalendarApp` block (`calendar-app.tsx`) with the sample data, plus its own logos, avatar and links. `CalendarApp` holds the app around the provider: the sidebars, header, command menu, theme cycling, .ics import and export, and `<TimeGrid view={view} />`, `MonthView`, `YearView` or `AgendaView`. What people install as `@calendarcn/calendar-app` is the live demo.

### View Sync

Views tell the provider what they draw through the internal `useCalendarViewSync()`:

- `reportView({ view, numberOfDays? })`, from a layout effect after every commit that changes the view's props or the provider's state. While `view` is uncontrolled, the provider adopts the reported type (and a `numberOfDays` the view is fixed to), so a lone `DayView`, `WeekView` or `MonthView` navigates, labels its header and fills `visibleDays` by its own type. A switch the mounted view doesn't follow (e.g. pressing D under a lone `WeekView`) is undone, date included. Controlled `view` / `numberOfDays` always win; development builds warn about a mismatch. The full rule is the JSDoc on `CalendarProvider`.
- `reportVisibleDays` (time grid, and the agenda's 30 days) and `reportDisplayMonth` (month view), for the header and the mini calendar.
- `reportPasteTarget` (time grid columns and month cells, on mouse moves): the slot or day under the mouse, where `pasteEvent()` puts the next paste.

For the one commit before the provider adopts a view, the view's type differs from the provider's (`isProviderInSync` is false). Views skip slide animations and visible-day / display-month reports then: that date change is the adoption, not navigation.

### Visible Range

`visibleRange` (`getVisibleRange()` in `event-utils.ts`) is derived from the provider's own `currentDate`, `view`, `numberOfDays`, `weekStartsOn` and `showWeekends`, not from the live `visibleDays`, so a horizontal scroll moves it once, when the scroll snaps and `currentDate` changes. A passive effect passes each new range to `onVisibleRangeChange`, keyed by its start and end times so a range is never reported twice in a row. It waits while the provider is still adopting the mounted view (the latest `reportView` disagrees with the provider's view or day count): that range belongs to a view that isn't on screen. The `loading` prop only draws `CalendarLoadingBar` in the views' headers; the app does the fetching.

### Display Time Zone

With `timeZone` (or while travelling, `travelToTimeZone`), the provider maps dates at its boundary ([ADR-008](decisions/008-display-time-zone.md)). Props carry instants: `events` in, `onEventsChange` / `onEventCreate` / `onEventUpdate` / `createEvent`'s range / `onVisibleRangeChange`'s range out. The views, `useCalendar()`, the render slots and the details get wall-clock dates: `toDisplayEvent()` turns a timed event's `start` and `end` into `Date`s whose local time reads the zone's clock, so `event-utils.ts` and the drag, resize and keyboard hooks keep working with local getters. `updateEvent` and `addEventFromRange` map back with `fromDisplayEvent()` and `fromDisplayRange()`; an unchanged copy, or a time that still reads as before, keeps its instant. The views expand repeats with the calendar's zone (`expandRecurringEvents(events, range, timeZone)`), which expands the stored instants and draws the result on the zone's clock. Days and all-day events are calendar dates and never mapped. "Now" and "today" come from `useNow(timeZone)`, `useToday(timeZone)` and `getZonedNow(timeZone)`.

The zones themselves are provider state like `view`: the primary `timeZone`, the additional `secondaryTimeZones` (one axis column each, left to right) and the zone travelled to. `changeTimeZones()` applies a pure helper from `@/lib/time-zones`; the time grid's labels, the command menu and the Z / Escape keys use it.

### Event Lifecycle

```
User interaction → Hook (drag/resize) → onEventChange callback → CalendarProvider updateEvent → Re-render
```

1. User pointerdown on event → hook captures initial state in `ref` (touch: after a long press, see `use-pointer-gesture.ts`)
2. User pointermove → hook computes snapped position, updates `dragState` / `resizeState`
3. User pointerup → hook calls `onEventChange(updatedEvent)` → the provider's `updateEvent` merges it into `events`

For a date of a repeating event, `updateEvent` and `deleteEvent` first ask which events the change applies to (`EventSeriesScopeDialog`, which every view renders); the details' `editEvent` holds the change, drawn on that date only, until the event is left. The answer becomes one set of changes (`getSeriesEditChanges` / `getSeriesDeleteChanges` in `recurrence.ts`), applied, reported and undone together. [ADR-009](decisions/009-series-edit-scopes.md) has the rules.

### Repeating Events

A repeating event (`recurrenceRule`, or an RRULE in `recurrence`) is one event in the provider's `events`. Each view expands it for the dates it draws with `expandRecurringEvents()` (`src/lib/recurrence.ts`): the time grid over its buffered days, month view over its buffered rows, the agenda over its 30 days, and the details sidebar's search over a year either side of today. Occurrences get the id `<seriesId>-<yyyy-MM-dd>`, `seriesId` and `originalStart`, and are never stored. `selectedEvent` resolves such an id with `findEventOrOccurrence()`. The first edit of an occurrence reaches `updateEvent` with an id `events` doesn't have: the provider adds it as a stored event (`applyRecurringEdit()` decides what is stored) and reports it through `onEventCreate`. The drag and resize hooks receive the stored events and commit an occurrence from the copy the gesture started with. [ADR-007](decisions/007-repeating-events-are-expanded.md) has the rules.

### Undo History

The provider records each change it makes itself (a click-create, every `updateEvent`, delete, cut, duplicate, paste) as a step of `{ before, after, index }` changes, one per event (`src/lib/event-history.ts`). `undo()` applies a step's inverse to the current events and `redo()` the step again, both through `onEventsChange` and one `onEventCreate`, `onEventUpdate` or `onEventDelete` per event. A step applies only while each event it touches is the very object it left (`canApplyEventChanges`), so events the app replaced from outside (a reload) are never overwritten by an old undo. Edits to one event less than a second apart merge into one step; 100 steps are kept. Copy, the series arrows' occurrence copies and changes the app makes itself are not steps.

### Notices

After a delete, a cut or a copy the provider keeps one notice (`CalendarNotice`: a message, an optional title and an optional undo), read with `useCalendarNotice()` and drawn by `CalendarToaster`. A delete's or cut's notice holds the undo step it came from and closes, during render, as soon as that step is no longer the latest, so its Undo only ever takes back its own action. The notice is not announced by the toaster: the provider's live region reads every action.

### Event Positioning Pipeline

```
events[] → expandRecurringEvents(range) → getEventsForDay(day) → assignColumns() → calculatePositionedEvents()
```

1. **Filter**: `getEventsForDay()` selects events overlapping a specific day
2. **Column Assignment**: `assignColumns()` detects overlapping events and assigns column indices
3. **Position Calculation**: Converts time ranges to percentages: `top` and `height` of the visible hours, `left` and `width` of the day column
4. **Segment Position**: Multi-day events get `segmentPosition` ("start", "middle", "end", "full")

## Key Components

### TimeGrid (`time-grid.tsx`)

The day/week orchestrator. Reads state from `useCalendar()`, takes `view` ("day" | "week") and an optional `numberOfDays` as props, computes derived data (days, hours, scroll buffer, column width and hour height via ResizeObserver), runs the drag/resize/scroll hooks and delegates rendering to the `week-view-*` parts. Changing `view` re-lays out the same grid instead of remounting it, which keeps the vertical scroll position.

### DayView (`day-view.tsx`) and WeekView (`week-view.tsx`)

One-line wrappers: `<TimeGrid view="day" />` and `<TimeGrid view="week" />` (WeekView also passes `numberOfDays`). Use them for a calendar with one fixed view; use `TimeGrid` with `view` from `useCalendar()` to switch between day and week.

### MonthView (`month-view.tsx`)

Month grid with continuous vertical scroll, its own drag/resize hooks, and "+N more" (`showDay`).

### AgendaView (`agenda-view.tsx`)

A list of the events of `AGENDA_DAYS` (30) days from `currentDate`, grouped by day by `getAgendaDays()` in `event-utils.ts`. Empty days are skipped, except today. A multi-day event is listed under each of its days with its position ("Day 2 of 3"). No drag or resize: events are selected, opened and moved from the keyboard like in the other views. Prev/next move by 30 days.

### YearView (`year-view.tsx`)

The year of `currentDate` as twelve month grids, drawn by react-day-picker's `DayPicker` (`numberOfMonths={12}`, navigation off). `countEventsByDay()` in `event-utils.ts` counts each day's events once per change of the events or the year; a day with events gets a dot and its count in its name. No events are drawn. A click on a day calls `showDay()` (or `onDayClick`). Prev/next move by a year, `visibleRange` is the whole year, and `visibleDays` stays empty.

### WeekViewGrid (`week-view-grid.tsx`)

Renders the timed-event day columns inside TimeGrid's horizontally scrolling container. Each day column renders its positioned events.

### CalendarEventItem (`calendar-event-item.tsx`)

Renders a single event segment. Handles:

- Color styling via the `eventColorStyles[color]` map, where `color` comes from `resolveEventColor(event, calendars)`: the event's own color, then its calendar's, then blue
- Selection state (border highlight, elevated z-index)
- Multi-day segment rendering (rounded corners per segment position)
- Drag handle (pointerdown) and resize handles (top/bottom edges)

### Custom Hooks

| File                        | Purpose                                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `use-pointer-gesture.ts`    | Starts every drag and resize: at once for mouse and pen, after a long press for touch                                             |
| `use-event-drag.ts`         | Drags a timed event across time and days (ref-based state, snap-to-grid, auto-scroll)                                             |
| `use-event-resize.ts`       | Resizes a timed event from its top or bottom edge (anchor model, edge flipping)                                                   |
| `use-all-day-resize.ts`     | Resizes an all-day event's span in the all-day row                                                                                |
| `use-month-event-drag.ts`   | Drags an event to another day in the month grid                                                                                   |
| `use-month-event-resize.ts` | Resizes an event's span in the month grid                                                                                         |
| `use-event-keyboard.ts`     | Moves and resizes the focused event with the Alt+Arrow keys                                                                       |
| `use-calendar-shortcuts.ts` | The calendar's and the app's keyboard shortcuts, on one `window` listener                                                         |
| `use-horizontal-scroll.ts`  | Wheel scrolling across days in the time grid, with snap and slide animation                                                       |
| `use-vertical-scroll.ts`    | Wheel scrolling across rows in the month grid, with snap and slide animation                                                      |
| `use-now.ts`                | The current time, updated every minute, on the calendar's clock when given its zone; `null` during server rendering and hydration |
| `use-timezone-label.ts`     | A zone's short time zone label ("EDT", "GMT-3"), the viewer's by default                                                          |
| `use-controllable-state.ts` | State a parent can control or the component owns (shadcn/Radix style)                                                             |
| `use-inline-edit.ts`        | An inline text field: Enter commits, Escape restores                                                                              |
| `use-field-popover.ts`      | Focus, blur and Escape for the details' time and date fields                                                                      |
| `use-popover-dismiss.ts`    | Closes a popover on Escape, a press outside it, or focus moving outside it                                                        |
| `use-hover-tooltip.ts`      | Open state of a tooltip shown on hover                                                                                            |
| `use-media-query.ts`        | Whether a CSS media query matches                                                                                                 |
| `use-mobile.ts`             | `useIsMobile`: whether the viewport is narrower than 768px                                                                        |

### Server Rendering and the Clock

`TimeGrid` (and so `DayView` and `WeekView`) and `MonthView` render the same markup on the server and in the browser, so apps can server-render them without hydration errors (React #418). Nothing reads the clock or the runtime's timezone during render. Instead, every now-dependent part reads the shared clock in `src/hooks/use-now.ts`:

- `useNow()`: the current time, for the current-time line. Ticks on every minute boundary.
- `useToday()`: the start of today, for the today badge, month cells, the mini calendar, and the default `currentDate`. Re-renders only when the day changes.
- `useIsPast(date)`: past-event fading. Re-renders only when the answer flips.

Each takes the calendar's zone (`useCalendarConfig().timeZone`) and then reads the clock there.

All three use `useSyncExternalStore` with a server snapshot of `null` (or `false`). The server and the hydration render show no today badge, no time line, and no faded events. React re-renders with the real time right after hydration. A client-only render gets the real time on its first render, so the demo looks the same either way. One timer serves every subscriber.

The timezone label follows the same pattern (`useTimeZoneLabel`). So do the additional time zones' columns (`secondaryTimeZones`): `TimeGrid` keeps its width from the first render and fills in their labels once `useToday()` is known. Month cells tag themselves with a timezone-free `data-date` (`yyyy-MM-dd`) for the same reason.

## Styling Architecture

### Color System

Colors are defined as CSS variables in `globals.css` with light/dark variants:

```css
:root {
  --event-blue-bg: #dbeafe;
  --event-blue-border: #3b82f6;
  /* ... */
}
.dark {
  --event-blue-bg: #1e3a5f;
  --event-blue-border: #60a5fa;
  /* ... */
}
```

Components access event colors via the `eventColorStyles` map (`calendar-event-item.tsx`), never hardcoded. The details panel's own interactive colors are the one exception: they are hardcoded hex values with a light and a `dark:` variant, listed in `CLAUDE.md` under "Interactive Element Patterns".

### Z-Index Scale

| Layer            | Z-Index | Usage                            |
| ---------------- | ------- | -------------------------------- |
| Grid background  | 0       | Base grid lines                  |
| Events           | 0–2     | Column index determines stacking |
| Selected event   | 20      | Elevated above peers             |
| Drag placeholder | 25      | Shows drop target                |
| Dragging copy    | 30      | Follows cursor                   |
| Toast            | 40      | Calendar Toaster, over the view  |
| Portal overlay   | 9999    | Popover/context menu             |

## Technology Decisions

- **No backend for calendar data**: events live in React state; the demo's data is in `mock-events.ts`. The one API route, `src/app/api/search/route.ts`, serves the docs search
- **No global state library**: `CalendarProvider` (a React context) owns the state and components read it with `useCalendar()`
- **shadcn/ui primitives**: Accessible, composable, styled with Tailwind
- **date-fns over dayjs/moment**: Tree-shakeable, immutable, modern
- **Tailwind CSS 4**: Utility-first, CSS variable integration, dark mode support
