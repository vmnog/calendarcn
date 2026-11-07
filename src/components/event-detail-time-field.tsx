"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { selectInputSoon, useFieldPopover } from "@/hooks/use-field-popover";
import {
  EVENT_DETAIL_FIELD_BOX_CLASS,
  EventDetailFieldPopover,
} from "./event-detail-field-popover";
import {
  EVENT_DETAIL_GROUPED_INPUT_CLASS,
  EVENT_DETAIL_TEXT_CLASS,
} from "./event-detail-parts";
import type { EventDetailTimeFieldProps, TimeOption } from "./week-view-types";

/** The menu's options while it's closed: none are built */
const NO_OPTIONS: TimeOption[] = [];

/** Times of an all-day event: muted and inert (Notion: #B9B9B9 / #595959) */
const ALL_DAY_TIME_CLASS = "text-[#B9B9B9] dark:text-[#595959]";

/**
 * A time's text ("7:45 AM"): Notion Calendar sets a narrow no-break space
 * before AM/PM, about 1px narrower than the space our labels keep
 */
const TIME_TEXT_CLASS = "[word-spacing:-1px]";

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

/** Index of the menu row an event happened in, or null outside the rows */
function rowIndexOf(target: EventTarget | null): number | null {
  if (!(target instanceof Element)) return null;
  const row = target.closest<HTMLElement>("[data-index]");
  if (!row) return null;
  return Number(row.dataset.index);
}

/**
 * Props for TimeOptionRow
 */
interface TimeOptionRowProps {
  option: TimeOption;
  index: number;
  id: string;
  /** Under the pointer, or chosen with the keyboard */
  highlighted: boolean;
}

/** One row of the time menu: only the rows whose highlight changes render again */
const TimeOptionRow = React.memo(function TimeOptionRow({
  option,
  index,
  id,
  highlighted,
}: TimeOptionRowProps) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={highlighted}
      data-index={index}
      className={cn(
        "h-[30.5px] cursor-default truncate rounded-[6px] px-1.5 leading-[30.5px] select-none",
        highlighted && "bg-[#303030]",
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
  );
});

/**
 * A time field with Notion Calendar's floating time menu: every 15 minutes,
 * opened beside the panel with the current time in view. Typing lists the
 * times the text can mean; the arrow keys move through the options. The
 * field shows the option under the pointer or the keyboard's, but only sets
 * one on Enter, on a click, or on blur after typing or the arrow keys (the
 * field keeps focus after Enter and a click). Escape puts the time back.
 */
