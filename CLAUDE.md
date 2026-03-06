# CalendarCN — Claude Context

## Purpose

CalendarCN is an open-source React calendar component inspired by Notion Calendar. It provides a weekly view with drag/resize interactions, multi-day events, dark mode, and keyboard shortcuts. Built with Next.js 16, React 19, Tailwind CSS 4, and shadcn/ui.

Live: https://calendarcn.vercel.app

## Repo Map

```
src/
├── app/                  # Next.js App Router (page.tsx owns top-level state)
├── components/
│   ├── ui/               # shadcn/ui primitives (don't edit directly)
│   ├── week-view*.tsx     # Core calendar — grid, columns, time axis, all-day row
│   ├── calendar-event-*   # Event rendering & interactions
│   ├── event-*            # Context menu, detail panel, detail popover
│   ├── sidebar-*          # Left/right sidebars
│   ├── nav-*              # Navigation components
│   └── theme-*            # Dark mode provider & toggle
├── hooks/                # Custom hooks (drag, resize, all-day-resize, scroll)
└── lib/
    ├── event-utils.ts    # Event positioning & column assignment algorithms
    ├── mock-events.ts    # Sample data
    └── utils.ts          # cn() helper
```

Key files:

- `src/components/week-view-types.ts` — **canonical type source** for all shared types
- `src/app/page.tsx` — owns `currentDate`, `events`, `selectedEventId` state
- `src/lib/event-utils.ts` — positioning math (column assignment, pixel calculations)
- `src/hooks/use-event-drag.ts` — drag interaction (snapping, cross-day, auto-scroll)
- `src/hooks/use-event-resize.ts` — resize interaction (anchor model, edge flipping)

## Rules

### Code Style

- **No `any` types** — import or create correct types, always
- **Prefer early returns** over if/else chains or nested ternaries
- **All shared types go in `week-view-types.ts`** — single source of truth
- **Never assign `ref.current` during render** — always use `useEffect`
- **Constants in ALL_CAPS** with JSDoc comments explaining purpose
- **Exhaustive hook dependencies** — use refs to break circular deps, never skip deps
- **Use `cn()` for class merging** — never string concatenation for conditional classes
- **`import type` for type-only imports** — keep runtime and type imports separate

### Naming

- Files: `kebab-case.tsx` / `.ts`
- Components: `PascalCase` functions
- Hooks: `useCamelCase` in `use-kebab-case.ts`
- Types/Interfaces: `PascalCase` (props: `ComponentNameProps`, state: `ComponentNameState`)
- Constants: `ALL_CAPS_SNAKE`
- Event color type: `EventColor` (union of string literals)

### Import Order

1. `"use client"` directive (if needed)
2. External libs (React, date-fns, third-party)
3. Internal: `@/lib/utils` → `@/hooks/*` → `@/components/*` → `@/lib/*`
4. Type imports with `import type` at top or grouped with their module

### Component Structure

1. `"use client"` → imports → constants → helper functions
2. Component function: props destructuring → refs → state → effects → memoized values → callbacks → JSX
3. Always type props via interface, optional with `?`

### Styling

- Tailwind utility classes for fixed styling
- Inline `style={{}}` for computed layout (top, height, left, width in px/%)
- CSS variables for colors (`globals.css` defines light/dark tokens)
- `eventColorStyles[color]` map for event color variants
- Z-index scale: events (0-2) → selected (20) → placeholder (25) → dragging (30) → portal (9999)

### Hooks Pattern

- Store all option/prop values in refs synced via `useEffect`
- Store global event handlers (`mousemove`, `mouseup`) in refs
- Use `dragRef.current` for intermediate state, commit to React state on specific events
- Clean up listeners in `useEffect` return

## Commands

```bash
pnpm dev              # Dev server
pnpm build            # Production build
pnpm lint             # ESLint
pnpm typecheck        # TypeScript check
pnpm format           # Prettier format
pnpm format:check     # Prettier check (CI)
```

**Before committing:** `pnpm lint && pnpm typecheck && pnpm format:check`

## Docs

- `docs/architecture.md` — system architecture and data flow
- `docs/decisions/` — Architecture Decision Records (ADRs)
- `docs/runbooks/` — operational procedures
- `CONTRIBUTING.md` — full contribution guidelines
