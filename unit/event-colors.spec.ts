import { expect, test } from "@playwright/test";

import type { CalendarInfo } from "../src/components/calendar-types";
import {
  EVENT_COLORS,
  getEventColorName,
  getEventColorStyle,
  resolveEventColorStyle,
} from "../src/lib/event-utils";

/**
 * Event colors as CSS variables (`getEventColorStyle()` in
 * `src/lib/event-utils.ts`): an event's element sets `--event`, `--event-bg`,
 * `--event-border`, `--event-strong` and `--event-muted` from the color's
 * own `--event-<name>*` variables, so a color can be any name an app's CSS
 * backs. How they draw is tested in `e2e/theming.spec.ts`.
 */

/** A style object's custom properties, as plain text */
function variables(style: object): Record<string, string> {
  return Object.fromEntries(Object.entries(style));
}

const calendars: CalendarInfo[] = [
  { id: "work", name: "Work", color: "green" },
  { id: "club", name: "Club", color: "teal" },
];

test("one of the seven colors reads its own variables, with no fallback", () => {
  expect(variables(getEventColorStyle("red"))).toEqual({
    "--event": "var(--event-red)",
    "--event-bg": "var(--event-red-bg)",
    "--event-border": "var(--event-red-border)",
    "--event-strong": "var(--event-red-strong)",
    "--event-muted": "var(--event-red-muted)",
  });
  for (const color of EVENT_COLORS) {
    for (const value of Object.values(variables(getEventColorStyle(color)))) {
      expect(value).not.toContain(",");
    }
  }
});

test("a color of your own falls back to blue when its variables are missing", () => {
  const style = variables(getEventColorStyle("teal"));
  expect(style["--event"]).toBe("var(--event-teal, var(--event-blue))");
  expect(style["--event-bg"]).toBe(
    "var(--event-teal-bg, var(--event-blue-bg))",
  );
  expect(style["--event-border"]).toBe(
    "var(--event-teal-border, var(--event-blue-border))",
  );
});

test("the two text shades are optional: a color without them uses its own text color", () => {
  const style = variables(getEventColorStyle("teal"));
  expect(style["--event-strong"]).toBe(
    "var(--event-teal-strong, var(--event-teal, var(--event-blue-strong)))",
  );
  expect(style["--event-muted"]).toBe(
    "var(--event-teal-muted, var(--event-teal, var(--event-blue-muted)))",
  );
});

test("an event falls back to its calendar's color before blue", () => {
  const style = variables(
    resolveEventColorStyle({ color: "teal", calendarId: "work" }, calendars),
  );
  expect(style["--event"]).toBe("var(--event-teal, var(--event-green))");
  expect(style["--event-strong"]).toBe(
    "var(--event-teal-strong, var(--event-teal, var(--event-green-strong)))",
  );
});

test("an event without a color takes its calendar's, then blue", () => {
  expect(
    variables(resolveEventColorStyle({ calendarId: "work" }, calendars))[
      "--event"
    ],
  ).toBe("var(--event-green)");
  // The calendar's own color is a custom one: blue stands behind it
  expect(
    variables(resolveEventColorStyle({ calendarId: "club" }, calendars))[
      "--event"
    ],
  ).toBe("var(--event-teal, var(--event-blue))");
  expect(variables(resolveEventColorStyle({}, calendars))["--event"]).toBe(
    "var(--event-blue)",
  );
});

test("a name that can't be part of a variable's name is never written into CSS", () => {
  for (const name of ["", "red; color: blue", "my color", "1st", "a)b"]) {
    const style = variables(getEventColorStyle(name, "green"));
    for (const value of Object.values(style)) {
      expect(value).not.toContain(name || "--event-,");
    }
    expect(style["--event"]).toBe("var(--event-green)");
  }
});

test("a color's name reads as words", () => {
  expect(getEventColorName("red")).toBe("Red");
  expect(getEventColorName("teal")).toBe("Teal");
  expect(getEventColorName("light-blue")).toBe("Light blue");
  expect(getEventColorName("brand_pink")).toBe("Brand pink");
});
