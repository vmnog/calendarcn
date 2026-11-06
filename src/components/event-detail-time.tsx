"use client";

import * as React from "react";
import {
  addDays,
  addMinutes,
  differenceInCalendarDays,
  differenceInMinutes,
  format,
  isSameDay,
  parse,
  startOfDay,
  startOfMonth,
} from "date-fns";
import type { Locale } from "date-fns";
import { ChevronLeft, ChevronRight, Clock9 } from "lucide-react";
import { useDayPicker } from "react-day-picker";
import type { DayButtonProps, MonthCaptionProps } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useCalendarConfig } from "./calendar-provider";
import {
  EVENT_DETAIL_GROUPED_INPUT_CLASS,
  EVENT_DETAIL_INPUT_GROUP_CLASS,
  EVENT_DETAIL_MENU_CLASS,
  EVENT_DETAIL_MUTED_CLASS,
  EVENT_DETAIL_ROW_HEIGHT_CLASS,
  EVENT_DETAIL_SECONDARY_CLASS,
  EVENT_DETAIL_TEXT_CLASS,
  EventDetailRow,
  EventDetailSection,
} from "./event-detail-parts";
import { formatTime } from "@/lib/event-utils";
import type {
  DetailedCalendarEvent,
  EventDetailSectionProps,
  HourCycle,
} from "./week-view-types";

/** Start hour given to an all-day event switched to timed without saved times */
const DEFAULT_START_HOUR = 9;

/** End hour given to an all-day event switched to timed without saved times */
const DEFAULT_END_HOUR = 10;

/** Minutes between two options of the time menu, as in Notion Calendar */
const TIME_STEP_MINUTES = 15;

/** Options in a day of the time menu: every TIME_STEP_MINUTES from midnight */
const TIME_OPTIONS_PER_DAY = (24 * 60) / TIME_STEP_MINUTES;

/**
 * Gap between the panel's left edge and the time menu or date picker, which
 * open beside the panel, top-aligned with their field (Notion: 6px)
 */
const POPOVER_PANEL_GAP = 6;

/** A bare hour like "7" prefers the reading between 8 AM and 8 PM: 7 PM */
const DAYTIME_START_MINUTES = 8 * 60;

/** End of the daytime a bare hour prefers (8 PM) */
const DAYTIME_END_MINUTES = 20 * 60;

/**
 * A number typed as a duration below this reads as hours first ("2" → 2h,
 * then 2min), from it as minutes first ("45" → 45min, then 45h)
 */
const DURATION_HOURS_FIRST_BELOW = 15;

/** Longest duration a typed number may stand for: a week */
const MAX_TYPED_DURATION_MINUTES = 7 * 24 * 60;

/**
 * How long after a field is left (Escape, a day click) a focus with no
 * source counts as its popover handing focus back: Base UI returns it to
 * the element focused before the popup opened, as the popup closes
 */
const RETURNED_FOCUS_MS = 500;

/** Attribute marking the field popovers, whose focus goes back to the field */
const FIELD_POPOVER_ATTRIBUTE = "data-event-detail-field-popover";

/**
 * The time menu and the date picker: dark in both themes like the panel's
 * other menus, and shown at once, without the enter or exit animation of
 * Radix (`data-state`) or Base UI (`data-open`, `data-closed`)
 */
const FIELD_POPOVER_CLASS = cn(
  EVENT_DETAIL_MENU_CLASS,
  "rounded-[10px] border p-0 text-sm font-medium text-white shadow-[0_8px_24px_rgb(0_0_0/0.24)] ring-0 outline-none",
  "data-[state=open]:animate-none data-[state=closed]:animate-none data-open:animate-none data-closed:animate-none",
);

/** A field's box: 31px tall in its 35px row, bordered on hover, filled on focus */
const FIELD_BOX_CLASS = cn(
  "relative flex h-[31px] min-w-0 items-center",
  EVENT_DETAIL_INPUT_GROUP_CLASS,
);

/** Times of an all-day event: muted and inert (Notion: #B9B9B9 / #595959) */
const ALL_DAY_TIME_CLASS = "text-[#B9B9B9] dark:text-[#595959]";

/** The clock and arrow of an all-day event, fainter than its times */
const ALL_DAY_ICON_CLASS = "text-[#EEEEEE] dark:text-[#303030]";

/** The duration of an all-day event, between its icons and its times */
const ALL_DAY_DURATION_CLASS = "text-[#D2D2D2] dark:text-[#373737]";

/**
 * A time's text ("7:45 AM"): Notion Calendar sets a narrow no-break space
 * before AM/PM, about 1px narrower than the space our labels keep
 */
const TIME_TEXT_CLASS = "[word-spacing:-1px]";

/** A day of the date picker: today, the event's day and hover fill a box */
const PICKER_DAY_CLASS =
  "relative isolate flex h-[30.5px] w-full items-center justify-center text-[13px] text-[#D4D4D4] outline-none before:absolute before:top-1/2 before:left-1/2 before:-z-10 before:h-[25px] before:w-[30px] before:-translate-1/2 before:rounded-[6px] hover:before:bg-[#303030]";

/** One option of the time menu */
interface TimeOption {
  /** The time it sets */
  date: Date;
  /** "4:15 PM", or "16:15" on a 24-hour clock */
  label: string;
  /** Muted text after the label: on an end time, how long the event lasts */
  hint?: string;
}

