"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { FIELD_POPOVER_ATTRIBUTE } from "@/hooks/use-field-popover";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  EVENT_DETAIL_INPUT_GROUP_CLASS,
  EVENT_DETAIL_MENU_CLASS,
} from "./event-detail-parts";
import type { EventDetailFieldPopoverProps } from "./week-view-types";

/**
 * Gap between the panel's left edge and the time menu or date picker, which
 * open beside the panel, top-aligned with their field (Notion: 6px)
 */
const POPOVER_PANEL_GAP = 6;

/** Marks the popover for `useFieldPopover`, whose focus goes back to the field */
const FIELD_POPOVER_DATA = { [FIELD_POPOVER_ATTRIBUTE]: "" };

/**
 * The time menu and the date picker: dark in both themes like the panel's
 * other menus, and shown at once, without the enter or exit animation of
 * Radix (`data-state`) or Base UI (`data-open`, `data-closed`)
 */
const FIELD_POPOVER_CLASS = cn(
  EVENT_DETAIL_MENU_CLASS,
  "rounded-[10px] border p-0 text-sm font-medium text-white shadow-[0_8px_24px_rgb(0_0_0/0.24)] ring-0 outline-none",
  "data-[state=open]:animate-none data-[state=closed]:animate-none data-open:animate-none data-closed:animate-none",
);

/** A field's box: 31px tall in its 35px row, bordered on hover, filled on focus */
export const EVENT_DETAIL_FIELD_BOX_CLASS = cn(
  "relative flex h-[31px] min-w-0 items-center",
  EVENT_DETAIL_INPUT_GROUP_CLASS,
);

/**
 * Distance from a field's box to the panel's left edge plus the gap, the
 * side offset that opens its popover beside the panel
 */
function getPopoverOffset(
  box: HTMLElement | null,
  panel: HTMLElement | null,
): number {
  if (!box || !panel) return POPOVER_PANEL_GAP;
  return (
    box.getBoundingClientRect().left -
    panel.getBoundingClientRect().left +
    POPOVER_PANEL_GAP
  );
}

/**
 * A field's box, and its menu or picker in the shadcn/ui Popover, opened
 * left of the panel and top-aligned with the box, as in Notion Calendar.
 * The input keeps focus while it's open: the popover moves focus into itself
 * as it opens (Radix and Base UI both do), and hands it straight back, and
 * presses inside it never take focus. The trigger is a disabled, hidden
 * button over the box, there only to place the popover, so closing never
 * returns focus to it. The field opens and closes the popover itself, on
 * focus, blur, Enter and Escape (`useFieldPopover`).
 */
export function EventDetailFieldPopover({
  open,
  panelRef,
  boxClassName,
  onBoxClick,
  onBoxPointerDown,
  field,
  inputRef,
  onReturnFocus,
  className,
  children,
}: EventDetailFieldPopoverProps) {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [sideOffset, setSideOffset] = React.useState(POPOVER_PANEL_GAP);

  // Measured as it opens, before it's painted
  React.useLayoutEffect(() => {
    if (!open) return;
    setSideOffset(getPopoverOffset(boxRef.current, panelRef.current));
  }, [open, panelRef]);

  const handleFocusCapture = () => {
    const input = inputRef.current;
    if (!input || document.activeElement === input) return;
    onReturnFocus();
    input.focus({ preventScroll: true });
  };

  return (
    <Popover open={open}>
      <div
        ref={boxRef}
        className={boxClassName}
        onClick={onBoxClick}
        onPointerDown={onBoxPointerDown}
      >
        <PopoverTrigger asChild disabled>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className="pointer-events-none absolute -inset-px opacity-0"
          />
        </PopoverTrigger>
        {field}
      </div>
      <PopoverContent
        side="left"
        align="start"
        sideOffset={sideOffset}
        {...FIELD_POPOVER_DATA}
        onFocusCapture={handleFocusCapture}
        onMouseDown={(e) => e.preventDefault()}
        className={cn(FIELD_POPOVER_CLASS, className)}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
