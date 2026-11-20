import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

import registry from "../registry.json";

/**
 * The Notion Calendar theme (`theme-notion` in `registry.json`) and the live
 * demo's own CSS (`src/app/globals.css`) are the same theme, written twice:
 * the item is what an app adds, the CSS is what the demo wears. These tests
 * keep the two in step, and keep the theme optional.
 */

/** The repository root: the tests run from it */
const ROOT = path.join(__dirname, "..");

/** The demo's CSS, relative to the root */
const GLOBALS_CSS = "src/app/globals.css";

/** The docs page that says what adding the theme changes, relative to the root */
const THEMING_PAGE = "content/docs/guides/theming.mdx";

/** Name of the theme item */
const THEME_ITEM = "theme-notion";

/** Namespace the registry's items reference each other by */
const REGISTRY_NAMESPACE = "@calendarcn/";

/**
 * Variables of the demo's CSS the theme leaves to the app: its corner radius
 * and its chart colors, which Notion Calendar's look doesn't define
 */
const LEFT_TO_THE_APP = /^(?:radius|chart-\d+)$/;

/** A set of CSS variables: name (without the dashes) to value */
type Variables = Record<string, string>;

/** The parts of a `registry.json` item these tests read */
interface RegistryItem {
  name: string;
  type: string;
  registryDependencies?: string[];
  files?: { path: string }[];
  cssVars?: { theme?: Variables; light?: Variables; dark?: Variables };
}

const ITEMS = registry.items as RegistryItem[];

const css = readFileSync(path.join(ROOT, GLOBALS_CSS), "utf8");

/** The variables a rule of the demo's CSS declares, by the rule's selector */
function readRule(selector: string): Variables {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`${GLOBALS_CSS} has no "${selector}" rule`);
  const body = css.slice(
    css.indexOf("{", start) + 1,
    css.indexOf("\n}", start),
  );
  const variables: Variables = {};
  for (const [, name, value] of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    // Prettier wraps a long `var(…)` over three lines
    variables[name] = value
      .replace(/\s+/g, " ")
      .replace(/\(\s+/g, "(")
      .replace(/\s+\)/g, ")")
      .trim();
  }
  return variables;
}

/** A rule's variables without the ones the theme leaves to the app */
function themed(variables: Variables): Variables {
  return Object.fromEntries(
    Object.entries(variables).filter(([name]) => !LEFT_TO_THE_APP.test(name)),
  );
}

function getThemeItem(): RegistryItem {
  const item = ITEMS.find((entry) => entry.name === THEME_ITEM);
  if (!item) throw new Error(`registry.json has no "${THEME_ITEM}" item`);
  return item;
}

test("the theme is a registry:theme item that only writes variables", () => {
  const item = getThemeItem();
  expect(item.type).toBe("registry:theme");
  expect(item.files ?? []).toEqual([]);
  expect(item.registryDependencies ?? []).toEqual([]);
});

test("the theme's light values are the demo's :root", () => {
  expect(getThemeItem().cssVars?.light).toEqual(themed(readRule(":root")));
});

test("the theme's dark values are the demo's .dark", () => {
  expect(getThemeItem().cssVars?.dark).toEqual(
    themed(readRule("html.dark,\n.dark")),
  );
});

test("the theme sets every variable the calendar's items declare", () => {
  const theme = getThemeItem().cssVars ?? {};
  for (const item of ITEMS) {
    if (item.name === THEME_ITEM || !item.cssVars) continue;
    for (const mode of ["light", "dark"] as const) {
      const missing = Object.keys(item.cssVars[mode] ?? {}).filter(
        (name) => !(name in (theme[mode] ?? {})),
      );
      expect(missing, `${item.name} (${mode})`).toEqual([]);
    }
  }
});

test("the demo has a Tailwind color for every variable the items declare", () => {
  const theme = readRule("@theme inline");
  for (const item of ITEMS) {
    if (item.name === THEME_ITEM || !item.cssVars) continue;
    const names = new Set([
      ...Object.keys(item.cssVars.light ?? {}),
      ...Object.keys(item.cssVars.dark ?? {}),
    ]);
    for (const name of names) {
      expect(theme[`color-${name}`], `--color-${name}`).toBe(`var(--${name})`);
    }
  }
});

test("an item declares the same variables for light and dark", () => {
  for (const item of ITEMS) {
    if (!item.cssVars) continue;
    expect(Object.keys(item.cssVars.dark ?? {}), item.name).toEqual(
      Object.keys(item.cssVars.light ?? {}),
    );
  }
});

test("the Theming page counts the theme's variables right", () => {
  const names = Object.keys(getThemeItem().cssVars?.light ?? {});
  const event = names.filter((name) => /^event(?:-|$)/.test(name)).length;
  const calendar = names.filter((name) => name.startsWith("calendar-")).length;
  const shadcn = names.length - event - calendar;
  const page = readFileSync(path.join(ROOT, THEMING_PAGE), "utf8");
  expect(page).toContain(`${names.length} under \`:root\``);
  expect(page).toContain(`your ${shadcn} shadcn/ui color tokens`);
  expect(page).toContain(`the calendar's ${calendar} own tokens`);
  expect(page).toContain(`the ${event} event color variables`);
});

test("the theme is optional: no item depends on it", () => {
  const dependents = ITEMS.filter((item) =>
    (item.registryDependencies ?? []).includes(
      `${REGISTRY_NAMESPACE}${THEME_ITEM}`,
    ),
  ).map((item) => item.name);
  expect(dependents).toEqual([]);
});

test("without the theme, the calendar's own tokens follow the app's shadcn/ui tokens", () => {
  for (const item of ITEMS) {
    if (item.name === THEME_ITEM || !item.cssVars) continue;
    for (const mode of ["light", "dark"] as const) {
      for (const [name, value] of Object.entries(item.cssVars[mode] ?? {})) {
        if (!name.startsWith("calendar-")) continue;
        // A default is a shadcn/ui token, or a mix of them: never a color
        // of its own (but for the fallback of a token older themes have)
        expect(value, `${item.name}: --${name} (${mode})`).toMatch(/var\(--/);
        expect(
          value.replace("var(--destructive-foreground, #ffffff)", ""),
          `${item.name}: --${name} (${mode})`,
        ).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      }
    }
  }
});
