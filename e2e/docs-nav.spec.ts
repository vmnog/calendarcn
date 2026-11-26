import { expect, test } from "@playwright/test";

/**
 * The docs sidebar, grouped by what the reader wants to do, and the old URLs
 * of the pages that moved into it. Registry items link to those URLs, and the
 * shadcn CLI copies the links into people's projects, so each must keep
 * answering with a permanent redirect (`DOCS_REDIRECTS` in `next.config.ts`).
 */

/** The sidebar's groups, in order */
const NAV_GROUPS = [
  "Getting started",
  "Guides",
  "Components",
  "Reference",
  "Project",
];

/** Docs pages the sidebar links */
const NAV_PAGE_COUNT = 34;

/** The Guides group's pages, in order */
const GUIDES = [
  "Your events",
  "Loading events",
  "Creating events",
  "Repeating events",
  "Time zones",
  "Meet with people",
  "Share your availability",
  "Undo and notices",
  "Customise the look",
  "Theming",
  "Import and export",
];

/** Each old page and where it answers now */
const MOVED_PAGES = [
  {
    from: "/docs/components/time-grid",
    to: "/docs/components/day-week-view#time-grid",
  },
  {
    from: "/docs/components/day-view",
    to: "/docs/components/day-week-view#day-view",
  },
  { from: "/docs/components/week-view", to: "/docs/components/day-week-view" },
  {
    from: "/docs/components/mini-calendar",
    to: "/docs/components/calendar-sidebar#mini-calendar",
  },
  {
    from: "/docs/components/calendar-list",
    to: "/docs/components/calendar-sidebar#calendar-list",
  },
  {
    from: "/docs/components/theme-toggle",
    to: "/docs/components/calendar-sidebar#theme-toggle",
  },
  {
    from: "/docs/components/sidebar-overlay",
    to: "/docs/components/calendar-sidebar#sidebar-overlay",
  },
  {
    from: "/docs/components/people-picker",
    to: "/docs/guides/meet-with-people",
  },
  {
    from: "/docs/components/scheduling",
    to: "/docs/guides/share-your-availability",
  },
  {
    from: "/docs/components/calendar-toaster",
    to: "/docs/guides/undo-and-notices",
  },
  { from: "/docs/components/calendar-core", to: "/docs/reference/api" },
  { from: "/docs/loading-events", to: "/docs/guides/loading-events" },
  { from: "/docs/import-export", to: "/docs/guides/import-export" },
  {
    from: "/docs/keyboard-shortcuts",
    to: "/docs/reference/keyboard-shortcuts",
  },
  { from: "/docs/sample-data", to: "/docs/reference/sample-data" },
  { from: "/docs/roadmap", to: "/docs/project/roadmap" },
  { from: "/docs/changelog", to: "/docs/project/changelog" },
];

test("the sidebar lists the five groups in order, with every page", async ({
  page,
}) => {
  await page.goto("/docs");
  const sidebar = page.locator("#nd-sidebar");

  const groups = await sidebar
    .locator("p")
    .evaluateAll((titles) =>
      titles.map((title) => title.textContent?.trim() ?? ""),
    );
  expect(groups.filter((title) => NAV_GROUPS.includes(title))).toEqual(
    NAV_GROUPS,
  );
  await expect(sidebar.locator('a[href^="/docs"]')).toHaveCount(NAV_PAGE_COUNT);
});

for (const { from, to } of MOVED_PAGES) {
  test(`${from} redirects to ${to}`, async ({ request }) => {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers()["location"]).toBe(to);

    // The page's Markdown follows it, without the section
    const markdown = await request.get(`${from}.md`, { maxRedirects: 0 });
    expect(markdown.status()).toBe(308);
    expect(markdown.headers()["location"]).toBe(`${to.split("#")[0]}.md`);

    expect((await request.get(to)).status()).toBe(200);
  });
}

test("the Guides group lists its pages in order", async ({ page }) => {
  await page.goto("/docs");
  const links = await page
    .locator('#nd-sidebar a[href^="/docs"]')
    .evaluateAll((anchors) =>
      anchors.map((anchor) => anchor.textContent?.trim() ?? ""),
    );
  const start = links.indexOf(GUIDES[0]);

  expect(links.slice(start, start + GUIDES.length)).toEqual(GUIDES);
});

/** Old Calendar Core anchors and where they end: a guide, or the API page itself */
const CORE_ANCHORS = [
  {
    from: "/docs/components/calendar-core#creating-events",
    to: "/docs/guides/creating-events#creating-events",
  },
  {
    from: "/docs/components/calendar-core#time-zone",
    to: "/docs/guides/time-zones#time-zone",
  },
  {
    from: "/docs/components/calendar-core#calendarprovider",
    to: "/docs/reference/api#calendarprovider",
  },
];

for (const { from, to } of CORE_ANCHORS) {
  test(`${from} ends on ${to}`, async ({ page }) => {
    await page.goto(from);
    await expect(page).toHaveURL(new RegExp(`${to}$`));
    const [, anchor] = to.split("#");
    await expect(page.locator(`[id="${anchor}"]`)).toBeVisible();
  });
}
