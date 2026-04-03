# Month View Vertical Scroll

## Overview

Add infinite vertical scrolling to the month view, mirroring the week view's horizontal scroll pattern. Users scroll through week rows continuously with velocity-based snap behavior.

## Hook: `use-vertical-scroll.ts`

Mirrors `use-horizontal-scroll.ts` adapted for Y axis.

### State

- `scrollOffset` (float): current scroll position in row units. 0 = first row of current month.
- `velocity`: accumulated from wheel events for snap distance calculation.
- `bufferedWeekRows`: dynamically generated week rows extending above/below visible area.

### Wheel Event Handling

- Capture `wheel` events on the month grid container.
- Accumulate `deltaY` into `scrollOffset` (normalized by row height).
- Track velocity from recent deltas.

### Snap Behavior

- Debounce ~150ms after last wheel event.
- On settle, calculate snap target based on velocity:
  - Slow scroll: snap to nearest row boundary.
  - Fast scroll: momentum carries N rows before snapping (proportional to velocity).
- Animate to snap position via CSS `translateY` transition (matches week view's slide animation pattern).

### Dynamic Row Generation

- Start with current month's 5-6 week rows.
- As `scrollOffset` moves, extend buffered rows in both directions.
- Generate individual week rows using `addWeeks`/`subWeeks` from the base month start — not full `generateMonthGrid` calls.
- Each row needs: `weekNumber`, `days[]` with date and metadata.
- Buffer extends in chunks (e.g., 4 rows at a time) when scroll approaches the edge.

### Navigation Sync

- As scroll position changes, determine the most-visible month by checking the dates in the top visible row.
- Call `onNavigate(date)` when the displayed month changes so the page header ("March 2026") and sidebar mini-calendar stay in sync.

## Integration

### MonthView Component

- Calls `useVerticalScroll` hook with `containerRef`, `rowCount`, `onNavigate`.
- Passes `scrollStyle` (translateY transform) to `MonthViewGrid`.
- Passes `bufferedWeekRows` instead of the static `weekRows` from `generateMonthGrid`.

### MonthViewGrid Component

- Applies `scrollStyle` to the grid container or an inner wrapper.
- Renders all buffered rows (existing row rendering logic unchanged).
- Row height derived from container height / visible row count (existing `ResizeObserver` pattern).

### Page-Level Updates

- `currentDate` updates as the user scrolls past month boundaries (same as week view's `onDateChange`).
- Header month/year and sidebar mini-calendar follow automatically.

## Constraints

- Do NOT clamp scroll offset — extend buffer dynamically (same lesson as week view).
- Row height is dynamic based on viewport (existing `ResizeObserver` approach).
- `scrollOffset` stored in ref for intermediate updates, committed to React state on specific events (existing hooks pattern).
- Preserve all existing month view features: drag, resize, popover, context menu.
