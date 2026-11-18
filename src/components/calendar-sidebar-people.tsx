"use client";

import * as React from "react";
import { History, Rss, UserRound, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCalendarPeople } from "@/components/calendar-people";
import type { CalendarPerson, EventContact } from "@/components/calendar-types";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { getEventColorStyle } from "@/lib/event-utils";
import {
  getPersonInitial,
  getPersonName,
  getTypedPerson,
  isSameEmail,
  suggestPeople,
} from "@/lib/people";

/** A person's swatch, as the calendar list colors its calendars: their color, set with `getEventColorStyle()` */
const PERSON_SWATCH_CLASS = "bg-event";

/** A person row's name: the sidebar's small text, truncated */
const PERSON_ROW_NAME_CLASS =
  "min-w-0 flex-1 truncate text-xs text-sidebar-foreground";

/** A person row's remove button: shown on hover or keyboard focus */
const PERSON_ROW_REMOVE_CLASS =
  "text-calendar-sidebar-muted-foreground hover:bg-sidebar-accent focus-visible:ring-sidebar-ring inline-flex size-6 shrink-0 items-center justify-center rounded-sm opacity-0 outline-none group-hover/person:opacity-100 focus-visible:opacity-100 focus-visible:ring-2";

/** Header of a people section ("Meeting participants", "Team calendars") */
const PEOPLE_SECTION_LABEL_CLASS =
  "text-sidebar-foreground/70 h-7 rounded-sm px-2 text-xs";

/**
 * The sidebar's people, as in Notion Calendar: the "Meet with..." field,
 * then the people you're meeting with ("Meeting participants") and the
 * teammates whose calendars show ("Team calendars"), each removable. Reads
 * and changes them through `useCalendarPeople()`, so it goes inside
 * `CalendarProvider`.
 */
