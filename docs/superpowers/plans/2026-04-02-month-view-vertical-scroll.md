# Month View Vertical Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add infinite vertical scrolling to the month view with velocity-based snap-to-row behavior, mirroring the week view's horizontal scroll pattern.

**Architecture:** New `use-vertical-scroll.ts` hook handles wheel events on the Y axis, maintains scroll offset in row units, and snaps to row boundaries based on velocity. A new `generateWeekRow` utility creates individual week rows on demand for the dynamic buffer. `MonthView` integrates the hook, extending rows above/below the viewport as the user scrolls. `MonthViewGrid` receives a `scrollStyle` transform and `visibleRowCount` for row height calculation.

**Tech Stack:** React 19, date-fns, CSS transforms (translateY)

---

### Task 1: Create `generateWeekRow` utility

**Files:**

- Modify: `src/lib/event-utils.ts`

This utility generates a single `MonthWeekRow` for any given week-start date, used by the scroll hook to extend the buffer dynamically.

- [ ] **Step 1: Add `generateWeekRow` function**

Add after the existing `generateMonthGrid` function in `src/lib/event-utils.ts`:

```ts
/**
 * Generates a single MonthWeekRow for the week containing the given date.
 * Used by vertical scroll to extend the buffer one row at a time.
 */
export function generateWeekRow(
  date: Date,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0,
): MonthWeekRow {
  const weekStart = startOfWeek(date, { weekStartsOn });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn });
  const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const days: WeekDay[] = daysInWeek.map((day) => ({
    date: day,
    dayName: format(day, "EEE"),
    dayNumber: day.getDate(),
    isToday: isToday(day),
  }));

  return {
    weekNumber: getWeek(weekStart, { weekStartsOn }),
    days,
  };
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/event-utils.ts
git commit -m "feat: add generateWeekRow utility for dynamic row generation"
```

---

### Task 2: Create `use-vertical-scroll.ts` hook

**Files:**

- Create: `src/hooks/use-vertical-scroll.ts`

Core scroll hook mirroring `use-horizontal-scroll.ts` but for Y axis with row-based snapping.

- [ ] **Step 1: Create the hook file**

Create `src/hooks/use-vertical-scroll.ts`:

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseVerticalScrollOptions {
  /** Ref to the scrollable container element */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Height of a single row in pixels */
  rowHeight: number;
  /** Called when scroll settles — receives the number of rows scrolled */
  onNavigate: (rowsDelta: number) => void;
  /** Disable scroll handling (e.g., during drag) */
  disabled?: boolean;
}

interface UseVerticalScrollReturn {
  /** Current scroll offset in pixels (for translateY) */
  scrollOffset: number;
  /** Slide animation offset in pixels (for button/keyboard nav) */
  slideOffset: number;
  /** Whether the user is actively scrolling */
  isScrolling: boolean;
  /** Whether a snap/slide animation is in progress */
  isAnimating: boolean;
  /** Trigger a slide animation for programmatic navigation */
  triggerSlideAnimation: (rowsDelta: number) => void;
}

/** Debounce time after last wheel event before snapping */
const SCROLL_END_DEBOUNCE_MS = 150;

/** Duration of snap/slide CSS transition */
const SNAP_ANIMATION_MS = 200;

