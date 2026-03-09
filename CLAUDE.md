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

### Interactive Element Patterns (Detail Panel)

The event detail panel follows Notion Calendar's interaction patterns. Reuse these exact patterns when adding new editable fields.

#### Color Tokens (hardcoded, not CSS variables)

| Role | Value |
|------|-------|
| Muted text / icons (light) | `text-[#C7C5C1]` |
| Muted text / icons (dark) | `dark:text-[#595959]` |
| Hover border | `hover:border-[#373737]` |
| Focus background | `focus:bg-[#242424]` or `has-[:focus]:bg-[#242424]` |
| Focus border (matches bg) | `focus:border-[#242424]` or `has-[:focus]:border-[#242424]` |
| Dropdown open bg | `bg-[#252525]` |
| Dropdown border | `border-[#303030]` |

#### Inline Editable Input Pattern

For any text field that should be editable inline (title, time, etc.):

```tsx
// State
const [value, setValue] = useState(initialValue);
const inputRef = useRef<HTMLInputElement>(null);
const escapePressedRef = useRef(false);
const valueOnFocusRef = useRef(initialValue);

// Sync from parent
useEffect(() => { setValue(derivedValue); }, [derivedValue]);

// Handlers
onFocus  → store current value in valueOnFocusRef (for Escape restore)
onChange → update local state (+ optionally call onEventChange for real-time preview)
onBlur   → validate & commit (skip if escapePressedRef is true)
onKeyDown Enter → blur (triggers commit via onBlur)
onKeyDown Escape → e.stopPropagation() + set escapePressedRef + restore original + blur
```

Key details:
- `e.stopPropagation()` on Escape prevents the global keydown handler from deselecting the event
- `escapePressedRef` prevents the blur handler from committing stale state after Escape
- For title: call `onEventChange` on every keystroke for real-time calendar preview
- For time inputs: only call `onEventChange` on blur (mid-edit text like "3:" is invalid)
- Time inputs auto-select text on focus via `requestAnimationFrame(() => ref.current?.select())`

#### Editable Input Styling

**Standalone input** (e.g., title):
```
rounded-sm border border-transparent bg-transparent outline-none
hover:border-[#373737]
focus:border-[#242424] focus:bg-[#242424]
```

**Grouped input** (e.g., icon + input, or arrow + input + label in one bordered container):
- Wrapper div gets the border/hover/focus styling using `has-[:focus]`:
  ```
  rounded-sm border border-transparent cursor-text
  hover:border-[#373737]
  has-[:focus]:border-[#242424] has-[:focus]:bg-[#242424]
  ```
- Wrapper gets `onClick={() => inputRef.current?.focus()}` so clicking anywhere focuses the input
- Inner input gets `border-none p-0 bg-transparent outline-none` (no border, wrapper handles it)

#### Non-Input Interactive Elements

**Dropdown trigger buttons** (e.g., event type selector):
```
rounded-sm border border-transparent hover:border-[#373737]
```

**Icon buttons** (e.g., "..." more menu):
```
border border-transparent hover:border-[#242424] hover:bg-[#242424]
```
This makes the hover border blend with the hover background (invisible border effect).

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
