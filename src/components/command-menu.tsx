"use client";

import * as React from "react";

import { useToday } from "@/hooks/use-now";
import { useCalendar, useCalendarConfig } from "@/components/calendar-provider";
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
import { formatDateQueryResult, parseDateQuery } from "@/lib/date-query";
import type { CommandMenuPage } from "@/components/week-view-types";

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

/** Go to date's placeholder, as Notion Calendar's */
const GO_TO_DATE_PLACEHOLDER = "e.g. nov 5, in 10 weeks";

/** One command of the menu */
interface MenuCommand {
  label: string;
  /** Shortcut keys shown on the right, e.g. ["⌘", "/"] */
  keys?: string[];
  /** Runs the command once the menu has closed. Missing when the app doesn't offer it */
  run?: () => void;
  /** Runs the command with the menu still open, e.g. to show one of its pages */
  keepOpen?: boolean;
  /**
   * The command focuses something (a field, a new event's title): it runs
   * once the menu has closed and given focus back
   */
  movesFocus?: boolean;
  /** Not built yet: listed disabled with a "Soon" badge, only with `showComingSoon` */
  soon?: boolean;
}

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
   * Adds "Search events", and "Search events for “…”" once text is typed:
   * opens your event search with that text (empty for the first)
   */
  onSearchEvents?: (query: string) => void;
  /** Adds "Show keyboard shortcuts" (?) */
  onShowShortcuts?: () => void;
  /**
   * Page the menu opens on, each time it opens: its commands, or Go to
   * date's field (as the . key does). Defaults to "commands"
   */
  defaultPage?: CommandMenuPage;
  /**
   * Also lists the Notion Calendar commands CalendarCN doesn't have yet,
   * disabled with a "Soon" badge, as the live demo does
   */
  showComingSoon?: boolean;
}

/**
 * The live demo's ⌘K menu. Creating an event, going to a date, today,
 * previous and next, and the views come from `useCalendar()`, so it goes
 * inside `CalendarProvider`. Commands that belong to your app (panels,
 * search, shortcuts, theme, .ics files) show only when you pass their
 * callback. Open it with `useCalendarShortcuts({ onToggleCommandMenu })`.
 *
 * "Go to date..." turns the field into a date field, as in Notion Calendar:
 * type a date ("tomorrow", "next friday", "dec 25", "in 2 weeks"), see which
 * day it reads, and press Enter to show it in the current view. Backspace
 * in the empty field goes back to the commands.
 */
