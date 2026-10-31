"use client";

import type { ComponentProps } from "react";
import { Tab } from "fumadocs-ui/components/tabs";

/**
 * Fumadocs `Tab` whose panel can't take focus, for live calendar previews.
 *
 * Radix makes tab panels focusable (tabIndex 0). Pressing an event
 * re-renders it with its details popover, so the browser then focuses the
 * nearest focusable ancestor (this panel), and the popover reads that as
 * focus moving outside and closes. Without a tabIndex, focus stays on
 * <body>, as it does when the calendar sits directly in a page.
 *
 * A client component because server components drop `undefined` props, so
 * the override would never reach Radix.
 */
export function PreviewTab(props: ComponentProps<typeof Tab>) {
  return <Tab {...props} tabIndex={undefined} />;
}
