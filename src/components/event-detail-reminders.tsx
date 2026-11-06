"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react-dom";
import { Bell, X } from "lucide-react";
import type { Locale } from "date-fns";

import { cn } from "@/lib/utils";
import { useCalendarConfig } from "./calendar-provider";
import {
  EVENT_DETAIL_GROUPED_INPUT_CLASS,
  EVENT_DETAIL_ICON_CLASS,
  EVENT_DETAIL_INPUT_GROUP_CLASS,
  EVENT_DETAIL_MENU_CLASS,
  EVENT_DETAIL_PLACEHOLDER_CLASS,
  EVENT_DETAIL_ROW_HEIGHT_CLASS,
  EVENT_DETAIL_SECONDARY_CLASS,
  PANEL_MENU_SURFACE_CLASS,
  ROW_BOX_CLASS,
  EventDetailSection,
  getEventDetailPortalContainer,
} from "./event-detail-parts";
import { addReminder, formatTime } from "@/lib/event-utils";
import type {
  DetailedCalendarEvent,
  EventDetailSectionProps,
  EventReminder,
  HourCycle,
} from "./week-view-types";

/** Gap in px between the suggestions and the panel's left edge */
const SUGGESTIONS_GAP = 4;

/** Units a typed number is offered in, in Notion's order */
const REMINDER_UNITS: EventReminder["unit"][] = [
  "minutes",
  "hours",
  "days",
  "weeks",
];

/** Unit after a reminder's amount: [one, many], as in "1hour" and "2hours" */
const REMINDER_UNIT_LABELS: Record<EventReminder["unit"], [string, string]> = {
  minutes: ["min", "min"],
  hours: ["hour", "hours"],
  days: ["day", "days"],
  weeks: ["week", "weeks"],
};

/**
 * Words a typed unit can be the start of, for each unit: "10m", "10 min",
 * "10 minutes", "10 mins", "2h", "2 hrs", "3d", "1w", "1 wk"
 */
const REMINDER_UNIT_NAMES: Record<EventReminder["unit"], string[]> = {
  minutes: ["minutes", "mins"],
  hours: ["hours", "hrs"],
  days: ["days"],
  weeks: ["weeks", "wks"],
};

/** A reminder at the start of the event */
const AT_START_REMINDER: EventReminder = { amount: 0, unit: "minutes" };

/** Label of a reminder at the start of the event */
const AT_START_LABEL = "At start of event";

/** Reminders offered before anything is typed, for a timed event */
const TIMED_PRESETS: EventReminder[] = [
  AT_START_REMINDER,
  { amount: 5, unit: "minutes" },
  { amount: 10, unit: "minutes" },
  { amount: 30, unit: "minutes" },
  { amount: 1, unit: "hours" },
];

/** Reminders offered before anything is typed, for an all-day event */
const ALL_DAY_PRESETS: EventReminder[] = [
  AT_START_REMINDER,
  { amount: 1, unit: "days" },
  { amount: 2, unit: "days" },
  { amount: 3, unit: "days" },
  { amount: 1, unit: "weeks" },
];

/**
 * "10min", "1hour", "2days" (with a hair space, as Notion sets it), or null
 * for a reminder at the start of the event
 */
function formatReminderAmount(reminder: EventReminder): string | null {
  if (reminder.amount === 0) return null;
  const [one, many] = REMINDER_UNIT_LABELS[reminder.unit];
  return `${reminder.amount}\u200A${reminder.amount === 1 ? one : many}`;
}

/** " at 9 AM" for an all-day reminder's time of day, "" without one */
function formatReminderTimeOfDay(
  reminder: EventReminder,
  hourCycle: HourCycle,
  locale: Locale,
): string {
  if (!reminder.time) return "";
  const { hours, minutes } = reminder.time;
  return ` at ${formatTime(new Date(2000, 0, 1, hours, minutes), hourCycle, locale)}`;
}

