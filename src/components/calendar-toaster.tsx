"use client";

import * as React from "react";
import { Info, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCalendarNotice } from "@/components/calendar-provider";
import type { CalendarNotice } from "@/components/calendar-types";
import type { CalendarToasterProps } from "@/components/week-view-types";

/**
 * How long a toast stays when `duration` is not set, in milliseconds.
 * Notion Calendar's are gone 5 to 6 seconds after the action
 */
const DEFAULT_TOAST_DURATION_MS = 5000;

/** How long a toast fades out at the end of its time, in milliseconds */
const TOAST_FADE_MS = 150;

/** Accessible name of the toaster, a region screen readers can jump to */
const TOASTER_LABEL = "Notifications";

/**
 * A toast's look: dark in both themes, like the event menus and the
 * details' tooltip. The border shows in dark mode only, where #252525 sits
 * close to the #191919 page
 */
const TOAST_CLASS =
  "pointer-events-auto relative flex w-[220px] max-w-full gap-2 rounded-md border border-transparent bg-[#252525] py-2.5 pr-8 pl-3 text-xs leading-[18px] text-[#F0F0F0] shadow-lg dark:border-[#303030] dark:shadow-black/40";

/** Slides in, and fades over its last `TOAST_FADE_MS`; neither with reduced motion */
const TOAST_MOTION_CLASS =
  "animate-in fade-in-0 slide-in-from-bottom-2 transition-opacity duration-150 motion-reduce:animate-none motion-reduce:transition-none";

/** The toast's Undo and Close: a faint fill on hover, a ring on keyboard focus */
const TOAST_BUTTON_CLASS =
  "rounded-sm outline-none hover:bg-white/10 focus-visible:ring-1 focus-visible:ring-white/50";

/** Props of one toast (only used in this file) */
interface CalendarToastProps {
  notice: CalendarNotice;
  /** Milliseconds before it closes by itself */
  duration: number;
  /** Closes the notice with this id */
  onDismiss: (id: number) => void;
}

/**
 * Notion Calendar's toasts: "Event deleted" and "Event cut" with an Undo
 * button, "Event copied to clipboard", and any notice your app shows with
 * `useCalendarNotice()`, one at a time. Render it inside the provider, in a
 * positioned element around the view (`relative`): it sits at that
 * element's bottom right. A toast closes after `duration`, held while the
 * pointer or focus is on it, or with its close button. Screen readers hear
 * the provider's live region instead, so the toast isn't announced.
 */
export function CalendarToaster({
  duration = DEFAULT_TOAST_DURATION_MS,
  className,
}: CalendarToasterProps) {
  const { notice, dismissNotice } = useCalendarNotice();
  if (!notice) return null;

  return (
    <section
      aria-label={TOASTER_LABEL}
      className={cn(
        "pointer-events-none absolute right-4 bottom-4 z-40 flex max-w-[calc(100%-2rem)] justify-end",
        className,
      )}
    >
      {/* A new notice is a new toast, so its time starts over */}
      <CalendarToast
        key={notice.id}
        notice={notice}
        duration={duration}
        onDismiss={dismissNotice}
      />
    </section>
  );
}

/** One toast, with its own timer */
function CalendarToast({ notice, duration, onDismiss }: CalendarToastProps) {
  const { id, message, title, onUndo } = notice;
  /** The pending fade or close */
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Whether the pointer is on the toast, which holds it */
  const isHoveredRef = React.useRef(false);
  /** Whether focus is inside the toast, which holds it */
  const hasFocusRef = React.useRef(false);
  /** Whether it is fading out at the end of its time */
  const [isLeaving, setIsLeaving] = React.useState(false);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  /** Starts its time over: it fades, then closes, `duration` from now */
  const startTimer = React.useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(
      () => {
        setIsLeaving(true);
        timerRef.current = setTimeout(() => onDismiss(id), TOAST_FADE_MS);
      },
      Math.max(0, duration - TOAST_FADE_MS),
    );
  }, [clearTimer, duration, id, onDismiss]);

  // Its time runs from the moment it shows, unless something holds it
  React.useEffect(() => {
    if (!isHoveredRef.current && !hasFocusRef.current) startTimer();
    return clearTimer;
  }, [startTimer, clearTimer]);

  /**
   * The pointer or focus came onto it: stop its time and undo a fade. The
   * handlers start and stop the timer themselves, not an effect, so the
   * hold applies before the event returns
   */
  const hold = () => {
    clearTimer();
    setIsLeaving(false);
  };

  /** Once neither the pointer nor focus is on it, its full time starts over */
  const releaseIfFree = () => {
    if (isHoveredRef.current || hasFocusRef.current) return;
    startTimer();
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    // Focus moving between its own buttons keeps it held
    if (
      e.relatedTarget instanceof Node &&
      e.currentTarget.contains(e.relatedTarget)
    ) {
      return;
    }
    hasFocusRef.current = false;
    releaseIfFree();
  };

  const handleUndo = () => {
    onUndo?.();
    onDismiss(id);
  };

  return (
    <div
      data-slot="calendar-toast"
      className={cn(TOAST_CLASS, TOAST_MOTION_CLASS, isLeaving && "opacity-0")}
      onPointerEnter={() => {
        isHoveredRef.current = true;
        hold();
      }}
      onPointerLeave={() => {
        isHoveredRef.current = false;
        releaseIfFree();
      }}
      onFocus={() => {
        hasFocusRef.current = true;
        hold();
      }}
      onBlur={handleBlur}
    >
      <Info aria-hidden className="mt-0.5 size-3.5 shrink-0 text-white/60" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{message}</p>
        {title ? (
          <p className="truncate text-white/60">{`“${title}”`}</p>
        ) : null}
        {onUndo ? (
          <div className="mt-1.5 flex justify-end">
            <button
              type="button"
              className={cn(
                TOAST_BUTTON_CLASS,
                "bg-white/10 px-2 py-0.5 font-medium text-white hover:bg-white/15",
              )}
              onClick={handleUndo}
            >
              Undo
            </button>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Close"
        className={cn(
          TOAST_BUTTON_CLASS,
          "absolute top-2 right-2 p-0.5 text-white/40 hover:text-white",
        )}
        onClick={() => onDismiss(id)}
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </div>
  );
}
