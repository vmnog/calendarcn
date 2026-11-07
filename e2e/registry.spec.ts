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
  "calendar",
  "ics",
  // The demo's sidebars
  "sidebar-overlay",
  "theme-toggle",
  "mini-calendar",
  "calendar-list",
  "calendar-sidebar",
  "details-sidebar",
];

/** The parts of a built registry item the tests read */
interface BuiltRegistryItem {
  name: string;
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
