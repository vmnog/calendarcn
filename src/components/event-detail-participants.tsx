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
  EVENT_DETAIL_ICON_BUTTON_CLASS,
  EVENT_DETAIL_ICON_CLASS,
  EVENT_DETAIL_INPUT_GROUP_CLASS,
  EVENT_DETAIL_MENU_CLASS,
  EVENT_DETAIL_MENU_ITEM_CLASS,
  EVENT_DETAIL_MENU_SECONDARY_CLASS,
  EVENT_DETAIL_PLACEHOLDER_CLASS,
  EVENT_DETAIL_ROW_HEIGHT_CLASS,
  EVENT_DETAIL_SECONDARY_CLASS,
  EVENT_DETAIL_TEXT_CLASS,
  EventDetailDivider,
  EventDetailSection,
  closeMenuOnEscape,
} from "./event-detail-parts";
import {
  EVENT_DETAIL_INPUT_PLACEHOLDER_CLASS,
  EventDetailSuggestion,
  EventDetailSuggestions,
  HighlightedMatch,
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

/**
 * A typed address that can be invited without a contact: a plain local
 * part, then a domain of letters, digits and hyphens with a 2+ letter TLD
 */
const EMAIL_PATTERN =
  /^[A-Za-z0-9._%+'-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

/** Placeholder of the field before anyone is added */
const EMPTY_PLACEHOLDER = "Participants and Rooms";

/** Placeholder of the field under the list of guests */
const ADD_PLACEHOLDER = "Add participant or room";

/** A row's hover action: a 28px icon button */
const ACTION_BUTTON_CLASS = cn(
  "flex size-7 shrink-0 items-center justify-center rounded-sm",
  EVENT_DETAIL_ICON_BUTTON_CLASS,
  EVENT_DETAIL_SECONDARY_CLASS,
);

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

/** Whether two addresses are the same, ignoring case */
function isSameEmail(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** A `mailto:` link to the address, its parts percent-encoded */
function getMailtoHref(email: string): string {
  const at = email.lastIndexOf("@");
  if (at === -1) return `mailto:${encodeURIComponent(email)}`;
  const local = encodeURIComponent(email.slice(0, at));
  const domain = encodeURIComponent(email.slice(at + 1));
  return `mailto:${local}@${domain}`;
}

/** Label under a participant's name: "Organizer", "Optional" or none */
function getRoleLabel(participant: EventParticipant): string | null {
  if (participant.organizer) return ROLE_LABELS.organizer;
  if (participant.optional) return ROLE_LABELS.optional;
  return null;
}

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
 * Props for ParticipantAvatar
 */
interface ParticipantAvatarProps {
  participant: EventParticipant;
}

/**
 * A participant's avatar: their initial on a gray disc, with a badge for
 * their answer (Notion: 20px, green check when accepted)
 */
function ParticipantAvatar({ participant }: ParticipantAvatarProps) {
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
 * Props for ParticipantActions and ParticipantRow
 */
interface ParticipantRowProps {
  participant: EventParticipant;
  /** Marks them optional or required; leave out when the event is read-only */
  onToggleOptional?: () => void;
  /** Removes them; leave out when they can't be removed */
  onRemove?: () => void;
}

/**
 * Hover actions of a participant row: copy the email, and, when the event
 * can be edited, a menu to email them, mark them optional or remove them
 */
function ParticipantActions({
  participant,
  onToggleOptional,
  onRemove,
}: ParticipantRowProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const label = participant.name ?? participant.email;

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
        className={ACTION_BUTTON_CLASS}
        onClick={() => void navigator.clipboard?.writeText(participant.email)}
      >
        <Copy className="size-4" />
      </button>
      {onToggleOptional && (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`More actions for ${label}`}
              className={ACTION_BUTTON_CLASS}
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
              asChild
              className={cn(EVENT_DETAIL_MENU_ITEM_CLASS, "text-sm")}
            >
              <a href={getMailtoHref(participant.email)}>
                <Mail className="size-4" />
                Send email
              </a>
            </DropdownMenuItem>
            {!participant.organizer && (
              <>
                <DropdownMenuSeparator className="bg-[#303030]" />
                <DropdownMenuItem
                  className={cn(EVENT_DETAIL_MENU_ITEM_CLASS, "text-sm")}
                  onClick={onToggleOptional}
                >
                  <User className="size-4" />
                  {participant.optional ? "Mark required" : "Mark optional"}
                </DropdownMenuItem>
              </>
            )}
            {onRemove && (
              <DropdownMenuItem
                className="text-sm text-[#E56458] focus:!bg-[#DE5551] focus:!text-white focus:[&>svg]:!text-white"
                onClick={onRemove}
              >
                <X className="size-4 text-[#E56458]" />
                Remove
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
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
}: ParticipantRowProps) {
  const role = getRoleLabel(participant);

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
 * Props for RoomRow
 */
interface RoomRowProps {
  room: EventRoom;
  /** Removes the booking; leave out when the event is read-only */
  onRemove?: () => void;
}

/**
 * A booked room: a door on a gray square, its name, and where it is
 */
function RoomRow({ room, onRemove }: RoomRowProps) {
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
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${room.name}`}
          title="Remove"
          className={cn(
            "opacity-0 group-hover/participant:opacity-100 focus-visible:opacity-100",
            ACTION_BUTTON_CLASS,
          )}
          onClick={onRemove}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Guests and meeting rooms, as in Notion Calendar: a "Participants and
 * Rooms" field until someone is added, then one row per guest (avatar with
 * their answer, "Organizer" / "Optional", hover actions) and per room, and
 * an "Add participant or room" field. Focusing the field lists recent
 * contacts; typing lists matching contacts and rooms (or the typed email).
 * The calendar's account (`calendarEmail`) joins as the organizer, who
 * stays while anyone else is invited. Escape closes the list and adds
 * nobody. Contacts and rooms come from `CalendarProvider`'s `contacts` and
 * `rooms`; without `onEventChange`, the guests are only listed.
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
  const canEdit = Boolean(onEventChange);
  const owner = event.calendarEmail;

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
    const q = trimmed.toLowerCase();
    const invited = new Set(participants.map((p) => p.email.toLowerCase()));
    const booked = new Set(rooms.map((r) => r.id.toLowerCase()));
    /** Room addresses, never invited as people */
    const roomIds = new Set([
      ...booked,
      ...availableRooms.map((r) => r.id.toLowerCase()),
    ]);
    const freeRooms = availableRooms.filter(
      (r) => !booked.has(r.id.toLowerCase()),
    );
    const matchesRoom = (room: EventRoom) =>
      room.name.toLowerCase().includes(q) || room.id.toLowerCase() === q;

    if (showRooms) {
      return freeRooms
        .filter((r) => !q || matchesRoom(r))
        .map((room) => ({ kind: "room", room }));
    }

    const uninvited = contacts.filter(
      (c) =>
        !invited.has(c.email.toLowerCase()) &&
        !roomIds.has(c.email.toLowerCase()),
    );
    if (!q) {
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
      !invited.has(q) &&
      !roomIds.has(q) &&
      !matches.some(
        (o) => o.kind === "contact" && isSameEmail(o.contact.email, trimmed),
      );
    if (isNewEmail) {
      matches.push({ kind: "contact", contact: { email: trimmed } });
    }
    for (const room of freeRooms) {
      if (matchesRoom(room)) matches.push({ kind: "room", room });
    }
    return matches;
  }, [contacts, availableRooms, participants, rooms, showRooms, trimmed]);

  const hasRoomsList = availableRooms.length > 0;
  /** "View rooms and resources" (or back), the list's last option */
  const hasFooter = !trimmed && hasRoomsList;
  const optionCount = options.length + (hasFooter ? 1 : 0);
  const listOpen = canEdit && open && optionCount > 0;

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
      if (participants.length > 0 || !owner) return next;
      if (next.some((p) => isSameEmail(p.email, owner))) return next;
      return [{ email: owner, organizer: true, response: "accepted" }, ...next];
    },
    [owner, participants.length],
  );

  const pick = React.useCallback(
    (option: ParticipantOption) => {
      if (option.kind === "room") {
        onEventChange?.({ ...event, rooms: [...rooms, option.room] });
      } else {
        const { email, name } = option.contact;
        // Your own address has accepted, and organizes unless someone else does
        const guest: EventParticipant =
          owner && isSameEmail(email, owner)
            ? {
                email,
                name,
                organizer: !participants.some((p) => p.organizer),
                response: "accepted",
              }
            : { email, name, response: "needs-action" };
        onEventChange?.({
          ...event,
          participants: withOrganizer([...participants, guest]),
        });
      }
      setQuery("");
      setShowRooms(false);
    },
    [event, onEventChange, owner, participants, rooms, withOrganizer],
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

  /** Picks an option by index, the footer's after the others */
  const pickAt = (index: number) => {
    if (index < options.length) {
      pick(options[index]);
      return;
    }
    setShowRooms((value) => !value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      // Close the list, as it was before typing, and keep the event
      // selected (Notion's Escape adds the highlighted contact; this never
      // invites anyone)
      e.preventDefault();
      e.stopPropagation();
      closeList();
      inputRef.current?.blur();
      return;
    }
    if (!listOpen) {
      if (e.key === "ArrowDown" && canEdit) setOpen(true);
      return;
    }
    handleSuggestionKey(e, optionCount, activeIndex, setActiveIndex, pickAt);
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
          readOnly={!canEdit}
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
            EVENT_DETAIL_INPUT_PLACEHOLDER_CLASS,
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
          onToggleOptional={
            canEdit ? () => toggleOptional(participant.email) : undefined
          }
          // The organizer stays while anyone else is invited
          onRemove={
            canEdit && (!participant.organizer || participants.length === 1)
              ? () => removeParticipant(participant.email)
              : undefined
          }
        />
      ))}
      {rooms.map((room) => (
        <RoomRow
          key={room.id}
          room={room}
          onRemove={canEdit ? () => removeRoom(room.id) : undefined}
        />
      ))}
      {canEdit || !hasPeople ? field : null}
      {listOpen && (
        <EventDetailSuggestions
          id={listId}
          label={showRooms ? "Rooms and resources" : "Suggested participants"}
          anchorRef={boxRef}
          width={SUGGESTIONS_WIDTH}
          footer={
            hasFooter ? (
              <EventDetailSuggestion
                id={optionId(options.length)}
                active={activeIndex === options.length}
                onActivate={() => setActiveIndex(options.length)}
                onSelect={() => pickAt(options.length)}
                className="justify-between"
              >
                <RoomsToggleContent showRooms={showRooms} />
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
 * Props for RoomsToggleContent
 */
interface RoomsToggleContentProps {
  /** Whether the list shows the rooms, which turns it into "Back to people" */
  showRooms: boolean;
}

/** The footer option: "View rooms and resources", or back to people */
function RoomsToggleContent({ showRooms }: RoomsToggleContentProps) {
  const iconClass = cn("size-4", EVENT_DETAIL_MENU_SECONDARY_CLASS);
  if (showRooms) {
    return (
      <span className="flex items-center gap-2">
        <ArrowLeft className={iconClass} />
        Back to people
      </span>
    );
  }
  return (
    <>
      View rooms and resources
      <ArrowRight className={iconClass} />
    </>
  );
}

/**
 * Props for ParticipantOptionContent
 */
interface ParticipantOptionContentProps {
  option: ParticipantOption;
  /** What was typed, bright in the matches */
  query: string;
}

/**
 * What an option shows: a contact's name over their email (or the email
 * alone) with a history icon when recent; a room's name over where it is
 */
function ParticipantOptionContent({
  option,
  query,
}: ParticipantOptionContentProps) {
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
