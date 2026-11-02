import { readFile } from "node:fs/promises";
import path from "node:path";
import { createElement } from "react";
import type { ComponentType, ReactElement } from "react";

import { AgendaViewDemo } from "@/examples/agenda-view-demo";
import { CalendarDemo } from "@/examples/calendar-demo";
import { ConfigDemo } from "@/examples/config-demo";
import { ControlledEventsDemo } from "@/examples/controlled-events-demo";
import { CustomEventContentDemo } from "@/examples/custom-event-content-demo";
import { CustomEventDetailsDemo } from "@/examples/custom-event-details-demo";
import { DayViewDemo } from "@/examples/day-view-demo";
import { EventDetailsDemo } from "@/examples/event-details-demo";
import { IcsDemo } from "@/examples/ics-demo";
import { MonthViewDemo } from "@/examples/month-view-demo";
import { RangeLoadingDemo } from "@/examples/range-loading-demo";
import { TimeGridDemo } from "@/examples/time-grid-demo";
import { TypedEventsDemo } from "@/examples/typed-events-demo";
import { WeekViewDemo } from "@/examples/week-view-demo";

/** Folder the example files live in, relative to the project root */
export const EXAMPLES_DIR = "src/examples";

/**
 * Every docs example, keyed by its file name in `src/examples/` (without
 * `.tsx`). `ComponentPreview` renders the component and shows that file.
 */
const EXAMPLES = {
  "agenda-view-demo": AgendaViewDemo,
  "calendar-demo": CalendarDemo,
  "config-demo": ConfigDemo,
  "controlled-events-demo": ControlledEventsDemo,
  "custom-event-content-demo": CustomEventContentDemo,
  "custom-event-details-demo": CustomEventDetailsDemo,
  "day-view-demo": DayViewDemo,
  "event-details-demo": EventDetailsDemo,
  "ics-demo": IcsDemo,
  "month-view-demo": MonthViewDemo,
  "range-loading-demo": RangeLoadingDemo,
  "time-grid-demo": TimeGridDemo,
  "typed-events-demo": TypedEventsDemo,
  "week-view-demo": WeekViewDemo,
} satisfies Record<string, ComponentType>;

export type ExampleName = keyof typeof EXAMPLES;

export function isExampleName(name: string): name is ExampleName {
  return Object.hasOwn(EXAMPLES, name);
}

/** Renders an example's component (it takes no props) */
export function renderExample(name: ExampleName): ReactElement {
  return createElement(EXAMPLES[name]);
}

/** Repository path of an example's file, e.g. `src/examples/week-view-demo.tsx` */
export function getExamplePath(name: ExampleName): string {
  return `${EXAMPLES_DIR}/${name}.tsx`;
}

/**
 * Reads an example's source, exactly as it is on disk. Docs pages are
 * prerendered, so this runs at build time (and on every request in dev).
 */
export async function readExampleSource(name: ExampleName): Promise<string> {
  const filePath = path.join(process.cwd(), getExamplePath(name));
  const source = await readFile(filePath, "utf8");
  return source.trimEnd();
}
