# Prompt: Create a New Custom Hook

Use this prompt template when asking Claude to create a new hook for CalendarCN.

---

Create a custom React hook `use{HookName}` in `src/hooks/use-{hook-name}.ts`.

Requirements:

1. Define `interface Use{HookName}Options` for all inputs
2. Define `interface Use{HookName}Return` for the return value
3. Sync all options to refs via useEffect:
   ```ts
   const optionRef = useRef(option);
   useEffect(() => { optionRef.current = option; }, [option]);
   ```
4. If using global event listeners (mousemove, mouseup, keydown):
   - Store handler in a ref
   - Add listener in useEffect
   - Clean up in useEffect return
5. Use ref-based intermediate state for high-frequency updates (drag/resize)
6. Only commit to React state at meaningful moments

The hook should: {describe what it does}

Inputs:
- {option1}: {type} — {description}
- {option2}: {type} — {description}

Returns:
- {field1}: {type} — {description}
- {field2}: {type} — {description}

After creating, run: `pnpm lint && pnpm typecheck && pnpm format:check`
