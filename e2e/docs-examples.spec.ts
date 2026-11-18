import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { FROZEN_NOW } from "./helpers";

/**
 * The live examples on the component pages: every one renders, with its
 * code, and no page logs an error. Then one interaction for a dozen of them,
 * each proving the point its example makes. Which examples a page must have
 * is checked without a browser in `unit/docs-examples.spec.ts`.
 */

/** Folder of the component pages */
const COMPONENT_PAGES_DIR = path.join(
  __dirname,
  "..",
  "content/docs/components",
);

/** Path the component pages are served under */
const COMPONENT_PAGES_URL = "/docs/components";

/** `<ComponentPreview name="…">` in a page's MDX */
const PREVIEW_TAG = /<ComponentPreview\s+name="([^"]+)"/g;

/**
 * What a frame holds once its example has rendered: something to press, a
 * labelled part, or a line of text (the agenda's empty state has no other)
 */
const RENDERED_PART = "button, input, [role='group'], [role='grid'], p";

/**
 * Path of the analytics script, which only exists on Vercel: a local build
 * answers 404 for it, and the browser logs that as an error
 */
const ANALYTICS_PATH = "/_vercel/";

/**
 * Errors a page is known to log under the frozen clock, by page. The example
 * at the top of Mini Calendar has no date to start from, so the server draws
 * the month the site was built in and the browser the month of its own today:
 * when the two differ, as they do with the clock frozen in June, React
 * reports that the markup didn't match (error 418) and draws it again.
 */
const KNOWN_ERRORS: Record<string, RegExp> = {
  "mini-calendar": /^Minified React error #418;/,
};

/** A component page: its name (`week-view`) and the examples its MDX names, in order */
interface ComponentPage {
  name: string;
  examples: string[];
}

const PAGES: ComponentPage[] = readdirSync(COMPONENT_PAGES_DIR)
  .filter((file) => file.endsWith(".mdx"))
  .map((file) => ({
    name: file.replace(/\.mdx$/, ""),
    examples: Array.from(
      readFileSync(path.join(COMPONENT_PAGES_DIR, file), "utf8").matchAll(
        PREVIEW_TAG,
      ),
      (match) => match[1],
    ),
  }));

/** Collects the page's console errors and uncaught exceptions */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (message.location().url.includes(ANALYTICS_PATH)) return;
    errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

/** Opens a component page with the clock frozen at FROZEN_NOW */
async function openPage(page: Page, name: string): Promise<void> {
  await page.clock.setFixedTime(FROZEN_NOW);
  await page.goto(`${COMPONENT_PAGES_URL}/${name}`);
}

/** The frame an example renders in, scrolled into view */
async function showExample(page: Page, name: string): Promise<Locator> {
  const frame = page.locator(`[data-example="${name}"]`);
  await frame.scrollIntoViewIfNeeded();
  return frame;
}

/** The tab lists of a page's examples: the ones with a Preview tab */
function exampleTabLists(page: Page): Locator {
  return page
    .getByRole("tablist")
    .filter({ has: page.getByRole("tab", { name: "Preview", exact: true }) });
}

/** An event of an example, by the start of its title */
function exampleEvent(frame: Locator, title: string): Locator {
  return frame.getByRole("button", { name: new RegExp(`^${title}`) });
}

