import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import type {
  CalendarInfo,
  DetailedCalendarEvent,
} from "../src/components/calendar-types";
import {
  addReminder,
  moveEventToCalendar,
  resolveEventColor,
} from "../src/lib/event-utils";
import { calendarEvent, detailTitle, openCalendar } from "./helpers";

/**
 * The bottom block of the detail panel: the calendar picker with the event
 * color, busy/free, visibility and reminders. "Launch Review" (Sat Jun 6) is
 * on the Work calendar of the you@work.example.com account, green, busy,
 * private, with 10min and 1hour reminders.
 */

/** One section of the context panel's event details */
function detailSection(page: Page, name: string): Locator {
  return page.locator(`[data-section="${name}"]`);
}

/** The calendar row, which opens the calendar picker */
function calendarTrigger(page: Page): Locator {
  return detailSection(page, "calendar").getByRole("button");
}

/** The reminder input heading the reminders */
function reminderInput(page: Page): Locator {
  return page.getByRole("combobox", { name: "Add reminder" });
}

/** Reminder rows of the panel, as text ("10 min before") */
function reminderRows(page: Page): Locator {
  return page.getByTestId("event-reminder");
}

/** Matches a reminder label whatever space Notion's hair space shows as */
function reminderText(amount: string, unit: string): RegExp {
  return new RegExp(`^${amount}\\s?${unit} before$`);
}

