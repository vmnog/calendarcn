"use client";

import * as React from "react";
import { format, isSameYear, isValid, parse, startOfDay } from "date-fns";
import type { Locale } from "date-fns";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  RefreshCcw,
  RefreshCwOff,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useHoverTooltip } from "@/hooks/use-hover-tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCalendarConfig } from "./calendar-provider";
import {
  EVENT_DETAIL_HOVER_BORDER_CLASS,
  EVENT_DETAIL_ICON_CLASS,
  EVENT_DETAIL_MENU_CLASS,
  EVENT_DETAIL_MUTED_CLASS,
  EVENT_DETAIL_PLACEHOLDER_CLASS,
  EVENT_DETAIL_ROW_HEIGHT_CLASS,
  EVENT_DETAIL_SECONDARY_CLASS,
  EventDetailSection,
  EventDetailTooltip,
  closeMenuOnEscape,
  stopEscapePropagation,
} from "./event-detail-parts";
import {
  RECURRENCE_UNITS,
  describeRecurrenceRule,
  getDefaultRecurrenceEnd,
  getEventRecurrenceRule,
  getRecurrencePresets,
  isRRule,
  isSameRecurrenceRule,
  normalizeRecurrenceRule,
} from "@/lib/recurrence";
import { getEventTimeZone, getZonedDay } from "@/lib/time-zones";
import type {
  DetailedCalendarEvent,
  EventDetailRecurrenceProps,
  NormalizedRecurrenceRule,
  RecurrenceEnd,
  RecurrenceFrequency,
  RecurrenceLabel,
  RecurrenceRule,
  RecurrenceWeekday,
} from "./week-view-types";

/** Frequencies in the custom dialog's unit menu */
const FREQUENCIES: RecurrenceFrequency[] = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
];

/** Days of the custom dialog's "On" row, Sunday first */
const DIALOG_WEEKDAYS: RecurrenceWeekday[] = [0, 1, 2, 3, 4, 5, 6];

/** Largest "Every" and "After" number the custom dialog takes */
const MAX_RECURRENCE_NUMBER = 999;

/** Formats the custom dialog's end date reads and writes, most specific first */
const END_DATE_FORMATS = [
  "EEE MMM d ''yy",
  "EEEEEE MMM d ''yy",
  "EEE MMM d yyyy",
  "MMM d yyyy",
  "MMM d, yyyy",
  "EEE MMM d",
  "MMM d",
  "yyyy-MM-dd",
  "M/d/yyyy",
  "M/d",
];

/** Item text in the repeat menu, which is dark in both themes */
const MENU_ITEM_CLASS =
  "relative h-8 gap-2 rounded-md py-0 pr-3 pl-7 text-sm font-medium text-[#D4D4D4] focus:!bg-[#303030] focus:!text-[#D4D4D4]";

/** "on Thu" in the repeat menu */
const MENU_DETAIL_CLASS = "text-[#7F7F7F]";

/** A field of the custom dialog: bordered, filled on focus */
const DIALOG_FIELD_CLASS =
  "rounded-md border border-[#E8E8E4] bg-transparent text-foreground outline-none focus-within:border-[#F5F5F5] focus-within:bg-[#F5F5F5] has-[:disabled]:text-[#C7C5C1] dark:border-[#303030] dark:focus-within:border-[#303030] dark:focus-within:bg-[#303030] dark:has-[:disabled]:text-[#595959]";

/** Blue of the checked radio and the Done button, the same in both themes */
const ACCENT_BG_CLASS = "bg-[#3A85D3] dark:bg-[#3A85D3]";

/** Blue of a selected day in the custom dialog, softer than the button's */
const SELECTED_DAY_CLASS =
  "bg-[#82B7F0] text-white dark:bg-[#245A92] dark:text-white";

/** What the row shows for an RRULE the details can't read */
const CUSTOM_RECURRENCE_LABEL: RecurrenceLabel = {
  main: "Custom repeat",
  detail: "",
};

