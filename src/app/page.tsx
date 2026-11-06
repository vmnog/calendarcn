"use client";

import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PanelLeftIcon,
  PanelRightIcon,
} from "lucide-react";

import { addDays, format } from "date-fns";
import { useTheme } from "next-themes";
import {
  isTypingTarget,
  useCalendarShortcuts,
} from "@/hooks/use-calendar-shortcuts";
import { useIsClient } from "@/hooks/use-is-client";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  DEMO_CONTACTS,
  DEMO_LOCATION_SUGGESTIONS,
  DEMO_ROOMS,
  generateMockEvents,
} from "@/lib/mock-events";
import {
  AGENDA_DAYS,
  getPeriodStart,
  pickRandomEventColor,
} from "@/lib/event-utils";
import { parseIcs, toIcs } from "@/lib/ics";
import { AgendaView } from "@/components/agenda-view";
import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { CommandMenu } from "@/components/command-menu";
import { SidebarLeft } from "@/components/sidebar-left";
import type {
  CalendarInfo,
  DetailedCalendarEvent,
  EventColor,
  NewEventRange,
  ViewSettings,
  ViewType,
} from "@/components/week-view-types";
import { SidebarRight } from "@/components/sidebar-right";
import { MonthView } from "@/components/month-view";
import { TimeGrid } from "@/components/time-grid";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ViewDropdown } from "@/components/view-dropdown";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import { DEMO_CONFERENCE_PROVIDERS } from "./demo-conference-providers";

/** Title given to an event created by clicking an empty time slot */
const NEW_EVENT_TITLE = "New event";

/** Primary calendar (and its account email) that click-created events belong to */
const PRIMARY_CALENDAR_ID = "me@vmnog.com";

/** Hour the time grid opens on, so the first rows on screen hold the day's events */
const INITIAL_SCROLL_HOUR = 8;

/** File types the command menu's .ics import offers */
const ICS_FILE_TYPES = ".ics,text/calendar";

/** Name of the file the command menu's .ics export downloads */
const ICS_EXPORT_FILE_NAME = "calendarcn.ics";

/**
 * Calendars of the demo account, offered by the event context menu. Ids are
 * the names, matching the `calendarId`s of the mock events.
 */
const DEMO_CALENDARS: CalendarInfo[] = [
  {
    id: PRIMARY_CALENDAR_ID,
    name: PRIMARY_CALENDAR_ID,
    color: "red",
    email: PRIMARY_CALENDAR_ID,
  },
  {
    id: "Personal",
    name: "Personal",
    color: "purple",
    email: PRIMARY_CALENDAR_ID,
  },
  { id: "Work", name: "Work", color: "blue", email: PRIMARY_CALENDAR_ID },
  { id: "Family", name: "Family", color: "orange", email: PRIMARY_CALENDAR_ID },
  {
    id: "Side Projects",
    name: "Side Projects",
    color: "yellow",
    email: PRIMARY_CALENDAR_ID,
  },
  {
    id: "Fitness",
    name: "Fitness",
    color: "green",
    email: PRIMARY_CALENDAR_ID,
  },
  {
    id: "Holidays in Brazil",
    name: "Holidays in Brazil",
    color: "green",
    email: PRIMARY_CALENDAR_ID,
  },
];

/** What the previous/next buttons move by in each view, for their labels */
const PERIOD_LABELS: Record<ViewType, string> = {
  day: "day",
  week: "week",
  month: "month",
  agenda: `${AGENDA_DAYS} days`,
};

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

/** App-level actions behind the demo's own keyboard shortcuts */
interface AppShortcutActions {
  toggleCommandMenu: () => void;
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  cycleTheme: () => void;
}

/**
 * Handles the demo's app shortcuts (command menu, sidebars, settings,
 * theme). A shortcut that fires stops the event, so the calendar shortcuts
 * listener (added after this one) never also acts on it, e.g. Shift+M vs M.
 */
