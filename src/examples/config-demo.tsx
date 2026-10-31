"use client";

import * as React from "react";
import { ptBR } from "date-fns/locale";

import { CalendarProvider } from "@/components/calendar-provider";
import { WeekView } from "@/components/week-view";
import type { WeekStartsOn } from "@/components/calendar-types";
import { createSampleEvents } from "@/lib/sample-events";

/** Weeks start on Monday */
const WEEK_STARTS_ON: WeekStartsOn = 1;

export function ConfigDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() =>
    createSampleEvents(new Date(), WEEK_STARTS_ON),
  );

  return (
    <CalendarProvider
      defaultEvents={initialEvents}
      // 24-hour clock: "15:00" instead of "3 PM"
      hourCycle={24}
      // Day and month names, dates and week numbers in Portuguese
      locale={ptBR}
      weekStartsOn={WEEK_STARTS_ON}
      // Only working hours: the grid runs from 08:00 to 20:00
      dayStartHour={8}
      dayEndHour={20}
      // Drag, resize and click-to-create move in 30-minute steps
      snapMinutes={30}
    >
      <WeekView />
    </CalendarProvider>
  );
}
