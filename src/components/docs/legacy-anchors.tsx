"use client";

import * as React from "react";

/**
 * Anchors of the old Calendar Core page and the guide each moved to.
 * `/docs/components/calendar-core` redirects to the API page, but a server
 * redirect never sees the `#anchor`, so the page sends these on from here.
 * Keep every entry: links in people's code, issues and posts use them.
 * Anchors not listed (Installation, Usage, the API entries) stay on the API page.
 */
export const CORE_ANCHOR_PAGES: Record<string, string> = {
  "controlled-or-uncontrolled": "/docs/guides/your-events",
  "selecting-several-events": "/docs/guides/your-events",
  "server-rendering": "/docs/guides/your-events",
  "several-events-selected": "/docs/guides/your-events",
  "undo-and-redo": "/docs/guides/undo-and-notices",
  notices: "/docs/guides/undo-and-notices",
  "creating-events": "/docs/guides/creating-events",
  "a-new-event-button": "/docs/guides/creating-events",
  "repeating-events": "/docs/guides/repeating-events",
  "editing-a-repeating-event": "/docs/guides/repeating-events",
  "time-zone": "/docs/guides/time-zones",
  "additional-time-zones": "/docs/guides/time-zones",
  "travel-to-a-time-zone": "/docs/guides/time-zones",
  "meeting-with-people": "/docs/guides/meet-with-people",
  "meet-with-someone": "/docs/guides/meet-with-people",
  configuration: "/docs/guides/customise-the-look",
  "view-settings": "/docs/guides/customise-the-look",
  "hour-size": "/docs/guides/customise-the-look",
  "custom-event-content": "/docs/guides/customise-the-look",
  "typed-events": "/docs/guides/customise-the-look",
  "switches-for-the-view-settings": "/docs/guides/customise-the-look",
};

/**
 * Sends an old Calendar Core anchor on to the guide it moved to, keeping the
 * anchor: `/docs/reference/api#creating-events` (where the old page redirects)
 * ends on `/docs/guides/creating-events#creating-events`. Renders nothing.
 */
export function LegacyAnchors() {
  React.useEffect(() => {
    const anchor = window.location.hash.slice(1);
    if (!Object.hasOwn(CORE_ANCHOR_PAGES, anchor)) return;
    window.location.replace(
      `${CORE_ANCHOR_PAGES[anchor]}${window.location.hash}`,
    );
  }, []);

  return null;
}
