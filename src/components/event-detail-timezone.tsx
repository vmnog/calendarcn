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
import { Globe, History } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  EVENT_DETAIL_HOVER_BORDER_CLASS,
  EVENT_DETAIL_ICON_CLASS,
  EVENT_DETAIL_MENU_CLASS,
  EVENT_DETAIL_ROW_HEIGHT_CLASS,
  EVENT_DETAIL_SECONDARY_CLASS,
  EventDetailRow,
  EventDetailSection,
} from "./event-detail-parts";
import {
  POPULAR_TIME_ZONES,
  changeTimeZoneKeepingWallClock,
  findTimeZoneByLabel,
  getTimeZoneOption,
  getTimeZoneOptions,
  getTimeZoneRowLabel,
  getViewerTimeZone,
  searchTimeZones,
  splitSearchMatch,
} from "@/lib/time-zones";
import type { TimeZoneOption } from "@/lib/time-zones";
import type {
  DetailedCalendarEvent,
  EventDetailSectionProps,
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

/** Zone text in the list, which is dark in both themes */
const LIST_TEXT_CLASS = "text-[#D4D4D4]";

/** Offsets and unmatched text in the list */
const LIST_MUTED_TEXT_CLASS = "text-[#7F7F7F]";

/** The row while it holds the search input: filled like a focused input */
const EDITING_ROW_CLASS =
  "border-[#F5F5F5] bg-[#F5F5F5] dark:border-[#242424] dark:bg-[#242424]";

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
 * "Brasilia Standard Time – Sao Paulo", with the part matching the search in
 * bold white and the rest dimmed while searching
 */
function ZoneText({ text, query }: { text: string; query: string | null }) {
  if (query === null) return <>{text}</>;

  const { before, match, after } = splitSearchMatch(text, query);
  return (
    <span className={LIST_MUTED_TEXT_CLASS}>
      {before}
      {match && <span className="font-semibold text-white">{match}</span>}
      {after}
    </span>
  );
}

/**
 * The event's time zone, "GMT−3 Sao Paulo". Clicking it turns the row into a
 * search field with the zone list beside the details: recent zones, popular
 * ones, then every zone by offset. Arrow keys and the pointer move through
 * the list and preview the city in the field, typing filters it by name or
 * city, Enter or a click picks a zone, Escape leaves it unchanged. Picking a
 * zone keeps the event's wall-clock times, so 8 AM in São Paulo becomes 8 AM
 * in New York. All-day events have no zone.
 */
export function EventDetailTimezone<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event, onEventChange }: EventDetailSectionProps<TEvent>) {
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
  const [listElement, setListElement] = React.useState<HTMLElement | null>(
    null,
  );

  const viewerTimeZone = React.useSyncExternalStore(
    subscribeToViewerTimeZone,
    getViewerTimeZone,
    getServerTimeZone,
  );
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

  const timeZone =
    event.timeZone ?? findTimeZoneByLabel(event.timezone) ?? viewerTimeZone;

  const options = React.useMemo(
    () => (listOpen ? getTimeZoneOptions(event.start) : []),
    [listOpen, event.start],
  );

  const sections = React.useMemo<TimeZoneSection[]>(() => {
    if (!listOpen) return [];
    if (query !== null) {
      return [{ key: "search", options: searchTimeZones(options, query) }];
    }
    const byId = new Map(options.map((option) => [option.id, option]));
    const pick = (ids: string[]) =>
      ids.flatMap((id) => {
        const option = byId.get(id) ?? getTimeZoneOption(event.start, id);
        return option ? [option] : [];
      });
    const groups: TimeZoneSection[] = [
      { key: "recent", options: pick(recent) },
      { key: "popular", options: pick(POPULAR_TIME_ZONES) },
      { key: "all", options },
    ];
    return groups.filter((group) => group.options.length > 0);
  }, [listOpen, query, options, recent, event.start]);

  const itemValues = React.useMemo(
    () =>
      sections.flatMap((section) =>
        section.options.map((option) => getItemValue(section.key, option.id)),
      ),
    [sections],
  );

  const cityOf = React.useCallback(
    (zone: string) => getTimeZoneRowLabel(event.start, zone).city,
    [event.start],
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
    onEventChange?.({
      ...event,
      timeZone: zone,
      start: changeTimeZoneKeepingWallClock(event.start, timeZone, zone),
      end: changeTimeZoneKeepingWallClock(event.end, timeZone, zone),
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
    const next =
      index === -1
        ? step === 1
          ? 0
          : itemValues.length - 1
        : Math.min(Math.max(index + step, 0), itemValues.length - 1);
    scrollToActiveRef.current = true;
    highlight(itemValues[next]);
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
    const results = searchTimeZones(getTimeZoneOptions(event.start), text);
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

  const label = getTimeZoneRowLabel(event.start, timeZone);
  const showList = listOpen && itemValues.length > 0;
  // A modal sheet (the panel on phones) dismisses on presses outside its own
  // DOM, so the list goes inside it there; anywhere else it goes to the body
  const portalContainer =
    rowElement?.closest<HTMLElement>(
      '[role="dialog"]:not([data-calendar-popover])',
    ) ?? (typeof document === "undefined" ? null : document.body);

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
              aria-expanded={showList}
              aria-controls={showList ? listId : undefined}
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
              "focus-visible:border-[#3A85D3] dark:focus-visible:border-[#3A85D3]",
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
      </div>

      {showList &&
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
                {sections.map((section, index) => (
                  <React.Fragment key={section.key}>
                    {index > 0 && (
                      <CommandSeparator className="mx-0 bg-[#303030]" />
                    )}
                    <CommandGroup className="p-1">
                      {section.options.map((option) => (
                        <CommandItem
                          key={option.id}
                          value={getItemValue(section.key, option.id)}
                          onSelect={() => pick(option.id)}
                          className={cn(
                            "h-[30px] gap-[9px] rounded-md py-0 pr-2 pl-1.5 text-sm data-[selected=true]:bg-[#303030]",
                            LIST_TEXT_CLASS,
                            "data-[selected=true]:text-[#D4D4D4]",
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
