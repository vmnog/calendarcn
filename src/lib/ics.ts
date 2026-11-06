import { addDays, addSeconds, subDays } from "date-fns";

import type {
  DetailedCalendarEvent,
  EventColor,
  EventReminder,
} from "@/components/calendar-types";
import { getReminderMinutes } from "@/lib/event-utils";

/**
 * Longest content line allowed by RFC 5545, in octets, excluding the line
 * break. Longer lines are folded onto continuation lines.
 */
const MAX_LINE_OCTETS = 75;

/** Line break between content lines (RFC 5545 requires CRLF) */
const CRLF = "\r\n";

/** PRODID written by `toIcs` when the caller doesn't pass one */
const DEFAULT_PROD_ID = "-//CalendarCN//CalendarCN//EN";

/** Event colors an iCalendar COLOR property (RFC 7986) can map to */
const EVENT_COLORS: readonly EventColor[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "gray",
];

/** Weekday codes used by RRULE BYDAY, indexed like `Date.getDay()` */
const WEEKDAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** Seconds in a day and an hour, for duration and reminder math */
const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_HOUR = 3_600;

/** `YYYYMMDD`, a DATE value */
const DATE_PATTERN = /^(\d{4})(\d{2})(\d{2})$/;

/** `YYYYMMDDTHHMMSS`, a DATE-TIME value, with a trailing `Z` when in UTC */
const DATE_TIME_PATTERN = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/;

/** `[+|-]P[nW][nD][T[nH][nM][nS]]`, a DURATION value */
const DURATION_PATTERN =
  /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

/** `+HHMM` or `-HHMMSS`, a UTC-OFFSET value */
const UTC_OFFSET_PATTERN = /^([+-])(\d{2})(\d{2})(\d{2})?$/;

/** An RRULE BYDAY entry such as `SU`, `2SU` or `-1SU` */
const BY_DAY_PATTERN = /^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/;

