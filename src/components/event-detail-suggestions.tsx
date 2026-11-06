"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";

import { cn } from "@/lib/utils";
import { EVENT_DETAIL_MENU_CLASS } from "./event-detail-parts";

/** Gap between the suggestions and the field they belong to (Notion: 13px) */
const SUGGESTIONS_GAP = 13;

/** Closest the suggestions get to the viewport's edges */
const VIEWPORT_MARGIN = 8;

/** Secondary text in a menu: an email under a name, an address, a hint */
export const EVENT_DETAIL_MENU_SECONDARY_CLASS = "text-[#8B8B8B]";

/** Main text of a menu item */
export const EVENT_DETAIL_MENU_TEXT_CLASS = "text-[#E0E0E0]";

/**
 * Props for EventDetailSuggestions
 */
interface EventDetailSuggestionsProps {
  /** Id of the listbox, set as the field's `aria-controls` */
  id: string;
  /** Accessible name of the list, e.g. "Suggested participants" */
  label: string;
  /** The field's box: the list opens to its left, top-aligned */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Width in px (Notion: 330 for people, 292 for places) */
  width: number;
  /** Options (`EventDetailSuggestion`) */
  children: React.ReactNode;
  /** Row under the options, after a separator (e.g. "Rooms and resources") */
  footer?: React.ReactNode;
}

interface SuggestionsPosition {
  top: number;
  left: number;
}

/**
 * Places the list left of the field, top-aligned, as Notion does beside
 * its panel. Without room on the left (a narrow window, a popover near the
 * edge), it drops below the field instead.
 */
function getSuggestionsPosition(
  anchor: DOMRect,
  width: number,
): SuggestionsPosition {
  const left = anchor.left - SUGGESTIONS_GAP - width;
  if (left >= VIEWPORT_MARGIN) {
    return { top: anchor.top, left };
  }
  const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN;
  return {
    top: anchor.bottom + 4,
    left: Math.max(VIEWPORT_MARGIN, Math.min(anchor.left, maxLeft)),
  };
}

/**
 * The floating list a details field shows while it's focused (the
 * participants' contacts, the location's places). The field keeps focus and
 * drives it as a combobox (`aria-activedescendant`); the list is a portal in
 * the details' React tree, so the details popover counts presses on it as
 * inside. Rendered only while open.
 */
export function EventDetailSuggestions({
  id,
  label,
  anchorRef,
  width,
  children,
  footer,
}: EventDetailSuggestionsProps) {
  const [position, setPosition] = React.useState<SuggestionsPosition | null>(
    null,
  );

  // Follow the field while the page scrolls or resizes
  React.useLayoutEffect(() => {
    function update() {
      const anchor = anchorRef.current;
      if (!anchor) return;
      setPosition(
        getSuggestionsPosition(anchor.getBoundingClientRect(), width),
      );
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, width]);

  if (!position) return null;

  return ReactDOM.createPortal(
    <div
      data-slot="event-detail-suggestions"
      className={cn(
        "fixed z-[9999] overflow-hidden rounded-lg border p-1.5 text-sm font-medium shadow-md",
        EVENT_DETAIL_MENU_CLASS,
      )}
      style={{ top: position.top, left: position.left, width }}
      // Presses keep focus in the field
      onMouseDown={(e) => e.preventDefault()}
    >
      <div id={id} role="listbox" aria-label={label}>
        {children}
      </div>
      {footer && (
        <>
          <div className="-mx-1.5 my-1.5 border-t border-[#303030]" />
          {footer}
        </>
      )}
    </div>,
    document.body,
  );
}

/**
 * Props for EventDetailSuggestion
 */
interface EventDetailSuggestionProps {
  /** Element id, the field's `aria-activedescendant` while active */
  id: string;
  /** Whether the keyboard or pointer is on it */
  active: boolean;
  /** Called when the pointer moves onto it */
  onActivate: () => void;
  /** Picks it */
  onSelect: () => void;
  /** Text and icons */
  children: React.ReactNode;
  className?: string;
}

/**
 * One option of `EventDetailSuggestions`: 31px tall (taller with a second
 * line), with the #303030 highlight inset in the list
 */
export function EventDetailSuggestion({
  id,
  active,
  onActivate,
  onSelect,
  children,
  className,
}: EventDetailSuggestionProps) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      className={cn(
        "flex min-h-[31px] cursor-default items-center gap-2 rounded-md px-2 py-1",
        EVENT_DETAIL_MENU_TEXT_CLASS,
        active && "bg-[#303030] text-white",
        className,
      )}
      onMouseMove={active ? undefined : onActivate}
      onClick={onSelect}
    >
      {children}
    </div>
  );
}

/**
 * Props for HighlightedMatch
 */
interface HighlightedMatchProps {
  /** Text shown */
  text: string;
  /** What was typed; its first match in `text` stays bright */
  query: string;
}

/**
 * Text with the part that matches the query bright and the rest muted, as
 * Notion's suggestions show matches while typing. Without a query or a
 * match, the whole text keeps the item's color.
 */
export function HighlightedMatch({ text, query }: HighlightedMatchProps) {
  const trimmed = query.trim();
  const start = trimmed
    ? text.toLowerCase().indexOf(trimmed.toLowerCase())
    : -1;
  if (start === -1) {
    return <>{text}</>;
  }
  const end = start + trimmed.length;
  return (
    <>
      <span className={EVENT_DETAIL_MENU_SECONDARY_CLASS}>
        {text.slice(0, start)}
      </span>
      <span className="text-white">{text.slice(start, end)}</span>
      <span className={EVENT_DETAIL_MENU_SECONDARY_CLASS}>
        {text.slice(end)}
      </span>
    </>
  );
}

/**
 * Keyboard handling shared by the suggestion fields: arrows move the active
 * option (wrapping), Enter picks it. Returns whether the key was handled.
 */
export function handleSuggestionKey(
  e: React.KeyboardEvent<HTMLInputElement>,
  count: number,
  activeIndex: number,
  setActiveIndex: (index: number) => void,
  onPick: (index: number) => void,
): boolean {
  if (e.key === "ArrowDown" && count > 0) {
    e.preventDefault();
    setActiveIndex(activeIndex < 0 ? 0 : (activeIndex + 1) % count);
    return true;
  }
  if (e.key === "ArrowUp" && count > 0) {
    e.preventDefault();
    setActiveIndex(activeIndex <= 0 ? count - 1 : activeIndex - 1);
    return true;
  }
  if (e.key === "Enter" && activeIndex >= 0 && activeIndex < count) {
    e.preventDefault();
    onPick(activeIndex);
    return true;
  }
  return false;
}

/**
 * `onKeyDown` for a details menu's content: Escape closes only the menu.
 * The calendar's global Escape would also deselect the event, so the key
 * stops here, and the menu is closed through its `open` state, which works
 * whichever library's own Escape handling runs.
 */
export function closeMenuOnEscape(close: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    close();
  };
}
