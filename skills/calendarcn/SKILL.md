---
name: calendarcn
description: Install, render, customize and update CalendarCN, a React calendar for shadcn/ui inspired by Notion Calendar, with day, week, month, year and agenda views, drag and resize, and event details. Use when a project has or wants `@calendarcn` components such as Calendar, WeekView, MonthView, CalendarProvider or useCalendar().
license: MIT
metadata:
  author: vmnog
---

# CalendarCN

CalendarCN is a React calendar that the shadcn CLI copies into a project as source files. It builds on shadcn/ui and Tailwind CSS 4, and works with both Radix and Base UI. Docs: https://calendarcn.xyz/docs

## Find the docs

- https://calendarcn.xyz/llms.txt lists every docs page.
- Every page is Markdown at its URL plus `.md`, like https://calendarcn.xyz/docs/components/week-view.md
- Read the page of the component you are about to use before you write code. Each has a working example and a table of every prop.
- Start with [Installation](https://calendarcn.xyz/docs/installation.md), [Calendar](https://calendarcn.xyz/docs/components/calendar.md) and [Calendar Core](https://calendarcn.xyz/docs/components/calendar-core.md), which documents `CalendarProvider`, `useCalendar()` and the event type.

## Install

Check first that `components.json` exists at the project root, so shadcn/ui is set up, and that the project uses Tailwind CSS 4. If either is missing, stop and say so. Setup: https://ui.shadcn.com/docs/installation

```bash
npx shadcn@latest add @calendarcn/calendar
```

- Use the project's package manager: `pnpm dlx`, `yarn dlx` or `bun x` in place of `npx`.
- `calendar` is the full calendar: a toolbar with the view switcher, today and previous/next, over the day, week, month, year and agenda views, with keyboard shortcuts. `calendar-app` is the whole live demo, with both sidebars and the ⌘K menu.
- Single pieces install the same way: `week-view`, `day-view`, `month-view`, `agenda-view`, `year-view`, `event-details`, `calendar-core`, `ics`. Each brings the items it builds on. The Installation page lists every item.
- The CLI copies the files into the project's components, hooks and lib folders, installs their npm packages and the shadcn/ui components they use, and adds the calendar's color tokens to the CSS file. The code is then source in the project: import it from `@/components/…`, not from an npm package.
- If the CLI doesn't know `@calendarcn`, add it to `registries` in `components.json` and run the command again:

```json
{
  "registries": {
    "@calendarcn": "https://calendarcn.xyz/r/{name}.json"
  }
}
```

- With the shadcn MCP server connected, list the items of the `@calendarcn` registry instead of guessing their names. The server sees the registry once it is under `registries` in `components.json`, where the first `add` writes it.

## Render

The full calendar, with events the app owns:

```tsx
"use client";

import * as React from "react";

import { Calendar } from "@/components/calendar";
import type { CalendarEvent } from "@/components/calendar-types";

export default function CalendarPage() {
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);

  return (
    <div className="h-screen">
      <Calendar events={events} onEventsChange={setEvents} />
    </div>
  );
}
```

One view, inside a provider that owns the events:

```tsx
<CalendarProvider defaultEvents={events}>
  <div className="h-[600px]">
    <WeekView scrollToHour={8} />
  </div>
</CalendarProvider>
```

## Rules

- **Render it from a client component.** `Calendar`, every view and `CalendarProvider` are client components. Put `"use client"` at the top of the file that renders the calendar. A page that only renders that file's component can stay a server component.
- **Give its parent a height.** The calendar and each view fill their parent's height and have none of their own. Wrap them in an element with one, like `<div className="h-[600px]">`.
- **An event needs `id`, `title`, `start` and `end`.** `start` and `end` are `Date` objects, not strings. `isAllDay` and `color` are optional: `red`, `orange`, `yellow`, `green`, `blue`, `purple` or `gray`, or a name of your own backed by `--event-<name>` CSS variables.
- **Hold the events one way.** Pass `events` with `onEventsChange` when the app owns them, or `defaultEvents` when the calendar does. Not both. `events` without `onEventsChange` can't change, so every drag snaps back.
- **`new Date()` fails the build only with Next.js Cache Components.** With `cacheComponents: true` in the Next.js config, `next build` fails on a `new Date()` that runs while a page prerenders, a client component's `useState` initializer included. The docs examples create their sample events that way. In such a project, wrap the component that calls it in `<Suspense>`, or create the events in an effect or an event handler, or load them from an API. Without `cacheComponents`, leave it as it is.
- **Two files are named calendar.** `@/components/calendar` is CalendarCN's `Calendar`. `@/components/ui/calendar` is the shadcn/ui date picker, which the event details use. Import the first and keep the second.
- **Views go inside a `CalendarProvider`.** `Calendar` and `CalendarApp` bring their own. `WeekView`, `DayView`, `MonthView`, `AgendaView`, `YearView`, `TimeGrid` and any component that calls `useCalendar()` need one around them.
- **Don't edit the installed files to customize.** An update overwrites them. Use props, `renderEventContent`, `renderEventDetails`, your own components built on `useCalendar()`, and the calendar's CSS variables (the `--calendar-*` tokens and the `--event-{color}` colors).

## Customize

Each is on a docs page. Reach for these before editing a copied file:

- Settings are props of `CalendarProvider` and `Calendar`: `hourCycle`, `locale`, `weekStartsOn`, `dayStartHour`, `dayEndHour`, `snapMinutes`, `timeZone`. See "Configuration" in [Calendar Core](https://calendarcn.xyz/docs/components/calendar-core.md).
- `renderEventContent` draws the inside of each event. See "Custom event content" in Calendar Core.
- `renderEventDetails` replaces the body of the details popover. See "Custom details" in [Event Details](https://calendarcn.xyz/docs/components/event-details.md).
- A header or toolbar of your own reads and changes the calendar with `useCalendar()`. See "Build your own" in [Calendar](https://calendarcn.xyz/docs/components/calendar.md).
- Every color is a CSS variable, set in `:root` and `.dark`. The `--calendar-*` tokens paint the details, menus, toasts and sidebars and default to the app's shadcn/ui theme; `--event-{color}`, `--event-{color}-bg` and `--event-{color}-border` paint events. `@calendarcn/theme-notion` adds Notion Calendar's look. See [Theming](https://calendarcn.xyz/docs/theming.md).
- `shortcuts={false}` on `Calendar` turns off the single-key shortcuts. See [Keyboard shortcuts](https://calendarcn.xyz/docs/keyboard-shortcuts.md).

## Update

There is no package version to bump. The registry serves the latest code, and running `add` again brings it into the project. Each item updates the items it builds on, so `@calendarcn/calendar` updates all of those.

1. Preview. `--dry-run` writes nothing and lists the files it would create, overwrite and skip:

   ```bash
   npx shadcn@latest add @calendarcn/calendar --dry-run
   ```

   `--diff <path>` shows what changed in one file, with the path as that list shows it:

   ```bash
   npx shadcn@latest add @calendarcn/calendar --diff components/calendar.tsx
   ```

2. Read the [Changelog](https://calendarcn.xyz/docs/changelog.md) from the day of the last update up. Each line marked **Breaking** says what to change in the project's code.
3. Commit the project's work, then overwrite:

   ```bash
   npx shadcn@latest add @calendarcn/calendar --overwrite
   ```

4. Run `git diff`. The project's own edits to the copied files show up as removed lines: put them back by hand. Then type-check and run the app before committing the update.

More: "Updating" in [Installation](https://calendarcn.xyz/docs/installation.md).
