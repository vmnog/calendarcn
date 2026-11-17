"use client";

import * as React from "react";

import { useControllableState } from "@/hooks/use-controllable-state";
import { DEFAULT_WORKING_HOURS } from "@/lib/free-busy";
import {
  addEmail,
  getCalendarPerson,
  isSameEmail,
  removeEmail,
} from "@/lib/people";
import type {
  CalendarPeopleValue,
  DetailedCalendarEvent,
  EventContact,
  WorkingHours,
} from "@/components/calendar-types";

/** Nobody met with or shown when no list is given (stable identity) */
const NO_EMAILS: string[] = [];

/** No events for anyone when `contactEvents` is not set (stable identity) */
const NO_CONTACT_EVENTS: Record<string, DetailedCalendarEvent[]> = {};

/** A person without events in `contactEvents` (stable identity) */
const NO_PERSON_EVENTS: DetailedCalendarEvent[] = [];

/** Outside a provider: nobody shows, and nobody can be added */
const NO_PEOPLE: CalendarPeopleValue = {
  contacts: [],
  meetWith: NO_EMAILS,
  teammates: NO_EMAILS,
  shownPeople: [],
  addMeetWith: () => {},
  removeMeetWith: () => {},
  clearMeetWith: () => {},
  addTeammate: () => {},
  removeTeammate: () => {},
  getPersonEvents: () => NO_PERSON_EVENTS,
  workingHours: DEFAULT_WORKING_HOURS,
};

const CalendarPeopleContext =
  React.createContext<CalendarPeopleValue>(NO_PEOPLE);

/** What `useCalendarPeopleState` reads: the provider's people props */
interface CalendarPeopleStateOptions {
  contacts: EventContact[];
  meetWith?: string[];
  defaultMeetWith?: string[];
  onMeetWithChange?: (meetWith: string[]) => void;
  teammates?: string[];
  defaultTeammates?: string[];
  onTeammatesChange?: (teammates: string[]) => void;
  contactEvents?: Record<string, DetailedCalendarEvent[]>;
  workingHours?: WorkingHours;
}

/**
 * The people state behind `useCalendarPeople()`, owned by
 * `CalendarProvider`: who you meet with and which teammates show, each list
 * controlled or not, and their events from `contactEvents`.
 */
export function useCalendarPeopleState({
  contacts,
  meetWith: meetWithProp,
  defaultMeetWith = NO_EMAILS,
  onMeetWithChange,
  teammates: teammatesProp,
  defaultTeammates = NO_EMAILS,
  onTeammatesChange,
  contactEvents = NO_CONTACT_EVENTS,
  workingHours = DEFAULT_WORKING_HOURS,
}: CalendarPeopleStateOptions): CalendarPeopleValue {
  const [meetWith, setMeetWith] = useControllableState({
    prop: meetWithProp,
    defaultProp: defaultMeetWith,
    onChange: onMeetWithChange,
  });
  const [teammates, setTeammates] = useControllableState({
    prop: teammatesProp,
    defaultProp: defaultTeammates,
    onChange: onTeammatesChange,
  });

  const addMeetWith = React.useCallback(
    (email: string) =>
      setMeetWith((prev) =>
        prev.some((e) => isSameEmail(e, email)) ? prev : addEmail(prev, email),
      ),
    [setMeetWith],
  );

  const removeMeetWith = React.useCallback(
    (email: string) =>
      setMeetWith((prev) =>
        prev.some((e) => isSameEmail(e, email))
          ? removeEmail(prev, email)
          : prev,
      ),
    [setMeetWith],
  );

  const clearMeetWith = React.useCallback(
    () => setMeetWith((prev) => (prev.length === 0 ? prev : NO_EMAILS)),
    [setMeetWith],
  );

  const addTeammate = React.useCallback(
    (email: string) =>
      setTeammates((prev) =>
        prev.some((e) => isSameEmail(e, email)) ? prev : addEmail(prev, email),
      ),
    [setTeammates],
  );

  const removeTeammate = React.useCallback(
    (email: string) =>
      setTeammates((prev) =>
        prev.some((e) => isSameEmail(e, email))
          ? removeEmail(prev, email)
          : prev,
      ),
    [setTeammates],
  );

  // Looked up without case: apps key `contactEvents` as their API spells
  // the address
  const eventsByEmail = React.useMemo(() => {
    const map = new Map<string, DetailedCalendarEvent[]>();
    for (const [email, events] of Object.entries(contactEvents)) {
      map.set(email.trim().toLowerCase(), events);
    }
    return map;
  }, [contactEvents]);

  const getPersonEvents = React.useCallback(
    (email: string) =>
      eventsByEmail.get(email.trim().toLowerCase()) ?? NO_PERSON_EVENTS,
    [eventsByEmail],
  );

  const shownPeople = React.useMemo(
    () =>
      [
        ...meetWith,
        ...teammates.filter((t) => !meetWith.some((m) => isSameEmail(m, t))),
      ].map((email) => getCalendarPerson(contacts, email)),
    [contacts, meetWith, teammates],
  );

  return React.useMemo(
    () => ({
      contacts,
      meetWith,
      teammates,
      shownPeople,
      addMeetWith,
      removeMeetWith,
      clearMeetWith,
      addTeammate,
      removeTeammate,
      getPersonEvents,
      workingHours,
    }),
    [
      contacts,
      meetWith,
      teammates,
      shownPeople,
      addMeetWith,
      removeMeetWith,
      clearMeetWith,
      addTeammate,
      removeTeammate,
      getPersonEvents,
      workingHours,
    ],
  );
}

/** Props of `CalendarPeopleProvider` */
interface CalendarPeopleProviderProps {
  /** The state from `useCalendarPeopleState` */
  value: CalendarPeopleValue;
  children?: React.ReactNode;
}

/** Hands the provider's people state to `useCalendarPeople()` */
export function CalendarPeopleProvider({
  value,
  children,
}: CalendarPeopleProviderProps) {
  return (
    <CalendarPeopleContext.Provider value={value}>
      {children}
    </CalendarPeopleContext.Provider>
  );
}

/**
 * The people whose calendars show beside yours, from the nearest
 * `CalendarProvider`: who you meet with ("Meet with..."), the teammates
 * shown ("Show teammate calendar..."), their events and the actions that
 * add and remove them. Outside a provider, nobody shows.
 */
export function useCalendarPeople(): CalendarPeopleValue {
  return React.useContext(CalendarPeopleContext);
}
