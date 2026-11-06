"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCalendarConfig } from "./calendar-provider";
import {
  EVENT_DETAIL_HOVER_BORDER_CLASS,
  EVENT_DETAIL_MENU_CLASS,
  EVENT_DETAIL_MUTED_CLASS,
  EventDetailSection,
} from "./event-detail-parts";
import {
  PANEL_MENU_ITEM_CLASS,
  PANEL_MENU_ITEM_CURRENT_CLASS,
  PANEL_MENU_LABEL_CLASS,
  PANEL_MENU_SURFACE_CLASS,
  PANEL_TRIGGER_OPEN_CLASS,
  EventDetailTooltip,
  getPanelMenuSideOffset,
  stopEscapePropagation,
} from "./event-detail-availability";
import { EVENT_COLORS } from "@/lib/event-utils";
import type {
  CalendarInfo,
  DetailedCalendarEvent,
  EventColor,
  EventDetailSectionProps,
  EventReminder,
} from "./week-view-types";

/**
 * Swatch of an event's own color: Notion Calendar's event palette, the same
 * in both themes
 */
const EVENT_COLOR_SWATCH_CLASS: Record<EventColor, string> = {
  red: "bg-[#ED201E]",
  orange: "bg-[#FD7842]",
  yellow: "bg-[#F4BE41]",
  green: "bg-[#5DCB89]",
  blue: "bg-[#4EA7E0]",
  purple: "bg-[#965DF3]",
  gray: "bg-[#B8B8B8]",
};

/**
 * Swatch of a calendar's color. Light matches the events' border colors;
 * Notion lightens calendar colors in dark mode (purple, green and blue
 * measured, the others follow the same shift).
 */
const CALENDAR_COLOR_SWATCH_CLASS: Record<EventColor, string> = {
  red: "bg-event-red-border dark:bg-[#DB182C]",
  orange: "bg-event-orange-border dark:bg-[#E67F4B]",
  yellow: "bg-event-yellow-border dark:bg-[#DEBF41]",
  green: "bg-event-green-border dark:bg-[#63D08D]",
  blue: "bg-event-blue-border dark:bg-[#51ACE3]",
  purple: "bg-event-purple-border dark:bg-[#9C61F9]",
  gray: "bg-event-gray-border dark:bg-[#B7B7B7]",
};

/** Name of each event color, shown in the swatch tooltips */
const COLOR_NAMES: Record<EventColor, string> = {
  red: "Red",
  orange: "Orange",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
  purple: "Purple",
  gray: "Gray",
};

/** Color of an event that sets none and belongs to no listed calendar */
const DEFAULT_EVENT_COLOR: EventColor = "blue";

/** Calendars that share an account, listed under its email */
interface CalendarGroup {
  /** Account email shown above the group; absent for calendars without one */
  email?: string;
  calendars: CalendarInfo[];
}

/** Groups calendars by account email, keeping the order they were given in */
function groupCalendarsByEmail(calendars: CalendarInfo[]): CalendarGroup[] {
  const groups: CalendarGroup[] = [];
  for (const calendar of calendars) {
    const group = groups.find((g) => g.email === calendar.email);
    if (group) {
      group.calendars.push(calendar);
      continue;
    }
    groups.push({ email: calendar.email, calendars: [calendar] });
  }
  return groups;
}

