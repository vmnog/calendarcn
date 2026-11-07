import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  CURRENT_WEEK_LABEL,
  calendarEvent,
  detailFields,
  detailTitle,
  expectHeader,
  openCalendar,
} from "./helpers";

/**
 * The details panel's time zone and repeat rows, against Notion Calendar's
 * behavior. The test browser runs in America/New_York (GMT−4 in June).
 */

/** One section of the context panel's event details */
function detailSection(page: Page, name: string): Locator {
  return page.locator(`[data-section="${name}"]`);
}

/** Opens "Quick Sync" (no details set) and expands All-day / Time zone / Repeat */
async function openQuickSync(page: Page): Promise<void> {
  await calendarEvent(page, "Quick Sync").click();
  await expect(detailTitle(page)).toHaveValue("Quick Sync");
  await page.getByText("Time zone", { exact: true }).click();
}

/** The repeat row's menu trigger */
function repeatTrigger(page: Page): Locator {
  return detailSection(page, "recurrence").getByRole("button", {
    name: /^Repeat:/,
  });
}

/** Opens the repeat menu, after any previous menu has finished closing */
async function openRepeatMenu(page: Page): Promise<Locator> {
  await expect(page.getByRole("menu")).toHaveCount(0);
  await repeatTrigger(page).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  return menu;
}

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

test("the time zone picker lists, previews and searches zones", async ({
  page,
}) => {
  await openQuickSync(page);
  const timezone = detailSection(page, "timezone");
  await expect(timezone).toHaveText("GMT−4New York");

  // The row turns into a search field with the city selected, the list
  // highlights the event's zone
  await timezone.getByRole("button").click();
  const input = page.getByRole("combobox", { name: "Time zone" });
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("New York");
  const list = page.getByRole("listbox", { name: "Time zones" });
  const selected = list.getByRole("option", { selected: true });
  await expect(selected).toHaveText(
    /^GMT−04:00\s*Eastern Daylight Time\s*–\s*New York$/,
  );
  await expect(input).toHaveAttribute("aria-expanded", "true");
  // Screen readers follow the highlight through the field
  await expect(input).toHaveAttribute(
    "aria-activedescendant",
    (await selected.getAttribute("id")) ?? "",
  );
  // Popular zones come first, in Notion's order
  await expect(list.getByRole("option").first()).toContainText("Los Angeles");

  // Arrow keys move the highlight and preview its city
  await input.press("ArrowDown");
  await expect(input).not.toHaveValue("New York");
  await expect(input).toHaveAttribute(
    "aria-activedescendant",
    (await selected.getAttribute("id")) ?? "",
  );

  // Escape leaves the zone unchanged and keeps the event selected
  await input.press("Escape");
  await expect(input).toHaveCount(0);
  await expect(timezone).toHaveText("GMT−4New York");
  await expect(detailTitle(page)).toHaveValue("Quick Sync");

  // Typing filters by name or city
  await timezone.getByRole("button").click();
  await input.fill("tok");
  await expect(list.getByRole("option").first()).toBeVisible();
  for (const text of await list.getByRole("option").allInnerTexts()) {
    expect(text.toLowerCase()).toContain("tok");
  }
  // No match keeps the list open, so Escape still restores the zone
  await input.fill("zzzq");
  await expect(list).toContainText("No results");
  await expect(list.getByRole("option")).toHaveCount(0);
  await expect(input).toHaveAttribute("aria-expanded", "true");
  await input.press("Escape");
  await expect(input).toHaveCount(0);
  await expect(timezone).toHaveText("GMT−4New York");
  await expect(detailTitle(page)).toHaveValue("Quick Sync");
});

test("picking a time zone keeps the event's wall-clock time", async ({
  page,
}) => {
  await openQuickSync(page);
  const timezone = detailSection(page, "timezone");
  await timezone.getByRole("button").click();
  const input = page.getByRole("combobox", { name: "Time zone" });
  await input.fill("tokyo");
  await input.press("Enter");

  // Enter picks the zone and keeps the field focused, Escape leaves it
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("Tokyo");
  await input.press("Escape");
  await expect(timezone).toHaveText("GMT+9Tokyo");

  // 2 PM in Tokyo is 1 AM in New York
  await expect(calendarEvent(page, "Quick Sync")).toHaveAttribute(
    "aria-label",
    /^Quick Sync, 1:00 AM to 1:30 AM, Saturday, June 6/,
  );

  // The picked zone leads the list next time, as a recent one
  await timezone.getByRole("button").click();
  const list = page.getByRole("listbox", { name: "Time zones" });
  await expect(list.getByRole("option").first()).toHaveText(
    /^GMT\+09:00\s*Japan Standard Time\s*–\s*Tokyo$/,
  );
  await expect(list.getByRole("option", { selected: true })).toHaveText(
    /Tokyo$/,
  );
});

