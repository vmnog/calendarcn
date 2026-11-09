"use client";

import * as React from "react";

import { useTheme } from "next-themes";
import { useCalendarShortcuts } from "@/hooks/use-calendar-shortcuts";
import { useIsClient } from "@/hooks/use-is-client";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  DEMO_CALENDARS,
  DEMO_CONTACTS,
  DEMO_LOCATION_SUGGESTIONS,
  DEMO_PRIMARY_CALENDAR_ID,
  DEMO_ROOMS,
  generateMockEvents,
} from "@/lib/mock-events";
import { getPeriodStart, pickRandomEventColor } from "@/lib/event-utils";
import { parseIcs, toIcs } from "@/lib/ics";
import { AgendaView } from "@/components/agenda-view";
import { CalendarHeader } from "@/components/calendar-header";
import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { CommandMenu } from "@/components/command-menu";
import { CONTEXT_PANEL_WIDTH, SidebarLeft } from "@/components/sidebar-left";
import type {
  DetailedCalendarEvent,
  EventColor,
  NewEventRange,
  ViewSettings,
} from "@/components/week-view-types";
import { SidebarRight } from "@/components/sidebar-right";
import { MonthView } from "@/components/month-view";
import { TimeGrid } from "@/components/time-grid";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { DEMO_CONFERENCE_PROVIDERS } from "./demo-conference-providers";

/** Title given to an event created by clicking an empty time slot */
const NEW_EVENT_TITLE = "New event";

/** Hour the time grid opens on, so the first rows on screen hold the day's events */
const INITIAL_SCROLL_HOUR = 8;

/** File types the command menu's .ics import offers */
const ICS_FILE_TYPES = ".ics,text/calendar";

/** Name of the file the command menu's .ics export downloads */
const ICS_EXPORT_FILE_NAME = "calendarcn.ics";

/** Display preferences the demo starts with (week numbers shown) */
const DEMO_VIEW_SETTINGS: ViewSettings = {
  showWeekends: true,
  showDeclinedEvents: true,
  showWeekNumbers: true,
};

/**
 * Viewports at least this wide keep both sidebars inline (Tailwind `xl`).
 * Narrower ones show the context panel as an overlay: inline, it would leave
 * the calendar under ~500px at 1024px (240px left + 288px right).
 */
const WIDE_LAYOUT_QUERY = "(min-width: 1280px)";

interface PageContentProps {
  /** Whether the context panel sits inline (true) or opens as an overlay */
  isWideLayout: boolean;
}

interface CalendarDemoProps {
  /** Whether the context panel sits inline (true) or opens as an overlay */
  isWideLayout: boolean;
  /** Adds events read from an .ics file, replacing those with the same id */
  onImportEvents: (events: DetailedCalendarEvent[]) => void;
}

/** Cmd+, placeholder: settings aren't built yet, but the key is claimed already */
function openSettings() {}

/**
 * Demo setup: mock events, the demo's create-event policy, and opening the
 * phone details sheet on select. Everything below reads the calendar state
 * from `useCalendar()`.
 */
function PageContent({ isWideLayout }: PageContentProps) {
  const { isMobile, setOpenMobile: setContextPanelOpenMobile } = useSidebar();
  // The page owns the events, so the command menu can import an .ics file
  const [events, setEvents] = React.useState<DetailedCalendarEvent[]>(() =>
    generateMockEvents(),
  );
  /** Color given to the last click-created event, so the next one differs */
  const lastCreatedColorRef = React.useRef<EventColor | null>(null);

  const createDemoEvent = React.useCallback(
    (range: NewEventRange): DetailedCalendarEvent => {
      // Demo choice: a random color per created event makes each click visibly
      // new. A real app would use the target calendar's color instead.
      const color = pickRandomEventColor(lastCreatedColorRef.current);
      lastCreatedColorRef.current = color;
      return {
        id: crypto.randomUUID(),
        title: NEW_EVENT_TITLE,
        start: range.start,
        end: range.end,
        color,
        calendarId: DEMO_PRIMARY_CALENDAR_ID,
        calendarEmail: DEMO_PRIMARY_CALENDAR_ID,
      };
    },
    [],
  );

  // Phones show event details in the context panel sheet: the 320px popover
  // doesn't fit beside an event on a ~390px screen
  const handleEventSelect = React.useCallback(() => {
    if (isMobile) setContextPanelOpenMobile(true);
  }, [isMobile, setContextPanelOpenMobile]);

  // Importing the same file again updates its events instead of adding copies
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
    <CalendarProvider
      events={events}
      onEventsChange={setEvents}
      defaultViewSettings={DEMO_VIEW_SETTINGS}
      calendars={DEMO_CALENDARS}
      contacts={DEMO_CONTACTS}
      rooms={DEMO_ROOMS}
      conferenceProviders={DEMO_CONFERENCE_PROVIDERS}
      locationSuggestions={DEMO_LOCATION_SUGGESTIONS}
      createEvent={createDemoEvent}
      onEventSelect={handleEventSelect}
    >
      <CalendarDemo isWideLayout={isWideLayout} onImportEvents={importEvents} />
    </CalendarProvider>
  );
}

