"use client";

import * as React from "react";

import { Calendar } from "@/components/calendar";
import { createSampleEvents } from "@/lib/sample-events";

export function CalendarDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return <Calendar defaultEvents={initialEvents} />;
}
