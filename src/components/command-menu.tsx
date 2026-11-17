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
import { TimeZoneList } from "@/components/time-zone-list";
import { formatDateQueryResult, parseDateQuery } from "@/lib/date-query";
import { NUMBER_OF_DAYS_OPTIONS } from "@/lib/event-utils";
import {
  addTimeZone,
  getViewerTimeZone,
  makeTimeZonePrimary,
  removeTimeZone,
} from "@/lib/time-zones";
import type { WeekStartsOn } from "@/components/calendar-types";
import type {
  CommandMenuPage,
  TimeZoneCommand,
} from "@/components/week-view-types";

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

/** Each time zone command's label, which its list's input shows too */
const TIME_ZONE_COMMAND_LABELS: Record<TimeZoneCommand, string> = {
  travel: "Travel to time zone...",
  add: "Show additional time zones...",
  primary: "Make time zone primary...",
  hide: "Hide time zone...",
};

/** A list of choices the menu shows in place of the commands, as Notion Calendar's does */
type ChoiceList = "week-start" | "number-of-days";

/** Each list's command label, which its input shows too, as Notion Calendar words it */
const CHOICE_LIST_LABELS: Record<ChoiceList, string> = {
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

/** One command of the menu */
interface MenuCommand {
  label: string;
  /** Shortcut keys shown on the right, e.g. ["⌘", "/"] */
  keys?: string[];
  /** Runs the command once the menu has closed. Missing when the app doesn't offer it */
  run?: () => void;
  /**
   * The command focuses something (a field, a new event's title): it runs
   * once the menu has closed and given focus back
   */
  movesFocus?: boolean;
  /** Not built yet: listed disabled with a "Soon" badge, only with `showComingSoon` */
  soon?: boolean;
  /**
   * Runs with the menu still open: it shows what to type or pick next in
   * its place (Go to date's field, a zone list, a list of choices)
   */
  keepsOpen?: boolean;
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
  /** Adds "Go to settings" (⌘ ,) */
  onOpenSettings?: () => void;
  /** Adds "Support & feedback", e.g. to open your issue tracker */
  onSupport?: () => void;
  /** Adds "Add calendar account" */
  onAddCalendarAccount?: () => void;
  /** Adds "Manage calendar accounts" */
  onManageCalendarAccounts?: () => void;
  /** Adds "About CalendarCN", e.g. to open your docs */
  onAbout?: () => void;
  /** Adds "Meet with..." (F): open a people picker that meets with who you pick */
  onMeetWith?: () => void;
  /** Adds "Show teammate calendar..." (P): open a people picker that shows their calendar */
  onShowTeammateCalendar?: () => void;
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
  /**
   * Opens the menu on a time zone command's list instead of the commands,
   * e.g. `"travel"` for the Z key
   */
  timeZoneCommand?: TimeZoneCommand;
}

/**
 * The live demo's ⌘K menu. Creating an event, going to a date, today,
 * previous and next, the views, the view settings, the week start, the day
 * count, the hour size and the time zones come from `useCalendar()`, so it
 * goes inside `CalendarProvider`. A time zone command lists the zones in the
 * menu's place, and "Start week on..." and "Set number of displayed days..."
 * their choices. Commands that belong to your app (panels, search, shortcuts,
 * theme, .ics files, people, settings, accounts, support and about) show only
 * when you pass their callback. Open it with
 * `useCalendarShortcuts({ onToggleCommandMenu })`.
 *
 * "Go to date..." turns the field into a date field, as in Notion Calendar:
 * type a date ("tomorrow", "next friday", "dec 25", "in 2 weeks"), see which
 * day it reads, and press Enter to show it in the current view. A time zone
 * command lists the zones in the menu's place. Backspace in the empty field
 * goes back to the commands.
 */
export function CommandMenu({
  open,
  onOpenChange,
  onToggleSidebar,
  onToggleContextPanel,
  onCycleTheme,
  onImportIcs,
  onExportIcs,
  onOpenSettings,
  onSupport,
  onAddCalendarAccount,
  onManageCalendarAccounts,
  onAbout,
  onMeetWith,
  onShowTeammateCalendar,
  onSearchEvents,
  onShowShortcuts,
  defaultPage = "commands",
  showComingSoon = false,
  timeZoneCommand,
}: CommandMenuProps) {
  const {
    goToToday,
    goToPrev,
    goToNext,
    switchView,
    viewSettings,
    toggleWeekends,
    toggleDeclinedEvents,
    toggleWeekNumbers,
    weekStartsOn,
    setWeekStartsOn,
    setNumberOfDays,
    zoomHoursIn,
    zoomHoursOut,
    resetHourHeight,
    navigateToDate,
    addEventAtNextSlot,
    timeZones,
    changeTimeZones,
    travelToTimeZone,
  } = useCalendar();
  /** The page shown: the commands, or Go to date's field */
  const [page, setPage] = React.useState<CommandMenuPage>(defaultPage);
  /** The time zone command whose list shows in place of the commands */
  const [zoneCommand, setZoneCommand] = React.useState<TimeZoneCommand | null>(
    null,
  );
  /** The list of choices shown in place of the commands, if one is */
  const [choiceList, setChoiceList] = React.useState<ChoiceList | null>(null);
  /** Text typed in the input, for the commands, Go to date or a list */
  const [query, setQuery] = React.useState("");
  /** The input, focused again when a zone list or Go to date replaces the commands */
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Each opening starts on `defaultPage`, or on the list `timeZoneCommand`
  // names, with an empty field. Adjusted while rendering, so the first frame
  // is already right
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPage(defaultPage);
      setZoneCommand(timeZoneCommand ?? null);
      setChoiceList(null);
      setQuery("");
    }
  }
  const hasOtherZones = timeZones.secondary.length > 0;

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
  const selectCommand = ({ run, keepsOpen, movesFocus }: MenuCommand) => {
    if (!run) return;
    if (keepsOpen) {
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
    setQuery("");
  }, []);

  /** Lists a time zone command's zones in place of the commands */
  const openZoneCommand = (command: TimeZoneCommand) => {
    setZoneCommand(command);
    setQuery("");
  };

  /** Lists a command's choices in place of the commands */
  const openChoiceList = (list: ChoiceList) => {
    setChoiceList(list);
    setQuery("");
  };

  // A click on Go to date, a time zone command or a list of choices takes
  // the focus: give it back to the input, so typing goes there
  React.useEffect(() => {
    if (zoneCommand || choiceList || page !== "commands") {
      inputRef.current?.focus();
    }
  }, [zoneCommand, choiceList, page]);

  // Backspace in an empty date, zone or choice field goes back to the commands
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Backspace" || query !== "") return;
    if (!zoneCommand && !choiceList && page === "commands") return;
    e.preventDefault();
    setZoneCommand(null);
    setChoiceList(null);
    showPage("commands");
  };

  /** Runs the open time zone command on the zone picked */
  const pickZone = (zone: string) => {
    if (zoneCommand === "travel") {
      runCommand(() => travelToTimeZone(zone));
      return;
    }
    const change = {
      add: addTimeZone,
      primary: makeTimeZonePrimary,
      hide: removeTimeZone,
    }[zoneCommand ?? "add"];
    runCommand(() => changeTimeZones((zones) => change(zones, zone)));
  };

  /** The zones "Hide time zone..." and "Make time zone primary..." list */
  const listedZones = (() => {
    if (zoneCommand === "primary") return [...timeZones.secondary].reverse();
    if (zoneCommand !== "hide") return undefined;
    // The primary zone first, then the others from the closest
    const primary = timeZones.primary ?? getViewerTimeZone();
    return [primary, ...[...timeZones.secondary].reverse()];
  })();

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
        { label: "Meet with...", keys: ["F"], run: onMeetWith },
        {
          label: "Show teammate calendar...",
          keys: ["P"],
          run: onShowTeammateCalendar,
        },
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
          keepsOpen: true,
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
        {
          label: TIME_ZONE_COMMAND_LABELS.travel,
          keys: ["Z"],
          keepsOpen: true,
          run: () => openZoneCommand("travel"),
        },
        {
          label: TIME_ZONE_COMMAND_LABELS.add,
          keepsOpen: true,
          run: () => openZoneCommand("add"),
        },
        // Only with more than one zone, as in Notion Calendar
        {
          label: TIME_ZONE_COMMAND_LABELS.primary,
          keepsOpen: true,
          run: hasOtherZones ? () => openZoneCommand("primary") : undefined,
        },
        {
          label: TIME_ZONE_COMMAND_LABELS.hide,
          keepsOpen: true,
          run: hasOtherZones ? () => openZoneCommand("hide") : undefined,
        },
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
        {
          label: CHOICE_LIST_LABELS["week-start"],
          keepsOpen: true,
          run: () => openChoiceList("week-start"),
        },
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
        {
          label: CHOICE_LIST_LABELS["number-of-days"],
          keepsOpen: true,
          run: () => openChoiceList("number-of-days"),
        },
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
        // Each says what it will do, as Notion Calendar's do
        {
          label: viewSettings.showWeekends ? "Hide weekends" : "Show weekends",
          keys: ["shift", "⌘", "E"],
          run: toggleWeekends,
        },
        {
          label: viewSettings.showDeclinedEvents
            ? "Hide declined events"
            : "Show declined events",
          run: toggleDeclinedEvents,
        },
        {
          label: viewSettings.showWeekNumbers
            ? "Hide week numbers"
            : "Show week numbers",
          run: toggleWeekNumbers,
        },
      ],
    },
    {
      heading: "Settings & help",
      commands: [
        {
          label: "Show keyboard shortcuts",
          keys: ["?"],
          run: onShowShortcuts,
          movesFocus: true,
        },
        { label: "Go to settings", keys: ["⌘", ","], run: onOpenSettings },
        { label: "Support & feedback", run: onSupport },
      ],
    },
    {
      heading: "Accounts",
      commands: [
        { label: "Add calendar account", run: onAddCalendarAccount },
        { label: "Manage calendar accounts", run: onManageCalendarAccounts },
      ],
    },
    {
      heading: "CalendarCN",
      commands: [{ label: "About CalendarCN", run: onAbout }],
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
  // Go to date's page lists the typed date alone, a zone list its zones
  const shownGroups =
    page === "commands" && !zoneCommand && !choiceList ? groups : [];

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
        {/* Go to date's result and a zone list do their own filtering */}
        <Command
          className={COMMAND_CLASS}
          shouldFilter={zoneCommand === null && page === "commands"}
        >
          <CommandInput
            ref={inputRef}
            placeholder={
              zoneCommand
                ? TIME_ZONE_COMMAND_LABELS[zoneCommand]
                : choiceList
                  ? CHOICE_LIST_LABELS[choiceList]
                  : page === "go-to-date"
                    ? GO_TO_DATE_PLACEHOLDER
                    : "Type a command..."
            }
            value={query}
            onValueChange={setQuery}
            onKeyDown={handleInputKeyDown}
          />
          <CommandList>
            {zoneCommand && (
              <TimeZoneList
                query={query}
                onSelect={pickZone}
                timeZones={listedZones}
              />
            )}
            {!zoneCommand && (page === "commands" || query.trim() !== "") && (
              <CommandEmpty>No results found.</CommandEmpty>
            )}
            {choiceList === "week-start" &&
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
            {choiceList === "number-of-days" &&
              NUMBER_OF_DAYS_OPTIONS.map((count) => (
                <CommandItem
                  key={count}
                  value={String(count)}
                  onSelect={() => runCommand(() => setNumberOfDays(count))}
                >
                  {count}
                </CommandItem>
              ))}
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
            {shownGroups.length > 0 &&
              onSearchEvents &&
              query.trim() !== "" && (
                <CommandGroup heading="Search" forceMount>
                  <CommandItem
                    forceMount
                    value={`search-events-${query}`}
                    onSelect={() =>
                      runCommandAfterClose(() => onSearchEvents(query.trim()))
                    }
                  >
                    Search events for “{query.trim()}”
                  </CommandItem>
                </CommandGroup>
              )}
            {page === "go-to-date" && !zoneCommand && (
              <GoToDateResult
                query={query}
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
  const { locale, timeZone } = useCalendarConfig();
  const today = useToday(timeZone);
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