/** One `NAME;PARAM=value:value` content line */
interface IcsProperty {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** A `BEGIN:NAME` ... `END:NAME` block and the blocks nested in it */
interface IcsComponent {
  name: string;
  properties: IcsProperty[];
  components: IcsComponent[];
}

/** Calendar date and wall-clock time, before any time zone is applied */
interface WallTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** A DATE or DATE-TIME property value */
type IcsDateValue =
  | { kind: "date"; wall: WallTime }
  | { kind: "date-time"; wall: WallTime; utc: boolean; tzid?: string };

/** A DURATION value, split into nominal days and exact seconds */
interface IcsDuration {
  sign: 1 | -1;
  days: number;
  seconds: number;
}

/** A STANDARD or DAYLIGHT observance of a VTIMEZONE */
interface TimeZoneObservance {
  /** UTC offset in effect during the observance, in milliseconds */
  offsetMs: number;
  /** Local time the observance first starts */
  start: WallTime;
  /** Yearly onset rule, when the observance repeats (DST switches) */
  rule: YearlyRule | null;
}

/** The yearly part of a VTIMEZONE RRULE, e.g. "second Sunday of March" */
interface YearlyRule {
  month: number;
  weekday: number;
  /** 1 = first, 2 = second, -1 = last; 0 when BYMONTHDAY picks the week */
  nth: number;
  monthDays: number[];
  /** Wall-clock time of the last onset (UNTIL), if the rule ends */
  until: number | null;
}

/** Converts a wall time in a VTIMEZONE's zone to an instant */
type ZoneResolver = (wall: WallTime) => Date;

/** Options for `toIcs` */
export interface ToIcsOptions {
  /** Calendar name, written as `X-WR-CALNAME` (Google and Apple show it) */
  calendarName?: string;
  /** Product identifier, written as `PRODID` */
  prodId?: string;
  /** Time the file is created, written as `DTSTAMP`. Defaults to now. */
  timestamp?: Date;
}

/**
 * Parses iCalendar (`.ics`) text into calendar events.
 *
 * Reads every VEVENT (other components such as VTODO are skipped) and maps:
 *
 * - `DTSTART` / `DTEND` (or `DURATION`): DATE values become all-day events,
 *   with the exclusive end turned into the calendar's inclusive last day.
 *   DATE-TIME values in UTC, with a `TZID` (IANA names, or the file's own
 *   VTIMEZONE as Outlook writes it) and floating times all become instants
 *   shown in the viewer's time zone.
 * - `UID` to `id` (an edited occurrence, which repeats its series' UID, gets
 *   `UID_RECURRENCE-ID`), `SUMMARY`, `DESCRIPTION` and `LOCATION`.
 * - `RRULE` to `recurrence`, kept as the raw rule (e.g. `FREQ=WEEKLY;BYDAY=TH`).
 *   Occurrences are not expanded: the event shows once, at `DTSTART`.
 * - `TRANSP` to `status` (`TRANSPARENT` is free), `CLASS` to `visibility`,
 *   `COLOR` to `color` when it names one of the calendar's colors, and
 *   VALARMs that fire before the start to `reminders`.
 *
 * Cancelled events (`STATUS:CANCELLED`) are left out.
 */
export function parseIcs(text: string): DetailedCalendarEvent[] {
  const root = parseComponents(text);
  const timeZones = collectTimeZones(root);
  const usedIds = new Set<string>();
  const events: DetailedCalendarEvent[] = [];

  for (const vevent of findComponents(root, "VEVENT")) {
    const event = toCalendarEvent(vevent, timeZones);
    if (!event) continue;
    event.id = uniqueId(event.id || `ics-event-${events.length + 1}`, usedIds);
    events.push(event);
  }

  return events;
}

/**
 * Serializes events to iCalendar (`.ics`) text that Google Calendar, Apple
 * Calendar and Outlook import.
 *
 * Timed events are written in UTC and all-day events as DATE values with an
 * exclusive `DTEND`. `recurrence` is written as an `RRULE` only when it holds
 * a rule (`FREQ=...`), so display strings such as "Every weekday" are left
 * out. Lines are folded at 75 octets and joined with CRLF.
 */
export function toIcs(
  events: readonly DetailedCalendarEvent[],
  options: ToIcsOptions = {},
): string {
  const timestamp = formatUtcDateTime(options.timestamp ?? new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${escapeText(options.prodId ?? DEFAULT_PROD_ID)}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  if (options.calendarName) {
    lines.push(`X-WR-CALNAME:${escapeText(options.calendarName)}`);
  }
  for (const event of events) {
    lines.push(...eventToLines(event, timestamp));
  }
  lines.push("END:VCALENDAR");

  return lines.map(foldLine).join(CRLF) + CRLF;
}

// ---------------------------------------------------------------------------
// Reading: lines, properties and components
// ---------------------------------------------------------------------------

/**
 * Splits the text into unfolded content lines and nests them into
 * components. Returns a root component that holds the VCALENDARs.
 */
function parseComponents(text: string): IcsComponent {
  const root: IcsComponent = { name: "ROOT", properties: [], components: [] };
  const stack: IcsComponent[] = [root];
  const lines = text
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    // Unfold: a line break followed by one space or tab continues the line
    .replace(/\n[ \t]/g, "")
    .split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;
    const property = parseContentLine(line);
    if (!property) continue;
    const current = stack[stack.length - 1];

    if (property.name === "BEGIN") {
      const component: IcsComponent = {
        name: property.value.trim().toUpperCase(),
        properties: [],
        components: [],
      };
      current.components.push(component);
      stack.push(component);
      continue;
    }

    if (property.name === "END") {
      const name = property.value.trim().toUpperCase();
      // Close the innermost open component of that name (and any left open
      // inside it); ignore an END without a matching BEGIN
      for (let index = stack.length - 1; index > 0; index--) {
        if (stack[index].name !== name) continue;
        stack.length = index;
        break;
      }
      continue;
    }

    current.properties.push(property);
  }

  return root;
}

/**
 * Parses `NAME;PARAM=value;PARAM="quoted:value":value`. The value starts at
 * the first colon outside double quotes. Returns null for malformed lines.
 */
function parseContentLine(line: string): IcsProperty | null {
  let inQuotes = false;
  let colonIndex = -1;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') inQuotes = !inQuotes;
    if (char === ":" && !inQuotes) {
      colonIndex = index;
      break;
    }
  }
  if (colonIndex < 0) return null;