/** "45min", "2h" or "1h 30min" */
function formatDuration(start: Date, end: Date): string {
  const totalMinutes = differenceInMinutes(end, start);

  if (totalMinutes < 60) {
    return `${totalMinutes}min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}min`;
}

/**
 * Returns a new Date with the same year/month/day as `base`
 * but with hours and minutes replaced.
 */
function applyTimeToDate(base: Date, hours: number, minutes: number): Date {
  const result = new Date(base);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/** Minutes typed after an hour: "3" means 30, as in "7:3" → 7:30 */
function readTypedMinutes(digits: string): number {
  if (digits.length === 0) return 0;
  if (digits.length === 1) return Number(digits) * 10;
  return Number(digits);
}

/** Text typed in a time field, lowercased, without spaces or dots */
function normalizeTyped(text: string): string {
  return text.toLowerCase().replace(/[\s.]/g, "");
}

/**
 * Times of day (minutes from midnight) typed text can mean, best first, as
 * Notion Calendar reads them: "7" → 7 PM, 7 AM; "9" → 9 AM, 9 PM (a bare
 * hour prefers 8 AM–8 PM); "12" → 12 PM, 12 AM, 1:20 PM, 1:20 AM (the first
 * digit as the hour too); "930" → 9:30 AM, 9:30 PM; "7:3p" → 7:30 PM. On a
 * 24-hour clock a bare hour reads as written first: "7" → 07:00, 19:00.
 */
function readTypedTimes(text: string, hourCycle: HourCycle): number[] {
  const match = /^(\d{1,4})(?::(\d{0,2}))?(a|am|p|pm)?$/.exec(
    normalizeTyped(text),
  );
  if (!match) return [];
  const [, digits, colonMinutes, period] = match;

  const readings: Array<{ hour: number; minute: number }> = [];
  if (colonMinutes !== undefined) {
    if (digits.length <= 2) {
      readings.push({
        hour: Number(digits),
        minute: readTypedMinutes(colonMinutes),
      });
    }
  } else {
    if (digits.length <= 2) {
      readings.push({ hour: Number(digits), minute: 0 });
    }
    if (digits.length >= 2 && digits.length <= 3) {
      readings.push({
        hour: Number(digits[0]),
        minute: readTypedMinutes(digits.slice(1)),
      });
    }
    if (digits.length >= 3) {
      readings.push({
        hour: Number(digits.slice(0, 2)),
        minute: readTypedMinutes(digits.slice(2)),
      });
    }
  }

  const times: number[] = [];
  for (const { hour, minute } of readings) {
    if (minute > 59) continue;
    for (const minutes of readHour(hour, period, hourCycle)) {
      const time = minutes + minute;
      if (!times.includes(time)) times.push(time);
    }
  }
  return times;
}

/**
 * Minutes from midnight an hour can mean, best first: one with "am"/"pm" or
 * outside 1–12, the daytime one first otherwise
 */
function readHour(
  hour: number,
  period: string | undefined,
  hourCycle: HourCycle,
): number[] {
  if (period) {
    if (hour < 1 || hour > 12) return [];
    const isPm = period.startsWith("p");
    return [((hour % 12) + (isPm ? 12 : 0)) * 60];
  }
  if (hour > 23) return [];
  if (hour === 0 || hour > 12) return [hour * 60];

  const morning = (hour % 12) * 60;
  const evening = morning + 12 * 60;
  if (hourCycle === 24) return [hour * 60, hour === 12 ? 0 : evening];
  const isDaytime = (minutes: number) =>
    minutes >= DAYTIME_START_MINUTES && minutes < DAYTIME_END_MINUTES;
  if (isDaytime(evening) && !isDaytime(morning)) return [evening, morning];
  return [morning, evening];
}

/**
 * Durations (minutes) typed text can mean in the end field, best first:
 * "2" → 2h, 2min; "45" → 45min, 45h; "8:30" → 8h 30min; "1h30" → 1h 30min
 */
function readTypedDurations(text: string): number[] {
  const typed = normalizeTyped(text);
  const durations: number[] = [];

  const units = /^(?:(\d{1,3})h)?(?:(\d{1,4})(?:m|min|mins)?)?$/.exec(typed);
  const clock = /^(\d{1,3})(?::(\d{0,2}))?(?:a|am|p|pm)?$/.exec(typed);
  if (clock) {
    const [, digits, colonMinutes] = clock;
    const number = Number(digits);
    if (colonMinutes !== undefined) {
      const minutes = readTypedMinutes(colonMinutes);
      if (minutes < 60) durations.push(number * 60 + minutes);
    } else if (number < DURATION_HOURS_FIRST_BELOW) {
      durations.push(number * 60, number);
    } else {
      durations.push(number, number * 60);
    }
  } else if (units && (units[1] || units[2])) {
    durations.push(Number(units[1] ?? 0) * 60 + Number(units[2] ?? 0));
  }

  return durations.filter(
    (minutes, index) =>
      minutes > 0 &&
      minutes <= MAX_TYPED_DURATION_MINUTES &&
      durations.indexOf(minutes) === index,
  );
}

/** The options' list with `value` in its place, when it's between two steps */
function withValue(options: TimeOption[], value: TimeOption): TimeOption[] {
  const time = value.date.getTime();
  if (options.some((option) => option.date.getTime() === time)) {
    return options;
  }
  const index = options.findIndex((option) => option.date.getTime() > time);
  if (index === -1) return [...options, value];
  return [...options.slice(0, index), value, ...options.slice(index)];
}

function formatDateDisplay(date: Date, locale: Locale): string {
  return format(date, "EEE MMM d", { locale });
}

/**
 * Parses a user-typed date string into a Date.
 * Strips any leading weekday name and parses "MMM d" (e.g., "Mar 11") in
 * the calendar's locale. Uses the reference date's year. Returns null if
 * unparseable.
 */
function parseDateInput(
  input: string,
  referenceDate: Date,
  locale: Locale,
): Date | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }

  // Strip an optional leading weekday ("Tue ", "sáb ") when a month name follows
  const withoutWeekday = trimmed.replace(/^[^\s\d]+\s+(?=[^\s\d])/, "");

  const parsed = parse(withoutWeekday, "MMM d", referenceDate, { locale });
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

/** Whether the event has a time of day (an all-day event's are all midnight) */
function hasTimeOfDay(event: DetailedCalendarEvent): boolean {
  return (
    event.start.getHours() !== 0 ||
    event.start.getMinutes() !== 0 ||
    event.end.getHours() !== 0 ||
    event.end.getMinutes() !== 0
  );
}

/** Whether focus is moving into a field popover (it comes straight back) */
function isFieldPopover(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(`[${FIELD_POPOVER_ATTRIBUTE}]`) !== null
  );
}