export function useVerticalScroll({
  containerRef,
  rowHeight,
  onNavigate,
  disabled,
}: UseVerticalScrollOptions): UseVerticalScrollReturn {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [slideOffset, setSlideOffset] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const scrollEndTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const accumulatedDelta = useRef(0);
  const onNavigateRef = useRef(onNavigate);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);

  const snapAndNavigate = useCallback(
    (offset: number) => {
      if (rowHeight <= 0) return;

      const rowsDelta = Math.round(offset / rowHeight);

      // If scroll distance < half a row, snap back
      if (rowsDelta === 0) {
        setIsAnimating(true);
        setScrollOffset(0);
        setTimeout(() => {
          setIsAnimating(false);
          setIsScrolling(false);
        }, SNAP_ANIMATION_MS);
        return;
      }

      // Snap to exact row boundary then navigate
      const targetOffset = rowsDelta * rowHeight;
      setIsAnimating(true);
      setScrollOffset(targetOffset);

      setTimeout(() => {
        onNavigateRef.current(-rowsDelta);
        setScrollOffset(0);
        setIsAnimating(false);
        setIsScrolling(false);
        accumulatedDelta.current = 0;
      }, SNAP_ANIMATION_MS);
    },
    [rowHeight],
  );

  // Programmatic slide animation for button/keyboard navigation
  const triggerSlideAnimation = useCallback(
    (rowsDelta: number) => {
      if (rowHeight <= 0 || isAnimating || isScrolling) return;

      const startOffset = rowsDelta * rowHeight;
      setSlideOffset(startOffset);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
          setSlideOffset(0);
          setTimeout(() => {
            setIsAnimating(false);
          }, SNAP_ANIMATION_MS);
        });
      });
    },
    [rowHeight, isAnimating, isScrolling],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (disabled) return;

      // Only handle vertical-dominant scrolls
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

      e.preventDefault();

      setIsScrolling(true);

      // Negate deltaY: scroll down (positive deltaY) = move calendar up = navigate forward
      accumulatedDelta.current += -e.deltaY;
      setScrollOffset(accumulatedDelta.current);

      // Reset debounce timer
      if (scrollEndTimer.current) {
        clearTimeout(scrollEndTimer.current);
      }

      scrollEndTimer.current = setTimeout(() => {
        snapAndNavigate(accumulatedDelta.current);
        accumulatedDelta.current = 0;
      }, SCROLL_END_DEBOUNCE_MS);
    };

    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
      if (scrollEndTimer.current) {
        clearTimeout(scrollEndTimer.current);
      }
    };
  }, [containerRef, snapAndNavigate, disabled]);

  return {
    scrollOffset,
    slideOffset,
    isScrolling,
    isAnimating,
    triggerSlideAnimation,
  };
}
```

- [ ] **Step 2: Verify typecheck and lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-vertical-scroll.ts
git commit -m "feat: add use-vertical-scroll hook for month view scrolling"
```

---

### Task 3: Integrate vertical scroll into MonthView

**Files:**

- Modify: `src/components/month-view.tsx`
- Modify: `src/components/month-view-grid.tsx`

Wire the scroll hook into MonthView, generate buffered rows dynamically, and apply the scroll transform.

- [ ] **Step 1: Update MonthView to use vertical scroll**

In `src/components/month-view.tsx`:

1. Add imports:

```ts
import { addWeeks, startOfMonth, startOfWeek } from "date-fns";
import { useVerticalScroll } from "@/hooks/use-vertical-scroll";
import { generateMonthGrid, generateWeekRow } from "@/lib/event-utils";
```

2. Add `onDateChange` prop to `MonthViewProps`:

```ts
export interface MonthViewProps {
  // ... existing props
  onDateChange?: (date: Date) => void;
}
```

3. Inside the component, add the scroll state and hook:

After the `weekRows` memo, add a `scrollContainerRef`, dynamic buffer state, and the hook:

```ts
const scrollContainerRef = useRef<HTMLDivElement | null>(null);

/** Number of visible rows (from the current month grid) */
const visibleRowCount = weekRows.length;

/** Dynamic buffer of extra rows above and below */
const [bufferAbove, setBufferAbove] = useState(0);
const [bufferBelow, setBufferBelow] = useState(0);

/** Row height in px — computed from container */
const [rowHeight, setRowHeight] = useState(0);

// Measure row height from container
useEffect(() => {
  const el = scrollContainerRef.current;
  if (!el || visibleRowCount === 0) return;

  const observer = new ResizeObserver(() => {
    setRowHeight(el.clientHeight / visibleRowCount);
  });
  observer.observe(el);
  return () => observer.disconnect();
}, [visibleRowCount]);

const handleScrollNavigate = useCallback(
  (rowsDelta: number) => {
    // Shift the base date by rowsDelta weeks
    // Positive = scrolled down (forward), negative = scrolled up (backward)
    const newDate = addWeeks(currentDate, rowsDelta);
    onDateChange?.(newDate);
  },
  [currentDate, onDateChange],
);

const {
  scrollOffset,
  slideOffset,
  isScrolling,
  isAnimating,
  triggerSlideAnimation,
} = useVerticalScroll({
  containerRef: scrollContainerRef,
  rowHeight,
  onNavigate: handleScrollNavigate,
  disabled: isDragging || isResizing,
});

// Extend buffer dynamically based on scroll offset
useEffect(() => {
  if (rowHeight <= 0) return;
  const rowsScrolled = Math.abs(scrollOffset) / rowHeight;
  const extraNeeded = Math.ceil(rowsScrolled) + 2; // +2 for safety

  if (scrollOffset < 0) {
    // Scrolling up (backward) — need rows above
    setBufferAbove((prev) => Math.max(prev, extraNeeded));
  } else if (scrollOffset > 0) {
    // Scrolling down (forward) — need rows below
    setBufferBelow((prev) => Math.max(prev, extraNeeded));
  }
}, [scrollOffset, rowHeight]);

// Reset buffer when currentDate changes (after navigation commit)
useEffect(() => {
  setBufferAbove(0);
  setBufferBelow(0);
}, [currentDate]);

// Build buffered week rows: buffer-above + current month + buffer-below
const bufferedWeekRows = useMemo(() => {
  const rows: MonthWeekRow[] = [];

  // Rows above: generate backwards from the first row of current month
  if (bufferAbove > 0 && weekRows.length > 0) {
    const firstDate = weekRows[0].days[0].date;
    for (let i = bufferAbove; i > 0; i--) {
      rows.push(generateWeekRow(addWeeks(firstDate, -i)));
    }
  }

  // Current month rows
  rows.push(...weekRows);

  // Rows below: generate forwards from the last row of current month
  if (bufferBelow > 0 && weekRows.length > 0) {
    const lastDate = weekRows[weekRows.length - 1].days[0].date;
    for (let i = 1; i <= bufferBelow; i++) {
      rows.push(generateWeekRow(addWeeks(lastDate, i)));
    }
  }

  return rows;
}, [weekRows, bufferAbove, bufferBelow]);

// Scroll style with transform
const scrollTransformY = scrollOffset + slideOffset;
const scrollStyle: React.CSSProperties = {
  transform: `translateY(${scrollTransformY}px)`,
  transition: isAnimating ? `transform ${200}ms ease-out` : undefined,
};
```

4. Update the grid section — replace the `<div className="flex-1 overflow-hidden">` wrapper:

```tsx
{
  /* Month grid — fills remaining space */
}
<div ref={scrollContainerRef} className="flex-1 overflow-hidden">
  <MonthViewGrid
    weekRows={bufferedWeekRows}
    events={displayEvents}
    currentMonth={startOfMonth(currentDate)}
    showWeekNumbers={showWeekNumbers}
    showWeekends={showWeekends}
    visibleRowCount={visibleRowCount}
    bufferAbove={bufferAbove}
    scrollStyle={scrollStyle}
    // ... all other existing props unchanged
    gridRef={gridRef}
  />
</div>;
```

- [ ] **Step 2: Update MonthViewGrid to apply scroll transform and use visible row count for height**

In `src/components/month-view-grid.tsx`:

1. Add new props to `MonthViewGridProps`:

```ts
/** Number of rows visible in the viewport (for row height calculation) */
visibleRowCount?: number;
/** Number of buffer rows above current month (for scroll offset) */
bufferAbove?: number;
/** CSS style for scroll transform */
scrollStyle?: React.CSSProperties;
```

2. Add to destructuring:

```ts
visibleRowCount,
bufferAbove = 0,
scrollStyle,
```

3. Update the ResizeObserver to use `visibleRowCount` instead of `weekRows.length`:

```ts
const rowCountForHeight = visibleRowCount ?? weekRows.length;

useEffect(() => {
  const el = containerRef.current;
  if (!el) return;

  const observer = new ResizeObserver(() => {
    if (rowCountForHeight === 0) return;
    setCellHeight(el.clientHeight / rowCountForHeight);
  });

  observer.observe(el);
  return () => observer.disconnect();
}, [containerRef, rowCountForHeight]);
```

4. Wrap the grid content in a div that receives the scroll transform and offset for buffer rows:

```tsx
return (
  <div
    ref={containerRef}
    className={cn("relative h-full overflow-hidden", className)}
  >
    <div
      style={{
        ...scrollStyle,
        // Offset upward by bufferAbove rows so visible rows stay in viewport
        marginTop: `-${bufferAbove * (cellHeight || 0)}px`,
      }}
    >
      <div
        className="grid"
        style={{
          gridTemplateRows: `repeat(${weekRows.length}, ${cellHeight || 0}px)`,
        }}
      >
        {weekRows.map((weekRow) => {
          // ... existing row rendering unchanged
        })}
      </div>
    </div>
  </div>
);
```

Note: Change from `gridTemplateRows: repeat(N, 1fr)` to explicit pixel heights so buffered rows outside the viewport have proper dimensions.

- [ ] **Step 3: Verify typecheck and lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: No errors or only pre-existing warnings

- [ ] **Step 4: Commit**

```bash
git add src/components/month-view.tsx src/components/month-view-grid.tsx
git commit -m "feat: integrate vertical scroll into month view with dynamic buffer"
```

---

### Task 4: Wire `onDateChange` from page.tsx and update navigation

**Files:**

- Modify: `src/app/page.tsx`

Connect the scroll's `onDateChange` to update `currentDate`, and update `goToPrev`/`goToNext` to navigate by 1 row (week) instead of 1 month for smoother scrolling.

- [ ] **Step 1: Add `onDateChange` prop to MonthView usage**

In `src/app/page.tsx`, add `onDateChange` to the MonthView component:

```tsx
<MonthView
  currentDate={currentDate}
  events={events}
  // ... existing props
  onDateChange={goToDate}
/>
```

`goToDate` already exists (line 116): `const goToDate = React.useCallback((date: Date) => setCurrentDate(date), []);`

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Test in browser**

Navigate to month view, scroll up/down with trackpad/mouse wheel:

- Grid should scroll smoothly
- On scroll stop, should snap to nearest row boundary
- Header month/year should update when scrolling past month boundaries
- Sidebar mini-calendar should sync

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire month view vertical scroll to page navigation"
```

---

### Task 5: Add slide animation for button/keyboard navigation

**Files:**

- Modify: `src/components/month-view.tsx`

Expose `triggerSlideAnimation` so button clicks (prev/next) and keyboard shortcuts (J/K) animate smoothly.

- [ ] **Step 1: Pass slide animation props**

Add `onPrevMonth` and `onNextMonth` props to `MonthViewProps`:

```ts
onPrevMonth?: () => void;
onNextMonth?: () => void;
```

Inside the component, call `triggerSlideAnimation` when these are invoked:

```ts
// Wrap prev/next to trigger slide animation
useEffect(() => {
  // Store the triggerSlide in a ref so page.tsx can call it
  // Actually, simpler approach: MonthView triggers animation
  // when currentDate changes from external navigation
}, []);
```

Actually, the simpler approach matching the week view pattern: detect when `currentDate` changes from external navigation (buttons/keyboard) vs from scroll. Use a ref to track scroll-initiated changes.

Add a `scrollNavigatedRef` to distinguish:

```ts
const scrollNavigatedRef = useRef(false);