  const [name, ...rawParams] = splitOutsideQuotes(
    line.slice(0, colonIndex),
    ";",
  );
  const params: Record<string, string> = {};
  for (const rawParam of rawParams) {
    const equalsIndex = rawParam.indexOf("=");
    if (equalsIndex < 0) continue;
    const key = rawParam.slice(0, equalsIndex).trim().toUpperCase();
    params[key] = rawParam.slice(equalsIndex + 1).replace(/^"(.*)"$/, "$1");
  }

  return {
    name: name.trim().toUpperCase(),
    params,
    value: line.slice(colonIndex + 1),
  };
}

function splitOutsideQuotes(text: string, separator: string): string[] {
  const parts: string[] = [];
  let inQuotes = false;
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') inQuotes = !inQuotes;
    if (char === separator && !inQuotes) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

/** Every component named `name`, at any depth, in document order */
function findComponents(parent: IcsComponent, name: string): IcsComponent[] {
  const found: IcsComponent[] = [];
  for (const component of parent.components) {
    if (component.name === name) found.push(component);
    found.push(...findComponents(component, name));
  }
  return found;
}

function getProperty(
  component: IcsComponent,
  name: string,
): IcsProperty | undefined {
  return component.properties.find((property) => property.name === name);
}

/** A TEXT property's value, unescaped, or undefined when absent or empty */
function getText(component: IcsComponent, name: string): string | undefined {
  const property = getProperty(component, name);
  if (!property) return undefined;
  const text = unescapeText(property.value);
  return text || undefined;
}

/** Undoes TEXT escaping: `\\`, `\;`, `\,` and `\n` (some writers add `\:`) */
function unescapeText(value: string): string {
  return value.replace(/\\([\\;,:nN])/g, (_, char: string) =>
    char === "n" || char === "N" ? "\n" : char,
  );
}

// ---------------------------------------------------------------------------
// Reading: events
// ---------------------------------------------------------------------------

function toCalendarEvent(
  vevent: IcsComponent,
  timeZones: Map<string, ZoneResolver>,
): DetailedCalendarEvent | null {
  const status = getProperty(vevent, "STATUS")?.value.trim().toUpperCase();
  if (status === "CANCELLED") return null;

  const startProperty = getProperty(vevent, "DTSTART");
  const startValue = startProperty && parseDateValue(startProperty);
  if (!startValue) return null;

  const start = resolveDate(startValue, timeZones);
  const isAllDay = startValue.kind === "date";
  const end = resolveEnd(vevent, start, isAllDay, timeZones);

  const event: DetailedCalendarEvent = {
    id: getEventId(vevent),
    title: getText(vevent, "SUMMARY") ?? "",
    start,
    end,
  };
  if (isAllDay) event.isAllDay = true;

  const color = parseColor(getProperty(vevent, "COLOR")?.value);
  if (color) event.color = color;

  const description = getText(vevent, "DESCRIPTION");
  if (description) event.description = description;

  const location = getText(vevent, "LOCATION");
  if (location) event.location = location;

  const recurrence = getProperty(vevent, "RRULE")?.value.trim();
  if (recurrence) event.recurrence = recurrence;

  const transparency = getProperty(vevent, "TRANSP")?.value.trim();
  if (transparency) {
    event.status =
      transparency.toUpperCase() === "TRANSPARENT" ? "free" : "busy";
  }

  const visibility = parseVisibility(getProperty(vevent, "CLASS")?.value);
  if (visibility) event.visibility = visibility;

  const reminders = findComponents(vevent, "VALARM")
    .map(parseReminder)
    .filter((reminder) => reminder !== null);
  if (reminders.length > 0) event.reminders = reminders;

  return event;
}

/**
 * The event's UID. An edited occurrence of a recurring event repeats the
 * series' UID with a RECURRENCE-ID, so its id gets that value appended.
 */
function getEventId(vevent: IcsComponent): string {
  const uid = getText(vevent, "UID") ?? "";
  const recurrenceId = getProperty(vevent, "RECURRENCE-ID")?.value.trim();
  if (!uid || !recurrenceId) return uid;
  return `${uid}_${recurrenceId}`;
}

/** `id`, or `id-2`, `id-3`, ... when a file repeats an id */
function uniqueId(id: string, usedIds: Set<string>): string {
  let candidate = id;
  for (let copy = 2; usedIds.has(candidate); copy++) {
    candidate = `${id}-${copy}`;
  }
  usedIds.add(candidate);
  return candidate;
}

/**
 * The event's end: DTEND, else DTSTART plus DURATION, else the RFC 5545
 * default (one day for all-day events, no length for timed ones).
 *
 * All-day ends are exclusive in iCalendar (a one-day event ends the next
 * day) and inclusive in the calendar (`end` is the start of the last day).
 */
function resolveEnd(
  vevent: IcsComponent,
  start: Date,
  isAllDay: boolean,
  timeZones: Map<string, ZoneResolver>,
): Date {
  const endProperty = getProperty(vevent, "DTEND");
  const endValue = endProperty && parseDateValue(endProperty);
  const duration = parseDuration(
    getProperty(vevent, "DURATION")?.value.trim() ?? "",
  );

  if (isAllDay) {
    let exclusiveEnd = addDays(start, 1);
    if (endValue) exclusiveEnd = toLocalMidnight(endValue.wall);
    else if (duration) exclusiveEnd = applyDuration(start, duration);
    const lastDay = subDays(exclusiveEnd, 1);
    return lastDay < start ? start : lastDay;
  }

  let end = start;
  if (endValue) end = resolveDate(endValue, timeZones);
  else if (duration) end = applyDuration(start, duration);
  return end < start ? start : end;
}

function parseDateValue(property: IcsProperty): IcsDateValue | null {
  const value = property.value.trim();
  const dateMatch = DATE_PATTERN.exec(value);
  if (dateMatch) {
    const [, year, month, day] = dateMatch.map(Number);
    return {
      kind: "date",
      wall: { year, month, day, hour: 0, minute: 0, second: 0 },
    };
  }

  const dateTimeMatch = DATE_TIME_PATTERN.exec(value);
  if (!dateTimeMatch) return null;
  const [, year, month, day, hour, minute, second] = dateTimeMatch.map(Number);
  return {
    kind: "date-time",
    wall: { year, month, day, hour, minute, second },
    utc: dateTimeMatch[7] === "Z",
    tzid: property.params.TZID,
  };
}

/**
 * The instant a DATE or DATE-TIME value names. UTC values are exact; TZID
 * values use the IANA zone, else the file's VTIMEZONE of that name; floating
 * values and unknown zones are read in the viewer's time zone.
 */
function resolveDate(
  value: IcsDateValue,
  timeZones: Map<string, ZoneResolver>,
): Date {
  if (value.kind === "date") return toLocalMidnight(value.wall);
  if (value.utc) return new Date(wallToUtcMs(value.wall));
  if (!value.tzid) return toLocalTime(value.wall);

  const instant = resolveInIanaZone(value.wall, value.tzid);
  if (instant) return instant;

  const resolveInFileZone = timeZones.get(value.tzid);
  if (resolveInFileZone) return resolveInFileZone(value.wall);

  // Old Thunderbird TZIDs look like "/mozilla.org/20050126_1/Europe/Berlin"
  const ianaSuffix = /([A-Za-z_]+\/[A-Za-z_+-]+)$/.exec(value.tzid)?.[1];
  const suffixInstant = ianaSuffix && resolveInIanaZone(value.wall, ianaSuffix);
  if (suffixInstant) return suffixInstant;

  return toLocalTime(value.wall);
}

function toLocalMidnight(wall: WallTime): Date {
  return new Date(wall.year, wall.month - 1, wall.day);
}

function toLocalTime(wall: WallTime): Date {
  return new Date(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );
}

/** The wall time's fields read as UTC, in milliseconds since the epoch */
function wallToUtcMs(wall: WallTime): number {
  return Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );
}

