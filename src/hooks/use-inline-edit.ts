import * as React from "react";

/**
 * Options for `useInlineEdit`
 */
export interface UseInlineEditOptions {
  /** The input's ref, used to blur it on Enter and Escape and to select its text */
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** Text the field shows while it isn't being edited, derived from the event */
  value: string;
  /**
   * Commits the typed text on blur or Enter. Returns the text to show
   * afterwards, or `null` to reject it and restore the text from focus.
   */
  onCommit: (text: string) => string | null;
  /** Called on every keystroke, e.g. to preview a title on the calendar */
  onInput?: (text: string) => void;
  /** Called with the text from focus after Escape, e.g. to undo a preview */
  onRestore?: (text: string) => void;
  /** Selects the whole text on focus, as the time and date fields do */
  selectOnFocus?: boolean;
}

/**
 * Props to spread on the `<input>` an inline edit drives (pass its ref
 * separately)
 */
export interface InlineEditInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * Value `useInlineEdit` returns
 */
export interface UseInlineEditResult {
  /** Text in the field right now, typed or derived */
  text: string;
  /** Spread on the `<input>` */
  inputProps: InlineEditInputProps;
}

/**
 * The details panel's inline edit pattern for one text field: local text
 * while typing, Enter commits by blurring, Escape restores the text from
 * focus without committing (and stops the key from reaching the calendar's
 * global Escape, which would deselect the event).
 */
export function useInlineEdit({
  inputRef,
  value,
  onCommit,
  onInput,
  onRestore,
  selectOnFocus = false,
}: UseInlineEditOptions): UseInlineEditResult {
  const [text, setText] = React.useState(value);
  /** Set by Escape so the blur that follows doesn't commit */
  const escapePressedRef = React.useRef(false);
  /** Text when the field gained focus, restored on Escape or a rejected commit */
  const valueOnFocusRef = React.useRef(value);

  // Follow the event while the field isn't being typed into
  React.useEffect(() => {
    setText(value);
  }, [value]);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setText(e.target.value);
      onInput?.(e.target.value);
    },
    [onInput],
  );

  const handleFocus = React.useCallback(() => {
    valueOnFocusRef.current = value;
    if (!selectOnFocus) return;
    requestAnimationFrame(() => {
      inputRef.current?.select();
    });
  }, [inputRef, value, selectOnFocus]);

  const handleBlur = React.useCallback(() => {
    if (escapePressedRef.current) {
      escapePressedRef.current = false;
      return;
    }
    const committed = onCommit(text);
    setText(committed ?? valueOnFocusRef.current);
  }, [onCommit, text]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        inputRef.current?.blur();
        return;
      }
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      escapePressedRef.current = true;
      setText(valueOnFocusRef.current);
      onRestore?.(valueOnFocusRef.current);
      inputRef.current?.blur();
    },
    [inputRef, onRestore],
  );

  return {
    text,
    inputProps: {
      value: text,
      onChange: handleChange,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
    },
  };
}
