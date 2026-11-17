import { addDays, format, isSameDay, isSameYear, startOfDay } from "date-fns";
import type { Locale } from "date-fns";

import { getTimeZoneLabel } from "@/lib/timezone-label";
import type {
  AvailabilityRange,
  AvailabilityTextOptions,
  HourCycle,
} from "@/components/calendar-types";

/** Minutes in a full day: a range that ends at midnight ends at this minute */
const MINUTES_PER_DAY = 24 * 60;

/** Minutes in half a day: where AM turns into PM */
const MINUTES_PER_HALF_DAY = 12 * 60;

/** Meeting lengths the scheduling panel offers, in minutes */
export const AVAILABILITY_DURATIONS = [15, 30, 45, 60, 90, 120];

/** Meeting length the scheduling panel starts with, in minutes (Notion Calendar's) */
export const DEFAULT_AVAILABILITY_DURATION = 30;

/** How a day reads where a sentence or a line starts with it */
type DayPosition = "inline" | "line-start";

/**
 * Minutes after midnight on `range.start`'s day, by the clock, of the
 * range's start and end. An end at the next midnight is 1440.
 */
export function getRangeMinutes(range: Omit<AvailabilityRange, "id">): {
  startMinutes: number;
  endMinutes: number;
} {
  const startMinutes = range.start.getHours() * 60 + range.start.getMinutes();
  const endsNextDay = !isSameDay(range.start, range.end);
  const endMinutes = endsNextDay
    ? MINUTES_PER_DAY
    : range.end.getHours() * 60 + range.end.getMinutes();
  return { startMinutes, endMinutes };
}

/**
 * The time `minutes` after midnight on `day`, by the clock: 540 is 9:00 AM
 * even on a day the clocks change, and 1440 is the next midnight.
 */
export function atMinutesOfDay(day: Date, minutes: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes);
}

/**
 * Sorts marked times and merges the ones that overlap or touch on the same
 * day, so 9-10 AM and 10-11 AM read as 9-11 AM. A merged range keeps the id
 * of its earliest part. Empty ranges (end not after start) are dropped.
 */
export function mergeAvailabilityRanges(
  ranges: AvailabilityRange[],
): AvailabilityRange[] {
  const sorted = ranges
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: AvailabilityRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    const canMerge =
      last !== undefined &&
      isSameDay(last.start, range.start) &&
      range.start <= last.end;
    if (!canMerge) {
      merged.push({ ...range });
      continue;
    }
    if (range.end > last.end) last.end = range.end;
  }
  return merged;
}

/** The AM or PM `format(date, "a")` writes for a minute of the day, in `locale` */
function getDayPeriod(minutes: number, locale: Locale): string {
  const isMorning = minutes % MINUTES_PER_DAY < MINUTES_PER_HALF_DAY;
  return locale.localize.dayPeriod(isMorning ? "am" : "pm", {
    width: "abbreviated",
    context: "formatting",
  });
}

/**
 * A time of day without its period: "11", "5:30" on a 12-hour clock, "09:00"
 * or "17:30" on a 24-hour clock. 1440 (the next midnight) reads as midnight.
 */
function formatClockTime(minutes: number, hourCycle: HourCycle): string {
  const time = minutes % MINUTES_PER_DAY;
  const hour = Math.floor(time / 60);
  const minute = time % 60;
  const paddedMinute = String(minute).padStart(2, "0");
  if (hourCycle === 24) {
    return `${String(hour).padStart(2, "0")}:${paddedMinute}`;
  }
  const hourOnClock = hour % 12 === 0 ? 12 : hour % 12;
  if (minute === 0) return String(hourOnClock);
  return `${hourOnClock}:${paddedMinute}`;
}

/**
 * A marked time as Notion Calendar's scheduling text writes it. On a 12-hour
 * clock the period is written once when both ends share it ("2-3 PM",
 * "4-5:30 PM") and on each end otherwise ("11 AM - 1 PM"). On a 24-hour
 * clock: "11:00 - 13:00".
 */
