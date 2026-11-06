"use client";

import * as React from "react";
import { MapPin, Pencil } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCalendarConfig } from "./calendar-provider";
import {
  EVENT_DETAIL_GROUPED_INPUT_CLASS,
  EVENT_DETAIL_HOVER_BORDER_CLASS,
  EVENT_DETAIL_ICON_CLASS,
  EVENT_DETAIL_INPUT_GROUP_CLASS,
  EVENT_DETAIL_MUTED_CLASS,
  EVENT_DETAIL_TEXT_CLASS,
  EventDetailSection,
} from "./event-detail-parts";
import {
  EVENT_DETAIL_INPUT_PLACEHOLDER_CLASS,
  EVENT_DETAIL_MENU_SECONDARY_CLASS,
  EventDetailSuggestion,
  EventDetailSuggestions,
  HighlightedMatch,
  handleSuggestionKey,
} from "./event-detail-suggestions";
import type {
  DetailedCalendarEvent,
  EventDetailSectionProps,
  LocationSuggestion,
} from "./week-view-types";

/** Width of the suggestions list (Notion: 292px) */
const SUGGESTIONS_WIDTH = 292;

/** Most places listed under the typed text */
const MAX_SUGGESTIONS = 5;

/** A location that is a web address opens itself instead of a map */
const URL_PATTERN = /^https?:\/\/\S+$/i;

/** A row's 32px box, from 8px off the panel's edges, with the icon column at 26px */
const ROW_BOX_CLASS =
  "flex h-8 min-w-0 flex-1 items-center gap-[11px] pr-2 pl-[9px]";

/** The location as it's saved: "Central Park, New York, NY, USA" */
function formatSuggestion(place: LocationSuggestion): string {
  return place.address ? `${place.name}, ${place.address}` : place.name;
}