export function CalendarSidebarPeople() {
  const {
    contacts,
    meetWith,
    teammates,
    shownPeople,
    addMeetWith,
    removeMeetWith,
    clearMeetWith,
    removeTeammate,
  } = useCalendarPeople();
  const meetingPeople = shownPeople.filter((person) =>
    meetWith.some((email) => isSameEmail(email, person.email)),
  );
  const teamPeople = shownPeople.filter((person) =>
    teammates.some((email) => isSameEmail(email, person.email)),
  );

  return (
    <>
      <SidebarGroup className="px-2 py-2">
        <MeetWithField
          contacts={contacts}
          exclude={meetWith}
          onPick={addMeetWith}
        />
      </SidebarGroup>
      {meetingPeople.length > 0 && (
        <SidebarGroup className="py-0">
          <SidebarGroupLabel className={PEOPLE_SECTION_LABEL_CLASS}>
            Meeting participants
            <button
              type="button"
              className="text-calendar-sidebar-muted-foreground hover:text-sidebar-foreground focus-visible:ring-sidebar-ring ml-auto rounded-sm px-1 text-xs outline-none focus-visible:ring-2"
              onClick={clearMeetWith}
            >
              Clear
            </button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0">
              {meetingPeople.map((person) => (
                <PersonRow
                  key={person.email}
                  person={person}
                  shape="square"
                  removeLabel={`Stop meeting with ${getPersonName(person)}`}
                  onRemove={() => removeMeetWith(person.email)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
      {teamPeople.length > 0 && (
        <SidebarGroup className="py-0">
          <SidebarGroupLabel className={PEOPLE_SECTION_LABEL_CLASS}>
            Team calendars
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0">
              {teamPeople.map((person) => (
                <PersonRow
                  key={person.email}
                  person={person}
                  shape="round"
                  removeLabel={`Remove ${getPersonName(person)} from team calendars`}
                  onRemove={() => removeTeammate(person.email)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </>
  );
}

interface PersonRowProps {
  person: CalendarPerson;
  /** A square with a feed glyph (meeting participants) or a round initial (teammates) */
  shape: "square" | "round";
  /** Accessible name of the remove button */
  removeLabel: string;
  onRemove: () => void;
}

/** One person in a sidebar people section: their color, name and a remove button */
function PersonRow({ person, shape, removeLabel, onRemove }: PersonRowProps) {
  const name = getPersonName(person);
  return (
    <SidebarMenuItem
      data-person-row={person.email}
      className="group/person hover:bg-sidebar-accent flex h-7 items-center gap-2 rounded-sm pr-1 pl-2"
      title={person.name ? `${person.name} (${person.email})` : person.email}
    >
      {shape === "square" ? (
        <span
          aria-hidden
          className={cn(
            "flex size-3 shrink-0 items-center justify-center rounded-xs",
            PERSON_SWATCH_CLASS,
          )}
          style={getEventColorStyle(person.color)}
        >
          <Rss className="size-2 text-event-foreground" />
        </span>
      ) : (
        <span
          aria-hidden
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] leading-none font-semibold text-event-foreground",
            PERSON_SWATCH_CLASS,
          )}
          style={getEventColorStyle(person.color)}
        >
          {getPersonInitial(person)}
        </span>
      )}
      <span className={PERSON_ROW_NAME_CLASS}>{name}</span>
      <button
        type="button"
        aria-label={removeLabel}
        className={PERSON_ROW_REMOVE_CLASS}
        onClick={onRemove}
      >
        <X className="size-3.5" />
      </button>
    </SidebarMenuItem>
  );
}

interface MeetWithFieldProps {
  /** People it offers */
  contacts: EventContact[];
  /** Emails it leaves out: the people met with already */
  exclude: string[];
  /** Called with the picked person's email */
  onPick: (email: string) => void;
}

/**
 * Notion Calendar's "Meet with..." field: focusing it lists recent people,
 * typing lists the matches (or the typed address), arrows move through
 * them, Enter or a click picks one. Escape closes the list and clears the
 * text, without reaching the calendar's own Escape.
 */
function MeetWithField({ contacts, exclude, onPick }: MeetWithFieldProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listId = React.useId();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const trimmed = query.trim();

  const options = React.useMemo<EventContact[]>(() => {
    const matches = suggestPeople(contacts, trimmed, exclude);
    const typed = getTypedPerson(contacts, trimmed, exclude);
    return typed ? [...matches, typed] : matches;
  }, [contacts, exclude, trimmed]);

  const listOpen = open && options.length > 0;

  // While typing, the first match is active, as in Notion
  React.useEffect(() => {
    setActiveIndex(trimmed ? 0 : -1);
  }, [trimmed]);

  const pick = (contact: EventContact) => {
    onPick(contact.email);
    setQuery("");
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      // Closing the list (or clearing the text) is all Escape does here
      e.stopPropagation();
      if (listOpen || query) {
        setOpen(false);
        setQuery("");
        return;
      }
      inputRef.current?.blur();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!listOpen) {
        setOpen(true);
        return;
      }
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => {
        if (index === -1) return step === 1 ? 0 : options.length - 1;
        return (index + step + options.length) % options.length;
      });
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const option = options[activeIndex];
      if (listOpen && option) pick(option);
    }
  };

  const activeId =
    listOpen && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined;

  return (
    <div className="relative">
      <div
        // Filled with the sidebar's border color: half strength at rest, full
        // while focused. A dark theme fills it only while focused
        className="flex items-center gap-2 rounded-sm bg-sidebar-border/48 px-2 py-1.5 has-[:focus]:bg-sidebar-border dark:bg-sidebar dark:has-[:focus]:bg-sidebar-accent"
        onClick={() => inputRef.current?.focus()}
      >
        <UserRound className="text-calendar-sidebar-muted-foreground size-4 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Meet with"
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          placeholder="Meet with..."
          autoComplete="off"
          value={query}
          className="text-sidebar-foreground placeholder:text-calendar-sidebar-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setQuery("");
          }}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div
        id={listId}
        role="listbox"
        aria-label="People"
        hidden={!listOpen}
        className="bg-popover text-popover-foreground absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-md border p-1 shadow-md"
      >
        {listOpen &&
          options.map((contact, index) => (
            <div
              key={contact.email}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={cn(
                "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-xs",
                index === activeIndex && "bg-accent text-accent-foreground",
              )}
              // Keeps the focus in the field, so its blur doesn't close the list first
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => pick(contact)}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{getPersonName(contact)}</span>
                {contact.name && (
                  <span className="text-muted-foreground truncate text-[11px]">
                    {contact.email}
                  </span>
                )}
              </span>
              {!trimmed && contact.recent && (
                <History
                  aria-label="Recent"
                  className="text-muted-foreground size-3.5 shrink-0"
                />
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
