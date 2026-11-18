import { readFile } from "node:fs/promises";
import path from "node:path";
import { createElement } from "react";
import type { ComponentType, ReactElement } from "react";

import { AgendaViewDemo } from "@/examples/agenda-view-demo";
import { CalendarDemo } from "@/examples/calendar-demo";
import { CalendarHeaderDemo } from "@/examples/calendar-header-demo";
import { CalendarSettingsDemo } from "@/examples/calendar-settings-demo";
import { CalendarToasterDemo } from "@/examples/calendar-toaster-demo";
import { CommandMenuDemo } from "@/examples/command-menu-demo";
import { ConfigDemo } from "@/examples/config-demo";
import { ControlledEventsDemo } from "@/examples/controlled-events-demo";
import { CustomEventContentDemo } from "@/examples/custom-event-content-demo";
import { CustomEventDetailsDemo } from "@/examples/custom-event-details-demo";
import { DayViewDemo } from "@/examples/day-view-demo";
import { EventDetailsDemo } from "@/examples/event-details-demo";
import { IcsDemo } from "@/examples/ics-demo";
import { MonthViewDemo } from "@/examples/month-view-demo";
import { RangeLoadingDemo } from "@/examples/range-loading-demo";
import { SampleDataDemo } from "@/examples/sample-data-demo";
import { SecondaryTimeZoneDemo } from "@/examples/secondary-time-zone-demo";
import { TimeZoneDemo } from "@/examples/time-zone-demo";
import { TimeGridDemo } from "@/examples/time-grid-demo";
import { TypedEventsDemo } from "@/examples/typed-events-demo";
import { WeekViewDemo } from "@/examples/week-view-demo";
import { YearViewDemo } from "@/examples/year-view-demo";
// The pages' Examples sections
import { AgendaViewEmptyDemo } from "@/examples/agenda-view-empty-demo";
import { AgendaViewEventContentDemo } from "@/examples/agenda-view-event-content-demo";
import { AgendaViewPhoneDemo } from "@/examples/agenda-view-phone-demo";
import { AgendaViewWeekNumbersDemo } from "@/examples/agenda-view-week-numbers-demo";
import { CalendarAppDataDemo } from "@/examples/calendar-app-data-demo";
import { CalendarAppSettingsDemo } from "@/examples/calendar-app-settings-demo";
import { CalendarButtonsDemo } from "@/examples/calendar-buttons-demo";
import { CalendarDialogDemo } from "@/examples/calendar-dialog-demo";
import { CalendarHeaderActionsDemo } from "@/examples/calendar-header-actions-demo";
import { CalendarHeaderPartsDemo } from "@/examples/calendar-header-parts-demo";
import { CalendarListProviderDemo } from "@/examples/calendar-list-provider-demo";
import { CalendarSaveChangesDemo } from "@/examples/calendar-save-changes-demo";
import { CalendarSettingsAccountsDemo } from "@/examples/calendar-settings-accounts-demo";
import { CalendarSettingsThemeDemo } from "@/examples/calendar-settings-theme-demo";
import { CalendarSidebarHiddenCalendarsDemo } from "@/examples/calendar-sidebar-hidden-calendars-demo";
import { CalendarSidebarMeetWithDemo } from "@/examples/calendar-sidebar-meet-with-demo";
import { CalendarToasterDurationDemo } from "@/examples/calendar-toaster-duration-demo";
import { CalendarToasterNoticeDemo } from "@/examples/calendar-toaster-notice-demo";
import { CalendarWorkingHoursDemo } from "@/examples/calendar-working-hours-demo";
import { CommandMenuAppCommandsDemo } from "@/examples/command-menu-app-commands-demo";
import { CommandMenuGoToDateDemo } from "@/examples/command-menu-go-to-date-demo";
import { CreateEventButtonDemo } from "@/examples/create-event-button-demo";
import { DayViewAllDayDemo } from "@/examples/day-view-all-day-demo";
import { DayViewSnapDemo } from "@/examples/day-view-snap-demo";
import { DayViewWeekStripDemo } from "@/examples/day-view-week-strip-demo";
import { DetailsSidebarActionsDemo } from "@/examples/details-sidebar-actions-demo";
import { EventDetailsConferencingDemo } from "@/examples/event-details-conferencing-demo";
import { EventDetailsReadOnlyDemo } from "@/examples/event-details-read-only-demo";
import { EventDetailsSectionsDemo } from "@/examples/event-details-sections-demo";
import { EventDetailsSidePanelDemo } from "@/examples/event-details-side-panel-demo";
import { MeetWithDemo } from "@/examples/meet-with-demo";
import { MiniCalendarFollowDemo } from "@/examples/mini-calendar-follow-demo";
import { MiniCalendarMondayDemo } from "@/examples/mini-calendar-monday-demo";
import { MonthViewBusyDemo } from "@/examples/month-view-busy-demo";
import { MonthViewEventContentDemo } from "@/examples/month-view-event-content-demo";
import { MonthViewToolbarDemo } from "@/examples/month-view-toolbar-demo";
import { MonthViewWeekNumbersDemo } from "@/examples/month-view-week-numbers-demo";
import { MultiSelectDemo } from "@/examples/multi-select-demo";
import { PeoplePickerDemo } from "@/examples/people-picker-demo";
import { PeoplePickerListDemo } from "@/examples/people-picker-list-demo";
import { PeoplePickerTeammatesDemo } from "@/examples/people-picker-teammates-demo";
import { SchedulingPanelDemo } from "@/examples/scheduling-panel-demo";
import { SchedulingShareDemo } from "@/examples/scheduling-share-demo";
import { SidebarOverlayPickerDemo } from "@/examples/sidebar-overlay-picker-demo";
import { ThemeToggleTooltipDemo } from "@/examples/theme-toggle-tooltip-demo";
import { TimeGridDayWeekDemo } from "@/examples/time-grid-day-week-demo";
import { TimeGridVisibleHoursDemo } from "@/examples/time-grid-visible-hours-demo";
import { TimeGridZoomDemo } from "@/examples/time-grid-zoom-demo";
import { ViewSettingsDemo } from "@/examples/view-settings-demo";
import { WeekViewSidePanelDemo } from "@/examples/week-view-side-panel-demo";
import { WeekViewThreeDaysDemo } from "@/examples/week-view-three-days-demo";
import { WeekViewToolbarDemo } from "@/examples/week-view-toolbar-demo";
import { WeekViewWeekdaysDemo } from "@/examples/week-view-weekdays-demo";
import { YearViewDayClickDemo } from "@/examples/year-view-day-click-demo";
import { YearViewDayEventsDemo } from "@/examples/year-view-day-events-demo";
import { YearViewToolbarDemo } from "@/examples/year-view-toolbar-demo";
import { YearViewWeekNumbersDemo } from "@/examples/year-view-week-numbers-demo";
// The demo's sidebars
import { CalendarListDemo } from "@/examples/calendar-list-demo";
import { CalendarSidebarDemo } from "@/examples/calendar-sidebar-demo";
import { DetailsSidebarDemo } from "@/examples/details-sidebar-demo";
import { MiniCalendarDemo } from "@/examples/mini-calendar-demo";
import { SidebarOverlayDemo } from "@/examples/sidebar-overlay-demo";
import { ThemeToggleDemo } from "@/examples/theme-toggle-demo";

