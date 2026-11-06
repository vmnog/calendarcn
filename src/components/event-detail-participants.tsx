"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  DoorOpen,
  History,
  Mail,
  MoreHorizontal,
  User,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCalendarConfig } from "./calendar-provider";
import {
  EVENT_DETAIL_GROUPED_INPUT_CLASS,
  EVENT_DETAIL_ICON_CLASS,
  EVENT_DETAIL_INPUT_GROUP_CLASS,
  EVENT_DETAIL_MENU_CLASS,
  EVENT_DETAIL_MENU_ITEM_CLASS,
  EVENT_DETAIL_PLACEHOLDER_CLASS,
  EVENT_DETAIL_ROW_HEIGHT_CLASS,
  EVENT_DETAIL_SECONDARY_CLASS,
  EVENT_DETAIL_TEXT_CLASS,
  EventDetailDivider,
  EventDetailSection,
} from "./event-detail-parts";
import {
  EVENT_DETAIL_MENU_SECONDARY_CLASS,
  EventDetailSuggestion,
  EventDetailSuggestions,
  HighlightedMatch,
  closeMenuOnEscape,
  handleSuggestionKey,
} from "./event-detail-suggestions";
import type {
  DetailedCalendarEvent,
  EventContact,
  EventDetailSectionProps,
  EventParticipant,
  EventRoom,
  ParticipantResponse,
} from "./week-view-types";

/** Width of the suggestions list (Notion: 330px) */
const SUGGESTIONS_WIDTH = 330;

/** Most contacts listed while typing */
const MAX_SUGGESTIONS = 6;

/** A typed address that can be invited without a contact */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Placeholder of the field: before anyone is added, then under the list */
const EMPTY_PLACEHOLDER = "Participants and Rooms";
const ADD_PLACEHOLDER = "Add participant or room";

/** Label under a participant's name, by role */
const ROLE_LABELS = {
  organizer: "Organizer",
  optional: "Optional",
} as const;

/** Badge on the avatar for each answer; "needs-action" shows none */
const RESPONSE_BADGES: Record<
  Exclude<ParticipantResponse, "needs-action">,
  { className: string; label: string; icon: React.ReactNode }
> = {
  accepted: {
    className: "bg-[#4AC881]",
    label: "Accepted",
    icon: <Check className="size-[7px]" strokeWidth={4} />,
  },
  declined: {
    className: "bg-[#E56458]",
    label: "Declined",
    icon: <X className="size-[7px]" strokeWidth={4} />,
  },
  tentative: {
    className: "bg-[#9B9A97]",
    label: "Maybe",
    icon: <span className="text-[7px] leading-none font-bold">?</span>,
  },
};

/** One option of the suggestions list */
type ParticipantOption =
  | { kind: "contact"; contact: EventContact }
  | { kind: "room"; room: EventRoom };

/** First letter of a name or email, for the avatar */
function getInitial(participant: { name?: string; email: string }): string {
  return (participant.name ?? participant.email).trim().charAt(0).toUpperCase();
}

/** Whether the text matches a contact's name or email */
function matchesContact(contact: EventContact, query: string): boolean {
  const q = query.toLowerCase();
  return (
    contact.email.toLowerCase().includes(q) ||
    (contact.name?.toLowerCase().includes(q) ?? false)
  );
}

