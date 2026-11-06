/** Locale used to format the timezone label ("EDT", "GMT-3", "GMT+5:30"). */
const TIMEZONE_LABEL_LOCALE = "en-US";

/**
 * Returns the short timezone label for `date` in `timeZone` (the runtime's
 * zone when omitted), e.g. "EDT", "UTC", "GMT-3" or "GMT+5:30".
 *
 * Zones without an English abbreviation are reported by `Intl` as a GMT
 * offset, which is returned as-is so every zone gets a visible label.
 * Returns an empty string only if the runtime provides no timezone name.
 */
export function getTimeZoneLabel(date: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat(TIMEZONE_LABEL_LOCALE, {
    timeZone,
    timeZoneName: "short",
  }).formatToParts(date);

  return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
}

/**
 * Returns the city of an IANA timezone, e.g. "Sao Paulo" for
 * "America/Sao_Paulo". Zones without one ("UTC", "Etc/GMT+3") return an
 * empty string.
 */
export function getTimeZoneCity(timeZone: string): string {
  if (!timeZone.includes("/") || timeZone.startsWith("Etc/")) return "";
  return timeZone.slice(timeZone.lastIndexOf("/") + 1).replace(/_/g, " ");
}

/**
 * Returns the short timezone label followed by the zone's city, e.g.
 * "GMT-3 Sao Paulo" or "EDT New York", for `timeZone` (the runtime's zone
 * when omitted). Zones without a city return the label alone, and a name
 * the runtime doesn't know ("Mars/Olympus") is returned as given.
 */
export function getTimeZoneDisplayName(date: Date, timeZone?: string): string {
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  let label: string;
  try {
    label = getTimeZoneLabel(date, zone);
  } catch {
    // `Intl` throws a RangeError on an unknown zone
    return zone;
  }
  const city = getTimeZoneCity(zone);
  if (!city) return label;
  return `${label} ${city}`;
}
