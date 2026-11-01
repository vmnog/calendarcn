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

1. Add the color name to `EventColor` union in `src/components/week-view-types.ts`
2. Add CSS variables in `src/app/globals.css` (both `:root` and `.dark`)
3. Add the color entry to `eventColorStyles` map in `src/components/calendar-event-item.tsx`

### Adding a New Keyboard Shortcut

1. Find the `useEffect` with keyboard listener in `src/components/week-view.tsx`
2. Add a new `case` for your key
3. Check `e.target.tagName` to skip when focused on inputs
4. Document in README.md keyboard shortcuts section

### Modifying Event Types

1. Update the type in `src/components/week-view-types.ts` (the canonical source)
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