export function CommandMenu({
  open,
  onOpenChange,
  onToggleSidebar,
  onToggleContextPanel,
  onCycleTheme,
  onImportIcs,
  onExportIcs,
  onSearchEvents,
  onShowShortcuts,
  defaultPage = "commands",
  showComingSoon = false,
}: CommandMenuProps) {
  const {
    goToToday,
    goToPrev,
    goToNext,
    switchView,
    navigateToDate,
    addEventAtNextSlot,
  } = useCalendar();
  /** The page shown: the commands, or Go to date's field */
  const [page, setPage] = React.useState<CommandMenuPage>(defaultPage);
  /** Text typed in the field, on either page */
  const [search, setSearch] = React.useState("");

  // Each opening starts on `defaultPage` with an empty field
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    setPage(defaultPage);
    setSearch("");
  }

  const runCommand = React.useCallback(
    (command: () => void) => {
      onOpenChange(false);
      command();
    },
    [onOpenChange],
  );

  /** The dialog's content, while it's in the page */
  const contentRef = React.useRef<HTMLDivElement>(null);

  /**
   * Closes the menu, then runs `command` once the dialog has left the page
   * and handed focus back to where it was, so the focus `command` moves
   * stays
   */
  const runCommandAfterClose = React.useCallback(
    (command: () => void) => {
      onOpenChange(false);
      const runOnceClosed = () => {
        if (contentRef.current?.isConnected) {
          requestAnimationFrame(runOnceClosed);
          return;
        }
        setTimeout(command, 0);
      };
      requestAnimationFrame(runOnceClosed);
    },
    [onOpenChange],
  );

  /** Runs a picked command: in place, then or once the menu has closed */
  const selectCommand = ({ run, keepOpen, movesFocus }: MenuCommand) => {
    if (!run) return;
    if (keepOpen) {
      run();
      return;
    }
    if (movesFocus) {
      runCommandAfterClose(run);
      return;
    }
    runCommand(run);
  };

  /** Shows a page of the menu with an empty field */
  const showPage = React.useCallback((next: CommandMenuPage) => {
    setPage(next);
    setSearch("");
  }, []);

  // Backspace in Go to date's empty field goes back to the commands
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (page === "commands" || e.key !== "Backspace" || search !== "") return;
    e.preventDefault();
    showPage("commands");
  };

  const groups: MenuGroup[] = [
    {
      heading: "Calendar",
      commands: [
        {
          label: "Create event...",
          keys: ["C"],
          run: addEventAtNextSlot,
          movesFocus: true,
        },
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
        {
          label: "Go to date...",
          keys: ["."],
          run: () => showPage("go-to-date"),
          keepOpen: true,
        },
        { label: "Go to today", keys: ["T"], run: goToToday },
        { label: "Go to next week", keys: ["K"], run: goToNext },
        { label: "Go to previous week", keys: ["J"], run: goToPrev },
        {
          label: "Search events",
          run: onSearchEvents ? () => onSearchEvents("") : undefined,
          movesFocus: true,
        },
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
        { label: "Start week on...", soon: true },
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
        { label: "Set number of displayed days...", soon: true },
        { label: "Select all visible", soon: true },
        { label: "Default hour size", soon: true },
        { label: "Zoom hours in", soon: true },
        { label: "Zoom hours out", soon: true },
        { label: "Hide weekends", soon: true },
        { label: "Hide declined events", soon: true },
        { label: "Hide week numbers", soon: true },
      ],
    },
    {
      heading: "Settings & help",
      commands: [
        { label: "Get CalendarCN mobile app", soon: true },
        {
          label: "Show keyboard shortcuts",
          keys: ["?"],
          run: onShowShortcuts,
          movesFocus: true,
        },
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
  // Go to date's page lists the typed date alone
  const shownGroups = page === "commands" ? groups : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        showCloseButton={false}
        data-command-menu=""
        className={DIALOG_CLASS}
      >
        <DialogTitle className="sr-only">Command Menu</DialogTitle>
        <DialogDescription className="sr-only">
          Search for a command to run...
        </DialogDescription>
        {/* Go to date's result is the typed date itself: no filtering */}
        <Command className={COMMAND_CLASS} shouldFilter={page === "commands"}>
          <CommandInput
            placeholder={
              page === "go-to-date"
                ? GO_TO_DATE_PLACEHOLDER
                : "Type a command..."
            }
            value={search}
            onValueChange={setSearch}
            onKeyDown={handleInputKeyDown}
          />
          <CommandList>
            {(page === "commands" || search.trim() !== "") && (
              <CommandEmpty>No results found.</CommandEmpty>
            )}
            {shownGroups.map((group) => {
              const commands = group.commands.filter((command) =>
                command.soon ? showComingSoon : command.run !== undefined,
              );
              if (commands.length === 0) return null;

              return (
                <CommandGroup key={group.heading} heading={group.heading}>
                  {commands.map((command) => (
                    <CommandItem
                      key={command.label}
                      disabled={command.soon}
                      onSelect={
                        command.run ? () => selectCommand(command) : undefined
                      }
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
            {page === "commands" && onSearchEvents && search.trim() !== "" && (
              <CommandGroup heading="Search" forceMount>
                <CommandItem
                  forceMount
                  value={`search-events-${search}`}
                  onSelect={() =>
                    runCommandAfterClose(() => onSearchEvents(search.trim()))
                  }
                >
                  Search events for “{search.trim()}”
                </CommandItem>
              </CommandGroup>
            )}
            {page === "go-to-date" && (
              <GoToDateResult
                query={search}
                onSelect={(date) => runCommand(() => navigateToDate(date))}
              />
            )}
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

interface GoToDateResultProps {
  /** Text typed in Go to date's field */
  query: string;
  /** Called with the day the text reads when it's picked */
  onSelect: (date: Date) => void;
}

/**
 * Go to date's one result: the day the typed text reads, with its weekday
 * so "next friday" can be checked before going there. Nothing while the text
 * reads as no date.
 */
function GoToDateResult({ query, onSelect }: GoToDateResultProps) {
  const { weekStartsOn } = useCalendar();
  const { locale } = useCalendarConfig();
  const today = useToday();
  if (!today) return null;
  const date = parseDateQuery(query, { today, locale, weekStartsOn });
  if (!date) return null;

  return (
    <CommandGroup heading="Go to date">
      <CommandItem value={query} onSelect={() => onSelect(date)}>
        {formatDateQueryResult(date, today, locale)}
      </CommandItem>
    </CommandGroup>
  );
}
