"use client";

import * as React from "react";

import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { MonthView } from "@/components/month-view";
import { Switch } from "@/components/ui/switch";
import { createSampleEvents } from "@/lib/sample-events";

export function ViewSettingsDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider
      defaultView="month"
      defaultEvents={initialEvents}
      // The settings to start with. Each one you leave out keeps its default
      defaultViewSettings={{ showWeekNumbers: true }}
    >
      <div className="flex h-[600px] flex-col">
        <Settings />
        <div className="min-h-0 flex-1">
          <MonthView />
        </div>
      </div>
    </CalendarProvider>
  );
}

/** Your own controls for what the view dropdown and the command menu change */
function Settings() {
  const {
    viewSettings,
    weekStartsOn,
    toggleWeekends,
    toggleWeekNumbers,
    setWeekStartsOn,
  } = useCalendar();

  return (
    <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b px-3 py-2 text-sm">
      <label className="flex items-center gap-2">
        <Switch
          checked={viewSettings.showWeekends}
          onCheckedChange={toggleWeekends}
        />
        Weekends
      </label>
      <label className="flex items-center gap-2">
        <Switch
          checked={viewSettings.showWeekNumbers}
          onCheckedChange={toggleWeekNumbers}
        />
        Week numbers
      </label>
      <label className="flex items-center gap-2">
        <Switch
          checked={weekStartsOn === 1}
          onCheckedChange={(checked) => setWeekStartsOn(checked ? 1 : 0)}
        />
        Start on Monday
      </label>
    </div>
  );
}
