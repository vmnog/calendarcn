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
  author?: string;
  categories?: string[];
  docs?: string;
  registryDependencies?: string[];
  files: { path: string; content: string; type: string }[];
}

test("the registry index lists every item", async ({ request }) => {
  const response = await request.get("/r/registry.json");
  expect(response.ok()).toBe(true);
  const index = (await response.json()) as { items: { name: string }[] };

  expect(index.items.map((item) => item.name).sort()).toEqual(
    [...ITEM_NAMES].sort(),
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
    expect(item.files.length).toBeGreaterThan(0);
    for (const file of item.files) {
      expect(file.content, file.path).not.toBe("");
    }

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
