"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";

import { cn } from "@/lib/utils";
import {
  EVENT_DETAIL_MENU_CLASS,
  EVENT_DETAIL_MENU_SECONDARY_CLASS,
  EVENT_DETAIL_MENU_TEXT_CLASS,
  getEventDetailPortalContainer,
} from "./event-detail-parts";

/** Gap between the suggestions and the field they belong to (Notion: 13px) */
const SUGGESTIONS_GAP = 13;

/** Closest the suggestions get to the viewport's edges */
const VIEWPORT_MARGIN = 8;

/** `EVENT_DETAIL_PLACEHOLDER_CLASS`'s colors on an input's placeholder */
export const EVENT_DETAIL_INPUT_PLACEHOLDER_CLASS =
  "placeholder:text-[#ABABA9] dark:placeholder:text-[#595959]";

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
  /**
   * Option under the others, after a separator (e.g. "View rooms and
   * resources"); the field counts it after them
   */
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
 * drives it as a combobox (`aria-activedescendant`), the footer's option
 * included; the list is a portal in the details' React tree, so the details
 * popover counts presses on it as inside. Rendered only while open.
 */
export function EventDetailSuggestions({
  id,
  label,
  anchorRef,
  width,
  children,
  footer,
}: EventDetailSuggestionsProps) {
  /** Marks the viewport's top-left corner as the list's `fixed` frame sees it */
  const originRef = React.useRef<HTMLSpanElement>(null);
  const [container, setContainer] = React.useState<HTMLElement | null>(null);
  const [position, setPosition] = React.useState<SuggestionsPosition | null>(
    null,
  );

  React.useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (anchor) setContainer(getEventDetailPortalContainer(anchor));
  }, [anchorRef]);

  // Follow the field while the page scrolls or resizes
  React.useLayoutEffect(() => {
    if (!container) return;
    function update() {
      const anchor = anchorRef.current;
      const origin = originRef.current;
      if (!anchor || !origin) return;
      // A transformed dialog moves `fixed` boxes along with it
      const offset = origin.getBoundingClientRect();
      const next = getSuggestionsPosition(
        anchor.getBoundingClientRect(),
        width,
      );
      setPosition({
        top: next.top - offset.top,
        left: next.left - offset.left,
      });
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, container, width]);

  if (!container) return null;

  return ReactDOM.createPortal(
    <>
      <span
        ref={originRef}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 size-0"
      />
      {position && (
        <div
          id={id}
          role="listbox"
          aria-label={label}
          data-slot="event-detail-suggestions"
          className={cn(
            "fixed z-[9999] overflow-hidden rounded-lg border p-1.5 text-sm font-medium shadow-md",
            EVENT_DETAIL_MENU_CLASS,
          )}
          style={{ top: position.top, left: position.left, width }}
          // Presses keep focus in the field
          onMouseDown={(e) => e.preventDefault()}
        >
          {children}
          {footer && (
            <>
              <div
                role="none"
                className="-mx-1.5 my-1.5 border-t border-[#303030]"
              />
              {footer}
            </>
          )}
        </div>
      )}
    </>,
    container,
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
