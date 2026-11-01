# src/hooks/ — Local Context

## What Lives Here

Custom React hooks for complex interactive behaviors: drag, resize, and scroll.

## Hook Architecture

All interaction hooks follow the same pattern:

```
Options interface → Return interface → Constants → Helper functions → Hook function
```

Inside the hook:

1. React state for the "public" state consumers see
2. Refs for all options/props (synced via `useEffect`)
3. Refs for intermediate state during interactions
4. Refs for global event handlers
5. `useEffect` to initialize handlers
6. `useEffect` for cleanup

## Critical Pattern: Ref-Based State

Hooks store temporary interaction state (e.g., drag position) in `ref.current` and only commit to React state at specific moments. This avoids re-rendering on every pointermove.

```ts
// Correct: update ref during interaction, commit to state on completion
dragRef.current = { ...dragRef.current, newStart };
setDragState({ ...dragRef.current }); // only on specific events

// Wrong: setState on every pointermove
setDragState({ ...dragState, newStart }); // causes re-render flood
```

## Critical Pattern: Ref Sync for Closures

Every prop/option must be synced to a ref so that global event handlers (which are closures) always read the latest value:

```ts
const onEventChangeRef = useRef(onEventChange);
useEffect(() => {
  onEventChangeRef.current = onEventChange;
}, [onEventChange]);
```

Without this, the handler would capture a stale `onEventChange` from when the effect first ran.

## Gotchas

### Missing Cleanup

Every `window.addEventListener` MUST have a corresponding `removeEventListener` in the cleanup function. Missing this causes memory leaks and ghost interactions.

### Snap Math

`snapToGrid(minutes, snapMinutes)` rounds to the provider's `snapMinutes` (15 by default), passed to the hooks as an option. Always apply snapping before committing to state. The formula:

```ts
Math.round(minutes / snapMinutes) * snapMinutes;
```

### Visible Hours

The grid's top edge is `dayStartHour`, not midnight. Convert a pointer Y to minutes from midnight with `dayStartHour * 60 + (y / hourHeight) * 60`, and clamp starts/ends to `dayStartHour * 60`..`dayEndHour * 60`.

### Cross-Day Boundaries

When drag/resize crosses a day boundary, both the start and end dates need updating. The column index determines which day, not the x-coordinate directly.

### Auto-Scroll Edge Cases

Auto-scroll triggers when the cursor is near container edges. It uses variable speed (faster near edges). Make sure to stop auto-scroll on pointerup and pointercancel — check `cleanup`.

### Pointer Events and Touch

Drag, resize and click-to-create listen to pointer events, never mouse events. Start every gesture through `usePointerGesture().startGesture`: mouse and pen start right away, touch only after a long press (`LONG_PRESS_DELAY_MS`), so a finger that moves first still scrolls. Track only the gesture's `pointerId`, treat `pointercancel` as "drop without committing", and call `suppressNextClick(pointerType)` after a real drag: when the pressed element was swapped for a ghost mid-drag, the browser's follow-up click lands on a shared ancestor and would clear the selection.
