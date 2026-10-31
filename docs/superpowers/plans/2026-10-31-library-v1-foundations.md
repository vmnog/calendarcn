# Library v1 Foundations Plan

> **For agentic workers:** Execute ONE task per agent, in order. Tasks touch overlapping files (`week-view*.tsx`, hooks, `calendar-event-item.tsx`), so they must never run in parallel. Do not commit. Do not touch `research_notes/` or `reports/`.

**Goal:** Turn CalendarCN from a demo app into a library that can be split into installable shadcn registry items. This plan covers the 5 must-fix gaps that come before the registry work (registry, docs and directory submission are a follow-up plan).

**Why:** Today the calendar only works inside `src/app/page.tsx`, which holds 688 lines of state, navigation and shortcuts. Anyone installing `week-view` alone would have to rebuild all of it. The views also leak demo layout props, can't render custom event content, hard-code config (15-minute snap, `weekStartsOn: 0`, English), only work with a mouse, and have almost no accessibility semantics.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, date-fns 4, shadcn/ui

**Target registry split (follow-up plan, shapes the boundaries here):**

| Item            | Contents                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------- |
| `calendar-core` | types, `event-utils`, `use-now`, `CalendarProvider` + `useCalendar`, `--event-*` CSS vars |
| `time-grid`     | hourly grid, all-day row, time axis, now line, drag/resize hooks                          |
| `day-view`      | thin wrapper on `time-grid` (`view="day"`)                                                |
| `week-view`     | thin wrapper on `time-grid` (`view="week"`, `numberOfDays`)                               |
| `month-view`    | month grid, day cells, event bars, month drag/resize                                      |
| `event-details` | detail panel, popover, context menu                                                       |
| `calendar`      | full Notion-style block: all of the above + toolbar, view switcher, command menu          |

Nothing in this plan may import demo-only code into library code: `mock-events`, `agentation`, `@vercel/analytics`, `next-themes`, sidebars, `team-switcher`, `nav-*`.

---

## Task 1: `CalendarProvider` + `useCalendar`, views read from context

**Outcome:** All calendar state and navigation lives in a provider. `page.tsx` becomes a thin demo that composes the provider, views and demo-only chrome.

**Create:** `src/components/calendar-provider.tsx` exporting `CalendarProvider` and `useCalendar()` (throws outside the provider, like `useSidebar()`).

**Provider props** (controlled + uncontrolled pairs, shadcn/Radix style):

- `events` / `defaultEvents` / `onEventsChange`
- `view` / `defaultView` / `onViewChange`
- `date` / `defaultDate` / `onDateChange`
- `weekStartsOn` (default `0`); replaces every hard-coded `{ weekStartsOn: 0 }` in navigation and header math
- `numberOfDays` / `defaultNumberOfDays` / `onNumberOfDaysChange` (state only here; Task 3 makes the grid honor it)
- `defaultViewSettings` (`showWeekends`, `showDeclinedEvents`, `showWeekNumbers`)
- `createEvent?: (range: NewEventRange) => CalendarEvent | null`: factory for click-created events (default: `{ id: crypto.randomUUID(), title: "New event", start, end }`). The demo passes its random-color + primary-calendar factory here.
- `onEventCreate?`, `onEventUpdate?` notification callbacks

**`useCalendar()` returns:** `events`, `view`, `currentDate`, `numberOfDays`, `viewSettings`, `visibleDays`, `selectedEventId`, `selectedEvent`, `highlightedDate`, header info (`monthName`, `year`, `weekNumber`), and actions `goToToday`, `goToPrev`, `goToNext`, `goToDate`, `switchView`, `setNumberOfDays`, `selectEvent`, `clearSelection`, `addEventFromRange`, `updateEvent`, `toggleWeekends`, `toggleDeclinedEvents`, `toggleWeekNumbers`, `showDay` (the current `handleMoreClick`). Names may be refined, but keep the surface this small.

**Create:** `src/hooks/use-calendar-shortcuts.ts`: opt-in hook for the calendar's own single-key shortcuts (T, J/K/arrows, D/1, W/0, 2-9, m, Escape), skipping inputs/textareas exactly as today. App shortcuts (Cmd+K, Cmd+/, /, Shift+M theme, Shift+Cmd+E/D) stay in `page.tsx`.

**Views:** `WeekView` and `MonthView` read state and actions from `useCalendar()` instead of props. Remove `events`, `currentDate`, `selectedEventId`, `onEventClick`, `onBackgroundClick`, `onEventCreate`, `onEventChange`, `onDateChange`, `onPrevWeek`, `onNextWeek`, `highlightedDate`, `onVisibleDaysChange`, `onClosePopover` from their props. Replace demo layout props:

- `isSidebarOpen` → `showEventPopover?: boolean` (default `true`)
- `onDockToSidebar` → `onEventPopoverExpand?: () => void` (hide the expand/dock button when absent)

`EventTitleFocusProvider` / title-focus state moves into the provider (it is library behavior: focus the title of a just-created event).

**Keep in `page.tsx`:** sidebars and their open state, command menu, theme cycling, header chrome, mock data, media queries, `useIsClient` gate.