function parseDuration(value: string): IcsDuration | null {
  const match = DURATION_PATTERN.exec(value);
  // The pattern also matches "P" and "PT", which name no length
  if (!match || match.slice(2).every((part) => part === undefined)) {
    return null;
  }
  const [weeks, days, hours, minutes, seconds] = match
    .slice(2)
    .map((part) => Number(part ?? 0));
  return {
    sign: match[1] === "-" ? -1 : 1,
    days: weeks * 7 + days,
    seconds: hours * SECONDS_PER_HOUR + minutes * 60 + seconds,
  };
}

/** Adds a duration: days as calendar days (DST-safe), the rest as seconds */
function applyDuration(date: Date, duration: IcsDuration): Date {
  const withDays = addDays(date, duration.sign * duration.days);
  return addSeconds(withDays, duration.sign * duration.seconds);
}

function parseColor(value: string | undefined): EventColor | undefined {
  const color = value?.trim().toLowerCase().replace("grey", "gray");
  return EVENT_COLORS.find((eventColor) => eventColor === color);
}

function parseVisibility(
  value: string | undefined,
): DetailedCalendarEvent["visibility"] {
  const visibility = value?.trim().toUpperCase();
  if (visibility === "PUBLIC") return "public";
  if (visibility === "PRIVATE" || visibility === "CONFIDENTIAL") {
    return "private";
  }
  return undefined;
}

