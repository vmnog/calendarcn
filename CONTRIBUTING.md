# Contributing to CalendarCN

Thanks for your interest in contributing! This guide will help you get started.

Everyone taking part in this project is expected to follow the [Code of Conduct](./CODE_OF_CONDUCT.md). Report unacceptable behavior to [me@vmnog.com](mailto:me@vmnog.com).

## Ways to Contribute

- **Report a bug** or **suggest a feature** with an [issue template](https://github.com/vmnog/calendarcn/issues/new/choose).
- **Improve the docs.** Every page lives in `content/docs/` as MDX, and a fix there is a great first PR.
- **Pick up an issue.** Issues labeled [`good first issue`](https://github.com/vmnog/calendarcn/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22good%20first%20issue%22) are scoped for newcomers, and the [roadmap](https://calendarcn.xyz/docs/roadmap) lists the bigger plans.

## Prerequisites

- [Node.js 22+](https://nodejs.org/) (see `.nvmrc`)
- [pnpm 10+](https://pnpm.io/)

## Setup

1. Fork the repo on GitHub, then clone your fork:

   ```bash
   git clone https://github.com/<your-username>/calendarcn.git
   cd calendarcn
   ```

2. Install dependencies and start the dev server:

   ```bash
   pnpm install
   pnpm dev
   ```

3. Open [localhost:3000](http://localhost:3000) for the demo and [localhost:3000/docs](http://localhost:3000/docs) for the docs. Both reload as you edit.

## Commands

```bash
pnpm dev            # Dev server at localhost:3000 (demo at /, docs at /docs)
pnpm lint           # ESLint
pnpm typecheck      # TypeScript type checking
pnpm format         # Format code with Prettier
pnpm format:check   # Check formatting without writing
pnpm build          # Production build
pnpm test:e2e       # Playwright end-to-end suite
pnpm registry:build # Rebuild the shadcn registry in public/r
```

The first time you run the e2e suite, download its browser with `pnpm exec playwright install chromium`. The [local development runbook](docs/runbooks/local-development.md#end-to-end-tests) covers running a single test, the interactive runner and reading traces.

## Project Structure

```
content/docs/                     # Docs pages (MDX), served at /docs
e2e/                              # Playwright end-to-end tests
src/
├── app/
│   ├── page.tsx                  # Demo page around the library components
│   └── docs/                     # Docs site layout (Fumadocs)
├── components/
│   ├── ui/                       # shadcn/ui primitives (don't edit directly)
│   ├── calendar-provider.tsx     # CalendarProvider + useCalendar (state, navigation)
│   ├── calendar-types.ts         # Shared types (CalendarEvent, provider props, drag state)
│   ├── week-view-types.ts        # Component props (re-exports the shared types)
│   ├── time-grid.tsx             # TimeGrid: hourly grid behind day and week views
│   ├── day-view.tsx              # DayView (TimeGrid view="day")
│   ├── week-view.tsx             # WeekView (TimeGrid view="week")
│   ├── week-view-*.tsx           # Time grid parts: all-day row, grid, time axis, now line
│   ├── month-view*.tsx           # MonthView and its parts
│   ├── agenda-view.tsx           # AgendaView: the coming days' events as a list
│   ├── calendar-event-item.tsx   # Event rendering
│   ├── event-*.tsx               # Detail panel, popover and context menu
│   ├── event-detail-<section>.tsx # One file per details panel section (time, participants…)
│   ├── event-detail-parts.tsx    # Details panel rows, groups, class constants and menu helpers
│   ├── docs/                     # Docs-only components (previews, props tables)
│   └── sidebar-*.tsx, nav-*.tsx  # Demo sidebars and navigation
├── examples/                     # Live docs examples, shown with their source
├── hooks/                        # Drag, resize, keyboard, scroll and gesture hooks
│   ├── use-inline-edit.ts        # Inline text field of the details panel
│   └── use-hover-tooltip.ts      # Tooltip that shows after a hover
└── lib/
    ├── event-utils.ts            # Event positioning and filtering
    ├── timezone-label.ts         # Time zone labels ("GMT-3 Sao Paulo")
    ├── mock-events.ts            # Demo event data
    ├── sample-events.ts          # Docs example event data
    └── utils.ts                  # General utilities (cn)
```

### The registry

`registry.json` lists the shadcn registry items (`calendar-core`, `time-grid`, `calendar` and the rest) and the files in each. `pnpm registry:build` turns it into `public/r/*.json`, which the site serves for `npx shadcn add @calendarcn/<item>`. After you change a file that ships in an item, or add a new one, run `pnpm registry:build` and commit `public/r`. CI fails when it's out of date.

Files in the registry run in other people's projects, next to their own copies of the shadcn/ui components, Radix or Base UI. Use only the stock shadcn/ui API of `components/ui/*` that both share in them, not variants added in this repo. [`src/components/CLAUDE.md`](src/components/CLAUDE.md#registry-files) lists what that rules out.

### Docs examples

Each live preview on a docs page renders a file from `src/examples/`, and its Code tab shows that file's source. To add one, create the example, register it in `src/components/docs/examples.ts`, then use `<ComponentPreview name="your-example" />` in the MDX page.

## Code Style

- **No `any` types.** Import the correct type or create a local one.
- **Prefer early returns** over `if/else` chains or ternaries.
- **Shared types** go in `calendar-types.ts` and component props in `week-view-types.ts`, never inline in a component.
- **Do not assign `ref.current` during render.** Use `useEffect` to sync refs.
- **Use `cn()`** for conditional class names, never string concatenation.
- Run `pnpm lint && pnpm typecheck && pnpm format:check` before committing.

## Pull Request Guidelines

1. **Branch naming:** `feat/short-description`, `fix/short-description`, `docs/short-description`
2. **PR titles follow [Conventional Commits](https://www.conventionalcommits.org/):** `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`
3. **One logical change per PR.** Keep PRs focused and reviewable.
4. **Run the checks** before opening:
   ```bash
   pnpm lint && pnpm typecheck && pnpm format:check
   ```
   Changing calendar behavior (drag, resize, navigation, views)? Run `pnpm test:e2e` too.
5. **Fill out the PR template.** Attach a screenshot or short recording for any visual or interaction change.

CI runs lint, typecheck, format check, build and the e2e suite on every PR. On your first PR, a maintainer has to approve the CI run before it starts, so don't worry if checks wait at first.

## Reporting Issues

[Open a new issue](https://github.com/vmnog/calendarcn/issues/new/choose) and pick a template:

- **Bug report**: what happened, steps to reproduce, browser/OS, and timezone.
- **Feature request**: the problem you're solving and your proposed solution. Check the [roadmap](https://calendarcn.xyz/docs/roadmap) first.
- **Docs issue**: the page, and what's wrong or missing.

For anything else, open a blank issue.

## Working on an Issue

- **You can't self-assign.** GitHub only lets collaborators be assigned to issues. Comment on the issue saying you'd like to work on it, and a maintainer will assign you.
- **Forks have Issues disabled by default.** To track work on your fork, enable them under **Settings → General → Features → Issues**.
