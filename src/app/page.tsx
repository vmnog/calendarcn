"use client";

import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PanelLeftIcon,
  PanelRightIcon,
} from "lucide-react";

import {
  addDays,
  addMonths,
  addWeeks,
  format,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { useTheme } from "next-themes";
import { useIsClient } from "@/hooks/use-is-client";
import { useMediaQuery } from "@/hooks/use-media-query";
import { generateMockEvents } from "@/lib/mock-events";
import { CommandMenu } from "@/components/command-menu";
import { SidebarLeft } from "@/components/sidebar-left";
import type {
  CalendarEvent,
  EventColor,
  NewEventRange,
  ViewSettings,
  ViewType,
} from "@/components/week-view-types";
import { EventTitleFocusProvider } from "@/components/event-title-focus-context";
import { SidebarRight } from "@/components/sidebar-right";
import { MonthView } from "@/components/month-view";
import {
  WeekView,
  getCalendarHeaderInfo,
  getVisibleDays,
} from "@/components/week-view";
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

/** Title given to an event created by clicking an empty time slot */
const NEW_EVENT_TITLE = "New event";

/** Primary calendar (and its account email) that click-created events belong to */
const PRIMARY_CALENDAR_ID = "me@vmnog.com";

/** Color of the primary calendar, matching its entry in the calendar list */
const PRIMARY_CALENDAR_COLOR: EventColor = "red";

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

function PageContent({ isWideLayout }: PageContentProps) {
  const { theme, setTheme } = useTheme();
  const {
    toggleSidebar,
    open: contextPanelOpen,
    openMobile: contextPanelOpenMobile,
    setOpenMobile: setContextPanelOpenMobile,
    isMobile,
  } = useSidebar();
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
  const [view, setView] = React.useState<ViewType>("week");
  const [currentDate, setCurrentDate] = React.useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 }),
  );
  const [events, setEvents] = React.useState(() => generateMockEvents());
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(
    null,
  );
  const [commandMenuOpen, setCommandMenuOpen] = React.useState(false);
  const [numberOfDays, setNumberOfDays] = React.useState(7);
  const [viewSettings, setViewSettings] = React.useState<ViewSettings>({
    showWeekends: true,
    showDeclinedEvents: true,
    showWeekNumbers: true,
  });
  const [highlightedDate, setHighlightedDate] = React.useState<Date | null>(
    null,
  );
  const [monthViewDisplayMonth, setMonthViewDisplayMonth] =
    React.useState<Date | null>(null);
  const selectedEvent = React.useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  // Phones show event details in the context panel sheet: the 320px popover
  // doesn't fit beside an event on a ~390px screen
  const showDetailsInPanel = isMobile || rightSidebarOpen;

  const selectEvent = React.useCallback(
    (eventId: string) => {
      setSelectedEventId(eventId);
      if (isMobile) setContextPanelOpenMobile(true);
    },
    [isMobile, setContextPanelOpenMobile],
  );

  const handleEventChange = React.useCallback((updatedEvent: CalendarEvent) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e)),
    );
  }, []);

  /** ID of a just-created event whose title input should be focused once */
  const [titleFocusEventId, setTitleFocusEventId] = React.useState<
    string | null
  >(null);
  // Only honor the focus request while that event is still the selected one
  const pendingTitleFocusId =
    titleFocusEventId === selectedEventId ? titleFocusEventId : null;

  const clearTitleFocus = React.useCallback(() => {
    setTitleFocusEventId(null);
  }, []);

  const handleEventCreate = React.useCallback(
    (range: NewEventRange) => {
      const newEvent: CalendarEvent = {
        id: crypto.randomUUID(),
        title: NEW_EVENT_TITLE,
        start: range.start,
        end: range.end,
        color: PRIMARY_CALENDAR_COLOR,
        calendarId: PRIMARY_CALENDAR_ID,
        calendarEmail: PRIMARY_CALENDAR_ID,
      };
      setEvents((prev) => [...prev, newEvent]);
      selectEvent(newEvent.id);
      setTitleFocusEventId(newEvent.id);
    },
    [selectEvent],
  );

  const goToToday = React.useCallback(() => {
    if (view === "day") {
      setCurrentDate(startOfDay(new Date()));
    } else if (view === "month") {
      setCurrentDate(startOfWeek(new Date(), { weekStartsOn: 0 }));
    } else {
      setCurrentDate(startOfWeek(new Date(), { weekStartsOn: 0 }));
    }
  }, [view]);

  const goToPrev = React.useCallback(() => {
    if (view === "day") {
      setCurrentDate((prev) => addDays(prev, -1));
    } else if (view === "month") {
      setCurrentDate((prev) => addMonths(prev, -1));
    } else {
      setCurrentDate((prev) => addWeeks(prev, -1));
    }
  }, [view]);

  const goToNext = React.useCallback(() => {
    if (view === "day") {
      setCurrentDate((prev) => addDays(prev, 1));
    } else if (view === "month") {
      setCurrentDate((prev) => addMonths(prev, 1));
    } else {
      setCurrentDate((prev) => addWeeks(prev, 1));
    }
  }, [view]);

  const goToDate = React.useCallback((date: Date) => setCurrentDate(date), []);

  const toggleLeftSidebar = React.useCallback(() => {
    if (isMobile) {
      setLeftOverlayOpen((prev) => !prev);
      return;
    }
    setLeftSidebarOpen((prev) => !prev);
  }, [isMobile]);

  const goToDateWeek = React.useCallback(
    (date: Date) => {
      if (view === "day") {
        setCurrentDate(startOfDay(date));
      } else {
        setCurrentDate(startOfWeek(date, { weekStartsOn: 0 }));
      }
    },
    [view],
  );

  /** Mini calendar day pick: navigate, and get the overlay out of the way on phones */
  const handleCalendarDateSelect = React.useCallback(
    (date: Date) => {
      goToDateWeek(date);
      setLeftOverlayOpen(false);
    },
    [goToDateWeek],
  );

  const switchView = React.useCallback(
    (newView: ViewType) => {
      if (newView === view) return;
      setView(newView);
      if (newView === "day") {
        setCurrentDate(startOfDay(new Date()));
        return;
      }
      if (newView === "month") {
        setCurrentDate((prev) => startOfWeek(prev, { weekStartsOn: 0 }));
        return;
      }
      setCurrentDate((prev) => startOfWeek(prev, { weekStartsOn: 0 }));
    },
    [view],
  );

  const handleMoreClick = React.useCallback((date: Date) => {
    setView("week");
    setCurrentDate(startOfWeek(date, { weekStartsOn: 0 }));
    setHighlightedDate(date);
  }, []);

  React.useEffect(() => {
    if (!highlightedDate) return;
    const timer = setTimeout(() => setHighlightedDate(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightedDate]);

  const toggleWeekends = React.useCallback(() => {
    setViewSettings((prev) => ({ ...prev, showWeekends: !prev.showWeekends }));
  }, []);

  const toggleDeclinedEvents = React.useCallback(() => {
    setViewSettings((prev) => ({
      ...prev,
      showDeclinedEvents: !prev.showDeclinedEvents,
    }));
  }, []);

  const toggleWeekNumbers = React.useCallback(() => {
    setViewSettings((prev) => ({
      ...prev,
      showWeekNumbers: !prev.showWeekNumbers,
    }));
  }, []);

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

  const [visibleDays, setVisibleDays] = React.useState<Date[]>(() =>
    getVisibleDays(currentDate, view),
  );

  // Sync sidebar mini-calendar when in month view
  React.useEffect(() => {
    if (view !== "month") return;
    // Pass empty array — sidebar mini-calendar syncs via monthViewDisplayMonth
    setVisibleDays([]);
  }, [view]);

  const headerDate =
    view === "month"
      ? (monthViewDisplayMonth ?? currentDate)
      : (visibleDays[0] ?? currentDate);
  // Week/day views name the month after the LAST visible day, so a week
  // crossing into the next month is labeled with the later month (Notion
  // Calendar's behavior). Month view labels its own month instead.
  const headerRangeEnd =
    view === "month" ? undefined : visibleDays[visibleDays.length - 1];
  const { monthName, year, weekNumber } = getCalendarHeaderInfo(
    headerDate,
    0,
    headerRangeEnd,
  );

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K for command menu
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandMenuOpen((prev) => !prev);
        return;
      }
      // Command + / for left sidebar
      if (e.metaKey && e.key === "/") {
        e.preventDefault();
        toggleLeftSidebar();
        return;
      }
      // Shift+Cmd+E for toggle weekends
      if (e.key === "e" && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleWeekends();
        return;
      }
      // Shift+Cmd+D for toggle declined events
      if (e.key === "d" && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleDeclinedEvents();
        return;
      }
      // Cmd+, for general settings (placeholder)
      if (e.key === "," && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        return;
      }
      // Escape to deselect event
      if (e.key === "Escape") {
        setSelectedEventId(null);
        return;
      }

      // Skip single-key shortcuts when focused on input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }

      // / for right sidebar
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // T for today
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        goToToday();
        return;
      }

      // 1 for day view
      if (e.key === "1") {
        e.preventDefault();
        switchView("day");
        return;
      }

      // D for day view
      if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        switchView("day");
        return;
      }

      // 0 for week view
      if (e.key === "0") {
        e.preventDefault();
        switchView("week");
        return;
      }

      // W for week view
      if (e.key === "w" || e.key === "W") {
        e.preventDefault();
        switchView("week");
        return;
      }

      // 2-9 for number of days
      if (/^[2-9]$/.test(e.key)) {
        e.preventDefault();
        setNumberOfDays(Number(e.key));
        return;
      }

      // J or ArrowLeft for previous period
      if (e.key === "j" || e.key === "J" || e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrev();
        return;
      }

      // K or ArrowRight for next period
      if (e.key === "k" || e.key === "K" || e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
        return;
      }

      // Shift+M for cycle theme
      if (e.key === "M" && e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        cycleTheme();
        return;
      }

      // m for month view (lowercase only, no shift)
      if (e.key === "m") {
        e.preventDefault();
        switchView("month");
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    toggleSidebar,
    toggleLeftSidebar,
    goToToday,
    goToPrev,
    goToNext,
    switchView,
    toggleWeekends,
    toggleDeclinedEvents,
    cycleTheme,
  ]);

  return (
    <EventTitleFocusProvider
      pendingEventId={pendingTitleFocusId}
      clearPending={clearTitleFocus}
    >
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
      />
      <SidebarRight
        open={leftSidebarVisible}
        onOpenChange={setLeftOverlayOpen}
        overlay={isMobile}
        onDateSelect={handleCalendarDateSelect}
        currentDate={
          view === "month" && monthViewDisplayMonth
            ? monthViewDisplayMonth
            : currentDate
        }
        visibleDays={view === "month" ? [] : visibleDays}
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
                <span className="sr-only">
                  {view === "day"
                    ? "Previous day"
                    : view === "month"
                      ? "Previous month"
                      : "Previous week"}
                </span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground @2xs/header:size-8"
                onClick={goToNext}
              >
                <ChevronRightIcon className="size-4" />
                <span className="sr-only">
                  {view === "day"
                    ? "Next day"
                    : view === "month"
                      ? "Next month"
                      : "Next week"}
                </span>
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
          {view === "month" ? (
            <MonthView
              currentDate={currentDate}
              events={events}
              viewSettings={viewSettings}
              onEventClick={(e) => selectEvent(e.id)}
              selectedEventId={selectedEvent?.id}
              onBackgroundClick={() => setSelectedEventId(null)}
              onEventChange={handleEventChange}
              onDateChange={goToDate}
              onDisplayMonthChange={setMonthViewDisplayMonth}
              onMoreClick={handleMoreClick}
              onDayNumberClick={handleMoreClick}
              isSidebarOpen={showDetailsInPanel}
              onDockToSidebar={() => {
                if (!rightSidebarOpen) toggleSidebar();
              }}
              onClosePopover={() => setSelectedEventId(null)}
            />
          ) : (
            <WeekView
              view={view}
              currentDate={currentDate}
              events={events}
              onEventClick={(e) => selectEvent(e.id)}
              selectedEventId={selectedEvent?.id}
              onBackgroundClick={() => setSelectedEventId(null)}
              onEventCreate={handleEventCreate}
              onDateChange={goToDate}
              onVisibleDaysChange={setVisibleDays}
              onEventChange={handleEventChange}
              isSidebarOpen={showDetailsInPanel}
              onDockToSidebar={() => {
                if (!rightSidebarOpen) toggleSidebar();
              }}
              onClosePopover={() => setSelectedEventId(null)}
              onPrevWeek={goToPrev}
              onNextWeek={goToNext}
              highlightedDate={highlightedDate}
            />
          )}
        </div>
      </SidebarInset>
      <SidebarLeft
        overlay={!isWideLayout}
        events={events}
        selectedEvent={selectedEvent}
        onEventChange={handleEventChange}
        onPrevWeek={goToPrev}
        onNextWeek={goToNext}
      />
    </EventTitleFocusProvider>
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