for (const { name: pageName, examples } of PAGES) {
  test(`every example on the ${pageName} page renders, with its code`, async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await openPage(page, pageName);

    // The page draws a frame for each preview its MDX names, in order
    await expect(page.locator("[data-example]")).toHaveCount(examples.length);
    expect(
      await page
        .locator("[data-example]")
        .evaluateAll((frames) =>
          frames.map((frame) => frame.getAttribute("data-example")),
        ),
    ).toEqual(examples);

    for (const [index, example] of examples.entries()) {
      const frame = await showExample(page, example);
      const iframe = frame.locator("iframe");

      if ((await iframe.count()) > 0) {
        // A full-page block, on a page of its own: its header names the month
        await expect(
          frame.frameLocator("iframe").getByRole("heading", { level: 1 }),
        ).toBeVisible();
      } else {
        await expect(frame.locator(RENDERED_PART).first()).toBeVisible();
      }
      // Next.js draws these in place of a part that threw
      await expect(frame).not.toContainText(/Application error|Unhandled/);

      // The Code tab holds the example's own file
      const tab = exampleTabLists(page)
        .nth(index)
        .getByRole("tab", { name: "Code", exact: true });
      await tab.click();
      const panel = page.locator(
        `[id="${await tab.getAttribute("aria-controls")}"]`,
      );
      await expect(panel.locator("figcaption")).toContainText(
        `src/examples/${example}.tsx`,
      );
      await expect(panel.locator("pre")).toContainText("export function ");
    }

    const known = KNOWN_ERRORS[pageName];
    expect(errors.filter((error) => !known?.test(error))).toEqual([]);
  });
}

test("an example below the first mounts when it nears the screen", async ({
  page,
}) => {
  await openPage(page, "week-view");
  const top = page.locator('[data-example="week-view-demo"]');
  const last = page.locator('[data-example="week-view-side-panel-demo"]');

  // The top example is there at load; the last one is a frame of the same
  // height with nothing in it yet, so the page doesn't move when it mounts
  await expect(exampleEvent(top, "Customer call")).toBeVisible();
  await expect(last).toBeEmpty();
  const height = (await last.boundingBox())?.height;
  expect(height).toBe(600);

  await last.scrollIntoViewIfNeeded();
  await expect(exampleEvent(last, "Customer call")).toBeVisible();
  expect((await last.boundingBox())?.height).toBe(height);
});

test("the three-day example has three day columns", async ({ page }) => {
  await openPage(page, "week-view");
  const frame = await showExample(page, "week-view-three-days-demo");

  // The columns off screen, which sideways scrolling brings in, are inert
  const columns = frame.locator('[role="group"][aria-label]:not([inert])');
  await expect(columns).toHaveCount(3);
  await expect(columns.first()).toHaveAccessibleName(/Thursday, June 4/);
});

test("the weekdays example leaves Saturday and Sunday out", async ({
  page,
}) => {
  await openPage(page, "week-view");
  const frame = await showExample(page, "week-view-weekdays-demo");

  const columns = frame.locator('[role="group"][aria-label]:not([inert])');
  await expect(columns).toHaveCount(5);
  await expect(columns.first()).toHaveAccessibleName(/Monday, June 1/);
  await expect(columns.last()).toHaveAccessibleName(/Friday, June 5/);
});

test("the read-only details take no typing", async ({ page }) => {
  await openPage(page, "event-details");
  const frame = await showExample(page, "event-details-read-only-demo");
  const title = frame.getByPlaceholder("Title");

  await expect(title).toHaveValue("Company all-hands");
  await expect(title).toHaveAttribute("readonly", "");
  await title.click();
  await page.keyboard.type("!");
  await expect(title).toHaveValue("Company all-hands");
});

test("a click on a day of the year opens that day", async ({ page }) => {
  await openPage(page, "year-view");
  const frame = await showExample(page, "year-view-day-click-demo");

  await frame.getByRole("button", { name: /^Thursday, June 4, today/ }).click();

  await expect(
    frame.getByRole("button", { name: "Back to the year" }),
  ).toBeVisible();
  const columns = frame.locator('[role="group"][aria-label]:not([inert])');
  await expect(columns).toHaveCount(1);
  await expect(columns).toHaveAccessibleName(/Thursday, June 4/);

  await frame.getByRole("button", { name: "Back to the year" }).click();
  await expect(frame.getByRole("grid")).toHaveCount(12);
});

test("a busy day's more button opens its week", async ({ page }) => {
  await openPage(page, "month-view");
  const frame = await showExample(page, "month-view-busy-demo");

  await frame
    .getByRole("button", { name: /^Show \d+ more events on Thursday, June 4/ })
    .click();

  await expect(exampleEvent(frame, "Closing party")).toBeVisible();
  await frame.getByRole("button", { name: "Back to the month" }).click();
  await expect(frame.locator('[data-date="2026-06-04"]')).toBeVisible();
});