/**
 * A reminder as text: "10min before", "1day before at 9 AM", "At start of
 * event", or "On the day at 9 AM" for an all-day reminder on the day itself
 */
function formatReminderLabel(
  reminder: EventReminder,
  hourCycle: HourCycle,
  locale: Locale,
): string {
  const amount = formatReminderAmount(reminder);
  const timeOfDay = formatReminderTimeOfDay(reminder, hourCycle, locale);
  if (amount) return `${amount} before${timeOfDay}`;
  if (timeOfDay) return `On the day${timeOfDay}`;
  return AT_START_LABEL;
}

/**
 * Suggestions for what was typed: a number is offered in every unit its
 * text can start ("2h" in hours, "10 mins" in minutes), 0 once as "At start
 * of event", other text filters the presets. Empty text offers the presets.
 */
function getSuggestions(
  query: string,
  presets: EventReminder[],
): EventReminder[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) return presets;

  const match = /^(\d+)\s*([a-z]*)$/.exec(trimmed);
  if (match) {
    const amount = Number.parseInt(match[1], 10);
    const unitText = match[2];
    const units = REMINDER_UNITS.filter((unit) =>
      REMINDER_UNIT_NAMES[unit].some((name) => name.startsWith(unitText)),
    );
    if (units.length === 0) return [];
    if (amount === 0) return [AT_START_REMINDER];
    return units.map((unit) => ({ amount, unit }));
  }

  return presets.filter((preset) =>
    (formatReminderAmount(preset) ?? AT_START_LABEL)
      .toLowerCase()
      .includes(trimmed),
  );
}

/**
 * Props for ReminderLabel
 */
interface ReminderLabelProps {
  reminder: EventReminder;
  /** Color of the muted "before" */
  beforeClassName: string;
}

/**
 * One reminder as Notion writes it: "10min before", with "before" muted,
 * "1day before at 9 AM", "At start of event"
 */
function ReminderLabel({ reminder, beforeClassName }: ReminderLabelProps) {
  const { hourCycle, locale } = useCalendarConfig();
  const amount = formatReminderAmount(reminder);
  if (!amount) return <>{formatReminderLabel(reminder, hourCycle, locale)}</>;

  return (
    <>
      {amount} <span className={beforeClassName}>before</span>
      {formatReminderTimeOfDay(reminder, hourCycle, locale)}
    </>
  );
}

/**
 * Props for ReminderSuggestions
 */
interface ReminderSuggestionsProps {
  /** Element the list lines up with: the section, so it opens beside the panel */
  reference: HTMLElement | null;
  /** Element the list renders into (`getEventDetailPortalContainer()`) */
  container: HTMLElement;
  suggestions: EventReminder[];
  /** Index of the highlighted suggestion, -1 for none */
  highlightedIndex: number;
  /** Id of the list, for the input's `aria-controls` */
  id: string;
  onHighlight: (index: number) => void;
  onPick: (reminder: EventReminder) => void;
}

/**
 * The suggestions of the reminder input, in a floating list beside the
 * panel. It never takes focus: the input keeps it, as in a combobox.
 */
