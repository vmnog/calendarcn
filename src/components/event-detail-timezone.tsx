"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useFloating,
} from "@floating-ui/react-dom";
import { ArrowUpRight, Globe, History, Undo2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useHoverTooltip } from "@/hooks/use-hover-tooltip";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useCalendarConfig } from "./calendar-provider";
import {
  EVENT_DETAIL_HOVER_BORDER_CLASS,
  EVENT_DETAIL_ICON_BUTTON_CLASS,
  EVENT_DETAIL_ICON_CLASS,
  EVENT_DETAIL_MENU_CLASS,
  EVENT_DETAIL_ROW_HEIGHT_CLASS,
  EVENT_DETAIL_SECONDARY_CLASS,
  EventDetailRow,
  EventDetailSection,
  EventDetailTooltip,
  getEventDetailPortalContainer,
} from "./event-detail-parts";
import {
  POPULAR_TIME_ZONES,
  changeTimeZoneKeepingWallClock,
  fromDisplayEvent,
  fromZonedWallClock,
  getEventTimeZone,
  getTimeZoneOption,
  getTimeZoneOptions,
  getTimeZoneRowLabel,
  getViewerTimeZone,
  searchTimeZones,
  splitSearchMatch,
  toZonedWallClock,
} from "@/lib/time-zones";
import type {
  DetailedCalendarEvent,
  EventDetailClock,
  EventDetailTimezoneProps,
  TimeZoneOption,
} from "./week-view-types";

/** How many picked zones the picker remembers at its top */
const MAX_RECENT_TIME_ZONES = 5;

/**
 * Gap between the row's hover box and the zone list beside the details, in
 * px: the list ends 7px left of the panel, as in Notion Calendar
 */
const LIST_OFFSET = 12;

/** Keeps the zone list this far from the viewport's edges, in px */
const LIST_VIEWPORT_PADDING = 8;

/** Tallest the zone list grows, in px (Notion Calendar: 345) */
const LIST_MAX_HEIGHT = 345;

/**
 * The row's 31px box, which draws the hover border and the editing fill: it
 * starts 5px from the panel's edge, so the icon stays on the panel's 26px
 * icon column, and ends 10px before the other edge
 */
const ROW_BOX_CLASS =
  "-mr-1.5 -ml-[13px] flex h-[31px] min-w-0 flex-1 items-center gap-[11px] rounded-sm pr-2 pl-3";

/** Zone text in the list */
const LIST_TEXT_CLASS = "text-calendar-menu-foreground/80";

/** Offsets and unmatched text in the list */
const LIST_MUTED_TEXT_CLASS = "text-calendar-menu-muted-foreground";

/** The row while it holds the search input: filled like a focused input */
const EDITING_ROW_CLASS =
  "border-calendar-detail-focus bg-calendar-detail-focus";

/** Rendered on the server and during hydration, where the viewer's zone is unknown */
const SERVER_TIME_ZONE = "";

/**
 * A group of the zone list
 */
interface TimeZoneSection {
  /** Prefixes each item's value, so a zone listed twice stays two items */
  key: "recent" | "popular" | "all" | "search";
  options: TimeZoneOption[];
}

/** Zones picked during this page's life, most recent first */
let recentTimeZones: string[] = [];

/** Pickers showing the recent zones, told when they change */
const recentTimeZoneListeners = new Set<() => void>();

function subscribeToRecentTimeZones(listener: () => void): () => void {
  recentTimeZoneListeners.add(listener);
  return () => recentTimeZoneListeners.delete(listener);
}

function getRecentTimeZones(): string[] {
  return recentTimeZones;
}

/** Puts `timeZone` first among the recent zones */
function rememberTimeZone(timeZone: string): void {
  recentTimeZones = [
    timeZone,
    ...recentTimeZones.filter((zone) => zone !== timeZone),
  ].slice(0, MAX_RECENT_TIME_ZONES);
  for (const listener of recentTimeZoneListeners) listener();
}

/** No-op subscription: the viewer's zone doesn't change while the page is open */
function subscribeToViewerTimeZone(): () => void {
  return () => {};
}

function getServerTimeZone(): string {
  return SERVER_TIME_ZONE;
}

