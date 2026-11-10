"use client";

import * as React from "react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { useCalendarShortcuts } from "@/hooks/use-calendar-shortcuts";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useMediaQuery } from "@/hooks/use-media-query";
import { AgendaView } from "@/components/agenda-view";
import { CalendarHeader } from "@/components/calendar-header";
import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { CalendarSidebar } from "@/components/calendar-sidebar";
import { CommandMenu } from "@/components/command-menu";
import {
  CONTEXT_PANEL_WIDTH,
  DetailsSidebar,
} from "@/components/details-sidebar";
import { MonthView } from "@/components/month-view";
import { TimeGrid } from "@/components/time-grid";
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { getPeriodStart } from "@/lib/event-utils";
import { parseIcs, toIcs } from "@/lib/ics";
import type { CalendarProviderProps } from "@/components/calendar-types";
import type {
  CalendarAppProps,
  DetailedCalendarEvent,
} from "@/components/week-view-types";

/** Hour the time grid opens on unless `scrollToHour` says otherwise */
const DEFAULT_SCROLL_HOUR = 8;

/** File types the command menu's .ics import offers */
const ICS_FILE_TYPES = ".ics,text/calendar";

/** Name of the file the command menu's .ics export downloads unless `exportFileName` says otherwise */
const DEFAULT_EXPORT_FILE_NAME = "calendar.ics";

/**
 * Viewports at least this wide keep both sidebars inline (Tailwind `xl`).
 * Narrower ones show the context panel as an overlay: inline, it would leave
 * the calendar under ~500px at 1024px (240px left + 308px right).
 */
const WIDE_LAYOUT_QUERY = "(min-width: 1280px)";

/** No events, for an app given neither `events` nor `defaultEvents` */
const NO_EVENTS: DetailedCalendarEvent[] = [];

/** CalendarAppProps that configure the app's chrome rather than the provider */
type CalendarAppShellOptions = Pick<
  CalendarAppProps,
  | "scrollToHour"
  | "headerActions"
  | "sidebarFooterActions"
  | "exportFileName"
  | "exportCalendarName"
  | "onOpenSettings"
  | "showComingSoon"
  | "shortcuts"
>;

interface CalendarAppStateProps extends Omit<CalendarAppProps, "className"> {
  /** Whether the context panel sits inline (true) or opens as an overlay */
  isWideLayout: boolean;
}

interface CalendarAppShellProps extends CalendarAppShellOptions {
  /** Whether the context panel sits inline (true) or opens as an overlay */
  isWideLayout: boolean;
  /** Adds events read from an .ics file, replacing those with the same id */
  onImportEvents: (events: DetailedCalendarEvent[]) => void;
}

/**
 * The live demo as one component: the calendar sidebar on the left, the
 * header and the day, week, month or agenda view in the middle, the details
 * sidebar on the right, the ⌘K command menu, theme cycling, .ics import and
 * export, and the keyboard shortcuts. Takes every `CalendarProvider` prop,
 * so events can be controlled or left to the app, and the calendars,
 * contacts, rooms and conferencing come from your data.
 *
 * It fills the viewport. On wide screens (1280px and up) both sidebars sit
 * inline; narrower, the details sidebar opens over the calendar, and on
 * phones the calendar sidebar does too.
 */
export function CalendarApp({ className, ...props }: CalendarAppProps) {
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
      className={cn("h-screen", className)}
      style={{ "--sidebar-width": CONTEXT_PANEL_WIDTH } as React.CSSProperties}
      open={contextPanelOpen}
      onOpenChange={setContextPanelOpen}
    >
      <CalendarAppState {...props} isWideLayout={isWideLayout} />
    </SidebarProvider>
  );
}

/**
 * The provider, with the app owning the events (so the command menu can
 * import an .ics file into them, controlled or not) and opening the phone
 * details sheet on select. Everything below reads the calendar state from
 * `useCalendar()`.
 */