/** Selects an input's text once React has put the new value in it */
function selectSoon(inputRef: React.RefObject<HTMLInputElement | null>) {
  requestAnimationFrame(() => {
    const input = inputRef.current;
    if (input && document.activeElement === input) input.select();
  });
}

/**
 * Scrolls a list so `row` shows, the nearest way, without scrolling the
 * page or the panel the way `scrollIntoView` would
 */
function scrollRowIntoList(list: HTMLElement, row: HTMLElement) {
  const top = row.offsetTop;
  const bottom = top + row.offsetHeight;
  if (top < list.scrollTop) {
    list.scrollTop = top;
    return;
  }
  if (bottom > list.scrollTop + list.clientHeight) {
    list.scrollTop = bottom - list.clientHeight;
  }
}

/**
 * Props for FieldPopover
 */
interface FieldPopoverProps {
  open: boolean;
  /** The field's box, which the popover opens beside */
  boxRef: React.RefObject<HTMLDivElement | null>;
  boxClassName?: string;
  /** Called on a press anywhere in the box */
  onBoxClick?: () => void;
  /** Called as a press in the box starts */
  onBoxPointerDown?: () => void;
  /** What the box holds: icon, input, duration */
  field: React.ReactNode;
  /** The field's input: focus stays in it while the popover is open */
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** Called before focus comes back to the input from the popover */
  onReturnFocus: () => void;
  /** Distance from the box to the popover, so it opens beside the panel */
  sideOffset: number;
  className?: string;
  children: React.ReactNode;
}

/**
 * A field's box, and its menu or picker in the shadcn/ui Popover, opened
 * left of the panel and top-aligned with the box, as in Notion Calendar.
 * The input keeps focus while it's open: the popover moves focus into itself
 * as it opens (Radix and Base UI both do), and hands it straight back, and
 * presses inside it never take focus. The trigger is a disabled, hidden
 * button over the box, there only to place the popover, so closing never
 * returns focus to it. The field opens and closes the popover itself, on
 * focus, blur, Enter and Escape.
 */
function FieldPopover({
  open,
  boxRef,
  boxClassName,
  onBoxClick,
  onBoxPointerDown,
  field,
  inputRef,
  onReturnFocus,
  sideOffset,
  className,
  children,
}: FieldPopoverProps) {
  const handleFocusCapture = () => {
    const input = inputRef.current;
    if (!input || document.activeElement === input) return;
    onReturnFocus();
    input.focus({ preventScroll: true });
  };

  return (
    <Popover open={open}>
      <div
        ref={boxRef}
        className={boxClassName}
        onClick={onBoxClick}
        onPointerDown={onBoxPointerDown}
      >
        <PopoverTrigger asChild disabled>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className="pointer-events-none absolute -inset-px opacity-0"
          />
        </PopoverTrigger>
        {field}
      </div>
      <PopoverContent
        side="left"
        align="start"
        sideOffset={sideOffset}
        data-event-detail-field-popover=""
        onFocusCapture={handleFocusCapture}
        onMouseDown={(e) => e.preventDefault()}
        className={cn(FIELD_POPOVER_CLASS, className)}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Leaving a field whose popover is open: blurs it, and turns away the focus
 * the popover library hands back as it closes, unless the user pressed the
 * field again since
 */
function useFieldLeave(inputRef: React.RefObject<HTMLInputElement | null>) {
  const leftAtRef = React.useRef(-Infinity);
  const pressedAtRef = React.useRef(-Infinity);

  const leave = React.useCallback(() => {
    leftAtRef.current = performance.now();
    inputRef.current?.blur();
  }, [inputRef]);

  const notePress = React.useCallback(() => {
    pressedAtRef.current = performance.now();
  }, []);

  /** Whether a focus is the popover handing it back; if so, gives it up */
  const turnAwayReturnedFocus = React.useCallback(
    (e: React.FocusEvent) => {
      const now = performance.now();
      const isReturned =
        e.relatedTarget === null &&
        now - leftAtRef.current < RETURNED_FOCUS_MS &&
        pressedAtRef.current < leftAtRef.current;
      if (!isReturned) return false;
      leftAtRef.current = -Infinity;
      inputRef.current?.blur();
      return true;
    },
    [inputRef],
  );

  return { leave, notePress, turnAwayReturnedFocus };
}

/**
 * Gives Escape to a field while its popover is open. Radix and Base UI
 * listen for it on the document, and Base UI stops it there, so the field
 * takes it first, on the window, and keeps it from them, from the details'
 * own Escape and from the calendar's (which would deselect the event).
 */
function useFieldEscape(
  open: boolean,
  inputRef: React.RefObject<HTMLInputElement | null>,
  onEscape: () => void,
) {
  const onEscapeRef = React.useRef(onEscape);

  React.useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  React.useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" || document.activeElement !== inputRef.current) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      onEscapeRef.current();
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, inputRef]);
}