**Acceptance:** demo behaves identically (views, navigation, drag, resize, create, popover, side panel, all shortcuts, month "+N more", mini-calendar sync). Prop interfaces live in `week-view-types.ts` / `calendar-types.ts`. `pnpm lint && pnpm typecheck && pnpm format:check && pnpm build` pass.

---

## Task 2: Render slots + generic event type

**Outcome:** Consumers can render their own event content and details, and attach their own fields to events with full type safety.

- Make the provider and hook generic: `CalendarProvider<TEvent extends CalendarEvent = CalendarEvent>`, `useCalendar<TEvent>()`. Callbacks and `selectedEvent` are typed as `TEvent`.
- Slim the base `CalendarEvent` to what the calendar needs (`id`, `title`, `start`, `end`, `isAllDay?`, `color?`). Move the Notion-detail fields (`calendarId`, `description`, `location`, `timezone`, `recurrence`, `reminders`, `status`, `visibility`, `calendarEmail`) to a `DetailedCalendarEvent` type used by the detail panel/popover and the demo.
- Provider render props (no `any`): `renderEventContent?: (props: EventContentProps<TEvent>) => ReactNode` (time grid + month items; props include `event`, `view`, `isSelected`, `isPast`, `isDragging`, `isResizing`, time label) and `renderEventDetails?: (props: { event: TEvent; close: () => void }) => ReactNode` (popover body). Defaults reproduce today's rendering exactly.

**Acceptance:** demo unchanged with defaults; a temporary local check that a custom `renderEventContent` renders (remove before finishing). Checks pass.

---

## Task 3: Config props

**Outcome:** The hard-coded behavior becomes provider config, with defaults equal to today's behavior.

- `snapMinutes` (default `15`): replace every use of `SNAP_MINUTES` in hooks and `event-utils` with the configured value.
- `dayStartHour` / `dayEndHour` (default `0` / `24`): the time grid renders only that range; `hourHeight` fills the container for that range; events outside are clipped to the edges; drag/resize/create clamp to the range.
- `hourCycle: 12 | 24` (default: today's format): time axis, event time labels, detail panel times.
- `locale?: Locale` (date-fns, default `enUS`): pass to every `format()` / week math call in library code (day headers, month names, popover, panel, time axis).
- Make the time grid honor `numberOfDays` from Task 1 for `view="week"` (render N columns starting at `currentDate`). Navigation by N days for N < 7. Keep 7-day behavior identical.

**Acceptance:** defaults look identical; manually check `hourCycle: 24`, `locale: ptBR`, `snapMinutes: 30`, `dayStartHour: 8 / dayEndHour: 20`, and N = 3 in the browser, then restore demo defaults. Checks pass.

---

## Task 4: Pointer events (touch drag/resize)

**Outcome:** Drag, resize and click-to-create work with mouse, touch and pen.

- Replace `mousedown` / `mousemove` / `mouseup` with pointer events in `use-event-drag`, `use-event-resize`, `use-all-day-resize`, `use-month-event-drag`, `use-month-event-resize` and the components that attach `onMouseDown`. Handle `pointercancel`. Use `setPointerCapture` where it simplifies tracking. Ignore non-primary buttons and non-primary pointers.
- Mouse/pen: start immediately, as today.
- Touch: long-press (~350 ms, cancel if the finger moves > 8 px first) to start a drag/resize/create, so normal vertical and horizontal scrolling still works. Apply `touch-action: none` only to an element while it is being dragged.
- Constants in ALL_CAPS with JSDoc.

**Acceptance:** mouse behavior unchanged; touch drag/resize verified with touch emulation (Playwright `hasTouch` or the browser pane's mobile preset); scrolling still works on touch. Checks pass.

---

## Task 5: Baseline accessibility

**Outcome:** The calendar is usable with a keyboard and understandable to screen readers.

- Events are focusable (`tabIndex={0}`, `role="button"` or real `<button>`), with `aria-label` like "Team sync, 3:00 PM to 4:00 PM, Tuesday, October 31" (locale-aware via Task 3) and `aria-pressed` for selection. Enter/Space selects/opens; Escape keeps working.
- Keyboard move/resize on a focused event: Alt+ArrowUp/Down moves by `snapMinutes`, Alt+ArrowLeft/Right moves by one day, Alt+Shift+ArrowUp/Down resizes the end. Commit through `updateEvent`.
- One polite `aria-live` region in the provider announcing moves, resizes, creates ("Moved Team sync to Wednesday 3:00 PM").
- Day columns and month cells get accessible labels (`role="gridcell"` / `aria-label` with the full date); "+N more" buttons are labeled; the now line is `aria-hidden`.
- Respect `prefers-reduced-motion` for scroll/snap animations.

**Acceptance:** tab through events, move one with the keyboard, confirm the live region text; no visual change for mouse users. Checks pass.

---

## Verification (after each task, and once at the end)

1. `pnpm lint && pnpm typecheck && pnpm format:check && pnpm build`
2. Run the demo (`.claude/launch.json` → `next-dev`) and check: week/day/month views, prev/next/today, drag + resize (timed, all-day, month), click-to-create (title focuses), popover and side panel, command menu, keyboard shortcuts, dark mode.
3. Screenshot the result.
