import { isSameDay } from "date-fns";

import { getTimeZoneCity } from "@/lib/timezone-label";
import type {
  CalendarEvent,
  CalendarTimeZones,
  DetailedCalendarEvent,
  TimeZoneOption,
} from "@/components/calendar-types";

/** Locale of zone names and offsets, as Notion Calendar shows them */
const TIME_ZONE_LOCALE = "en-US";

/** Minus sign Notion Calendar writes in offsets ("GMT−3"), U+2212 */
const MINUS_SIGN = "−";

/**
 * Zones listed under the recent ones in the time zone picker, in Notion
 * Calendar's order
 */
export const POPULAR_TIME_ZONES = [
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Brussels",
  "Asia/Kolkata",
];

/**
 * Zones the picker lists when the runtime can't enumerate its own
 * (`Intl.supportedValuesOf` is missing before Chrome 99 / Safari 15.4)
 */
const FALLBACK_TIME_ZONES = [
  "Pacific/Honolulu",
  "America/Anchorage",
  ...POPULAR_TIME_ZONES,
  "America/Chicago",
  "America/Denver",
  "America/Sao_Paulo",
  "Europe/Berlin",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

/** Milliseconds in a day, for times of day */
const DAY_MS = 86_400_000;

/** Milliseconds in an hour */
const HOUR_MS = 3_600_000;

/**
 * Hour of the day whose offsets the time axis's second column follows:
 * noon, clear of the night hours when clocks change
 */
const SECONDARY_TIME_AXIS_HOUR = 12;

/** One `Intl.DateTimeFormat` per zone and name style; building them is slow */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

/** The runtime's zones, listed once: `Intl.supportedValuesOf` builds a new array each call */
let supportedTimeZones: string[] | null = null;

/** Zone of each legacy label `findTimeZoneByLabel` has looked up */
const labelTimeZoneCache = new Map<string, string | undefined>();

/** Whether the runtime knows each zone name `isKnownTimeZone` has checked */
const knownTimeZoneCache = new Map<string, boolean>();

/**
 * Each event's copy on a zone's clock (`toDisplayEvent`), by event, so an
 * unchanged event keeps the same copy from one render to the next
 */
const displayEventCache = new WeakMap<
  CalendarEvent,
  { timeZone: string; event: CalendarEvent }
>();

/**
 * The event each copy `toDisplayEvent` made came from, so
 * `fromDisplayEvent` gives back the exact instants of an unchanged copy
 */
const storedEventCache = new WeakMap<
  CalendarEvent,
  { timeZone: string; event: CalendarEvent }
>();

function getFormatter(
  timeZone: string,
  timeZoneName: Intl.DateTimeFormatOptions["timeZoneName"],
): Intl.DateTimeFormat {
  const key = `${timeZone}|${timeZoneName}`;
  const cached = formatterCache.get(key);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat(TIME_ZONE_LOCALE, {
    timeZone,
    timeZoneName,
  });
  formatterCache.set(key, formatter);
  return formatter;
}

function getZoneNamePart(
  date: Date,
  timeZone: string,
  timeZoneName: Intl.DateTimeFormatOptions["timeZoneName"],
): string {
  return (
    getFormatter(timeZone, timeZoneName)
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? ""
  );
}

/** Whether `name` is only an offset ("GMT-03:00", "GMT"), not a real name */
function isOffsetName(name: string): boolean {
  return /^(GMT|UTC)([+-]\d|$)/.test(name);
}

/**
 * Returns the viewer's IANA time zone, e.g. "America/Sao_Paulo"
 */
export function getViewerTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Returns every IANA zone the runtime knows, or a short list of common ones
 * when it can't enumerate them
 */
export function getSupportedTimeZones(): string[] {
  if (supportedTimeZones) return supportedTimeZones;
  supportedTimeZones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : FALLBACK_TIME_ZONES;
  return supportedTimeZones;
}

/**
 * Returns the offset of `timeZone` from UTC at `date`, in minutes: -180 for
 * São Paulo, 330 for Kolkata
 */
export function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  // "GMT-03:00", "GMT+05:30", or "GMT" for UTC itself
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(
    getZoneNamePart(date, timeZone, "longOffset"),
  );
  if (!match) return 0;

  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

/**
 * Minutes a clock in `toTimeZone` is ahead of a clock in `fromTimeZone` at
 * `date`: 570 from New York to Kolkata in June (GMT−4 to GMT+5:30), -180
 * from New York to Los Angeles. Negative when it is behind.
 */
export function getTimeZoneOffsetDifference(
  date: Date,
  fromTimeZone: string,
  toTimeZone: string,
): number {
  return (
    getTimeZoneOffsetMinutes(date, toTimeZone) -
    getTimeZoneOffsetMinutes(date, fromTimeZone)
  );
}

/**
 * Formats an offset the way the picker lists it: "GMT−03:00", "GMT+05:30",
 * "GMT+00:00"
 */
export function formatLongOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? MINUS_SIGN : "+";
  const total = Math.abs(offsetMinutes);
  const hours = String(Math.floor(total / 60)).padStart(2, "0");
  const minutes = String(total % 60).padStart(2, "0");
  return `GMT${sign}${hours}:${minutes}`;
}

