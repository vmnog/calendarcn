import * as React from "react";

interface UseControllableStateOptions<T> {
  /** Controlled value. `undefined` lets the hook own the value */
  prop: T | undefined;
  /** Initial value (or lazy initializer) when not controlled */
  defaultProp: T | (() => T);
  /** Called with every new value, controlled or not */
  onChange?: (value: T) => void;
}

type UseControllableStateReturn<T> = [
  T,
  (action: React.SetStateAction<T>) => void,
];

/** Whether a state action is an updater function rather than a value */
function isUpdater<T>(
  action: React.SetStateAction<T>,
): action is (prev: T) => T {
  return typeof action === "function";
}

/**
 * State that can be controlled by a parent (`prop` + `onChange`) or owned by
 * the component (`defaultProp`), shadcn/Radix style. The setter accepts a
 * value or an updater, like `useState`, and skips no-op updates.
 */
export function useControllableState<T>({
  prop,
  defaultProp,
  onChange,
}: UseControllableStateOptions<T>): UseControllableStateReturn<T> {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultProp);
  const isControlled = prop !== undefined;
  const value = prop !== undefined ? prop : uncontrolledValue;

  /** Latest value, read by updaters called outside render */
  const valueRef = React.useRef(value);
  const onChangeRef = React.useRef(onChange);

  React.useEffect(() => {
    valueRef.current = value;
  }, [value]);

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const setValue = React.useCallback(
    (action: React.SetStateAction<T>) => {
      const next = isUpdater(action) ? action(valueRef.current) : action;
      if (Object.is(next, valueRef.current)) return;
      if (!isControlled) {
        // Owned value: later updaters in the same tick build on this one
        valueRef.current = next;
        setUncontrolledValue(next);
      }
      onChangeRef.current?.(next);
    },
    [isControlled],
  );

  return [value, setValue];
}
