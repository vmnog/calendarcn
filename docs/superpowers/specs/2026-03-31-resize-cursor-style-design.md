# Resize Cursor Style Change

## Summary

Replace resize cursor styles so edges use `col-resize` (horizontal) and `row-resize` (vertical) instead of the current `ew-resize` and `ns-resize`. This gives a more distinct visual cue that the edge is resizable (the double-bar appearance of `col-resize`/`row-resize`) vs a generic directional arrow.

## Scope

Direct string replacement of cursor values — no new components, no new abstractions.

### Changes

| Location | Current | New |
|---|---|---|
| Timed event top/bottom edge hover | `ns-resize` | `row-resize` |
| Timed event active resize (on `document.body`) | `ns-resize` | `row-resize` |
| All-day event left/right edge hover | `ew-resize` | `col-resize` |
| All-day event active resize (on `document.body`) | `ew-resize` | `col-resize` |

### Files

1. `src/components/calendar-event-item.tsx` — mousemove cursor assignment for both timed (`ns-resize` → `row-resize`) and all-day (`ew-resize` → `col-resize`) events
2. `src/hooks/use-event-resize.ts` — `document.body.style.cursor` during active vertical resize
3. `src/hooks/use-all-day-resize.ts` — `document.body.style.cursor` during active horizontal resize

## Out of Scope

- Adding visible resize handle elements
- Changing hotzone sizes
- Changing grab/grabbing cursors for move operations
