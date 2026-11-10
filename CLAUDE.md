# CalendarCN — Claude Context

## Purpose

CalendarCN is an open-source React calendar component inspired by Notion Calendar. It provides a weekly view with drag/resize interactions, multi-day events, dark mode, and keyboard shortcuts. Built with Next.js 16, React 19, Tailwind CSS 4, and shadcn/ui.

Live: https://calendarcn.vercel.app

## Repo Map

```
src/
├── app/                  # Next.js App Router (page.tsx is the demo around the library)
├── components/
│   ├── ui/               # shadcn/ui primitives (don't edit directly)
│   ├── calendar-provider.tsx # CalendarProvider + useCalendar — state, navigation, view sync
│   ├── calendar-app.tsx  # CalendarApp block — the live demo as one component
│   ├── time-grid.tsx     # TimeGrid — hourly grid behind DayView and WeekView
│   ├── day-view.tsx      # DayView = TimeGrid view="day"
│   ├── week-view.tsx     # WeekView = TimeGrid view="week"
│   ├── week-view-*.tsx   # Time grid parts — all-day row, grid, time axis, now line
│   ├── month-view*.tsx   # MonthView and its parts
│   ├── agenda-view.tsx   # AgendaView — the coming days' events as a list
│   ├── calendar-event-*   # Event rendering & interactions
│   ├── event-*            # Context menu, detail panel, detail popover
│   ├── event-detail-<section>.tsx # One file per details panel section (time, timezone, recurrence, participants…)
│   ├── event-detail-parts.tsx # Details panel building blocks: rows, groups, class constants, menu helpers
│   ├── calendar-sidebar.tsx # Left sidebar: mini-calendar, calendar-list, theme toggle
│   ├── details-sidebar.tsx  # Right context panel: details, search, shortcuts
│   ├── sidebar-overlay.tsx  # Sidebars as a sheet on narrow screens; sidebar color tokens
│   └── theme-*            # Dark mode provider & toggle
├── hooks/                # Custom hooks (drag, resize, all-day-resize, scroll)
│   ├── use-inline-edit.ts # Inline text field: Enter commits, Escape restores
│   ├── use-hover-tooltip.ts # Open state of a tooltip shown on hover
│   └── use-field-popover.ts # Focus, blur and Escape for the details' time and date fields
└── lib/
    ├── event-utils.ts    # Event positioning & column assignment algorithms
    ├── recurrence.ts     # Repeat rules: RRULE parse/format, labels, series occurrences
    ├── time-zones.ts     # IANA zone list, offsets, zone days, wall-clock zone changes
    ├── timezone-label.ts # Short time zone labels ("GMT-3 Sao Paulo")
    ├── mock-events.ts    # Sample data
    ├── time-input.ts     # Time menu options, typed times and durations, date parsing
    └── utils.ts          # cn() helper
```

Key files:

- `src/components/week-view-types.ts` — **canonical type source** for all shared types
- `src/components/calendar-provider.tsx` — owns events, view, date and selection; adopts the mounted view's type (rule in its JSDoc)
- `src/components/time-grid.tsx` — day/week grid orchestration (days, hours, scroll buffer, drag/resize hooks)
- `src/components/calendar-app.tsx` — `CalendarApp` block: the whole live demo (sidebars, header, views, command menu, theme, .ics, shortcuts)
- `src/app/page.tsx` — demo: renders `<CalendarApp />` with the sample data, conferencing logos, avatar and links
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

**Escape rule:** Escape closes the open menu and restores the value from before it opened; hovering a row only previews it. A value commits on Enter, on click, or on blur after typing or arrow keys. Unlike Notion, Escape never commits the highlighted item. Use `closeMenuOnEscape` / `stopEscapePropagation` from `event-detail-parts.tsx` so the key never reaches the global deselect.

#### Color Tokens (hardcoded, not CSS variables)

Every interactive color needs BOTH a light value and a `dark:` value. The dark values alone are near-black and break light mode (e.g. a focused input becomes unreadable).

