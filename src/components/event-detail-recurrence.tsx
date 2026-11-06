"use client";

import { format, setDay } from "date-fns";
import type { Locale } from "date-fns";
import { ChevronLeft, ChevronRight, RefreshCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCalendarConfig } from "./calendar-provider";
import {
  EVENT_DETAIL_MUTED_CLASS,
  EventDetailPlaceholderRow,
  EventDetailRow,
  EventDetailSection,
} from "./event-detail-parts";
import type {
  DetailedCalendarEvent,
  EventDetailSectionProps,
  RecurrenceRule,
  RecurrenceWeekday,
} from "./week-view-types";

/** Monday to Friday, the days an "Every weekday" rule falls on */
const WEEKDAYS: RecurrenceWeekday[] = [1, 2, 3, 4, 5];

/** Position of a weekday in its month, as "Every month on the first Thu" reads */
const WEEK_OF_MONTH_NAMES = ["first", "second", "third", "fourth", "last"];

/** "day", "week", ... for each frequency */
const FREQUENCY_UNITS: Record<RecurrenceRule["frequency"], string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  yearly: "year",
};

/** "Every week" or "Every 2 weeks" */
function formatEvery(rule: RecurrenceRule): string {
  const interval = rule.interval ?? 1;
  const unit = FREQUENCY_UNITS[rule.frequency];
  if (interval === 1) return `Every ${unit}`;
  return `Every ${interval} ${unit}s`;
}

/** ", until Dec 31" or ", 5 times" */
function formatEnd(rule: RecurrenceRule, locale: Locale): string {
  if (!rule.end || rule.end.type === "never") return "";
  if (rule.end.type === "on") {
    return `, until ${format(rule.end.date, "MMM d", { locale })}`;
  }
  return `, ${rule.end.count} times`;
}

/**
 * Reads a repeat rule the way Notion Calendar shows it: "Every day",
 * "Every weekday", "Every 2 weeks on Mon, Thu", "Every month on the first
 * Thu", "Every year on Nov 6"
 */
export function formatRecurrenceRule(
  rule: RecurrenceRule,
  start: Date,
  locale: Locale,
): string {
  const interval = rule.interval ?? 1;
  const end = formatEnd(rule, locale);

  if (rule.frequency === "weekly") {
    const weekdays = [
      ...(rule.weekdays ?? [start.getDay() as RecurrenceWeekday]),
    ].sort((a, b) => a - b);
    if (interval === 1 && weekdays.join() === WEEKDAYS.join()) {
      return `Every weekday${end}`;
    }
    const names = weekdays.map((day) =>
      format(setDay(start, day), "EEE", { locale }),
    );
    return `${formatEvery(rule)} on ${names.join(", ")}${end}`;
  }

  if (rule.frequency === "monthly") {
    if (rule.monthlyBy === "weekday-of-month") {
      const week = WEEK_OF_MONTH_NAMES[Math.ceil(start.getDate() / 7) - 1];
      const weekday = format(start, "EEE", { locale });
      return `${formatEvery(rule)} on the ${week} ${weekday}${end}`;
    }
    return `${formatEvery(rule)} on the ${format(start, "do", { locale })}${end}`;
  }

  if (rule.frequency === "yearly") {
    return `${formatEvery(rule)} on ${format(start, "MMM d", { locale })}${end}`;
  }

  return `${formatEvery(rule)}${end}`;
}

/** "Every week" in full color, " on Thu" muted */
function RecurrenceDisplay({ recurrence }: { recurrence: string }) {
  const onIdx = recurrence.indexOf(" on ");
  if (onIdx === -1) {
    return <span className="text-foreground">{recurrence}</span>;
  }

  const main = recurrence.substring(0, onIdx);
  const suffix = recurrence.substring(onIdx);

  return (
    <span>
      <span className="text-foreground">{main}</span>
      <span className={EVENT_DETAIL_MUTED_CLASS}>{suffix}</span>
    </span>
  );
}

/**
 * Props for EventDetailRecurrence
 */
interface EventDetailRecurrenceProps<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
> extends EventDetailSectionProps<TEvent> {
  /** Shows the previous event of the series */
  onPrevious?: () => void;
  /** Shows the next event of the series */
  onNext?: () => void;
}

/**
 * The repeat rule with previous/next buttons for the series, or a muted
 * "Repeat" when the event doesn't repeat
 */
export function EventDetailRecurrence<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event, onPrevious, onNext }: EventDetailRecurrenceProps<TEvent>) {
  const { locale } = useCalendarConfig();
  const recurrence = event.recurrenceRule
    ? formatRecurrenceRule(event.recurrenceRule, event.start, locale)
    : event.recurrence;

  if (!recurrence) {
    return (
      <EventDetailSection name="recurrence">
        <EventDetailPlaceholderRow icon={RefreshCcw} label="Repeat" />
      </EventDetailSection>
    );
  }

  const navButtonClass = cn("size-6", EVENT_DETAIL_MUTED_CLASS);

  return (
    <EventDetailSection name="recurrence">
      <EventDetailRow
        icon={RefreshCcw}
        actions={
          <>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous in series"
              className={navButtonClass}
              onClick={onPrevious}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next in series"
              className={navButtonClass}
              onClick={onNext}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </>
        }
      >
        <RecurrenceDisplay recurrence={recurrence} />
      </EventDetailRow>
    </EventDetailSection>
  );
}
