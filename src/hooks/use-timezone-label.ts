import * as React from "react";

import { getTimeZoneLabel } from "@/lib/timezone-label";

/**
 * Label rendered on the server and during hydration. It must not depend on
 * the runtime's timezone, or server and client markup would differ (#418).
 */
const SERVER_TIMEZONE_LABEL = "";

/** No-op subscription: the label is re-read on every client render. */
function subscribe(): () => void {
  return () => {};
}

function getClientSnapshot(): string {
  return getTimeZoneLabel(new Date());
}

function getServerSnapshot(): string {
  return SERVER_TIMEZONE_LABEL;
}

/**
 * Returns the viewer's short timezone label ("EDT", "GMT-3", "GMT+5:30").
 *
 * Server rendering and the client's hydration render both return
 * `SERVER_TIMEZONE_LABEL`, so the markup matches. React then re-renders
 * with the client snapshot right after hydration. Client-only renders
 * (no SSR) get the real label on the first render.
 */
export function useTimeZoneLabel(): string {
  return React.useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
}