| Role                      | Light                                                       | Dark                                                                  |
| ------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| Muted text / icons        | `text-[#C7C5C1]`                                            | `dark:text-[#595959]`                                                 |
| Hover border              | `hover:border-[#E8E8E4]`                                    | `dark:hover:border-[#373737]`                                         |
| Focus background          | `focus:bg-[#F5F5F5]` or `has-[:focus]:bg-[#F5F5F5]`         | `dark:focus:bg-[#242424]` or `dark:has-[:focus]:bg-[#242424]`         |
| Focus border (matches bg) | `focus:border-[#F5F5F5]` or `has-[:focus]:border-[#F5F5F5]` | `dark:focus:border-[#242424]` or `dark:has-[:focus]:border-[#242424]` |
| Dropdown open bg          | `bg-[#252525]` (menus are dark in both themes today)        | same                                                                  |
| Dropdown border           | `border-[#303030]` (menus are dark in both themes today)    | same                                                                  |

#### Inline Editable Input Pattern

For any text field that edits inline (title, time, date), use `useInlineEdit` from `src/hooks/use-inline-edit.ts`. Spread its `inputProps` on the `<input>` and pass the input's ref:

```tsx
const inputRef = useRef<HTMLInputElement>(null);
const { inputProps } = useInlineEdit({
  inputRef,
  value: derivedValue, // what the field shows while it isn't being edited
  onCommit: (text) => (isValid(text) ? text : null), // null rejects and restores
  onInput: previewOnCalendar, // optional, every keystroke
  onRestore: undoPreview, // optional, after Escape or a rejected commit
  selectOnFocus: true, // time and date fields
});
```

It does what the hand-written handlers did: Enter commits by blurring, blur commits, Escape restores the value from focus without committing and stops the key from reaching the global deselect. The title previews with `onInput` on every keystroke; time inputs only commit on blur (mid-edit text like "3:" is invalid). Set `readOnly={!onEventChange}` on the input: without a change handler a section is read-only.

#### Editable Input Styling

Use the class constants in `src/components/event-detail-parts.tsx` instead of writing the classes out. Each carries the light and `dark:` values from the table above.

| Element                                                     | Class                                                                                                                   |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Standalone input (the title)                                | `EVENT_DETAIL_INPUT_CLASS`                                                                                              |
| Grouped input (icon + input, or arrow + input + label)      | `EVENT_DETAIL_INPUT_GROUP_CLASS` on the wrapper, `EVENT_DETAIL_GROUPED_INPUT_CLASS` on the input                        |
| Dropdown trigger, clickable row                             | `EVENT_DETAIL_HOVER_BORDER_CLASS`                                                                                       |
| Icon button (the "..." menu): hover border blends into fill | `EVENT_DETAIL_ICON_BUTTON_CLASS`                                                                                        |
| Text, secondary text, muted icons, placeholders             | `EVENT_DETAIL_TEXT_CLASS`, `EVENT_DETAIL_SECONDARY_CLASS`, `EVENT_DETAIL_MUTED_CLASS`, `EVENT_DETAIL_PLACEHOLDER_CLASS` |
| Menus                                                       | `EVENT_DETAIL_MENU_CLASS`, `EVENT_DETAIL_MENU_ITEM_CLASS`, `PANEL_MENU_*_CLASS`                                         |

A grouped input's wrapper gets `onClick={() => inputRef.current?.focus()}` so clicking anywhere in it focuses the input.

### Hooks Pattern

- Store all option/prop values in refs synced via `useEffect`
- Store global event handlers (`pointermove`, `pointerup`, `pointercancel`) in refs
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
pnpm test:e2e         # Playwright e2e regression suite (e2e/, see docs/runbooks/local-development.md)
pnpm test:e2e:base-ui # Install the registry into a Base UI shadcn/ui project, build it and run e2e/base-ui/
pnpm registry:build   # Rebuild public/r from registry.json (CI fails if it's stale)
```

**Before committing:** `pnpm lint && pnpm typecheck && pnpm format:check`

CI (`.github/workflows/ci.yml`) runs lint, typecheck, format check and build, plus `pnpm test:e2e` and `pnpm test:e2e:base-ui`, on every PR and on pushes to `main`.

## Docs

- `docs/architecture.md` — system architecture and data flow
- `docs/decisions/` — Architecture Decision Records (ADRs)
- `docs/runbooks/` — operational procedures
- `CONTRIBUTING.md` — full contribution guidelines
