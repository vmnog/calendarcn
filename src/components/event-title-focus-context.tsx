"use client";

import * as React from "react";

/**
 * Context that carries a one-shot request to focus an event's title input.
 * Set by page.tsx right after click-to-create so the user can type a name
 * immediately; the detail panel host that is actually visible (sidebar or
 * popover) consumes it and clears it.
 */
interface EventTitleFocusValue {
  /** ID of the event whose title input should be focused, or null */
  pendingEventId: string | null;
  /** Clears the request once the title input has been focused */
  clearPending: () => void;
}

const EventTitleFocusContext = React.createContext<EventTitleFocusValue>({
  pendingEventId: null,
  clearPending: () => {},
});

export function EventTitleFocusProvider({
  pendingEventId,
  clearPending,
  children,
}: EventTitleFocusValue & { children: React.ReactNode }) {
  const value = React.useMemo(
    () => ({ pendingEventId, clearPending }),
    [pendingEventId, clearPending],
  );

  return (
    <EventTitleFocusContext.Provider value={value}>
      {children}
    </EventTitleFocusContext.Provider>
  );
}

export function useEventTitleFocus() {
  return React.useContext(EventTitleFocusContext);
}
