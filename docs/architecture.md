# CalendarCN Architecture

## Overview

CalendarCN is a client-side React calendar component built with Next.js App Router. There is no backend — all state lives in React and resets on page reload. The app renders a weekly calendar view with interactive drag, resize, and selection behaviors.

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

`page.tsx` is the demo: it renders the provider with mock events, then demo-only chrome (sidebars, header, command menu) around `<TimeGrid view={view} />` or `MonthView`.

### View Sync

Views tell the provider what they draw through the internal `useCalendarViewSync()`:

- `reportView({ view, numberOfDays? })`, from a layout effect after every commit that changes the view's props or the provider's state. While `view` is uncontrolled, the provider adopts the reported type (and a `numberOfDays` the view is fixed to), so a lone `DayView`, `WeekView` or `MonthView` navigates, labels its header and fills `visibleDays` by its own type. A switch the mounted view doesn't follow (e.g. pressing D under a lone `WeekView`) is undone, date included. Controlled `view` / `numberOfDays` always win; development builds warn about a mismatch. The full rule is the JSDoc on `CalendarProvider`.
- `reportVisibleDays` (time grid, and the agenda's 30 days) and `reportDisplayMonth` (month view), for the header and the mini calendar.

For the one commit before the provider adopts a view, the view's type differs from the provider's (`isProviderInSync` is false). Views skip slide animations and visible-day / display-month reports then: that date change is the adoption, not navigation.

### Visible Range

`visibleRange` (`getVisibleRange()` in `event-utils.ts`) is derived from the provider's own `currentDate`, `view`, `numberOfDays`, `weekStartsOn` and `showWeekends`, not from the live `visibleDays`, so a horizontal scroll moves it once, when the scroll snaps and `currentDate` changes. A passive effect passes each new range to `onVisibleRangeChange`, keyed by its start and end times so a range is never reported twice in a row. It waits while the provider is still adopting the mounted view (the latest `reportView` disagrees with the provider's view or day count): that range belongs to a view that isn't on screen. The `loading` prop only draws `CalendarLoadingBar` in the views' headers; the app does the fetching.

### Event Lifecycle

```
User interaction → Hook (drag/resize) → onEventChange callback → CalendarProvider updateEvent → Re-render
```

1. User pointerdown on event → hook captures initial state in `ref` (touch: after a long press, see `use-pointer-gesture.ts`)
2. User pointermove → hook computes snapped position, updates `dragState` / `resizeState`
3. User pointerup → hook calls `onEventChange(updatedEvent)` → the provider's `updateEvent` merges it into `events`

### Event Positioning Pipeline

```
events[] → getEventsForDay(day) → assignColumns() → calculatePositionedEvents()
```

1. **Filter**: `getEventsForDay()` selects events overlapping a specific day
2. **Column Assignment**: `assignColumns()` detects overlapping events and assigns column indices
3. **Position Calculation**: Converts time ranges to pixel positions (top, height, left, width)
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

### WeekViewGrid (`week-view-grid.tsx`)

Renders the timed-event day columns inside TimeGrid's horizontally scrolling container. Each day column renders its positioned events.

### CalendarEventItem (`calendar-event-item.tsx`)

Renders a single event segment. Handles:

- Color styling via `eventColorStyles[color]` map
- Selection state (border highlight, elevated z-index)
- Multi-day segment rendering (rounded corners per segment position)
- Drag handle (pointerdown) and resize handles (top/bottom edges)

### Custom Hooks

| Hook                  | Purpose                      | Key Pattern                                             |
| --------------------- | ---------------------------- | ------------------------------------------------------- |
| `useEventDrag`        | Drag events across time/days | Ref-based intermediate state, snap-to-grid, auto-scroll |
| `useEventResize`      | Resize event duration        | Anchor model, edge flipping, min duration enforcement   |
| `useAllDayResize`     | Resize all-day event span    | Column-based calculation, row re-stacking               |
| `useHorizontalScroll` | Smooth scroll in grid        | Scroll container ref, buffer management                 |

### Server Rendering and the Clock

`TimeGrid` (and so `DayView` and `WeekView`) and `MonthView` render the same markup on the server and in the browser, so apps can server-render them without hydration errors (React #418). Nothing reads the clock or the runtime's timezone during render. Instead, every now-dependent part reads the shared clock in `src/hooks/use-now.ts`:

- `useNow()`: the current time, for the current-time line. Ticks on every minute boundary.
- `useToday()`: the start of today, for the today badge, month cells, the mini calendar, and the default `currentDate`. Re-renders only when the day changes.
- `useIsPast(date)`: past-event fading. Re-renders only when the answer flips.

All three use `useSyncExternalStore` with a server snapshot of `null` (or `false`). The server and the hydration render show no today badge, no time line, and no faded events. React re-renders with the real time right after hydration. A client-only render gets the real time on its first render, so the demo looks the same either way. One timer serves every subscriber.

The timezone label follows the same pattern (`useTimeZoneLabel`). Month cells tag themselves with a timezone-free `data-date` (`yyyy-MM-dd`) for the same reason.

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

Components access colors via the `eventColorStyles` map, never hardcoded.

### Z-Index Scale

| Layer            | Z-Index | Usage                            |
| ---------------- | ------- | -------------------------------- |
| Grid background  | 0       | Base grid lines                  |
| Events           | 0–2     | Column index determines stacking |
| Selected event   | 20      | Elevated above peers             |
| Drag placeholder | 25      | Shows drop target                |
| Dragging copy    | 30      | Follows cursor                   |
| Portal overlay   | 9999    | Popover/context menu             |

## Technology Decisions

- **No backend**: Client-side only, mock data in `mock-events.ts`
- **No global state library**: React state + prop drilling (project is small enough)
- **shadcn/ui primitives**: Accessible, composable, styled with Tailwind
- **date-fns over dayjs/moment**: Tree-shakeable, immutable, modern
- **Tailwind CSS 4**: Utility-first, CSS variable integration, dark mode support
