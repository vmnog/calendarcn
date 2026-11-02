"use client";

import * as React from "react";
import { startOfWeek } from "date-fns";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  UploadIcon,
} from "lucide-react";

import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import type { DetailedCalendarEvent } from "@/components/calendar-types";
import { parseIcs, toIcs } from "@/lib/ics";
import { createSampleEvents } from "@/lib/sample-events";

/** File types the import picker offers */
const ICS_FILE_TYPES = ".ics,text/calendar";

/** Name of the downloaded file */
const EXPORT_FILE_NAME = "calendar.ics";

/** Status line shown until the first import */
const IMPORT_HINT = "Drop an .ics file on the calendar, or use Import.";

export function IcsDemo() {
  const [events, setEvents] = React.useState<DetailedCalendarEvent[]>(() =>
    createSampleEvents(new Date()),
  );

  // Imported events replace the ones with the same id (importing a file
  // twice updates it) and are added next to the others
  const importEvents = React.useCallback(
    (imported: DetailedCalendarEvent[]) => {
      const importedIds = new Set(imported.map((event) => event.id));
      setEvents((current) => [
        ...current.filter((event) => !importedIds.has(event.id)),
        ...imported,
      ]);
    },
    [],
  );

  return (
    <CalendarProvider events={events} onEventsChange={setEvents}>
      <IcsCalendar events={events} onImport={importEvents} />
    </CalendarProvider>
  );
}

interface IcsCalendarProps {
  events: DetailedCalendarEvent[];
  onImport: (events: DetailedCalendarEvent[]) => void;
}

function IcsCalendar({ events, onImport }: IcsCalendarProps) {
  const {
    monthName,
    year,
    weekStartsOn,
    goToToday,
    goToPrev,
    goToNext,
    goToDate,
  } = useCalendar();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [status, setStatus] = React.useState(IMPORT_HINT);
  const [isDraggingFile, setIsDraggingFile] = React.useState(false);

  const importFile = async (file: File) => {
    const imported = parseIcs(await file.text());
    if (imported.length === 0) {
      setStatus(`No events found in ${file.name}.`);
      return;
    }

    onImport(imported);
    // Jump to the week of the earliest imported event (a recurring event
    // shows once, at its first occurrence)
    const earliest = imported.reduce((first, event) =>
      event.start < first.start ? event : first,
    );
    goToDate(startOfWeek(earliest.start, { weekStartsOn }));
    const noun = imported.length === 1 ? "event" : "events";
    setStatus(`Imported ${imported.length} ${noun} from ${file.name}.`);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clear the input so picking the same file again imports it again
    event.target.value = "";
    if (file) void importFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingFile(false);
    const file = event.dataTransfer.files[0];
    if (file) void importFile(file);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold">
          {monthName} {year}
        </h2>
        <Button variant="secondary" size="sm" onClick={goToToday}>
          Today
        </Button>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous week"
            onClick={goToPrev}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next week"
            onClick={goToNext}
          >
            <ChevronRightIcon />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadIcon />
          Import .ics
        </Button>
        <Button variant="outline" size="sm" onClick={() => downloadIcs(events)}>
          <DownloadIcon />
          Export .ics
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ICS_FILE_TYPES}
          aria-label="Import .ics file"
          className="hidden"
          onChange={handleFileChange}
        />
      </header>
      <p
        role="status"
        className="truncate border-b px-3 py-1.5 text-xs text-muted-foreground"
      >
        {status}
      </p>
      <div
        className="relative min-h-0 flex-1"
        onDragEnter={(event) => {
          if (event.dataTransfer.types.includes("Files")) {
            setIsDraggingFile(true);
          }
        }}
      >
        <WeekView scrollToHour={8} />
        {/* Covers the calendar while a file is dragged over it, so the
            calendar's own pointer handlers never see the drag */}
        {isDraggingFile && (
          <div
            data-testid="ics-drop-zone"
            className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 p-3"
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDragLeave={() => setIsDraggingFile(false)}
            onDrop={handleDrop}
          >
            <div className="pointer-events-none flex size-full items-center justify-center rounded-lg border-2 border-dashed border-primary/40 text-sm font-medium">
              Drop the .ics file to import it
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Downloads the events as an .ics file */
function downloadIcs(events: DetailedCalendarEvent[]) {
  const ics = toIcs(events, { calendarName: "CalendarCN" });
  const url = URL.createObjectURL(
    new Blob([ics], { type: "text/calendar;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = EXPORT_FILE_NAME;
  link.click();
  // Revoke after the click has started the download
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