export function formatAvailabilityTimeRange(
  range: Omit<AvailabilityRange, "id">,
  hourCycle: HourCycle,
  locale: Locale,
): string {
  const { startMinutes, endMinutes } = getRangeMinutes(range);
  const start = formatClockTime(startMinutes, hourCycle);
  const end = formatClockTime(endMinutes, hourCycle);
  if (hourCycle === 24) return `${start} - ${end}`;

  const startPeriod = getDayPeriod(startMinutes, locale);
  const endPeriod = getDayPeriod(endMinutes, locale);
  // 1440 is midnight at the end of the day: its AM is not the start's AM
  const sharesPeriod =
    startPeriod === endPeriod && endMinutes < MINUTES_PER_DAY;
  if (sharesPeriod) return `${start}-${end} ${endPeriod}`;
  return `${start} ${startPeriod} - ${end} ${endPeriod}`;
}

/**
 * A day as the scheduling text writes it: "Wed Nov 18", "Wed Jan 6, 2027" in
 * another year, with "today" or "tomorrow" in front when it is one ("Today"
 * at the start of a line).
 */
function formatAvailabilityDay(
  day: Date,
  now: Date,
  locale: Locale,
  position: DayPosition,
): string {
  const pattern = isSameYear(day, now) ? "EEE MMM d" : "EEE MMM d, yyyy";
  const date = format(day, pattern, { locale });
  const relative = isSameDay(day, now)
    ? "today"
    : isSameDay(day, addDays(now, 1))
      ? "tomorrow"
      : null;
  if (!relative) return date;
  const word =
    position === "line-start"
      ? relative[0].toUpperCase() + relative.slice(1)
      : relative;
  return `${word} ${date}`;
}

/** "a", "a or b", "a, b or c": the times of one day */
function joinWithOr(parts: string[]): string {
  if (parts.length < 2) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} or ${parts[parts.length - 1]}`;
}

/** A meeting length as the scheduling text says it: "30 min", "1 hour", "1 hour 30 min", "2 hours" */
export function formatMeetingDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourText = hours === 1 ? "1 hour" : `${hours} hours`;
  if (rest === 0) return hourText;
  return `${hourText} ${rest} min`;
}

/**
 * The text Notion Calendar's scheduling snippet copies, for the marked
 * times, in the runtime's time zone:
 *
 * - one time: "Would 30 min anytime tomorrow Wed Nov 18, 11 AM - 1 PM
 *   (GMT-3) work for you?"
 * - several times on one day: "Would 30 min during any of these times (all
 *   in GMT-3) tomorrow Wed Nov 18 work for you?", then a "- 11 AM - 1 PM"
 *   line for each
 * - several days: "Would 30 min during any of these times (all in GMT-3)
 *   work for you?", then a "- Tomorrow Wed Nov 18, 11 AM - 1 PM or 2-3 PM"
 *   line for each day
 *
 * With `link`, a blank line and "You can just let me know or confirm here:
 * <link>" follow. Touching or overlapping times are merged first. Returns an
 * empty string when no time is marked.
 */
export function formatAvailabilityText(
  ranges: AvailabilityRange[],
  {
    durationMinutes,
    hourCycle,
    locale,
    now = new Date(),
    link,
  }: AvailabilityTextOptions,
): string {
  const merged = mergeAvailabilityRanges(ranges);
  if (merged.length === 0) return "";

  const days: { day: Date; times: string[] }[] = [];
  for (const range of merged) {
    const time = formatAvailabilityTimeRange(range, hourCycle, locale);
    const last = days[days.length - 1];
    if (last && isSameDay(last.day, range.start)) {
      last.times.push(time);
      continue;
    }
    days.push({ day: startOfDay(range.start), times: [time] });
  }

  const duration = formatMeetingDuration(durationMinutes);
  const zone = getTimeZoneLabel(merged[0].start);
  const lines: string[] = [];

  if (merged.length === 1) {
    const day = formatAvailabilityDay(days[0].day, now, locale, "inline");
    lines.push(
      `Would ${duration} anytime ${day}, ${days[0].times[0]} (${zone}) work for you?`,
    );
  } else if (days.length === 1) {
    const day = formatAvailabilityDay(days[0].day, now, locale, "inline");
    lines.push(
      `Would ${duration} during any of these times (all in ${zone}) ${day} work for you?`,
      ...days[0].times.map((time) => `- ${time}`),
    );
  } else {
    lines.push(
      `Would ${duration} during any of these times (all in ${zone}) work for you?`,
      ...days.map(({ day, times }) => {
        const label = formatAvailabilityDay(day, now, locale, "line-start");
        return `- ${label}, ${joinWithOr(times)}`;
      }),
    );
  }

  if (link) {
    lines.push("", `You can just let me know or confirm here: ${link}`);
  }
  return lines.join("\n");
}
