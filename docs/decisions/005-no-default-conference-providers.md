# ADR-005: No Default Conference Providers

## Status

Accepted

## Context

The event details panel can add a video call to an event. Its first version shipped default providers in the registry: Google Meet, Zoom and Microsoft Teams, each with a redrawn logo and a `createConference` that made up a random link on the service's own domain (`meet.google.com/abc-defg-hij`, `zoom.us/j/<10 digits>`).

That caused two problems:

- **Trademarks.** The logos are the services' brand marks. The Google Meet paths matched Google's official icon, and the Zoom and Teams marks were altered copies. CalendarCN's MIT license can't license someone else's trademark, and brand guidelines don't allow altered logos. Every project that ran `shadcn add` would copy them into its own source.
- **Real links.** A random code on a real domain can be a real meeting. A random `zoom.us/j/<10 digits>` can open a stranger's call, and a user who joins from a demo or an app that kept the defaults ends up there.

Apps could replace the list through `conferenceProviders`, but the panel picked the logo from the `provider` value, so an app couldn't bring its own icon.

## Decision

The registry ships no conferencing providers and no brand logos:

- `conferenceProviders` defaults to an empty list. With no providers the Conferencing row is hidden, unless the event already has a call, which still shows with a remove option.
- Apps pass `conferenceProviders`. Each `ConferenceProviderOption` brings its own `icon` (a `React.ReactNode`; lucide's `Video` camera when left out) and a `createConference(event)` that creates the call through the service's API. It may return a promise; the row shows the option as pending until it settles.
- The demo (`src/app/demo-conference-providers.tsx`, not in the registry) shows how: Google Meet, Zoom and Teams with their logos, creating calls on example.com after a short wait.

## Consequences

### Positive

- No third-party trademarks in the registry, so nothing an app installs carries a brand it has no right to use.
- No link the calendar makes up can open a real meeting.
- Apps show their own icons, and can offer two options of one service (two Zoom accounts), told apart by `label`.
- `createConference` gets the event and can be async, so it fits a real API call.

### Negative

- Out of the box, a new install has no Conferencing row. An app has to write a provider before its users can add a call.
- Each app sources and licenses its own logos.

### Neutral

- Existing calls keep working without providers: an event's `conference` still shows, with a camera icon and the service's name.

## Update: placeholder providers as an opt-in item (2026-11-07)

So that apps can reproduce the live demo, the demo's placeholder services ship as the registry item `conference-providers` (`src/lib/conference-providers.ts`, `DEMO_CONFERENCE_PROVIDERS`). The decision above still holds:

- Nothing is on by default. An app gets the services only by installing the item and passing it to `conferenceProviders`.
- The item has no logos. `src/app/demo-conference-providers.tsx` keeps them, out of the registry, and adds them to the item's options for the demo.
- Its calls are made up on example.com. Its JSDoc and docs say that `createConference` has to create the call through the service's API.
