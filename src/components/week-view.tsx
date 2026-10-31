"use client";

import type { WeekViewProps } from "./week-view-types";
import { TimeGrid } from "./time-grid";

/**
 * Week calendar: `numberOfDays` columns (7 by default) on the hourly time
 * grid. Date, events and selection come from the surrounding
 * CalendarProvider, which navigates by week while this view is mounted.
 */
export function WeekView(props: WeekViewProps) {
  return <TimeGrid {...props} view="week" />;
}