test.describe("the details panel", () => {
  test.beforeEach(async ({ page }) => {
    await openCalendar(page);
  });

  test("the calendar picker lists every account's calendars and moves the event", async ({
    page,
  }) => {
    await calendarEvent(page, "Launch Review").click();
    await expect(calendarTrigger(page)).toHaveAccessibleName("Calendar: Work");

    await calendarTrigger(page).click();
    const menu = page.getByRole("menu", { name: "Calendar" });
    await expect(
      menu.getByRole("group", { name: "you@example.com" }),
    ).toBeVisible();
    await expect(
      menu.getByRole("group", { name: "you@work.example.com" }),
    ).toBeVisible();
    await expect(
      menu.getByRole("menuitemradio", { name: "Work", exact: true }),
    ).toBeChecked();
    await expect(
      menu.getByRole("menuitemradio", { name: "Personal" }),
    ).not.toBeChecked();

    // Hovering a calendar previews it in the row (hidden from the
    // accessibility tree while the menu is open, so found by its section)
    await menu.getByRole("menuitemradio", { name: "Personal" }).hover();
    await expect(
      detailSection(page, "calendar").locator("button"),
    ).toContainText("Personal");

    await menu.getByRole("menuitemradio", { name: "Personal" }).click();
    await expect(menu).toHaveCount(0);
    await expect(calendarTrigger(page)).toHaveAccessibleName(
      "Calendar: Personal",
    );
    // The event keeps its own green, drawn in front of the calendar's purple
    await expect(
      page.getByTestId("event-calendar-swatch").locator("span"),
    ).toHaveCount(2);
    await expect(detailTitle(page)).toHaveValue("Launch Review");
  });

  test("an event that kept its calendar's color and reminders takes the new calendar's", async ({
    page,
  }) => {
    // On you@example.com, red like its calendar, with its 10min default
    await calendarEvent(
      page,
      "1:1 with Manager, 3:00 PM to 3:30 PM, Wednesday, June 3",
    ).click();
    await expect(calendarTrigger(page)).toHaveAccessibleName(
      "Calendar: you@example.com",
    );
    await expect(
      page.getByTestId("event-calendar-swatch").locator("span"),
    ).toHaveCount(0);

    await calendarTrigger(page).click();
    await page
      .getByRole("menuitemradio", { name: "you@work.example.com" })
      .click();

    await expect(calendarTrigger(page)).toHaveAccessibleName(
      "Calendar: you@work.example.com",
    );
    // Gray like its new calendar (one swatch), with the work account's 30min
    await expect(
      page.getByTestId("event-calendar-swatch").locator("span"),
    ).toHaveCount(0);
    await expect(reminderRows(page)).toHaveCount(1);
    await expect(reminderRows(page)).toHaveText(reminderText("30", "min"));
  });

  test("the calendar picker sets the event's own color", async ({ page }) => {
    await calendarEvent(page, "Launch Review").click();
    await calendarTrigger(page).click();

    const colors = page.getByRole("group", { name: "Event color" });
    await expect(colors.getByRole("menuitemradio")).toHaveCount(7);
    await expect(
      colors.getByRole("menuitemradio", { name: "Green" }),
    ).toBeChecked();

    // A swatch's name shows in a tooltip
    await colors.getByRole("menuitemradio", { name: "Purple" }).hover();
    await expect(page.getByRole("tooltip")).toHaveText("Purple");

    await colors.getByRole("menuitemradio", { name: "Purple" }).click();
    await expect(colors).toHaveCount(0);

    await calendarTrigger(page).click();
    await expect(
      page
        .getByRole("group", { name: "Event color" })
        .getByRole("menuitemradio", { name: "Purple" }),
    ).toBeChecked();
  });

  test("busy/free and visibility menus change the event, and Escape only closes them", async ({
    page,
  }) => {
    await calendarEvent(page, "Launch Review").click();
    const availability = page.getByRole("button", { name: /^Availability:/ });
    const visibility = page.getByRole("button", { name: /^Visibility:/ });
    await expect(availability).toHaveAccessibleName("Availability: Busy");
    await expect(visibility).toHaveAccessibleName("Visibility: Private");

    await availability.click();
    const busyMenu = page.getByRole("menu", { name: "Availability" });
    await expect(
      busyMenu.getByRole("menuitemradio", { name: "Busy" }),
    ).toBeChecked();

    // Hovering a choice previews it (the trigger is hidden from the
    // accessibility tree while the menu is open, so found by its section);
    // Escape closes the menu, not the event
    await busyMenu.getByRole("menuitemradio", { name: "Free" }).hover();
    await expect(
      detailSection(page, "availability").locator("button").first(),
    ).toHaveText("Free");
    await page.keyboard.press("Escape");
    await expect(busyMenu).toHaveCount(0);
    await expect(availability).toHaveText("Busy");
    await expect(detailTitle(page)).toHaveValue("Launch Review");

    await availability.click();
    await busyMenu.getByRole("menuitemradio", { name: "Free" }).click();
    await expect(availability).toHaveAccessibleName("Availability: Free");

    await visibility.click();
    const visibilityMenu = page.getByRole("menu", { name: "Visibility" });
    await expect(visibilityMenu.getByRole("menuitemradio")).toHaveText([
      "Default visibility",
      "Public",
      "Private",
    ]);
    await visibilityMenu.getByRole("menuitemradio", { name: "Public" }).click();
    await expect(visibility).toHaveAccessibleName("Visibility: Public");

    // The "?" of a choice explains it
    await visibility.click();
    await visibilityMenu
      .getByRole("menuitemradio", { name: "Private" })
      .getByTestId("menu-help")
      .hover();
    await expect(page.getByRole("tooltip")).toHaveText(
      "Nobody can see the details of this event unless they have permission to make changes to this calendar.",
    );
  });

  test("reminders are added from the presets or a typed number, and removed", async ({
    page,
  }) => {
    await calendarEvent(page, "Launch Review").click();
    await expect(reminderRows(page)).toHaveText([
      reminderText("10", "min"),
      reminderText("1", "hour"),
    ]);

    // Focusing the input lists the presets beside the panel
    await reminderInput(page).click();
    const suggestions = page.getByRole("listbox", { name: "Reminders" });
    await expect(suggestions.getByRole("option")).toHaveText([
      "At start of event",
      reminderText("5", "min"),
      reminderText("10", "min"),
      reminderText("30", "min"),
      reminderText("1", "hour"),
    ]);
    await suggestions
      .getByRole("option", { name: "At start of event" })
      .click();
    // Sorted from the one closest to the start
    await expect(reminderRows(page)).toHaveText([
      "At start of event",
      reminderText("10", "min"),
      reminderText("1", "hour"),
    ]);

    // A typed number is offered in every unit; Down previews the next one
    await reminderInput(page).fill("2");
    await expect(suggestions.getByRole("option")).toHaveText([
      reminderText("2", "min"),
      reminderText("2", "hours"),
      reminderText("2", "days"),
      reminderText("2", "weeks"),
    ]);
    await page.keyboard.press("ArrowDown");
    await expect(reminderInput(page)).toHaveValue(/^2\s?hours$/);
    await page.keyboard.press("Enter");
    await expect(reminderRows(page).last()).toHaveText(
      reminderText("2", "hours"),
    );

    // Escape leaves the input and keeps the event selected
    await page.keyboard.press("Escape");
    await expect(suggestions).toHaveCount(0);
    await expect(detailTitle(page)).toHaveValue("Launch Review");

    // Each reminder's × removes it
    await page
      .getByRole("button", { name: "Remove reminder: At start of event" })
      .click();
    await expect(reminderRows(page)).toHaveText([
      reminderText("10", "min"),
      reminderText("1", "hour"),
      reminderText("2", "hours"),
    ]);
  });

  test("typed reminders match unit names, 0 once, and skip duplicates in other units", async ({
    page,
  }) => {
    await calendarEvent(page, "Launch Review").click();
    const suggestions = page.getByRole("listbox", { name: "Reminders" });

    // 0 is the start of the event, whatever the unit
    await reminderInput(page).fill("0");
    await expect(suggestions.getByRole("option")).toHaveText([
      "At start of event",
    ]);

    // Units match by name: "mins", "minutes", "hrs"
    for (const typed of ["10 mins", "10 minutes", "10m"]) {
      await reminderInput(page).fill(typed);
      await expect(suggestions.getByRole("option")).toHaveText([
        reminderText("10", "min"),
      ]);
    }
    await reminderInput(page).fill("2 hrs");
    await expect(suggestions.getByRole("option")).toHaveText([
      reminderText("2", "hours"),
    ]);

    // 60min fires with the 1hour already set, so it isn't added
    await reminderInput(page).fill("60");
    await page.keyboard.press("Enter");
    await expect(reminderRows(page)).toHaveText([
      reminderText("10", "min"),
      reminderText("1", "hour"),
    ]);

    // 2 hours lands after 1 hour, wherever it was added
    await reminderInput(page).fill("2h");
    await page.keyboard.press("Enter");
    await reminderInput(page).fill("5");
    await page.keyboard.press("Enter");
    await expect(reminderRows(page)).toHaveText([
      reminderText("5", "min"),
      reminderText("10", "min"),
      reminderText("1", "hour"),
      reminderText("2", "hours"),
    ]);
  });

  test("adding a reminder closes the list until typing or a new focus", async ({
    page,
  }) => {
    await calendarEvent(page, "Launch Review").click();
    const suggestions = page.getByRole("listbox", { name: "Reminders" });

    // A click on a preset adds it; the input stays focused and empty
    await reminderInput(page).click();
    await suggestions.getByRole("option", { name: /^5\s?min before$/ }).click();
    await expect(suggestions).toHaveCount(0);
    await expect(reminderInput(page)).toBeFocused();
    await expect(reminderInput(page)).toHaveValue("");
    await expect(reminderInput(page)).toHaveAttribute("aria-expanded", "false");

    // Down and a click on the focused input leave it closed
    await page.keyboard.press("ArrowDown");
    await reminderInput(page).click();
    await expect(suggestions).toHaveCount(0);
    await expect(reminderInput(page)).toHaveValue("");

    // Typing opens it; Enter adds and closes it again
    await page.keyboard.type("2");
    await expect(suggestions).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(suggestions).toHaveCount(0);
    await expect(reminderInput(page)).toBeFocused();
    await expect(reminderInput(page)).toHaveValue("");
    await expect(reminderRows(page)).toHaveText([
      reminderText("2", "min"),
      reminderText("5", "min"),
      reminderText("10", "min"),
      reminderText("1", "hour"),
    ]);

    // Focusing the input again lists the presets
    await detailTitle(page).focus();
    await reminderInput(page).click();
    await expect(suggestions.getByRole("option").first()).toHaveText(
      "At start of event",
    );
  });

  test("Escape closes the reminder list and keeps the reminders", async ({
    page,
  }) => {
    await calendarEvent(page, "Launch Review").click();
    await reminderInput(page).click();
    const suggestions = page.getByRole("listbox", { name: "Reminders" });

    // Down previews "At start of event" in the input; Escape drops it
    await page.keyboard.press("ArrowDown");
    await expect(reminderInput(page)).toHaveValue("At start of event");
    await page.keyboard.press("Escape");
    await expect(suggestions).toHaveCount(0);
    await expect(reminderInput(page)).toHaveValue("");
    await expect(reminderRows(page)).toHaveText([
      reminderText("10", "min"),
      reminderText("1", "hour"),
    ]);
    await expect(detailTitle(page)).toHaveValue("Launch Review");
  });

  test("an all-day reminder shows its time of day", async ({ page }) => {
    await calendarEvent(page, "Weekend in Hudson Valley").click();
    await expect(reminderRows(page)).toHaveText(/^1\s?day before at 9 AM$/);
    await expect(
      page.getByRole("button", {
        name: "Remove reminder: 1 day before at 9 AM",
      }),
    ).toHaveCount(1);
  });

  test("the reminder suggestions can be picked in a modal dialog", async ({
    page,
  }) => {
    // What a modal dialog (Radix or Base UI) does to the page: pointer events
    // only reach its own element, and the details render inside it
    await page.evaluate(() => {
      const dialog = document.querySelector("main")?.parentElement;
      if (!dialog || dialog === document.body) throw new Error("No dialog");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.style.pointerEvents = "auto";
      document.body.style.pointerEvents = "none";
    });

    await calendarEvent(page, "Launch Review").click();
    await expect(detailTitle(page)).toHaveValue("Launch Review");

    await reminderInput(page).click();
    const suggestions = page
      .locator('[aria-modal="true"]')
      .getByRole("listbox", { name: "Reminders" });
    await suggestions
      .getByRole("option", { name: "At start of event" })
      .click();
    await expect(reminderRows(page).first()).toHaveText("At start of event");
  });

  test("an all-day event offers day and week reminders", async ({ page }) => {
    await calendarEvent(page, "Launch Review").click();
    await page.getByRole("switch", { name: "All-day" }).click();

    await reminderInput(page).click();
    await expect(
      page.getByRole("listbox", { name: "Reminders" }).getByRole("option"),
    ).toHaveText([
      "At start of event",
      reminderText("1", "day"),
      reminderText("2", "days"),
      reminderText("3", "days"),
      reminderText("1", "week"),
    ]);
  });

  test("Block on calendar moves the event as the picker does", async ({
    page,
  }) => {
    // Red like its you@example.com calendar, with its 10min default
    const event = calendarEvent(
      page,
      "1:1 with Manager, 3:00 PM to 3:30 PM, Wednesday, June 3",
    );
    await event.click({ button: "right" });
    const blockOn = page.getByRole("button", { name: "Block on calendar" });
    await blockOn.hover();
    // The submenu opens beside its trigger, in the same wrapper
    await blockOn
      .locator("..")
      .getByRole("button", { name: "you@work.example.com", exact: true })
      .click();

    await event.click();
    await expect(calendarTrigger(page)).toHaveAccessibleName(
      "Calendar: you@work.example.com",
    );
    await expect(reminderRows(page)).toHaveText(reminderText("30", "min"));
  });
});

