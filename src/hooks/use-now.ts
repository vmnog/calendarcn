import * as React from "react";
import { startOfDay } from "date-fns";

/**
 * Milliseconds between clock ticks. Ticks land on multiples of this value
 * (minute boundaries), so the current-time line moves when the minute does.
 */
const NOW_TICK_INTERVAL_MS = 60_000;

/** Components subscribed to the shared clock. */
const listeners = new Set<() => void>();

/** Timestamp handed to subscribers. Refreshed on every tick. */
let nowSnapshot: number | null = null;

/** Pending tick, or `null` while nothing is subscribed. */
let tickTimeout: ReturnType<typeof setTimeout> | null = null;

/** Returns the index of the tick interval a timestamp falls in. */
function getTickIndex(timestamp: number): number {
  return Math.floor(timestamp / NOW_TICK_INTERVAL_MS);
}

/**
 * Returns the shared "now" timestamp.
 *
 * The value stays the same within one tick interval, so repeated reads during
 * a render agree with each other. It is refreshed lazily when a read lands in
 * a later interval, which covers renders that happen while nothing is
 * subscribed (and so no timer is running).
 */
function readNow(): number {
  const current = Date.now();
  if (
    nowSnapshot === null ||
    getTickIndex(current) !== getTickIndex(nowSnapshot)
  ) {
    nowSnapshot = current;
  }
  return nowSnapshot;
}

/** Schedules the next tick on the next interval boundary. */
function scheduleTick(): void {
  const delay = NOW_TICK_INTERVAL_MS - (Date.now() % NOW_TICK_INTERVAL_MS);
  tickTimeout = setTimeout(() => {
    nowSnapshot = Date.now();
    listeners.forEach((listener) => listener());
    scheduleTick();
  }, delay);
}

/** Subscribes to the shared clock. One timer serves every subscriber. */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (tickTimeout === null) {
    scheduleTick();
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size > 0 || tickTimeout === null) return;
    clearTimeout(tickTimeout);
    tickTimeout = null;
  };
}

function getNowSnapshot(): number {
  return readNow();
}

function getTodaySnapshot(): number {
  return startOfDay(readNow()).getTime();
}

/**
 * Server and hydration snapshot. `null` means "the time is not known yet",
 * so nothing that depends on the clock or the viewer's timezone is rendered
 * and server and client markup match (React error #418).
 */
function getServerSnapshot(): null {
  return null;
}

/** Server and hydration snapshot for `useIsPast`: nothing is past yet. */
function getServerIsPastSnapshot(): boolean {
  return false;
}

/**
 * Returns the current time, updated on every minute boundary.
 *
 * Returns `null` during server rendering and hydration, and the real time
 * right after hydration. Client-only renders get the real time on the first
 * render. Components must render their time-dependent parts only when the
 * value is not `null`.
 */
export function useNow(): Date | null {
  const timestamp = React.useSyncExternalStore<number | null>(
    subscribe,
    getNowSnapshot,
    getServerSnapshot,
  );

  return React.useMemo(
    () => (timestamp === null ? null : new Date(timestamp)),
    [timestamp],
  );
}

/**
 * Returns the start of the viewer's current day, or `null` during server
 * rendering and hydration.
 *
 * Shares the clock with `useNow`, but the component re-renders only when the
 * day changes, not on every tick.
 */
export function useToday(): Date | null {
  const timestamp = React.useSyncExternalStore<number | null>(
    subscribe,
    getTodaySnapshot,
    getServerSnapshot,
  );

  return React.useMemo(
    () => (timestamp === null ? null : new Date(timestamp)),
    [timestamp],
  );
}

/**
 * Returns whether `date` is in the past.
 *
 * Returns `false` during server rendering and hydration. Shares the clock
 * with `useNow`, but the component re-renders only when the answer changes,
 * not on every tick.
 */
export function useIsPast(date: Date): boolean {
  const timestamp = date.getTime();
  const getSnapshot = React.useCallback(
    () => timestamp < readNow(),
    [timestamp],
  );

  return React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerIsPastSnapshot,
  );
}
