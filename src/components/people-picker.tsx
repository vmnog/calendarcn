"use client";

import * as React from "react";

import { useCalendarPeople } from "@/components/calendar-people";
import type {
  EventContact,
  PeoplePickerMode,
} from "@/components/calendar-types";
import {
  Command,
  CommandEmpty,
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
import { Kbd } from "@/components/ui/kbd";
import {
  getPersonName,
  getTypedPerson,
  isSameEmail,
  matchesPerson,
} from "@/lib/people";

/** The picker's look, as the command menu's: translucent and blurred in dark mode */
const DIALOG_CLASS =
  "overflow-hidden p-0 dark:bg-popover/60 dark:backdrop-blur-xl dark:border-border/50 dark:[&_[data-slot=command]]:bg-transparent";

/** Taller input and rows, as the command menu has them */
const COMMAND_CLASS =
  "**:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5 [&_[cmdk-list]]:p-1";

/** Placeholder, and accessible title, of each mode */
const PICKER_TITLES: Record<PeoplePickerMode, string> = {
  "meet-with": "Meet with...",
  teammate: "Show teammate calendar...",
};

/** What the dialog's hidden description says each mode does */
const PICKER_DESCRIPTIONS: Record<PeoplePickerMode, string> = {
  "meet-with":
    "Pick someone to see their events beside yours and the times you're both free.",
  teammate: "Pick a teammate to show their calendar beside yours.",
};

interface PeoplePickerProps {
  /** Whether the picker is open */
  open: boolean;
  /** Called when it opens or closes, including after someone is picked */
  onOpenChange: (open: boolean) => void;
  /** Meet with the picked person, or show their calendar. Defaults to "meet-with" */
  mode?: PeoplePickerMode;
}

/**
 * Notion Calendar's people picker, opened by F ("Meet with...") and P
 * ("Show teammate calendar..."): a search over the provider's `contacts`
 * (or a typed address), arrows to move, Enter to pick, Escape to close.
 * Picking someone meets with them or shows their calendar, through
 * `useCalendarPeople()`, so it goes inside `CalendarProvider`.
 */
export function PeoplePicker({
  open,
  onOpenChange,
  mode = "meet-with",
}: PeoplePickerProps) {
  const { contacts, meetWith, teammates, addMeetWith, addTeammate } =
    useCalendarPeople();
  const [query, setQuery] = React.useState("");
  const trimmed = query.trim();
  const added = mode === "meet-with" ? meetWith : teammates;

  // A closed picker opens empty next time
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setQuery("");
  }

  const people = React.useMemo<EventContact[]>(() => {
    const available = contacts.filter(
      (contact) => !added.some((email) => isSameEmail(email, contact.email)),
    );
    const matches = available.filter((contact) =>
      matchesPerson(contact, trimmed),
    );
    const typed = getTypedPerson(contacts, trimmed, added);
    return typed ? [...matches, typed] : matches;
  }, [contacts, added, trimmed]);

  const pick = (email: string) => {
    onOpenChange(false);
    if (mode === "meet-with") {
      addMeetWith(email);
      return;
    }
    addTeammate(email);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        data-people-picker={mode}
        className={DIALOG_CLASS}
      >
        <DialogTitle className="sr-only">{PICKER_TITLES[mode]}</DialogTitle>
        <DialogDescription className="sr-only">
          {PICKER_DESCRIPTIONS[mode]}
        </DialogDescription>
        {/* Filtered here: cmdk's fuzzy match would also offer unrelated people */}
        <Command shouldFilter={false} className={COMMAND_CLASS}>
          <CommandInput
            placeholder={PICKER_TITLES[mode]}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No people found.</CommandEmpty>
            {people.map((contact) => (
              <CommandItem
                key={contact.email}
                value={contact.email}
                onSelect={() => pick(contact.email)}
              >
                <span className="truncate font-medium">
                  {getPersonName(contact)}
                </span>
                {contact.name && (
                  <span className="text-muted-foreground truncate">
                    {contact.email}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandList>
          <div className="text-muted-foreground flex items-center gap-4 border-t px-3 py-2 text-xs">
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