test("the New event button starts a draft that a title saves", async ({
  page,
}) => {
  await openPage(page, "calendar-core");
  const frame = await showExample(page, "create-event-button-demo");

  await expect(frame.getByText("No draft")).toBeVisible();
  await frame.getByRole("button", { name: "New event" }).click();
  await expect(frame.getByText(/^A draft: type a title/)).toBeVisible();

  // The draft's title is focused in its details
  await expect(page.getByPlaceholder("Title")).toBeFocused();
  await page.keyboard.type("Standup notes");
  await page.keyboard.press("Enter");

  await expect(frame.getByText("No draft")).toBeVisible();
  await expect(exampleEvent(frame, "Standup notes")).toBeVisible();
});

test("Select all visible selects every event, and Delete removes them all", async ({
  page,
}) => {
  await openPage(page, "calendar-core");
  const frame = await showExample(page, "multi-select-demo");
  const events = frame.locator("[data-event-id]:not([inert] *)");
  await expect(exampleEvent(frame, "Customer call")).toBeVisible();
  const count = await events.count();
  expect(count).toBeGreaterThan(5);

  await frame.getByRole("button", { name: "Select all visible" }).click();
  await expect(frame.getByText(/^\d+ selected$/)).toBeVisible();

  await frame.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(events).toHaveCount(0);

  // One step for undo, whatever the number of events
  await frame.getByRole("button", { name: "Undo" }).click();
  await expect(events).toHaveCount(count);
});

test("the view settings' switches change the month", async ({ page }) => {
  await openPage(page, "calendar-core");
  const frame = await showExample(page, "view-settings-demo");
  const friday = frame.locator('[data-date="2026-06-05"]');
  const saturday = frame.locator('[data-date="2026-06-06"]');

  await expect(friday).toBeVisible();
  await expect(saturday).toBeVisible();
  await frame.getByRole("switch", { name: "Weekends" }).click();
  await expect(friday).toBeVisible();
  await expect(saturday).toHaveCount(0);
});

test("the calendar reports each change once", async ({ page }) => {
  await openPage(page, "calendar");
  const frame = await showExample(page, "calendar-save-changes-demo");
  const log = frame.getByRole("list", { name: "Changes" });

  await exampleEvent(frame, "Customer call").click({ button: "right" });
  await page.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(log.getByRole("listitem")).toHaveText([
    "DELETE /events/sample-customer-call",
  ]);
});

test("your own buttons beside the calendar switch its view", async ({
  page,
}) => {
  await openPage(page, "calendar");
  const frame = await showExample(page, "calendar-buttons-demo");

  // The bar's own view buttons: the toolbar's switcher is a menu
  await frame.getByRole("button", { name: "month", exact: true }).click();
  await expect(frame.locator('[data-date="2026-06-04"]')).toBeVisible();

  await frame.getByRole("button", { name: "A month ahead" }).click();
  await expect(frame.getByRole("heading", { level: 2 })).toContainText(
    "July 2026",
  );
});

test("the calendar opens in a dialog, with its event details inside", async ({
  page,
}) => {
  await openPage(page, "calendar");
  const frame = await showExample(page, "calendar-dialog-demo");

  await frame.getByRole("button", { name: "Open the calendar" }).click();
  const dialog = page.getByRole("dialog", { name: "Team calendar" });
  await expect(dialog).toBeVisible();

  await exampleEvent(dialog, "Customer call").click();
  await expect(dialog.getByPlaceholder("Title")).toHaveValue("Customer call");
});

test("Share availability starts marking, and the pill cancels it", async ({
  page,
}) => {
  await openPage(page, "scheduling");
  const frame = await showExample(page, "scheduling-share-demo");

  await frame.getByRole("button", { name: "Share availability" }).click();
  const pill = frame.getByTestId("availability-hint");
  await expect(pill).toContainText("Mark available times on your calendar");

  await pill.getByRole("button", { name: "Cancel" }).click();
  await expect(pill).toHaveCount(0);
});

