# Local Development Runbook

## Setup

```bash
# Prerequisites: Node.js 22+, pnpm 10+
pnpm install
pnpm dev
# Open http://localhost:3000
```

## Common Tasks

### Adding a New shadcn/ui Component

```bash
pnpm dlx shadcn@latest add <component-name>
```

Components install to `src/components/ui/`. Don't edit these directly — customize via Tailwind classes in the consuming component.

### Adding a New Event Color

1. Add the color name to `EventColor` union in `src/components/calendar-types.ts`
2. Add CSS variables in `src/app/globals.css` (both `:root` and `.dark`)
3. Add the color entry to `eventColorStyles` map in `src/components/calendar-event-item.tsx`

### Adding a New Keyboard Shortcut

1. Calendar keys go in `handleShortcut()` in `src/hooks/use-calendar-shortcuts.ts`. Keys for the parts around the calendar (command menu, panels, theme) go in `handleAppShortcut()`, behind an optional action of the hook (`onToggleCommandMenu` and the like), so an app without that part never claims the key
2. Single keys return early on `isTypingTarget(e.target)`, so typing in an input never triggers them
3. Wire a new app action in `src/components/calendar-app.tsx` (the live demo's block), and show its key in `command-menu.tsx` or `calendar-header.tsx` if it has a command or button there
4. Document it in `content/docs/keyboard-shortcuts.mdx`

### Modifying Event Types

1. Update the type in `src/components/calendar-types.ts` (the canonical source; component props are in `week-view-types.ts`)
2. Run `pnpm typecheck` to find all affected files
3. Update each file to handle the new type shape

## Code Quality

```bash
pnpm lint          # ESLint checks
pnpm typecheck     # TypeScript checks
pnpm format        # Auto-format with Prettier
pnpm format:check  # Check without writing
```

Always run all three before committing: `pnpm lint && pnpm typecheck && pnpm format:check`

## End-to-End Tests

A Playwright suite in `e2e/` drives the demo at `/` the way a user does: view switching, navigation, drag and resize, click-to-create, the event popover and detail panel, and the phone details sheet. Run it before merging changes to calendar behavior.

```bash
pnpm exec playwright install chromium   # once, downloads the test browser
pnpm test:e2e                           # builds, starts the app on :3100, runs the suite
pnpm test:e2e e2e/navigation.spec.ts    # one file
pnpm test:e2e --ui                      # interactive runner
pnpm exec playwright show-trace test-results/<test>/trace.zip   # inspect a failure
```

- The server is `next build && next start` on port 3100 (set `E2E_PORT` to change it), so dev-only overlays never cover the calendar. A server already listening on that port is reused, so restart it after code changes.
- The clock is frozen at Thursday, June 4 2026, 8:00 AM in `America/New_York` (`FROZEN_NOW` in `e2e/helpers.ts`). Mock events are generated relative to today, so every test sees the same dates. If you change `src/lib/mock-events.ts`, check the event titles and times the specs rely on.
- Locators use roles, labels and text first. The detail panel's time and date inputs have no label, so they carry `data-testid`s: `event-start-time`, `event-end-time`, `event-start-date`. Month view cells are found by their existing `data-date` attribute.
- Failures keep a trace in `test-results/` (gitignored).

### The Registry in a Base UI Project

`pnpm test:e2e` runs the `chromium` project, which only exercises this repo's own Radix components. The `base-ui` project checks that the registry installs and works in a shadcn/ui project set up with Base UI, like `npx shadcn add @calendarcn/calendar` in a user's app.

```bash
pnpm test:e2e:base-ui                              # install, type-check, build, then run e2e/base-ui/
pnpm exec playwright test --project=base-ui        # rerun the spec against the last build
```

- `e2e/base-ui/fixture` is the stock `npx shadcn@4.23.0 init -t next -b base -p nova` scaffold, with exact versions and without its ThemeProvider (its `d` key clashes with the calendar's day view shortcut). Keep it as generated: it stands in for a user's project.
- `tools/scripts/base-ui-fixture.sh` builds the registry from the current source, serves it on port 3201 (`BASE_UI_REGISTRY_PORT`), copies the fixture outside the repo (`$TMPDIR/calendarcn-base-ui`, or `BASE_UI_DIR`), points its `components.json` `@calendarcn` registry at the server, runs `shadcn add @calendarcn/calendar @calendarcn/command-menu @calendarcn/conference-providers @calendarcn/sample-data @calendarcn/calendar-sidebar @calendarcn/details-sidebar`, then `tsc --noEmit` and `next build`. The tested components are always the ones in `src/`, so there's no need to run `pnpm registry:build` first.
- The app is served with `next start` on port 3200 (`E2E_BASE_UI_PORT`). Its page renders `<Calendar defaultEvents={...} />` with test events on Thursday, June 4 2026, the frozen test date.
- The "Link Check" event on Friday, June 5 comes with `javascript:` and `data:` links and a `data:` file, so `links-description.spec.ts` can check they show as text, without an `href`.
- `/24-hour` renders the same calendar with `hourCycle={24}` and `weekStartsOn={1}`, for the time menu and the date picker.
- `/sidebars` renders `CalendarSidebar` and `DetailsSidebar` around the week's `TimeGrid`, inside a `SidebarProvider` and the installed `ThemeProvider`. Below 768px wide both open as sheets.
- The page also passes `conferenceProviders`: two made-up services of one kind, the second answering after a wait, with calls on example.com. `/header` puts `CalendarHeader` and `CommandMenu` around the views with the app keys of `useCalendarShortcuts`, like the live demo, with plain asides for the panels. `/read-only` renders `EventDetailPanel` without `onEventChange`, inside a `CalendarProvider` with contacts, rooms and a service, to check that nothing edits.
- The install needs network access (npm and `ui.shadcn.com`). If npm fails with `EACCES` on `~/.npm`, point it at another cache: `npm_config_cache=$TMPDIR/npm-cache pnpm test:e2e:base-ui`.
