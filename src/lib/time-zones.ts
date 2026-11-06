import { getTimeZoneCity } from "@/lib/timezone-label";

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

/**
 * One zone of the time zone picker
 */
export interface TimeZoneOption {
  /** IANA id, e.g. "America/Sao_Paulo" */
  id: string;
  /** Offset from UTC on the reference date, in minutes (-180 for GMT−3) */
  offsetMinutes: number;
  /** "GMT−03:00" */
  offsetLabel: string;
  /** "Brasilia Standard Time", or the IANA id when the zone has no name */
  name: string;
  /** "Sao Paulo", or the IANA id when the zone has no city */
  city: string;
}

/** One `Intl.DateTimeFormat` per zone and name style; building them is slow */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

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
  if (typeof Intl.supportedValuesOf !== "function") return FALLBACK_TIME_ZONES;
  return Intl.supportedValuesOf("timeZone");
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
  const city = normalizeSearchText(label.slice(label.indexOf(" ") + 1).trim());
  if (!city) return undefined;
  return getSupportedTimeZones().find(
    (zone) => normalizeSearchText(getTimeZoneCity(zone)) === city,
  );
}

/** Lower case without accents, so "sao" finds "São" */
export function normalizeSearchText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Zones whose name, city or IANA id contains `query`, ignoring case and
 * accents. Zones matching their city come first, then their name, then
 * their id; each group keeps the list's order.
 */
export function searchTimeZones(
  options: TimeZoneOption[],
  query: string,
): TimeZoneOption[] {
  const needle = normalizeSearchText(query.trim());
  if (!needle) return options;

  const byCity: TimeZoneOption[] = [];
  const byName: TimeZoneOption[] = [];
  const byId: TimeZoneOption[] = [];
  for (const option of options) {
    if (normalizeSearchText(option.city).includes(needle)) {
      byCity.push(option);
    } else if (normalizeSearchText(option.name).includes(needle)) {
      byName.push(option);
    } else if (normalizeSearchText(option.id).includes(needle)) {
      byId.push(option);
    }
  }
  return [...byCity, ...byName, ...byId];
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

  const wallClock = getWallClock(date, fromTimeZone);
  // The target offset depends on the instant, which depends on the offset:
  // guess with the offset at the wall-clock time, then correct once (DST)
  const guess = wallClock - getTimeZoneOffsetMinutes(date, toTimeZone) * 60_000;
  const corrected =
    wallClock - getTimeZoneOffsetMinutes(new Date(guess), toTimeZone) * 60_000;
  return new Date(corrected);
}
