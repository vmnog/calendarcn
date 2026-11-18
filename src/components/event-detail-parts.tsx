"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";

import { cn } from "@/lib/utils";

/** Main text: values, the title, the header's kind */
export const EVENT_DETAIL_TEXT_CLASS = "text-calendar-detail-foreground";

/** Secondary text: a duration, an offset ("GMT-3"), a rule's " on Thu", "before" */
export const EVENT_DETAIL_SECONDARY_CLASS = "text-calendar-detail-secondary";

/**
 * Fill of a checked radio and the details' main buttons, with the color of
 * what sits on it (`--calendar-selection` and its foreground)
 */
export const EVENT_DETAIL_ACCENT_BG_CLASS =
  "bg-calendar-selection text-calendar-selection-foreground";

/** Muted icons: a row's leading icon, the arrow between times, chevrons */
export const EVENT_DETAIL_MUTED_CLASS = "text-calendar-detail-muted";

/** Placeholder text of an empty field ("Location", "Description") */
export const EVENT_DETAIL_PLACEHOLDER_CLASS =
  "text-calendar-detail-placeholder";

/**
 * A small action in the details (remove, previous and next, a stepper's
 * arrows): the secondary color, a little softer on a light theme
 */
export const EVENT_DETAIL_ACTION_CLASS =
  "text-calendar-detail-secondary/80 dark:text-calendar-detail-secondary";

/** Height of one row of the panel (Notion: 35px, at 14px medium text) */
export const EVENT_DETAIL_ROW_HEIGHT_CLASS = "min-h-[35px]";

/** Size and color of a row's leading icon */
export const EVENT_DETAIL_ICON_CLASS = cn(
  "size-4 shrink-0",
  EVENT_DETAIL_MUTED_CLASS,
);

/** Border that shows on hover, for dropdown triggers and clickable rows */
export const EVENT_DETAIL_HOVER_BORDER_CLASS =
  "rounded-sm border border-transparent hover:border-calendar-detail-hover-border";

/** A standalone inline-editable input (the title): hover border, filled on focus */
export const EVENT_DETAIL_INPUT_CLASS = cn(
  EVENT_DETAIL_HOVER_BORDER_CLASS,
  "bg-transparent outline-none focus:border-calendar-detail-focus focus:bg-calendar-detail-focus",
);

/**
 * Wrapper of a grouped inline-editable input (icon + input, or arrow +
 * input + label): it draws the border and fill, the input inside gets
 * `EVENT_DETAIL_GROUPED_INPUT_CLASS`
 */
export const EVENT_DETAIL_INPUT_GROUP_CLASS = cn(
  EVENT_DETAIL_HOVER_BORDER_CLASS,
  "cursor-text has-[:focus]:border-calendar-detail-focus has-[:focus]:bg-calendar-detail-focus",
);

/** The input inside an `EVENT_DETAIL_INPUT_GROUP_CLASS` wrapper */
export const EVENT_DETAIL_GROUPED_INPUT_CLASS =
  "border-none bg-transparent p-0 outline-none";

/** An icon button (the "..." menu): its hover border blends into its fill */
export const EVENT_DETAIL_ICON_BUTTON_CLASS =
  "border border-transparent hover:border-calendar-detail-focus hover:bg-calendar-detail-focus";

/**
 * Menu surface (`--calendar-menu` and its border). It follows the app's
 * popover; the Notion Calendar theme makes it dark in both themes.
 */
export const EVENT_DETAIL_MENU_CLASS =
  "bg-calendar-menu border-calendar-menu-border";

/** A menu item on `EVENT_DETAIL_MENU_CLASS` */
export const EVENT_DETAIL_MENU_ITEM_CLASS =
  "text-xs text-calendar-menu-foreground focus:!bg-calendar-menu-accent focus:!text-calendar-menu-accent-foreground";

/** "Soon" badge of a menu item that isn't built yet, on `EVENT_DETAIL_MENU_CLASS` */
export const EVENT_DETAIL_MENU_SOON_CLASS =
  "ml-auto rounded bg-calendar-menu-foreground/10 px-1.5 py-0.5 text-[10px] leading-none font-medium text-calendar-menu-foreground/60";

/** A key hint at the end of a menu item ("⌘C"), and a menu's small labels */
export const EVENT_DETAIL_MENU_SHORTCUT_CLASS =
  "text-calendar-menu-foreground/40";

/** The delete item of a menu: the danger color, filled with it while highlighted */
export const EVENT_DETAIL_MENU_DANGER_CLASS =
  "text-calendar-danger focus:!bg-calendar-danger focus:!text-calendar-danger-foreground focus:[&>svg]:!text-calendar-danger-foreground";