/**
 * Distance from a field's box to the panel's left edge plus the gap, the
 * side offset that opens its popover beside the panel
 */
function getPopoverOffset(
  box: HTMLElement | null,
  panel: HTMLElement | null,
): number {
  if (!box || !panel) return POPOVER_PANEL_GAP;
  return (
    box.getBoundingClientRect().left -
    panel.getBoundingClientRect().left +
    POPOVER_PANEL_GAP
  );
}

/**
 * The arrow between the times: Notion Calendar's is 13px wide and 10.5px
 * tall with 1.25px strokes, flatter than lucide's ArrowRight
 */
function TimeArrow({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      width="14"
      height="12"
      viewBox="0 0 14 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
    >
      <path d="M0.75 6h12.5M8.5 1.5 13.25 6 8.5 10.5" />
    </svg>
  );
}

/**
 * Props for TimeField
 */
interface TimeFieldProps {
  /** The time the field shows */
  value: Date;
  /** Every option of the menu, in order */
  options: TimeOption[];
  /** Options for typed text, best first */
  getMatches: (text: string) => TimeOption[];
  /** Sets a new time */
  onCommit: (date: Date) => void;
  formatValue: (date: Date) => string;
  /** Accessible name, e.g. "Start time" */
  label: string;
  testId: string;
  /** The time section, whose left edge is the panel's */
  panelRef: React.RefObject<HTMLElement | null>;
  /** Icon or arrow before the time */
  leading: React.ReactNode;
  /** Text after the time: the duration */
  trailing?: React.ReactNode;
  /** Muted and inert, the times of an all-day event */
  disabled?: boolean;
  /** Fits the input to its text, so `trailing` follows it */
  fitText?: boolean;
  className?: string;
}

/**
 * A time field with Notion Calendar's floating time menu: every 15 minutes,
 * opened beside the panel with the current time in view. Hovering an option
 * or moving to it with the arrow keys previews it in the field; typing lists
 * the times the text can mean. Enter or a click sets the option (the field
 * keeps focus); Escape and blur set it too.
 */
