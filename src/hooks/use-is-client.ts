import * as React from "react";

/** No-op subscription: whether we are on the client never changes after hydration. */
function subscribe(): () => void {
  return () => {};
}

function getClientSnapshot(): boolean {
  return true;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Returns `false` during server rendering and hydration, `true` afterwards.
 *
 * Use it to render content that depends on the viewer's clock or timezone
 * (today's week, timezone labels) only in the browser. The page is
 * prerendered at build time on a UTC server, so rendering that content on
 * the server bakes in the build date and timezone and breaks hydration.
 */
export function useIsClient(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
}
