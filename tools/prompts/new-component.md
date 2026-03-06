# Prompt: Create a New Component

Use this prompt template when asking Claude to create a new component for CalendarCN.

---

Create a new React component `{ComponentName}` in `src/components/{component-name}.tsx`.

Requirements:

1. Add `"use client"` directive at the top
2. Define `interface {ComponentName}Props` with typed props
3. Follow the project import order: external → @/lib/utils → @/hooks → @/components → @/lib
4. Use `cn()` for conditional Tailwind classes
5. Constants in ALL_CAPS with JSDoc comments
6. Early returns for edge cases
7. If types are shared, add them to `week-view-types.ts`

The component should: {describe what it does}

Props:
- {prop1}: {type} — {description}
- {prop2}: {type} — {description}

After creating, run: `pnpm lint && pnpm typecheck && pnpm format:check`
