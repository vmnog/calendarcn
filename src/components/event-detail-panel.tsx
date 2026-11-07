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
import { EventDetailAiNotes } from "./event-detail-ai-notes";
import { EventDetailAvailability } from "./event-detail-availability";
import { EventDetailCalendar } from "./event-detail-calendar";
import { EventDetailConferencing } from "./event-detail-conferencing";
import { EventDetailDescription } from "./event-detail-description";
import { EventDetailLinks } from "./event-detail-links";
import { EventDetailLocation } from "./event-detail-location";
import {
  EVENT_DETAIL_HOVER_BORDER_CLASS,
  EVENT_DETAIL_ICON_BUTTON_CLASS,
  EVENT_DETAIL_INPUT_CLASS,
  EVENT_DETAIL_MENU_CLASS,
  EVENT_DETAIL_MENU_ITEM_CLASS,
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
import type { DetailedCalendarEvent, EventKind } from "./week-view-types";

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
  /** Extra action buttons rendered in the header row (after the "..." menu). */
  headerActions?: React.ReactNode;
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
      <CircleHelp className="size-3.5 text-white" />
      {tooltipPos &&
        ReactDOM.createPortal(
          <div
            className="pointer-events-none fixed z-[100] max-w-[240px] rounded-sm bg-[#252525] border border-[#303030] px-2 py-1 text-xs text-white shadow-md"
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
function EventDetailOptionsRow({ onExpand }: { onExpand: () => void }) {
  const labelClass = cn(
    EVENT_DETAIL_PLACEHOLDER_CLASS,
    "group-hover/options:text-[#A5A5A5] dark:group-hover/options:text-[#636363]",
  );

  return (
    <div
      className={cn(
        "flex items-center pl-[36px]",
        EVENT_DETAIL_ROW_HEIGHT_CLASS,
      )}
    >
      <div
        className="group/options flex h-[31px] cursor-default items-center gap-[18px] rounded-md px-[9px] hover:bg-[#F5F5F5] dark:hover:bg-[#242424]"
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
  headerActions,
  autoFocusTitle,
  onTitleAutoFocused,
}: EventDetailPanelProps<TEvent>) {
  const kind = event.kind ?? "event";
  const [kindMenuOpen, setKindMenuOpen] = React.useState(false);
  const [hoveredOther, setHoveredOther] = React.useState(false);
  /** Whether the compact "All-day / Time zone / Repeat" row is expanded into individual rows. */
  const [optionsExpanded, setOptionsExpanded] = React.useState(false);

  const titleRef = React.useRef<HTMLInputElement>(null);
  const title = useInlineEdit({
    inputRef: titleRef,
    value: event.title,
    onInput: (text) => onEventChange?.({ ...event, title: text }),
    onRestore: (text) => onEventChange?.({ ...event, title: text }),
    onCommit: (text) => {
      const trimmed = text.trim();
      // Only spaces: back to the title from before editing. Deleting the
      // whole title still clears it.
      if (text && !trimmed) return null;
      if (trimmed !== text) onEventChange?.({ ...event, title: trimmed });
      return trimmed;
    },
  });

  // Reset expanded options when switching to a different event
  React.useEffect(() => {
    setOptionsExpanded(false);
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
                kindMenuOpen && "bg-[#252525] text-white",
              )}
            >
              {EVENT_KIND_LABELS[kind]}
              <ChevronDown
                className={cn(
                  "size-4",
                  kindMenuOpen ? "text-[#595959]" : EVENT_DETAIL_MUTED_CLASS,
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
                "group/item text-xs text-white focus:bg-[#303030] focus:text-white",
                !hoveredOther && "bg-[#303030]",
              )}
              onClick={() => selectKind(kind)}
              onMouseEnter={() => setHoveredOther(false)}
            >
              <Check className="size-3.5" />
              <span className="flex-1">{EVENT_KIND_LABELS[kind]}</span>
              <EventKindHelpIcon tooltip={EVENT_KIND_TOOLTIPS[kind]} />
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#303030]" />
            {otherKinds.map((other) => (
              <DropdownMenuItem
                key={other}
                className="group/item text-xs text-white focus:bg-[#303030] focus:text-white pl-8"
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
              <DropdownMenuItem className={EVENT_DETAIL_MENU_ITEM_CLASS}>
                <SquareDashed className="size-3.5" />
                Cut
                <DropdownMenuShortcut className="text-white/40">
                  ⌘X
                </DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem className={EVENT_DETAIL_MENU_ITEM_CLASS}>
                <TabletSmartphone className="size-3.5" />
                Copy
                <DropdownMenuShortcut className="text-white/40">
                  ⌘C
                </DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem className={EVENT_DETAIL_MENU_ITEM_CLASS}>
                <Copy className="size-3.5" />
                Duplicate
                <DropdownMenuShortcut className="text-white/40">
                  ⌘D
                </DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#303030]" />
              <DropdownMenuItem className="text-xs text-[#E56458] focus:!bg-[#DE5551] focus:!text-white focus:[&>svg]:!text-white focus:[&>[data-slot=dropdown-menu-shortcut]]:!text-white">
                <Trash2 className="size-3.5 text-[#E56458]" />
                Delete
                <DropdownMenuShortcut className="text-white/40 tracking-normal">
                  delete
                </DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
          readOnly={!onEventChange}
          className={cn(
            "h-[35px] px-[7px] placeholder:text-[#ABABA9] dark:placeholder:text-[#595959]",
            EVENT_DETAIL_INPUT_CLASS,
          )}
        />
      </div>

      <EventDetailDivider />

      {/* When: time and date, then all-day, time zone and repeat */}
      <EventDetailGroup name="when">
        <EventDetailTime event={event} onEventChange={onEventChange} />
        {showOptionRows ? (
          <>
            <div
              className={cn(
                "flex flex-col justify-center",
                EVENT_DETAIL_ROW_HEIGHT_CLASS,
              )}
            >
              <EventDetailAllDay event={event} onEventChange={onEventChange} />
            </div>
            <EventDetailTimezone event={event} onEventChange={onEventChange} />
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
