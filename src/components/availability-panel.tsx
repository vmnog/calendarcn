"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  ArrowRight,
  Check,
  Clock,
  Contrast,
  Copy,
  Globe,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useNow } from "@/hooks/use-now";
import { useCalendarConfig } from "@/components/calendar-provider";
import {
  EVENT_DETAIL_HOVER_BORDER_CLASS,
  EVENT_DETAIL_ICON_BUTTON_CLASS,
  EVENT_DETAIL_MENU_CLASS,
  EVENT_DETAIL_MUTED_CLASS,
  EVENT_DETAIL_PLACEHOLDER_CLASS,
  EVENT_DETAIL_SECONDARY_CLASS,
  EVENT_DETAIL_TEXT_CLASS,
  PANEL_MENU_ITEM_CLASS,
  PANEL_MENU_SURFACE_CLASS,
  EventDetailDivider,
  EventDetailRow,
} from "@/components/event-detail-parts";
import { useScheduling } from "@/components/scheduling-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarContent, SidebarHeader } from "@/components/ui/sidebar";
import {
  AVAILABILITY_DURATIONS,
  formatMeetingDuration,
  getRangeMinutes,
} from "@/lib/availability";
import { formatTimeOfDayLabel } from "@/lib/event-utils";
import { formatDuration } from "@/lib/time-input";
import { getTimeZoneDisplayName } from "@/lib/timezone-label";
import type { AvailabilityRange } from "@/components/calendar-types";
import type { AvailabilityHintProps } from "@/components/week-view-types";

/** Notion Calendar's hint while open times are marked, at the bottom of the calendar */
export const AVAILABILITY_HINT = "Mark available times on your calendar";

/** The panel's main button: Notion Calendar's blue "Create" */
const PRIMARY_BUTTON_CLASS =
  "h-7 bg-[#2383E2] px-2.5 text-xs text-white hover:bg-[#0077D4]";

/** The panel's "Cancel", outlined like Notion Calendar's */
const CANCEL_BUTTON_CLASS =
  "h-7 border border-[#E8E8E4] bg-transparent px-2.5 text-xs dark:border-[#373737]";

/** A section's heading ("Snippet", "Times") */
const SECTION_HEADING_CLASS = cn(
  "flex h-8 items-center justify-between pr-2 pl-4 text-xs font-semibold",
  EVENT_DETAIL_TEXT_CLASS,
);

/** The pill's dark surface, like the toasts and menus in both themes */
const HINT_CLASS =
  "pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-transparent bg-[#252525] py-1.5 pr-1.5 pl-3.5 text-xs text-[#F0F0F0] shadow-lg dark:border-[#303030]";

/** A button inside the pill */
const HINT_BUTTON_CLASS =
  "rounded-full px-2.5 py-1 font-medium outline-none hover:bg-white/10 focus-visible:ring-1 focus-visible:ring-white/50 disabled:opacity-40";

/** "1 time marked", "3 times marked" */
function describeMarkedTimes(count: number): string {
  return count === 1 ? "1 time marked" : `${count} times marked`;
}

/**
 * The meeting length the copied text asks for: "30 min duration", a menu
 * of lengths on click
 */