function CalendarAppState({
  isWideLayout,
  events: eventsProp,
  defaultEvents,
  onEventsChange,
  onEventSelect,
  onEventsImport,
  scrollToHour,
  headerActions,
  sidebarFooterActions,
  exportFileName,
  exportCalendarName,
  onOpenSettings,
  showComingSoon,
  shortcuts,
  children,
  ...providerProps
}: CalendarAppStateProps) {
  const { isMobile, setOpenMobile: setContextPanelOpenMobile } = useSidebar();
  const [events, setEvents] = useControllableState({
    prop: eventsProp,
    defaultProp: defaultEvents ?? NO_EVENTS,
    onChange: onEventsChange,
  });

  // Phones show event details in the context panel sheet: the 320px popover
  // doesn't fit beside an event on a ~390px screen
  const handleEventSelect = React.useCallback(
    (eventId: string) => {
      onEventSelect?.(eventId);
      if (isMobile) setContextPanelOpenMobile(true);
    },
    [onEventSelect, isMobile, setContextPanelOpenMobile],
  );

  // Importing the same file again updates its events instead of adding copies
  const importEvents = React.useCallback(
    (imported: DetailedCalendarEvent[]) => {
      const importedIds = new Set(imported.map((event) => event.id));
      setEvents((current) => [
        ...current.filter((event) => !importedIds.has(event.id)),
        ...imported,
      ]);
      onEventsImport?.(imported);
    },
    [setEvents, onEventsImport],
  );

  // The provider reads only its own props. Its event type is erased here,
  // as in the Calendar block, because TypeScript can't check JSX props
  // against its generic conditional `createEvent` type.
  const calendarProviderProps: CalendarProviderProps = {
    ...(providerProps as CalendarProviderProps),
    events,
    onEventsChange: setEvents as CalendarProviderProps["onEventsChange"],
    onEventSelect: handleEventSelect,
    children: (
      <>
        <CalendarAppShell
          isWideLayout={isWideLayout}
          onImportEvents={importEvents}
          scrollToHour={scrollToHour}
          headerActions={headerActions}
          sidebarFooterActions={sidebarFooterActions}
          exportFileName={exportFileName}
          exportCalendarName={exportCalendarName}
          onOpenSettings={onOpenSettings}
          showComingSoon={showComingSoon}
          shortcuts={shortcuts}
        />
        {children}
      </>
    ),
  };

  return <CalendarProvider {...calendarProviderProps} />;
}

/**
 * The chrome around the calendar: sidebars, header, command menu, theme
 * cycling, .ics import and export, and the app shortcuts.
 */
function CalendarAppShell({
  isWideLayout,
  onImportEvents,
  scrollToHour = DEFAULT_SCROLL_HOUR,
  headerActions,
  sidebarFooterActions,
  exportFileName = DEFAULT_EXPORT_FILE_NAME,
  exportCalendarName,
  onOpenSettings,
  showComingSoon = false,
  shortcuts = true,
}: CalendarAppShellProps) {
  const { theme, setTheme } = useTheme();
  const {
    toggleSidebar,
    open: contextPanelOpen,
    openMobile: contextPanelOpenMobile,
    isMobile,
  } = useSidebar();
  const { view, weekStartsOn, events, numberOfDays, goToDate } =
    useCalendar<DetailedCalendarEvent>();
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
      new Blob([toIcs(events, { calendarName: exportCalendarName })], {
        type: "text/calendar;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [events, exportCalendarName, exportFileName]);

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
  // app's own, checked first: Cmd+K, Cmd+/, /, Shift+M and Cmd+,
  useCalendarShortcuts({
    enabled: shortcuts,
    onToggleCommandMenu: toggleCommandMenu,
    onToggleSidebar: toggleLeftSidebar,
    onToggleContextPanel: toggleSidebar,
    onCycleTheme: cycleTheme,
    onOpenSettings,
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
        showComingSoon={showComingSoon}
      />
      <input
        ref={icsInputRef}
        type="file"
        accept={ICS_FILE_TYPES}
        aria-label="Import .ics file"
        className="hidden"
        onChange={handleIcsFileChange}
      />
      <CalendarSidebar
        open={leftSidebarVisible}
        onOpenChange={setLeftOverlayOpen}
        overlay={isMobile}
        footerActions={sidebarFooterActions}
      />
      <SidebarInset className="flex flex-col overflow-hidden">
        <CalendarHeader
          sidebarOpen={leftSidebarVisible}
          onToggleSidebar={toggleLeftSidebar}
          contextPanelOpen={rightSidebarOpen}
          onToggleContextPanel={toggleSidebar}
        >
          {headerActions}
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
              scrollToHour={scrollToHour}
              showEventPopover={!showDetailsInPanel}
              onEventPopoverExpand={expandEventPopover}
            />
          )}
        </div>
      </SidebarInset>
      <DetailsSidebar overlay={!isWideLayout} />
    </>
  );
}
