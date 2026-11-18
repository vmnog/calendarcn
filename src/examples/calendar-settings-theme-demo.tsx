"use client";

import * as React from "react";
import { useTheme } from "next-themes";

import { CalendarProvider } from "@/components/calendar-provider";
import { CalendarSettingsDialog } from "@/components/calendar-settings";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import type { CalendarTheme, HourCycle } from "@/components/calendar-types";
import { createSampleEvents } from "@/lib/sample-events";

/** The themes the dialog offers */
const THEMES: CalendarTheme[] = ["system", "light", "dark"];

export function CalendarSettingsThemeDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));
  const [open, setOpen] = React.useState(false);
  // The clock is the provider's `hourCycle`, so your app keeps it
  const [hourCycle, setHourCycle] = React.useState<HourCycle>(12);
  // next-themes, from the ThemeProvider around your app
  const { theme, setTheme } = useTheme();

  return (
    <CalendarProvider defaultEvents={initialEvents} hourCycle={hourCycle}>
      <div className="flex h-[600px] flex-col">
        <div className="flex h-12 shrink-0 items-center border-b px-3">
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            Open settings
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          <WeekView scrollToHour={8} />
        </div>
      </div>
      <CalendarSettingsDialog
        open={open}
        onOpenChange={setOpen}
        // A setting shows only when something can change it: these two
        // handlers add the theme and the time format to General
        theme={THEMES.find((option) => option === theme)}
        onThemeChange={setTheme}
        onHourCycleChange={setHourCycle}
      />
    </CalendarProvider>
  );
}
