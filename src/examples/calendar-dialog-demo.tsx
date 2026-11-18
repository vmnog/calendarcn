"use client";

import * as React from "react";

import { Calendar } from "@/components/calendar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createSampleEvents } from "@/lib/sample-events";

export function CalendarDialogDemo() {
  // The calendar reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <div className="flex h-full items-center justify-center">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">Open the calendar</Button>
        </DialogTrigger>
        {/* No `overflow-hidden` on the dialog: it would clip the event details */}
        <DialogContent className="flex h-[min(680px,85vh)] flex-col gap-0 p-0 sm:max-w-4xl">
          <DialogHeader className="shrink-0 border-b px-4 py-3">
            <DialogTitle>Team calendar</DialogTitle>
            <DialogDescription className="sr-only">
              Every event of the team. Drag one to move it.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1">
            <Calendar
              defaultEvents={initialEvents}
              // Several calendars share this docs page, so the single-key shortcuts stay off
              shortcuts={false}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
