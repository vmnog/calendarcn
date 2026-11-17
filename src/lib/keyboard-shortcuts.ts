import type {
  KeyboardShortcut,
  KeyboardShortcutGroup,
} from "@/components/calendar-types";

/**
 * Every key `useCalendarShortcuts()` and the views handle, labelled as
 * Notion Calendar labels them where CalendarCN does the same. The full
 * shortcut list (`KEYBOARD_SHORTCUT_GROUPS`) and the details sidebar's
 * useful shortcuts read their keys from here.
 */
export const SHORTCUTS = {
  commandMenu: {
    label: "Command menu",
    keys: ["⌘", "K"],
    keywords: ["palette", "commands"],
  },
  toggleSidebar: {
    label: "Toggle sidebar",
    keys: ["⌘", "/"],
    keywords: ["left", "panel", "collapse"],
  },
  toggleContextPanel: {
    label: "Toggle context panel",
    keys: ["/"],
    keywords: ["right", "panel", "details"],
  },
  cycleTheme: {
    label: "Set theme to light / dark",
    keys: ["⇧", "M"],
    keywords: ["dark mode", "appearance", "system"],
  },
  dismiss: {
    label: "Dismiss or go back",
    keys: ["esc"],
    keywords: ["deselect", "close", "escape"],
  },
  undo: { label: "Undo", keys: ["⌘", "Z"] },
  redo: { label: "Redo", keys: ["⇧", "⌘", "Z"] },
  deleteEvent: {
    label: "Delete",
    keys: ["delete"],
    alternativeKeys: [["⌫"]],
    keywords: ["remove", "backspace"],
  },
  cutEvent: { label: "Cut", keys: ["⌘", "X"] },
  copyEvent: { label: "Copy", keys: ["⌘", "C"] },
  duplicateEvent: { label: "Duplicate", keys: ["⌘", "D"] },
  pasteEvent: { label: "Paste", keys: ["⌘", "V"] },
  createEvent: {
    label: "Create event",
    keys: ["C"],
    keywords: ["new", "add", "compose"],
  },
  meetWith: {
    label: "Meet with...",
    keys: ["F"],
    keywords: ["people", "free time", "availability", "schedule"],
  },
  showTeammateCalendar: {
    label: "Show teammate calendar",
    keys: ["P"],
    keywords: ["people", "team", "colleague"],
  },
  moveEventDay: {
    label: "Move a day earlier / later",
    keys: ["alt", "←"],
    alternativeKeys: [["alt", "→"]],
  },
  moveEventTime: {
    label: "Move earlier / later",
    keys: ["alt", "↑"],
    alternativeKeys: [["alt", "↓"]],
  },
  resizeEvent: {
    label: "End earlier / later",
    keys: ["alt", "⇧", "↑"],
    alternativeKeys: [["alt", "⇧", "↓"]],
    keywords: ["resize", "duration"],
  },
  dayView: {
    label: "Display day view",
    keys: ["1"],
    alternativeKeys: [["D"]],
  },
  numberOfDays: {
    label: "Display 2–9 days",
    keys: ["2–9"],
    keywords: ["number of days"],
  },
  weekView: {
    label: "Display week view",
    keys: ["0"],
    alternativeKeys: [["W"]],
  },
  monthView: { label: "Display month view", keys: ["M"] },
  yearView: { label: "Display year view", keys: ["Y"] },
  agendaView: { label: "Display agenda view", keys: ["A"], keywords: ["list"] },
  selectAllVisible: {
    label: "Select all visible",
    keys: ["⌘", "A"],
    keywords: ["several", "multiple", "events"],
  },
  toggleWeekends: {
    label: "Show / hide weekends",
    keys: ["⇧", "⌘", "E"],
  },
  defaultHourSize: {
    label: "Default hour size",
    keys: ["⇧", "⌘", "0"],
    keywords: ["zoom", "reset"],
  },
  zoomHoursIn: {
    label: "Zoom hours in",
    keys: ["⇧", "⌘", "."],
    keywords: ["hour size", "taller"],
  },
  zoomHoursOut: {
    label: "Zoom hours out",
    keys: ["⇧", "⌘", ","],
    keywords: ["hour size", "shorter"],
  },
  goToDate: {
    label: "Go to date",
    keys: ["."],
    keywords: ["jump", "navigate"],
  },
  goToToday: { label: "Go to today", keys: ["T"], keywords: ["now"] },
  goToNext: {
    label: "Go to next period",
    keys: ["K"],
    alternativeKeys: [["→"]],
    keywords: ["week", "month", "forward"],
  },
  goToPrevious: {
    label: "Go to previous period",
    keys: ["J"],
    alternativeKeys: [["←"]],
    keywords: ["week", "month", "back"],
  },
  showShortcuts: {
    label: "Show this view",
    keys: ["?"],
    keywords: ["keyboard shortcuts", "help", "cheat sheet"],
  },
  openSettings: {
    label: "Go to settings",
    keys: ["⌘", ","],
    keywords: ["preferences"],
  },
} satisfies Record<string, KeyboardShortcut>;

