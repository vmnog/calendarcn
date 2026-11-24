"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Copy,
  Monitor,
  SquareDashed,
  TabletSmartphone,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  getEventColorStyle,
  groupCalendarsByEmail,
  moveEventToCalendar,
  resolveEventColor,
} from "@/lib/event-utils";
import {
  useCalendarConfig,
  useCalendarEventActions,
} from "./calendar-provider";
import {
  EVENT_ACTION_KEYS,
  EVENT_DETAIL_MENU_SHORTCUT_CLASS,
} from "./event-detail-parts";
import type {
  CalendarInfo,
  DetailedCalendarEvent,
  EventColor,
} from "./week-view-types";

/**
 * Swatch of an event or calendar color in a picker (this menu, the details
 * panel's calendar picker): the color events are drawn with, set on the
 * swatch with `getEventColorStyle()`
 */
export const EVENT_COLOR_SWATCH_CLASS = "bg-event-border";

/** A row of the menu: the menu's text, highlighted on hover and focus */
const MENU_ROW_CLASS =
  "relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-none select-none text-calendar-menu-foreground hover:bg-calendar-menu-accent hover:text-calendar-menu-accent-foreground focus:bg-calendar-menu-accent focus:text-calendar-menu-accent-foreground";

interface EventContextMenuProps {
  /** The right-clicked event; "Block on calendar" moves it to that calendar */
  event: DetailedCalendarEvent;
  position: { x: number; y: number };
  onClose: () => void;
  onEventChange?: (event: DetailedCalendarEvent) => void;
}