test("the repeat menu sets Notion's presets and Does not repeat", async ({
  page,
}) => {
  await openQuickSync(page);
  const recurrence = detailSection(page, "recurrence");
  await expect(recurrence).toHaveText("Repeat");

  let menu = await openRepeatMenu(page);
  await expect(menu.getByRole("menuitem")).toHaveText([
    "Every day",
    "Every weekend day",
    "Every week on Sat",
    "Every 2 weeks on Sat",
    "Every month on the 6th",
    "Every month on the 1st Sat",
    "Every year on Jun 6",
    "Custom…",
  ]);
  await menu.getByRole("menuitem", { name: "Every week on Sat" }).click();
  await expect(recurrence).toContainText("Every week on Sat");
  await expect(
    recurrence.getByRole("button", { name: "Go to next event in this series" }),
  ).toBeEnabled();
  await expect(
    recurrence.getByRole("button", {
      name: "Go to previous event in this series",
    }),
  ).toBeDisabled();

  // While repeating, the menu starts with Does not repeat
  menu = await openRepeatMenu(page);
  await expect(menu.getByRole("menuitem").first()).toHaveText(
    "Does not repeat",
  );
  await menu.getByRole("menuitem", { name: "Does not repeat" }).click();
  await expect(recurrence).toHaveText("Repeat");
});

test("the custom repeat dialog builds a rule", async ({ page }) => {
  await openQuickSync(page);
  const menu = await openRepeatMenu(page);
  await menu.getByRole("menuitem", { name: "Custom…" }).click();

  const dialog = page.getByRole("dialog", { name: "Repeat" });
  await expect(dialog.getByRole("textbox", { name: "Interval" })).toHaveValue(
    "1",
  );
  await expect(
    dialog.getByRole("button", { name: "Saturday" }),
  ).toHaveAttribute("aria-pressed", "true");

  // Months repeat on the day or on the weekday of the month
  await dialog.getByRole("button", { name: "Unit: week" }).click();
  await page.getByRole("menuitem", { name: "month" }).click();
  await expect(
    dialog.getByRole("radiogroup", { name: "Day of the month" }),
  ).toHaveText("the 6ththe 1st Sat");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Unit: month" }).click();
  await page.getByRole("menuitem", { name: "week" }).click();

  await dialog.getByRole("textbox", { name: "Interval" }).fill("2");
  await dialog.getByRole("textbox", { name: "Interval" }).press("Tab");
  await dialog.getByRole("button", { name: "Monday" }).click();
  await dialog.getByRole("radio", { name: "After" }).click();
  await dialog.getByRole("textbox", { name: "Occurrences" }).fill("3");
  await dialog.getByRole("textbox", { name: "Occurrences" }).press("Tab");
  await dialog.getByRole("button", { name: "Done" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(detailSection(page, "recurrence")).toContainText(
    "Every 2 weeks on Mon, Sat for 3 times",
  );
  // Focus goes back to the Repeat button, whether the dialog saves or not
  await expect(repeatTrigger(page)).toBeFocused();

  const again = await openRepeatMenu(page);
  await again.getByRole("menuitem", { name: "Custom…" }).click();
  await dialog.getByRole("button", { name: "Saturday" }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(repeatTrigger(page)).toBeFocused();
  await expect(detailSection(page, "recurrence")).toContainText(
    "Every 2 weeks on Mon, Sat for 3 times",
  );
});

test("the custom dialog sets a monthly rule on a weekday of the month", async ({
  page,
}) => {
  await openQuickSync(page);
  const menu = await openRepeatMenu(page);
  await menu.getByRole("menuitem", { name: "Custom…" }).click();
  const dialog = page.getByRole("dialog", { name: "Repeat" });
  await dialog.getByRole("button", { name: "Unit: week" }).click();
  await page.getByRole("menuitem", { name: "month" }).click();
  await dialog.getByRole("radio", { name: "the 1st Sat" }).click();
  await dialog.getByRole("button", { name: "Done" }).click();

  const recurrence = detailSection(page, "recurrence");
  await expect(recurrence).toContainText("Every month on the 1st Sat");
  await recurrence
    .getByRole("button", { name: "Go to next event in this series" })
    .click();
  // July's first Saturday, still read from the rule
  await expect(detailFields(page).startDate).toHaveValue("Sat Jul 4");
  await expect(recurrence).toContainText("Every month on the 1st Sat");
});

test("the series arrows step through a weekly routine's events", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: /^Team Standup, .*Monday, June 1/ })
    .click();
  const fields = detailFields(page);
  await expect(fields.startDate).toHaveValue("Mon Jun 1");
  const recurrence = detailSection(page, "recurrence");
  await expect(recurrence).toContainText("Every week on Mon");

  await recurrence
    .getByRole("button", { name: "Go to next event in this series" })
    .click();
  await expect(fields.startDate).toHaveValue("Mon Jun 8");
  await expectHeader(page, "June 2026 Week 24");
  await expect(
    page.getByRole("button", { name: /^Team Standup, .*Monday, June 8/ }),
  ).toHaveAttribute("aria-pressed", "true");

  await recurrence
    .getByRole("button", { name: "Go to previous event in this series" })
    .click();
  await expect(fields.startDate).toHaveValue("Mon Jun 1");
  await expectHeader(page, CURRENT_WEEK_LABEL);
});