/**
 * Keys of the event actions: shown beside them in the right-click menu and
 * the details' "..." menu (`label`), and given to assistive tech as
 * `aria-keyshortcuts` (`aria`). `useCalendarShortcuts` handles them.
 */
export const EVENT_ACTION_KEYS = {
  cut: { label: "⌘X", aria: "Meta+X Control+X" },
  copy: { label: "⌘C", aria: "Meta+C Control+C" },
  duplicate: { label: "⌘D", aria: "Meta+D Control+D" },
  delete: { label: "delete", aria: "Delete Backspace" },
} as const;

/** Main text of a menu item: the menu's foreground, a little softer */
export const EVENT_DETAIL_MENU_TEXT_CLASS = "text-calendar-menu-foreground/86";

/** Secondary text in a menu: an email under a name, an address, a hint */
export const EVENT_DETAIL_MENU_SECONDARY_CLASS =
  "text-calendar-menu-muted-foreground";

/** Surface of a menu opened from the bottom of the panel (with `EVENT_DETAIL_MENU_CLASS`) */
export const PANEL_MENU_SURFACE_CLASS = "rounded-lg p-1.5 shadow-lg";

/** An item of a `PANEL_MENU_SURFACE_CLASS` menu: 32px tall, highlight inset */
export const PANEL_MENU_ITEM_CLASS =
  "group/item h-8 gap-0 rounded-md px-2 py-0 text-xs text-calendar-menu-foreground/77 focus:!bg-calendar-menu-accent focus:!text-calendar-menu-accent-foreground/93";

/**
 * The current item of a `PANEL_MENU_SURFACE_CLASS` menu while nothing else
 * is highlighted: Notion opens its menus with the current value highlighted
 */
export const PANEL_MENU_ITEM_CURRENT_CLASS =
  "bg-calendar-menu-accent text-calendar-menu-accent-foreground/93";

/** A muted heading in a `PANEL_MENU_SURFACE_CLASS` menu (an account, "Event color") */
export const PANEL_MENU_LABEL_CLASS =
  "flex h-8 items-center pr-2 pl-[31px] text-xs text-calendar-menu-muted-foreground select-none";

/**
 * Surface of the details' dialogs (custom repeat, "This event / All
 * events"): the page's background in a light theme, the menus' in a dark one
 */
export const EVENT_DETAIL_DIALOG_CLASS =
  "border-calendar-detail-hover-border bg-background dark:border-calendar-menu-border dark:bg-calendar-menu";

/** An outlined button of those dialogs: Cancel, a day that isn't picked */
export const EVENT_DETAIL_DIALOG_BUTTON_CLASS =
  "border border-calendar-detail-hover-border text-foreground hover:bg-calendar-detail-focus dark:bg-calendar-menu-accent dark:hover:bg-calendar-menu-foreground/8";

/** A filled control of those dialogs at rest: a field while it's focused, a segmented control's track */
export const EVENT_DETAIL_DIALOG_FILL_CLASS =
  "bg-calendar-detail-focus dark:bg-calendar-menu-accent";

/** A panel dropdown trigger while its menu is open: filled, border blended in */
export const PANEL_TRIGGER_OPEN_CLASS =
  "border-calendar-detail-focus bg-calendar-detail-focus hover:border-calendar-detail-focus";

/** A row's 32px box, from 8px off the panel's edges, with the icon column at 26px */
export const ROW_BOX_CLASS =
  "flex h-8 min-w-0 flex-1 items-center gap-[11px] pr-2 pl-[9px]";

/**
 * Link text in the details panel: a faint underline that takes the text
 * color on hover, as Notion's links do. On a dark theme the divider color
 * is too strong for it, so it takes the focus fill's
 */
export const EVENT_DETAIL_LINK_CLASS =
  "underline decoration-calendar-detail-border decoration-1 underline-offset-2 hover:decoration-current dark:decoration-calendar-detail-focus";

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
      className="pointer-events-none fixed z-[100] w-max max-w-[232px] -translate-x-1/2 -translate-y-full rounded-md border border-transparent bg-calendar-menu px-2.5 py-1.5 text-xs leading-[18px] text-calendar-menu-foreground/93 shadow-md dark:border-calendar-menu-border"
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
      className={cn("border-t border-calendar-detail-border", className)}
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

/** A round radio, filled with the selection color and a dot when checked */
export function RadioDot({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full",
        checked
          ? EVENT_DETAIL_ACCENT_BG_CLASS
          : "border border-calendar-detail-hover-border bg-calendar-detail-focus dark:bg-calendar-menu-accent",
      )}
    >
      {checked && <span className="size-1.5 rounded-full bg-current" />}
    </span>
  );
}
