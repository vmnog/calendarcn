# Local Development Runbook

## Setup

```bash
# Prerequisites: Node.js 22+, pnpm 9+
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