function AvailabilityDurationRow() {
  const scheduling = useScheduling();
  if (!scheduling) return null;
  const { durationMinutes, setDurationMinutes } = scheduling;

  return (
    <EventDetailRow icon={Contrast}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Duration: ${formatMeetingDuration(durationMinutes)}`}
            className={cn(
              "-mx-2 flex items-center gap-1 px-2 py-1 text-sm font-medium",
              EVENT_DETAIL_HOVER_BORDER_CLASS,
              EVENT_DETAIL_TEXT_CLASS,
            )}
          >
            {formatMeetingDuration(durationMinutes)}
            <span className={cn("font-normal", EVENT_DETAIL_SECONDARY_CLASS)}>
              duration
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className={cn(
            "w-44",
            EVENT_DETAIL_MENU_CLASS,
            PANEL_MENU_SURFACE_CLASS,
          )}
        >
          {AVAILABILITY_DURATIONS.map((minutes) => (
            <DropdownMenuItem
              key={minutes}
              className={PANEL_MENU_ITEM_CLASS}
              onClick={() => setDurationMinutes(minutes)}
            >
              <span className="flex w-5 shrink-0 items-center">
                {minutes === durationMinutes && <Check className="size-3.5" />}
              </span>
              {formatMeetingDuration(minutes)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </EventDetailRow>
  );
}

/** Props of one marked time in the panel's list (only used in this file) */
interface AvailabilityRangeCardProps {
  range: AvailabilityRange;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

/**
 * One marked time, as Notion Calendar lists them under "Times": "Range",
 * the start and end with the length ("11 AM → 1 PM 2h"), and the day
 */
function AvailabilityRangeCard({
  range,
  isSelected,
  onSelect,
  onRemove,
}: AvailabilityRangeCardProps) {
  const { hourCycle, locale } = useCalendarConfig();
  const { startMinutes, endMinutes } = getRangeMinutes(range);
  const start = formatTimeOfDayLabel(startMinutes, hourCycle, locale);
  const end = formatTimeOfDayLabel(endMinutes, hourCycle, locale);

  return (
    <li
      data-testid="availability-range-card"
      data-selected={isSelected || undefined}
      className={cn(
        "group/card flex flex-col py-1.5",
        isSelected && "bg-[#F5F5F5] dark:bg-[#252525]",
      )}
      onClick={onSelect}
    >
      <div className={cn(SECTION_HEADING_CLASS, "h-7")}>
        Range
        <button
          type="button"
          aria-label={`Remove ${start} to ${end}`}
          className={cn(
            "flex size-6 items-center justify-center rounded-sm opacity-0 transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100",
            EVENT_DETAIL_ICON_BUTTON_CLASS,
            EVENT_DETAIL_MUTED_CLASS,
            isSelected && "opacity-100",
          )}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="size-3.5" />
        </button>
      </div>
      <EventDetailRow icon={Clock} className="min-h-7">
        <span className={EVENT_DETAIL_TEXT_CLASS}>{start}</span>
        <ArrowRight className={cn("mx-2 size-3.5", EVENT_DETAIL_MUTED_CLASS)} />
        <span className={EVENT_DETAIL_TEXT_CLASS}>{end}</span>
        <span className={EVENT_DETAIL_SECONDARY_CLASS}>
          {formatDuration(range.start, range.end)}
        </span>
      </EventDetailRow>
      <EventDetailRow className="min-h-7">
        <span className={EVENT_DETAIL_TEXT_CLASS}>
          {format(range.start, "EEE MMM d", { locale })}
        </span>
      </EventDetailRow>
    </li>
  );
}

/**
 * Notion Calendar's scheduling panel, in the context panel while open
 * times are marked: the meeting length, the snippet that "Copy" puts on the
 * clipboard with its time zone, and the marked times. Cancel (or Escape)
 * leaves without changes; "Copy" copies the snippet and leaves, and the
 * snippet's copy button copies it without leaving. For a one-off scheduling
 * link, "Create" hands the times to the app instead. Renders nothing outside
 * a `SchedulingProvider` or while no times are being marked.
 */
export function AvailabilityPanel() {
  const scheduling = useScheduling();
  // `null` on the server and during hydration
  const now = useNow();
  if (!scheduling?.isPicking) return null;

  const {
    purpose,
    ranges,
    text,
    selectedRangeId,
    cancelPicking,
    copyText,
    copyAndFinish,
    finishSchedulingLink,
    removeRange,
    selectRange,
  } = scheduling;
  const isLink = purpose === "one-off-link";
  const hasRanges = ranges.length > 0;

  return (
    <div
      data-testid="availability-panel"
      className="flex min-h-0 flex-1 flex-col"
    >
      <SidebarHeader className="h-14 justify-center px-4">
        <div className="flex items-center gap-2">
          <h2
            className={cn(
              "min-w-0 flex-1 truncate text-sm font-medium",
              EVENT_DETAIL_TEXT_CLASS,
            )}
          >
            {isLink ? "One-off link" : "Share availability"}
          </h2>
          <Button
            variant="ghost"
            className={CANCEL_BUTTON_CLASS}
            onClick={cancelPicking}
          >
            Cancel
          </Button>
          {hasRanges && (
            <Button
              className={PRIMARY_BUTTON_CLASS}
              onClick={
                isLink ? finishSchedulingLink : () => void copyAndFinish()
              }
            >
              {isLink ? "Create" : "Copy"}
            </Button>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-0 pb-8 text-sm">
        <div className="py-2">
          <AvailabilityDurationRow />
        </div>
        <EventDetailDivider />
        <section
          aria-labelledby="availability-snippet-heading"
          className="py-2"
        >
          <div className={SECTION_HEADING_CLASS}>
            <h3 id="availability-snippet-heading">Snippet</h3>
            <button
              type="button"
              aria-label="Copy snippet"
              disabled={!hasRanges}
              className={cn(
                "flex size-6 items-center justify-center rounded-sm disabled:opacity-40",
                EVENT_DETAIL_ICON_BUTTON_CLASS,
                EVENT_DETAIL_MUTED_CLASS,
              )}
              onClick={() => void copyText()}
            >
              <Copy className="size-3.5" />
            </button>
          </div>
          <p
            data-testid="availability-snippet"
            className={cn(
              "px-4 py-1 leading-5 whitespace-pre-wrap",
              hasRanges
                ? EVENT_DETAIL_TEXT_CLASS
                : EVENT_DETAIL_PLACEHOLDER_CLASS,
            )}
          >
            {hasRanges ? text : "No times marked"}
          </p>
          <EventDetailRow icon={Globe}>
            <span className={EVENT_DETAIL_SECONDARY_CLASS}>
              {now ? getTimeZoneDisplayName(now) : null}
            </span>
          </EventDetailRow>
        </section>
        <EventDetailDivider />
        <section aria-labelledby="availability-times-heading" className="py-2">
          <div className={SECTION_HEADING_CLASS}>
            <h3 id="availability-times-heading">Times</h3>
          </div>
          {hasRanges ? (
            <ul aria-label="Marked times" className="flex flex-col">
              {ranges.map((range) => (
                <AvailabilityRangeCard
                  key={range.id}
                  range={range}
                  isSelected={range.id === selectedRangeId}
                  onSelect={() => selectRange(range.id)}
                  onRemove={() => removeRange(range.id)}
                />
              ))}
            </ul>
          ) : (
            <p className={cn("px-4 py-1", EVENT_DETAIL_PLACEHOLDER_CLASS)}>
              Drag on the calendar to mark when you&apos;re free
            </p>
          )}
        </section>
      </SidebarContent>
    </div>
  );
}

/**
 * Notion Calendar's "Mark available times on your calendar" pill, at the
 * bottom of the calendar while open times are marked. With `showActions` it
 * also has Cancel and Copy (Create for a one-off link), for when the
 * scheduling panel isn't on screen. Render it in a positioned element
 * around the view; it renders nothing while no times are being marked.
 */
export function AvailabilityHint({
  showActions = false,
  className,
}: AvailabilityHintProps) {
  const scheduling = useScheduling();
  if (!scheduling?.isPicking) return null;

  const {
    purpose,
    ranges,
    cancelPicking,
    copyAndFinish,
    finishSchedulingLink,
  } = scheduling;
  const isLink = purpose === "one-off-link";
  const hasRanges = ranges.length > 0;
  const label =
    showActions && hasRanges
      ? describeMarkedTimes(ranges.length)
      : AVAILABILITY_HINT;

  return (
    <div
      data-testid="availability-hint"
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-4",
        className,
      )}
    >
      <div className={cn(HINT_CLASS, !showActions && "pr-3.5")}>
        <span className="truncate">{label}</span>
        {showActions && (
          <>
            <button
              type="button"
              className={cn(HINT_BUTTON_CLASS, "text-white/70")}
              onClick={cancelPicking}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!hasRanges}
              className={cn(
                HINT_BUTTON_CLASS,
                "bg-[#2383E2] hover:bg-[#0077D4]",
              )}
              onClick={
                isLink ? finishSchedulingLink : () => void copyAndFinish()
              }
            >
              {isLink ? "Create" : "Copy"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
