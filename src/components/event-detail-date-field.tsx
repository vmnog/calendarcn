"use client";

import * as React from "react";
import {
  addDays,
  addMonths,
  format,
  isBefore,
  isSameDay,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDayPicker } from "react-day-picker";
import type { DayButtonProps, MonthCaptionProps } from "react-day-picker";

import { cn } from "@/lib/utils";
import { selectInputSoon, useFieldPopover } from "@/hooks/use-field-popover";
import { Calendar } from "@/components/ui/calendar";
import { useCalendarConfig } from "./calendar-provider";
import {
  EVENT_DETAIL_FIELD_BOX_CLASS,
  EventDetailFieldPopover,
} from "./event-detail-field-popover";
import {
  EVENT_DETAIL_GROUPED_INPUT_CLASS,
  EVENT_DETAIL_TEXT_CLASS,
} from "./event-detail-parts";
import { formatDateDisplay, parseDateInput } from "@/lib/time-input";
import type { EventDetailDateFieldProps } from "./week-view-types";

/** A day of the date picker: today, the event's day and hover fill a box */
const PICKER_DAY_CLASS =
  "relative isolate flex h-[30.5px] w-full items-center justify-center text-[13px] text-[#D4D4D4] outline-none before:absolute before:top-1/2 before:left-1/2 before:-z-10 before:h-[25px] before:w-[30px] before:-translate-1/2 before:rounded-[6px] hover:before:bg-[#303030]";

/** The date picker's previous and next month buttons */
const PICKER_CHEVRON_CLASS =
  "flex size-[24px] items-center justify-center justify-self-center rounded-[6px] text-[#848484] outline-none hover:bg-[#303030] disabled:opacity-40";

/**
 * Keys that move the marked day from the date field, the picker staying in
 * the field's hands: the arrows a day, Page Up and Page Down a month
 */
const DAY_STEPS: Partial<Record<string, (day: Date) => Date>> = {
  ArrowUp: (day) => addDays(day, -1),
  ArrowDown: (day) => addDays(day, 1),
  PageUp: (day) => addMonths(day, -1),
  PageDown: (day) => addMonths(day, 1),
};

/**
 * The date picker's header: "November 2026" with the previous and next
 * month chevrons over the last two columns
 */
