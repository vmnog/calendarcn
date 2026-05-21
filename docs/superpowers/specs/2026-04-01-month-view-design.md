# Month View Design Spec

## Overview

Add a month view to CalendarCN, matching Notion Calendar's month view behavior. The month view displays a 7-column (Sun-Sat) grid with 5-6 week rows showing all-day/multi-day event bars and timed event text lines, with overflow handled via "+N more" navigation to week view.

## Section 1: Component Architecture

### New Files

| File                                       | Purpose                                                                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `src/components/calendar-types.ts`         | Shared types extracted from `week-view-types.ts` (CalendarEvent, EventColor, ViewType, ViewSettings, etc.) |
| `src/components/calendar-day-headers.tsx`  | Renamed from `week-view-day-columns.tsx` — generic day-of-week header row used by both views               |
| `src/components/month-view.tsx`            | Month view orchestrator — receives props from `page.tsx`, computes month grid, delegates to children       |
| `src/components/month-view-grid.tsx`       | 7-column grid with 5-6 week rows, manages cell height measurement and slot count                           |
| `src/components/month-view-day-cell.tsx`   | Individual day cell — renders day number, event bars, event items, and "+N more"                           |
| `src/components/month-view-event-bar.tsx`  | All-day/multi-day colored bar spanning columns                                                             |
| `src/components/month-view-event-item.tsx` | Timed event text line: colored dot + time + title                                                          |
| `src/hooks/use-month-event-drag.ts`        | Day-snapping drag for moving events in month view                                                          |

### New Utility

- `calculateMonthCellLayout()` in `src/lib/event-utils.ts` — computes slot assignments for all cells in a month grid

### Refactor

- **Extract generic types** from `week-view-types.ts` into new `calendar-types.ts`. Week-specific prop interfaces stay in `week-view-types.ts` and import from the shared file.
- **Rename** `week-view-day-columns.tsx` → `calendar-day-headers.tsx`. Update all imports.

### Data Flow

```
page.tsx (view, currentDate, events, viewSettings)
  └─ MonthView
       └─ CalendarDayHeaders (day-of-week labels)
       └─ MonthViewGrid (week rows)
            └─ MonthViewDayCell (per day)
                 ├─ MonthViewEventBar (all-day/multi-day)
                 ├─ MonthViewEventItem (timed)
                 └─ "+N more" button
```

## Section 2: Month Grid Layout

### Week Generation

- Use `date-fns`: `startOfMonth` → `startOfWeek` gives first visible day; `endOfMonth` → `endOfWeek` gives last visible day
- Always show 5 or 6 rows depending on the month (months spanning 6 calendar weeks show 6 rows; short months padded to at least 5)
- Each row is an array of 7 `Date` objects (Sun-Sat by default)
- When `showWeekends: false`, filter to 5 columns (Mon-Fri)
- When `showWeekNumbers: true`, add a narrow left column with ISO week numbers

### Row Height

- All rows share equal height: `100% / rowCount` of the available grid area
- Grid area = viewport height minus the day-of-week header row
- Rows shrink when 6 weeks are needed vs 5

### Day Cell Slot Allocation Algorithm

Each cell has a maximum number of visible slots (default 6 at typical viewport). Allocation priority:

1. **Multi-day/all-day events first** — reserve top slots, span across columns. A spanning event occupies the same slot index in every cell it crosses.
2. **Timed events below** — sorted by start time, fill remaining slots as single-cell text lines.
3. **Last slot reserved for overflow** — if total events > available slots, the bottom slot becomes "+N more" instead of an event. Example with 6 max slots and 2 multi-day events: 2 multi-day + 3 timed + 1 "+N more" = 6 slots.
4. **Dynamic slot count** — component measures actual cell height and divides by `MONTH_EVENT_ROW_HEIGHT` (22px constant) to determine the limit. Smaller screens get fewer slots.

### Multi-Day Bar Continuity

- A multi-day event spanning Mon-Wed renders as a single `MonthViewEventBar` in the Monday cell with `colSpan: 3`
- Events crossing a week boundary split into two bars: one per week row, each at the same slot index
- Empty slots above a spanning bar in intermediate cells are preserved to keep alignment

### "+N More" Navigation

- Clicking "+N more" navigates to week view focused on that day
- The target day's column gets a highlight animation: background color fade returning to normal over ~2 seconds (CSS transition)
- Implementation: `highlightedDate` state in `page.tsx`, passed to `WeekView`, applied as a CSS class with `background-color` transition, cleared after transition ends

### Adjacent Month Days

- Days from previous/next month render with dimmed text (`opacity-50` or muted foreground color)
- Fully functional: show events, support click/drag, respond to all interactions identically to current-month days

## Section 3: Event Rendering

### Timed Events (`MonthViewEventItem`)

- Single text line within a day cell slot
- Layout: `[colored dot] [time] [title]` — inline, truncated with ellipsis on overflow
- Colored dot uses the same `EventColor` palette and `eventColorStyles` map from week view
- Font size: `text-xs` (~12px)
- Time format: `9 AM`, `2:30 PM` (no leading zero, abbreviated)
- Hover: subtle background highlight (same pattern as week view event hover)
- Click: opens event popover (sidebar closed) or selects in detail panel (sidebar open)

### All-Day / Multi-Day Events (`MonthViewEventBar`)

