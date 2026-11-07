"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  CircleHelp,
  SquareArrowOutUpRight,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EVENT_DETAIL_HOVER_BORDER_CLASS,
  EVENT_DETAIL_MENU_CLASS,
  EVENT_DETAIL_MUTED_CLASS,
  EVENT_DETAIL_ROW_HEIGHT_CLASS,
  PANEL_MENU_ITEM_CLASS,
  PANEL_MENU_ITEM_CURRENT_CLASS,
  PANEL_MENU_SURFACE_CLASS,
  PANEL_TRIGGER_OPEN_CLASS,
  EventDetailSection,
  EventDetailTooltip,
  getPanelMenuSideOffset,
  stopEscapePropagation,
} from "./event-detail-parts";
import type {
  DetailedCalendarEvent,
  EventDetailSectionProps,
} from "./week-view-types";

/** One choice of a `PanelSelect` menu */
interface PanelSelectOption<TValue extends string> {
  value: TValue;
  label: string;
  /** Explanation shown by the "?" icon of the highlighted item */
  help: string;
  /** Whether the explanation ends with an external-link icon (help article) */
  helpLink?: boolean;
  /** Draws a separator after this option */
  separatorAfter?: boolean;
}

/** Busy or free: `DetailedCalendarEvent["status"]` once set */
type EventStatus = NonNullable<DetailedCalendarEvent["status"]>;

/** Who can see the event: `DetailedCalendarEvent["visibility"]` once set */
type EventVisibility = NonNullable<DetailedCalendarEvent["visibility"]>;

/** Choices of the busy/free menu */
const AVAILABILITY_OPTIONS: PanelSelectOption<EventStatus>[] = [
  {
    value: "busy",
    label: "Busy",
    help: "Show me as busy to other people during this event",
  },
  {
    value: "free",
    label: "Free",
    help: "Show me as free to other people during this event",
  },
];

/** Choices of the visibility menu */
const VISIBILITY_OPTIONS: PanelSelectOption<EventVisibility>[] = [
  {
    value: "default",
    label: "Default visibility",
    help: "The visibility of this event follows the sharing settings of this calendar. Anyone who can see this calendar can see the details of this event.",
    helpLink: true,
    separatorAfter: true,
  },
  {
    value: "public",
    label: "Public",
    help: "Anyone can see the details of this event.",
    helpLink: true,
  },
  {
    value: "private",
    label: "Private",
    help: "Nobody can see the details of this event unless they have permission to make changes to this calendar.",
    helpLink: true,
  },
];

/**
 * Props for HelpTextWithLink
 */
interface HelpTextWithLinkProps {
  text: string;
}

/**
 * Help text ending with the external-link icon, kept on the line of the
 * last word as Notion wraps it
 */
function HelpTextWithLink({ text }: HelpTextWithLinkProps) {
  const lastSpace = text.lastIndexOf(" ");
  return (
    <>
      {text.slice(0, lastSpace + 1)}
      <span className="whitespace-nowrap">
        {text.slice(lastSpace + 1)}
        <SquareArrowOutUpRight
          aria-hidden
          className="ml-1 inline size-3 -translate-y-px align-middle text-[#8A8A8A]"
        />
      </span>
    </>
  );
}

/**
 * Props for HelpIcon
 */
interface HelpIconProps {
  option: PanelSelectOption<string>;
  /** Shows the icon without the item being highlighted */
  visible: boolean;
}

/**
 * The "?" at the end of a highlighted menu item, explaining it in a tooltip
 */