function ReminderSuggestions({
  reference,
  container,
  suggestions,
  highlightedIndex,
  id,
  onHighlight,
  onPick,
}: ReminderSuggestionsProps) {
  const { refs, floatingStyles } = useFloating({
    open: true,
    placement: "left-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [offset(SUGGESTIONS_GAP), flip(), shift({ padding: 8 })],
  });

  React.useLayoutEffect(() => {
    refs.setReference(reference);
  }, [refs, reference]);

  const setFloating = React.useCallback(
    (node: HTMLDivElement | null) => refs.setFloating(node),
    [refs],
  );

  return ReactDOM.createPortal(
    <div
      ref={setFloating}
      id={id}
      role="listbox"
      aria-label="Reminders"
      data-calendar-popover=""
      style={floatingStyles}
      className={cn(
        "z-50 w-[216px] border",
        EVENT_DETAIL_MENU_CLASS,
        PANEL_MENU_SURFACE_CLASS,
      )}
      // Keep focus in the input when a suggestion is pressed
      onMouseDown={(e) => e.preventDefault()}
    >
      {suggestions.map((reminder, index) => (
        <div
          key={index}
          id={`${id}-${index}`}
          role="option"
          aria-selected={index === highlightedIndex}
          className={cn(
            "flex h-8 cursor-default items-center rounded-md px-2 text-xs text-[#CCCCCC] select-none",
            index === highlightedIndex && "bg-[#303030] text-[#F0F0F0]",
          )}
          onMouseEnter={() => onHighlight(index)}
          onClick={() => onPick(reminder)}
        >
          <span>
            <ReminderLabel
              reminder={reminder}
              beforeClassName="text-[#717070]"
            />
          </span>
        </div>
      ))}
    </div>,
    container,
  );
}

/**
 * A "Reminders" input, then one row per reminder, from the one closest to
 * the start. Focusing the input lists presets beside the panel, typing a
 * number offers it in minutes, hours, days and weeks; picking one adds it
 * unless a reminder firing at the same moment is set ("60min" and "1hour").
 * Escape closes the list and clears the input. Hovering a reminder shows an
 * × that removes it.
 */
