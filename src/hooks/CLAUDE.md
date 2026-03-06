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

Hooks store temporary interaction state (e.g., drag position) in `ref.current` and only commit to React state at specific moments. This avoids re-rendering on every mousemove.

```ts
// Correct: update ref during interaction, commit to state on completion
dragRef.current = { ...dragRef.current, newStart };
setDragState({ ...dragRef.current }); // only on specific events

// Wrong: setState on every mousemove
setDragState({ ...dragState, newStart }); // causes re-render flood
```

## Critical Pattern: Ref Sync for Closures

Every prop/option must be synced to a ref so that global event handlers (which are closures) always read the latest value:

```ts
const onEventChangeRef = useRef(onEventChange);
useEffect(() => { onEventChangeRef.current = onEventChange; }, [onEventChange]);
```

Without this, the handler would capture a stale `onEventChange` from when the effect first ran.

## Gotchas

### Missing Cleanup

Every `window.addEventListener` MUST have a corresponding `removeEventListener` in the cleanup function. Missing this causes memory leaks and ghost interactions.

### Snap Math

`snapToGrid(minutes)` rounds to `SNAP_MINUTES` (15 by default). Always apply snapping before committing to state. The formula:

```ts
Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES
```

### Cross-Day Boundaries

When drag/resize crosses a day boundary, both the start and end dates need updating. The column index determines which day, not the x-coordinate directly.

### Auto-Scroll Edge Cases

Auto-scroll triggers when the cursor is near container edges. It uses variable speed (faster near edges). Make sure to stop auto-scroll on mouseup — check the cleanup in `handleMouseUp`.