/** Value of a zone's list item, e.g. "recent:America/Sao_Paulo" */
function getItemValue(section: TimeZoneSection["key"], timeZone: string) {
  return `${section}:${timeZone}`;
}

/** The zone of a list item's value */
function getItemTimeZone(value: string): string {
  return value.slice(value.indexOf(":") + 1);
}

/**
 * Index of the item an arrow key moves the highlight to: one step from
 * `index`, kept inside the list; the first or last item when nothing is
 * highlighted
 */
function getSteppedIndex(index: number, step: 1 | -1, count: number): number {
  if (index === -1) return step === 1 ? 0 : count - 1;
  return Math.min(Math.max(index + step, 0), count - 1);
}

/**
 * Closest the clock switch's tooltip centers to the viewport's right edge,
 * in px: half its widest text plus a margin, so it never runs off screen
 */
const CLOCK_TOOLTIP_EDGE_GAP = 132;

/** What the clock switch says it does, as Notion Calendar's tooltips */
const CLOCK_SWITCH_LABELS: Record<EventDetailClock["showing"], string> = {
  calendar: "Switch to event's time zone to edit",
  event: "Switch to your primary time zone",
};

/**
 * The button at the end of the time zone row that switches the details
 * between the calendar's clock and the event's own, with its tooltip
 */
function ClockSwitchButton({ clock }: { clock: EventDetailClock }) {
  const tooltip = useHoverTooltip();
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const label = CLOCK_SWITCH_LABELS[clock.showing];
  const Icon = clock.showing === "calendar" ? Undo2 : ArrowUpRight;

  const show = (element: HTMLElement) => {
    // The button sits at the panel's right edge: keep the tooltip on screen
    const box = element.getBoundingClientRect();
    const center = Math.min(
      box.left + box.width / 2,
      window.innerWidth - CLOCK_TOOLTIP_EDGE_GAP,
    );
    setRect(new DOMRect(center, box.top, 0, box.height));
    tooltip.scheduleOpen();
  };

  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={() => {
          tooltip.scheduleClose();
          clock.onSwitch();
        }}
        onPointerEnter={(e) => show(e.currentTarget)}
        onPointerLeave={tooltip.scheduleClose}
        onFocus={(e) => {
          if (e.currentTarget.matches(":focus-visible")) show(e.currentTarget);
        }}
        onBlur={tooltip.scheduleClose}
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-sm outline-none focus-visible:border-calendar-selection",
          EVENT_DETAIL_ICON_BUTTON_CLASS,
          EVENT_DETAIL_SECONDARY_CLASS,
        )}
      >
        <Icon className="size-4" />
      </button>
      <EventDetailTooltip rect={tooltip.isOpen ? rect : null}>
        {label}
      </EventDetailTooltip>
    </>
  );
}

/**
 * "Brasilia Standard Time – Sao Paulo", with the part matching the search in
 * bold at full strength and the rest dimmed while searching
 */
function ZoneText({ text, query }: { text: string; query: string | null }) {
  if (query === null) return <>{text}</>;

  const { before, match, after } = splitSearchMatch(text, query);
  return (
    <span className={LIST_MUTED_TEXT_CLASS}>
      {before}
      {match && (
        <span className="font-semibold text-calendar-menu-foreground in-data-[selected=true]:text-calendar-menu-accent-foreground">
          {match}
        </span>
      )}
      {after}
    </span>
  );
}

/**
 * The event's time zone, "GMT−3 Sao Paulo". Clicking it turns the row into a
 * search field with the zone list beside the details: recent zones, popular
 * ones, then every zone by offset. Arrow keys and the pointer move through
 * the list and preview the city in the field, typing filters it by name or
 * city, Enter or a click picks a zone, Escape restores the zone from before
 * the list opened (the highlight only previews). Picking a
 * zone keeps the event's wall-clock times, so 8 AM in São Paulo becomes 8 AM
 * in New York. All-day events have no zone.
 */
