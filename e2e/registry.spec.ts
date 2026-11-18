import { expect, test } from "@playwright/test";

/** Namespace the items reference each other by */
const REGISTRY_NAMESPACE = "@calendarcn/";

/** Every item the docs and the Installation page promise */
const ITEM_NAMES = [
  "calendar-core",
  "event-details",
  "time-grid",
  "day-view",
  "week-view",
  "month-view",
  "agenda-view",
  "year-view",
  "calendar",
  "ics",
  "conference-providers",
  "sample-data",
  "calendar-header",
  "command-menu",
  "people-picker",
  "calendar-toaster",
  "calendar-settings",
  // The demo's sidebars
  "sidebar-overlay",
  "theme-toggle",
  "mini-calendar",
  "calendar-list",
  "calendar-sidebar",
  "details-sidebar",
  // The live demo as one block
  "calendar-app",
];

/**
 * The Notion Calendar theme: the live demo's colors, as an item that only
 * writes CSS variables. Opt-in, so no other item depends on it.
 */
const THEME_ITEM = "theme-notion";

/** The parts of a built registry item the tests read */
interface BuiltRegistryItem {
  name: string;
  type: string;
  registryDependencies?: string[];
  files?: { path: string; content: string; type: string }[];
  cssVars?: {
    theme?: Record<string, string>;
    light?: Record<string, string>;
    dark?: Record<string, string>;
  };
}

test("the registry index lists every item", async ({ request }) => {
  const response = await request.get("/r/registry.json");
  expect(response.ok()).toBe(true);
  const index = (await response.json()) as { items: { name: string }[] };

  expect(index.items.map((item) => item.name).sort()).toEqual(
    [...ITEM_NAMES, THEME_ITEM].sort(),
  );
});

for (const name of ITEM_NAMES) {
  test(`${name} is served with its files and known dependencies`, async ({
    request,
  }) => {
    const response = await request.get(`/r/${name}.json`);
    expect(response.ok()).toBe(true);
    const item = (await response.json()) as BuiltRegistryItem;

    expect(item.name).toBe(name);
    const files = item.files ?? [];
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(file.content, file.path).not.toBe("");
    }

    // The theme is opt-in: installing a component never changes an app's colors
    expect(item.registryDependencies ?? []).not.toContain(
      `${REGISTRY_NAMESPACE}${THEME_ITEM}`,
    );

    // Every @calendarcn dependency resolves to another item
    const calendarDependencies = (item.registryDependencies ?? [])
      .filter((dependency) => dependency.startsWith(REGISTRY_NAMESPACE))
      .map((dependency) => dependency.slice(REGISTRY_NAMESPACE.length));
    for (const dependency of calendarDependencies) {
      expect(ITEM_NAMES).toContain(dependency);
    }
  });
}

test("the Notion Calendar theme is served as variables only", async ({
  request,
}) => {
  const response = await request.get(`/r/${THEME_ITEM}.json`);
  expect(response.ok()).toBe(true);
  const theme = (await response.json()) as BuiltRegistryItem;

  expect(theme.type).toBe("registry:theme");
  expect(theme.files ?? []).toEqual([]);
  expect(theme.registryDependencies ?? []).toEqual([]);
  // Notion Calendar's menus are dark in light mode too
  expect(theme.cssVars?.light?.["calendar-menu"]).toBe("#252525");
  expect(theme.cssVars?.dark?.["calendar-menu"]).toBe("#252525");
  expect(theme.cssVars?.light?.background).toBe("#ffffff");
  expect(theme.cssVars?.dark?.background).toBe("#191919");
});

test("without the theme, the calendar's tokens point at the app's own", async ({
  request,
}) => {
  const response = await request.get("/r/calendar-core.json");
  const core = (await response.json()) as BuiltRegistryItem;

  expect(core.cssVars?.light?.["calendar-menu"]).toBe("var(--popover)");
  expect(core.cssVars?.dark?.["calendar-menu"]).toBe("var(--popover)");
  // The CLI only names a Tailwind color for a literal one: the item names its own
  expect(core.cssVars?.theme?.["color-calendar-menu"]).toBe(
    "var(--calendar-menu)",
  );
});

test("the theme's Manual tab lists its variables instead of files", async ({
  page,
}) => {
  await page.goto("/docs/theming");
  await page.getByRole("tab", { name: "Manual" }).click();

  const manual = page.getByRole("tabpanel");
  await expect(manual.getByText("Add its variables")).toBeVisible();
  await expect(
    manual.getByText("--calendar-menu: #252525;").first(),
  ).toBeVisible();
  await expect(manual.getByText("Copy these files")).toHaveCount(0);
});

test("a component page lists the item's files in the Manual tab", async ({
  page,
}) => {
  await page.goto("/docs/components/calendar");
  await page.getByRole("tab", { name: "Manual" }).click();

  const manual = page.getByRole("tabpanel");
  await expect(manual.getByText("components/calendar.tsx")).toBeVisible();
  await expect(manual.getByRole("link", { name: "time-grid" })).toBeVisible();
  await expect(page.getByText("Coming soon")).toHaveCount(0);
});