/**
 * Props for HoverTooltip
 */
interface HoverTooltipProps {
  /** Text shown above the element */
  label: string;
  /**
   * Checked when the tooltip would show; return false to skip it (e.g. text
   * that isn't truncated)
   */
  when?: (element: HTMLElement) => boolean;
  /** One element, which the tooltip points at */
  children: React.ReactElement;
}

/**
 * The details' tooltip above an element, after the pointer rests on it or
 * once it gets keyboard focus
 */
function HoverTooltip({ label, when, children }: HoverTooltipProps) {
  const tooltip = useHoverTooltip();
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  /** Places the tooltip over the wrapped element and schedules it */
  const show = (wrapper: HTMLElement) => {
    // The wrapper is `display: contents`: measure the element inside
    const element = wrapper.firstElementChild;
    if (!(element instanceof HTMLElement)) return;
    if (when && !when(element)) return;
    setRect(element.getBoundingClientRect());
    tooltip.scheduleOpen();
  };

  return (
    <>
      <span
        className="contents"
        onPointerEnter={(e) => show(e.currentTarget)}
        onPointerLeave={tooltip.scheduleClose}
        onPointerDown={tooltip.scheduleClose}
        onFocus={(e) => {
          if (!e.target.matches(":focus-visible")) return;
          show(e.currentTarget);
        }}
        onBlur={tooltip.scheduleClose}
      >
        {children}
      </span>
      <EventDetailTooltip rect={tooltip.isOpen ? rect : null}>
        {label}
      </EventDetailTooltip>
    </>
  );
}

/** Whether an element's text is cut off with an ellipsis */
function isTruncated(element: HTMLElement): boolean {
  const text = element.querySelector<HTMLElement>("[data-truncate]");
  return Boolean(text && text.scrollWidth > text.clientWidth);
}

/** "Every week" in full color, "on Thu" muted */
function RecurrenceText({
  label,
  detailClassName,
}: {
  label: RecurrenceLabel;
  detailClassName: string;
}) {
  return (
    <>
      <span>{label.main}</span>
      {label.detail && <span className={detailClassName}> {label.detail}</span>}
    </>
  );
}

/**
 * What the row shows for the event's repeat rule: the rule read out, a
 * display text as it is, "Custom repeat" for an RRULE the details can't
 * read, or `null` when it doesn't repeat
 */
function getRecurrenceLabel(
  event: DetailedCalendarEvent,
  rule: RecurrenceRule | null,
  start: Date,
  locale: Locale,
): RecurrenceLabel | null {
  if (rule) return describeRecurrenceRule(rule, start, locale);
  if (!event.recurrence) return null;
  if (isRRule(event.recurrence)) return CUSTOM_RECURRENCE_LABEL;
  return { main: event.recurrence, detail: "" };
}

/** The end the custom dialog's "Ends" choice stands for */
function getDialogEnd(
  type: RecurrenceEnd["type"],
  date: Date,
  count: number,
): RecurrenceEnd {
  if (type === "on") return { type: "on", date };
  if (type === "after") return { type: "after", count };
  return { type: "never" };
}

/** Formats the custom dialog's end date: "Sun Dec 6", "Su Nov 7 '27" another year */
function formatEndDate(date: Date, locale: Locale): string {
  if (isSameYear(date, new Date()))
    return format(date, "EEE MMM d", { locale });
  return format(date, "EEEEEE MMM d ''yy", { locale });
}

/** Reads a typed end date, or `null` when it isn't one */
function parseEndDate(text: string, locale: Locale): Date | null {
  const trimmed = text.trim();
  for (const pattern of END_DATE_FORMATS) {
    const date = parse(trimmed, pattern, new Date(), { locale });
    if (isValid(date)) return startOfDay(date);
  }
  return null;
}

/** A whole number from 1 to `MAX_RECURRENCE_NUMBER`, or `fallback` */
function clampCount(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.round(value), 1), MAX_RECURRENCE_NUMBER);
}

