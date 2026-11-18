import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

/**
 * The docs announcement bar and the sticky header under it
 * (`DocsAnnouncement`, `src/app/docs/layout.tsx`). At the top of a page the
 * bar sits at y=0 with the header right under it. Scrolled down, the bar is
 * gone and the header, sidebar and table of contents stick to the very top,
 * with no gap above the header.
 */

/** How far the page scrolls: two screens, past where the bar used to leave */
const SCREENS_DOWN = 2;

/** Rounding slack for subpixel layout, in px */
const TOLERANCE = 1;

/** The announcement bar above the docs header */
function announcementBar(page: Page): Locator {
  return page.locator("[data-docs-announcement]");
}

/** The docs header (Fumadocs' `#nd-subnav`) */
function docsHeader(page: Page): Locator {
  return page.locator("#nd-subnav");
}

/** Top and bottom of an element in the viewport, in px */
async function verticalEdges(
  locator: Locator,
): Promise<{ top: number; bottom: number }> {
  return locator.evaluate((element) => {
    const { top, bottom } = element.getBoundingClientRect();
    return { top, bottom };
  });
}

/** Scrolls the window to `screens` viewport heights from the top */
async function scrollScreens(page: Page, screens: number): Promise<void> {
  await page.evaluate((count) => {
    window.scrollTo(0, window.innerHeight * count);
  }, screens);
}

/** The bar at y=0 and the header starting at its bottom edge */
async function expectBarOnTop(page: Page): Promise<void> {
  await expect
    .poll(async () => (await verticalEdges(announcementBar(page))).top)
    .toBeCloseTo(0, 0);
  const bar = await verticalEdges(announcementBar(page));
  await expect
    .poll(async () => (await verticalEdges(docsHeader(page))).top)
    .toBeCloseTo(bar.bottom, 0);
}

/** The bar off screen and the header stuck to the very top */
async function expectHeaderOnTop(page: Page): Promise<void> {
  await expect
    .poll(async () => (await verticalEdges(docsHeader(page))).top)
    .toBeCloseTo(0, 0);
  const bar = await verticalEdges(announcementBar(page));
  expect(bar.bottom).toBeLessThanOrEqual(0);
}

/** Expects `below` to start where `above` ends */
async function expectStacked(above: Locator, below: Locator): Promise<void> {
  await expect
    .poll(async () => {
      const [upper, lower] = await Promise.all([
        verticalEdges(above),
        verticalEdges(below),
      ]);
      return Math.abs(lower.top - upper.bottom);
    })
    .toBeLessThanOrEqual(TOLERANCE);
}

test.describe("desktop", () => {
  test("the header sticks to the top once the bar scrolls away", async ({
    page,
  }) => {
    await page.goto("/docs");
    const header = docsHeader(page);
    const sidebar = page.locator("[data-sidebar-placeholder]");
    const toc = page.locator("#nd-toc");

    await expectBarOnTop(page);
    await expectStacked(header, sidebar);
    await expectStacked(header, toc);

    await scrollScreens(page, SCREENS_DOWN);
    await expectHeaderOnTop(page);
    // The sidebar and the table of contents follow the header up
    await expectStacked(header, sidebar);
    await expectStacked(header, toc);
    // ...and still reach the bottom of the window
    const viewportHeight = page.viewportSize()?.height ?? 0;
    expect((await verticalEdges(sidebar)).bottom).toBeCloseTo(
      viewportHeight,
      0,
    );

    await scrollScreens(page, 0);
    await expectBarOnTop(page);
    await expectStacked(header, sidebar);
  });
});

test.describe("phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  /** Opens the drawer and expects its close button on the header's opener */
  async function expectDrawerCloseOnOpener(page: Page): Promise<void> {
    const opener = docsHeader(page).getByRole("button", {
      name: "Open Sidebar",
    });
    const openerBox = await opener.boundingBox();
    await opener.tap();

    const close = page
      .locator("#nd-sidebar-mobile")
      .getByRole("button", { name: "Close Sidebar" });
    await expect
      .poll(async () => {
        const closeBox = await close.boundingBox();
        if (!closeBox || !openerBox) return Number.POSITIVE_INFINITY;
        return Math.max(
          Math.abs(closeBox.x - openerBox.x),
          Math.abs(closeBox.y - openerBox.y),
        );
      })
      .toBeLessThanOrEqual(TOLERANCE);

    await close.tap();
    // The drawer stays mounted, hidden with `visibility: hidden`
    await expect(close).toBeHidden();
  }

  test("the header sticks to the top and the drawer still lines up", async ({
    page,
  }) => {
    await page.goto("/docs");
    const header = docsHeader(page);
    // The "On this page" row that stands in for the table of contents
    const tocPopover = page.locator("[data-toc-popover]");

    await expectBarOnTop(page);
    await expectStacked(header, tocPopover);
    await expectDrawerCloseOnOpener(page);

    await scrollScreens(page, SCREENS_DOWN);
    await expectHeaderOnTop(page);
    await expectStacked(header, tocPopover);
    await expectDrawerCloseOnOpener(page);

    await scrollScreens(page, 0);
    await expectBarOnTop(page);
  });
});
