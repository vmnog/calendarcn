"use client";

import * as React from "react";

import { useCalendar } from "@/components/calendar-provider";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { NUMBER_OF_DAYS_OPTIONS } from "@/lib/event-utils";

import type { WeekStartsOn } from "@/components/calendar-types";

/** Reusable "Soon" badge for unimplemented command items */
const SOON_BADGE = (
  <span className="bg-muted text-muted-foreground ml-auto rounded px-1.5 py-0.5 text-[10px] leading-none font-medium">
    Soon
  </span>
);

/**
 * The menu's look, on the dialog: translucent and blurred in dark mode, and
 * a gap between groups. `data-command-menu` on the same element lets the CSS
 * that ships with the menu dim the page less in dark mode.
 */
const DIALOG_CLASS =
  "overflow-hidden p-0 dark:bg-popover/60 dark:backdrop-blur-xl dark:border-border/50 dark:[&_[data-slot=command]]:bg-transparent [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-2";

/** Taller input and items, and padded group headings, as shadcn/ui's CommandDialog has them */
const COMMAND_CLASS =
  "**:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5";

/** A second list the menu shows in place of the commands, as Notion Calendar's does */
type MenuPage = "week-start" | "number-of-days";

/** One command of the menu */
interface MenuCommand {
  label: string;
  /** Shortcut keys shown on the right, e.g. ["⌘", "/"] */
  keys?: string[];
  /** Runs the command once the menu has closed. Missing when the app doesn't offer it */
  run?: () => void;
  /** Opens a second list to pick from instead of running */
  page?: MenuPage;
  /** Not built yet: listed disabled with a "Soon" badge, only with `showComingSoon` */
  soon?: boolean;
}

/** What a second list says in its search field, as Notion Calendar words it */
const PAGE_PLACEHOLDERS: Record<MenuPage, string> = {
  "week-start": "Start week on...",
  "number-of-days": "Set number of displayed days...",
};

/**
 * Days "Start week on..." offers, Monday first, and how it names them. The
 * day the week starts on now is left out, as in Notion Calendar.
 */
const WEEK_START_CHOICES: Array<{ day: WeekStartsOn; label: string }> = [
  { day: 1, label: "Mondays" },
  { day: 2, label: "Tuesdays" },
  { day: 3, label: "Wednesdays" },
  { day: 4, label: "Thursdays" },
  { day: 5, label: "Fridays" },
  { day: 6, label: "Saturdays" },
  { day: 0, label: "Sundays" },
];

/** A titled group of commands */
interface MenuGroup {
  heading: string;
  commands: MenuCommand[];
}

interface CommandMenuProps {
  /** Whether the menu is open */
  open: boolean;
  /** Called when the menu opens or closes, including after a command runs */
  onOpenChange: (open: boolean) => void;
  /** Adds "Toggle sidebar" (⌘ /) */
  onToggleSidebar?: () => void;
  /** Adds "Toggle context panel" (/) */
  onToggleContextPanel?: () => void;
  /** Adds "Set theme..." (Shift M) */
  onCycleTheme?: () => void;
  /** Adds "Import .ics file..." */
  onImportIcs?: () => void;
  /** Adds "Export .ics file" */
  onExportIcs?: () => void;
  /**
   * Also lists the Notion Calendar commands CalendarCN doesn't have yet,
   * disabled with a "Soon" badge, as the live demo does
   */
  showComingSoon?: boolean;
}

/**
 * The live demo's ⌘K menu. Going to today, previous and next, and the views
 * come from `useCalendar()`, so it goes inside `CalendarProvider`. Commands
 * that belong to your app (panels, theme, .ics files) show only when you pass
 * their callback. Open it with `useCalendarShortcuts({ onToggleCommandMenu })`.
 */
