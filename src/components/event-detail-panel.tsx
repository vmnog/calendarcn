"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";
import {
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  MoreHorizontal,
  SquareDashed,
  TabletSmartphone,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useInlineEdit } from "@/hooks/use-inline-edit";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCalendarConfig } from "./calendar-provider";
import { EventDetailAiNotes } from "./event-detail-ai-notes";
import { EventDetailAvailability } from "./event-detail-availability";
import { EventDetailCalendar } from "./event-detail-calendar";
import { EventDetailConferencing } from "./event-detail-conferencing";
import { EventDetailDescription } from "./event-detail-description";
import { EventDetailLinks } from "./event-detail-links";
import { EventDetailLocation } from "./event-detail-location";
import {
  EVENT_ACTION_KEYS,
  EVENT_DETAIL_HOVER_BORDER_CLASS,
  EVENT_DETAIL_ICON_BUTTON_CLASS,
  EVENT_DETAIL_INPUT_CLASS,
  EVENT_DETAIL_MENU_CLASS,
  EVENT_DETAIL_MENU_DANGER_CLASS,
  EVENT_DETAIL_MENU_ITEM_CLASS,
  EVENT_DETAIL_MENU_SHORTCUT_CLASS,
  EVENT_DETAIL_MUTED_CLASS,
  EVENT_DETAIL_PLACEHOLDER_CLASS,
  EVENT_DETAIL_ROW_HEIGHT_CLASS,
  EVENT_DETAIL_SECONDARY_CLASS,
  EVENT_DETAIL_TEXT_CLASS,
  EventDetailDivider,
  EventDetailGroup,
  closeMenuOnEscape,
  stopEscapePropagation,
} from "./event-detail-parts";
import { EventDetailParticipants } from "./event-detail-participants";
import { EventDetailRecurrence } from "./event-detail-recurrence";
import { EventDetailReminders } from "./event-detail-reminders";
import { EventDetailAllDay, EventDetailTime } from "./event-detail-time";
import { EventDetailTimezone } from "./event-detail-timezone";
import {
  fromDisplayEvent,
  fromZonedWallClock,
  getEventTimeZone,
  getViewerTimeZone,
  toZonedWallClock,
} from "@/lib/time-zones";
import type {
  DetailedCalendarEvent,
  EventDetailClock,
  EventKind,
} from "./week-view-types";

/**
 * Props for EventDetailPanel. `TEvent` is the app's event type; detail fields
 * it doesn't set show placeholders, and edits keep its other fields.
 */
interface EventDetailPanelProps<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
> {
  event: TEvent;
  onEventChange?: (event: TEvent) => void;
  /**
   * Shows the previous event of a repeating series (the repeat row's left
   * arrow). Leave it out at the series' start: the arrow is disabled then.
   */
  onPrevWeek?: () => void;
  /**
   * Shows the next event of a repeating series (the right arrow). Leave it
   * out at the series' end: the arrow is disabled then.
   */
  onNextWeek?: () => void;
  /** The "..." menu's Cut: keeps a copy for pasting and deletes the event. Disabled without it */
  onCut?: () => void;
  /** The "..." menu's Copy: keeps a copy of the event for pasting. Disabled without it */
  onCopy?: () => void;
  /** The "..." menu's Duplicate: adds a copy at the same time. Disabled without it */
  onDuplicate?: () => void;
  /** The "..." menu's Delete. Disabled without it */
  onDelete?: () => void;
  /** Extra action buttons rendered in the header row (after the "..." menu). */
  headerActions?: React.ReactNode;
  /**
   * Set while `event` is a draft that isn't stored yet. Called with every
   * keystroke in the title, to preview it without saving; `onEventChange`
   * then saves the draft: on Enter in the title, when focus leaves a title
   * that changed, or on any other field's first edit. Escape restores the
   * title and saves nothing. The "..." menu is hidden: there is nothing
   * stored to cut, copy or delete.
   */
  onTitlePreview?: (event: TEvent) => void;
  /** When true, focuses and selects the title input once (e.g. for a just-created event). */
  autoFocusTitle?: boolean;
  /** Called after the title input was auto-focused, so the request is not repeated. */
  onTitleAutoFocused?: () => void;
}

/** Event kinds in the header menu's order */
const EVENT_KINDS: EventKind[] = [
  "event",
  "focus-time",
  "out-of-office",
  "birthday",
];

