import type { ConferenceProviderOption } from "@/components/week-view-types";

/**
 * How long the placeholder services take to "create" a call, so the panel's
 * pending state shows, as it would while a real service's API answers
 */
const CREATE_DELAY_MS = 400;

/** Letters of a placeholder meeting code */
const LETTERS = "abcdefghijklmnopqrstuvwxyz";

/** A run of random lowercase letters */
function randomLetters(length: number): string {
  return Array.from(
    { length },
    () => LETTERS[Math.floor(Math.random() * LETTERS.length)],
  ).join("");
}

/** A run of random digits */
function randomDigits(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
}

/** Resolves with the value after `CREATE_DELAY_MS` */
function later<T>(value: T): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), CREATE_DELAY_MS);
  });
}

/**
 * Google Meet, Zoom and Microsoft Teams as the live demo offers them, to
 * pass to `conferenceProviders`. They're placeholders: each
 * `createConference` makes up a call in the service's code format on
 * example.com, after a short wait, so no link opens a real meeting. In an
 * app, `createConference` has to create the call through the service's API
 * (usually on your server, which holds the credentials) and return its link.
 *
 * They have no `icon`, so the panel shows a camera. The services' logos are
 * their owners' trademarks and don't ship with CalendarCN (ADR 005): add
 * them from each service's brand resources, under its terms.
 */
export const DEMO_CONFERENCE_PROVIDERS: ConferenceProviderOption[] = [
  {
    provider: "google-meet",
    label: "Google Meet",
    createConference: () => {
      const code = `${randomLetters(3)}-${randomLetters(4)}-${randomLetters(3)}`;
      return later({
        provider: "google-meet",
        url: `https://example.com/meet/${code}`,
        meetingId: code,
      });
    },
  },
  {
    provider: "zoom",
    label: "Zoom",
    createConference: () => {
      const id = randomDigits(10);
      return later({
        provider: "zoom",
        url: `https://example.com/zoom/j/${id}`,
        meetingId: `${id.slice(0, 3)} ${id.slice(3, 6)} ${id.slice(6)}`,
      });
    },
  },
  {
    provider: "microsoft-teams",
    label: "Microsoft Teams",
    createConference: () => {
      const id = randomDigits(12);
      return later({
        provider: "microsoft-teams",
        url: `https://example.com/teams/meet/${id}`,
        meetingId: id.replace(/(\d{3})(?=\d)/g, "$1 "),
      });
    },
  },
];