export function CommandMenu({
  open,
  onOpenChange,
  onToggleSidebar,
  onToggleContextPanel,
  onCycleTheme,
  onImportIcs,
  onExportIcs,
  showComingSoon = false,
}: CommandMenuProps) {
  const {
    goToToday,
    goToPrev,
    goToNext,
    switchView,
    weekStartsOn,
    setWeekStartsOn,
    setNumberOfDays,
    zoomHoursIn,
    zoomHoursOut,
    resetHourHeight,
  } = useCalendar();
  /** The search field, focused again when a second list opens */
  const inputRef = React.useRef<HTMLInputElement>(null);
  /** The second list on screen, or `null` for the commands */
  const [page, setPage] = React.useState<MenuPage | null>(null);
  const [search, setSearch] = React.useState("");
  const [wasOpen, setWasOpen] = React.useState(open);

  // Every opening starts on the commands, with an empty search. Adjusted
  // while rendering, so a reopened menu never flashes the old list.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPage(null);
      setSearch("");
    }
  }

  const runCommand = React.useCallback(
    (command: () => void) => {
      onOpenChange(false);
      command();
    },
    [onOpenChange],
  );

  const openPage = React.useCallback((next: MenuPage) => {
    setPage(next);
    setSearch("");
  }, []);

  // A click on a command takes focus from the search field: give it back,
  // so typing filters the second list
  React.useEffect(() => {
    if (page) inputRef.current?.focus();
  }, [page]);

  /** Opens the command's second list, or runs it */
  const selectCommand = (command: MenuCommand) => {
    if (command.page) {
      openPage(command.page);
      return;
    }
    if (command.run) runCommand(command.run);
  };

  /** Backspace in an empty search goes back from a second list */
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Backspace" || search !== "" || page === null) return;
      e.preventDefault();
      setPage(null);
    },
    [search, page],
  );

  const groups: MenuGroup[] = [
    {
      heading: "Calendar",
      commands: [
        { label: "Create event...", soon: true },
        { label: "Meet with...", soon: true },
        { label: "Show teammate calendar...", soon: true },
        { label: "Create recurring scheduling link...", soon: true },
        { label: "Create one-off scheduling link...", soon: true },
        { label: "Import .ics file...", run: onImportIcs },
        { label: "Export .ics file", run: onExportIcs },
      ],
    },
    {
      heading: "Navigation",
      commands: [
        { label: "Go to date...", soon: true },
        { label: "Go to today", keys: ["T"], run: goToToday },
        { label: "Go to next week", keys: ["K"], run: goToNext },
        { label: "Go to previous week", keys: ["J"], run: goToPrev },
        { label: "Search events", soon: true },
      ],
    },
    {
      heading: "Time zones",
      commands: [
        { label: "Travel to time zone...", soon: true },
        { label: "Show additional time zones...", soon: true },
      ],
    },
    {
      heading: "App",
      commands: [
        { label: "Toggle sidebar", keys: ["⌘", "/"], run: onToggleSidebar },
        { label: "Set theme...", keys: ["shift", "M"], run: onCycleTheme },
      ],
    },
    {
      heading: "View",
      commands: [
        { label: "Start week on...", page: "week-start" },
        {
          label: "Display day view",
          keys: ["D"],
          run: () => switchView("day"),
        },
        {
          label: "Display week view",
          keys: ["W"],
          run: () => switchView("week"),
        },
        {
          label: "Display month view",
          keys: ["M"],
          run: () => switchView("month"),
        },
        {
          label: "Display year view",
          keys: ["Y"],
          run: () => switchView("year"),
        },
        {
          label: "Display agenda view",
          keys: ["A"],
          run: () => switchView("agenda"),
        },
        { label: "Set number of displayed days...", page: "number-of-days" },
        { label: "Select all visible", soon: true },
        {
          label: "Default hour size",
          keys: ["shift", "⌘", "0"],
          run: resetHourHeight,
        },
        {
          label: "Zoom hours in",
          keys: ["shift", "⌘", "."],
          run: zoomHoursIn,
        },
        {
          label: "Zoom hours out",
          keys: ["shift", "⌘", ","],
          run: zoomHoursOut,
        },
        { label: "Hide weekends", soon: true },
        { label: "Hide declined events", soon: true },
        { label: "Hide week numbers", soon: true },
      ],
    },
    {
      heading: "Settings & help",
      commands: [
        { label: "Get CalendarCN mobile app", soon: true },
        { label: "Show keyboard shortcuts", soon: true },
        { label: "Go to settings", soon: true },
        { label: "Support & feedback", soon: true },
      ],
    },
    {
      heading: "Accounts",
      commands: [
        { label: "Add Google Calendar account", soon: true },
        { label: "Manage calendar accounts", soon: true },
        { label: "Log out", soon: true },
      ],
    },
    {
      heading: "CalendarCN",
      commands: [
        { label: "Check for update", soon: true },
        { label: "About CalendarCN", soon: true },
      ],
    },
    {
      heading: "Panels",
      commands: [
        {
          label: "Toggle context panel",
          keys: ["/"],
          run: onToggleContextPanel,
        },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        data-command-menu=""
        className={DIALOG_CLASS}
      >
        <DialogTitle className="sr-only">Command Menu</DialogTitle>
        <DialogDescription className="sr-only">
          Search for a command to run...
        </DialogDescription>
        <Command className={COMMAND_CLASS} onKeyDown={handleKeyDown}>
          <CommandInput
            ref={inputRef}
            placeholder={page ? PAGE_PLACEHOLDERS[page] : "Type a command..."}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {page === "week-start" &&
              WEEK_START_CHOICES.filter(({ day }) => day !== weekStartsOn).map(
                ({ day, label }) => (
                  <CommandItem
                    key={label}
                    onSelect={() => runCommand(() => setWeekStartsOn(day))}
                  >
                    {label}
                  </CommandItem>
                ),
              )}
            {/* Bare numbers, as Notion Calendar lists them */}
            {page === "number-of-days" &&
              NUMBER_OF_DAYS_OPTIONS.map((count) => (
                <CommandItem
                  key={count}
                  value={String(count)}
                  onSelect={() => runCommand(() => setNumberOfDays(count))}
                >
                  {count}
                </CommandItem>
              ))}
            {page === null &&
              groups.map((group) => {
                const commands = group.commands.filter((command) =>
                  command.soon
                    ? showComingSoon
                    : command.run !== undefined || command.page !== undefined,
                );
                if (commands.length === 0) return null;

                return (
                  <CommandGroup key={group.heading} heading={group.heading}>
                    {commands.map((command) => (
                      <CommandItem
                        key={command.label}
                        disabled={command.soon}
                        onSelect={() => selectCommand(command)}
                      >
                        {command.label}
                        {command.soon && SOON_BADGE}
                        {command.keys && (
                          <KbdGroup className="ml-auto">
                            {command.keys.map((key) => (
                              <Kbd key={key}>{key}</Kbd>
                            ))}
                          </KbdGroup>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
          </CommandList>

          <div className="border-t px-3 py-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="text-muted-foreground/70">↑↓</span> Navigate
            </span>
            <span className="flex items-center gap-1">
              <span className="text-muted-foreground/70">↵</span> Select
            </span>
            <span className="flex items-center gap-1">
              <Kbd>esc</Kbd> Close
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
