import type { ExampleName } from "@/components/docs/examples";

/**
 * The `registry.json` item each docs example belongs to: the one its page
 * documents. The Prompt tab builds its install command from it, and adds the
 * other items the example's imports need.
 *
 * `satisfies` makes `pnpm typecheck` fail when an example in `examples.ts`
 * has no entry here.
 */
export const EXAMPLE_ITEMS = {
  "agenda-view-demo": "agenda-view",
  "calendar-demo": "calendar",
  "calendar-header-demo": "calendar-header",
  "calendar-toaster-demo": "calendar-toaster",
  "command-menu-demo": "command-menu",
  "config-demo": "calendar-core",
  "controlled-events-demo": "calendar-core",
  "custom-event-content-demo": "calendar-core",
  "custom-event-details-demo": "event-details",
  "day-view-demo": "day-view",
  "event-details-demo": "event-details",
  "ics-demo": "ics",
  "month-view-demo": "month-view",
  "range-loading-demo": "calendar-core",
  "sample-data-demo": "sample-data",
  "secondary-time-zone-demo": "calendar-core",
  "time-zone-demo": "calendar-core",
  "time-grid-demo": "time-grid",
  "typed-events-demo": "calendar-core",
  "week-view-demo": "week-view",
  "year-view-demo": "year-view",
  // The demo's sidebars
  "calendar-list-demo": "calendar-list",
  "calendar-sidebar-demo": "calendar-sidebar",
  "details-sidebar-demo": "details-sidebar",
  "mini-calendar-demo": "mini-calendar",
  "sidebar-overlay-demo": "sidebar-overlay",
  "theme-toggle-demo": "theme-toggle",
} satisfies Record<ExampleName, string>;