/**
 * A VALARM that fires a set time before the event starts (`TRIGGER:-PT15M`),
 * as a reminder in the largest whole unit. Alarms relative to the end, at an
 * absolute time or after the start are skipped.
 */
function parseReminder(valarm: IcsComponent): EventReminder | null {
  const trigger = getProperty(valarm, "TRIGGER");
  if (!trigger || trigger.params.RELATED?.toUpperCase() === "END") return null;
  const duration = parseDuration(trigger.value.trim());
  if (!duration) return null;

  const totalSeconds = duration.days * SECONDS_PER_DAY + duration.seconds;
  if (duration.sign > 0 && totalSeconds > 0) return null;
  if (totalSeconds % SECONDS_PER_DAY === 0 && totalSeconds > 0) {
    return { amount: totalSeconds / SECONDS_PER_DAY, unit: "days" };
  }
  if (totalSeconds % SECONDS_PER_HOUR === 0 && totalSeconds > 0) {
    return { amount: totalSeconds / SECONDS_PER_HOUR, unit: "hours" };
  }
  return { amount: Math.round(totalSeconds / 60), unit: "minutes" };
}

// ---------------------------------------------------------------------------
// Reading: time zones
// ---------------------------------------------------------------------------

/** Cached `Intl.DateTimeFormat` per IANA zone; null marks an unknown zone */
const zoneFormatters = new Map<string, Intl.DateTimeFormat | null>();

function getZoneFormatter(timeZone: string): Intl.DateTimeFormat | null {
  const cached = zoneFormatters.get(timeZone);
  if (cached !== undefined) return cached;

  let formatter: Intl.DateTimeFormat | null = null;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
  } catch {
    // Not an IANA zone (e.g. Outlook's "Pacific Standard Time")
  }
  zoneFormatters.set(timeZone, formatter);
  return formatter;
}

/** How far `timeZone` is ahead of UTC at `utcMs`, in milliseconds */
function getZoneOffsetMs(formatter: Intl.DateTimeFormat, utcMs: number) {
  const fields: Record<string, number> = {};
  for (const part of formatter.formatToParts(utcMs)) {
    fields[part.type] = Number(part.value);
  }
  const wallMs = Date.UTC(
    fields.year,
    fields.month - 1,
    fields.day,
    fields.hour,
    fields.minute,
    fields.second,
  );
  return wallMs - Math.floor(utcMs / 1000) * 1000;
}

/** The instant a wall time names in an IANA zone, or null for other names */
function resolveInIanaZone(wall: WallTime, timeZone: string): Date | null {
  const formatter = getZoneFormatter(timeZone);
  if (!formatter) return null;
  const wallMs = wallToUtcMs(wall);
  // Guess with the offset at the wall time, then correct across DST changes
  const guess = wallMs - getZoneOffsetMs(formatter, wallMs);
  return new Date(wallMs - getZoneOffsetMs(formatter, guess));
}

/**
 * Builds a resolver for each VTIMEZONE in the file, keyed by TZID, for zone
 * names `Intl` doesn't know (Outlook writes Windows names like "Pacific
 * Standard Time" and describes their rules in the file).
 */
function collectTimeZones(root: IcsComponent): Map<string, ZoneResolver> {
  const timeZones = new Map<string, ZoneResolver>();
  for (const vtimezone of findComponents(root, "VTIMEZONE")) {
    const tzid = getProperty(vtimezone, "TZID")?.value.trim();
    const observances = vtimezone.components
      .filter((item) => item.name === "STANDARD" || item.name === "DAYLIGHT")
      .map(parseObservance)
      .filter((observance) => observance !== null);
    if (!tzid || observances.length === 0) continue;
    timeZones.set(tzid, (wall) => {
      const offsetMs = getObservanceOffset(observances, wallToUtcMs(wall));
      return new Date(wallToUtcMs(wall) - offsetMs);
    });
  }
  return timeZones;
}