/**
 * Demo chrome around the calendar: sidebars, header, command menu, theme
 * cycling and app shortcuts.
 */
function CalendarDemo({ isWideLayout, onImportEvents }: CalendarDemoProps) {
  const { theme, setTheme } = useTheme();
  const {
    toggleSidebar,
    open: contextPanelOpen,
    openMobile: contextPanelOpenMobile,
    isMobile,
  } = useSidebar();
  const {
    view,
    currentDate,
    weekStartsOn,
    events,
    numberOfDays,
    visibleDays,
    displayMonth,
    selectedEvent,
    goToDate,
    previousInSeries,
    nextInSeries,
    showSeriesOccurrence,
    updateEvent,
  } = useCalendar<DetailedCalendarEvent>();
  // shadcn tracks the panel's phone state separately; read whichever is active
  const rightSidebarOpen = isMobile ? contextPanelOpenMobile : contextPanelOpen;
  /** Inline calendar sidebar state (tablet and desktop) */
  const [leftSidebarOpen, setLeftSidebarOpen] = React.useState(true);
  /** Calendar sidebar overlay state (phones); starts closed */
  const [leftOverlayOpen, setLeftOverlayOpen] = React.useState(false);
  // Close the overlay when leaving the phone layout, so it doesn't pop back
  // open the next time the viewport narrows
  const [prevIsMobile, setPrevIsMobile] = React.useState(isMobile);
  if (isMobile !== prevIsMobile) {
    setPrevIsMobile(isMobile);
    setLeftOverlayOpen(false);
  }
  const leftSidebarVisible = isMobile ? leftOverlayOpen : leftSidebarOpen;
  const [commandMenuOpen, setCommandMenuOpen] = React.useState(false);
  /** Hidden file picker behind the command menu's "Import .ics file" */
  const icsInputRef = React.useRef<HTMLInputElement>(null);

  // Phones show event details in the context panel sheet: the 320px popover
  // doesn't fit beside an event on a ~390px screen
  const showDetailsInPanel = isMobile || rightSidebarOpen;

  const toggleCommandMenu = React.useCallback(() => {
    setCommandMenuOpen((prev) => !prev);
  }, []);

  const toggleLeftSidebar = React.useCallback(() => {
    if (isMobile) {
      setLeftOverlayOpen((prev) => !prev);
      return;
    }
    setLeftSidebarOpen((prev) => !prev);
  }, [isMobile]);

  /** Mini calendar day pick: go to its period, and get the overlay out of the way on phones */
  const handleCalendarDateSelect = React.useCallback(
    (date: Date) => {
      goToDate(getPeriodStart(date, view, weekStartsOn, numberOfDays));
      setLeftOverlayOpen(false);
    },
    [goToDate, view, weekStartsOn, numberOfDays],
  );

  /** Imports the picked .ics file and shows the period of its first event */
  const handleIcsFileChange = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Clear the input so picking the same file again imports it again
      e.target.value = "";
      if (!file) return;
      const imported = parseIcs(await file.text());
      if (imported.length === 0) return;
      onImportEvents(imported);
      const earliest = imported.reduce((first, event) =>
        event.start < first.start ? event : first,
      );
      goToDate(
        getPeriodStart(earliest.start, view, weekStartsOn, numberOfDays),
      );
    },
    [onImportEvents, goToDate, view, weekStartsOn, numberOfDays],
  );

  const exportIcs = React.useCallback(() => {
    const url = URL.createObjectURL(
      new Blob([toIcs(events, { calendarName: "CalendarCN" })], {
        type: "text/calendar;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = ICS_EXPORT_FILE_NAME;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [events]);

  /** Popover expand button: move the details into the context panel */
  const expandEventPopover = React.useCallback(() => {
    if (!rightSidebarOpen) toggleSidebar();
  }, [rightSidebarOpen, toggleSidebar]);

  const cycleTheme = React.useCallback(() => {
    if (theme === "system") {
      setTheme("light");
      return;
    }
    if (theme === "light") {
      setTheme("dark");
      return;
    }
    setTheme("system");
  }, [theme, setTheme]);

  // Calendar shortcuts: T, J/K, arrows, D/1, W/0, 2-9, M, A, Escape, and
  // Shift+Cmd+E / Shift+Cmd+D for weekends and declined events. Then the
  // demo's own, checked first: Cmd+K, Cmd+/, /, Shift+M and Cmd+,
  useCalendarShortcuts({
    onToggleCommandMenu: toggleCommandMenu,
    onToggleSidebar: toggleLeftSidebar,
    onToggleContextPanel: toggleSidebar,
    onCycleTheme: cycleTheme,
    onOpenSettings: openSettings,
  });

  return (
    <>
      <CommandMenu
        open={commandMenuOpen}
        onOpenChange={setCommandMenuOpen}
        onToggleSidebar={toggleLeftSidebar}
        onToggleContextPanel={toggleSidebar}
        onCycleTheme={cycleTheme}
        onImportIcs={() => icsInputRef.current?.click()}
        onExportIcs={exportIcs}
        showComingSoon
      />
      <input
        ref={icsInputRef}
        type="file"
        accept={ICS_FILE_TYPES}
        aria-label="Import .ics file"
        className="hidden"
        onChange={handleIcsFileChange}
      />
      <SidebarRight
        open={leftSidebarVisible}
        onOpenChange={setLeftOverlayOpen}
        overlay={isMobile}
        onDateSelect={handleCalendarDateSelect}
        currentDate={
          view === "month" && displayMonth ? displayMonth : currentDate
        }
        visibleDays={view === "month" || view === "agenda" ? [] : visibleDays}
      />
      <SidebarInset className="flex flex-col overflow-hidden">
        <CalendarHeader
          sidebarOpen={leftSidebarVisible}
          onToggleSidebar={toggleLeftSidebar}
          contextPanelOpen={rightSidebarOpen}
          onToggleContextPanel={toggleSidebar}
        >
          <Avatar className="size-7">
            <AvatarImage
              src="https://github.com/vmnog.png"
              alt="Victor Nogueira"
            />
            <AvatarFallback>VN</AvatarFallback>
          </Avatar>
        </CalendarHeader>
        <div className="flex flex-1 flex-col overflow-hidden">
          {view === "month" && (
            <MonthView
              showEventPopover={!showDetailsInPanel}
              onEventPopoverExpand={expandEventPopover}
            />
          )}
          {view === "agenda" && (
            <AgendaView
              showEventPopover={!showDetailsInPanel}
              onEventPopoverExpand={expandEventPopover}
            />
          )}
          {/* One grid for day and week: switching re-lays it out instead of
              remounting, so the vertical scroll position is kept */}
          {(view === "day" || view === "week") && (
            <TimeGrid
              view={view}
              scrollToHour={INITIAL_SCROLL_HOUR}
              showEventPopover={!showDetailsInPanel}
              onEventPopoverExpand={expandEventPopover}
            />
          )}
        </div>
      </SidebarInset>
      <SidebarLeft
        overlay={!isWideLayout}
        events={events}
        selectedEvent={selectedEvent}
        onEventChange={updateEvent}
        onPrevWeek={
          previousInSeries
            ? () => showSeriesOccurrence(previousInSeries)
            : undefined
        }
        onNextWeek={
          nextInSeries ? () => showSeriesOccurrence(nextInSeries) : undefined
        }
      />
    </>
  );
}

export default function Page() {
  // Calendar state depends on the viewer's "today" and timezone, so it is
  // rendered only in the browser. Server and prerender output would bake in
  // the build date and the server's UTC timezone (React error #418).
  const isClient = useIsClient();
  const isWideLayout = useMediaQuery(WIDE_LAYOUT_QUERY);

  // The context panel starts open where it sits inline (wide screens) and
  // closed where it would cover the calendar. Crossing the breakpoint resets it.
  const [contextPanelOpen, setContextPanelOpen] = React.useState(isWideLayout);
  const [prevIsWideLayout, setPrevIsWideLayout] = React.useState(isWideLayout);
  if (isWideLayout !== prevIsWideLayout) {
    setPrevIsWideLayout(isWideLayout);
    setContextPanelOpen(isWideLayout);
  }

  return (
    <SidebarProvider
      className="h-screen"
      style={{ "--sidebar-width": CONTEXT_PANEL_WIDTH } as React.CSSProperties}
      open={contextPanelOpen}
      onOpenChange={setContextPanelOpen}
    >
      {isClient && <PageContent isWideLayout={isWideLayout} />}
    </SidebarProvider>
  );
}