/** Name of each event kind in the header menu */
const EVENT_KIND_LABELS: Record<EventKind, string> = {
  event: "Event",
  "focus-time": "Focus time",
  "out-of-office": "Out of office",
  birthday: "Birthday",
};

/** Help shown beside a kind in the header menu */
const EVENT_KIND_TOOLTIPS: Partial<Record<EventKind, string>> = {
  "focus-time":
    "Create a focus time event with the option to automatically decline meetings during this time. Available for work and school accounts.",
  "out-of-office":
    "Create an out of office (OOO) event with the option to automatically decline meetings during this time. Available for work and school accounts.",
  birthday:
    "Create a birthday event to keep track of a person's upcoming birthdays. Birthdays from your Google Contacts may appear on a separate Birthday calendar.",
};

function EventKindHelpIcon({ tooltip }: { tooltip?: string }) {
  const [tooltipPos, setTooltipPos] = React.useState<{
    top: number;
    left: number;
  } | null>(null);

  if (!tooltip) {
    return null;
  }

  function handleMouseEnter(e: React.MouseEvent<HTMLSpanElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ top: rect.top + rect.height / 2, left: rect.left });
  }

  function handleMouseLeave() {
    setTooltipPos(null);
  }

  return (
    <span
      className="ml-auto shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <CircleHelp className="size-3.5 text-calendar-menu-accent-foreground" />
      {tooltipPos &&
        ReactDOM.createPortal(
          <div
            className="pointer-events-none fixed z-[100] max-w-[240px] rounded-sm bg-calendar-menu border border-calendar-menu-border px-2 py-1 text-xs text-calendar-menu-foreground shadow-md"
            style={{
              top: tooltipPos.top,
              left: tooltipPos.left - 8,
              transform: "translate(-100%, -50%)",
            }}
          >
            {tooltip}
          </div>,
          document.body,
        )}
    </span>
  );
}

/**
 * The muted "All-day  Time zone  Repeat" line a plain timed event shows
 * under its date. Clicking it opens the three rows.
 */
/**
 * The event on its own zone's clock, from the calendar's: what the times
 * show after "Switch to event's time zone to edit"
 */
function toOwnClock<TEvent extends DetailedCalendarEvent>(
  event: TEvent,
  calendarTimeZone: string,
  ownTimeZone: string,
): TEvent {
  const instants = fromDisplayEvent(event, calendarTimeZone);
  return {
    ...event,
    start: toZonedWallClock(instants.start, ownTimeZone),
    end: toZonedWallClock(instants.end, ownTimeZone),
  };
}

/**
 * An edit made on the event's own clock, back on the calendar's. A time it
 * left as shown keeps the calendar's date; all-day dates stay as they are.
 */
function fromOwnClock<TEvent extends DetailedCalendarEvent>(
  edited: TEvent,
  shown: TEvent,
  event: TEvent,
  calendarTimeZone: string,
  ownTimeZone: string,
): TEvent {
  if (edited.isAllDay) return edited;
  const back = (field: "start" | "end") =>
    edited[field].getTime() === shown[field].getTime()
      ? event[field]
      : toZonedWallClock(
          fromZonedWallClock(edited[field], ownTimeZone),
          calendarTimeZone,
        );
  return { ...edited, start: back("start"), end: back("end") };
}

/** An item of the kind menu (Event, Focus time…) */
const KIND_MENU_ITEM_CLASS =
  "group/item text-xs text-calendar-menu-foreground focus:bg-calendar-menu-accent focus:text-calendar-menu-accent-foreground";

function EventDetailOptionsRow({ onExpand }: { onExpand: () => void }) {
  const labelClass = cn(
    EVENT_DETAIL_PLACEHOLDER_CLASS,
    "group-hover/options:text-calendar-detail-secondary/65",
  );

  return (
    <div
      className={cn(
        "flex items-center pl-[36px]",
        EVENT_DETAIL_ROW_HEIGHT_CLASS,
      )}
    >
      <div
        className="group/options flex h-[31px] cursor-default items-center gap-[18px] rounded-md px-[9px] hover:bg-calendar-detail-focus"
        onClick={onExpand}
      >
        <span className={labelClass}>All-day</span>
        <span className={labelClass}>Time zone</span>
        <span className={labelClass}>Repeat</span>
      </div>
    </div>
  );
}

/**
 * Notion Calendar-style event details: the kind menu, the title, then one
 * section per field (time, time zone, repeat, participants, conferencing,
 * AI notes, location, links, description, calendar, availability,
 * reminders) in Notion's order and groups. Each section edits its own
 * fields through `onEventChange`.
 */