function parseObservance(component: IcsComponent): TimeZoneObservance | null {
  const startProperty = getProperty(component, "DTSTART");
  const start = startProperty && parseDateValue(startProperty);
  const offsetMatch = UTC_OFFSET_PATTERN.exec(
    getProperty(component, "TZOFFSETTO")?.value.trim() ?? "",
  );
  if (!start || !offsetMatch) return null;

  const [, sign, hours, minutes, seconds = "0"] = offsetMatch;
  const offsetSeconds =
    Number(hours) * SECONDS_PER_HOUR + Number(minutes) * 60 + Number(seconds);
  return {
    offsetMs: (sign === "-" ? -1 : 1) * offsetSeconds * 1000,
    start: start.wall,
    rule: parseYearlyRule(getProperty(component, "RRULE")?.value ?? ""),
  };
}

/** Reads `FREQ=YEARLY;BYMONTH=3;BYDAY=2SU`, the shape VTIMEZONE rules use */
function parseYearlyRule(value: string): YearlyRule | null {
  const parts = new Map(
    value.split(";").map((part) => {
      const [key, ...rest] = part.split("=");
      return [key.trim().toUpperCase(), rest.join("=").trim()] as const;
    }),
  );
  if (parts.get("FREQ")?.toUpperCase() !== "YEARLY") return null;

  const month = Number(parts.get("BYMONTH"));
  const byDay = BY_DAY_PATTERN.exec(
    (parts.get("BYDAY") ?? "").toUpperCase().split(",")[0],
  );
  if (!month || !byDay) return null;

  const untilValue = parts.get("UNTIL");
  const untilMatch = untilValue && DATE_TIME_PATTERN.exec(untilValue);
  const until = untilMatch
    ? Date.UTC(
        Number(untilMatch[1]),
        Number(untilMatch[2]) - 1,
        Number(untilMatch[3]),
        Number(untilMatch[4]),
        Number(untilMatch[5]),
        Number(untilMatch[6]),
      )
    : null;

  return {
    month,
    weekday: WEEKDAY_CODES.indexOf(byDay[2]),
    nth: Number(byDay[1] ?? 0),
    monthDays: (parts.get("BYMONTHDAY") ?? "")
      .split(",")
      .filter(Boolean)
      .map(Number),
    until,
  };
}

/**
 * The UTC offset of the observance in effect at a wall time: the one whose
 * latest onset at or before that time is the most recent. Onsets are
 * compared in wall time, which is only off within the hour of a switch.
 */
function getObservanceOffset(
  observances: TimeZoneObservance[],
  wallMs: number,
): number {
  const year = new Date(wallMs).getUTCFullYear();
  let latest: { onset: number; offsetMs: number } | null = null;
  for (const observance of observances) {
    const onset = getLatestOnset(observance, wallMs, year);
    if (onset === null) continue;
    if (!latest || onset > latest.onset) {
      latest = { onset, offsetMs: observance.offsetMs };
    }
  }
  if (latest) return latest.offsetMs;

  // Before every observance starts: use the earliest one
  const earliest = observances.reduce((first, observance) =>
    wallToUtcMs(observance.start) < wallToUtcMs(first.start)
      ? observance
      : first,
  );
  return earliest.offsetMs;
}

/** The observance's last onset at or before `wallMs`, or null if none */
function getLatestOnset(
  observance: TimeZoneObservance,
  wallMs: number,
  year: number,
): number | null {
  const firstOnset = wallToUtcMs(observance.start);
  if (firstOnset > wallMs) return null;
  const { rule } = observance;
  if (!rule) return firstOnset;

  for (const candidateYear of [year, year - 1]) {
    const onset = getYearlyOnset(rule, observance.start, candidateYear);
    if (onset === null || onset > wallMs || onset < firstOnset) continue;
    if (rule.until !== null && onset > rule.until) continue;
    return onset;
  }
  // The rule ended (UNTIL) before this time: its last onset was at UNTIL
  if (rule.until !== null && rule.until <= wallMs) return rule.until;
  return firstOnset;
}