function TimeField({
  value,
  options,
  getMatches,
  onCommit,
  formatValue,
  label,
  testId,
  panelRef,
  leading,
  trailing,
  disabled = false,
  fitText = false,
  className,
}: TimeFieldProps) {
  const listId = React.useId();
  const optionIdPrefix = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);
  /** Set while focus comes back from the menu, which isn't entering the field */
  const returningFocusRef = React.useRef(false);
  const { leave, notePress, turnAwayReturnedFocus } = useFieldLeave(inputRef);
  /** Set by Escape, whose blur must not commit again */
  const skipBlurCommitRef = React.useRef(false);

  const [open, setOpen] = React.useState(false);
  /** Typed text the menu lists matches for, or null for every option */
  const [query, setQuery] = React.useState<string | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [sideOffset, setSideOffset] = React.useState(POPOVER_PANEL_GAP);
  const [list, setList] = React.useState<HTMLDivElement | null>(null);

  const formatted = formatValue(value);
  const [text, setText] = React.useState(formatted);

  // Follow the event: a commit, a drag on the calendar, another field
  React.useEffect(() => {
    setText(formatted);
  }, [formatted]);

  const shown = React.useMemo(
    () => (query === null ? options : getMatches(query)),
    [query, options, getMatches],
  );
  const valueIndex = options.findIndex(
    (option) => option.date.getTime() === value.getTime(),
  );
  const isOpen = open && !disabled;

  // Keep the active option in view: the current time when the menu opens,
  // then wherever the arrow keys move
  React.useLayoutEffect(() => {
    if (!isOpen || !list || activeIndex < 0) return;
    const row = list.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`,
    );
    if (row) scrollRowIntoList(list, row);
  }, [isOpen, list, activeIndex, shown]);

  const openMenu = () => {
    setSideOffset(getPopoverOffset(boxRef.current, panelRef.current));
    setQuery(null);
    setActiveIndex(valueIndex);
    setOpen(true);
  };

  /**
   * Closes the menu and forgets its active option, an index into the list
   * the menu showed: the blur after Enter must not set it again
   */
  const closeMenu = () => {
    setOpen(false);
    setQuery(null);
    setActiveIndex(-1);
  };

  /** Sets the active option, or puts the time back when nothing matched */
  const commit = () => {
    const option = shown[activeIndex];
    if (!option) {
      setText(formatted);
      return;
    }
    setText(formatValue(option.date));
    if (option.date.getTime() !== value.getTime()) onCommit(option.date);
  };

  const preview = (index: number) => {
    const option = shown[index];
    if (!option) return;
    setActiveIndex(index);
    setText(option.label);
    selectSoon(inputRef);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (returningFocusRef.current) {
      returningFocusRef.current = false;
      return;
    }
    if (turnAwayReturnedFocus(e)) return;
    openMenu();
    selectSoon(inputRef);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (isFieldPopover(e.relatedTarget)) return;
    if (skipBlurCommitRef.current) {
      skipBlurCommitRef.current = false;
    } else {
      commit();
    }
    closeMenu();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const typed = e.target.value;
    setText(typed);
    if (typed.trim().length === 0) {
      setQuery(null);
      setActiveIndex(-1);
    } else {
      setQuery(typed);
      setActiveIndex(getMatches(typed).length > 0 ? 0 : -1);
    }
    if (!open) {
      setSideOffset(getPopoverOffset(boxRef.current, panelRef.current));
      setOpen(true);
    }
  };

  /** Sets the active option or preview, as Notion Calendar does, and leaves the field */
  const escape = () => {
    commit();
    closeMenu();
    skipBlurCommitRef.current = true;
    leave();
  };

  useFieldEscape(isOpen, inputRef, escape);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      if (shown.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      const from =
        activeIndex < 0 ? (step > 0 ? -1 : shown.length) : activeIndex;
      preview(Math.min(Math.max(from + step, 0), shown.length - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
      closeMenu();
      selectSoon(inputRef);
      return;
    }
    if (e.key === "Escape") {
      // Before the calendar's global Escape, which would deselect the event
      e.preventDefault();
      e.stopPropagation();
      escape();
    }
  };

  /** A press on the focused field reopens a menu Enter closed */
  const handleClick = () => {
    if (disabled || open) return;
    openMenu();
  };

  const pick = (option: TimeOption) => {
    setText(formatValue(option.date));
    if (option.date.getTime() !== value.getTime()) onCommit(option.date);
    closeMenu();
    selectSoon(inputRef);
  };

  const activeOptionId =
    isOpen && activeIndex >= 0 ? `${optionIdPrefix}-${activeIndex}` : undefined;

  const input = (
    <input
      ref={inputRef}
      data-testid={testId}
      type="text"
      role="combobox"
      aria-label={label}
      aria-expanded={isOpen}
      aria-controls={isOpen ? listId : undefined}
      aria-autocomplete="list"
      aria-activedescendant={activeOptionId}
      autoComplete="off"
      spellCheck={false}
      value={text}
      readOnly={disabled}
      tabIndex={disabled ? -1 : undefined}
      onFocus={disabled ? undefined : handleFocus}
      onBlur={disabled ? undefined : handleBlur}
      onChange={handleChange}
      onKeyDown={disabled ? undefined : handleKeyDown}
      onClick={handleClick}
      // With `fitText`, the hidden copy of the text sizes the input instead
      size={fitText ? 1 : undefined}
      className={cn(
        "col-start-1 row-start-1 w-full min-w-0",
        TIME_TEXT_CLASS,
        EVENT_DETAIL_GROUPED_INPUT_CLASS,
        disabled
          ? cn(ALL_DAY_TIME_CLASS, "pointer-events-none")
          : EVENT_DETAIL_TEXT_CLASS,
      )}
    />
  );

  const field = (
    <>
      {leading}
      {fitText ? (
        <span className="flex min-w-0 items-center">
          {/* The hidden copy of the text sizes the input, so the duration follows it */}
          <span className="inline-grid min-w-0">
            <span
              aria-hidden
              className={cn(
                "invisible col-start-1 row-start-1 overflow-hidden whitespace-pre",
                TIME_TEXT_CLASS,
              )}
            >
              {text || " "}
            </span>
            {input}
          </span>
          {trailing}
        </span>
      ) : (
        <>
          <span className="grid min-w-0 flex-1">{input}</span>
          {trailing}
        </>
      )}
    </>
  );

  return (
    <FieldPopover
      open={isOpen}
      boxRef={boxRef}
      boxClassName={cn(
        FIELD_BOX_CLASS,
        disabled && "pointer-events-none hover:border-transparent",
        className,
      )}
      onBoxClick={disabled ? undefined : () => inputRef.current?.focus()}
      onBoxPointerDown={notePress}
      field={field}
      inputRef={inputRef}
      onReturnFocus={() => {
        returningFocusRef.current = true;
      }}
      sideOffset={sideOffset}
      className="w-[219px]"
    >
      <div
        ref={setList}
        id={listId}
        role="listbox"
        aria-label={label}
        className="relative max-h-[236px] overflow-y-auto overscroll-contain p-1"
      >
        {shown.map((option, index) => (
          <div
            key={option.date.getTime()}
            id={`${optionIdPrefix}-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            data-index={index}
            data-active={index === activeIndex ? "" : undefined}
            onMouseEnter={() => preview(index)}
            onClick={() => pick(option)}
            className={cn(
              "h-[30.5px] cursor-default truncate rounded-[6px] px-1.5 leading-[30.5px] select-none",
              index === activeIndex && "bg-[#303030]",
            )}
          >
            <span className={TIME_TEXT_CLASS}>{option.label}</span>
            {option.hint && (
              <>
                {" "}
                <span className="text-white/40">{option.hint}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </FieldPopover>
  );
}

/**
 * The date picker's header: "November 2026" with the previous and next
 * month chevrons over the last two columns
 */
function DatePickerCaption({ calendarMonth }: MonthCaptionProps) {
  const { goToMonth, previousMonth, nextMonth, dayPickerProps } =
    useDayPicker();
  const chevronClass =
    "flex size-[24px] items-center justify-self-center rounded-[6px] justify-center text-[#848484] outline-none hover:bg-[#303030] disabled:opacity-40";

  return (
    <div className="grid h-[33px] grid-cols-7 items-center">
      <span className="col-span-5 pl-[11px] text-[#D4D4D4]">
        {format(calendarMonth.date, "LLLL yyyy", {
          locale: dayPickerProps.locale as Locale | undefined,
        })}
      </span>
      <button
        type="button"
        aria-label="Previous month"
        disabled={!previousMonth}
        onClick={() => previousMonth && goToMonth(previousMonth)}
        className={chevronClass}
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Next month"
        disabled={!nextMonth}
        onClick={() => nextMonth && goToMonth(nextMonth)}
        className={chevronClass}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

/** A day of the date picker: today red, the event's day filled */
function DatePickerDayButton({
  // Kept off the button; DayPicker labels it
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  day,
  modifiers,
  className,
  ...props
}: DayButtonProps) {
  return (
    <button
      {...props}
      tabIndex={-1}
      className={cn(
        PICKER_DAY_CLASS,
        modifiers.outside && "text-[#5F5F5F]",
        modifiers.selected && "before:bg-[#303030]",
        modifiers.today &&
          "text-white before:bg-[#F15550] hover:before:bg-[#F15550]",
        className,
      )}
    />
  );
}

/** Custom parts of the date picker, built once */
const DATE_PICKER_COMPONENTS = {
  MonthCaption: DatePickerCaption,
  DayButton: DatePickerDayButton,
};

/**
 * Class names of the date picker. They replace the shadcn/ui Calendar's own,
 * which differ between projects (and the repo's sidebar calendar)
 */
const DATE_PICKER_CLASS_NAMES = {
  root: "relative w-full",
  months: "flex flex-col",
  month: "flex flex-col",
  month_caption: "",
  caption_label: "",
  month_grid: "w-full border-collapse",
  weekdays: "flex",
  weekday:
    "flex h-[22px] flex-1 items-center justify-center text-[11px] font-medium text-[#898989] select-none",
  week: "flex",
  day: "flex-1 p-0",
  today: "",
  selected: "",
  outside: "",
  hidden: "invisible",
};

/**
 * Props for DateField
 */
interface DateFieldProps {
  /** The day the field shows */
  value: Date;
  /** Sets a new day (time of day left to the caller) */
  onCommit: (date: Date) => void;
  /** Accessible name, e.g. "Start date" */
  label: string;
  testId: string;
  /** The time section, whose left edge is the panel's */
  panelRef: React.RefObject<HTMLElement | null>;
  className?: string;
}

/**
 * A date field with Notion Calendar's date picker beside the panel. Typing
 * a date ("Nov 12") marks it in the picker; Enter sets it, as does a click
 * on a day (which closes the picker and leaves the field). Escape puts the
 * date back.
 */
function DateField({
  value,
  onCommit,
  label,
  testId,
  panelRef,
  className,
}: DateFieldProps) {
  const { locale } = useCalendarConfig();
  const pickerId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const returningFocusRef = React.useRef(false);
  const { leave, notePress, turnAwayReturnedFocus } = useFieldLeave(inputRef);
  /** Set by Escape and a day click, whose blur must not commit again */
  const skipBlurCommitRef = React.useRef(false);

  const formatted = formatDateDisplay(value, locale);
  const [text, setText] = React.useState(formatted);
  const [open, setOpen] = React.useState(false);
  /** The typed day, marked in the picker before it's set */
  const [typedDay, setTypedDay] = React.useState<Date | null>(null);
  const [month, setMonth] = React.useState(() => startOfMonth(value));
  const [sideOffset, setSideOffset] = React.useState(POPOVER_PANEL_GAP);

  React.useEffect(() => {
    setText(formatted);
  }, [formatted]);

  const setDay = (day: Date) => {
    setText(formatDateDisplay(day, locale));
    if (!isSameDay(day, value)) onCommit(day);
  };

  /** Sets the typed day, or puts the date back when the text isn't one */
  const commitTyped = () => {
    const day = typedDay ?? parseDateInput(text, value, locale);
    if (!day) {
      setText(formatted);
      return;
    }
    setDay(day);
  };

  const close = () => {
    setOpen(false);
    setTypedDay(null);
  };

  const openPicker = () => {
    setSideOffset(getPopoverOffset(boxRef.current, panelRef.current));
    setTypedDay(null);
    setMonth(startOfMonth(value));
    setOpen(true);
    selectSoon(inputRef);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (returningFocusRef.current) {
      returningFocusRef.current = false;
      return;
    }
    if (turnAwayReturnedFocus(e)) return;
    openPicker();
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (isFieldPopover(e.relatedTarget)) return;
    if (skipBlurCommitRef.current) {
      skipBlurCommitRef.current = false;
    } else {
      commitTyped();
    }
    close();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    const day = parseDateInput(e.target.value, value, locale);
    setTypedDay(day);
    if (day) setMonth(startOfMonth(day));
    setOpen(true);
  };

  /** Puts the date back and leaves the field */
  const escape = () => {
    setText(formatted);
    close();
    skipBlurCommitRef.current = true;
    leave();
  };

  useFieldEscape(open, inputRef, escape);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitTyped();
      close();
      selectSoon(inputRef);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      escape();
    }
  };

  const handleDayClick = (day: Date) => {
    setDay(day);
    close();
    skipBlurCommitRef.current = true;
    leave();
  };

  const field = (
    <input
      ref={inputRef}
      data-testid={testId}
      type="text"
      role="combobox"
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? pickerId : undefined}
      autoComplete="off"
      spellCheck={false}
      value={text}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onClick={() => !open && openPicker()}
      className={cn(
        "w-full min-w-0",
        EVENT_DETAIL_GROUPED_INPUT_CLASS,
        EVENT_DETAIL_TEXT_CLASS,
      )}
    />
  );

  return (
    <FieldPopover
      open={open}
      boxRef={boxRef}
      boxClassName={cn(FIELD_BOX_CLASS, "pl-[8px]", className)}
      onBoxClick={() => inputRef.current?.focus()}
      onBoxPointerDown={notePress}
      field={field}
      inputRef={inputRef}
      onReturnFocus={() => {
        returningFocusRef.current = true;
      }}
      sideOffset={sideOffset}
      className="w-[272px] p-2"
    >
      <Calendar
        id={pickerId}
        // With onSelect, DayPicker follows `selected` (the typed day) as it changes
        mode="single"
        required
        selected={typedDay ?? value}
        onSelect={handleDayClick}
        month={month}
        onMonthChange={setMonth}
        showOutsideDays
        fixedWeeks
        hideNavigation
        locale={locale}
        weekStartsOn={locale.options?.weekStartsOn ?? 0}
        formatters={{
          formatWeekdayName: (date) => format(date, "EEEEEE", { locale }),
        }}
        components={DATE_PICKER_COMPONENTS}
        classNames={DATE_PICKER_CLASS_NAMES}
        className="bg-transparent p-0"
      />
    </FieldPopover>
  );
}

/**
 * Start and end time with the duration, then the date (start and end date
 * for an all-day event, whose times show muted and inert), laid out on
 * Notion Calendar's columns: the times' text at 45px and 156px from the
 * panel's edge, the dates' under them.
 */
export function EventDetailTime<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event, onEventChange }: EventDetailSectionProps<TEvent>) {
  const { hourCycle, locale } = useCalendarConfig();
  const sectionRef = React.useRef<HTMLDivElement>(null);
  const timed = hasTimeOfDay(event);
  const allDay = event.isAllDay ?? false;

  /** "3 PM" / "3:30 PM", or "15:00" / "15:30" on a 24-hour clock */
  const formatTimeValue = React.useCallback(
    (date: Date) => formatTime(date, hourCycle, locale),
    [hourCycle, locale],
  );

  const startMs = event.start.getTime();
  const endMs = event.end.getTime();

  /** Every 15 minutes of the start's day */
  const startOptions = React.useMemo(() => {
    const start = new Date(startMs);
    const day = startOfDay(start);
    const options = Array.from({ length: TIME_OPTIONS_PER_DAY }, (_, i) => {
      const date = addMinutes(day, i * TIME_STEP_MINUTES);
      return { date, label: formatTimeValue(date) };
    });
    return withValue(options, { date: start, label: formatTimeValue(start) });
  }, [startMs, formatTimeValue]);

  /** From 15 minutes after the start to a day later, with the duration */
  const endOptions = React.useMemo(() => {
    const start = new Date(startMs);
    const end = new Date(endMs);
    const toOption = (date: Date): TimeOption => ({
      date,
      label: formatTimeValue(date),
      hint: formatDuration(start, date),
    });
    const options = Array.from({ length: TIME_OPTIONS_PER_DAY }, (_, i) =>
      toOption(addMinutes(start, (i + 1) * TIME_STEP_MINUTES)),
    );
    return end > start ? withValue(options, toOption(end)) : options;
  }, [startMs, endMs, formatTimeValue]);

  const getStartMatches = React.useCallback(
    (typed: string): TimeOption[] => {
      const day = startOfDay(new Date(startMs));
      return readTypedTimes(typed, hourCycle).map((minutes) => {
        const date = addMinutes(day, minutes);
        return { date, label: formatTimeValue(date) };
      });
    },
    [startMs, hourCycle, formatTimeValue],
  );

  /** Typed times after the start (the next day's when earlier), then durations */
  const getEndMatches = React.useCallback(
    (typed: string): TimeOption[] => {
      const start = new Date(startMs);
      const dates = readTypedTimes(typed, hourCycle).map((minutes) => {
        const date = addMinutes(startOfDay(start), minutes);
        return date > start ? date : addDays(date, 1);
      });
      for (const minutes of readTypedDurations(typed)) {
        dates.push(addMinutes(start, minutes));
      }
      return dates
        .filter(
          (date, index) =>
            dates.findIndex((other) => other.getTime() === date.getTime()) ===
            index,
        )
        .map((date) => ({
          date,
          label: formatTimeValue(date),
          hint: formatDuration(start, date),
        }));
    },
    [startMs, hourCycle, formatTimeValue],
  );

  /** A new start keeps the duration, as in Notion Calendar */
  const commitStart = (date: Date) => {
    onEventChange?.({
      ...event,
      start: date,
      end: new Date(date.getTime() + (endMs - startMs)),
    });
  };

  const commitEnd = (date: Date) => {
    if (date.getTime() <= startMs) return;
    onEventChange?.({ ...event, end: date });
  };

  /** A new start date moves the whole event */
  const commitStartDate = (day: Date) => {
    const dayDiff = differenceInCalendarDays(day, event.start);
    if (dayDiff === 0) return;
    onEventChange?.({
      ...event,
      start: addDays(event.start, dayDiff),
      end: addDays(event.end, dayDiff),
    });
  };

  const commitEndDate = (day: Date) => {
    const dayDiff = differenceInCalendarDays(day, event.end);
    const end = addDays(event.end, dayDiff);
    if (dayDiff === 0 || end.getTime() < startMs) return;
    onEventChange?.({ ...event, end });
  };

  const iconClass = allDay ? ALL_DAY_ICON_CLASS : EVENT_DETAIL_MUTED_CLASS;

  return (
    <EventDetailSection ref={sectionRef} name="time">
      {timed && (
        <div className={cn("flex items-center", EVENT_DETAIL_ROW_HEIGHT_CLASS)}>
          {/* Clock ink at 18.5-34px, text at 45px */}
          <TimeField
            value={event.start}
            options={startOptions}
            getMatches={getStartMatches}
            onCommit={commitStart}
            formatValue={formatTimeValue}
            label="Start time"
            testId="event-start-time"
            panelRef={sectionRef}
            disabled={allDay}
            className="ml-[7px] w-[105px] shrink-0 gap-[10px] pl-[10px]"
            leading={
              <Clock9
                absoluteStrokeWidth
                strokeWidth={1.25}
                className={cn("size-[17px] shrink-0", iconClass)}
              />
            }
          />
          {/* Arrow ink at 129.5px, text at 156px; the box runs to 10px from the edge */}
          <TimeField
            value={event.end}
            options={endOptions}
            getMatches={getEndMatches}
            onCommit={commitEnd}
            formatValue={formatTimeValue}
            label="End time"
            testId="event-end-time"
            panelRef={sectionRef}
            disabled={allDay}
            fitText
            className="mr-[10px] ml-[5px] flex-1 gap-[12.5px] pl-[11.5px]"
            leading={<TimeArrow className={iconClass} />}
            trailing={
              <span
                className={cn(
                  "ml-1 shrink-0 whitespace-nowrap",
                  allDay
                    ? ALL_DAY_DURATION_CLASS
                    : EVENT_DETAIL_SECONDARY_CLASS,
                )}
              >
                {formatDuration(event.start, event.end)}
              </span>
            }
          />
        </div>
      )}

      <div className={cn("flex items-center", EVENT_DETAIL_ROW_HEIGHT_CLASS)}>
        {/* Text at 45px, under the start time */}
        <DateField
          value={event.start}
          onCommit={commitStartDate}
          label="Start date"
          testId="event-start-date"
          panelRef={sectionRef}
          className="ml-[36px] w-[105px] shrink-0"
        />
        {/* All-day: the end date's text at 156px, under the end time */}
        {allDay && (
          <DateField
            value={event.end}
            onCommit={commitEndDate}
            label="End date"
            testId="event-end-date"
            panelRef={sectionRef}
            className="mr-[10px] ml-[6px] flex-1"
          />
        )}
      </div>
    </EventDetailSection>
  );
}