export function EventDetailTimeField({
  value,
  getOptions,
  getMatches,
  onCommit,
  formatValue,
  label,
  testId,
  panelRef,
  leading,
  trailing,
  disabled = false,
  readOnly = false,
  fitText = false,
  className,
}: EventDetailTimeFieldProps) {
  const listId = React.useId();
  const optionIdPrefix = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  /** Last pointer position over the menu */
  const pointerRef = React.useRef<{ x: number; y: number } | null>(null);

  const [open, setOpen] = React.useState(false);
  /** Typed text the menu lists matches for, or null for every option */
  const [query, setQuery] = React.useState<string | null>(null);
  /** The option typing or the arrow keys reached, or null for the current time's */
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  /** Whether typing or the arrow keys chose the active option, which blur then sets */
  const [chosen, setChosen] = React.useState(false);
  /** The option under the pointer, shown in the field but never set by blur */
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const [list, setList] = React.useState<HTMLDivElement | null>(null);

  const formatted = formatValue(value);
  const [text, setText] = React.useState(formatted);

  // Follow the event: a commit, a drag on the calendar, another field
  React.useEffect(() => {
    setText(formatted);
  }, [formatted]);

  const interactive = !disabled && !readOnly;
  const isOpen = open && interactive;
  // Built as the menu opens, not on every change of the event (a drag)
  const options = React.useMemo(
    () => (isOpen ? getOptions() : NO_OPTIONS),
    [isOpen, getOptions],
  );
  const shown = React.useMemo(
    () => (query === null ? options : getMatches(query)),
    [query, options, getMatches],
  );
  const active =
    activeIndex ??
    shown.findIndex((option) => option.date.getTime() === value.getTime());
  const highlighted = hoverIndex ?? active;
  const hovered = hoverIndex === null ? undefined : shown[hoverIndex];
  const fieldText = hovered ? hovered.label : text;

  // Keep the active option in view: the current time when the menu opens,
  // then wherever the arrow keys move (the pointer's is in view already)
  React.useLayoutEffect(() => {
    if (!isOpen || !list || active < 0) return;
    const row = list.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (row) scrollRowIntoList(list, row);
  }, [isOpen, list, active, shown]);

  const openMenu = () => {
    setQuery(null);
    setActiveIndex(null);
    setChosen(false);
    setHoverIndex(null);
    setOpen(true);
  };

  const closeMenu = () => {
    setOpen(false);
    setQuery(null);
    setActiveIndex(null);
    setChosen(false);
    setHoverIndex(null);
    pointerRef.current = null;
  };

  /** Sets an option, or puts the time back for none or one the event can't take */
  const setOption = (option: TimeOption | undefined) => {
    if (!option || option.date.getTime() === value.getTime()) {
      setText(formatted);
      return;
    }
    setText(onCommit(option.date) ? formatValue(option.date) : formatted);
  };

  const { inputProps, notePress, noteReturnFocus, escape } = useFieldPopover({
    inputRef,
    open: isOpen,
    onEnter: () => {
      openMenu();
      selectInputSoon(inputRef);
    },
    onCommit: () => {
      if (!chosen) {
        setText(formatted);
        return;
      }
      setOption(shown[active]);
    },
    onRestore: () => setText(formatted),
    onClose: closeMenu,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const typed = e.target.value;
    const isEmpty = typed.trim().length === 0;
    setText(typed);
    setQuery(isEmpty ? null : typed);
    setActiveIndex(isEmpty ? null : 0);
    setChosen(!isEmpty);
    setHoverIndex(null);
    setOpen(true);
  };

  /** Moves the keyboard's option from the highlighted one and shows it */
  const moveActive = (step: number) => {
    if (shown.length === 0) return;
    const from = highlighted >= 0 ? highlighted : step > 0 ? -1 : shown.length;
    const index = Math.min(Math.max(from + step, 0), shown.length - 1);
    setActiveIndex(index);
    setChosen(true);
    setHoverIndex(null);
    setText(shown[index].label);
    selectInputSoon(inputRef);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      moveActive(e.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      setOption(shown[highlighted]);
      closeMenu();
      selectInputSoon(inputRef);
      return;
    }
    if (e.key !== "Escape") return;
    // With the menu closed (after Enter); before the calendar's global
    // Escape, which would deselect the event
    e.preventDefault();
    e.stopPropagation();
    escape();
  };

  /** A press on the focused field reopens a menu Enter closed */
  const handleClick = () => {
    if (!interactive || open) return;
    openMenu();
  };

  const handleListPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    // The list scrolling under a still pointer isn't a hover
    const last = pointerRef.current;
    if (last && last.x === e.clientX && last.y === e.clientY) return;
    pointerRef.current = { x: e.clientX, y: e.clientY };
    const index = rowIndexOf(e.target);
    if (index === null || index === hoverIndex) return;
    setHoverIndex(index);
    selectInputSoon(inputRef);
  };

  const handleListPointerLeave = () => {
    pointerRef.current = null;
    if (hoverIndex === null) return;
    setHoverIndex(null);
    selectInputSoon(inputRef);
  };

  const handleListClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const index = rowIndexOf(e.target);
    if (index === null) return;
    setOption(shown[index]);
    closeMenu();
    selectInputSoon(inputRef);
  };

  const highlightedId =
    isOpen && shown[highlighted]
      ? `${optionIdPrefix}-${highlighted}`
      : undefined;

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
      aria-activedescendant={highlightedId}
      autoComplete="off"
      spellCheck={false}
      value={fieldText}
      readOnly={!interactive}
      tabIndex={disabled ? -1 : undefined}
      onFocus={interactive ? inputProps.onFocus : undefined}
      onBlur={interactive ? inputProps.onBlur : undefined}
      onChange={handleChange}
      onKeyDown={interactive ? handleKeyDown : undefined}
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
        readOnly && "cursor-default",
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
              {fieldText || " "}
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
    <EventDetailFieldPopover
      open={isOpen}
      panelRef={panelRef}
      boxClassName={cn(
        EVENT_DETAIL_FIELD_BOX_CLASS,
        disabled && "pointer-events-none hover:border-transparent",
        readOnly && "cursor-default hover:border-transparent",
        className,
      )}
      onBoxClick={interactive ? () => inputRef.current?.focus() : undefined}
      onBoxPointerDown={notePress}
      field={field}
      inputRef={inputRef}
      onReturnFocus={noteReturnFocus}
      className="w-[219px]"
    >
      <div
        ref={setList}
        id={listId}
        role="listbox"
        aria-label={label}
        onPointerMove={handleListPointerMove}
        onPointerLeave={handleListPointerLeave}
        onClick={handleListClick}
        className="relative max-h-[236px] overflow-y-auto overscroll-contain p-1"
      >
        {shown.map((option, index) => (
          <TimeOptionRow
            key={option.date.getTime()}
            option={option}
            index={index}
            id={`${optionIdPrefix}-${index}`}
            highlighted={index === highlighted}
          />
        ))}
      </div>
    </EventDetailFieldPopover>
  );
}