/**
 * Formats an offset the way the details row shows it: "GMT−3", "GMT+5:30",
 * "GMT+0"
 */
export function formatShortOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? MINUS_SIGN : "+";
  const total = Math.abs(offsetMinutes);
  const minutes = total % 60;
  const hours = Math.floor(total / 60);
  if (minutes === 0) return `GMT${sign}${hours}`;
  return `GMT${sign}${hours}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Returns the zone's English name at `date` ("Brasilia Standard Time",
 * "Eastern Daylight Time"). Zones the platform has no name for get their
 * generic name ("Punta Arenas Time"), else their IANA id.
 */
export function getTimeZoneName(date: Date, timeZone: string): string {
  const long = getZoneNamePart(date, timeZone, "long");
  if (long && !isOffsetName(long)) return long;

  const generic = getZoneNamePart(date, timeZone, "longGeneric");
  if (generic && !isOffsetName(generic)) return generic;

  return timeZone;
}

/**
 * Describes one zone for the picker at `date`
 */
export function getTimeZoneOption(
  date: Date,
  timeZone: string,
): TimeZoneOption {
  const offsetMinutes = getTimeZoneOffsetMinutes(date, timeZone);
  return {
    id: timeZone,
    offsetMinutes,
    offsetLabel: formatLongOffset(offsetMinutes),
    name: getTimeZoneName(date, timeZone),
    city: getTimeZoneCity(timeZone) || timeZone,
  };
}

/**
 * Returns every zone for the picker at `date`, sorted by offset and then by
 * IANA id, as Notion Calendar lists them
 */
export function getTimeZoneOptions(date: Date): TimeZoneOption[] {
  return getSupportedTimeZones()
    .map((timeZone) => getTimeZoneOption(date, timeZone))
    .sort(
      (a, b) => a.offsetMinutes - b.offsetMinutes || a.id.localeCompare(b.id),
    );
}

/**
 * The row's label for a zone: "GMT−3" and "Sao Paulo"
 */
export function getTimeZoneRowLabel(
  date: Date,
  timeZone: string,
): { offset: string; city: string } {
  return {
    offset: formatShortOffset(getTimeZoneOffsetMinutes(date, timeZone)),
    city: getTimeZoneCity(timeZone) || timeZone,
  };
}

/**
 * The IANA zone a legacy label like "GMT-3 Sao Paulo" names, found by its
 * city. `undefined` when the label names no known city.
 */
export function findTimeZoneByLabel(
  label: string | undefined,
): string | undefined {
  if (!label) return undefined;
  if (labelTimeZoneCache.has(label)) return labelTimeZoneCache.get(label);

  const city = normalizeSearchText(label.slice(label.indexOf(" ") + 1).trim());
  const timeZone = city
    ? getSupportedTimeZones().find(
        (zone) => normalizeSearchText(getTimeZoneCity(zone)) === city,
      )
    : undefined;
  labelTimeZoneCache.set(label, timeZone);
  return timeZone;
}

/**
 * Whether the runtime knows `timeZone` as a zone name. `Intl` throws a
 * RangeError on one it doesn't know, like "Mars/Olympus" or Outlook's
 * "Pacific Standard Time".
 */
export function isKnownTimeZone(timeZone: string): boolean {
  const cached = knownTimeZoneCache.get(timeZone);
  if (cached !== undefined) return cached;

  let isKnown = true;
  try {
    getFormatter(timeZone, "longOffset");
  } catch {
    isKnown = false;
  }
  knownTimeZoneCache.set(timeZone, isKnown);
  return isKnown;
}

/**
 * The IANA zone an event is set in: its `timeZone`, else the zone its
 * legacy `timezone` label names. `undefined` means the viewer's zone, which
 * is also what a `timeZone` the runtime doesn't know falls back to.
 */
export function getEventTimeZone(
  event: Pick<DetailedCalendarEvent, "timeZone" | "timezone">,
): string | undefined {
  if (event.timeZone && isKnownTimeZone(event.timeZone)) return event.timeZone;
  return findTimeZoneByLabel(event.timezone);
}

/** Lower case without accents, so "sao" finds "São" */
export function normalizeSearchText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * The offset an offset-like query names, in minutes: "+9", "GMT+9",
 * "utc-3", "−03:00", "+5:30". `null` for any other text.
 */
export function parseOffsetQuery(query: string): number | null {
  const match =
    /^(?:gmt|utc)?\s*([+\-\u2212])\s*(\d{1,2})(?::?(\d{2}))?$/i.exec(
      query.trim(),
    );
  if (!match) return null;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === "+" ? minutes : -minutes;
}

/**
 * Zones whose name, city or IANA id contains `query`, ignoring case and
 * accents, or whose offset it names ("+9", "GMT-3", "+05:30"). Zones at
 * that offset come first, then the ones matching their city, their name,
 * then their id; each group keeps the list's order.
 */
export function searchTimeZones(
  options: TimeZoneOption[],
  query: string,
): TimeZoneOption[] {
  const needle = normalizeSearchText(query.trim());
  if (!needle) return options;
  const offset = parseOffsetQuery(query);

  const byOffset: TimeZoneOption[] = [];
  const byCity: TimeZoneOption[] = [];
  const byName: TimeZoneOption[] = [];
  const byId: TimeZoneOption[] = [];
  for (const option of options) {
    if (offset !== null && option.offsetMinutes === offset) {
      byOffset.push(option);
    } else if (normalizeSearchText(option.city).includes(needle)) {
      byCity.push(option);
    } else if (normalizeSearchText(option.name).includes(needle)) {
      byName.push(option);
    } else if (normalizeSearchText(option.id).includes(needle)) {
      byId.push(option);
    }
  }
  return [...byOffset, ...byCity, ...byName, ...byId];
}

/**
 * Splits `text` around the first match of `query` (ignoring case and
 * accents), so the picker can bold it. Returns the whole text as `before`
 * when there is no match.
 */
export function splitSearchMatch(
  text: string,
  query: string,
): { before: string; match: string; after: string } {
  const needle = normalizeSearchText(query.trim());
  // Normalized one character at a time, so indexes still line up with `text`
  const haystack = Array.from(text)
    .map((char) => normalizeSearchText(char) || char)
    .join("");
  const index = needle ? haystack.indexOf(needle) : -1;
  if (index === -1 || haystack.length !== text.length) {
    return { before: text, match: "", after: "" };
  }
  return {
    before: text.slice(0, index),
    match: text.slice(index, index + needle.length),
    after: text.slice(index + needle.length),
  };
}

/**
 * The wall-clock time of `date` in `timeZone`, as milliseconds of a UTC
 * date that reads the same
 */
function getWallClock(date: Date, timeZone: string): number {
  const offset = getTimeZoneOffsetMinutes(date, timeZone);
  return date.getTime() + offset * 60_000;
}

/**
 * The instant the clock in `timeZone` reads `wallClock` (milliseconds of a
 * UTC date that reads the same). `near` is an instant close to it.
 */
function fromWallClock(wallClock: number, timeZone: string, near: Date): Date {
  // The offset depends on the instant, which depends on the offset: guess
  // with the offset near it, then correct once (DST)
  const guess = wallClock - getTimeZoneOffsetMinutes(near, timeZone) * 60_000;
  const corrected =
    wallClock - getTimeZoneOffsetMinutes(new Date(guess), timeZone) * 60_000;
  return new Date(corrected);
}

/**
 * `date` as a calendar drawn in `timeZone` shows it: a Date whose local time
 * (`getHours()`, date-fns `format`) reads the clock in `timeZone` at that
 * instant, so 9 PM in Tokyo comes back as 9 PM local in any viewer's zone.
 * `date` itself without a zone. A time the viewer's own clocks skip can't be
 * a local time: it comes back an hour later.
 */
export function toZonedWallClock(date: Date, timeZone?: string): Date {
  if (!timeZone) return date;
  const wallClock = new Date(getWallClock(date, timeZone));
  return new Date(
    wallClock.getUTCFullYear(),
    wallClock.getUTCMonth(),
    wallClock.getUTCDate(),
    wallClock.getUTCHours(),
    wallClock.getUTCMinutes(),
    wallClock.getUTCSeconds(),
    wallClock.getUTCMilliseconds(),
  );
}

/**
 * The instant a clock in `timeZone` reads the local time of `date`: the
 * inverse of `toZonedWallClock`. A time the zone's clocks skip lands after
 * the gap (1:30 AM on a spring-forward night is 2:30 AM), and one they show
 * twice is the first of the two, as `new Date(...)` does with local times.
 * `date` itself without a zone.
 */
export function fromZonedWallClock(date: Date, timeZone?: string): Date {
  if (!timeZone) return date;
  const wallClock = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
  // The offsets a day before and a day after: each one that reads back as
  // `wallClock` gives an instant (both, when the time happens twice)
  const offsetBefore = getTimeZoneOffsetMinutes(
    new Date(wallClock - DAY_MS),
    timeZone,
  );
  const offsetAfter = getTimeZoneOffsetMinutes(
    new Date(wallClock + DAY_MS),
    timeZone,
  );
  const instants = [offsetBefore, offsetAfter]
    .map((offset) => wallClock - offset * 60_000)
    .filter(
      (instant) => getWallClock(new Date(instant), timeZone) === wallClock,
    );
  if (instants.length > 0) return new Date(Math.min(...instants));
  // Skipped: read with the offset from before the change, which lands after
  // the gap
  return new Date(wallClock - offsetBefore * 60_000);
}

/**
 * The current time on a clock in `timeZone`, as `toZonedWallClock` gives it:
 * "now" and "today" for a calendar drawn in that zone. The current time
 * itself without a zone.
 */
export function getZonedNow(timeZone?: string): Date {
  return toZonedWallClock(new Date(), timeZone);
}

/**
 * An event as a calendar drawn in `timeZone` draws it: a timed event's
 * `start` and `end` as `toZonedWallClock` gives them. All-day events are
 * calendar dates already, so they come back as they are, as does every
 * event when `timeZone` is unset. The same event object gives back the same
 * copy, so don't change an event in place.
 */
export function toDisplayEvent<TEvent extends CalendarEvent>(
  event: TEvent,
  timeZone?: string,
): TEvent {
  if (!timeZone || event.isAllDay) return event;
  const cached = displayEventCache.get(event);
  // Built from this same object, so it is a `TEvent`
  if (cached?.timeZone === timeZone) return cached.event as TEvent;
  const shown: TEvent = {
    ...event,
    start: toZonedWallClock(event.start, timeZone),
    end: toZonedWallClock(event.end, timeZone),
  };
  displayEventCache.set(event, { timeZone, event: shown });
  storedEventCache.set(shown, { timeZone, event });
  return shown;
}

/**
 * The event to store after a calendar drawn in `timeZone` changed it: the
 * inverse of `toDisplayEvent`. A copy `toDisplayEvent` made and nothing
 * changed gives back the event it came from. Otherwise a timed event's
 * `start` and `end` go back to instants (`fromZonedWallClock`), and a time
 * that still reads as it did in `toDisplayEvent(storedEvent)` keeps the
 * stored instant, so a time the zone's clocks show twice, or one the
 * viewer's clocks skip, survives an edit of another field. All-day events
 * keep their calendar dates. The event itself when `timeZone` is unset.
 */
export function fromDisplayEvent<TEvent extends CalendarEvent>(
  shownEvent: TEvent,
  timeZone?: string,
  storedEvent?: TEvent,
): TEvent {
  if (!timeZone || shownEvent.isAllDay) return shownEvent;
  const source = storedEventCache.get(shownEvent);
  // Made from that same object, so it is a `TEvent`
  if (source?.timeZone === timeZone) return source.event as TEvent;
  // An all-day event's dates aren't instants: map a switch to timed in full
  const before = storedEvent && !storedEvent.isAllDay ? storedEvent : undefined;
  const shownBefore = before ? toDisplayEvent(before, timeZone) : undefined;
  const toInstant = (field: "start" | "end"): Date => {
    if (
      before &&
      shownBefore &&
      shownBefore[field].getTime() === shownEvent[field].getTime()
    ) {
      return before[field];
    }
    return fromZonedWallClock(shownEvent[field], timeZone);
  };
  return { ...shownEvent, start: toInstant("start"), end: toInstant("end") };
}

/**
 * A range on the calendar's clock (a `NewEventRange`, a `VisibleRange`) as
 * instants: what `createEvent` and `onVisibleRangeChange` get. The range
 * itself when `timeZone` is unset.
 */
export function fromDisplayRange<TRange extends { start: Date; end: Date }>(
  range: TRange,
  timeZone?: string,
): TRange {
  if (!timeZone) return range;
  return {
    ...range,
    start: fromZonedWallClock(range.start, timeZone),
    end: fromZonedWallClock(range.end, timeZone),
  };
}

/**
 * Moves `date` from one zone to another keeping its wall-clock time: 8 AM
 * in São Paulo becomes 8 AM in New York, as Notion Calendar does when an
 * event's zone changes
 */
export function changeTimeZoneKeepingWallClock(
  date: Date,
  fromTimeZone: string,
  toTimeZone: string,
): Date {
  if (fromTimeZone === toTimeZone) return date;
  return fromWallClock(getWallClock(date, fromTimeZone), toTimeZone, date);
}

/**
 * The calendar day `date` falls on in `timeZone` (the viewer's zone when
 * unset), as a local midnight: what a repeat rule counts its days in
 */
export function getZonedDay(date: Date, timeZone?: string): Date {
  if (!timeZone) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
  const wallClock = new Date(getWallClock(date, timeZone));
  return new Date(
    wallClock.getUTCFullYear(),
    wallClock.getUTCMonth(),
    wallClock.getUTCDate(),
  );
}

/**
 * The time of day `date` shows on a clock in `timeZone` (the viewer's zone
 * when unset), in milliseconds since midnight
 */
export function getZonedTimeOfDay(date: Date, timeZone?: string): number {
  if (!timeZone) {
    const minutes = date.getHours() * 60 + date.getMinutes();
    return (minutes * 60 + date.getSeconds()) * 1000 + date.getMilliseconds();
  }
  return ((getWallClock(date, timeZone) % DAY_MS) + DAY_MS) % DAY_MS;
}

/**
 * The instant a clock in `timeZone` (the viewer's zone when unset) reads
 * `timeOfDay` milliseconds after midnight on `day`'s local calendar day
 */
export function fromZonedDayTime(
  day: Date,
  timeOfDay: number,
  timeZone?: string,
): Date {
  if (!timeZone) {
    return new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      0,
      0,
      0,
      timeOfDay,
    );
  }
  const wallClock =
    Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) + timeOfDay;
  return fromWallClock(wallClock, timeZone, new Date(wallClock));
}

/**
 * The instant whose offsets the time axis's second column shows: noon in
 * `timeZone` (the zone of the hour rows) on today while today is among
 * `days`, else on the first of `days` (never empty). One instant serves the
 * whole column, so in a week where a clock changes, the labels are off by
 * that change on the days on the other side of it.
 */
export function getSecondaryTimeAxisInstant(
  days: readonly Date[],
  today: Date | null,
  timeZone: string,
): Date {
  const visibleToday = today
    ? days.find((day) => isSameDay(day, today))
    : undefined;
  return fromZonedDayTime(
    visibleToday ?? days[0],
    SECONDARY_TIME_AXIS_HOUR * HOUR_MS,
    timeZone,
  );
}

/**
 * Adds an additional zone, as the left-most column, as Notion Calendar's
 * "Show additional time zones" does. A zone already shown stays where it is.
 */
export function addTimeZone(
  zones: CalendarTimeZones,
  timeZone: string,
): CalendarTimeZones {
  if (zones.primary === timeZone || zones.secondary.includes(timeZone)) {
    return zones;
  }
  return { ...zones, secondary: [timeZone, ...zones.secondary] };
}

/**
 * Removes a zone ("Remove time zone from list"). Removing the primary one
 * makes the additional zone next to it primary; the only zone left stays.
 */
export function removeTimeZone(
  zones: CalendarTimeZones,
  timeZone: string,
): CalendarTimeZones {
  if (zones.primary !== timeZone) {
    return {
      ...zones,
      secondary: zones.secondary.filter((zone) => zone !== timeZone),
    };
  }
  const nextPrimary = zones.secondary[zones.secondary.length - 1];
  if (!nextPrimary) return zones;
  return { primary: nextPrimary, secondary: zones.secondary.slice(0, -1) };
}

/**
 * Makes a zone primary ("Make time zone primary", or "Add as primary time
 * zone" after travelling): it moves next to the days, the old primary zone
 * becomes the additional zone closest to it, and the others shift left.
 */
export function makeTimeZonePrimary(
  zones: CalendarTimeZones,
  timeZone: string,
): CalendarTimeZones {
  if (zones.primary === timeZone) return zones;
  const others = zones.secondary.filter((zone) => zone !== timeZone);
  return {
    primary: timeZone,
    secondary: zones.primary ? [...others, zones.primary] : others,
  };
}

/**
 * Makes the primary zone an additional one ("Make time zone secondary"):
 * the additional zone closest to it becomes primary. With no additional
 * zone, nothing changes.
 */
export function makeTimeZoneSecondary(
  zones: CalendarTimeZones,
): CalendarTimeZones {
  const closest = zones.secondary[zones.secondary.length - 1];
  if (!closest) return zones;
  return makeTimeZonePrimary(zones, closest);
}

/**
 * Puts another zone in a zone's place ("Change time zone"). An additional
 * zone already shown elsewhere moves there; changing one to the primary
 * zone removes it.
 */
export function replaceTimeZone(
  zones: CalendarTimeZones,
  timeZone: string,
  replacement: string,
): CalendarTimeZones {
  if (timeZone === replacement) return zones;
  const secondary = zones.secondary
    .filter((zone) => zone !== replacement)
    .map((zone) => (zone === timeZone ? replacement : zone));
  if (zones.primary === timeZone) {
    return { primary: replacement, secondary };
  }
  // The primary zone is already shown: the changed column goes
  if (zones.primary === replacement) {
    return {
      ...zones,
      secondary: zones.secondary.filter((zone) => zone !== timeZone),
    };
  }
  return { ...zones, secondary };
}
