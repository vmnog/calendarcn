import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { FROZEN_NOW, boxOf } from "./helpers";

/**
 * The guides' story demos (`Challenge` in `src/components/docs/challenge.tsx`):
 * each asks for one thing in its example, turns its check green with "Done"
 * when the example's state passes, and Reset puts the example back. With the
 * clock frozen on Thursday June 4, the examples' week is May 31 to June 6.
 */

/** A guide with its challenge: the bar, and the example inside it */
async function openChallenge(
  page: Page,
  guide: string,
  example: string,
): Promise<{ bar: Locator; frame: Locator }> {
  await page.clock.setFixedTime(FROZEN_NOW);
  await page.goto(`/docs/guides/${guide}`);
  const frame = page.locator(`[data-example="${example}"]`);
  await frame.scrollIntoViewIfNeeded();
  const bar = page.locator("[data-challenge]").filter({ has: frame });
  return { bar, frame };
}

/** The tasks' rows, in order */
function tasks(bar: Locator): Locator {
  return bar.locator("li");
}

/** The check that says "Done" */
function doneCheck(bar: Locator): Locator {
  return bar.locator("[data-challenge-status]");
}

/** Wednesday June 3's column of the week on screen */
function wednesday(frame: Locator): Locator {
  return frame
    .locator('[role="group"][aria-label*="Wednesday, June 3"]:not([inert])')
    .first();
}

/** The middle of a time axis label: where its hour's line is */
async function hourLine(frame: Locator, label: string): Promise<number> {
  const box = await boxOf(frame.getByText(label, { exact: true }).first());
  return box.y + box.height / 2;
}

/** Presses at (x, fromY), drags down to toY in small steps and releases */
async function drawDown(page: Page, x: number, fromY: number, toY: number) {
  await page.mouse.move(x, fromY);
  await page.mouse.down();
  await page.mouse.move(x, toY, { steps: 12 });
  await page.mouse.up();
}

/** Clicks Reset and checks the challenge starts over */
async function resetChallenge(bar: Locator) {
  await bar.getByRole("button", { name: "Reset" }).click();
  await expect(doneCheck(bar)).toHaveText("");
  await expect(tasks(bar).first()).toHaveAttribute("data-state", "current");
}

test("creating events: drawing an hour on Wednesday morning is done", async ({
  page,
}) => {
  const { bar, frame } = await openChallenge(
    page,
    "creating-events",
    "creating-events-challenge-demo",
  );
  await expect(tasks(bar)).toHaveText([
    "Drag on Wednesday morning to create a 1-hour event",
  ]);
  await expect(doneCheck(bar)).toHaveText("");

  const column = await boxOf(wednesday(frame));
  const x = column.x + column.width / 2;
  const nine = await hourLine(frame, "9 AM");
  const ten = await hourLine(frame, "10 AM");
  const eleven = await hourLine(frame, "11 AM");
  const hour = ten - nine;

  // Two hours passes through one on the way, and isn't done
  await drawDown(page, x, nine + hour * 0.1, eleven + hour * 0.1);
  await expect(frame.locator('[data-slot="event-draft"]')).toBeVisible();
  await expect(doneCheck(bar)).toHaveText("");
  await page.keyboard.press("Escape");

  // 9 to 10 AM
  await drawDown(page, x, nine + hour * 0.1, ten + hour * 0.1);
  await expect(doneCheck(bar)).toHaveText("Done");
  await expect(tasks(bar).first()).toHaveAttribute("data-state", "done");

  await resetChallenge(bar);
  await expect(frame.locator('[data-slot="event-draft"]')).toHaveCount(0);
});

test("repeating events: repeat Standup every weekday, then move Wednesday's", async ({
  page,
}) => {
  const { bar, frame } = await openChallenge(
    page,
    "repeating-events",
    "repeating-events-challenge-demo",
  );
  await expect(tasks(bar)).toHaveText([
    "Make Standup repeat every weekday",
    "Now move only Wednesday's Standup",
  ]);

  // Standup is on Monday only
  await expect(
    wednesday(frame).getByRole("button", { name: /^Standup/ }),
  ).toHaveCount(0);
  await frame
    .getByRole("button", { name: /^Standup/ })
    .first()
    .click();
  await page.getByText("Repeat", { exact: true }).click();
  await page.getByRole("button", { name: "Repeat: does not repeat" }).click();
  await page.getByRole("menuitem", { name: "Every weekday" }).click();

  await expect(tasks(bar).first()).toHaveAttribute("data-state", "done");
  await expect(tasks(bar).nth(1)).toHaveAttribute("data-state", "current");
  await expect(doneCheck(bar)).toHaveText("");

  // Close the details, then drag Wednesday's date an hour later
  await expect(page.getByRole("menu")).toHaveCount(0);
  const details = page.getByRole("dialog", { name: "Event details" });
  await expect(async () => {
    await page.keyboard.press("Escape");
    await expect(details).toHaveCount(0, { timeout: 500 });
  }).toPass();
  const standup = wednesday(frame).getByRole("button", { name: /^Standup/ });
  const box = await boxOf(standup);
  const hour =
    (await hourLine(frame, "10 AM")) - (await hourLine(frame, "9 AM"));
  await drawDown(
    page,
    box.x + box.width / 2,
    box.y + box.height / 2,
    box.y + box.height / 2 + hour,
  );
  const question = page.getByRole("dialog", { name: /repeat event/ });
  await expect(
    question.getByRole("radio", { name: "This event" }),
  ).toBeChecked();
  await question.getByRole("button", { name: "Save event" }).click();

  await expect(doneCheck(bar)).toHaveText("Done");
  await expect(tasks(bar).nth(1)).toHaveAttribute("data-state", "done");

  // Reset brings back the Standup that doesn't repeat
  await resetChallenge(bar);
  await expect(
    wednesday(frame).getByRole("button", { name: /^Standup/ }),
  ).toHaveCount(0);
});

test("meet with people: a time inside the free time you share with Priya is done", async ({
  page,
}) => {
  const { bar, frame } = await openChallenge(
    page,
    "meet-with-people",
    "meet-with-people-challenge-demo",
  );
  await expect(tasks(bar)).toHaveText([
    "Find a time when you and Priya are both free",
  ]);

  const priya = frame.getByRole("button", { name: "Priya Shah" });
  await priya.click();
  await expect(priya).toHaveAttribute("aria-pressed", "true");

  // The only time you're both free on Wednesday: draw inside it
  const free = wednesday(frame).getByRole("note", {
    name: "Everyone free, 4:30–5 PM",
  });
  const box = await boxOf(free);
  await drawDown(
    page,
    box.x + box.width / 2,
    box.y + 2,
    box.y + box.height - 2,
  );
  await expect(doneCheck(bar)).toHaveText("Done");

  await resetChallenge(bar);
  await expect(priya).toHaveAttribute("aria-pressed", "false");
});
