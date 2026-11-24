"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Calendar } from "@/components/calendar";
import { createSampleEvents } from "@/lib/sample-events";

/**
 * The calendar's own tokens, set the way an app sets them: in CSS, under
 * `:root` and `.dark`. In your project these lines go in your global CSS
 * file, below the defaults `shadcn add` wrote there.
 *
 * They are set for the whole page rather than on a wrapper: menus, toasts
 * and the event details render in a portal on `<body>`, outside the calendar.
 */
const INDIGO_TOKENS = `
:root {
  --calendar-menu: #eef2ff;
  --calendar-menu-border: #c7d2fe;
  --calendar-menu-foreground: #312e81;
  --calendar-menu-muted-foreground: #6366f1;
  --calendar-menu-accent: #c7d2fe;
  --calendar-menu-accent-foreground: #1e1b4b;
  --calendar-detail-focus: #eef2ff;
  --calendar-detail-hover-border: #c7d2fe;
  --calendar-selection: #4f46e5;
  --calendar-selection-foreground: #ffffff;
  --calendar-weekend: #f5f7ff;
}

.dark {
  --calendar-menu: #1e1b4b;
  --calendar-menu-border: #3730a3;
  --calendar-menu-foreground: #e0e7ff;
  --calendar-menu-muted-foreground: #a5b4fc;
  --calendar-menu-accent: #3730a3;
  --calendar-menu-accent-foreground: #ffffff;
  --calendar-detail-focus: #26235a;
  --calendar-detail-hover-border: #4338ca;
  --calendar-selection: #818cf8;
  --calendar-selection-foreground: #1e1b4b;
  --calendar-weekend: #1b1a2e;
}
`;

/** The two looks the example switches between */
const THEMES = [
  { id: "app", label: "Your theme" },
  { id: "indigo", label: "Indigo tokens" },
] as const;

type ThemeId = (typeof THEMES)[number]["id"];

export function ThemingDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));
  const [theme, setTheme] = React.useState<ThemeId>("app");

  return (
    <div className="flex h-full flex-col">
      {theme === "indigo" && <style>{INDIGO_TOKENS}</style>}
      <div
        role="group"
        aria-label="Calendar tokens"
        className="flex shrink-0 items-center gap-1 border-b p-2 text-xs"
      >
        {THEMES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={theme === id}
            onClick={() => setTheme(id)}
            className={cn(
              "rounded-md px-2.5 py-1 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
              theme === id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {label}
          </button>
        ))}
        <span className="ml-2 text-muted-foreground">
          Click an event, then open one of its menus.
        </span>
      </div>
      {/* Two calendars share this page: their single-key shortcuts are off */}
      <Calendar
        defaultEvents={initialEvents}
        shortcuts={false}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