const handleScrollNavigate = useCallback(
  (rowsDelta: number) => {
    scrollNavigatedRef.current = true;
    const newDate = addWeeks(currentDate, rowsDelta);
    onDateChange?.(newDate);
  },
  [currentDate, onDateChange],
);

// Trigger slide animation for external navigation (buttons/keyboard)
const prevDateRef = useRef(currentDate);
useEffect(() => {
  if (scrollNavigatedRef.current) {
    scrollNavigatedRef.current = false;
    prevDateRef.current = currentDate;
    return;
  }

  const prevDate = prevDateRef.current;
  prevDateRef.current = currentDate;

  if (prevDate.getTime() === currentDate.getTime()) return;

  // Calculate how many weeks changed
  const weeksDelta = Math.round(
    (currentDate.getTime() - prevDate.getTime()) / (7 * 24 * 60 * 60 * 1000),
  );

  if (weeksDelta !== 0) {
    triggerSlideAnimation(weeksDelta);
  }
}, [currentDate, triggerSlideAnimation]);
```

- [ ] **Step 2: Verify typecheck and lint**

Run: `npx tsc --noEmit && pnpm lint`

- [ ] **Step 3: Test in browser**

- Click prev/next arrows in month view — should animate slide
- Press J/K keys — should animate slide
- Scroll with wheel — should NOT double-animate (scrollNavigatedRef prevents it)

- [ ] **Step 4: Commit**

```bash
git add src/components/month-view.tsx
git commit -m "feat: add slide animation for button/keyboard month navigation"
```

---

### Task 6: Update month header sync

**Files:**

- Modify: `src/app/page.tsx`

Ensure the header month/year text and sidebar mini-calendar stay synced as the user scrolls through weeks that cross month boundaries.

- [ ] **Step 1: Update goToPrev/goToNext for month view**

Currently `goToPrev`/`goToNext` navigate by 1 month. For scroll continuity, change to navigate by the number of visible rows (e.g., 5-6 weeks ≈ 1 month). Keep the existing `addMonths` behavior since the header already shows the correct month from `currentDate`:

No changes needed — `addMonths(prev, -1)` and `addMonths(prev, 1)` are correct for button/keyboard navigation. The scroll hook uses `addWeeks` for row-level navigation. The header already derives from `currentDate`.

- [ ] **Step 2: Verify header updates during scroll**

Test: scroll slowly through a month boundary. The header should update when `currentDate` crosses into a new month (e.g., "March 2026" → "April 2026").

- [ ] **Step 3: Commit (if any changes were needed)**

```bash
git add src/app/page.tsx
git commit -m "fix: month header sync during vertical scroll"
```

---

### Task 7: Final polish and edge cases

**Files:**

- Modify: `src/components/month-view.tsx`
- Modify: `src/components/month-view-grid.tsx`

Handle edge cases: disable scroll during drag/resize, ensure event layout recalculates for buffered rows, clean up.

- [ ] **Step 1: Verify drag/resize still work during scroll**

The hook is already disabled during `isDragging || isResizing`. Verify:

- Drag an event while grid has buffer rows — should work normally
- Resize a bar while grid has buffer rows — should work normally

- [ ] **Step 2: Verify the `currentMonth` prop for adjacent-month dimming**

The `currentMonth` prop controls which days appear dimmed. During scroll, as weeks from the next/previous month appear, they should be dimmed relative to `currentDate`'s month. Verify this looks correct — `startOfMonth(currentDate)` is already passed.

- [ ] **Step 3: Run full lint and typecheck**

Run: `npx tsc --noEmit && pnpm lint && pnpm format:check`
Expected: Clean

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: month view vertical scroll — polish and edge cases"
```
