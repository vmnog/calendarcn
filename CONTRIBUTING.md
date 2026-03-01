# Contributing to CalendarCN

Thanks for your interest in contributing! This guide will help you get started.

## Prerequisites

- [Node.js 22+](https://nodejs.org/) (see `.nvmrc`)
- [pnpm 9+](https://pnpm.io/)

## Dev Workflow

```bash
pnpm install        # Install dependencies
pnpm dev            # Start dev server at localhost:3000
pnpm lint           # Run ESLint
pnpm typecheck      # Run TypeScript type checking
pnpm build          # Production build
pnpm format         # Format code with Prettier
pnpm format:check   # Check formatting without writing
```

## Project Structure

```
src/
├── app/                          # Next.js app router
│   └── page.tsx                  # Main page, owns currentDate state
├── components/
│   ├── ui/                       # shadcn/ui primitives
│   ├── week-view.tsx             # Main week view component
│   ├── week-view-types.ts        # Canonical type definitions (EventColor, CalendarEvent, etc.)
│   ├── week-view-all-day-row.tsx # All-day event row
│   ├── week-view-day-columns.tsx # Day column headers
│   ├── week-view-grid.tsx        # Time grid
│   ├── week-view-time-axis.tsx   # Hour labels
│   ├── week-view-time-indicator.tsx # Current time line
│   ├── calendar-event-item.tsx   # Event rendering
│   ├── event-context-menu.tsx    # Right-click context menu
│   ├── event-detail-panel.tsx    # Event detail view
│   ├── calendars.tsx             # Calendar list sidebar
│   ├── sidebar-left.tsx          # Left sidebar
│   └── sidebar-right.tsx         # Right sidebar (context panel)
├── hooks/
│   ├── use-event-drag.ts         # Drag-and-drop logic
│   └── use-horizontal-scroll.ts  # Wheel-based horizontal navigation
└── lib/
    ├── event-utils.ts            # Event positioning and filtering
    ├── format-utils.ts           # Time/duration formatting helpers
    ├── mock-events.ts            # Sample event data
    └── utils.ts                  # General utilities (cn)
```

## Code Style

- **No `any` types.** Import the correct type or create a local one.
- **Prefer early returns** over `if/else` chains or ternaries.
- **Shared types** go in `week-view-types.ts` — it is the canonical type source.
- **Do not assign `ref.current` during render.** Use `useEffect` to sync refs.
- Run `pnpm lint && pnpm typecheck && pnpm format:check` before committing.

## Pull Request Guidelines

1. **Branch naming:** `feat/short-description`, `fix/short-description`
2. **One logical change per PR.** Keep PRs focused and reviewable.
3. **Run all checks** before opening:
   ```bash
   pnpm lint && pnpm typecheck && pnpm build
   ```
4. Fill out the PR template completely.

## Reporting Issues

Use the [issue templates](https://github.com/vmnog/calendarcn/issues/new/choose) to report bugs or request features.
