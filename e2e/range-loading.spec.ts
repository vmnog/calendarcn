import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { FROZEN_NOW, boxOf } from "./helpers";

/**
 * The "Loading Events" docs example: a pretend server answers each
 * `onVisibleRangeChange` after 800ms, a log lists every call (newest first)
 * with its range as `data-start` / `data-end` (yyyy-MM-dd, end exclusive)
 * and its `data-status` ("loading", "loaded" or "cached").
 */
const DOCS_PATH = "/docs/loading-events";

/** The live example inside the docs page */
function demo(page: Page): Locator {
  return page.locator('[data-example="range-loading-demo"]');
}

/** Log entries, newest first */
function logEntries(page: Page): Locator {
  return demo(page).getByTestId("range-log-entry");
}

/** The calendar's loading bar */
function loadingBar(page: Page): Locator {
  return demo(page).getByRole("progressbar", { name: "Loading events" });
}

/** Asserts the newest log entry's range (end exclusive) and status */
async function expectLatestRange(
  page: Page,
  range: { start: string; end: string; status: string },
): Promise<void> {
  const latest = logEntries(page).first();
  await expect(latest).toHaveAttribute("data-start", range.start);
  await expect(latest).toHaveAttribute("data-end", range.end);
  await expect(latest).toHaveAttribute("data-status", range.status);
}

/** Waits until the newest range has loaded and the bar is gone */
async function waitForLoaded(page: Page): Promise<void> {
  await expect(logEntries(page).first()).toHaveAttribute(
    "data-status",
    "loaded",
  );
  await expect(loadingBar(page)).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FROZEN_NOW);
  await page.goto(DOCS_PATH);
  await expect(logEntries(page)).toHaveCount(1);
});

test("reports the week once on mount and shows the bar until it loads", async ({
  page,
}) => {
  await expectLatestRange(page, {
    start: "2026-05-31",
    end: "2026-06-07",
    status: "loading",
  });
  await expect(loadingBar(page)).toBeVisible();

  await waitForLoaded(page);
  await expect(
    demo(page)
      .getByRole("button", { name: /^Standup/ })
      .first(),
  ).toBeVisible();
  await expect(logEntries(page)).toHaveCount(1);
});

test("navigation reports each new range once and reuses cached ones", async ({
  page,
}) => {
  await waitForLoaded(page);

  await demo(page).getByRole("button", { name: "Next week" }).click();
  await expectLatestRange(page, {
    start: "2026-06-07",
    end: "2026-06-14",
    status: "loading",
  });
  await expect(loadingBar(page)).toBeVisible();
  await waitForLoaded(page);

  await demo(page).getByRole("button", { name: "Previous week" }).click();
  await expectLatestRange(page, {
    start: "2026-05-31",
    end: "2026-06-07",
    status: "cached",
  });
  await expect(loadingBar(page)).toHaveCount(0);
  await expect(logEntries(page)).toHaveCount(3);
});

test("view switches report the day and the whole month grid", async ({
  page,
}) => {
  await waitForLoaded(page);
  const views = demo(page).getByRole("group", { name: "View" });

  // Six weeks from the week of May 31, July days included
  await views.getByRole("button", { name: "Month" }).click();
  await expectLatestRange(page, {
    start: "2026-05-31",
    end: "2026-07-12",
    status: "loading",
  });
  await expect(loadingBar(page)).toBeVisible();
  await waitForLoaded(page);

  await views.getByRole("button", { name: "Day" }).click();
  await expectLatestRange(page, {
    start: "2026-06-04",
    end: "2026-06-05",
    status: "loading",
  });
  await expect(loadingBar(page)).toBeVisible();
  await waitForLoaded(page);

  await views.getByRole("button", { name: "Week" }).click();
  await expectLatestRange(page, {
    start: "2026-05-31",
    end: "2026-06-07",
    status: "cached",
  });
  await expect(logEntries(page)).toHaveCount(4);
});

test("the agenda reports the 30 days it lists", async ({ page }) => {
  await waitForLoaded(page);

  // This week contains today, so the agenda starts on it
  await demo(page)
    .getByRole("group", { name: "View" })
    .getByRole("button", { name: "Agenda" })
    .click();
  await expectLatestRange(page, {
    start: "2026-06-04",
    end: "2026-07-04",
    status: "loading",
  });
  await expect(loadingBar(page)).toBeVisible();
  await waitForLoaded(page);
});

test("a sideways scroll reports once, after it snaps", async ({ page }) => {
  await waitForLoaded(page);

  // Day columns are as wide as the distance between two header days
  const header = demo(page).locator("header + div");
  const first = await boxOf(header.getByText("1", { exact: true }));
  const second = await boxOf(header.getByText("2", { exact: true }));
  const columnWidth = second.x - first.x;
  const grid = await boxOf(header);

  // 2.4 columns to the right in small steps snaps two days forward
  await page.mouse.move(grid.x + grid.width / 2, grid.y + grid.height / 2);
  for (let step = 0; step < 4; step++) {
    await page.mouse.wheel(columnWidth * 0.6, 0);
  }

  await expectLatestRange(page, {
    start: "2026-06-02",
    end: "2026-06-09",
    status: "loading",
  });
  await waitForLoaded(page);
  await expect(logEntries(page)).toHaveCount(2);
});

test("the calendar stays usable while loading", async ({ page }) => {
  await expect(loadingBar(page)).toBeVisible();
  await expect(loadingBar(page)).toHaveCSS("pointer-events", "none");

  // Navigating mid-load works and reports the new range
  await demo(page).getByRole("button", { name: "Next week" }).click();
  await expectLatestRange(page, {
    start: "2026-06-07",
    end: "2026-06-14",
    status: "loading",
  });
  await expect(logEntries(page)).toHaveCount(2);
});