function MenuItem({
  className,
  children,
  onSelect,
  disabled,
  keyShortcuts,
}: {
  className?: string;
  children: React.ReactNode;
  onSelect?: () => void;
  /** Its action isn't available (outside a calendar provider) */
  disabled?: boolean;
  /** The keys that run it, for assistive tech (`aria-keyshortcuts`) */
  keyShortcuts?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-keyshortcuts={keyShortcuts}
      className={cn(
        MENU_ROW_CLASS,
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}

/** An action's keys at the end of its row. Screen readers get `aria-keyshortcuts` instead */
function Shortcut({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className={cn("ml-auto text-xs", EVENT_DETAIL_MENU_SHORTCUT_CLASS)}
    >
      {children}
    </span>
  );
}

function Separator() {
  return <div className="-mx-1 my-1 h-px bg-calendar-menu-border" />;
}

function SubMenu({
  trigger,
  children,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout>>(null);

  function handleMouseEnter() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  }

  function handleMouseLeave() {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  }

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        className={cn(
          MENU_ROW_CLASS,
          open &&
            "bg-calendar-menu-accent text-calendar-menu-accent-foreground",
        )}
      >
        {trigger}
        <svg
          className="ml-auto size-4 text-calendar-menu-foreground/60"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-full top-0 ml-1 min-w-[180px] rounded-sm border border-calendar-menu-border bg-calendar-menu p-1 shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
}

export function EventContextMenu({
  event,
  position,
  onClose,
  onEventChange,
}: EventContextMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = React.useState(position);
  const [ready, setReady] = React.useState(false);
  const { calendars, eventColors } = useCalendarConfig();
  const eventActions = useCalendarEventActions();
  const currentColor = resolveEventColor(event, calendars);
  const calendarGroups = React.useMemo(
    () => groupCalendarsByEmail(calendars),
    [calendars],
  );

  React.useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const menuHeight = menu.offsetHeight;
    const menuWidth = menu.offsetWidth;
    let y = position.y;
    let x = position.x;

    if (position.y + menuHeight > window.innerHeight) {
      y = position.y - menuHeight;
    }
    if (position.x + menuWidth > window.innerWidth) {
      x = position.x - menuWidth;
    }

    setAdjustedPos({ x, y });
    setReady(true);
  }, [position]);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!menuRef.current) return;
      if (menuRef.current.contains(e.target as Node)) return;
      onClose();
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      onClose();
    }

    // Use capture to close before other handlers fire
    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  function handleColorSelect(color: EventColor) {
    onEventChange?.({ ...event, color });
    onClose();
  }

  function handleCalendarSelect(calendar: CalendarInfo) {
    if (calendar.id !== event.calendarId) {
      onEventChange?.(moveEventToCalendar(event, calendar, calendars));
    }
    onClose();
  }

  /** Closes the menu, then runs an event action on the right-clicked event */
  function runAction(action: (eventId: string) => void) {
    onClose();
    action(event.id);
  }

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[200px] rounded-sm border border-calendar-menu-border bg-calendar-menu p-1 shadow-md animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none"
      style={{
        top: adjustedPos.y,
        left: adjustedPos.x,
        opacity: ready ? 1 : 0,
      }}
    >
      {/* Color selector row */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        {eventColors.map((color) => (
          <button
            key={color}
            type="button"
            className={cn(
              "relative flex size-3 items-center justify-center rounded-xs",
              EVENT_COLOR_SWATCH_CLASS,
            )}
            style={getEventColorStyle(color)}
            onClick={() => handleColorSelect(color)}
          >
            {color === currentColor && (
              <Check className="size-2 text-event-foreground" />
            )}
          </button>
        ))}
      </div>

      {/* Block on calendar (only when the provider lists calendars) */}
      {calendarGroups.length > 0 && (
        <>
          <Separator />
          <SubMenu
            trigger={
              <>
                <Monitor className="size-3.5" />
                Block on calendar
              </>
            }
          >
            {calendarGroups.map((group) => (
              <React.Fragment key={group.email ?? ""}>
                {group.email && (
                  <div
                    className={cn(
                      "px-2 py-1 text-[10px]",
                      EVENT_DETAIL_MENU_SHORTCUT_CLASS,
                    )}
                  >
                    {group.email}
                  </div>
                )}
                {group.calendars.map((cal) => (
                  <MenuItem
                    key={cal.id}
                    onSelect={() => handleCalendarSelect(cal)}
                  >
                    <div
                      className={cn(
                        "size-3 rounded-xs shrink-0",
                        EVENT_COLOR_SWATCH_CLASS,
                      )}
                      style={getEventColorStyle(cal.color)}
                    />
                    {cal.name}
                  </MenuItem>
                ))}
              </React.Fragment>
            ))}
          </SubMenu>
        </>
      )}

      <Separator />

      <MenuItem
        disabled={!eventActions}
        keyShortcuts={EVENT_ACTION_KEYS.cut.aria}
        onSelect={
          eventActions ? () => runAction(eventActions.cutEvent) : undefined
        }
      >
        <SquareDashed className="size-3.5" />
        Cut
        <Shortcut>{EVENT_ACTION_KEYS.cut.label}</Shortcut>
      </MenuItem>
      <MenuItem
        disabled={!eventActions}
        keyShortcuts={EVENT_ACTION_KEYS.copy.aria}
        onSelect={
          eventActions ? () => runAction(eventActions.copyEvent) : undefined
        }
      >
        <TabletSmartphone className="size-3.5" />
        Copy
        <Shortcut>{EVENT_ACTION_KEYS.copy.label}</Shortcut>
      </MenuItem>
      <MenuItem
        disabled={!eventActions}
        keyShortcuts={EVENT_ACTION_KEYS.duplicate.aria}
        onSelect={
          eventActions
            ? () => runAction(eventActions.duplicateEvent)
            : undefined
        }
      >
        <Copy className="size-3.5" />
        Duplicate
        <Shortcut>{EVENT_ACTION_KEYS.duplicate.label}</Shortcut>
      </MenuItem>

      <Separator />

      <MenuItem
        disabled={!eventActions}
        keyShortcuts={EVENT_ACTION_KEYS.delete.aria}
        onSelect={
          eventActions ? () => runAction(eventActions.deleteEvent) : undefined
        }
        className="text-calendar-danger hover:!bg-calendar-danger hover:!text-calendar-danger-foreground focus:!bg-calendar-danger focus:!text-calendar-danger-foreground [&:hover>svg]:!text-calendar-danger-foreground [&:focus>svg]:!text-calendar-danger-foreground [&:hover>.ml-auto]:!text-calendar-danger-foreground [&:focus>.ml-auto]:!text-calendar-danger-foreground"
      >
        <Trash2 className="size-3.5 text-calendar-danger" />
        Delete
        <Shortcut>{EVENT_ACTION_KEYS.delete.label}</Shortcut>
      </MenuItem>
    </div>,
    document.body,
  );
}