/**
 * Props for NumberField
 */
interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/** A number with up and down steppers, as the custom dialog's "Every" and "After" */
function NumberField({ label, value, onChange, disabled }: NumberFieldProps) {
  const [text, setText] = React.useState(String(value));

  React.useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = () => {
    const next = clampCount(Number(text), value);
    setText(String(next));
    onChange(next);
  };

  return (
    <div
      className={cn(
        "flex h-8 w-[72px] items-center pl-2.5 pr-1",
        DIALOG_FIELD_CLASS,
      )}
    >
      <input
        type="text"
        inputMode="numeric"
        aria-label={label}
        value={text}
        disabled={disabled}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setText(e.target.value.replace(/\D/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            onChange(clampCount(value + (e.key === "ArrowUp" ? 1 : -1), value));
          }
          if (e.key === "Enter") commit();
        }}
        className="min-w-0 flex-1 border-none bg-transparent p-0 outline-none disabled:cursor-default"
      />
      <span className="flex flex-col">
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Increase ${label}`}
          disabled={disabled}
          onClick={() => onChange(clampCount(value + 1, value))}
          className="text-[#989795] hover:text-foreground disabled:text-inherit dark:text-[#7F7F7F]"
        >
          <ChevronUp className="size-3" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Decrease ${label}`}
          disabled={disabled}
          onClick={() => onChange(clampCount(value - 1, value))}
          className="text-[#989795] hover:text-foreground disabled:text-inherit dark:text-[#7F7F7F]"
        >
          <ChevronDown className="size-3" />
        </button>
      </span>
    </div>
  );
}

/** A round radio, blue with a white dot when checked */
function RadioDot({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full",
        checked
          ? ACCENT_BG_CLASS
          : "border border-[#E8E8E4] bg-[#F5F5F5] dark:border-[#373737] dark:bg-[#303030]",
      )}
    >
      {checked && <span className="size-1.5 rounded-full bg-white" />}
    </span>
  );
}

/**
 * Props for CustomRecurrenceDialog
 */
interface CustomRecurrenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Day of the occurrence the rule is edited from, in the event's zone */
  start: Date;
  /** The rule to start from, or null to start from "every week" */
  rule: RecurrenceRule | null;
  onSave: (rule: RecurrenceRule) => void;
}

/**
 * Notion Calendar's "Repeat" dialog: every N days, weeks, months or years;
 * the days of the week, or the day of the month; and when it ends (never,
 * on a date, or after a number of times)
 */
