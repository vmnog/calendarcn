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
import { EVENT_COLOR_SWATCH_CLASS } from "./event-context-menu";
import {
  EVENT_DETAIL_HOVER_BORDER_CLASS,
  EVENT_DETAIL_MENU_CLASS,
  EVENT_DETAIL_MUTED_CLASS,
  EVENT_DETAIL_ROW_HEIGHT_CLASS,
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
import {
  EVENT_COLORS,
  groupCalendarsByEmail,
  moveEventToCalendar,
  resolveEventColor,
} from "@/lib/event-utils";
import type {
  CalendarInfo,
  DetailedCalendarEvent,
  EventColor,
  EventDetailSectionProps,
} from "./week-view-types";

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

/** A 14px color swatch */
const SWATCH_CLASS = "size-3.5 shrink-0 rounded-[4px]";

/**
 * Props for CalendarSwatch
 */
interface CalendarSwatchProps {
  /** Color of the event's calendar, when it is listed */
  calendarColor?: EventColor;
  /** The color the event is drawn in: its own, else its calendar's */
  eventColor: EventColor;
}

/**
 * The calendar's color, with the event's own color in front of it when it
 * has a different one, as Notion draws it
 */
function CalendarSwatch({ calendarColor, eventColor }: CalendarSwatchProps) {
  if (!calendarColor || eventColor === calendarColor) {
    return (
      <span
        data-testid="event-calendar-swatch"
        className={cn(SWATCH_CLASS, EVENT_COLOR_SWATCH_CLASS[eventColor])}
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
          "absolute top-0 left-0",
          SWATCH_CLASS,
          EVENT_COLOR_SWATCH_CLASS[calendarColor],
        )}
      />
      <span
        className={cn(
          "absolute top-0 right-0",
          SWATCH_CLASS,
          EVENT_COLOR_SWATCH_CLASS[eventColor],
        )}
      />
    </span>
  );
}

/**
 * Props for ColorSwatchItem
 */
interface ColorSwatchItemProps {
  color: EventColor;
  /** Whether the event is drawn in this color */
  checked: boolean;
  onPick: (color: EventColor) => void;
  /** Called with the color while it is hovered or focused, null after */
  onPreview: (color: EventColor | null) => void;
}

/**
 * One color of the picker's "Event color" row, with its name in a tooltip
 */
function ColorSwatchItem({
  color,
  checked,
  onPick,
  onPreview,
}: ColorSwatchItemProps) {
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
  /** The color the event is drawn in: its own, else its calendar's */
  const eventColor = resolveEventColor(event, calendars);
  const shownCalendar = previewCalendar ?? calendar;
  /** The color the row shows: the previewed one, or the event's once moved */
  const shownColor =
    previewColor ??
    (previewCalendar
      ? resolveEventColor(
          moveEventToCalendar(event, previewCalendar, calendars),
          calendars,
        )
      : eventColor);
  const name =
    calendar?.name ?? event.calendarEmail ?? event.calendarId ?? "Calendar";
  const shownName = previewCalendar?.name ?? name;

  const handleOpenChange = React.useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setPreviewColor(null);
      setPreviewCalendar(null);
      return;
    }
    setSideOffset(getPanelMenuSideOffset(triggerRef, sectionRef));
    setPointed(false);
  }, []);

  const handleCalendarPick = React.useCallback(
    (to: CalendarInfo) => {
      if (to.id === event.calendarId) return;
      onEventChange?.(moveEventToCalendar(event, to, calendars));
    },
    [event, calendars, onEventChange],
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
        <div className={cn("flex items-center", EVENT_DETAIL_ROW_HEIGHT_CLASS)}>
          <DropdownMenuTrigger asChild>
            <button
              ref={triggerRef}
              type="button"
              aria-label={`Calendar: ${name}`}
              // Base UI moves focus into the menu after it opens: an Escape
              // before that reaches the trigger
              onKeyDown={open ? stopEscapePropagation : undefined}
              className={cn(
                "group/trigger flex h-8 w-full items-center gap-[11px] pr-2 pl-[9px] text-left outline-none",
                EVENT_DETAIL_HOVER_BORDER_CLASS,
                open && PANEL_TRIGGER_OPEN_CLASS,
              )}
            >
              <span className="flex w-4 shrink-0 items-center justify-center">
                <CalendarSwatch
                  calendarColor={shownCalendar?.color}
                  eventColor={shownColor}
                />
              </span>
              <span className="min-w-0 flex-1 truncate">{shownName}</span>
              <ChevronDown
                className={cn(
                  "size-3.5 shrink-0 opacity-0 group-hover/trigger:opacity-100 group-focus-visible/trigger:opacity-100",
                  EVENT_DETAIL_MUTED_CLASS,
                  open && "opacity-100",
                )}
              />
            </button>
          </DropdownMenuTrigger>
        </div>
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
                        "ml-[9px]",
                        SWATCH_CLASS,
                        EVENT_COLOR_SWATCH_CLASS[item.color],
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