/** Folder the example files live in, relative to the project root */
export const EXAMPLES_DIR = "src/examples";

/**
 * Every docs example, keyed by its file name in `src/examples/` (without
 * `.tsx`). `ComponentPreview` renders the component and shows that file.
 */
const EXAMPLES = {
  "agenda-view-demo": AgendaViewDemo,
  "calendar-demo": CalendarDemo,
  "calendar-header-demo": CalendarHeaderDemo,
  "calendar-settings-demo": CalendarSettingsDemo,
  "calendar-toaster-demo": CalendarToasterDemo,
  "command-menu-demo": CommandMenuDemo,
  "config-demo": ConfigDemo,
  "controlled-events-demo": ControlledEventsDemo,
  "custom-event-content-demo": CustomEventContentDemo,
  "custom-event-details-demo": CustomEventDetailsDemo,
  "day-view-demo": DayViewDemo,
  "event-details-demo": EventDetailsDemo,
  "ics-demo": IcsDemo,
  "month-view-demo": MonthViewDemo,
  "range-loading-demo": RangeLoadingDemo,
  "sample-data-demo": SampleDataDemo,
  "secondary-time-zone-demo": SecondaryTimeZoneDemo,
  "time-zone-demo": TimeZoneDemo,
  "time-grid-demo": TimeGridDemo,
  "typed-events-demo": TypedEventsDemo,
  "week-view-demo": WeekViewDemo,
  "year-view-demo": YearViewDemo,
  // The pages' Examples sections
  "agenda-view-empty-demo": AgendaViewEmptyDemo,
  "agenda-view-event-content-demo": AgendaViewEventContentDemo,
  "agenda-view-phone-demo": AgendaViewPhoneDemo,
  "agenda-view-week-numbers-demo": AgendaViewWeekNumbersDemo,
  "calendar-app-data-demo": CalendarAppDataDemo,
  "calendar-app-settings-demo": CalendarAppSettingsDemo,
  "calendar-buttons-demo": CalendarButtonsDemo,
  "calendar-dialog-demo": CalendarDialogDemo,
  "calendar-header-actions-demo": CalendarHeaderActionsDemo,
  "calendar-header-parts-demo": CalendarHeaderPartsDemo,
  "calendar-list-provider-demo": CalendarListProviderDemo,
  "calendar-save-changes-demo": CalendarSaveChangesDemo,
  "calendar-settings-accounts-demo": CalendarSettingsAccountsDemo,
  "calendar-settings-theme-demo": CalendarSettingsThemeDemo,
  "calendar-sidebar-hidden-calendars-demo": CalendarSidebarHiddenCalendarsDemo,
  "calendar-sidebar-meet-with-demo": CalendarSidebarMeetWithDemo,
  "calendar-toaster-duration-demo": CalendarToasterDurationDemo,
  "calendar-toaster-notice-demo": CalendarToasterNoticeDemo,
  "calendar-working-hours-demo": CalendarWorkingHoursDemo,
  "command-menu-app-commands-demo": CommandMenuAppCommandsDemo,
  "command-menu-go-to-date-demo": CommandMenuGoToDateDemo,
  "create-event-button-demo": CreateEventButtonDemo,
  "day-view-all-day-demo": DayViewAllDayDemo,
  "day-view-snap-demo": DayViewSnapDemo,
  "day-view-week-strip-demo": DayViewWeekStripDemo,
  "details-sidebar-actions-demo": DetailsSidebarActionsDemo,
  "event-details-conferencing-demo": EventDetailsConferencingDemo,
  "event-details-read-only-demo": EventDetailsReadOnlyDemo,
  "event-details-sections-demo": EventDetailsSectionsDemo,
  "event-details-side-panel-demo": EventDetailsSidePanelDemo,
  "meet-with-demo": MeetWithDemo,
  "mini-calendar-follow-demo": MiniCalendarFollowDemo,
  "mini-calendar-monday-demo": MiniCalendarMondayDemo,
  "month-view-busy-demo": MonthViewBusyDemo,
  "month-view-event-content-demo": MonthViewEventContentDemo,
  "month-view-toolbar-demo": MonthViewToolbarDemo,
  "month-view-week-numbers-demo": MonthViewWeekNumbersDemo,
  "multi-select-demo": MultiSelectDemo,
  "people-picker-demo": PeoplePickerDemo,
  "people-picker-list-demo": PeoplePickerListDemo,
  "people-picker-teammates-demo": PeoplePickerTeammatesDemo,
  "scheduling-panel-demo": SchedulingPanelDemo,
  "scheduling-share-demo": SchedulingShareDemo,
  "sidebar-overlay-picker-demo": SidebarOverlayPickerDemo,
  "theme-toggle-tooltip-demo": ThemeToggleTooltipDemo,
  "time-grid-day-week-demo": TimeGridDayWeekDemo,
  "time-grid-visible-hours-demo": TimeGridVisibleHoursDemo,
  "time-grid-zoom-demo": TimeGridZoomDemo,
  "view-settings-demo": ViewSettingsDemo,
  "week-view-side-panel-demo": WeekViewSidePanelDemo,
  "week-view-three-days-demo": WeekViewThreeDaysDemo,
  "week-view-toolbar-demo": WeekViewToolbarDemo,
  "week-view-weekdays-demo": WeekViewWeekdaysDemo,
  "year-view-day-click-demo": YearViewDayClickDemo,
  "year-view-day-events-demo": YearViewDayEventsDemo,
  "year-view-toolbar-demo": YearViewToolbarDemo,
  "year-view-week-numbers-demo": YearViewWeekNumbersDemo,
  // The demo's sidebars
  "calendar-list-demo": CalendarListDemo,
  "calendar-sidebar-demo": CalendarSidebarDemo,
  "details-sidebar-demo": DetailsSidebarDemo,
  "mini-calendar-demo": MiniCalendarDemo,
  "sidebar-overlay-demo": SidebarOverlayDemo,
  "theme-toggle-demo": ThemeToggleDemo,
} satisfies Record<string, ComponentType>;

