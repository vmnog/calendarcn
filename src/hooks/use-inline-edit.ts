import * as React from "react";

/**
 * How a commit came about, passed to `onCommit`
 */
export interface InlineEditCommit {
  /** Text the field held when it gained focus */
  textOnFocus: string;
  /** Whether Enter committed it, rather than focus leaving the field */
  isEnter: boolean;
}

/**
 * Options for `useInlineEdit`
 */
export interface UseInlineEditOptions {
  /** The input's ref, used to blur it on Enter and Escape */
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** Text the field shows while it isn't being edited, derived from the event */
  value: string;
  /**
   * Commits the typed text on blur or Enter. Returns the text to show
   * afterwards, or `null` to reject it and restore the text from focus.
   */
  onCommit: (text: string, commit: InlineEditCommit) => string | null;
  /** Called on every keystroke, e.g. to preview a title on the calendar */
  onInput?: (text: string) => void;
  /**
   * Called with the text from focus after Escape or a rejected commit, e.g.
   * to undo a preview
   */
  onRestore?: (text: string) => void;
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
}: UseInlineEditOptions): UseInlineEditResult {
  const [text, setText] = React.useState(value);
  /** Set by Escape so the blur that follows doesn't commit */
  const escapePressedRef = React.useRef(false);
  /** Set by Enter so the blur that follows knows Enter committed */
  const enterPressedRef = React.useRef(false);
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
  }, [value]);

  const handleBlur = React.useCallback(() => {
    if (escapePressedRef.current) {
      escapePressedRef.current = false;
      return;
    }
    const isEnter = enterPressedRef.current;
    enterPressedRef.current = false;
    const committed = onCommit(text, {
      textOnFocus: valueOnFocusRef.current,
      isEnter,
    });
    if (committed !== null) {
      setText(committed);
      return;
    }
    setText(valueOnFocusRef.current);
    onRestore?.(valueOnFocusRef.current);
  }, [onCommit, onRestore, text]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        // The Enter that confirms an IME composition belongs to the IME
        // (Safari reports it as keyCode 229, with isComposing already false)
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
        e.preventDefault();
        enterPressedRef.current = true;
        inputRef.current?.blur();
        // Nothing to blur (the field lost focus already): don't mark the next one
        enterPressedRef.current = false;
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
