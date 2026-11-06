import * as React from "react";

/** Attribute marking a field's popover: focus moving into it comes straight back */
export const FIELD_POPOVER_ATTRIBUTE = "data-event-detail-field-popover";

/**
 * Options for `useFieldPopover`
 */
export interface UseFieldPopoverOptions {
  /** The field's input */
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** Whether the field's popover is open */
  open: boolean;
  /** Focus came into the field: opens the popover */
  onEnter: () => void;
  /** Focus left the field, not by Escape or a pick: sets what was typed or chosen */
  onCommit: () => void;
  /** Escape: puts back the value from before the popover opened */
  onRestore: () => void;
  /** Closes the popover */
  onClose: () => void;
}

/**
 * Value `useFieldPopover` returns
 */
export interface UseFieldPopoverResult {
  /** Spread on the `<input>` */
  inputProps: {
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  };
  /** Called as a press on the field's box starts */
  notePress: () => void;
  /** Called before the popover hands focus back to the input */
  noteReturnFocus: () => void;
  /** Escape: restores the value, closes the popover and leaves the field */
  escape: () => void;
  /** Closes the popover and leaves the field after a pick that set the value */
  leave: () => void;
}

/** Selects an input's text once React has put its new value in it */
export function selectInputSoon(
  inputRef: React.RefObject<HTMLInputElement | null>,
) {
  requestAnimationFrame(() => {
    const input = inputRef.current;
    if (input && document.activeElement === input) input.select();
  });
}

/** Whether focus is moving into a field popover (it comes straight back) */
function isFieldPopover(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(`[${FIELD_POPOVER_ATTRIBUTE}]`) !== null
  );
}

/**
 * Focus, blur and Escape for a details field with a popover (the time menu,
 * the date picker), following the panel's inline edit pattern: focus opens
 * the popover, blur commits and closes it, Escape restores the value and
 * leaves the field without committing.
 *
 * The popover libraries move focus as they open and close, and the hook
 * keeps it in the field:
 * - Opening, the popover takes focus and hands it back to the input; that
 *   focus isn't entering the field again.
 * - Escape reaches Radix and Base UI on the document, where Base UI stops
 *   it, so the hook takes it first on the window while the popover is open,
 *   and keeps it from the details' and the calendar's own Escape (which
 *   would deselect the event).
 * - Closing, Base UI hands focus back to the input it came from. After the
 *   field is left, a focus with no source is that hand-back until the field
 *   is pressed again, and it's turned away.
 */
export function useFieldPopover({
  inputRef,
  open,
  onEnter,
  onCommit,
  onRestore,
  onClose,
}: UseFieldPopoverOptions): UseFieldPopoverResult {
  const optionsRef = React.useRef({
    open,
    onEnter,
    onCommit,
    onRestore,
    onClose,
  });
  /** Set while the popover hands focus back to the input */
  const returningFocusRef = React.useRef(false);
  /** Set when the field is left with its popover open, until it's pressed again */
  const leftOpenRef = React.useRef(false);
  /** Set by Escape and a pick, whose blur must not commit again */
  const skipBlurCommitRef = React.useRef(false);

  React.useEffect(() => {
    optionsRef.current = { open, onEnter, onCommit, onRestore, onClose };
  }, [open, onEnter, onCommit, onRestore, onClose]);

  const leave = React.useCallback(() => {
    const wasOpen = optionsRef.current.open;
    optionsRef.current.onClose();
    const input = inputRef.current;
    if (!input || document.activeElement !== input) return;
    leftOpenRef.current = wasOpen;
    skipBlurCommitRef.current = true;
    input.blur();
  }, [inputRef]);

  const escape = React.useCallback(() => {
    optionsRef.current.onRestore();
    leave();
  }, [leave]);

  React.useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" || document.activeElement !== inputRef.current) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      escape();
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, inputRef, escape]);

  const handleFocus = React.useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      if (returningFocusRef.current) {
        returningFocusRef.current = false;
        return;
      }
      if (leftOpenRef.current && e.relatedTarget === null) {
        leftOpenRef.current = false;
        skipBlurCommitRef.current = true;
        e.currentTarget.blur();
        return;
      }
      leftOpenRef.current = false;
      optionsRef.current.onEnter();
    },
    [],
  );

  const handleBlur = React.useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      if (isFieldPopover(e.relatedTarget)) return;
      if (skipBlurCommitRef.current) {
        skipBlurCommitRef.current = false;
        optionsRef.current.onClose();
        return;
      }
      optionsRef.current.onCommit();
      optionsRef.current.onClose();
    },
    [],
  );

  const notePress = React.useCallback(() => {
    leftOpenRef.current = false;
  }, []);

  const noteReturnFocus = React.useCallback(() => {
    returningFocusRef.current = true;
  }, []);

  return {
    inputProps: { onFocus: handleFocus, onBlur: handleBlur },
    notePress,
    noteReturnFocus,
    escape,
    leave,
  };
}
