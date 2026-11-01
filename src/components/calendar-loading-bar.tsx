import { cn } from "@/lib/utils";

/** Props for CalendarLoadingBar */
interface CalendarLoadingBarProps {
  /** Classes for the bar's track, e.g. to inset it past the time axis */
  className?: string;
}

/**
 * Thin indeterminate progress bar along the bottom edge of a view's header,
 * drawn while the provider's `loading` prop is set. Place it inside a
 * `relative` header. It takes no pointer events, so everything under it
 * stays usable.
 */
export function CalendarLoadingBar({ className }: CalendarLoadingBarProps) {
  return (
    <div
      role="progressbar"
      aria-label="Loading events"
      data-slot="calendar-loading-bar"
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden",
        className,
      )}
    >
      <div className="calendar-loading-bar h-full rounded-full bg-muted-foreground/70" />
    </div>
  );
}