function DatePickerCaption({ calendarMonth }: MonthCaptionProps) {
  const { locale } = useCalendarConfig();
  const { goToMonth, previousMonth, nextMonth } = useDayPicker();

  return (
    <div className="grid h-[33px] grid-cols-7 items-center">
      <span className="col-span-5 pl-[11px] text-[#D4D4D4]">
        {format(calendarMonth.date, "LLLL yyyy", { locale })}
      </span>
      <button
        type="button"
        aria-label="Previous month"
        disabled={!previousMonth}
        onClick={() => previousMonth && goToMonth(previousMonth)}
        className={PICKER_CHEVRON_CLASS}
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Next month"
        disabled={!nextMonth}
        onClick={() => nextMonth && goToMonth(nextMonth)}
        className={PICKER_CHEVRON_CLASS}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

/**
 * A day of the date picker: today red, the event's day filled, days the
 * event can't take dimmed. Focus stays in the field, whose arrow keys move
 * the marked day.
 */
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
        (modifiers.outside || modifiers.disabled) && "text-[#5F5F5F]",
        modifiers.disabled && "hover:before:bg-transparent",
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
  disabled: "",
  hidden: "invisible",
};

/**
 * A date field with Notion Calendar's date picker beside the panel. Typing
 * a date ("Nov 12") or the arrow keys mark a day in the picker; Enter or
 * blur sets it, as does a click on a day (which closes the picker and leaves
 * the field). Escape puts the date back. A day the event can't take (an end
 * before the start) puts the date back too.
 */
export function EventDetailDateField({
  value,
  onCommit,
  minDate,
  label,
  testId,
  panelRef,
  readOnly = false,
  className,
}: EventDetailDateFieldProps) {
  const { locale, weekStartsOn } = useCalendarConfig();
  const pickerId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const formatted = formatDateDisplay(value, locale);
  const [text, setText] = React.useState(formatted);
  const [open, setOpen] = React.useState(false);
  /** The day typing or the arrow keys marked in the picker, before it's set */
  const [markedDay, setMarkedDay] = React.useState<Date | null>(null);
  const [month, setMonth] = React.useState(() => startOfMonth(value));

  React.useEffect(() => {
    setText(formatted);
  }, [formatted]);

  const isOpen = open && !readOnly;

  /** Sets a day, or puts the date back when it's the same or the event can't take it */
  const setDay = (day: Date) => {
    if (isSameDay(day, value) || !onCommit(day)) {
      setText(formatted);
      return;
    }
    setText(formatDateDisplay(day, locale));
  };

  /** Sets the marked or typed day, or puts the date back when the text isn't one */
  const commitMarked = () => {
    const day = markedDay ?? parseDateInput(text, value, locale);
    if (!day) {
      setText(formatted);
      return;
    }
    setDay(day);
  };

  const close = () => {
    setOpen(false);
    setMarkedDay(null);
  };

  const openPicker = () => {
    setMarkedDay(null);
    setMonth(startOfMonth(value));
    setOpen(true);
    selectInputSoon(inputRef);
  };

  const { inputProps, notePress, noteReturnFocus, escape, leave } =
    useFieldPopover({
      inputRef,
      open: isOpen,
      onEnter: openPicker,
      onCommit: commitMarked,
      onRestore: () => setText(formatted),
      onClose: close,
    });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    const day = parseDateInput(e.target.value, value, locale);
    setMarkedDay(day);
    if (day) setMonth(startOfMonth(day));
    setOpen(true);
  };

  /** Marks a day and shows it, unless it's before `minDate` */
  const markDay = (day: Date) => {
    if (minDate && isBefore(day, startOfDay(minDate))) return;
    setMarkedDay(day);
    setText(formatDateDisplay(day, locale));
    setMonth(startOfMonth(day));
    setOpen(true);
    selectInputSoon(inputRef);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const step = DAY_STEPS[e.key];
    if (step) {
      e.preventDefault();
      markDay(step(markedDay ?? value));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      commitMarked();
      close();
      selectInputSoon(inputRef);
      return;
    }
    if (e.key !== "Escape") return;
    // With the picker closed (after Enter); before the calendar's global
    // Escape, which would deselect the event
    e.preventDefault();
    e.stopPropagation();
    escape();
  };

  const handleDayClick = (day: Date) => {
    setDay(day);
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
      aria-expanded={isOpen}
      aria-controls={isOpen ? pickerId : undefined}
      autoComplete="off"
      spellCheck={false}
      value={text}
      readOnly={readOnly}
      onFocus={readOnly ? undefined : inputProps.onFocus}
      onBlur={readOnly ? undefined : inputProps.onBlur}
      onChange={handleChange}
      onKeyDown={readOnly ? undefined : handleKeyDown}
      onClick={() => !readOnly && !open && openPicker()}
      className={cn(
        "w-full min-w-0",
        EVENT_DETAIL_GROUPED_INPUT_CLASS,
        EVENT_DETAIL_TEXT_CLASS,
        readOnly && "cursor-default",
      )}
    />
  );

  return (
    <EventDetailFieldPopover
      open={isOpen}
      panelRef={panelRef}
      boxClassName={cn(
        EVENT_DETAIL_FIELD_BOX_CLASS,
        "pl-[8px]",
        readOnly && "cursor-default hover:border-transparent",
        className,
      )}
      onBoxClick={readOnly ? undefined : () => inputRef.current?.focus()}
      onBoxPointerDown={notePress}
      field={field}
      inputRef={inputRef}
      onReturnFocus={noteReturnFocus}
      className="w-[272px] p-2"
    >
      <Calendar
        id={pickerId}
        // With onSelect, DayPicker follows `selected` (the marked day) as it changes
        mode="single"
        required
        selected={markedDay ?? value}
        onSelect={handleDayClick}
        disabled={minDate ? { before: minDate } : undefined}
        month={month}
        onMonthChange={setMonth}
        showOutsideDays
        fixedWeeks
        hideNavigation
        locale={locale}
        // The calendar's first day; the locale's outside a provider
        weekStartsOn={weekStartsOn ?? locale.options?.weekStartsOn ?? 0}
        formatters={{
          formatWeekdayName: (date) => format(date, "EEEEEE", { locale }),
        }}
        components={DATE_PICKER_COMPONENTS}
        classNames={DATE_PICKER_CLASS_NAMES}
        className="bg-transparent p-0"
      />
    </EventDetailFieldPopover>
  );
}