function CustomRecurrenceDialog({
  open,
  onOpenChange,
  start,
  rule,
  onSave,
}: CustomRecurrenceDialogProps) {
  const { locale } = useCalendarConfig();
  const initial = normalizeRecurrenceRule(
    rule ?? { frequency: "weekly" },
    start,
  );
  const [frequency, setFrequency] = React.useState(initial.frequency);
  const [interval, setRepeatInterval] = React.useState(initial.interval);
  const [weekdays, setWeekdays] = React.useState(initial.weekdays);
  const [monthlyBy, setMonthlyBy] = React.useState(initial.monthlyBy);
  /** Week of the month a "weekday-of-month" rule keeps: the rule's own, else the start's */
  const weekOfMonth: NormalizedRecurrenceRule["weekOfMonth"] =
    initial.weekOfMonth;
  const [endType, setEndType] = React.useState<RecurrenceEnd["type"]>(
    initial.end.type,
  );
  const [endDate, setEndDate] = React.useState(() =>
    initial.end.type === "on"
      ? initial.end.date
      : getDefaultRecurrenceEnd(initial.frequency, start).date,
  );
  const [endCount, setEndCount] = React.useState(() =>
    initial.end.type === "after"
      ? initial.end.count
      : getDefaultRecurrenceEnd(initial.frequency, start).count,
  );
  const [endDateText, setEndDateText] = React.useState(() =>
    formatEndDate(endDate, locale),
  );
  const endDateRef = React.useRef<HTMLInputElement>(null);
  const endCountRef = React.useRef<HTMLDivElement>(null);

  const changeFrequency = (next: RecurrenceFrequency) => {
    setFrequency(next);
    const defaults = getDefaultRecurrenceEnd(next, start);
    if (endType !== "on") {
      setEndDate(defaults.date);
      setEndDateText(formatEndDate(defaults.date, locale));
    }
    if (endType !== "after") setEndCount(defaults.count);
  };

  const toggleWeekday = (day: RecurrenceWeekday) => {
    setWeekdays((current) => {
      if (!current.includes(day))
        return [...current, day].sort((a, b) => a - b);
      // A weekly rule keeps at least one day
      if (current.length === 1) return current;
      return current.filter((other) => other !== day);
    });
  };

  const commitEndDate = () => {
    const parsed = parseEndDate(endDateText, locale);
    const next = parsed && parsed >= startOfDay(start) ? parsed : endDate;
    setEndDate(next);
    setEndDateText(formatEndDate(next, locale));
  };

  const chooseEnd = (type: RecurrenceEnd["type"]) => {
    setEndType(type);
    requestAnimationFrame(() => {
      if (type === "on") endDateRef.current?.select();
      if (type === "after")
        endCountRef.current?.querySelector("input")?.select();
    });
  };

  const save = () => {
    const end = getDialogEnd(endType, endDate, endCount);
    const next: RecurrenceRule = { frequency };
    if (interval > 1) next.interval = interval;
    if (frequency === "weekly") next.weekdays = weekdays;
    if (frequency === "weekly" && rule?.weekStartsOn !== undefined) {
      next.weekStartsOn = rule.weekStartsOn;
    }
    if (frequency === "monthly") next.monthlyBy = monthlyBy;
    if (frequency === "monthly" && monthlyBy === "weekday-of-month") {
      next.weekOfMonth = weekOfMonth;
    }
    if (end.type !== "never") next.end = end;
    onSave(next);
  };

  const unit = RECURRENCE_UNITS[frequency];
  const unitLabel = (value: RecurrenceFrequency) =>
    interval > 1 ? `${RECURRENCE_UNITS[value]}s` : RECURRENCE_UNITS[value];
  const dayOfMonth = describeRecurrenceRule(
    { frequency: "monthly", monthlyBy: "day-of-month" },
    start,
    locale,
  ).detail.replace(/^on /, "");
  const weekdayOfMonth = describeRecurrenceRule(
    { frequency: "monthly", monthlyBy: "weekday-of-month", weekOfMonth },
    start,
    locale,
  ).detail.replace(/^on /, "");
  const ends: { type: RecurrenceEnd["type"]; label: string }[] = [
    { type: "never", label: "Never" },
    { type: "on", label: "On" },
    { type: "after", label: "After" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[434px] max-w-[calc(100vw-32px)] gap-5 rounded-xl border-[#E8E8E4] bg-white p-[27px] text-sm font-medium dark:border-[#303030] dark:bg-[#252525]"
        onKeyDown={stopEscapePropagation}
      >
        <DialogTitle className="text-base font-medium">Repeat</DialogTitle>
        <DialogDescription className="sr-only">
          How often the event repeats and when it stops
        </DialogDescription>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-foreground">Every</span>
            <NumberField
              label="Interval"
              value={interval}
              onChange={setRepeatInterval}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Unit: ${unit}`}
                  className={cn(
                    "flex h-8 w-[87px] items-center justify-between px-2.5 data-[state=open]:bg-[#F5F5F5] data-popup-open:bg-[#F5F5F5] dark:data-[state=open]:bg-[#303030] dark:data-popup-open:bg-[#303030]",
                    DIALOG_FIELD_CLASS,
                  )}
                >
                  {unitLabel(frequency)}
                  <ChevronDown
                    className={cn("size-3.5", EVENT_DETAIL_MUTED_CLASS)}
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className={cn(
                  "min-w-[140px] rounded-lg",
                  EVENT_DETAIL_MENU_CLASS,
                )}
                onKeyDown={stopEscapePropagation}
              >
                {FREQUENCIES.map((value) => (
                  <DropdownMenuItem
                    key={value}
                    className={MENU_ITEM_CLASS}
                    onClick={() => changeFrequency(value)}
                  >
                    {value === frequency && (
                      <Check className="absolute left-2.5 size-3.5" />
                    )}
                    {unitLabel(value)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {frequency === "weekly" && (
            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-foreground">On</span>
              <div className="flex gap-[9px]" role="group" aria-label="Days">
                {DIALOG_WEEKDAYS.map((day) => {
                  const selected = weekdays.includes(day);
                  const date = new Date(start);
                  date.setDate(start.getDate() - start.getDay() + day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={selected}
                      aria-label={format(date, "EEEE", { locale })}
                      onClick={() => toggleWeekday(day)}
                      className={cn(
                        "flex size-[26px] items-center justify-center rounded-full text-[11px] font-semibold",
                        selected
                          ? SELECTED_DAY_CLASS
                          : "border border-[#E8E8E4] text-foreground hover:bg-[#F5F5F5] dark:border-[#373737] dark:bg-[#303030] dark:hover:bg-[#373737]",
                      )}
                    >
                      {format(date, "EEEEEE", { locale })}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {frequency === "monthly" && (
            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-foreground">On</span>
              <div
                role="radiogroup"
                aria-label="Day of the month"
                className="flex rounded-md bg-[#F5F5F5] p-0.5 dark:bg-[#303030]"
              >
                {(
                  [
                    ["day-of-month", dayOfMonth],
                    ["weekday-of-month", weekdayOfMonth],
                  ] as const
                ).map(([value, text]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={monthlyBy === value}
                    onClick={() => setMonthlyBy(value)}
                    className={cn(
                      "rounded-[5px] px-4 py-1.5 text-foreground",
                      monthlyBy === value &&
                        "bg-white shadow-sm dark:bg-[#252525]",
                    )}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <span className="text-foreground">Ends</span>
            <div
              role="radiogroup"
              aria-label="Ends"
              className="flex flex-col gap-2"
            >
              {ends.map(({ type, label }) => (
                <div key={type} className="flex h-8 items-center">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={endType === type}
                    onClick={() => chooseEnd(type)}
                    className="flex w-24 shrink-0 items-center gap-2.5 text-foreground outline-none"
                  >
                    <RadioDot checked={endType === type} />
                    {label}
                  </button>
                  {type === "on" && (
                    <div
                      className={cn(
                        "flex h-8 w-36 items-center px-2.5",
                        DIALOG_FIELD_CLASS,
                      )}
                    >
                      <input
                        ref={endDateRef}
                        type="text"
                        aria-label="End date"
                        value={endDateText}
                        disabled={endType !== "on"}
                        onChange={(e) => setEndDateText(e.target.value)}
                        onBlur={commitEndDate}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEndDate();
                        }}
                        className="min-w-0 flex-1 border-none bg-transparent p-0 outline-none"
                      />
                    </div>
                  )}
                  {type === "after" && (
                    <div
                      ref={endCountRef}
                      className="flex items-center gap-2.5"
                    >
                      <NumberField
                        label="Occurrences"
                        value={endCount}
                        onChange={setEndCount}
                        disabled={endType !== "after"}
                      />
                      <span
                        className={
                          endType === "after"
                            ? "text-foreground"
                            : EVENT_DETAIL_MUTED_CLASS
                        }
                      >
                        times
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-8 rounded-md border border-[#E8E8E4] px-3 text-foreground hover:bg-[#F5F5F5] dark:border-[#373737] dark:bg-[#303030] dark:hover:bg-[#373737]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className={cn(
              "h-8 rounded-md px-3 text-white hover:brightness-110",
              ACCENT_BG_CLASS,
            )}
          >
            Done
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The event's repeat rule, "Every week on Thu", or a muted "Repeat". Clicking
 * it opens Notion Calendar's menu: "Does not repeat", the presets for the
 * event's date (every day, every weekday or weekend day, every week, every 2
 * weeks, every month on the day or on the weekday, every year), the current
 * rule when it is none of those, and "Custom…" for the full rule dialog. A
 * repeating event gets buttons to its series' previous and next events.
 */
export function EventDetailRecurrence<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({
  event,
  onEventChange,
  onPrevious,
  onNext,
}: EventDetailRecurrenceProps<TEvent>) {
  const { locale } = useCalendarConfig();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [customOpen, setCustomOpen] = React.useState(false);
  /** Remounts the custom dialog on each open, so it starts from the current rule */
  const [customKey, setCustomKey] = React.useState(0);

  // A rule counts its days in the event's zone
  const start = getZonedDay(event.start, getEventTimeZone(event));
  const rule = getEventRecurrenceRule(event);
  const repeats = Boolean(rule ?? event.recurrence);
  const label = getRecurrenceLabel(event, rule, start, locale);

  const presets = getRecurrencePresets(start);
  const checkedPreset = rule
    ? presets.findIndex((preset) => isSameRecurrenceRule(preset, rule, start))
    : -1;

  const applyRule = (next: RecurrenceRule | null) => {
    onEventChange?.({
      ...event,
      recurrenceRule: next ?? undefined,
      recurrence: undefined,
    });
  };

  /** Closes the custom dialog and puts focus back on the Repeat button */
  const closeCustom = () => {
    setCustomOpen(false);
    // After the dialog's own focus handling, which has nothing to return to:
    // it opened from a menu item that is gone
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const fullText = label
    ? [label.main, label.detail].filter(Boolean).join(" ")
    : "Repeat";

  return (
    <EventDetailSection name="recurrence">
      <div
        className={cn(
          "flex items-center pr-[13px] pl-[18px]",
          EVENT_DETAIL_ROW_HEIGHT_CLASS,
        )}
      >
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <HoverTooltip label={fullText} when={isTruncated}>
            <DropdownMenuTrigger asChild>
              <button
                ref={triggerRef}
                type="button"
                aria-label={`Repeat: ${repeats ? fullText : "does not repeat"}`}
                disabled={!onEventChange}
                className={cn(
                  EVENT_DETAIL_HOVER_BORDER_CLASS,
                  "group/repeat -ml-[13px] flex h-[31px] min-w-0 flex-1 items-center gap-[11px] rounded-sm pr-2 pl-3 text-left outline-none disabled:cursor-default disabled:hover:border-transparent",
                  // Without the series buttons the box ends 10px before the panel's edge
                  !repeats && "-mr-[3px]",
                  "focus-visible:border-[#3A85D3] dark:focus-visible:border-[#3A85D3]",
                  "data-[state=open]:border-[#F5F5F5] data-[state=open]:bg-[#F5F5F5] data-popup-open:border-[#F5F5F5] data-popup-open:bg-[#F5F5F5] dark:data-[state=open]:border-[#242424] dark:data-[state=open]:bg-[#242424] dark:data-popup-open:border-[#242424] dark:data-popup-open:bg-[#242424]",
                )}
              >
                <RefreshCcw className={EVENT_DETAIL_ICON_CLASS} />
                <span data-truncate className="min-w-0 flex-1 truncate">
                  {label ? (
                    <RecurrenceText
                      label={label}
                      detailClassName={EVENT_DETAIL_SECONDARY_CLASS}
                    />
                  ) : (
                    <span className={EVENT_DETAIL_PLACEHOLDER_CLASS}>
                      Repeat
                    </span>
                  )}
                </span>
                {onEventChange && (
                  // Takes room only while it shows, so a rule at rest gets
                  // the whole width, as in Notion Calendar
                  <ChevronDown
                    className={cn(
                      "hidden size-4 shrink-0 group-hover/repeat:block group-data-[state=open]/repeat:block group-data-popup-open/repeat:block",
                      EVENT_DETAIL_MUTED_CLASS,
                    )}
                  />
                )}
              </button>
            </DropdownMenuTrigger>
          </HoverTooltip>
          <DropdownMenuContent
            side="left"
            align="start"
            sideOffset={14}
            className={cn(
              "w-max min-w-[231px] rounded-lg",
              EVENT_DETAIL_MENU_CLASS,
            )}
            onKeyDown={closeMenuOnEscape(() => setMenuOpen(false))}
          >
            {repeats && (
              <>
                <DropdownMenuItem
                  className={MENU_ITEM_CLASS}
                  onClick={() => applyRule(null)}
                >
                  <RefreshCwOff className="absolute left-2.5 size-3.5 text-[#D4D4D4]" />
                  Does not repeat
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#303030]" />
              </>
            )}
            {presets.map((preset, index) => (
              <DropdownMenuItem
                key={index}
                className={MENU_ITEM_CLASS}
                onClick={() => applyRule(preset)}
              >
                {index === checkedPreset && (
                  <Check className="absolute left-2.5 size-3.5 text-[#D4D4D4]" />
                )}
                <span>
                  <RecurrenceText
                    label={describeRecurrenceRule(preset, start, locale)}
                    detailClassName={cn("ml-1", MENU_DETAIL_CLASS)}
                  />
                </span>
              </DropdownMenuItem>
            ))}
            {label && checkedPreset === -1 && (
              <DropdownMenuItem
                className={MENU_ITEM_CLASS}
                onClick={() => setMenuOpen(false)}
              >
                <Check className="absolute left-2.5 size-3.5 text-[#D4D4D4]" />
                <span>
                  <RecurrenceText
                    label={label}
                    detailClassName={cn("ml-1", MENU_DETAIL_CLASS)}
                  />
                </span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-[#303030]" />
            <DropdownMenuItem
              className={MENU_ITEM_CLASS}
              onClick={() => {
                setCustomKey((key) => key + 1);
                setCustomOpen(true);
              }}
            >
              Custom…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {repeats && (
          <div className="ml-[9px] flex shrink-0 items-center">
            <SeriesButton
              label="Go to previous event in this series"
              onClick={onPrevious}
            >
              <ChevronLeft className="size-4" />
            </SeriesButton>
            <SeriesButton
              label="Go to next event in this series"
              onClick={onNext}
            >
              <ChevronRight className="size-4" />
            </SeriesButton>
          </div>
        )}
      </div>

      {/* Stays mounted while it closes: its Escape handler must still run to
          keep the calendar's global Escape from deselecting the event */}
      <CustomRecurrenceDialog
        key={customKey}
        open={customOpen}
        onOpenChange={(open) => {
          if (!open) closeCustom();
        }}
        start={start}
        rule={rule}
        onSave={(next) => {
          applyRule(next);
          closeCustom();
        }}
      />
    </EventDetailSection>
  );
}

/**
 * Props for SeriesButton
 */
interface SeriesButtonProps {
  /** Tooltip and accessible name */
  label: string;
  /** Leave out to disable the button (the end of the series) */
  onClick?: () => void;
  children: React.ReactNode;
}

/** A previous / next arrow of the repeat row */
function SeriesButton({ label, onClick, children }: SeriesButtonProps) {
  const button = (
    <button
      type="button"
      aria-label={label}
      disabled={!onClick}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-sm outline-none hover:bg-[#F5F5F5] hover:text-[#32302C] focus-visible:ring-1 focus-visible:ring-[#3A85D3] dark:focus-visible:ring-[#3A85D3] disabled:pointer-events-none disabled:text-[#DDDDDD] dark:hover:bg-[#242424] dark:hover:text-[#D4D4D4] dark:disabled:text-[#373737]",
        EVENT_DETAIL_SECONDARY_CLASS,
      )}
    >
      {children}
    </button>
  );
  if (!onClick) return button;
  return <HoverTooltip label={label}>{button}</HoverTooltip>;
}
