import * as React from "react";

import { getTimeZoneDisplayName, getTimeZoneLabel } from "@/lib/timezone-label";

/**
 * Label rendered on the server and during hydration. It must not depend on
 * the runtime's timezone, or server and client markup would differ (#418).
 */
const SERVER_TIMEZONE_LABEL = "";

/** No-op subscription: the label is re-read on every client render. */
function subscribe(): () => void {
  return () => {};
}

function getServerSnapshot(): string {
  return SERVER_TIMEZONE_LABEL;
}

/**
 * Returns the short timezone label ("EDT", "GMT-3", "GMT+5:30") of
 * `timeZone`, the viewer's zone by default.
 *
 * Server rendering and the client's hydration render both return
 * `SERVER_TIMEZONE_LABEL`, so the markup matches. React then re-renders
 * with the client snapshot right after hydration. Client-only renders
 * (no SSR) get the real label on the first render.
 */
export function useTimeZoneLabel(timeZone?: string): string {
  const getClientSnapshot = React.useCallback(
    () => getTimeZoneLabel(new Date(), timeZone),
    [timeZone],
  );
  return React.useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
}

/**
 * Returns the timezone label with its city ("GMT-3 Sao Paulo", "EDT New
 * York") of `timeZone`, the viewer's zone by default. Like
 * `useTimeZoneLabel`, it is empty on the server and during hydration.
 */
export function useTimeZoneDisplayName(timeZone?: string): string {
  const getClientSnapshot = React.useCallback(
    () => getTimeZoneDisplayName(new Date(), timeZone),
    [timeZone],
  );
  return React.useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
}