/** The rule's onset in `year`, at the observance's start time of day */
function getYearlyOnset(
  rule: YearlyRule,
  start: WallTime,
  year: number,
): number | null {
  const daysInMonth = new Date(Date.UTC(year, rule.month, 0)).getUTCDate();
  const matchingDays: number[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const weekday = new Date(Date.UTC(year, rule.month - 1, day)).getUTCDay();
    if (weekday !== rule.weekday) continue;
    if (rule.monthDays.length > 0 && !rule.monthDays.includes(day)) continue;
    matchingDays.push(day);
  }

  let day = matchingDays[0];
  if (rule.nth > 0) day = matchingDays[rule.nth - 1];
  if (rule.nth < 0) day = matchingDays[matchingDays.length + rule.nth];
  if (day === undefined) return null;

  return wallToUtcMs({ ...start, year, month: rule.month, day });
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

function eventToLines(
  event: DetailedCalendarEvent,
  timestamp: string,
): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${escapeText(event.id)}`,
    `DTSTAMP:${timestamp}`,
  ];

  if (event.isAllDay) {
    // The calendar's `end` is the last day; iCalendar's DTEND is the day after
    const lastDay = event.end < event.start ? event.start : event.end;
    lines.push(
      `DTSTART;VALUE=DATE:${formatDate(event.start)}`,
      `DTEND;VALUE=DATE:${formatDate(addDays(lastDay, 1))}`,
    );
  } else {
    lines.push(
      `DTSTART:${formatUtcDateTime(event.start)}`,
      `DTEND:${formatUtcDateTime(event.end)}`,
    );
  }

  lines.push(`SUMMARY:${escapeText(event.title)}`);
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeText(event.location)}`);
  }

  const rule = event.recurrence?.trim().replace(/^RRULE:/i, "");
  if (rule && /(^|;)FREQ=/i.test(rule)) lines.push(`RRULE:${rule}`);

  if (event.status) {
    lines.push(`TRANSP:${event.status === "free" ? "TRANSPARENT" : "OPAQUE"}`);
  }
  if (event.visibility === "public") lines.push("CLASS:PUBLIC");
  if (event.visibility === "private") lines.push("CLASS:PRIVATE");
  if (event.color) lines.push(`COLOR:${event.color}`);

  for (const reminder of event.reminders ?? []) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(event.title || "Reminder")}`,
      `TRIGGER:${formatReminderTrigger(reminder)}`,
      "END:VALARM",
    );
  }

  lines.push("END:VEVENT");
  return lines;
}

/**
 * `-PT15M`, `-PT2H`, `-P1D` or `-P1W`. An all-day reminder with a time of
 * day counts in minutes from the event's midnight start: "1 day before at
 * 9 AM" is `-PT900M`, "on the day at 9 AM" is `PT540M`.
 */
function formatReminderTrigger(reminder: EventReminder): string {
  if (reminder.time) {
    const minutes = Math.round(getReminderMinutes(reminder));
    return `${minutes < 0 ? "" : "-"}PT${Math.abs(minutes)}M`;
  }
  const amount = Math.max(0, Math.round(reminder.amount));
  if (reminder.unit === "weeks") return `-P${amount}W`;
  if (reminder.unit === "days") return `-P${amount}D`;
  if (reminder.unit === "hours") return `-PT${amount}H`;
  return `-PT${amount}M`;
}

/** `YYYYMMDD` from the date's local calendar day */
function formatDate(date: Date): string {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("");
}

/** `YYYYMMDDTHHMMSSZ` */
function formatUtcDateTime(date: Date): string {
  const day = [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
  ].join("");
  const time = [
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join("");
  return `${day}T${time}Z`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Escapes a TEXT value: backslashes, semicolons, commas and line breaks */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Folds a content line so no line is longer than 75 octets of UTF-8.
 * Continuation lines start with a space, which counts toward their 75, and
 * a multi-byte character is never split.
 */
function foldLine(line: string): string {
  let folded = "";
  let lineOctets = 0;
  for (const char of line) {
    const octets = utf8Length(char.codePointAt(0) ?? 0);
    if (lineOctets + octets > MAX_LINE_OCTETS) {
      folded += `${CRLF} `;
      lineOctets = 1;
    }
    folded += char;
    lineOctets += octets;
  }
  return folded;
}

function utf8Length(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}