function HelpIcon({ option, visible }: HelpIconProps) {
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  return (
    <span
      data-testid="menu-help"
      className={cn(
        "ml-auto flex size-3.5 shrink-0 items-center justify-center opacity-0 group-focus/item:opacity-100 group-data-[highlighted]/item:opacity-100",
        visible && "opacity-100",
      )}
      onMouseEnter={(e) => setRect(e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => setRect(null)}
    >
      <CircleHelp
        aria-hidden
        className="size-3.5 !text-[#9B9B9B] group-hover/item:!text-[#D5D5D5]"
      />
      <EventDetailTooltip rect={rect}>
        {option.helpLink ? (
          <HelpTextWithLink text={option.help} />
        ) : (
          option.help
        )}
      </EventDetailTooltip>
    </span>
  );
}

/**
 * Props for PanelSelect
 */
interface PanelSelectProps<TValue extends string> {
  /** Accessible name of the trigger, e.g. "Availability" */
  name: string;
  value: TValue;
  options: PanelSelectOption<TValue>[];
  /** The section the menu lines up beside */
  sectionRef: React.RefObject<HTMLElement | null>;
  className?: string;
  /** Called with the picked choice; without it the value is read-only text */
  onValueChange?: (value: TValue) => void;
}

/**
 * A value of the panel picked from a menu that opens beside the panel: the
 * value with a chevron on hover, the menu with a check on the current value
 * and a "?" explaining each choice. Hovering or highlighting a choice
 * previews it in the trigger; Escape closes the menu and keeps the value.
 */
function PanelSelect<TValue extends string>({
  name,
  value,
  options,
  sectionRef,
  className,
  onValueChange,
}: PanelSelectProps<TValue>) {
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(false);
  const [sideOffset, setSideOffset] = React.useState(0);
  /** Choice hovered or highlighted in the open menu */
  const [preview, setPreview] = React.useState<TValue | null>(null);
  /** Whether a choice of the open menu has been hovered or highlighted yet */
  const [pointed, setPointed] = React.useState(false);

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      setOpen(next);
      setPreview(null);
      if (!next) return;
      setSideOffset(getPanelMenuSideOffset(triggerRef, sectionRef));
      setPointed(false);
    },
    [sectionRef],
  );

  const showPreview = React.useCallback((next: TValue) => {
    setPointed(true);
    setPreview(next);
  }, []);

  const hidePreview = React.useCallback(() => setPreview(null), []);

  const shown = options.find((o) => o.value === (preview ?? value));
  const current = options.find((o) => o.value === value);

  if (!onValueChange) {
    return (
      <div
        className={cn(
          "flex h-8 min-w-0 items-center border border-transparent px-2",
          className,
        )}
      >
        <span className="sr-only">{name}: </span>
        <span className="truncate">{current?.label ?? value}</span>
      </div>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label={`${name}: ${current?.label ?? value}`}
          // Base UI moves focus into the menu after it opens: an Escape before
          // that reaches the trigger
          onKeyDown={open ? stopEscapePropagation : undefined}
          className={cn(
            "group/trigger flex h-8 min-w-0 items-center justify-between gap-2 px-2 text-left outline-none",
            EVENT_DETAIL_HOVER_BORDER_CLASS,
            open && PANEL_TRIGGER_OPEN_CLASS,
            className,
          )}
        >
          <span className="truncate">{shown?.label ?? value}</span>
          <ChevronDown
            className={cn(
              "mr-0.5 size-3.5 shrink-0 opacity-0 group-hover/trigger:opacity-100 group-focus-visible/trigger:opacity-100",
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
        aria-label={name}
        onKeyDown={stopEscapePropagation}
        className={cn(
          "w-[216px]",
          EVENT_DETAIL_MENU_CLASS,
          PANEL_MENU_SURFACE_CLASS,
        )}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <React.Fragment key={option.value}>
              <DropdownMenuItem
                role="menuitemradio"
                aria-checked={selected}
                className={cn(
                  PANEL_MENU_ITEM_CLASS,
                  selected && !pointed && PANEL_MENU_ITEM_CURRENT_CLASS,
                )}
                onClick={() => {
                  if (option.value !== value) onValueChange(option.value);
                }}
                onMouseEnter={() => showPreview(option.value)}
                onMouseLeave={hidePreview}
                onFocus={() => showPreview(option.value)}
                onBlur={hidePreview}
              >
                <span className="flex w-3.5 shrink-0 items-center justify-center">
                  {selected && <Check className="size-3.5 !text-current" />}
                </span>
                <span className="ml-2 truncate">{option.label}</span>
                <HelpIcon option={option} visible={selected && !pointed} />
              </DropdownMenuItem>
              {option.separatorAfter && (
                <DropdownMenuSeparator className="mx-1 my-[5px] bg-[#303030]" />
              )}
            </React.Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Busy or free, and who can see the event, side by side under the calendar.
 * Each opens a menu beside the panel.
 */
export function EventDetailAvailability<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event, onEventChange }: EventDetailSectionProps<TEvent>) {
  const sectionRef = React.useRef<HTMLDivElement>(null);

  const handleStatusChange = React.useCallback(
    (status: EventStatus) => {
      onEventChange?.({ ...event, status });
    },
    [event, onEventChange],
  );

  const handleVisibilityChange = React.useCallback(
    (visibility: EventVisibility) => {
      onEventChange?.({ ...event, visibility });
    },
    [event, onEventChange],
  );

  return (
    <EventDetailSection ref={sectionRef} name="availability">
      <div
        className={cn(
          "flex items-center gap-[5px] pr-2 pl-9",
          EVENT_DETAIL_ROW_HEIGHT_CLASS,
        )}
      >
        <PanelSelect
          name="Availability"
          value={event.status ?? "busy"}
          options={AVAILABILITY_OPTIONS}
          sectionRef={sectionRef}
          className="w-[102px] shrink-0"
          onValueChange={onEventChange && handleStatusChange}
        />
        <PanelSelect
          name="Visibility"
          value={event.visibility ?? "default"}
          options={VISIBILITY_OPTIONS}
          sectionRef={sectionRef}
          className="flex-1"
          onValueChange={onEventChange && handleVisibilityChange}
        />
      </div>
    </EventDetailSection>
  );
}