export function EventDetailReminders<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event, onEventChange }: EventDetailSectionProps<TEvent>) {
  const { hourCycle, locale } = useCalendarConfig();
  /** Without `onEventChange` the reminders are listed, never edited */
  const readOnly = !onEventChange;
  const listId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [section, setSection] = React.useState<HTMLDivElement | null>(null);
  const [focused, setFocused] = React.useState(false);
  const [query, setQuery] = React.useState("");
  /** Whether the query has been typed since focus (clearing it then hides the list) */
  const [typed, setTyped] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  /**
   * Whether the highlighted suggestion is previewed in the input: after
   * moving to it with the arrows or the pointer, not after typing
   */
  const [previewing, setPreviewing] = React.useState(false);
  const reminders = React.useMemo(
    () => event.reminders ?? [],
    [event.reminders],
  );

  const presets = event.isAllDay ? ALL_DAY_PRESETS : TIMED_PRESETS;
  const suggestions = React.useMemo(
    () => getSuggestions(query, presets),
    [query, presets],
  );
  const highlighted =
    highlightedIndex >= 0 ? suggestions[highlightedIndex] : undefined;
  const open =
    focused && suggestions.length > 0 && (query.length > 0 || !typed);

  const preview = previewing ? highlighted : undefined;
  /** Text the input shows: the previewed suggestion, or what was typed */
  const shownText = preview
    ? (formatReminderAmount(preview) ?? AT_START_LABEL)
    : query;

  // Keep the previewed text selected, as Notion does, so typing replaces it
  React.useEffect(() => {
    if (!preview) return;
    inputRef.current?.select();
  }, [preview]);

  const highlightAndPreview = React.useCallback((index: number) => {
    setHighlightedIndex(index);
    setPreviewing(true);
  }, []);

  const handlePick = React.useCallback(
    (reminder: EventReminder) => {
      setQuery("");
      setTyped(false);
      setHighlightedIndex(-1);
      setPreviewing(false);
      const next = addReminder(reminders, reminder);
      if (next === reminders) return;
      onEventChange?.({ ...event, reminders: next });
    },
    [event, reminders, onEventChange],
  );

  const removeReminder = React.useCallback(
    (index: number) => {
      onEventChange?.({
        ...event,
        reminders: reminders.filter((_, i) => i !== index),
      });
    },
    [event, reminders, onEventChange],
  );

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setQuery(next);
      setTyped(true);
      // A typed value highlights its first suggestion, ready for Enter
      setHighlightedIndex(next.trim().length > 0 ? 0 : -1);
      setPreviewing(false);
    },
    [],
  );

  const handleFocus = React.useCallback(() => {
    setFocused(true);
  }, []);

  const handleBlur = React.useCallback(() => {
    setFocused(false);
    setQuery("");
    setTyped(false);
    setHighlightedIndex(-1);
    setPreviewing(false);
  }, []);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (suggestions.length === 0) return;
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setHighlightedIndex((index) => {
          if (index === -1) return step === 1 ? 0 : suggestions.length - 1;
          return (index + step + suggestions.length) % suggestions.length;
        });
        setPreviewing(true);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (highlighted) handlePick(highlighted);
        return;
      }
      if (e.key === "Escape") {
        // Stop here so the global handler doesn't deselect the event; leaving
        // the input closes the list and clears it
        e.preventDefault();
        e.stopPropagation();
        inputRef.current?.blur();
      }
    },
    [suggestions.length, highlighted, handlePick],
  );

  const bell = (
    <span className="flex w-4 shrink-0 items-center justify-center">
      <Bell className={EVENT_DETAIL_ICON_CLASS} />
    </span>
  );

  return (
    <EventDetailSection ref={setSection} name="reminders" className="px-2">
      <div className={cn("flex items-center", EVENT_DETAIL_ROW_HEIGHT_CLASS)}>
        {readOnly ? (
          // Read-only details: the heading without the input
          <div className={cn(ROW_BOX_CLASS, "border border-transparent")}>
            {bell}
            <span className={EVENT_DETAIL_PLACEHOLDER_CLASS}>Reminders</span>
          </div>
        ) : (
          <div
            className={cn(
              ROW_BOX_CLASS,
              "w-full",
              EVENT_DETAIL_INPUT_GROUP_CLASS,
            )}
            onClick={() => inputRef.current?.focus()}
          >
            {bell}
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-label="Add reminder"
              aria-expanded={open}
              aria-controls={open ? listId : undefined}
              aria-autocomplete="list"
              aria-activedescendant={
                open && highlightedIndex >= 0
                  ? `${listId}-${highlightedIndex}`
                  : undefined
              }
              placeholder="Reminders"
              value={shownText}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className={cn(
                // The placeholder token (EVENT_DETAIL_PLACEHOLDER_CLASS), as the title sets it
                "min-w-0 flex-1 placeholder:text-[#ABABA9] dark:placeholder:text-[#595959]",
                EVENT_DETAIL_GROUPED_INPUT_CLASS,
              )}
            />
          </div>
        )}
      </div>
      {open && (
        <ReminderSuggestions
          reference={section}
          container={getEventDetailPortalContainer(section)}
          suggestions={suggestions}
          highlightedIndex={highlightedIndex}
          id={listId}
          onHighlight={highlightAndPreview}
          onPick={handlePick}
        />
      )}
      {reminders.map((reminder, index) => (
        <div
          // Two reminders can share amount and unit (an all-day one's time
          // differs, or the host passed duplicates)
          key={index}
          data-testid="event-reminder"
          className={cn("flex items-center", EVENT_DETAIL_ROW_HEIGHT_CLASS)}
        >
          <div
            className={cn(
              ROW_BOX_CLASS,
              "group/reminder w-full rounded-sm border border-transparent",
              !readOnly && "hover:bg-[#F5F5F5] dark:hover:bg-[#242424]",
            )}
          >
            <span className="w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              <ReminderLabel
                reminder={reminder}
                beforeClassName={EVENT_DETAIL_SECONDARY_CLASS}
              />
            </span>
            {!readOnly && (
              <button
                type="button"
                aria-label={`Remove reminder: ${formatReminderLabel(reminder, hourCycle, locale).replace("\u200A", " ")}`}
                className="flex size-5 shrink-0 items-center justify-center rounded-sm text-[#919091] opacity-0 group-hover/reminder:opacity-100 focus-visible:opacity-100 dark:text-[#818181]"
                onClick={() => removeReminder(index)}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}
    </EventDetailSection>
  );
}
