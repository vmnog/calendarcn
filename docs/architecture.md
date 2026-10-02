# CalendarCN Architecture

## Overview

CalendarCN is a client-side React calendar component built with Next.js App Router. There is no backend — all state lives in React and resets on page reload. The app renders a weekly calendar view with interactive drag, resize, and selection behaviors.

## System Diagram

```
┌─────────────────────────────────────────────────────┐
│  page.tsx (App State Owner)                         │
│  ┌─────────────┬──────────────┬──────────────────┐  │
│  │ currentDate  │ events[]     │ selectedEventId  │  │
│  └──────┬──────┴──────┬───────┴────────┬─────────┘  │
│         │             │                │             │
│  ┌──────▼──────┐  ┌───▼────────┐  ┌───▼──────────┐  │
│  │ DatePicker  │  │ WeekView   │  │ EventDetail  │  │
│  │ (sidebar)   │  │ (main)     │  │ Panel/Popover│  │
│  └─────────────┘  └───┬────────┘  └──────────────┘  │
│                       │                              │
│         ┌─────────────┼─────────────┐                │
│         │             │             │                │
│  ┌──────▼──────┐ ┌────▼─────┐ ┌────▼──────────┐     │
│  │ AllDayRow   │ │ Grid     │ │ TimeAxis      │     │
│  │             │ │          │ │               │     │
│  │ (all-day    │ │ (timed   │ │ (hour labels) │     │
│  │  events)    │ │  events) │ │               │     │
│  └─────────────┘ └────┬─────┘ └───────────────┘     │
│                       │                              │
│              ┌────────▼─────────┐                    │
│              │ CalendarEventItem│                    │
│              │ (renders each    │                    │
│              │  event segment)  │                    │
│              └──────────────────┘                    │
└─────────────────────────────────────────────────────┘
```

## Data Flow

### State Ownership

`page.tsx` is the single source of truth for all application state:

- **`currentDate`** — the reference date for the visible week
- **`events`** — array of `CalendarEvent` objects
- **`selectedEventId`** — currently selected event (or null)
- **`dirtyEventIds`** — tracks events modified via drag/resize

State flows down as props. Mutations flow up via callbacks (`onEventChange`, `onDateChange`, `onEventSelect`).

### Event Lifecycle

```
User interaction → Hook (drag/resize) → onEventChange callback → page.tsx setState → Re-render
```

1. User mousedown on event → hook captures initial state in `ref`
2. User mousemove → hook computes snapped position, updates `dragState` / `resizeState`
3. User mouseup → hook calls `onEventChange(updatedEvent)` → page.tsx merges into `events`

### Event Positioning Pipeline

```
events[] → getEventsForDay(day) → assignColumns() → calculatePositionedEvents()
```

1. **Filter**: `getEventsForDay()` selects events overlapping a specific day
2. **Column Assignment**: `assignColumns()` detects overlapping events and assigns column indices
3. **Position Calculation**: Converts time ranges to pixel positions (top, height, left, width)
4. **Segment Position**: Multi-day events get `segmentPosition` ("start", "middle", "end", "full")

## Key Components

### WeekView (`week-view.tsx`)

The main orchestrator. Receives all state from `page.tsx`, computes derived data (week days, hours), and delegates rendering to sub-components.

### WeekViewGrid (`week-view-grid.tsx`)

Renders the scrollable time grid with day columns. Manages horizontal scroll behavior and container dimensions via ResizeObserver. Each day column renders its positioned events.

### CalendarEventItem (`calendar-event-item.tsx`)

Renders a single event segment. Handles:

- Color styling via `eventColorStyles[color]` map
- Selection state (border highlight, elevated z-index)
- Multi-day segment rendering (rounded corners per segment position)
- Drag handle (mousedown) and resize handles (top/bottom edges)

### Custom Hooks

| Hook                  | Purpose                      | Key Pattern                                             |
| --------------------- | ---------------------------- | ------------------------------------------------------- |
| `useEventDrag`        | Drag events across time/days | Ref-based intermediate state, snap-to-grid, auto-scroll |
| `useEventResize`      | Resize event duration        | Anchor model, edge flipping, min duration enforcement   |
| `useAllDayResize`     | Resize all-day event span    | Column-based calculation, row re-stacking               |
| `useHorizontalScroll` | Smooth scroll in grid        | Scroll container ref, buffer management                 |

### Server Rendering and the Clock

`WeekView` and `MonthView` render the same markup on the server and in the browser, so apps can server-render them without hydration errors (React #418). Nothing reads the clock or the runtime's timezone during render. Instead, every now-dependent part reads the shared clock in `src/hooks/use-now.ts`:

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
