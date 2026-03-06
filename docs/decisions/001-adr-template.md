# ADR-001: Architecture Decision Record Template

## Status

Accepted

## Context

We need a consistent format for documenting architecture decisions in the CalendarCN project so that future contributors understand why things are built the way they are.

## Decision

Use this template for all ADRs. File naming: `NNN-short-title.md` (e.g., `002-use-date-fns.md`).

### Template

```markdown
# ADR-NNN: Title

## Status

[Proposed | Accepted | Deprecated | Superseded by ADR-NNN]

## Context

What is the issue or question? What forces are at play?

## Decision

What did we decide? Be specific about the chosen approach.

## Consequences

### Positive
- What benefits does this bring?

### Negative
- What tradeoffs or risks come with this?

### Neutral
- Any neutral observations?
```

## Consequences

### Positive

- Consistent documentation format across the project
- Easy to find and understand past decisions
- New contributors can understand "why" not just "what"

### Negative

- Adds a small overhead to the decision-making process