export function EventDetailTimezone<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event, onEventChange, clock }: EventDetailTimezoneProps<TEvent>) {
  const listId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  /** Scrolls the highlighted item into view once the list has rendered it */
  const scrollToActiveRef = React.useRef(false);

  const [editing, setEditing] = React.useState(false);
  const [listOpen, setListOpen] = React.useState(false);
  /** The typed search, or null while the field shows a city */
  const [query, setQuery] = React.useState<string | null>(null);
  const [activeValue, setActiveValue] = React.useState("");
  const [inputText, setInputText] = React.useState("");
  const [rowElement, setRowElement] = React.useState<HTMLElement | null>(null);
  /** Id of the highlighted option, for the field's `aria-activedescendant` */
  const [activeOptionId, setActiveOptionId] = React.useState<string>();
  const [listElement, setListElement] = React.useState<HTMLElement | null>(
    null,
  );

  const viewerTimeZone = React.useSyncExternalStore(
    subscribeToViewerTimeZone,
    getViewerTimeZone,
    getServerTimeZone,
  );
  const { timeZone: calendarTimeZone } = useCalendarConfig();
  const recent = React.useSyncExternalStore(
    subscribeToRecentTimeZones,
    getRecentTimeZones,
    getRecentTimeZones,
  );

  const { floatingStyles, isPositioned } = useFloating({
    open: listOpen,
    placement: "left-start",
    strategy: "fixed",
    elements: { reference: rowElement, floating: listElement },
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(LIST_OFFSET),
      flip({ fallbackPlacements: ["bottom-start", "right-start"] }),
      shift({ padding: LIST_VIEWPORT_PADDING }),
      size({
        padding: LIST_VIEWPORT_PADDING,
        apply({ availableHeight, elements }) {
          elements.floating.style.maxHeight = `${Math.min(availableHeight, LIST_MAX_HEIGHT)}px`;
        },
      }),
    ],
  });

  const eventTimeZone = React.useMemo(
    () =>
      getEventTimeZone({ timeZone: event.timeZone, timezone: event.timezone }),
    [event.timeZone, event.timezone],
  );
  const timeZone = eventTimeZone ?? viewerTimeZone;
  // The event reads on the calendar's clock; offsets and zone changes need
  // its instant
  const start = React.useMemo(
    () => fromDisplayEvent(event, calendarTimeZone).start,
    [event, calendarTimeZone],
  );

  // Every zone, listed once per edit: typing searches this list
  const startTime = start.getTime();
  const options = React.useMemo(
    () => (editing ? getTimeZoneOptions(new Date(startTime)) : []),
    [editing, startTime],
  );

  const sections = React.useMemo<TimeZoneSection[]>(() => {
    if (!listOpen) return [];
    if (query !== null) {
      return [{ key: "search", options: searchTimeZones(options, query) }];
    }
    const byId = new Map(options.map((option) => [option.id, option]));
    const pick = (ids: string[]) =>
      ids.flatMap((id) => {
        const option = byId.get(id) ?? getTimeZoneOption(start, id);
        return option ? [option] : [];
      });
    const groups: TimeZoneSection[] = [
      { key: "recent", options: pick(recent) },
      { key: "popular", options: pick(POPULAR_TIME_ZONES) },
      { key: "all", options },
    ];
    return groups.filter((group) => group.options.length > 0);
  }, [listOpen, query, options, recent, start]);

  const itemValues = React.useMemo(
    () =>
      sections.flatMap((section) =>
        section.options.map((option) => getItemValue(section.key, option.id)),
      ),
    [sections],
  );

  const cityOf = React.useCallback(
    (zone: string) => getTimeZoneRowLabel(start, zone).city,
    [start],
  );

  // Keep the highlighted item in view after the keyboard moved it or the
  // list opened on it, once the list is placed and its height capped
  React.useEffect(() => {
    if (!isPositioned || !scrollToActiveRef.current || !listRef.current) {
      return;
    }
    scrollToActiveRef.current = false;
    const item = Array.from(
      listRef.current.querySelectorAll<HTMLElement>("[cmdk-item]"),
    ).find((element) => element.dataset.value === activeValue);
    item?.scrollIntoView({ block: "nearest" });
  }, [activeValue, sections, isPositioned]);

  // cmdk ids its options itself: read the highlighted one's from the list
  React.useEffect(() => {
    const item = listOpen
      ? Array.from(
          listRef.current?.querySelectorAll<HTMLElement>("[cmdk-item]") ?? [],
        ).find((element) => element.dataset.value === activeValue)
      : undefined;
    setActiveOptionId(item?.id || undefined);
  }, [activeValue, sections, listOpen, listElement]);

  // Select the city once the field has rendered it
  React.useEffect(() => {
    if (!editing || query !== null) return;
    inputRef.current?.select();
  }, [editing, query, inputText]);

  const close = () => {
    setEditing(false);
    setListOpen(false);
    setQuery(null);
  };

  const open = () => {
    if (!onEventChange || !timeZone) return;
    setEditing(true);
    setListOpen(true);
    setQuery(null);
    setInputText(cityOf(timeZone));
    setActiveValue(
      getItemValue(recent.includes(timeZone) ? "recent" : "all", timeZone),
    );
    scrollToActiveRef.current = true;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const pick = (zone: string) => {
    rememberTimeZone(zone);
    setListOpen(false);
    setQuery(null);
    setInputText(cityOf(zone));
    if (zone === timeZone) return;
    // Keep the wall clock in the zone it was in, then hand the event back
    // on the calendar's clock
    const moveToZone = (date: Date) =>
      toZonedWallClock(
        changeTimeZoneKeepingWallClock(
          fromZonedWallClock(date, calendarTimeZone),
          timeZone,
          zone,
        ),
        calendarTimeZone,
      );
    onEventChange?.({
      ...event,
      timeZone: zone,
      start: moveToZone(event.start),
      end: moveToZone(event.end),
    });
  };

  /** Highlights a list item; outside a search the field previews its city */
  const highlight = (value: string) => {
    setActiveValue(value);
    if (query === null) setInputText(cityOf(getItemTimeZone(value)));
  };

  const moveHighlight = (step: 1 | -1) => {
    if (itemValues.length === 0) return;
    const index = itemValues.indexOf(activeValue);
    scrollToActiveRef.current = true;
    highlight(itemValues[getSteppedIndex(index, step, itemValues.length)]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!listOpen) {
        open();
        return;
      }
      moveHighlight(e.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (listOpen && activeValue) {
        pick(getItemTimeZone(activeValue));
        return;
      }
      inputRef.current?.blur();
      return;
    }
    if (e.key === "Escape") {
      // Keep the calendar's global Escape from deselecting the event
      e.stopPropagation();
      e.preventDefault();
      inputRef.current?.blur();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputText(text);
    // An emptied field lists the sections again
    setQuery(text.trim() ? text : null);
    setListOpen(true);
    const results = searchTimeZones(options, text);
    setActiveValue(results[0] ? getItemValue("search", results[0].id) : "");
    scrollToActiveRef.current = true;
  };

  if (event.isAllDay) return null;

  // Before hydration the viewer's zone is unknown: show the legacy label
  if (!timeZone) {
    return (
      <EventDetailSection name="timezone">
        <EventDetailRow icon={Globe}>
          <span className={EVENT_DETAIL_SECONDARY_CLASS}>{event.timezone}</span>
        </EventDetailRow>
      </EventDetailSection>
    );
  }

  // On the calendar's clock, the row names the calendar's zone, read only
  if (clock?.showing === "calendar") {
    const calendarLabel = getTimeZoneRowLabel(start, clock.calendarTimeZone);
    return (
      <EventDetailSection name="timezone">
        <div
          className={cn(
            "flex items-center gap-1 pr-4 pl-[18px]",
            EVENT_DETAIL_ROW_HEIGHT_CLASS,
          )}
        >
          <div className={cn(ROW_BOX_CLASS, "border border-transparent")}>
            <Globe className={EVENT_DETAIL_ICON_CLASS} />
            <span className="flex min-w-0 items-center gap-[5px]">
              <span className={cn("shrink-0", EVENT_DETAIL_SECONDARY_CLASS)}>
                {calendarLabel.offset}
              </span>
              <span className="truncate">{calendarLabel.city}</span>
            </span>
          </div>
          <ClockSwitchButton clock={clock} />
        </div>
      </EventDetailSection>
    );
  }

  const label = getTimeZoneRowLabel(start, timeZone);
  // Inside a modal sheet (the panel on phones), which dismisses on presses
  // outside its own DOM; the body anywhere else
  const portalContainer = listOpen
    ? getEventDetailPortalContainer(rowElement)
    : null;

  return (
    <EventDetailSection name="timezone">
      <div
        className={cn(
          "flex items-center pr-4 pl-[18px]",
          EVENT_DETAIL_ROW_HEIGHT_CLASS,
        )}
      >
        {editing ? (
          <div
            ref={setRowElement}
            className={cn(
              ROW_BOX_CLASS,
              "cursor-text border",
              EDITING_ROW_CLASS,
            )}
            onClick={() => inputRef.current?.focus()}
          >
            <Globe className={EVENT_DETAIL_ICON_CLASS} />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-label="Time zone"
              aria-expanded={listOpen}
              aria-controls={listOpen ? listId : undefined}
              aria-activedescendant={activeOptionId}
              aria-autocomplete="list"
              value={inputText}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={close}
              className="min-w-0 flex-1 border-none bg-transparent p-0 outline-none"
            />
          </div>
        ) : (
          <button
            ref={setRowElement}
            type="button"
            aria-label={`Time zone: ${label.offset} ${label.city}`}
            disabled={!onEventChange}
            onClick={open}
            className={cn(
              EVENT_DETAIL_HOVER_BORDER_CLASS,
              ROW_BOX_CLASS,
              "text-left outline-none disabled:cursor-default disabled:hover:border-transparent",
              "focus-visible:border-calendar-selection",
            )}
          >
            <Globe className={EVENT_DETAIL_ICON_CLASS} />
            <span className="flex min-w-0 items-center gap-[5px]">
              <span className={cn("shrink-0", EVENT_DETAIL_SECONDARY_CLASS)}>
                {label.offset}
              </span>
              <span className="truncate">{label.city}</span>
            </span>
          </button>
        )}
        {clock && <ClockSwitchButton clock={clock} />}
      </div>

      {listOpen &&
        portalContainer &&
        createPortal(
          <div
            ref={setListElement}
            id={listId}
            style={floatingStyles}
            className={cn(
              "pointer-events-auto z-50 flex w-[413px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-lg border font-medium shadow-lg",
              EVENT_DETAIL_MENU_CLASS,
            )}
            // The field keeps focus while the pointer uses the list
            onMouseDown={(e) => e.preventDefault()}
          >
            <Command
              shouldFilter={false}
              value={activeValue}
              onValueChange={highlight}
              className="min-h-0 flex-1 rounded-none bg-transparent text-sm"
            >
              <CommandList
                ref={listRef}
                // cmdk names the listbox from `label`, and ids it itself
                label="Time zones"
                className="max-h-none min-h-0 flex-1 overflow-y-auto"
              >
                {/* Keeps the list, and so Escape's restore, while nothing matches */}
                <CommandEmpty
                  className={cn(
                    "px-2.5 py-[7px] text-sm",
                    LIST_MUTED_TEXT_CLASS,
                  )}
                >
                  No results
                </CommandEmpty>
                {sections.map((section, index) => (
                  <React.Fragment key={section.key}>
                    {index > 0 && (
                      <CommandSeparator className="mx-0 bg-calendar-menu-border" />
                    )}
                    <CommandGroup className="p-1">
                      {section.options.map((option) => (
                        <CommandItem
                          key={option.id}
                          value={getItemValue(section.key, option.id)}
                          onSelect={() => pick(option.id)}
                          className={cn(
                            "h-[30px] gap-[9px] rounded-md py-0 pr-2 pl-1.5 text-sm data-[selected=true]:bg-calendar-menu-accent",
                            LIST_TEXT_CLASS,
                            "data-[selected=true]:text-calendar-menu-accent-foreground/80",
                          )}
                        >
                          <span
                            className={cn("shrink-0", LIST_MUTED_TEXT_CLASS)}
                          >
                            {option.offsetLabel}
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            <ZoneText text={option.name} query={query} />
                            <span
                              className={cn(
                                "whitespace-pre",
                                query !== null && LIST_MUTED_TEXT_CLASS,
                              )}
                            >
                              {"  –  "}
                            </span>
                            <ZoneText text={option.city} query={query} />
                          </span>
                          {section.key === "recent" && (
                            <History
                              aria-label="Recent"
                              className={cn(
                                "size-3.5 shrink-0",
                                LIST_MUTED_TEXT_CLASS,
                              )}
                            />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </React.Fragment>
                ))}
              </CommandList>
            </Command>
          </div>,
          portalContainer,
        )}
    </EventDetailSection>
  );
}
