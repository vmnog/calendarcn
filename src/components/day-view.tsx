"use client";

import type { DayViewProps } from "./week-view-types";
import { TimeGrid } from "./time-grid";

/**
 * Single-day calendar on the hourly time grid. Date, events and selection
 * come from the surrounding CalendarProvider, which navigates by day while
 * this view is mounted.
 */
export function DayView(props: DayViewProps) {
  return <TimeGrid {...props} view="day" />;
}