/** Where the set location opens: itself when it's a link, else Google Maps */
function getLocationHref(location: string): string {
  if (URL_PATTERN.test(location)) return location;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

/**
 * Where the event happens, as in Notion Calendar. Empty: a "Location"
 * field; typing lists the typed text first, then matching places (name
 * over address) from `CalendarProvider`'s `locationSuggestions`. Set: the
 * location, underlined, opening in Google Maps (or itself, for a link);
 * clicking the rest of the row, or its edit button, edits it, and clearing
 * the text removes it. Escape restores the location from before editing.
 */
export function EventDetailLocation<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event, onEventChange }: EventDetailSectionProps<TEvent>) {
  const { locationSuggestions } = useCalendarConfig();
  const location = event.location ?? "";
  const inputRef = React.useRef<HTMLInputElement>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();
  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState(location);
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const linkRef = React.useRef<HTMLAnchorElement>(null);
  /** Set by Escape and by a pick, so the blur that follows doesn't commit */
  const skipCommitRef = React.useRef(false);
  /** Set when a key ends editing: focus goes back to the location */
  const refocusRef = React.useRef(false);

  // Follow the event while the field isn't being typed into
  React.useEffect(() => {
    if (!editing) setText(location);
  }, [location, editing]);

  // Focus the field when the set location switches to editing, and the
  // location (the edit button comes next) when a key ends it
  React.useEffect(() => {
    if (!editing) {
      if (!refocusRef.current) return;
      refocusRef.current = false;
      linkRef.current?.focus();
      return;
    }
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const trimmed = text.trim();

  /** The typed text, then the places that match it */
  const options = React.useMemo<LocationSuggestion[]>(() => {
    if (!trimmed) return [];
    const q = trimmed.toLowerCase();
    const places = locationSuggestions
      .filter((place) => formatSuggestion(place).toLowerCase().includes(q))
      .filter((place) => formatSuggestion(place) !== trimmed)
      .slice(0, MAX_SUGGESTIONS);
    return [{ name: trimmed }, ...places];
  }, [locationSuggestions, trimmed]);

  const listOpen = open && options.length > 0;

  // The typed text is active, as in Notion
  React.useEffect(() => {
    setActiveIndex(trimmed ? 0 : -1);
  }, [trimmed]);

  const commit = (next: string) => {
    const value = next.trim();
    setText(value);
    if (value === location) return;
    onEventChange?.({ ...event, location: value || undefined });
  };

  /**
   * Leaves the field. After editing a set location, focus returns to the
   * location
   */
  const finishEditing = () => {
    refocusRef.current = editing;
    inputRef.current?.blur();
  };

  const pick = (place: LocationSuggestion) => {
    skipCommitRef.current = true;
    commit(formatSuggestion(place));
    setOpen(false);
    finishEditing();
  };

  const handleBlur = () => {
    setOpen(false);
    setEditing(false);
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      return;
    }
    commit(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      skipCommitRef.current = true;
      setText(location);
      finishEditing();
      return;
    }
    if (e.key === "Enter" && !listOpen) {
      e.preventDefault();
      finishEditing();
      return;
    }
    if (!listOpen) return;
    handleSuggestionKey(e, options.length, activeIndex, setActiveIndex, (i) =>
      pick(options[i]),
    );
  };

  const optionId = (index: number) => `${listId}-option-${index}`;

  if (location && !editing) {
    return (
      <EventDetailSection name="location">
        <div className="flex min-h-[35px] items-center px-2">
          <div
            className={cn(
              "group/location flex min-h-8 min-w-0 flex-1 cursor-text items-start gap-[11px] py-[5px] pr-2 pl-[9px]",
              EVENT_DETAIL_HOVER_BORDER_CLASS,
            )}
            onClick={onEventChange ? () => setEditing(true) : undefined}
          >
            <MapPin className={cn("mt-0.5", EVENT_DETAIL_ICON_CLASS)} />
            <a
              ref={linkRef}
              href={getLocationHref(location)}
              target="_blank"
              rel="noreferrer"
              data-testid="event-location-link"
              className={cn(
                "min-w-0 cursor-pointer break-words underline decoration-[#EEEEEE] underline-offset-[3px] group-hover/location:decoration-current dark:decoration-[#262626] dark:group-hover/location:decoration-current",
                EVENT_DETAIL_TEXT_CLASS,
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {location}
            </a>
            {onEventChange && (
              <>
                <span className="flex-1" />
                {/* Shown on hover, and once the location has focus */}
                <button
                  type="button"
                  aria-label="Edit location"
                  title="Edit location"
                  className={cn(
                    "hidden size-5 shrink-0 items-center justify-center group-focus-within/location:flex group-hover/location:flex",
                    EVENT_DETAIL_MUTED_CLASS,
                  )}
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="size-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </EventDetailSection>
    );
  }

  return (
    <EventDetailSection name="location">
      <div className="flex min-h-[35px] items-center px-2">
        <div
          ref={boxRef}
          className={cn(ROW_BOX_CLASS, EVENT_DETAIL_INPUT_GROUP_CLASS)}
          onClick={() => inputRef.current?.focus()}
        >
          <MapPin className={EVENT_DETAIL_ICON_CLASS} />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label="Location"
            aria-autocomplete="list"
            aria-expanded={listOpen}
            aria-controls={listOpen ? listId : undefined}
            aria-activedescendant={
              listOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined
            }
            data-testid="event-location-input"
            value={text}
            placeholder="Location"
            readOnly={!onEventChange}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={cn(
              "min-w-0 flex-1",
              EVENT_DETAIL_GROUPED_INPUT_CLASS,
              EVENT_DETAIL_TEXT_CLASS,
              EVENT_DETAIL_INPUT_PLACEHOLDER_CLASS,
            )}
          />
        </div>
      </div>
      {listOpen && (
        <EventDetailSuggestions
          id={listId}
          label="Suggested places"
          anchorRef={boxRef}
          width={SUGGESTIONS_WIDTH}
        >
          {options.map((place, index) => (
            <EventDetailSuggestion
              key={`${index}-${formatSuggestion(place)}`}
              id={optionId(index)}
              active={index === activeIndex}
              onActivate={() => setActiveIndex(index)}
              onSelect={() => pick(place)}
            >
              <span className="flex min-w-0 flex-1 flex-col leading-5">
                <span className="truncate">
                  {index === 0 ? (
                    place.name
                  ) : (
                    <HighlightedMatch text={place.name} query={trimmed} />
                  )}
                </span>
                {place.address && (
                  <span
                    className={cn(
                      "truncate",
                      EVENT_DETAIL_MENU_SECONDARY_CLASS,
                    )}
                  >
                    {place.address}
                  </span>
                )}
              </span>
            </EventDetailSuggestion>
          ))}
        </EventDetailSuggestions>
      )}
    </EventDetailSection>
  );
}
