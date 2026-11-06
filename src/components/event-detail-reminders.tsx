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

import { cn } from "@/lib/utils";
import {
  EVENT_DETAIL_GROUPED_INPUT_CLASS,
  EVENT_DETAIL_HOVER_BORDER_CLASS,
  EVENT_DETAIL_ICON_CLASS,
  EVENT_DETAIL_MENU_CLASS,
  EventDetailSection,
} from "./event-detail-parts";
import { PANEL_MENU_SURFACE_CLASS } from "./event-detail-availability";
import type {
  DetailedCalendarEvent,
  EventDetailSectionProps,
  EventReminder,
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

/** Reminders offered before anything is typed, for a timed event */
const TIMED_PRESETS: EventReminder[] = [
  { amount: 0, unit: "minutes" },
  { amount: 5, unit: "minutes" },
  { amount: 10, unit: "minutes" },
  { amount: 30, unit: "minutes" },
  { amount: 1, unit: "hours" },
];

/** Reminders offered before anything is typed, for an all-day event */
const ALL_DAY_PRESETS: EventReminder[] = [
  { amount: 0, unit: "minutes" },
  { amount: 1, unit: "days" },
  { amount: 2, unit: "days" },
  { amount: 3, unit: "days" },
  { amount: 1, unit: "weeks" },
];

/** Muted "before" after a reminder in the panel */
const BEFORE_CLASS = "text-[#7F7E7E] dark:text-[#777777]";

/**
 * "10min", "1hour", "2days" (with a hair space, as Notion sets it), or null
 * for a reminder at the start of the event
 */
function formatReminderAmount(reminder: EventReminder): string | null {
  if (reminder.amount === 0) return null;
  const [one, many] = REMINDER_UNIT_LABELS[reminder.unit];
  return `${reminder.amount} ${reminder.amount === 1 ? one : many}`;
}

/** Whether two reminders fire at the same time before the event */
function sameReminder(a: EventReminder, b: EventReminder): boolean {
  if (a.amount === 0 && b.amount === 0) return true;
  return a.amount === b.amount && a.unit === b.unit;
}

/**
 * Suggestions for what was typed: a number is offered in every unit, other
 * text filters the presets. Empty text offers the presets.
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
    return REMINDER_UNITS.filter((unit) =>
      REMINDER_UNIT_LABELS[unit][1].startsWith(unitText),
    ).map((unit) => ({ amount, unit }));
  }

  return presets.filter((preset) =>
    (formatReminderAmount(preset) ?? "at start of event")
      .toLowerCase()
      .includes(trimmed),
  );
}

/** One reminder as Notion writes it: "10min before", "At start of event" */
function ReminderLabel({
  reminder,
  beforeClassName,
}: {
  reminder: EventReminder;
  beforeClassName: string;
}) {
  const amount = formatReminderAmount(reminder);
  if (!amount) return <>At start of event</>;

  return (
    <>
      {amount} <span className={beforeClassName}>before</span>
    </>
  );
}

/**
 * Props for ReminderSuggestions
 */
interface ReminderSuggestionsProps {
  /** Element the list lines up with: the section, so it opens beside the panel */
  reference: HTMLElement | null;
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
          key={`${reminder.amount}-${reminder.unit}`}
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
    document.body,
  );
}

/**
 * A "Reminders" input, then one row per reminder. Focusing the input lists
 * presets beside the panel, typing a number offers it in minutes, hours,
 * days and weeks; picking one adds it. Hovering a reminder shows an × that
 * removes it.
 */
export function EventDetailReminders<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event, onEventChange }: EventDetailSectionProps<TEvent>) {
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
    ? (formatReminderAmount(preview) ?? "At start of event")
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

  const addReminder = React.useCallback(
    (reminder: EventReminder) => {
      setQuery("");
      setTyped(false);
      setHighlightedIndex(-1);
      setPreviewing(false);
      if (reminders.some((r) => sameReminder(r, reminder))) return;
      onEventChange?.({ ...event, reminders: [...reminders, reminder] });
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
        if (highlighted) addReminder(highlighted);
        return;
      }
      if (e.key === "Escape") {
        // Stop here so the global handler doesn't deselect the event
        e.preventDefault();
        e.stopPropagation();
        inputRef.current?.blur();
      }
    },
    [suggestions.length, highlighted, addReminder],
  );

  return (
    <EventDetailSection ref={setSection} name="reminders" className="px-2">
      <div
        className={cn(
          "flex h-8 cursor-text items-center gap-3 px-2 text-xs",
          EVENT_DETAIL_HOVER_BORDER_CLASS,
          "has-[:focus]:border-[#F5F5F5] has-[:focus]:bg-[#F5F5F5] dark:has-[:focus]:border-[#252525] dark:has-[:focus]:bg-[#252525]",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        <span className="flex w-4 shrink-0 items-center justify-center">
          <Bell className={EVENT_DETAIL_ICON_CLASS} />
        </span>
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
            "text-foreground min-w-0 flex-1 text-xs placeholder:text-[#C7C5C1] dark:placeholder:text-[#595959]",
            EVENT_DETAIL_GROUPED_INPUT_CLASS,
          )}
        />
      </div>
      {open && (
        <ReminderSuggestions
          reference={section}
          suggestions={suggestions}
          highlightedIndex={highlightedIndex}
          id={listId}
          onHighlight={highlightAndPreview}
          onPick={addReminder}
        />
      )}
      {reminders.map((reminder, index) => (
        <div
          key={`${reminder.amount}-${reminder.unit}`}
          data-testid="event-reminder"
          className="group/reminder flex h-8 items-center gap-3 rounded-sm px-2 text-xs hover:bg-[#F5F5F5] dark:hover:bg-[#252525]"
        >
          <span className="w-4 shrink-0" />
          <span className="text-foreground min-w-0 flex-1 truncate">
            <ReminderLabel reminder={reminder} beforeClassName={BEFORE_CLASS} />
          </span>
          <button
            type="button"
            aria-label={`Remove reminder ${formatReminderAmount(reminder) ?? "at start of event"}`}
            className="flex size-5 shrink-0 items-center justify-center rounded-sm text-[#919091] opacity-0 group-hover/reminder:opacity-100 focus-visible:opacity-100 dark:text-[#818181]"
            onClick={() => removeReminder(index)}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </EventDetailSection>
  );
}