export type ExampleName = keyof typeof EXAMPLES;

export function isExampleName(name: string): name is ExampleName {
  return Object.hasOwn(EXAMPLES, name);
}

/** Folder of the pages that render one example each, without the docs around it */
const EXAMPLE_FRAMES_PATH = "/examples";

/**
 * Examples `ComponentPreview` shows in an iframe, at `/examples/<name>`, with
 * the line its frame's bar says about it. Calendar App lays out for the
 * viewport's width, which only a frame of its own gives it inside a docs
 * page. The command menu and settings examples start with their dialog
 * open: a dialog covers its whole page, so the frame keeps it to the preview.
 */
const FRAME_CAPTIONS = {
  "calendar-app-data-demo":
    "A full-page block, in a frame as wide as this one.",
  "calendar-app-settings-demo":
    "A full-page block, in a frame as wide as this one.",
  "command-menu-demo":
    "The menu starts open here: click outside it, or press Escape in it, to close it.",
  "calendar-settings-demo":
    "The dialog starts open here: click outside it, or press Escape in it, to close it.",
} satisfies Partial<Record<ExampleName, string>>;

export type FramedExampleName = keyof typeof FRAME_CAPTIONS;

export const FRAMED_EXAMPLES = Object.keys(FRAME_CAPTIONS) as ExampleName[];

export function isFramedExample(name: ExampleName): name is FramedExampleName {
  return name in FRAME_CAPTIONS;
}

/** What a framed example's bar says about it */
export function getExampleFrameCaption(name: FramedExampleName): string {
  return FRAME_CAPTIONS[name];
}

/** Path of the page that renders a framed example alone, e.g. `/examples/calendar-app-data-demo` */
export function getExampleFramePath(name: ExampleName): string {
  return `${EXAMPLE_FRAMES_PATH}/${name}`;
}

/** Renders an example's component (it takes no props) */
export function renderExample(name: ExampleName): ReactElement {
  return createElement(EXAMPLES[name]);
}

/** Repository path of an example's file, e.g. `src/examples/week-view-demo.tsx` */
export function getExamplePath(name: ExampleName): string {
  return `${EXAMPLES_DIR}/${name}.tsx`;
}

/**
 * Reads an example's source, exactly as it is on disk. Docs pages are
 * prerendered, so this runs at build time (and on every request in dev).
 */
export async function readExampleSource(name: ExampleName): Promise<string> {
  const filePath = path.join(process.cwd(), getExamplePath(name));
  const source = await readFile(filePath, "utf8");
  return source.trimEnd();
}