test("the popover's series arrows step through the series in every view", async ({
  page,
}) => {
  const popover = page.getByRole("dialog", { name: "Event details" });
  const arrow = (direction: "previous" | "next") =>
    popover.getByRole("button", {
      name: `Go to ${direction} event in this series`,
    });

  // "/" closes the context panel, so events open a popover
  await page.keyboard.press("/");
  await page
    .getByRole("button", { name: /^Team Standup, .*Monday, June 1/ })
    .click();
  await expect(popover).toBeVisible();
  await arrow("next").click();
  // The next Monday, not a week of days later
  await expectHeader(page, "June 2026 Week 24");
  await expect(popover.getByTestId("event-start-date")).toHaveValue(
    "Mon Jun 8",
  );
  await arrow("previous").click();
  await expectHeader(page, CURRENT_WEEK_LABEL);
  await expect(popover.getByTestId("event-start-date")).toHaveValue(
    "Mon Jun 1",
  );
  await page.keyboard.press("Escape");
  await expect(popover).toHaveCount(0);

  // Month view: stepping inside the month stays on it; the series' end
  // disables the arrow
  await page.keyboard.press("m");
  await expectHeader(page, "June 2026");
  await calendarEvent(page, "Launch Review").click();
  await expect(arrow("previous")).toBeDisabled();
  await arrow("next").click();
  await expect(popover.getByTestId("event-start-date")).toHaveValue(
    "Sat Jun 20",
  );
  await expectHeader(page, "June 2026");
  for (const [date, month] of [
    ["Sat Jul 4", "July 2026"],
    ["Sat Jul 18", "July 2026"],
    ["Sat Aug 1", "August 2026"],
    ["Sat Aug 15", "August 2026"],
  ]) {
    await arrow("next").click();
    await expect(popover.getByTestId("event-start-date")).toHaveValue(date);
    await expectHeader(page, month);
  }
  // Every 2 weeks, 6 times: Aug 15 is the last
  await expect(arrow("next")).toBeDisabled();
  await expect(arrow("previous")).toBeEnabled();
  await page.keyboard.press("Escape");

  // Agenda view
  await page.keyboard.press("a");
  await calendarEvent(page, "Launch Review").first().click();
  await expect(popover).toBeVisible();
  await expect(arrow("next")).toBeEnabled();
});

test("an occurrence moved within its day or to another day keeps its place in the series", async ({
  page,
}) => {
  await calendarEvent(page, "Launch Review").click();
  const fields = detailFields(page);
  const recurrence = detailSection(page, "recurrence");
  const previous = recurrence.getByRole("button", {
    name: "Go to previous event in this series",
  });
  const next = recurrence.getByRole("button", {
    name: "Go to next event in this series",
  });
  await next.click();
  await expect(fields.startDate).toHaveValue("Sat Jun 20");

  // Later on its day (it ends at 11:30): still the Jun 20 occurrence, so
  // previous leaves it
  await fields.startTime.fill("10:30 AM");
  await fields.startTime.press("Enter");
  await expect(fields.startTime).toHaveValue("10:30 AM");
  await previous.click();
  await expect(fields.startDate).toHaveValue("Sat Jun 6");
  await next.click();
  await expect(fields.startDate).toHaveValue("Sat Jun 20");
  await expect(fields.startTime).toHaveValue("10:30 AM");

  // Moved to Sunday: the arrows open it again instead of a fresh copy
  await fields.startDate.fill("Jun 21");
  await fields.startDate.press("Enter");
  await expect(fields.startDate).toHaveValue("Sun Jun 21");
  await previous.click();
  await expect(fields.startDate).toHaveValue("Sat Jun 6");
  await next.click();
  await expect(fields.startDate).toHaveValue("Sun Jun 21");
  await expect(fields.startTime).toHaveValue("10:30 AM");
  await expect(
    page.getByRole("button", { name: /^Launch Review, / }),
  ).toHaveCount(1);
});

test("the series arrows follow a repeat rule to occurrences the app doesn't have yet", async ({
  page,
}) => {
  // Every 2 weeks on Sat, 6 times, from Sat Jun 6
  await calendarEvent(page, "Launch Review").click();
  const fields = detailFields(page);
  const recurrence = detailSection(page, "recurrence");
  const previous = recurrence.getByRole("button", {
    name: "Go to previous event in this series",
  });
  const next = recurrence.getByRole("button", {
    name: "Go to next event in this series",
  });
  await expect(previous).toBeDisabled();

  await next.click();
  await expect(fields.startDate).toHaveValue("Sat Jun 20");
  await expectHeader(page, "June 2026 Week 25");
  await expect(detailTitle(page)).toHaveValue("Launch Review");
  await expect(previous).toBeEnabled();

  await previous.click();
  await expect(fields.startDate).toHaveValue("Sat Jun 6");
  await expectHeader(page, CURRENT_WEEK_LABEL);
});
