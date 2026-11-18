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

/** Items whose `docs` the CLI prints after an install: the next step and a docs link */
const ITEMS_WITH_NEXT_STEP = [
  "calendar",
  "calendar-app",
  "calendar-core",
  "day-view",
  "week-view",
];

/** Where every `docs` line sends people */
const DOCS_URL = "https://calendarcn.xyz/docs";

/** The parts of a built registry item the tests read */
interface BuiltRegistryItem {
  name: string;
  type: string;
  author?: string;
  categories?: string[];
  docs?: string;
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

    // What `shadcn view` and the shadcn MCP server show about the item
    expect(item.author).toMatch(/\S/);
    expect(item.categories?.length).toBeGreaterThan(0);
    if (ITEMS_WITH_NEXT_STEP.includes(name)) {
      expect(item.docs).toContain(DOCS_URL);
    }

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
  // Like every item: who made it, where it's filed, and its next step
  expect(theme.author).toMatch(/\S/);
  expect(theme.categories?.length).toBeGreaterThan(0);
  expect(theme.docs).toContain(DOCS_URL);
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

test("the Installation page starts with one command and says what the calendar needs", async ({
  page,
}) => {
  await page.goto("/docs/installation");
  const article = page.locator("article");

  // The first command adds the full calendar, with nothing to set up before it
  await expect(article.locator("pre").first()).toHaveText(
    /shadcn@latest add @calendarcn\/calendar$/,
  );
  await expect(
    article.getByRole("heading", { name: "Add the registry" }),
  ).toHaveCount(0);

  await expect(
    article.getByRole("heading", { name: "Requirements" }),
  ).toBeVisible();
  const requirements = article.getByRole("table").first();
  for (const row of [
    "Tailwind CSS",
    "React",
    "Framework",
    "shadcn CLI",
    "Monorepo",
    "Server components",
  ]) {
    await expect(
      requirements.getByRole("row").filter({ hasText: row }).first(),
    ).toBeVisible();
  }

  // Every command on the page runs the latest CLI
  const commands = await article.locator("pre").allTextContents();
  const shadcnCommands = commands.filter((command) =>
    /\bshadcn\b/.test(command),
  );
  expect(shadcnCommands.length).toBeGreaterThan(5);
  for (const command of shadcnCommands) {
    expect(command).toContain("shadcn@latest ");
  }
});
