"use client";

import { Bell } from "lucide-react";

import {
  EventDetailPlaceholderRow,
  EventDetailRow,
  EventDetailSection,
} from "./event-detail-parts";
import type {
  DetailedCalendarEvent,
  EventDetailSectionProps,
  EventReminder,
} from "./week-view-types";

/** Unit shown after a reminder's amount, as in Notion's "10min before" */
const REMINDER_UNIT_LABELS: Record<EventReminder["unit"], string> = {
  minutes: "min",
  hours: "hour",
  days: "day",
};

/** "10min", "1hour", "1day" */
function formatReminderAmount(reminder: EventReminder): string {
  return `${reminder.amount}${REMINDER_UNIT_LABELS[reminder.unit]}`;
}

/**
 * A muted "Reminders" heading, then one row per reminder
 */
export function EventDetailReminders<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event }: EventDetailSectionProps<TEvent>) {
  const reminders = event.reminders ?? [];

  return (
    <EventDetailSection name="reminders">
      <EventDetailPlaceholderRow icon={Bell} label="Reminders" />
      {reminders.map((reminder) => (
        <EventDetailRow key={`${reminder.amount}-${reminder.unit}`}>
          <span className="text-foreground">
            <span className="font-medium">
              {formatReminderAmount(reminder)}
            </span>{" "}
            before
          </span>
        </EventDetailRow>
      ))}
    </EventDetailSection>
  );
}