/**
 * The full shortcut list, grouped and ordered as Notion Calendar's (General,
 * Workflows, Editing, Calendar view, Calendar navigation, App navigation),
 * with only the keys CalendarCN handles. The app keys (command menu, panels,
 * theme, Meet with, teammate calendars, Go to date, this list, settings) work
 * only where the app passes their actions to `useCalendarShortcuts()`, as
 * `CalendarApp` does.
 */
export const KEYBOARD_SHORTCUT_GROUPS: KeyboardShortcutGroup[] = [
  {
    heading: "General",
    shortcuts: [
      SHORTCUTS.commandMenu,
      SHORTCUTS.toggleSidebar,
      SHORTCUTS.toggleContextPanel,
      SHORTCUTS.cycleTheme,
      SHORTCUTS.dismiss,
      SHORTCUTS.undo,
      SHORTCUTS.redo,
    ],
    sections: [
      {
        heading: "With a selected event…",
        shortcuts: [
          SHORTCUTS.deleteEvent,
          SHORTCUTS.cutEvent,
          SHORTCUTS.copyEvent,
          SHORTCUTS.duplicateEvent,
        ],
      },
      {
        heading: "With a cut / copied event…",
        shortcuts: [SHORTCUTS.pasteEvent],
      },
    ],
  },
  {
    heading: "Workflows",
    shortcuts: [
      SHORTCUTS.createEvent,
      SHORTCUTS.meetWith,
      SHORTCUTS.showTeammateCalendar,
    ],
  },
  {
    heading: "Editing",
    shortcuts: [],
    sections: [
      {
        heading: "With a focused event…",
        shortcuts: [
          SHORTCUTS.moveEventDay,
          SHORTCUTS.moveEventTime,
          SHORTCUTS.resizeEvent,
        ],
      },
    ],
  },
  {
    heading: "Calendar view",
    shortcuts: [
      SHORTCUTS.dayView,
      SHORTCUTS.numberOfDays,
      SHORTCUTS.weekView,
      SHORTCUTS.monthView,
      SHORTCUTS.yearView,
      SHORTCUTS.agendaView,
      SHORTCUTS.selectAllVisible,
      SHORTCUTS.toggleWeekends,
      SHORTCUTS.defaultHourSize,
      SHORTCUTS.zoomHoursIn,
      SHORTCUTS.zoomHoursOut,
    ],
  },
  {
    heading: "Calendar navigation",
    shortcuts: [
      SHORTCUTS.goToDate,
      SHORTCUTS.goToToday,
      SHORTCUTS.goToNext,
      SHORTCUTS.goToPrevious,
    ],
  },
  {
    heading: "App navigation",
    shortcuts: [SHORTCUTS.showShortcuts, SHORTCUTS.openSettings],
  },
];

/**
 * The groups with only the shortcuts `keep` accepts. A group or section left
 * with none is dropped.
 */
export function filterKeyboardShortcutGroups(
  groups: KeyboardShortcutGroup[],
  keep: (shortcut: KeyboardShortcut) => boolean,
): KeyboardShortcutGroup[] {
  return groups.flatMap((group) => {
    const shortcuts = group.shortcuts.filter(keep);
    if (!group.sections) {
      return shortcuts.length === 0 ? [] : [{ ...group, shortcuts }];
    }
    const sections = filterKeyboardShortcutGroups(group.sections, keep);
    if (shortcuts.length === 0 && sections.length === 0) return [];
    return [{ ...group, shortcuts, sections }];
  });
}

/** Lowercase, without accents, for comparing typed text */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Whether a shortcut matches text typed in the list's find field: each word
 * appears in its label or keywords ("go date", "theme"), or the text is one
 * of its keys ("t" finds Go to today, "?" this list)
 */
export function matchesKeyboardShortcut(
  shortcut: KeyboardShortcut,
  query: string,
): boolean {
  const typed = normalize(query);
  if (typed.length === 0) return true;

  const keys = [shortcut.keys, ...(shortcut.alternativeKeys ?? [])].flat();
  if (keys.some((key) => normalize(key) === typed)) return true;

  const words = normalize(
    [shortcut.label, ...(shortcut.keywords ?? [])].join(" "),
  );
  return typed.split(/\s+/).every((word) => words.includes(word));
}

/** The groups with only the shortcuts that match `query` (see `matchesKeyboardShortcut`) */
export function findKeyboardShortcuts(
  groups: KeyboardShortcutGroup[],
  query: string,
): KeyboardShortcutGroup[] {
  return filterKeyboardShortcutGroups(groups, (shortcut) =>
    matchesKeyboardShortcut(shortcut, query),
  );
}
