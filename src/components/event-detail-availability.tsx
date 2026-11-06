"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";
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
  EventDetailSection,
} from "./event-detail-parts";
import type {
  DetailedCalendarEvent,
  EventDetailSectionProps,
} from "./week-view-types";

/** Gap in px between a menu opened from the panel and the panel's left edge */
const PANEL_MENU_GAP = 4;

/** Gap in px between a tooltip and the element it describes */
const TOOLTIP_GAP = 12;

/** Surface of a menu opened from the bottom of the panel (with `EVENT_DETAIL_MENU_CLASS`) */
export const PANEL_MENU_SURFACE_CLASS = "rounded-lg p-1.5 shadow-lg";

/** An item of a `PANEL_MENU_SURFACE_CLASS` menu: 32px tall, highlight inset */
export const PANEL_MENU_ITEM_CLASS =
  "group/item h-8 gap-0 rounded-md px-2 py-0 text-xs text-[#CCCCCC] focus:!bg-[#303030] focus:!text-[#F0F0F0]";

/**
 * The current item of a `PANEL_MENU_SURFACE_CLASS` menu while nothing else
 * is highlighted: Notion opens its menus with the current value highlighted
 */
export const PANEL_MENU_ITEM_CURRENT_CLASS = "bg-[#303030] text-[#F0F0F0]";

/** A muted heading in a `PANEL_MENU_SURFACE_CLASS` menu (an account, "Event color") */
export const PANEL_MENU_LABEL_CLASS =
  "flex h-8 items-center pr-2 pl-[31px] text-xs text-[#848484] select-none";

/** A panel dropdown trigger while its menu is open: filled, border blended in */
export const PANEL_TRIGGER_OPEN_CLASS =
  "border-[#F5F5F5] bg-[#F5F5F5] hover:border-[#F5F5F5] dark:border-[#252525] dark:bg-[#252525] dark:hover:border-[#252525]";

/**
 * Keydown handler for a panel menu: Escape closes the menu only, instead of
 * also reaching the calendar's shortcut that deselects the event
 */
export function stopEscapePropagation(e: React.KeyboardEvent) {
  if (e.key === "Escape") e.stopPropagation();
}

/**
 * `sideOffset` that puts a `side="left"` menu just outside the panel's left
 * edge, whichever column its trigger sits in, as Notion lines up its menus
 */
export function getPanelMenuSideOffset(
  triggerRef: React.RefObject<HTMLElement | null>,
  sectionRef: React.RefObject<HTMLElement | null>,
): number {
  const trigger = triggerRef.current;
  const section = sectionRef.current;
  if (!trigger || !section) return PANEL_MENU_GAP;
  return (
    trigger.getBoundingClientRect().left -
    section.getBoundingClientRect().left +
    PANEL_MENU_GAP
  );
}

/**
 * A tooltip centered above a rectangle (from `getBoundingClientRect()`),
 * shown while `rect` is set. It ignores the pointer, so hovering it never
 * keeps it open.
 */
export function EventDetailTooltip({
  rect,
  children,
}: {
  rect: DOMRect | null;
  children: React.ReactNode;
}) {
  if (!rect) return null;

  return ReactDOM.createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[100] w-max max-w-[232px] -translate-x-1/2 -translate-y-full rounded-md border border-transparent bg-[#252525] px-2.5 py-1.5 text-xs leading-[18px] text-[#F0F0F0] shadow-md dark:border-[#303030]"
      style={{
        left: rect.left + rect.width / 2,
        top: rect.top - TOOLTIP_GAP,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

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

/** Choices of the busy/free menu */
const AVAILABILITY_OPTIONS: PanelSelectOption<"busy" | "free">[] = [
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
const VISIBILITY_OPTIONS: PanelSelectOption<
  "default" | "public" | "private"
>[] = [
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
 * Help text ending with the external-link icon, kept on the line of the
 * last word as Notion wraps it
 */
function HelpTextWithLink({ text }: { text: string }) {
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
 * The "?" at the end of a highlighted menu item, explaining it in a tooltip
 */
function HelpIcon({
  option,
  visible,
}: {
  option: PanelSelectOption<string>;
  /** Shows the icon without the item being highlighted */
  visible: boolean;
}) {
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
 * A value of the panel picked from a menu that opens beside the panel: the
 * value with a chevron on hover, the menu with a check on the current value
 * and a "?" explaining each choice. Hovering or highlighting a choice
 * previews it in the trigger.
 */
function PanelSelect<TValue extends string>({
  name,
  value,
  options,
  sectionRef,
  className,
  onValueChange,
}: {
  /** Accessible name of the trigger, e.g. "Availability" */
  name: string;
  value: TValue;
  options: PanelSelectOption<TValue>[];
  /** The section the menu lines up beside */
  sectionRef: React.RefObject<HTMLElement | null>;
  className?: string;
  onValueChange: (value: TValue) => void;
}) {
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(false);
  const [sideOffset, setSideOffset] = React.useState(PANEL_MENU_GAP);
  /** Choice hovered or highlighted in the open menu */
  const [preview, setPreview] = React.useState<TValue | null>(null);

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (next) {
        setSideOffset(getPanelMenuSideOffset(triggerRef, sectionRef));
      }
      if (!next) {
        setPreview(null);
      }
      setOpen(next);
    },
    [sectionRef],
  );

  const shown = options.find((o) => o.value === (preview ?? value));
  const current = options.find((o) => o.value === value);

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
            "group/trigger text-foreground flex h-8 min-w-0 items-center justify-between gap-2 px-2 text-left text-xs outline-none",
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
                  selected && preview === null && PANEL_MENU_ITEM_CURRENT_CLASS,
                )}
                onClick={() => {
                  if (option.value !== value) onValueChange(option.value);
                }}
                onMouseEnter={() => setPreview(option.value)}
                onFocus={() => setPreview(option.value)}
              >
                <span className="flex w-3.5 shrink-0 items-center justify-center">
                  {selected && <Check className="size-3.5 !text-current" />}
                </span>
                <span className="ml-2 truncate">{option.label}</span>
                <HelpIcon
                  option={option}
                  visible={selected && preview === null}
                />
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
    (status: "busy" | "free") => {
      onEventChange?.({ ...event, status });
    },
    [event, onEventChange],
  );

  const handleVisibilityChange = React.useCallback(
    (visibility: "default" | "public" | "private") => {
      onEventChange?.({ ...event, visibility });
    },
    [event, onEventChange],
  );

  return (
    <EventDetailSection ref={sectionRef} name="availability">
      <div className="flex items-center gap-[5px] pr-2 pl-9">
        <PanelSelect
          name="Availability"
          value={event.status ?? "busy"}
          options={AVAILABILITY_OPTIONS}
          sectionRef={sectionRef}
          className="w-[102px] shrink-0"
          onValueChange={handleStatusChange}
        />
        <PanelSelect
          name="Visibility"
          value={event.visibility ?? "default"}
          options={VISIBILITY_OPTIONS}
          sectionRef={sectionRef}
          className="flex-1"
          onValueChange={handleVisibilityChange}
        />
      </div>
    </EventDetailSection>
  );
}
