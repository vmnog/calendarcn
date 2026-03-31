# Resize Cursor Style Change Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `ns-resize` with `row-resize` and `ew-resize` with `col-resize` on event resize edge hovers and active resize operations.

**Architecture:** Direct string replacement in two files. No new components or abstractions.

**Tech Stack:** React, TypeScript

---

### Task 1: Update timed event resize cursors

**Files:**
- Modify: `src/components/calendar-event-item.tsx:395,400,405`

- [ ] **Step 1: Replace `ns-resize` with `row-resize` in `handleMouseMove`**

In `src/components/calendar-event-item.tsx`, there are three occurrences of `ns-resize` in the `handleMouseMove` callback (lines 395, 400, 405). Replace all three:

```typescript
// Line 395 (compact event — entire event is resize zone)
target.style.cursor = "row-resize";

// Line 400 (top edge hotzone)
target.style.cursor = "row-resize";

// Line 405 (bottom edge hotzone)
target.style.cursor = "row-resize";
```

- [ ] **Step 2: Verify the change**

Run: `pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar-event-item.tsx
git commit -m "feat: use row-resize cursor for timed event vertical edges"
```

---

### Task 2: Update all-day event resize cursors

**Files:**
- Modify: `src/components/calendar-event-item.tsx:840,845`
- Modify: `src/hooks/use-all-day-resize.ts:111`

- [ ] **Step 1: Replace `ew-resize` with `col-resize` in `handleAllDayMouseMove`**

In `src/components/calendar-event-item.tsx`, there are two occurrences of `ew-resize` in the all-day mouse move handler (lines 840, 845). Replace both:

```typescript
// Line 840 (left edge hotzone)
target.style.cursor = "col-resize";

// Line 845 (right edge hotzone)
target.style.cursor = "col-resize";
```

- [ ] **Step 2: Replace `ew-resize` with `col-resize` in `useAllDayResize` hook**

In `src/hooks/use-all-day-resize.ts` line 111, replace the cursor set during active resize:

```typescript
document.body.style.cursor =
  resize.edge === "move" ? "grabbing" : "col-resize";
```

- [ ] **Step 3: Verify the changes**

Run: `pnpm typecheck && pnpm lint`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/calendar-event-item.tsx src/hooks/use-all-day-resize.ts
git commit -m "feat: use col-resize cursor for all-day event horizontal edges"
```

---

### Task 3: Manual verification

- [ ] **Step 1: Run dev server and verify cursors**

Run: `pnpm dev`

Verify:
1. Hover over a timed event's top/bottom edges — cursor should show `row-resize` (↕ with double bar)
2. Hover over an all-day/multi-day event's left/right edges — cursor should show `col-resize` (↔ with double bar)
3. During active vertical resize, cursor remains `row-resize`
4. During active horizontal resize, cursor remains `col-resize`
5. Move/grab cursors on all-day event centers are unchanged