export function EventDetailPanel<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({
  event,
  onEventChange,
  onPrevWeek,
  onNextWeek,
  onCut,
  onCopy,
  onDuplicate,
  onDelete,
  headerActions,
  onTitlePreview,
  autoFocusTitle,
  onTitleAutoFocused,
}: EventDetailPanelProps<TEvent>) {
  const kind = event.kind ?? "event";
  const [kindMenuOpen, setKindMenuOpen] = React.useState(false);
  const [hoveredOther, setHoveredOther] = React.useState(false);
  /** Whether the compact "All-day / Time zone / Repeat" row is expanded into individual rows. */
  const [optionsExpanded, setOptionsExpanded] = React.useState(false);
  /** Whether the times show the event's own zone instead of the calendar's */
  const [showsOwnClock, setShowsOwnClock] = React.useState(false);
  const { timeZone: calendarTimeZone } = useCalendarConfig();
  // The calendar draws in another zone than the event's (its `timeZone`, or
  // travelling): the times read on the calendar's clock, and the time zone
  // row switches them to the event's own, as Notion Calendar's details do
  const ownTimeZone =
    calendarTimeZone && !event.isAllDay
      ? (getEventTimeZone(event) ?? getViewerTimeZone())
      : undefined;
  const clock: EventDetailClock | undefined =
    calendarTimeZone && ownTimeZone && ownTimeZone !== calendarTimeZone
      ? {
          showing: showsOwnClock ? "event" : "calendar",
          calendarTimeZone,
          onSwitch: () => setShowsOwnClock((prev) => !prev),
        }
      : undefined;
  const isOnOwnClock = clock?.showing === "event";
  /** The event the time rows show: on its own clock after the switch */
  const clockEvent = React.useMemo(
    () =>
      isOnOwnClock && calendarTimeZone && ownTimeZone
        ? toOwnClock(event, calendarTimeZone, ownTimeZone)
        : event,
    [isOnOwnClock, event, calendarTimeZone, ownTimeZone],
  );
  const handleClockEventChange =
    isOnOwnClock && calendarTimeZone && ownTimeZone && onEventChange
      ? (edited: TEvent) =>
          onEventChange(
            fromOwnClock(
              edited,
              clockEvent,
              event,
              calendarTimeZone,
              ownTimeZone,
            ),
          )
      : onEventChange;

  const titleRef = React.useRef<HTMLInputElement>(null);
  /** Shows a title as it is typed: on the draft, or on the stored event */
  const previewTitle = onTitlePreview ?? onEventChange;
  const title = useInlineEdit({
    inputRef: titleRef,
    value: event.title,
    onInput: (text) => previewTitle?.({ ...event, title: text }),
    onRestore: (text) => previewTitle?.({ ...event, title: text }),
    onCommit: (text, { textOnFocus, isEnter }) => {
      const trimmed = text.trim();
      // Only spaces: back to the title from before editing. Deleting the
      // whole title still clears it.
      if (text && !trimmed) return null;
      if (!onTitlePreview) {
        if (trimmed !== text) onEventChange?.({ ...event, title: trimmed });
        return trimmed;
      }
      // A draft: leaving a title that was changed saves it, and so does
      // Enter on one that has a title. An untouched, untitled draft stays
      // a draft, as in Notion Calendar.
      if (trimmed !== textOnFocus.trim() || (isEnter && trimmed !== "")) {
        onEventChange?.({ ...event, title: trimmed });
        return trimmed;
      }
      if (trimmed !== text) onTitlePreview({ ...event, title: trimmed });
      return trimmed;
    },
  });

  // Reset expanded options and the clock when switching to a different event
  React.useEffect(() => {
    setOptionsExpanded(false);
    setShowsOwnClock(false);
  }, [event.id]);

  // Focus + select the title on request so a new event can be named right away.
  // Deferred a frame so a popover host has been positioned before focusing.
  React.useEffect(() => {
    if (!autoFocusTitle) return;
    const frame = requestAnimationFrame(() => {
      titleRef.current?.focus({ preventScroll: true });
      titleRef.current?.select();
      onTitleAutoFocused?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [autoFocusTitle, onTitleAutoFocused, titleRef]);

  const selectKind = (next: EventKind) => {
    if (next === kind) return;
    onEventChange?.({ ...event, kind: next });
  };

  const otherKinds = EVENT_KINDS.filter((k) => k !== kind);
  const showOptionRows =
    optionsExpanded ||
    event.isAllDay ||
    clock !== undefined ||
    Boolean(
      event.recurrenceRule ??
      event.recurrence ??
      event.timeZone ??
      event.timezone,
    );

  const conferencingSection = (
    <EventDetailConferencing
      key="conferencing"
      event={event}
      onEventChange={onEventChange}
    />
  );
  const aiNotesSection = (
    <EventDetailAiNotes
      key="ai-notes"
      event={event}
      onEventChange={onEventChange}
    />
  );

  return (
    <div
      className={cn(
        "flex flex-col pt-3 text-sm font-medium",
        EVENT_DETAIL_TEXT_CLASS,
      )}
    >
      {/* Header: kind menu, "..." menu and the host's actions */}
      <div
        className={cn(
          "flex items-center justify-between pr-3 pl-2",
          EVENT_DETAIL_ROW_HEIGHT_CLASS,
        )}
      >
        <DropdownMenu
          open={kindMenuOpen}
          onOpenChange={(open) => {
            setKindMenuOpen(open);
            if (open) setHoveredOther(false);
          }}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              // Read-only details show the kind without its menu
              disabled={!onEventChange}
              className={cn(
                "flex h-7 items-center gap-[7px] px-[7px]",
                EVENT_DETAIL_HOVER_BORDER_CLASS,
                !onEventChange &&
                  "hover:border-transparent dark:hover:border-transparent",
                kindMenuOpen &&
                  "bg-calendar-menu text-calendar-menu-foreground",
              )}
            >
              {EVENT_KIND_LABELS[kind]}
              <ChevronDown
                className={cn(
                  "size-4",
                  kindMenuOpen
                    ? "text-calendar-menu-foreground/24"
                    : EVENT_DETAIL_MUTED_CLASS,
                )}
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="left"
            sideOffset={12}
            alignOffset={-4}
            className={cn("min-w-[180px]", EVENT_DETAIL_MENU_CLASS)}
            onMouseLeave={() => setHoveredOther(false)}
            onKeyDown={closeMenuOnEscape(() => setKindMenuOpen(false))}
          >
            <DropdownMenuItem
              className={cn(
                KIND_MENU_ITEM_CLASS,
                !hoveredOther &&
                  "bg-calendar-menu-accent text-calendar-menu-accent-foreground",
              )}
              onClick={() => selectKind(kind)}
              onMouseEnter={() => setHoveredOther(false)}
            >
              <Check className="size-3.5" />
              <span className="flex-1">{EVENT_KIND_LABELS[kind]}</span>
              <EventKindHelpIcon tooltip={EVENT_KIND_TOOLTIPS[kind]} />
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-calendar-menu-border" />
            {otherKinds.map((other) => (
              <DropdownMenuItem
                key={other}
                className={cn(KIND_MENU_ITEM_CLASS, "pl-8")}
                onClick={() => selectKind(other)}
                onMouseEnter={() => setHoveredOther(true)}
              >
                <span className="flex-1">{EVENT_KIND_LABELS[other]}</span>
                <EventKindHelpIcon tooltip={EVENT_KIND_TOOLTIPS[other]} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex items-center gap-0.5">
          {/* A draft isn't stored: nothing to cut, copy, duplicate or delete */}
          {!onTitlePreview && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="More actions"
                  className={cn(
                    "size-7",
                    EVENT_DETAIL_ICON_BUTTON_CLASS,
                    EVENT_DETAIL_SECONDARY_CLASS,
                  )}
                >
                  <MoreHorizontal className="size-[18px]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="left"
                className={cn("min-w-[180px]", EVENT_DETAIL_MENU_CLASS)}
                onKeyDown={stopEscapePropagation}
              >
                <DropdownMenuItem
                  disabled={!onCut}
                  aria-keyshortcuts={EVENT_ACTION_KEYS.cut.aria}
                  className={EVENT_DETAIL_MENU_ITEM_CLASS}
                  onClick={onCut}
                >
                  <SquareDashed className="size-3.5" />
                  Cut
                  <DropdownMenuShortcut
                    aria-hidden
                    className={EVENT_DETAIL_MENU_SHORTCUT_CLASS}
                  >
                    {EVENT_ACTION_KEYS.cut.label}
                  </DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!onCopy}
                  aria-keyshortcuts={EVENT_ACTION_KEYS.copy.aria}
                  className={EVENT_DETAIL_MENU_ITEM_CLASS}
                  onClick={onCopy}
                >
                  <TabletSmartphone className="size-3.5" />
                  Copy
                  <DropdownMenuShortcut
                    aria-hidden
                    className={EVENT_DETAIL_MENU_SHORTCUT_CLASS}
                  >
                    {EVENT_ACTION_KEYS.copy.label}
                  </DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!onDuplicate}
                  aria-keyshortcuts={EVENT_ACTION_KEYS.duplicate.aria}
                  className={EVENT_DETAIL_MENU_ITEM_CLASS}
                  onClick={onDuplicate}
                >
                  <Copy className="size-3.5" />
                  Duplicate
                  <DropdownMenuShortcut
                    aria-hidden
                    className={EVENT_DETAIL_MENU_SHORTCUT_CLASS}
                  >
                    {EVENT_ACTION_KEYS.duplicate.label}
                  </DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-calendar-menu-border" />
                <DropdownMenuItem
                  disabled={!onDelete}
                  aria-keyshortcuts={EVENT_ACTION_KEYS.delete.aria}
                  className={cn(
                    "text-xs focus:[&>[data-slot=dropdown-menu-shortcut]]:!text-calendar-danger-foreground",
                    EVENT_DETAIL_MENU_DANGER_CLASS,
                  )}
                  onClick={onDelete}
                >
                  <Trash2 className="size-3.5 text-calendar-danger" />
                  Delete
                  <DropdownMenuShortcut
                    aria-hidden
                    className={cn(
                      EVENT_DETAIL_MENU_SHORTCUT_CLASS,
                      "tracking-normal",
                    )}
                  >
                    {EVENT_ACTION_KEYS.delete.label}
                  </DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {headerActions}
        </div>
      </div>

      {/* Title */}
      <div className="mt-1.5 flex flex-col px-2 pb-2">
        <input
          ref={titleRef}
          {...title.inputProps}
          type="text"
          placeholder="Title"
          // The details popover finds the title by this: a draft's title
          // takes Escape before the popover does
          data-event-title=""
          readOnly={!onEventChange}
          className={cn(
            "h-[35px] px-[7px] placeholder:text-calendar-detail-placeholder",
            EVENT_DETAIL_INPUT_CLASS,
          )}
        />
      </div>

      <EventDetailDivider />

      {/* When: time and date, then all-day, time zone and repeat */}
      <EventDetailGroup name="when">
        <EventDetailTime
          event={clockEvent}
          onEventChange={handleClockEventChange}
        />
        {showOptionRows ? (
          <>
            <div
              className={cn(
                "flex flex-col justify-center",
                EVENT_DETAIL_ROW_HEIGHT_CLASS,
              )}
            >
              <EventDetailAllDay
                event={clockEvent}
                onEventChange={handleClockEventChange}
              />
            </div>
            <EventDetailTimezone
              event={event}
              onEventChange={onEventChange}
              clock={clock}
            />
            <EventDetailRecurrence
              event={event}
              onEventChange={onEventChange}
              onPrevious={onPrevWeek}
              onNext={onNextWeek}
            />
          </>
        ) : (
          <EventDetailOptionsRow onExpand={() => setOptionsExpanded(true)} />
        )}
      </EventDetailGroup>

      <EventDetailDivider />

      {/* Who and where */}
      <EventDetailGroup name="who">
        <EventDetailParticipants event={event} onEventChange={onEventChange} />
        {/* With a call, Notion moves the meeting-note button above it; the
            keys keep both mounted (and focused) when they swap */}
        {event.conference
          ? [aiNotesSection, conferencingSection]
          : [conferencingSection, aiNotesSection]}
        <EventDetailLocation event={event} onEventChange={onEventChange} />
      </EventDetailGroup>

      <EventDetailDivider />

      <EventDetailGroup name="links">
        <EventDetailLinks event={event} onEventChange={onEventChange} />
      </EventDetailGroup>

      <EventDetailDivider />

      {/* At least one 35px row, empty or not */}
      <EventDetailGroup name="description" className="min-h-[51px]">
        <EventDetailDescription event={event} onEventChange={onEventChange} />
      </EventDetailGroup>

      <EventDetailDivider />

      {/* Calendar, availability and reminders */}
      <EventDetailGroup name="calendar">
        <EventDetailCalendar event={event} onEventChange={onEventChange} />
        <EventDetailAvailability event={event} onEventChange={onEventChange} />
        <EventDetailReminders event={event} onEventChange={onEventChange} />
      </EventDetailGroup>
    </div>
  );
}
