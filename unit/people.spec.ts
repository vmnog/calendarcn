import { expect, test } from "@playwright/test";

import type { EventContact } from "../src/components/calendar-types";
import { generateContactEvents } from "../src/lib/mock-events";
import {
  PERSON_COLORS,
  addEmail,
  addMeetingParticipants,
  findContact,
  getCalendarPerson,
  getTypedPerson,
  getPersonInitial,
  getPersonName,
  isSameEmail,
  matchesPerson,
  removeEmail,
  suggestPeople,
} from "../src/lib/people";

/**
 * People you meet with and teammates (`src/lib/people.ts`): names, colors,
 * the lists "Meet with..." and "Show teammate calendar..." keep, the
 * suggestions, and the participants a meeting's new event gets.
 */

const CONTACTS: EventContact[] = [
  { name: "Priya Shah", email: "priya@example.com", recent: true },
  { name: "Alex Rivera", email: "alex@example.com" },
  { email: "jordan@example.com", recent: true },
  { name: "Sam Lee", email: "sam@example.com", color: "gray" },
];

test.describe("names and colors", () => {
  test("a name, else the email; its first letter for the avatar", () => {
    expect(getPersonName(CONTACTS[0])).toBe("Priya Shah");
    expect(getPersonName(CONTACTS[2])).toBe("jordan@example.com");
    expect(getPersonName({ email: "a@example.com", name: "  " })).toBe(
      "a@example.com",
    );
    expect(getPersonInitial(CONTACTS[0])).toBe("P");
    expect(getPersonInitial(CONTACTS[2])).toBe("J");
  });

  test("emails match without case or spaces", () => {
    expect(isSameEmail("Priya@Example.com ", "priya@example.com")).toBe(true);
    expect(isSameEmail("priya@example.com", "alex@example.com")).toBe(false);
    expect(findContact(CONTACTS, "ALEX@example.com").name).toBe("Alex Rivera");
    expect(findContact(CONTACTS, "new@example.com")).toEqual({
      email: "new@example.com",
    });
  });

  test("a color by place in the contacts, or the contact's own", () => {
    expect(getCalendarPerson(CONTACTS, "priya@example.com").color).toBe(
      PERSON_COLORS[0],
    );
    expect(getCalendarPerson(CONTACTS, "alex@example.com").color).toBe(
      PERSON_COLORS[1],
    );
    expect(getCalendarPerson(CONTACTS, "sam@example.com").color).toBe("gray");
    // Someone not in the contacts takes the next color after them
    expect(getCalendarPerson(CONTACTS, "new@example.com")).toEqual({
      email: "new@example.com",
      color: PERSON_COLORS[CONTACTS.length % PERSON_COLORS.length],
    });
  });
});

test.describe("the lists of emails", () => {
  test("adding keeps the order and never adds twice", () => {
    const list = addEmail(["priya@example.com"], "alex@example.com");
    expect(list).toEqual(["priya@example.com", "alex@example.com"]);
    expect(addEmail(list, "ALEX@example.com")).toEqual(list);
    expect(addEmail(list, "  ")).toEqual(list);
    expect(addEmail([], " sam@example.com ")).toEqual(["sam@example.com"]);
  });

  test("removing ignores case", () => {
    expect(
      removeEmail(
        ["priya@example.com", "alex@example.com"],
        "Priya@example.com",
      ),
    ).toEqual(["alex@example.com"]);
  });
});

test.describe("suggestions", () => {
  test("typed text matches a word of the name or part of the email", () => {
    expect(matchesPerson(CONTACTS[0], "pri")).toBe(true);
    expect(matchesPerson(CONTACTS[0], "sha")).toBe(true);
    expect(matchesPerson(CONTACTS[0], "hah")).toBe(false);
    expect(matchesPerson(CONTACTS[2], "dan@ex")).toBe(true);
    expect(matchesPerson(CONTACTS[1], "")).toBe(true);
  });

  test("nothing typed: recent people first, then the others", () => {
    expect(suggestPeople(CONTACTS, "").map((c) => c.email)).toEqual([
      "priya@example.com",
      "jordan@example.com",
      "alex@example.com",
      "sam@example.com",
    ]);
  });

  test("the people added already are left out, and the list is capped", () => {
    expect(
      suggestPeople(CONTACTS, "example", ["PRIYA@example.com"]).map(
        (c) => c.email,
      ),
    ).toEqual(["alex@example.com", "jordan@example.com", "sam@example.com"]);
    expect(suggestPeople(CONTACTS, "", [], 2)).toHaveLength(2);
  });
});

test.describe("a typed address", () => {
  test("is offered when no contact has it and nobody added it", () => {
    expect(getTypedPerson(CONTACTS, " new@example.com ")).toEqual({
      email: "new@example.com",
    });
    expect(getTypedPerson(CONTACTS, "Priya@example.com")).toBeNull();
    expect(
      getTypedPerson(CONTACTS, "new@example.com", ["NEW@example.com"]),
    ).toBeNull();
    expect(getTypedPerson(CONTACTS, "not an email")).toBeNull();
    expect(getTypedPerson(CONTACTS, "new@example")).toBeNull();
  });
});

test.describe("participants of an event created while meeting", () => {
  const people = [CONTACTS[0], CONTACTS[2]];

  test("everyone met with is invited, the calendar's account organizing", () => {
    expect(addMeetingParticipants([], people, "you@example.com")).toEqual([
      { email: "you@example.com", organizer: true, response: "accepted" },
      {
        email: "priya@example.com",
        name: "Priya Shah",
        response: "needs-action",
      },
      { email: "jordan@example.com", response: "needs-action" },
    ]);
  });

  test("without an account, only the people are invited", () => {
    expect(addMeetingParticipants([], [CONTACTS[2]])).toEqual([
      { email: "jordan@example.com", response: "needs-action" },
    ]);
  });

  test("people invited already, and yourself, are not added again", () => {
    const existing = [
      { email: "sam@example.com", organizer: true, response: "accepted" },
      { email: "Priya@example.com", response: "accepted" },
    ] as const;
    expect(
      addMeetingParticipants(
        [...existing],
        [...people, { email: "you@example.com" }],
        "you@example.com",
      ),
    ).toEqual([
      ...existing,
      { email: "jordan@example.com", response: "needs-action" },
    ]);
    // Nobody new: the list comes back as it was
    expect(addMeetingParticipants([...existing], [CONTACTS[0]])).toEqual([
      ...existing,
    ]);
  });
});

test.describe("the demo teammates", () => {
  test("four contacts with a week of events each, repeating ones weekly", () => {
    const thursday = new Date(2026, 10, 19, 12);
    const byEmail = generateContactEvents(thursday);
    expect(Object.keys(byEmail)).toEqual([
      "priya@example.com",
      "alex@example.com",
      "sam@example.com",
      "morgan.diaz@example.com",
    ]);
    for (const [email, events] of Object.entries(byEmail)) {
      expect(events.length).toBeGreaterThan(3);
      for (const event of events) {
        expect(event.calendarEmail).toBe(email);
        expect(event.end > event.start).toBe(true);
      }
    }
    // A one-off lands in the week of `today`
    const review = byEmail["priya@example.com"].find(
      (event) => event.title === "Design review with Alex",
    );
    expect(review?.start).toEqual(new Date(2026, 10, 19, 15));
    expect(review?.recurrenceRule).toBeUndefined();
  });
});
