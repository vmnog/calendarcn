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