/**
 * The all-day switch. Switching on keeps the times aside, switching off
 * puts them back (9–10 AM for an event that was all-day from the start).
 */
export function EventDetailAllDay<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event, onEventChange }: EventDetailSectionProps<TEvent>) {
  /**
   * Stores the original hours/minutes before toggling to all-day.
   * When toggling off, these are applied to the current (possibly resized) dates.
   */
  const savedTimeOfDayRef = React.useRef<{
    startHours: number;
    startMinutes: number;
    endHours: number;
    endMinutes: number;
  } | null>(null);

  const handleAllDayToggle = (checked: boolean) => {
    if (checked) {
      savedTimeOfDayRef.current = {
        startHours: event.start.getHours(),
        startMinutes: event.start.getMinutes(),
        endHours: event.end.getHours(),
        endMinutes: event.end.getMinutes(),
      };
      onEventChange?.({ ...event, isAllDay: true });
      return;
    }

    if (savedTimeOfDayRef.current) {
      const { startHours, startMinutes, endHours, endMinutes } =
        savedTimeOfDayRef.current;
      onEventChange?.({
        ...event,
        isAllDay: false,
        start: applyTimeToDate(event.start, startHours, startMinutes),
        end: applyTimeToDate(event.end, endHours, endMinutes),
      });
      savedTimeOfDayRef.current = null;
      return;
    }

    onEventChange?.({
      ...event,
      isAllDay: false,
      start: applyTimeToDate(event.start, DEFAULT_START_HOUR, 0),
      end: applyTimeToDate(event.end, DEFAULT_END_HOUR, 0),
    });
  };

  return (
    <EventDetailSection name="all-day">
      {/* Clicking the label or the row toggles too */}
      <EventDetailRow
        className="cursor-default"
        onClick={() => handleAllDayToggle(!(event.isAllDay ?? false))}
        leading={
          <Switch
            size="sm"
            checked={event.isAllDay ?? false}
            onCheckedChange={handleAllDayToggle}
            onClick={(e) => e.stopPropagation()}
            aria-label="All-day"
            // data-[state=*] is the Radix switch, data-checked/data-unchecked
            // Base UI's. Notion's is 18x11 with a 9px white thumb
            className="data-[size=sm]:h-[11px] data-[size=sm]:w-[18px] **:data-[slot=switch-thumb]:!size-[9px] **:data-[slot=switch-thumb]:!bg-white data-[state=unchecked]:!bg-[#C7C5C1] data-unchecked:!bg-[#C7C5C1] dark:data-[state=unchecked]:!bg-[#595959] dark:data-unchecked:!bg-[#595959] data-[state=checked]:!bg-[#3A85D3] data-checked:!bg-[#3A85D3]"
          />
        }
      >
        <span className={EVENT_DETAIL_TEXT_CLASS}>All-day</span>
      </EventDetailRow>
    </EventDetailSection>
  );
}
