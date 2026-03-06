# Debugging Skill — CalendarCN

## When to Use

Invoke when tracking down bugs, unexpected behavior, or rendering issues in CalendarCN.

## Debugging Flow

### Step 1: Reproduce

1. Get exact steps to reproduce
2. Identify: which component, which interaction, which data state?
3. Try in both light and dark mode
4. Try at different viewport sizes

### Step 2: Isolate

Narrow down the bug to one of these areas:

| Area | Key Files | Common Issues |
|------|-----------|---------------|
| **Positioning** | `event-utils.ts` | Wrong top/height/left/width calculations |
| **Drag** | `use-event-drag.ts` | Snap math, cross-day boundaries, auto-scroll |
| **Resize** | `use-event-resize.ts` | Anchor model, edge flipping, min duration |
| **All-day** | `use-all-day-resize.ts` | Column span calculation, row stacking |
| **Rendering** | `week-view-*.tsx` | Z-index, overflow, conditional classes |
| **State** | `page.tsx` | Event updates, selection, dirty tracking |
| **Styling** | `globals.css` | CSS variables, dark mode, color tokens |

### Step 3: Diagnose

#### For Positioning Bugs

1. Log the event data: `start`, `end`, `allDay`, `multiDay`
2. Check `calculatePositionedEvents()` output: `top`, `height`, `left`, `width`
3. Verify `segmentPosition` is correct: `"full"`, `"start"`, `"middle"`, `"end"`
4. Check column assignment: `assignColumns()` output

#### For Drag/Resize Bugs

1. Add temporary logging to the handler ref functions
2. Check `dragRef.current` / `resizeRef.current` intermediate state
3. Verify snap math: `snapToGrid(minutes)` should round to `SNAP_MINUTES` (15)
4. Check boundary clamping: events shouldn't exceed 0:00–24:00
5. Verify cleanup: are event listeners properly removed?

#### For Rendering Bugs

1. Inspect with browser DevTools — check computed styles
2. Look for z-index conflicts (follow the z-index scale in CLAUDE.md)
3. Check `cn()` usage — are conditional classes applied correctly?
4. Verify CSS variable values in light vs dark mode

#### For State Bugs

1. Check if `handleEventChange` creates a new array (immutability)
2. Verify `useMemo` dependencies include all relevant state
3. Check if `selectedEventId` is stale after event deletion
4. Look for race conditions between state updates and ref reads

### Step 4: Fix

1. Make the minimal change that fixes the bug
2. Verify the fix doesn't break adjacent behavior
3. Run: `pnpm lint && pnpm typecheck && pnpm format:check`
4. Test the original reproduction steps

### Step 5: Verify

- [ ] Original bug is fixed
- [ ] No regressions in related interactions
- [ ] Both light and dark mode work
- [ ] Edge cases tested (midnight boundary, multi-day events, overlapping events)

## Common Gotchas

### Ref vs State Timing

Problem: Value is stale in a callback.
Cause: Callback captures state at creation time.
Fix: Read from `ref.current` instead of state variable.

### Missing useEffect Cleanup

Problem: "setState on unmounted component" warning.
Cause: Event listener still fires after component unmounts.
Fix: Return cleanup function from useEffect that removes the listener.

### CSS Variable Not Applying

Problem: Color looks wrong in dark mode.
Cause: Variable defined in `:root` but not in `.dark`.
Fix: Add the variable to both selectors in `globals.css`.

### Event Positioning Off by One

Problem: Event renders in wrong column or at wrong time.
Cause: Day boundary calculation uses `startOfDay` which is timezone-sensitive.
Fix: Ensure all date comparisons use the same timezone context (date-fns defaults).

### Drag Snapping Feels Wrong

Problem: Event snaps to unexpected time slot.
Cause: `SNAP_MINUTES` rounding combined with offset calculation.
Fix: Check `snapToGrid()` and verify `cursorOffsetMinutes` is subtracted before snapping.
