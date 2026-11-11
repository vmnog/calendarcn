"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";

import { cn } from "@/lib/utils";

/** Main text: values, the title, the header's kind (Notion: #D4D4D4 dark) */
export const EVENT_DETAIL_TEXT_CLASS = "text-[#32302C] dark:text-[#D4D4D4]";

/** Secondary text: a duration, an offset ("GMT-3"), a rule's " on Thu", "before" */
export const EVENT_DETAIL_SECONDARY_CLASS =
  "text-[#787774] dark:text-[#7F7F7F]";

/** Muted icons: a row's leading icon, the arrow between times, chevrons */
export const EVENT_DETAIL_MUTED_CLASS = "text-[#C7C5C1] dark:text-[#595959]";

/** Placeholder text of an empty field ("Location", "Description") */
export const EVENT_DETAIL_PLACEHOLDER_CLASS =
  "text-[#ABABA9] dark:text-[#595959]";

/** Height of one row of the panel (Notion: 35px, at 14px medium text) */
export const EVENT_DETAIL_ROW_HEIGHT_CLASS = "min-h-[35px]";

/** Size and color of a row's leading icon */
export const EVENT_DETAIL_ICON_CLASS = cn(
  "size-4 shrink-0",
  EVENT_DETAIL_MUTED_CLASS,
);

/** Border that shows on hover, for dropdown triggers and clickable rows */
export const EVENT_DETAIL_HOVER_BORDER_CLASS =
  "rounded-sm border border-transparent hover:border-[#E8E8E4] dark:hover:border-[#373737]";

/** A standalone inline-editable input (the title): hover border, filled on focus */
export const EVENT_DETAIL_INPUT_CLASS = cn(
  EVENT_DETAIL_HOVER_BORDER_CLASS,
  "bg-transparent outline-none focus:border-[#F5F5F5] focus:bg-[#F5F5F5] dark:focus:border-[#242424] dark:focus:bg-[#242424]",
);

/**
 * Wrapper of a grouped inline-editable input (icon + input, or arrow +
 * input + label): it draws the border and fill, the input inside gets
 * `EVENT_DETAIL_GROUPED_INPUT_CLASS`
 */
export const EVENT_DETAIL_INPUT_GROUP_CLASS = cn(
  EVENT_DETAIL_HOVER_BORDER_CLASS,
  "cursor-text has-[:focus]:border-[#F5F5F5] has-[:focus]:bg-[#F5F5F5] dark:has-[:focus]:border-[#242424] dark:has-[:focus]:bg-[#242424]",
);

/** The input inside an `EVENT_DETAIL_INPUT_GROUP_CLASS` wrapper */
export const EVENT_DETAIL_GROUPED_INPUT_CLASS =
  "border-none bg-transparent p-0 outline-none";

/** An icon button (the "..." menu): its hover border blends into its fill */
export const EVENT_DETAIL_ICON_BUTTON_CLASS =
  "border border-transparent hover:border-[#F5F5F5] hover:bg-[#F5F5F5] dark:hover:border-[#242424] dark:hover:bg-[#242424]";

/** Menu surface: menus are dark in both themes */
export const EVENT_DETAIL_MENU_CLASS = "bg-[#252525] border-[#303030]";

/** A menu item on `EVENT_DETAIL_MENU_CLASS` */
export const EVENT_DETAIL_MENU_ITEM_CLASS =
  "text-xs text-white focus:!bg-[#303030] focus:!text-white";

/** "Soon" badge of a menu item that isn't built yet, on `EVENT_DETAIL_MENU_CLASS` */
export const EVENT_DETAIL_MENU_SOON_CLASS =
  "ml-auto rounded bg-white/10 px-1.5 py-0.5 text-[10px] leading-none font-medium text-white/60";

/** Main text of a menu item */
export const EVENT_DETAIL_MENU_TEXT_CLASS = "text-[#E0E0E0]";

/** Secondary text in a menu: an email under a name, an address, a hint */
export const EVENT_DETAIL_MENU_SECONDARY_CLASS = "text-[#8B8B8B]";

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

/** A row's 32px box, from 8px off the panel's edges, with the icon column at 26px */
export const ROW_BOX_CLASS =
  "flex h-8 min-w-0 flex-1 items-center gap-[11px] pr-2 pl-[9px]";

/**
 * Link text in the details panel: a faint underline that takes the text
 * color on hover, as Notion's links do
 */
export const EVENT_DETAIL_LINK_CLASS =
  "underline decoration-[#EEEEEE] decoration-1 underline-offset-2 hover:decoration-current dark:decoration-[#242424]";

/** Gap in px between a menu opened from the panel and the panel's left edge */
const PANEL_MENU_GAP = 4;

/** Gap in px between a tooltip and the element it describes */
const TOOLTIP_GAP = 12;

/**
 * Containers a floating layer of the details mounts in: a dialog, sheet or
 * drawer, but not the details popover (also a dialog), which is transformed
 * and would clip and misplace a layer beside it
 */