function handleAppShortcut(e: KeyboardEvent, actions: AppShortcutActions) {
  const runShortcut = (action: () => void) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    action();
  };

  // Cmd+K for command menu
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    runShortcut(actions.toggleCommandMenu);
    return;
  }
  // Command + / for left sidebar
  if (e.metaKey && e.key === "/") {
    runShortcut(actions.toggleLeftSidebar);
    return;
  }
  // Cmd+, for general settings (placeholder)
  if (e.key === "," && (e.metaKey || e.ctrlKey)) {
    runShortcut(() => {});
    return;
  }

  // Skip single-key shortcuts when focused on input/textarea
  if (isTypingTarget(e.target)) return;

  // / for right sidebar
  if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
    runShortcut(actions.toggleRightSidebar);
    return;
  }
  // Shift+M for cycle theme
  if (e.key === "M" && e.shiftKey && !e.metaKey && !e.ctrlKey) {
    runShortcut(actions.cycleTheme);
  }
}

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
        calendarId: PRIMARY_CALENDAR_ID,
        calendarEmail: PRIMARY_CALENDAR_ID,
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
    viewSettings,
    visibleDays,
    displayMonth,
    selectedEvent,
    monthName,
    year,
    weekNumber,
    goToToday,
    goToPrev,
    goToNext,
    goToDate,
    switchView,
    setNumberOfDays,
    updateEvent,
    toggleWeekends,
    toggleDeclinedEvents,
    toggleWeekNumbers,
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

  /** Latest app shortcut actions, read by the window listener */
  const appShortcutsRef = React.useRef<AppShortcutActions>({
    toggleCommandMenu,
    toggleLeftSidebar,
    toggleRightSidebar: toggleSidebar,
    cycleTheme,
  });

  React.useEffect(() => {
    appShortcutsRef.current = {
      toggleCommandMenu,
      toggleLeftSidebar,
      toggleRightSidebar: toggleSidebar,
      cycleTheme,
    };
  }, [toggleCommandMenu, toggleLeftSidebar, toggleSidebar, cycleTheme]);

  // App shortcuts. Added once, before useCalendarShortcuts below, so this
  // listener always runs first and can claim keys the calendar also uses
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleAppShortcut(e, appShortcutsRef.current);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Calendar shortcuts: T, J/K, arrows, D/1, W/0, 2-9, M, A, Escape, and
  // Shift+Cmd+E / Shift+Cmd+D for weekends and declined events
  useCalendarShortcuts();

  return (
    <>
      <CommandMenu
        open={commandMenuOpen}
        onOpenChange={setCommandMenuOpen}
        onGoToToday={goToToday}
        onGoToPrev={goToPrev}
        onGoToNext={goToNext}
        onSwitchView={switchView}
        onToggleLeftSidebar={toggleLeftSidebar}
        onToggleRightSidebar={toggleSidebar}
        onCycleTheme={cycleTheme}
        onImportIcs={() => icsInputRef.current?.click()}
        onExportIcs={exportIcs}
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
        <header className="@container/header bg-background sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1 pl-2 @md/header:gap-2 @xl/header:px-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground"
                  onClick={toggleLeftSidebar}
                >
                  <PanelLeftIcon />
                  <span className="sr-only">Toggle Calendar Sidebar</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {leftSidebarVisible ? "Close" : "Open"} sidebar{" "}
                <Kbd className="ml-1">⌘</Kbd> <Kbd>/</Kbd>
              </TooltipContent>
            </Tooltip>
            <Separator
              orientation="vertical"
              className="mr-2 hidden data-[orientation=vertical]:h-4 @md/header:block"
            />
            <h1 className="min-w-0 truncate text-sm @xs/header:text-base @xl/header:text-xl">
              {/* Narrow headers use the short month ("Sep"); en-US "MMMM" names abbreviate to their first three letters */}
              <span className="font-extrabold @md/header:hidden">
                {monthName.slice(0, 3)}
              </span>
              <span className="hidden font-extrabold @md/header:inline">
                {monthName}
              </span>{" "}
              <span className="font-extrabold">{year}</span>{" "}
              <span className="text-muted-foreground hidden text-xs @xl/header:inline">
                {view === "day" && format(currentDate, "EEEE, MMM d")}
                {view === "week" && `Week ${weekNumber}`}
                {view === "month" && ""}
                {view === "agenda" &&
                  `${format(currentDate, "MMM d")} \u2013 ${format(addDays(currentDate, AGENDA_DAYS - 1), "MMM d")}`}
              </span>
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1 pr-2 @md/header:gap-2 @xl/header:px-4">
            <Avatar className="hidden size-7 @xl/header:flex">
              <AvatarImage
                src="https://github.com/vmnog.png"
                alt="Victor Nogueira"
              />
              <AvatarFallback>VN</AvatarFallback>
            </Avatar>
            <div className="hidden @xs/header:block">
              <ViewDropdown
                view={view}
                numberOfDays={numberOfDays}
                viewSettings={viewSettings}
                onSwitchView={switchView}
                onSetNumberOfDays={setNumberOfDays}
                onToggleWeekends={toggleWeekends}
                onToggleDeclinedEvents={toggleDeclinedEvents}
                onToggleWeekNumbers={toggleWeekNumbers}
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="px-2 @md/header:px-3"
              onClick={goToToday}
            >
              Today
            </Button>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground @2xs/header:size-8"
                onClick={goToPrev}
              >
                <ChevronLeftIcon className="size-4" />
                <span className="sr-only">Previous {PERIOD_LABELS[view]}</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground @2xs/header:size-8"
                onClick={goToNext}
              >
                <ChevronRightIcon className="size-4" />
                <span className="sr-only">Next {PERIOD_LABELS[view]}</span>
              </Button>
            </div>
            {!rightSidebarOpen && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground"
                    onClick={toggleSidebar}
                  >
                    <PanelRightIcon />
                    <span className="sr-only">Toggle Navigation Sidebar</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Open context panel <Kbd className="ml-1">/</Kbd>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </header>
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
        onPrevWeek={goToPrev}
        onNextWeek={goToNext}
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
      open={contextPanelOpen}
      onOpenChange={setContextPanelOpen}
    >
      {isClient && <PageContent isWideLayout={isWideLayout} />}
    </SidebarProvider>
  );
}
