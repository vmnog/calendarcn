"use client";

import * as React from "react";

/**
 * How far outside the screen a frame starts mounting its example, above and
 * below, so the example is there before it scrolls into view
 */
const MOUNT_MARGIN = "800px 0px";

interface PreviewFrameProps extends React.ComponentProps<"div"> {
  /**
   * Mounts the example at once, and renders it on the server: for the
   * example at the top of a page, which is on screen when the page loads.
   */
  eager?: boolean;
}

/**
 * The frame a docs example renders in. A component page holds several live
 * calendars, and mounting them all when the page loads keeps it busy for
 * about twice as long on a slow phone. So a frame mounts its example once it
 * comes within `MOUNT_MARGIN` of the screen, and keeps it from then on. The
 * frame has its height either way, so nothing below it moves.
 */
export function PreviewFrame({
  eager = false,
  children,
  ...props
}: PreviewFrameProps) {
  const frameRef = React.useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = React.useState(eager);

  React.useEffect(() => {
    const frame = frameRef.current;
    if (isMounted || !frame) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setIsMounted(true);
      },
      { rootMargin: MOUNT_MARGIN },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, [isMounted]);

  return (
    <div ref={frameRef} {...props}>
      {isMounted ? children : null}
    </div>
  );
}
