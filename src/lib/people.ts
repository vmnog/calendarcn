import type {
  CalendarPerson,
  EventColor,
  EventContact,
  EventParticipant,
} from "@/components/calendar-types";

/**
 * Colors given to people whose contact sets none, by their place in
 * `contacts`: every event color but gray, so their events stand apart from
 * gray "Busy" blocks
 */
export const PERSON_COLORS: readonly EventColor[] = [
  "blue",
  "orange",
  "purple",
  "green",
  "red",
  "yellow",
];

/** Most people a "Meet with..." list shows at once */
export const MAX_PEOPLE_SUGGESTIONS = 6;

/**
 * A typed address that can be added without a contact, as strict as the
 * details' participants field: a plain local part, then a domain of
 * letters, digits and hyphens with a 2+ letter TLD
 */
export const EMAIL_PATTERN =
  /^[A-Za-z0-9._%+'-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

/** Whether two emails name the same person (emails ignore case) */
export function isSameEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** The name a person is shown with: their name, else their email */
export function getPersonName(contact: EventContact): string {
  return contact.name?.trim() || contact.email;
}

/** One letter for a person's avatar: their name's, else their email's */
export function getPersonInitial(contact: EventContact): string {
  return getPersonName(contact).charAt(0).toUpperCase();
}

/** The contact with this email, or a bare `{ email }` when none has it */
export function findContact(
  contacts: readonly EventContact[],
  email: string,
): EventContact {
  return (
    contacts.find((contact) => isSameEmail(contact.email, email)) ?? {
      email,
    }
  );
}

/**
 * A person as the calendar draws them: their contact, with their own color
 * or the one their place in `contacts` picks from `PERSON_COLORS` (people
 * not in `contacts` take the next ones after them)
 */
export function getCalendarPerson(
  contacts: readonly EventContact[],
  email: string,
): CalendarPerson {
  const contact = findContact(contacts, email);
  if (contact.color) return { ...contact, color: contact.color };
  const index = contacts.findIndex((c) => isSameEmail(c.email, email));
  const place = index === -1 ? contacts.length : index;
  return { ...contact, color: PERSON_COLORS[place % PERSON_COLORS.length] };
}

/**
 * Adds an email to a list, keeping its order. The list comes back as it was
 * when the email is in it already (in any case).
 */
export function addEmail(emails: readonly string[], email: string): string[] {
  const trimmed = email.trim();
  if (!trimmed || emails.some((e) => isSameEmail(e, trimmed))) {
    return [...emails];
  }
  return [...emails, trimmed];
}

/** Takes an email out of a list (in any case) */
export function removeEmail(
  emails: readonly string[],
  email: string,
): string[] {
  return emails.filter((e) => !isSameEmail(e, email));
}

/** Whether a contact matches typed text: a word of its name starts with it, or its email contains it */
export function matchesPerson(contact: EventContact, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (contact.email.toLowerCase().includes(q)) return true;
  const name = contact.name?.toLowerCase() ?? "";
  return name.startsWith(q) || name.split(/\s+/).some((w) => w.startsWith(q));
}

/**
 * The people a "Meet with..." or "Show teammate calendar..." list offers
 * for typed text, leaving out `exclude` (the people already added). With
 * nothing typed: the recent contacts first, then the others. While typing:
 * the matches, in their order in `contacts`.
 */
export function suggestPeople(
  contacts: readonly EventContact[],
  query: string,
  exclude: readonly string[] = [],
  limit = MAX_PEOPLE_SUGGESTIONS,
): EventContact[] {
  const available = contacts.filter(
    (contact) => !exclude.some((email) => isSameEmail(email, contact.email)),
  );
  if (!query.trim()) {
    return [
      ...available.filter((contact) => contact.recent),
      ...available.filter((contact) => !contact.recent),
    ].slice(0, limit);
  }
  return available
    .filter((contact) => matchesPerson(contact, query))
    .slice(0, limit);
}

/**
 * The typed text as someone to add when it's an email address that no
 * contact has and nobody added yet, else `null`
 */
export function getTypedPerson(
  contacts: readonly EventContact[],
  typed: string,
  exclude: readonly string[] = [],
): EventContact | null {
  const email = typed.trim();
  if (!EMAIL_PATTERN.test(email)) return null;
  if (contacts.some((contact) => isSameEmail(contact.email, email))) {
    return null;
  }
  if (exclude.some((added) => isSameEmail(added, email))) return null;
  return { email };
}

/**
 * The participants of an event created while meeting with people: the
 * event's own, then everyone met with who isn't invited yet, waiting for an
 * answer. When anyone is added, the calendar's account (`owner`) organizes
 * unless the event already has an organizer, as the details' participants
 * field does it.
 */
export function addMeetingParticipants(
  participants: readonly EventParticipant[],
  people: readonly EventContact[],
  owner?: string,
): EventParticipant[] {
  const invited = people
    .filter(
      (person) =>
        !participants.some((p) => isSameEmail(p.email, person.email)) &&
        !(owner && isSameEmail(person.email, owner)),
    )
    .map(
      (person): EventParticipant => ({
        email: person.email,
        ...(person.name ? { name: person.name } : {}),
        response: "needs-action",
      }),
    );
  if (invited.length === 0) return [...participants];
  const hasOrganizer = participants.some((p) => p.organizer);
  const ownerListed =
    owner !== undefined &&
    participants.some((p) => isSameEmail(p.email, owner));
  const organizer: EventParticipant[] =
    owner && !hasOrganizer && !ownerListed
      ? [{ email: owner, organizer: true, response: "accepted" }]
      : [];
  return [...organizer, ...participants, ...invited];
}
