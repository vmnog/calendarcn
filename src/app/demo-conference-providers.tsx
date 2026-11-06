import type { ConferenceProviderOption } from "@/components/week-view-types";

/**
 * How long the demo's services take to "create" a call, so the panel's
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

/** Google Meet's four-color camera */
function GoogleMeetLogo() {
  return (
    <svg viewBox="0 0 87.5 72" aria-hidden="true">
      <path
        fill="#00832d"
        d="M49.5 36l8.53 9.75 11.47 7.33 2-17.02-2-16.64-11.69 6.44z"
      />
      <path
        fill="#0066da"
        d="M0 51.5V66c0 3.315 2.685 6 6 6h14.5l3-10.96-3-9.54-9.95-3z"
      />
      <path fill="#e94235" d="M20.5 0L0 20.5l10.55 3 9.95-3 2.95-9.41z" />
      <path fill="#2684fc" d="M20.5 20.5H0v31h20.5z" />
      <path
        fill="#00ac47"
        d="M82.6 8.68L69.5 19.42v33.66l13.16 10.79c1.97 1.54 4.85.135 4.85-2.37V11c0-2.535-2.945-3.925-4.91-2.32zM49.5 36v15.5h-29V72h43c3.315 0 6-2.685 6-6V53.08z"
      />
      <path
        fill="#ffba00"
        d="M63.5 0h-43v20.5h29V36l20-16.57V6c0-3.315-2.685-6-6-6z"
      />
    </svg>
  );
}

/** Zoom's white camera on a blue rounded square */
function ZoomLogo() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect width="16" height="16" rx="4" fill="#2D8CFF" />
      <rect x="3" y="5.25" width="7" height="5.5" rx="1.25" fill="#fff" />
      <path d="M10.5 7.4l2.5-1.65v4.5L10.5 8.6z" fill="#fff" />
    </svg>
  );
}

/** Microsoft Teams' white "T" on a purple rounded square */
function TeamsLogo() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect width="16" height="16" rx="4" fill="#5B5FC7" />
      <path d="M4.5 4.75h7v1.6H8.8v5.9H7.2v-5.9H4.5z" fill="#fff" />
    </svg>
  );
}

/**
 * The demo's conferencing services. Their calls are made up on the spot,
 * in each service's code format but on example.com, so no link opens a
 * real meeting. An app passes its own, creating calls through the
 * service's API.
 */
export const DEMO_CONFERENCE_PROVIDERS: ConferenceProviderOption[] = [
  {
    provider: "google-meet",
    label: "Google Meet",
    icon: <GoogleMeetLogo />,
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
    icon: <ZoomLogo />,
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
    icon: <TeamsLogo />,
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
