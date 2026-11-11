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

/** One command of the menu */
interface MenuCommand {
  label: string;
  /** Shortcut keys shown on the right, e.g. ["⌘", "/"] */
  keys?: string[];
  /** Runs the command once the menu has closed. Missing when the app doesn't offer it */
  run?: () => void;
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
  const { goToToday, goToPrev, goToNext, switchView } = useCalendar();

  const runCommand = React.useCallback(
    (command: () => void) => {
      onOpenChange(false);
      command();
    },
    [onOpenChange],
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
        <Command className={COMMAND_CLASS}>
          <CommandInput placeholder="Type a command..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {groups.map((group) => {
              const commands = group.commands.filter((command) =>
                command.soon ? showComingSoon : command.run !== undefined,
              );
              if (commands.length === 0) return null;

              return (
                <CommandGroup key={group.heading} heading={group.heading}>
                  {commands.map(({ label, keys, run, soon }) => (
                    <CommandItem
                      key={label}
                      disabled={soon}
                      onSelect={run ? () => runCommand(run) : undefined}
                    >
                      {label}
                      {soon && SOON_BADGE}
                      {keys && (
                        <KbdGroup className="ml-auto">
                          {keys.map((key) => (
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
