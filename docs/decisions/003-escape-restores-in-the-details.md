# ADR-003: Escape Restores in the Event Details

## Status

Accepted

## Context

The event details panel copies Notion Calendar's fields and menus: the kind, time, time zone, repeat, guest and calendar pickers. In Notion, hovering a menu item previews it, and pressing Escape closes the menu and keeps the highlighted item, as if it had been clicked.

In CalendarCN, Escape outside the details also deselects the event and closes the popover (`useCalendarShortcuts`). A key that both commits a value and closes the details is easy to press by accident, and some menus have effects outside the calendar: adding a guest sends them an invite once the app syncs the event.

## Decision

Escape in a field or menu of the details closes it and restores the value from before it opened. It never commits.

- Hovering a menu item, or moving to it with the arrow keys, only previews it.
- A value commits on Enter, on click, or on blur after typing or arrow keys.
- Escape stops at the field or menu: it doesn't reach the global handler, so the event stays selected. A second Escape deselects it.

Fields use `useInlineEdit`. Menus use `closeMenuOnEscape` (controlled) or `stopEscapePropagation` (uncontrolled) from `event-detail-parts.tsx`. `CLAUDE.md` states the rule for new fields.

## Consequences

### Positive

- No accidental commits: Escape always means "leave it as it was".
- No accidental invites, calendar moves or repeat changes from a highlighted item.
- One rule for every field and menu, which the e2e suite checks on the title and the menus.

### Negative

- Differs from Notion Calendar, which people who use both may notice.
- Leaving the details from a field takes two presses of Escape.

### Neutral

- A preview shown while typing (the title on the grid) is undone on Escape through `useInlineEdit`'s `onRestore`, so the calendar and the panel never disagree.