/** Second line of a room: where it is and how many it seats */
function describeRoom(room: EventRoom): string | undefined {
  const parts = [
    room.location,
    room.capacity ? `${room.capacity} seats` : undefined,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/**
 * A participant's avatar: their initial on a gray disc, with a badge for
 * their answer (Notion: 20px, green check when accepted)
 */
function ParticipantAvatar({ participant }: { participant: EventParticipant }) {
  const response = participant.response ?? "needs-action";
  const badge = response === "needs-action" ? null : RESPONSE_BADGES[response];

  return (
    <span className="relative flex size-5 shrink-0">
      <Avatar className="size-5">
        <AvatarFallback className="bg-gradient-to-b from-[#C7C7C7] to-[#B1B1B1] text-[10px] font-semibold text-white">
          {getInitial(participant)}
        </AvatarFallback>
      </Avatar>
      {badge && (
        <span
          role="img"
          aria-label={badge.label}
          className={cn(
            "absolute -right-[3px] -bottom-[3px] flex size-[11px] items-center justify-center rounded-full text-white ring-[1.5px] ring-white dark:ring-[#191919]",
            badge.className,
          )}
        >
          {badge.icon}
        </span>
      )}
    </span>
  );
}

/**
 * Hover actions of a participant row: copy the email, and a menu to email
 * them, mark them optional or remove them
 */
function ParticipantActions({
  participant,
  onToggleOptional,
  onRemove,
}: {
  participant: EventParticipant;
  onToggleOptional: () => void;
  onRemove: () => void;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const label = participant.name ?? participant.email;
  const buttonClass = cn(
    "flex size-7 items-center justify-center rounded-sm hover:bg-[#F5F5F5] dark:hover:bg-[#242424]",
    EVENT_DETAIL_SECONDARY_CLASS,
  );

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-0.5 opacity-0 group-hover/participant:opacity-100 focus-within:opacity-100",
        menuOpen && "opacity-100",
      )}
    >
      <button
        type="button"
        aria-label={`Copy ${participant.email}`}
        title="Copy email"
        className={buttonClass}
        onClick={() => void navigator.clipboard?.writeText(participant.email)}
      >
        <Copy className="size-4" />
      </button>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`More actions for ${label}`}
            className={buttonClass}
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="left"
          className={cn("min-w-[180px] text-sm", EVENT_DETAIL_MENU_CLASS)}
          onKeyDown={closeMenuOnEscape(() => setMenuOpen(false))}
        >
          <DropdownMenuItem
            className={cn(EVENT_DETAIL_MENU_ITEM_CLASS, "text-sm")}
            onClick={() => window.open(`mailto:${participant.email}`)}
          >
            <Mail className="size-4" />
            Send email
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[#303030]" />
          {!participant.organizer && (
            <DropdownMenuItem
              className={cn(EVENT_DETAIL_MENU_ITEM_CLASS, "text-sm")}
              onClick={onToggleOptional}
            >
              <User className="size-4" />
              {participant.optional ? "Mark required" : "Mark optional"}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-sm text-[#E56458] focus:!bg-[#DE5551] focus:!text-white focus:[&>svg]:!text-white"
            onClick={onRemove}
          >
            <X className="size-4 text-[#E56458]" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * A guest: avatar with their answer, name (or email), "Organizer" or
 * "Optional" under it, and actions on hover
 */
function ParticipantRow({
  participant,
  onToggleOptional,
  onRemove,
}: {
  participant: EventParticipant;
  onToggleOptional: () => void;
  onRemove: () => void;
}) {
  const role = participant.organizer
    ? ROLE_LABELS.organizer
    : participant.optional
      ? ROLE_LABELS.optional
      : null;

  return (
    <div
      data-participant={participant.email}
      className={cn(
        "group/participant flex items-center gap-[9px] pr-2 pl-4",
        role ? "min-h-[51px] py-1.5" : EVENT_DETAIL_ROW_HEIGHT_CLASS,
      )}
    >
      <span className="flex w-5 shrink-0 items-center justify-center">
        <ParticipantAvatar participant={participant} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col leading-5">
        <span
          className={cn("truncate", EVENT_DETAIL_TEXT_CLASS)}
          title={participant.email}
        >
          {participant.name ?? participant.email}
        </span>
        {role && <span className={EVENT_DETAIL_PLACEHOLDER_CLASS}>{role}</span>}
      </div>
      <ParticipantActions
        participant={participant}
        onToggleOptional={onToggleOptional}
        onRemove={onRemove}
      />
    </div>
  );
}

/**
 * A booked room: a door on a gray square, its name, and where it is
 */
function RoomRow({
  room,
  onRemove,
}: {
  room: EventRoom;
  onRemove: () => void;
}) {
  const description = describeRoom(room);

  return (
    <div
      data-room={room.id}
      className={cn(
        "group/participant flex items-center gap-[9px] pr-2 pl-4",
        description ? "min-h-[51px] py-1.5" : EVENT_DETAIL_ROW_HEIGHT_CLASS,
      )}
    >
      <span className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-gradient-to-b from-[#C7C7C7] to-[#B1B1B1] text-white">
        <DoorOpen className="size-3" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col leading-5">
        <span className={cn("truncate", EVENT_DETAIL_TEXT_CLASS)}>
          {room.name}
        </span>
        {description && (
          <span className={cn("truncate", EVENT_DETAIL_PLACEHOLDER_CLASS)}>
            {description}
          </span>
        )}
      </div>
      <button
        type="button"
        aria-label={`Remove ${room.name}`}
        title="Remove"
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-sm opacity-0 group-hover/participant:opacity-100 focus-visible:opacity-100 hover:bg-[#F5F5F5] dark:hover:bg-[#242424]",
          EVENT_DETAIL_SECONDARY_CLASS,
        )}
        onClick={onRemove}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

/**
 * Guests and meeting rooms, as in Notion Calendar: a "Participants and
 * Rooms" field until someone is added, then one row per guest (avatar with
 * their answer, "Organizer" / "Optional", hover actions) and per room, and
 * an "Add participant or room" field. Focusing the field lists recent
 * contacts; typing lists matching contacts and rooms (or the typed email).
 * Contacts and rooms come from `CalendarProvider`'s `contacts` and `rooms`.
 */
export function EventDetailParticipants<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event, onEventChange }: EventDetailSectionProps<TEvent>) {
  const { contacts, rooms: availableRooms } = useCalendarConfig();
  const participants = React.useMemo(
    () => event.participants ?? [],
    [event.participants],
  );
  const rooms = React.useMemo(() => event.rooms ?? [], [event.rooms]);
  const hasPeople = participants.length > 0 || rooms.length > 0;

  const inputRef = React.useRef<HTMLInputElement>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  /** Whether the list shows the rooms instead of people */
  const [showRooms, setShowRooms] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const trimmed = query.trim();

  const options = React.useMemo<ParticipantOption[]>(() => {
    const invited = new Set(participants.map((p) => p.email.toLowerCase()));
    const booked = new Set(rooms.map((r) => r.id));
    const freeRooms = availableRooms.filter((r) => !booked.has(r.id));

    if (showRooms) {
      return freeRooms
        .filter(
          (r) =>
            !trimmed || r.name.toLowerCase().includes(trimmed.toLowerCase()),
        )
        .map((room) => ({ kind: "room", room }));
    }

    const uninvited = contacts.filter(
      (c) => !invited.has(c.email.toLowerCase()),
    );
    if (!trimmed) {
      return uninvited
        .filter((c) => c.recent)
        .slice(0, MAX_SUGGESTIONS)
        .map((contact) => ({ kind: "contact", contact }));
    }

    const matches: ParticipantOption[] = uninvited
      .filter((c) => matchesContact(c, trimmed))
      .slice(0, MAX_SUGGESTIONS)
      .map((contact) => ({ kind: "contact", contact }));
    const isNewEmail =
      EMAIL_PATTERN.test(trimmed) &&
      !invited.has(trimmed.toLowerCase()) &&
      !matches.some(
        (o) =>
          o.kind === "contact" &&
          o.contact.email.toLowerCase() === trimmed.toLowerCase(),
      );
    if (isNewEmail) {
      matches.push({ kind: "contact", contact: { email: trimmed } });
    }
    for (const room of freeRooms) {
      if (room.name.toLowerCase().includes(trimmed.toLowerCase())) {
        matches.push({ kind: "room", room });
      }
    }
    return matches;
  }, [contacts, availableRooms, participants, rooms, showRooms, trimmed]);

  const hasRoomsList = availableRooms.length > 0;
  const listOpen = open && (options.length > 0 || (!trimmed && hasRoomsList));

  // While typing, the first match is active, as in Notion
  React.useEffect(() => {
    setActiveIndex(trimmed ? 0 : -1);
  }, [trimmed, showRooms]);

  const closeList = React.useCallback(() => {
    setOpen(false);
    setShowRooms(false);
    setQuery("");
  }, []);

  /** The calendar's account joins as organizer with the first guest */
  const withOrganizer = React.useCallback(
    (next: EventParticipant[]): EventParticipant[] => {
      const owner = event.calendarEmail;
      if (participants.length > 0 || !owner) return next;
      if (next.some((p) => p.email.toLowerCase() === owner.toLowerCase())) {
        return next;
      }
      return [{ email: owner, organizer: true, response: "accepted" }, ...next];
    },
    [event.calendarEmail, participants.length],
  );

  const pick = React.useCallback(
    (option: ParticipantOption) => {
      if (option.kind === "room") {
        onEventChange?.({ ...event, rooms: [...rooms, option.room] });
      } else {
        const { email, name } = option.contact;
        onEventChange?.({
          ...event,
          participants: withOrganizer([
            ...participants,
            { email, name, response: "needs-action" },
          ]),
        });
      }
      setQuery("");
      setShowRooms(false);
    },
    [event, onEventChange, participants, rooms, withOrganizer],
  );

  const removeParticipant = (email: string) => {
    const rest = participants.filter((p) => p.email !== email);
    // Only the organizer left: nobody is invited anymore
    const next = rest.every((p) => p.organizer) ? [] : rest;
    onEventChange?.({
      ...event,
      participants: next.length > 0 ? next : undefined,
    });
  };

  const toggleOptional = (email: string) => {
    onEventChange?.({
      ...event,
      participants: participants.map((p) =>
        p.email === email ? { ...p, optional: !p.optional } : p,
      ),
    });
  };

  const removeRoom = (id: string) => {
    const next = rooms.filter((r) => r.id !== id);
    onEventChange?.({ ...event, rooms: next.length > 0 ? next : undefined });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      // Close the list and keep the event selected (Notion's Escape would
      // add the highlighted contact; closing is the safer reading)
      e.preventDefault();
      e.stopPropagation();
      closeList();
      inputRef.current?.blur();
      return;
    }
    if (!listOpen) {
      if (e.key === "ArrowDown") setOpen(true);
      return;
    }
    handleSuggestionKey(e, options.length, activeIndex, setActiveIndex, (i) =>
      pick(options[i]),
    );
  };

  const optionId = (index: number) => `${listId}-option-${index}`;

  const field = (
    <div
      className={cn(
        "flex min-h-[35px] items-center",
        hasPeople ? "pr-2 pl-[36px]" : "px-2",
      )}
    >
      <div
        ref={boxRef}
        className={cn(
          "flex h-8 min-w-0 flex-1 items-center gap-[11px] pr-2",
          hasPeople ? "pl-[8px]" : "pl-[9px]",
          EVENT_DETAIL_INPUT_GROUP_CLASS,
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {!hasPeople && <User className={EVENT_DETAIL_ICON_CLASS} />}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={hasPeople ? ADD_PLACEHOLDER : EMPTY_PLACEHOLDER}
          aria-autocomplete="list"
          aria-expanded={listOpen}
          aria-controls={listOpen ? listId : undefined}
          aria-activedescendant={
            listOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined
          }
          data-testid="event-participants-input"
          value={query}
          placeholder={hasPeople ? ADD_PLACEHOLDER : EMPTY_PLACEHOLDER}
          readOnly={!onEventChange}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={closeList}
          onKeyDown={handleKeyDown}
          className={cn(
            "min-w-0 flex-1",
            EVENT_DETAIL_GROUPED_INPUT_CLASS,
            EVENT_DETAIL_TEXT_CLASS,
            "placeholder:text-[#ABABA9] dark:placeholder:text-[#595959]",
          )}
        />
      </div>
    </div>
  );

  return (
    <EventDetailSection name="participants">
      {participants.map((participant) => (
        <ParticipantRow
          key={participant.email}
          participant={participant}
          onToggleOptional={() => toggleOptional(participant.email)}
          onRemove={() => removeParticipant(participant.email)}
        />
      ))}
      {rooms.map((room) => (
        <RoomRow
          key={room.id}
          room={room}
          onRemove={() => removeRoom(room.id)}
        />
      ))}
      {onEventChange || !hasPeople ? field : null}
      {listOpen && (
        <EventDetailSuggestions
          id={listId}
          label={showRooms ? "Rooms and resources" : "Suggested participants"}
          anchorRef={boxRef}
          width={SUGGESTIONS_WIDTH}
          footer={
            !trimmed && hasRoomsList ? (
              <EventDetailSuggestion
                id={`${listId}-rooms`}
                active={false}
                onActivate={() => setActiveIndex(-1)}
                onSelect={() => setShowRooms((value) => !value)}
                className="justify-between"
              >
                {showRooms ? (
                  <>
                    <span className="flex items-center gap-2">
                      <ArrowLeft
                        className={cn(
                          "size-4",
                          EVENT_DETAIL_MENU_SECONDARY_CLASS,
                        )}
                      />
                      Back to people
                    </span>
                  </>
                ) : (
                  <>
                    View rooms and resources
                    <ArrowRight
                      className={cn(
                        "size-4",
                        EVENT_DETAIL_MENU_SECONDARY_CLASS,
                      )}
                    />
                  </>
                )}
              </EventDetailSuggestion>
            ) : undefined
          }
        >
          {options.map((option, index) => (
            <EventDetailSuggestion
              key={
                option.kind === "room"
                  ? `room-${option.room.id}`
                  : option.contact.email
              }
              id={optionId(index)}
              active={index === activeIndex}
              onActivate={() => setActiveIndex(index)}
              onSelect={() => pick(option)}
            >
              <ParticipantOptionContent option={option} query={trimmed} />
            </EventDetailSuggestion>
          ))}
        </EventDetailSuggestions>
      )}
      {hasPeople && <EventDetailDivider className="my-2" />}
    </EventDetailSection>
  );
}

/**
 * What an option shows: a contact's name over their email (or the email
 * alone) with a history icon when recent; a room's name over where it is
 */
function ParticipantOptionContent({
  option,
  query,
}: {
  option: ParticipantOption;
  query: string;
}) {
  if (option.kind === "room") {
    const description = describeRoom(option.room);
    return (
      <>
        <DoorOpen
          className={cn("size-4 shrink-0", EVENT_DETAIL_MENU_SECONDARY_CLASS)}
        />
        <span className="flex min-w-0 flex-1 flex-col leading-5">
          <span className="truncate">
            <HighlightedMatch text={option.room.name} query={query} />
          </span>
          {description && (
            <span className={cn("truncate", EVENT_DETAIL_MENU_SECONDARY_CLASS)}>
              {description}
            </span>
          )}
        </span>
      </>
    );
  }

  const { contact } = option;
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col leading-5">
        <span className="truncate">
          <HighlightedMatch
            text={contact.name ?? contact.email}
            query={query}
          />
        </span>
        {contact.name && (
          <span className={cn("truncate", EVENT_DETAIL_MENU_SECONDARY_CLASS)}>
            <HighlightedMatch text={contact.email} query={query} />
          </span>
        )}
      </span>
      {contact.recent && (
        <History
          aria-label="Recent"
          className={cn("size-4 shrink-0", EVENT_DETAIL_MENU_SECONDARY_CLASS)}
        />
      )}
    </>
  );
}
