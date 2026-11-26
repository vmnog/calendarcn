import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { FROZEN_NOW } from "./helpers";

/**
 * The How it works page: the time grid's layers pulled apart
 * (`CalendarAnatomy`) and a real week view beside the state it reads
 * (`StateInspector`). In the sample week (May 31 to June 6), "Customer
 * call" is on Wednesday June 3, 2 to 3 PM.
 */

/** Vercel Analytics' script: it only exists on Vercel, so it 404s here */
const ANALYTICS_PATH = "/_vercel/insights/";

/** The layers the anatomy draws */
const LAYER_COUNT = 7;

async function openHowItWorks(page: Page): Promise<void> {
  await page.clock.setFixedTime(FROZEN_NOW);
  await page.goto("/docs/how-it-works");
  await expect(
    page.getByRole("heading", { level: 1, name: "How it works" }),
  ).toBeVisible();
}

test("the slider pulls the seven layers apart, each labelled with its file", async ({
  page,
}) => {
  await openHowItWorks(page);
  const anatomy = page.locator("[data-anatomy]");
  const tags = anatomy.locator("[data-anatomy-tag]");
  await expect(tags).toHaveCount(LAYER_COUNT);

  await anatomy.getByLabel("Separate the layers").fill("0");
  for (const tag of await tags.all()) {
    await expect(tag).toHaveCSS("opacity", "0");
  }

  await anatomy.getByLabel("Separate the layers").fill("100");
  for (const tag of await tags.all()) {
    await expect(tag).toHaveCSS("opacity", "1");
  }
  await expect(tags.filter({ hasText: "calendar-event-item.tsx" })).toHaveCount(
    1,
  );

  // Hovering a layer's name lights that layer and dims the others
  await anatomy.locator('[data-anatomy-label="events"]').hover();
  await expect(
    anatomy.locator('[data-anatomy-layer="events"]'),
  ).toHaveAttribute("data-active", "true");
});

test("dragging an event in the inspector prints the move as the last change", async ({
  page,
}) => {
  await openHowItWorks(page);
  const inspector = page.locator("[data-state-inspector]");
  const lastChange = inspector.locator('[data-state-value="last change"]');
  await expect(lastChange).toHaveText("nothing yet");
  await expect(inspector.locator('[data-state-value="view"]')).toHaveText(
    "week",
  );
  await expect(
    inspector.locator('[data-state-value="visibleRange"]'),
  ).toHaveText("May 31 – Jun 6");

  const event = inspector.locator('[data-event-id="sample-customer-call"]');
  await event.scrollIntoViewIfNeeded();
  const box = await event.boundingBox();
  if (!box) throw new Error("The customer call isn't drawn");
  const x = box.x + box.width / 2;
  const y = box.y + 10;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + box.width, y, { steps: 10 });
  await page.mouse.up();

  await expect(lastChange).toHaveText(/^moved 'Customer call' to Thu /);
});

test("double-clicking empty space shows the draft's range", async ({
  page,
}) => {
  await openHowItWorks(page);
  const inspector = page.locator("[data-state-inspector]");
  await inspector.scrollIntoViewIfNeeded();
  const draft = inspector.locator('[data-state-value="draft"]');
  await expect(draft).toHaveText("none");

  const inspectorBox = await inspector.boundingBox();
  const column = inspector
    .locator('[role="group"][aria-label]:not([inert])')
    .nth(1);
  const columnBox = await column.boundingBox();
  if (!inspectorBox || !columnBox) throw new Error("No day column");
  await page.mouse.dblclick(
    columnBox.x + columnBox.width / 2,
    inspectorBox.y + inspectorBox.height - 60,
  );

  await expect(draft).toHaveText(/^Mon \d+:\d\d [AP]M – \d+:\d\d [AP]M$/);
});

test("the page logs no errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (message.location().url.includes(ANALYTICS_PATH)) return;
    errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await openHowItWorks(page);
  await page.locator("[data-state-inspector]").scrollIntoViewIfNeeded();
  await page.waitForLoadState("networkidle");

  expect(errors).toEqual([]);
});