const PORTAL_CONTAINER_SELECTOR =
  '[role="dialog"]:not([data-calendar-popover]), [role="alertdialog"]';

/**
 * Keydown handler for a panel menu whose library closes it on Escape: the
 * key stops there, instead of also reaching the calendar's shortcut that
 * deselects the event
 */
export function stopEscapePropagation(e: React.KeyboardEvent) {
  if (e.key === "Escape") e.stopPropagation();
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
 * Where a floating layer opened from the details (a suggestion list, a
 * menu) mounts: inside the dialog, sheet or drawer that holds `node`, since
 * a modal dialog turns off pointer events on the rest of the page, else the
 * body. The same rule the details popover follows for itself.
 */
export function getEventDetailPortalContainer(
  node: Element | null | undefined,
): HTMLElement {
  return node?.closest<HTMLElement>(PORTAL_CONTAINER_SELECTOR) ?? document.body;
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

/**
 * Props for EventDetailSection (the container; a section's own props are
 * `EventDetailSectionProps` from `week-view-types`)
 */
interface EventDetailSectionContainerProps extends React.ComponentProps<"div"> {
  /** Names the section in `data-section`, e.g. "time" or "location" */
  name: string;
}

/**
 * One section of the details panel. Sections stack their rows; the panel
 * draws the dividers between groups of sections.
 */
export function EventDetailSection({
  name,
  className,
  ...props
}: EventDetailSectionContainerProps) {
  return (
    <div
      data-section={name}
      className={cn("flex flex-col", className)}
      {...props}
    />
  );
}

/**
 * Line between groups of sections, edge to edge
 */
export function EventDetailDivider({ className }: { className?: string }) {
  return (
    <div
      role="separator"
      className={cn(
        "border-t border-[#EEEEEE] dark:border-[#262626]",
        className,
      )}
    />
  );
}

/**
 * Props for EventDetailGroup
 */
interface EventDetailGroupProps extends React.ComponentProps<"div"> {
  /** Names the group in `data-group`, e.g. "when" or "calendar" */
  name: string;
}

/**
 * Sections between two dividers, with Notion's 8px above the first row and
 * below the last
 */
export function EventDetailGroup({
  name,
  className,
  ...props
}: EventDetailGroupProps) {
  return (
    <div
      data-group={name}
      className={cn("flex flex-col py-2", className)}
      {...props}
    />
  );
}

/**
 * Props for EventDetailRow
 */
interface EventDetailRowProps extends Omit<
  React.ComponentProps<"div">,
  "children"
> {
  /** Leading icon, drawn muted in the icon column. Leave out to indent only */
  icon?: React.ComponentType<{ className?: string }>;
  /** Replaces `icon` with any element (a switch, a color swatch) */
  leading?: React.ReactNode;
  /** Controls at the end of the row, e.g. previous/next buttons */
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * A row with the icon column: a 16px icon (or `leading`) centered 26px from
 * the panel's left edge, the content from 45px, and optional `actions` at
 * the end. Every row of the panel lines its content up on the same column.
 * Text size and weight come from the panel (14px medium).
 */
export function EventDetailRow({
  icon: Icon,
  leading,
  actions,
  className,
  children,
  ...props
}: EventDetailRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-[11px] pr-4 pl-[18px]",
        EVENT_DETAIL_ROW_HEIGHT_CLASS,
        className,
      )}
      {...props}
    >
      <span className="flex w-4 shrink-0 items-center justify-center">
        {leading ?? (Icon && <Icon className={EVENT_DETAIL_ICON_CLASS} />)}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">{children}</div>
      {actions && <div className="flex shrink-0 items-center">{actions}</div>}
    </div>
  );
}

/**
 * Props for EventDetailPlaceholderRow
 */
interface EventDetailPlaceholderRowProps {
  /** Muted leading icon */
  icon?: React.ComponentType<{ className?: string }>;
  /** Muted label, e.g. "Location" */
  label: string;
  /** Called when the row is clicked; the row is a button when set */
  onClick?: () => void;
  className?: string;
}

/**
 * Notion's empty field: muted icon and placeholder label. A section shows it
 * until its field is set.
 */
export function EventDetailPlaceholderRow({
  icon,
  label,
  onClick,
  className,
}: EventDetailPlaceholderRowProps) {
  const content = (
    <span className={EVENT_DETAIL_PLACEHOLDER_CLASS}>{label}</span>
  );

  if (!onClick) {
    return (
      <EventDetailRow icon={icon} className={className}>
        {content}
      </EventDetailRow>
    );
  }

  return (
    <EventDetailRow icon={icon} className={className}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "-mx-2 px-2 py-1.5 text-left",
          EVENT_DETAIL_HOVER_BORDER_CLASS,
        )}
      >
        {content}
      </button>
    </EventDetailRow>
  );
}
