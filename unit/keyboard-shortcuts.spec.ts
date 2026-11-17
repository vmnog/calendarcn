import { expect, test } from "@playwright/test";

import {
  KEYBOARD_SHORTCUT_GROUPS,
  SHORTCUTS,
  filterKeyboardShortcutGroups,
  findKeyboardShortcuts,
  matchesKeyboardShortcut,
} from "@/lib/keyboard-shortcuts";
import type { KeyboardShortcutGroup } from "@/components/calendar-types";

/**
 * The full keyboard shortcut list (`src/lib/keyboard-shortcuts.ts`): its
 * groups and the find field's matching. Runs in Node without a page.
 */

/** Every label the groups list, sections included, in order */
function labels(groups: KeyboardShortcutGroup[]): string[] {
  return groups.flatMap((group) => [
    ...group.shortcuts.map((shortcut) => shortcut.label),
    ...labels(group.sections ?? []),
  ]);
}

test("the groups follow Notion Calendar's order", () => {
  expect(KEYBOARD_SHORTCUT_GROUPS.map((group) => group.heading)).toEqual([
    "General",
    "Workflows",
    "Editing",
    "Calendar view",
    "Calendar navigation",
    "App navigation",
  ]);
});

test("every shortcut is listed once", () => {
  const listed = labels(KEYBOARD_SHORTCUT_GROUPS);
  expect(new Set(listed).size).toBe(listed.length);
  expect([...listed].sort()).toEqual(
    Object.values(SHORTCUTS)
      .map((shortcut) => shortcut.label)
      .sort(),
  );
});

test("the find field matches words of the label or keywords, in any case", () => {
  expect(matchesKeyboardShortcut(SHORTCUTS.goToDate, "date")).toBe(true);
  expect(matchesKeyboardShortcut(SHORTCUTS.goToDate, "Go DATE")).toBe(true);
  expect(matchesKeyboardShortcut(SHORTCUTS.goToDate, "jump")).toBe(true);
  expect(matchesKeyboardShortcut(SHORTCUTS.goToDate, "today")).toBe(false);
  expect(matchesKeyboardShortcut(SHORTCUTS.cycleTheme, "dark mode")).toBe(true);
  expect(matchesKeyboardShortcut(SHORTCUTS.goToToday, "")).toBe(true);
});

test("the find field matches a key typed alone", () => {
  expect(matchesKeyboardShortcut(SHORTCUTS.goToToday, "t")).toBe(true);
  expect(matchesKeyboardShortcut(SHORTCUTS.showShortcuts, "?")).toBe(true);
  expect(matchesKeyboardShortcut(SHORTCUTS.goToDate, ".")).toBe(true);
  // An alternative key: D for day view, ← for the previous period
  expect(matchesKeyboardShortcut(SHORTCUTS.dayView, "d")).toBe(true);
  expect(matchesKeyboardShortcut(SHORTCUTS.goToPrevious, "←")).toBe(true);
});

test("finding keeps the groups and sections that still have a match", () => {
  const found = findKeyboardShortcuts(KEYBOARD_SHORTCUT_GROUPS, "paste");
  expect(found.map((group) => group.heading)).toEqual(["General"]);
  expect(found[0].shortcuts).toEqual([]);
  expect(found[0].sections?.map((section) => section.heading)).toEqual([
    "With a cut / copied event…",
  ]);
  expect(labels(found)).toEqual(["Paste"]);

  expect(findKeyboardShortcuts(KEYBOARD_SHORTCUT_GROUPS, "zzz")).toEqual([]);
  expect(findKeyboardShortcuts(KEYBOARD_SHORTCUT_GROUPS, "  ")).toEqual(
    KEYBOARD_SHORTCUT_GROUPS,
  );
});

test("a filter drops one shortcut, and a group it empties", () => {
  const withoutSettings = filterKeyboardShortcutGroups(
    KEYBOARD_SHORTCUT_GROUPS,
    (shortcut) => shortcut !== SHORTCUTS.openSettings,
  );
  expect(labels(withoutSettings)).not.toContain("Go to settings");
  expect(labels(withoutSettings)).toContain("Show this view");

  const onlyCreate = filterKeyboardShortcutGroups(
    KEYBOARD_SHORTCUT_GROUPS,
    (shortcut) => shortcut === SHORTCUTS.createEvent,
  );
  expect(onlyCreate.map((group) => group.heading)).toEqual(["Workflows"]);
});