- Colored horizontal bars spanning one or more columns
- Same color palette as week view's all-day row bars
- Bar height: one slot row (~20px)
- Text: event title only (no time), left-aligned, truncated with ellipsis
- Corner rounding:
  - Rounded on start/end edges, flat where the bar continues into next/prev week
  - Example: Mon-Wed bar → rounded-left on Mon, rounded-right on Wed
  - Thu-Sat (continues next week) → rounded-left on Thu, flat-right on Sat; Sun-Tue continuation → flat-left on Sun, rounded-right on Tue
- Positioning: absolute positioning or CSS grid `column-start`/`span` over day cells within each week row

### Event Ordering Within a Cell

- Multi-day/all-day events always render in top slots
- Among multi-day events: longer spans first, then alphabetically (stable sort)
- Timed events below: sorted by start time ascending

### Selected Event Styling

- Same visual treatment as week view: slightly elevated appearance, ring/border highlight
- Selecting in month view populates the right sidebar detail panel (if open)

## Section 4: Interactions & Drag Behavior

### Event Click

- Single click on any event: opens popover (sidebar closed) or selects in detail panel (sidebar open) — same as week view
- Click on empty cell area: deselects any selected event
- Right-click on event: opens context menu (same `EventContextMenu` component)

### Drag-to-Move — Timed Events (`useMonthEventDrag`)

- Drag a timed event to another day cell
- Snaps to whole days — event's date changes but start time and duration stay the same
- Visual feedback: ghost/placeholder in target cell, original shows dimmed
- Drop zone: entire day cell (no time precision in month view)
- Cross-week dragging works

### Drag-to-Move — All-Day/Multi-Day Events

- Drag the bar to move the entire event to a new start date
- Duration preserved: a 3-day event dragged from Mon→Wed becomes Wed→Fri
- Visual feedback: bar follows cursor, snapping to day columns
- No edge resize in month view — only full-event moves

### Drag Visual Feedback

- Same approach as week view: `dragRef.current` tracks intermediate state, commit on mouseup
- Placeholder element shows drop target
- Z-index: dragging element at z-30
- No auto-scroll needed (entire month visible)

### Keyboard Shortcuts

- All navigation shortcuts carry over: `T` (today), `J`/`ArrowLeft` (prev month), `K`/`ArrowRight` (next month)
- `M` shortcut to switch to month view
- `Escape` deselects selected event
- Arrow keys with selected event: not in initial version

### "+N More" Click

- Switches to week view, sets `currentDate` to clicked day
- Target day column gets highlight: CSS `background-color` transition from accent → transparent over ~2 seconds
- `page.tsx`: `handleMoreClick(date)` sets `view: "week"`, `currentDate: date`, `highlightedDate: date`
- `WeekView` receives `highlightedDate`, applies transition class, clears via `onTransitionEnd` or timeout

## Section 5: View Settings & Navigation

### View Settings (Carried Over from Week View)

| Setting              | Month View Behavior                                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `showWeekends`       | `false` → hide Sat/Sun columns, grid becomes 5-column. Multi-day bars spanning weekends skip hidden columns visually but preserve logical duration |
| `showWeekNumbers`    | `true` → add narrow left column showing ISO week number per row                                                                                    |
| `showDeclinedEvents` | `false` → filter out declined events from cell layout calculation and rendering                                                                    |

### Month Navigation

- **Prev/Next buttons** (chevrons): move by one month
- **Today button**: jump to current month, highlight today's cell
- **Keyboard**: `J`/`ArrowLeft` = prev month, `K`/`ArrowRight` = next month, `T` = today
- **Mini calendar (left sidebar)**: clicking a day navigates to that day's month; mini calendar syncs displayed month with `currentDate`

### Header Display

- Shows `April 2026` (month + year) in the same header area as week view
- View dropdown shows "Month" as active

### Today's Date Cell

- Day number gets accent treatment (colored circle/background) — same pattern as Notion Calendar

### Transition Between Views

- Week → month: `currentDate` stays, month view shows the month containing that date
- Month → week: `currentDate` stays, week view shows the week containing that date
- No animation between view switches (instant swap)

## Section 6: Responsive Behavior & Edge Cases

### Responsive Slot Count

- Day cells measure height via `ResizeObserver` (or shared ref from grid parent)
- Available slots = `Math.floor(cellHeight / MONTH_EVENT_ROW_HEIGHT)` where `MONTH_EVENT_ROW_HEIGHT` = 22px
- Minimum: 2 slots (1 event + "+N more"). Maximum: 6 slots at default/large viewports
- When viewport shrinks, more events pushed to "+N more" — layout recalculates dynamically

### 5 vs 6 Week Rows

- Months where day 1 is Sunday and has ≤28 days: 4 week rows → pad to 5
- Months spanning 6 calendar weeks: show 6 rows
- Row height adjusts via `100% / rowCount` — 6-row months have shorter cells, may reduce visible slot count

### Multi-Day Bar Edge Cases

- Event spans entire month: splits into 4-5 bars (one per week row), all at same slot index
- Event starts in previous month: bar begins at first visible day, flat-left edge
- Event ends in next month: bar extends to last visible day, flat-right edge
- Multiple multi-day events competing: stable sort by duration (longest first), then title. Next event takes next available slot if current is taken

### Empty States

- Days with no events: just the day number, empty cell space
- No special empty state message needed

### Performance

- `calculateMonthCellLayout` runs once per visible month when events or date change — memoize with `useMemo`
- Grid parent computes the full month layout, passes each cell its pre-computed event list and slot assignments
- Multi-day bar span calculation is O(events x weeks) — negligible for typical event counts