test("the command menu opens on Go to date and goes there", async ({
  page,
}) => {
  await openPage(page, "command-menu");
  const frame = await showExample(page, "command-menu-go-to-date-demo");

  await frame.getByRole("button", { name: "Go to date" }).click();
  const field = page.getByPlaceholder("e.g. nov 5, in 10 weeks");
  await expect(field).toBeFocused();

  await field.fill("in 3 weeks");
  await page.keyboard.press("Enter");

  await expect(field).toHaveCount(0);
  await expect(
    frame.locator('[role="group"][aria-label]:not([inert])').first(),
  ).toHaveAccessibleName(/Sunday, June 21/);
});

test("your app's command runs from the command menu", async ({ page }) => {
  await openPage(page, "command-menu");
  const frame = await showExample(page, "command-menu-app-commands-demo");

  await frame.getByRole("button", { name: "Open command menu" }).click();
  await page.getByPlaceholder("Type a command...").fill("settings");
  await page.keyboard.press("Enter");

  await expect(
    frame.getByText("Your last command: Go to settings"),
  ).toBeVisible();
});

test("a notice of your own shows in the toaster, with Undo", async ({
  page,
}) => {
  await openPage(page, "calendar-toaster");
  const frame = await showExample(page, "calendar-toaster-notice-demo");
  const toaster = frame.getByRole("region", { name: "Notifications" });

  await frame.getByRole("button", { name: "Mute reminders" }).click();
  await expect(toaster).toContainText("Reminders muted");
  await expect(frame.getByText("Reminders are muted")).toBeVisible();

  await toaster.getByRole("button", { name: "Undo" }).click();
  await expect(frame.getByText("Reminders are on")).toBeVisible();
});

test("picking someone in the people picker lists them in your own list", async ({
  page,
}) => {
  await openPage(page, "people-picker");
  const frame = await showExample(page, "people-picker-list-demo");

  // The meeting starts with Alex, from `defaultMeetWith`
  await expect(
    frame.getByRole("button", { name: /^Alex Rivera/ }),
  ).toBeVisible();

  await frame.getByRole("button", { name: "Meet with..." }).click();
  await page.getByRole("dialog").getByText("Priya Shah").click();

  const priya = frame.getByRole("button", { name: /^Priya Shah/ });
  await expect(priya).toBeVisible();
  await priya.click();
  await expect(priya).toHaveCount(0);
});

test("the details sidebar searches from your own button", async ({ page }) => {
  await openPage(page, "details-sidebar");
  const frame = await showExample(page, "details-sidebar-actions-demo");

  // Your own shortcuts are listed while nothing is selected
  await expect(frame.getByText("Print the week")).toBeVisible();

  await frame.getByRole("button", { name: 'Search "review"' }).click();
  await expect(frame.getByPlaceholder("Search events")).toHaveValue("review");
  await expect(frame.getByText("Design review").last()).toBeVisible();
});

test("picking a day in the sheet closes it", async ({ page }) => {
  await openPage(page, "sidebar-overlay");
  const frame = await showExample(page, "sidebar-overlay-picker-demo");

  await frame.getByRole("button", { name: "Pick a day" }).click();
  const sheet = page.getByRole("dialog", { name: "Pick a day" });
  await sheet.getByRole("button", { name: /June 10th, 2026/ }).click();

  await expect(sheet).toHaveCount(0);
  await expect(
    frame.getByRole("button", { name: "Wednesday, June 10" }),
  ).toBeVisible();
});

test("a framed example opens on a page of its own", async ({ page }) => {
  await page.clock.setFixedTime(FROZEN_NOW);
  await page.goto("/examples/calendar-app-data-demo");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // The docs page that frames it is the one for search engines to find
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  // An example without a frame has no page
  expect((await page.goto("/examples/week-view-demo"))?.status()).toBe(404);
});
