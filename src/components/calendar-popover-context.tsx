"use client";

import * as React from "react";

/**
 * Context to provide the collision boundary element and header inset
 * for event detail popovers.
 * - boundary: the outer calendar container (so popovers can position freely)
 * - headerHeight: the height of the weekday header + all-day row,
 *   used as top collision padding so popovers never overlap the header.
 */

interface CalendarPopoverBoundaryValue {
  boundary: HTMLElement | null;
  headerHeight: number;
}

const CalendarPopoverBoundaryContext =
  React.createContext<CalendarPopoverBoundaryValue>({ boundary: null, headerHeight: 0 });

export function CalendarPopoverBoundaryProvider({
  boundaryRef,
  headerRef,
  children,
}: {
  boundaryRef: React.RefObject<HTMLElement | null>;
  headerRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}) {
  const [boundary, setBoundary] = React.useState<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = React.useState(0);

  React.useEffect(() => {
    setBoundary(boundaryRef.current);
  }, [boundaryRef]);

  // Observe header height changes (all-day row can expand/collapse)
  React.useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const update = () => setHeaderHeight(el.offsetHeight);
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [headerRef]);

  const value = React.useMemo(
    () => ({ boundary, headerHeight }),
    [boundary, headerHeight],
  );

  return (
    <CalendarPopoverBoundaryContext.Provider value={value}>
      {children}
    </CalendarPopoverBoundaryContext.Provider>
  );
}

export function useCalendarPopoverBoundary() {
  return React.useContext(CalendarPopoverBoundaryContext);
}
