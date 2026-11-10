# ADR-002: Client-Side Only Architecture

## Status

Accepted. See "Amendments" at the end for what changed since.

## Context

CalendarCN is an open-source calendar component. We needed to decide whether to include a backend (API routes, database) or keep it purely client-side.

## Decision

Keep CalendarCN as a client-side only application. All event data lives in React state and is initialized from `mock-events.ts`. There is no persistence layer, API, or database.

## Consequences

### Positive

- Zero infrastructure cost — deploys as a static site on Vercel
- Simple mental model — all state flows through `page.tsx`
- Easy to fork and integrate into other projects
- No auth, no CORS, no server-side concerns

### Negative

- Data resets on page reload
- Cannot save events across sessions without a persistence layer
- No multi-user collaboration possible

### Neutral

- When persistence is needed in the future, `page.tsx` state handlers are already callback-based, making it straightforward to wire up an API

## Amendments

- The decision stands for calendar data: events live in React state and nothing is saved.
- State no longer flows through `page.tsx`. `CalendarProvider` owns it, and an app that wants persistence wires it to the provider's `onEventsChange`, `onEventCreate` and `onEventUpdate`.
- One API route exists, `src/app/api/search/route.ts`. It serves the docs site's search and holds no calendar data, so the site is no longer a purely static deploy.
