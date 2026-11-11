import { expect, test } from "@playwright/test";

/**
 * The question map on the docs Introduction (`DocsMap`). Its cards link to
 * heading ids set in `content/docs/index.mdx`, so a renamed heading or id
 * would leave a card pointing nowhere.
 */

/** Each question on the map and the id of the section that answers it */
const MAP_QUESTIONS = [
  { question: "How do I install it?", id: "install" },
  { question: "How do I show my own events?", id: "your-events" },
  { question: "How do I customize it?", id: "customize" },
  { question: "How do I get updates?", id: "updates" },
  { question: "What's coming next?", id: "whats-next" },
];

test("every question on the map links to the section that answers it", async ({
  page,
}) => {
  await page.goto("/docs");
  const map = page.getByRole("navigation", { name: "Map" });

  await expect(map.getByRole("link")).toHaveCount(MAP_QUESTIONS.length);
  for (const { question, id } of MAP_QUESTIONS) {
    await expect(
      map.getByRole("link", { name: question, exact: true }),
    ).toHaveAttribute("href", `#${id}`);
    // The heading's own anchor link, without Fumadocs' copy-link button
    await expect(page.locator(`h2#${id} > a`)).toHaveText(question);
  }
});

test("a question scrolls its section into view below the sticky header", async ({
  page,
}) => {
  await page.goto("/docs");
  const { question, id } = MAP_QUESTIONS[2];

  await page
    .getByRole("navigation", { name: "Map" })
    .getByRole("link", { name: question, exact: true })
    .click();

  await expect(page).toHaveURL(new RegExp(`#${id}$`));
  const heading = page.locator(`h2#${id}`);
  await expect(heading).toBeInViewport();
  // The header and announcement bar are sticky: the heading must sit below them
  await expect
    .poll(() =>
      heading.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
          box.left + 8,
          box.top + box.height / 2,
        );
        return hit !== null && element.contains(hit);
      }),
    )
    .toBe(true);
});