/** Whether two reminder lists hold the same reminders, in any order */
function sameReminders(a: EventReminder[], b: EventReminder[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((reminder) =>
    b.some(
      (other) =>
        other.amount === reminder.amount && other.unit === reminder.unit,
    ),
  );
}

/**
 * Moves an event to another calendar. An event that kept its calendar's
 * color takes the new calendar's, and one that kept its calendar's default
 * reminders takes the new calendar's defaults, as in Notion Calendar.
 */
function moveToCalendar<TEvent extends DetailedCalendarEvent>(
  event: TEvent,
  from: CalendarInfo | undefined,
  to: CalendarInfo,
): TEvent {
  const keptCalendarColor =
    event.color === undefined || event.color === from?.color;
  const reminders = event.reminders ?? [];
  const keptDefaultReminders =
    to.defaultReminders !== undefined &&
    from?.defaultReminders !== undefined &&
    sameReminders(reminders, from.defaultReminders);

  return {
    ...event,
    calendarId: to.id,
    calendarEmail: to.email ?? event.calendarEmail,
    color: keptCalendarColor ? to.color : event.color,
    reminders: keptDefaultReminders ? to.defaultReminders : event.reminders,
  };
}

/**
 * The calendar's color, with the event's own color in front of it when it
 * has a different one, as Notion draws it
 */
function CalendarSwatch({
  calendarColor,
  eventColor,
}: {
  /** Color of the event's calendar, when it is listed */
  calendarColor?: EventColor;
  /** The event's own color, when it sets one */
  eventColor?: EventColor;
}) {
  if (!calendarColor) {
    return (
      <span
        data-testid="event-calendar-swatch"
        className={cn(
          "size-3.5 shrink-0 rounded-[4px]",
          EVENT_COLOR_SWATCH_CLASS[eventColor ?? DEFAULT_EVENT_COLOR],
        )}
      />
    );
  }

  if (!eventColor || eventColor === calendarColor) {
    return (
      <span
        data-testid="event-calendar-swatch"
        className={cn(
          "size-3.5 shrink-0 rounded-[4px]",
          CALENDAR_COLOR_SWATCH_CLASS[calendarColor],
        )}
      />
    );
  }

  return (
    <span
      data-testid="event-calendar-swatch"
      className="relative h-3.5 w-[22px] shrink-0"
    >
      <span
        className={cn(
          "absolute top-0 left-0 size-3.5 rounded-[4px]",
          CALENDAR_COLOR_SWATCH_CLASS[calendarColor],
        )}
      />
      <span
        className={cn(
          "absolute top-0 right-0 size-3.5 rounded-[4px]",
          EVENT_COLOR_SWATCH_CLASS[eventColor],
        )}
      />
    </span>
  );
}

/**
 * One color of the picker's "Event color" row, with its name in a tooltip
 */
function ColorSwatchItem({
  color,
  checked,
  onPick,
  onPreview,
}: {
  color: EventColor;
  checked: boolean;
  onPick: (color: EventColor) => void;
  onPreview: (color: EventColor | null) => void;
}) {
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  const show = React.useCallback(
    (e: React.SyntheticEvent<HTMLElement>) => {
      setRect(e.currentTarget.getBoundingClientRect());
      onPreview(color);
    },
    [color, onPreview],
  );

  const hide = React.useCallback(() => {
    setRect(null);
    onPreview(null);
  }, [onPreview]);

  return (
    <DropdownMenuItem
      aria-label={COLOR_NAMES[color]}
      aria-checked={checked}
      role="menuitemradio"
      data-color={color}
      className="relative flex size-3.5 items-center justify-center rounded-[4px] p-0 focus:bg-transparent focus-visible:ring-2 focus-visible:ring-white/60"
      onClick={() => onPick(color)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span
        className={cn(
          "absolute inset-0 rounded-[4px]",
          EVENT_COLOR_SWATCH_CLASS[color],
        )}
      />
      {checked && (
        <Check className="relative size-3 !text-black/55" strokeWidth={2.5} />
      )}
      <EventDetailTooltip rect={rect}>{COLOR_NAMES[color]}</EventDetailTooltip>
    </DropdownMenuItem>
  );
}

/**
 * The calendar the event belongs to, with its color swatch. Opens a menu to
 * move the event to another calendar (grouped by account) and to give it its
 * own color.
 */
export function EventDetailCalendar<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event, onEventChange }: EventDetailSectionProps<TEvent>) {
  const sectionRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(false);
  const [sideOffset, setSideOffset] = React.useState(0);
  /** Color hovered or focused in the picker, previewed in the swatch */
  const [previewColor, setPreviewColor] = React.useState<EventColor | null>(
    null,
  );
  /** Whether an item of the open picker has been hovered or focused yet */
  const [pointed, setPointed] = React.useState(false);
  /** Calendar hovered or focused in the picker, previewed in the row */
  const [previewCalendar, setPreviewCalendar] =
    React.useState<CalendarInfo | null>(null);
  const { calendars } = useCalendarConfig();

  const groups = React.useMemo(
    () => groupCalendarsByEmail(calendars),
    [calendars],
  );
  const calendar = calendars.find((c) => c.id === event.calendarId);
  /** The color the event shows: its own, else its calendar's */
  const eventColor = event.color ?? calendar?.color ?? DEFAULT_EVENT_COLOR;
  const shownCalendar = previewCalendar ?? calendar;
  const name =
    calendar?.name ?? event.calendarEmail ?? event.calendarId ?? "Calendar";
  const shownName = previewCalendar?.name ?? name;

  const handleOpenChange = React.useCallback((next: boolean) => {
    if (next) {
      setSideOffset(getPanelMenuSideOffset(triggerRef, sectionRef));
      setPointed(false);
    }
    if (!next) {
      setPreviewColor(null);
      setPreviewCalendar(null);
    }
    setOpen(next);
  }, []);

  const handleCalendarPick = React.useCallback(
    (to: CalendarInfo) => {
      if (to.id === event.calendarId) return;
      onEventChange?.(moveToCalendar(event, calendar, to));
    },
    [event, calendar, onEventChange],
  );

  const handleColorPick = React.useCallback(
    (color: EventColor) => {
      if (color === event.color) return;
      onEventChange?.({ ...event, color });
    },
    [event, onEventChange],
  );

  return (
    <EventDetailSection ref={sectionRef} name="calendar" className="px-2">
      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            aria-label={`Calendar: ${name}`}
            // Base UI moves focus into the menu after it opens: an Escape before
            // that reaches the trigger
            onKeyDown={open ? stopEscapePropagation : undefined}
            className={cn(
              "group/trigger flex min-h-8 w-full items-center gap-3 px-2 text-left text-xs outline-none",
              EVENT_DETAIL_HOVER_BORDER_CLASS,
              open && PANEL_TRIGGER_OPEN_CLASS,
            )}
          >
            <span className="flex w-4 shrink-0 items-center justify-center">
              <CalendarSwatch
                calendarColor={shownCalendar?.color}
                eventColor={previewColor ?? event.color}
              />
            </span>
            <span className="text-foreground min-w-0 flex-1 truncate">
              {shownName}
            </span>
            <ChevronDown
              className={cn(
                "size-3.5 shrink-0 opacity-0 group-hover/trigger:opacity-100 group-focus-visible/trigger:opacity-100",
                EVENT_DETAIL_MUTED_CLASS,
                open && "opacity-100",
              )}
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="left"
          align="start"
          sideOffset={sideOffset}
          aria-label="Calendar"
          className={cn(EVENT_DETAIL_MENU_CLASS, PANEL_MENU_SURFACE_CLASS)}
          onKeyDown={stopEscapePropagation}
        >
          {groups.map((group) => (
            <div key={group.email ?? ""} role="group" aria-label={group.email}>
              {group.email && (
                <div className={PANEL_MENU_LABEL_CLASS}>{group.email}</div>
              )}
              {group.calendars.map((item) => {
                const selected = item.id === event.calendarId;
                return (
                  <DropdownMenuItem
                    key={item.id}
                    role="menuitemradio"
                    aria-checked={selected}
                    className={cn(
                      PANEL_MENU_ITEM_CLASS,
                      selected && !pointed && PANEL_MENU_ITEM_CURRENT_CLASS,
                    )}
                    onClick={() => handleCalendarPick(item)}
                    onMouseEnter={() => {
                      setPointed(true);
                      setPreviewCalendar(item);
                    }}
                    onMouseLeave={() => setPreviewCalendar(null)}
                    onFocus={() => {
                      setPointed(true);
                      setPreviewCalendar(item);
                    }}
                    onBlur={() => setPreviewCalendar(null)}
                  >
                    <span className="flex w-3.5 shrink-0 items-center justify-center">
                      {selected && <Check className="size-3.5 !text-current" />}
                    </span>
                    <span
                      className={cn(
                        "ml-[9px] size-3.5 shrink-0 rounded-[4px]",
                        CALENDAR_COLOR_SWATCH_CLASS[item.color],
                      )}
                    />
                    <span className="ml-[11px] truncate">{item.name}</span>
                  </DropdownMenuItem>
                );
              })}
            </div>
          ))}
          {groups.length > 0 && (
            <DropdownMenuSeparator className="mx-1 my-1.5 bg-[#303030]" />
          )}
          <div className={PANEL_MENU_LABEL_CLASS}>Event color</div>
          <div
            role="group"
            aria-label="Event color"
            className="flex items-center gap-2 pt-1.5 pr-2.5 pb-2.5 pl-[31px]"
          >
            {EVENT_COLORS.map((color) => (
              <ColorSwatchItem
                key={color}
                color={color}
                checked={color === eventColor}
                onPick={handleColorPick}
                onPreview={(color) => {
                  if (color) setPointed(true);
                  setPreviewColor(color);
                }}
              />
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </EventDetailSection>
  );
}
