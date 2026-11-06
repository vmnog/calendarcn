"use client";

import * as React from "react";

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

/**
 * Props for EventDetailSection
 */
interface EventDetailSectionProps extends React.ComponentProps<"div"> {
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
}: EventDetailSectionProps) {
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