test.describe("calendar helpers", () => {
  const personal: CalendarInfo = {
    id: "personal",
    name: "Personal",
    color: "purple",
    email: "you@example.com",
    defaultReminders: [{ amount: 10, unit: "minutes" }],
  };
  const work: CalendarInfo = {
    id: "work",
    name: "Work",
    color: "gray",
    defaultReminders: [{ amount: 30, unit: "minutes" }],
  };
  const calendars = [personal, work];
  const event: DetailedCalendarEvent = {
    id: "review",
    title: "Review",
    start: new Date("2026-06-03T15:00:00Z"),
    end: new Date("2026-06-03T16:00:00Z"),
    calendarId: "personal",
    calendarEmail: "you@example.com",
    reminders: [{ amount: 1, unit: "hours" }],
  };

  test("an event without its own color takes its calendar's, else blue", () => {
    expect(resolveEventColor(event, calendars)).toBe("purple");
    expect(resolveEventColor({ ...event, color: "green" }, calendars)).toBe(
      "green",
    );
    expect(resolveEventColor({ ...event, calendarId: "gone" }, calendars)).toBe(
      "blue",
    );
    expect(resolveEventColor(event, [])).toBe("blue");
  });

  test("reminders are deduped and sorted by when they fire", () => {
    const reminders = addReminder(event.reminders ?? [], {
      amount: 60,
      unit: "minutes",
    });
    expect(reminders).toBe(event.reminders);
    expect(
      addReminder(
        [
          { amount: 10, unit: "minutes" },
          { amount: 1, unit: "weeks" },
        ],
        { amount: 2, unit: "days" },
      ),
    ).toEqual([
      { amount: 10, unit: "minutes" },
      { amount: 2, unit: "days" },
      { amount: 1, unit: "weeks" },
    ]);
    expect(
      addReminder([{ amount: 1, unit: "weeks" }], { amount: 7, unit: "days" }),
    ).toEqual([{ amount: 1, unit: "weeks" }]);
    // An all-day reminder's time of day makes it another moment
    expect(
      addReminder([{ amount: 1, unit: "days" }], {
        amount: 1,
        unit: "days",
        time: { hours: 9, minutes: 0 },
      }),
    ).toEqual([
      { amount: 1, unit: "days", time: { hours: 9, minutes: 0 } },
      { amount: 1, unit: "days" },
    ]);
  });

  test("moving to a calendar swaps the calendar's color, defaults and account only", () => {
    // Drawn in its calendar's color, with hand-set reminders
    expect(moveEventToCalendar(event, work, calendars)).toEqual({
      ...event,
      calendarId: "work",
      calendarEmail: undefined,
    });

    // Its calendar's color and default reminders follow the calendar
    expect(
      moveEventToCalendar(
        {
          ...event,
          color: "purple",
          reminders: [{ amount: 10, unit: "minutes" }],
        },
        work,
        calendars,
      ),
    ).toEqual({
      ...event,
      calendarId: "work",
      calendarEmail: undefined,
      color: "gray",
      reminders: [{ amount: 30, unit: "minutes" }],
    });

    // Its own color stays
    expect(
      moveEventToCalendar({ ...event, color: "green" }, work, calendars).color,
    ).toBe("green");
  });
});
