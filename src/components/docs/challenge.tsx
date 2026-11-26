"use client";

import * as React from "react";
import type { ReactNode } from "react";
import { CircleCheckIcon, CircleIcon, RotateCcwIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** What an example inside a `Challenge` reads: the task on screen, and how to mark it done */
export interface ChallengeValue {
  /** Index of the task on screen. Equals the number of tasks once all are done */
  step: number;
  /**
   * Marks the task on screen done. Calling it again for the same task does
   * nothing, nor does a call while a pointer is pressed in the example: call
   * it from an effect that lists `complete`, which changes on release
   */
  complete: () => void;
}

interface ChallengeProps {
  /** What to do, as an instruction ("Drag on Wednesday morning…"). A list is done in order */
  task: string | string[];
  /** The example, usually a `ComponentPreview`. Reset mounts it again */
  children: ReactNode;
}

/** Where a task stands: passed, on screen, or still to come */
function getTaskState(
  index: number,
  step: number,
): "done" | "current" | "next" {
  if (index < step) return "done";
  if (index === step) return "current";
  return "next";
}

/** An example outside a `Challenge`: no task, and nothing to complete */
const NO_CHALLENGE: ChallengeValue = { step: 0, complete: () => {} };

const ChallengeContext = React.createContext<ChallengeValue | null>(null);

/**
 * The challenge around an example. The example checks its own state (an
 * event with that title on that day) and calls `complete()` when the task
 * on screen (`step`) passes. Outside a `Challenge` it does nothing.
 */
export function useChallenge(): ChallengeValue {
  return React.useContext(ChallengeContext) ?? NO_CHALLENGE;
}

/**
 * A story demo: a bar above an example with what to do in it, and a check
 * that turns green with "Done" when the example says the task passed.
 * Reset puts the example back as it was.
 */
export function Challenge({ task, children }: ChallengeProps) {
  const tasks = Array.isArray(task) ? task : [task];
  const [step, setStep] = React.useState(0);
  // A new key mounts the example again, with its first state
  const [attempt, setAttempt] = React.useState(0);
  // A drag in the example passes through other states before it lands, so
  // nothing completes while a pointer is pressed in it
  const [isPressed, setIsPressed] = React.useState(false);
  const isDone = step >= tasks.length;

  React.useEffect(() => {
    if (!isPressed) return;
    const release = () => setIsPressed(false);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [isPressed]);

  const value = React.useMemo<ChallengeValue>(
    () => ({
      step,
      // Bound to the task on screen, so a check that runs twice advances
      // once. A new function on release runs the example's check again
      complete: () => {
        if (isPressed) return;
        setStep((current) => (current === step ? step + 1 : current));
      },
    }),
    [step, isPressed],
  );

  const reset = () => {
    setStep(0);
    setAttempt((current) => current + 1);
  };

  return (
    <div
      data-challenge
      className="my-6"
      onPointerDownCapture={() => setIsPressed(true)}
    >
      <div className="not-prose docs-surface flex items-start gap-3 rounded-xl bg-fd-card px-4 py-3 text-sm">
        <ol className="flex min-w-0 flex-1 flex-col gap-1.5">
          {tasks.map((text, index) => {
            const state = getTaskState(index, step);
            const isComplete = state === "done";
            const isCurrent = state === "current";
            return (
              <li
                key={text}
                data-state={state}
                className={cn(
                  "flex items-start gap-2",
                  isCurrent ? "text-fd-foreground" : "text-fd-muted-foreground",
                  isCurrent && "font-medium",
                )}
              >
                {isComplete ? (
                  <CircleCheckIcon
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-(--color-fd-success)"
                  />
                ) : (
                  <CircleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
                )}
                <span>{text}</span>
              </li>
            );
          })}
        </ol>
        <div className="flex shrink-0 items-center gap-3">
          {/* Read out when the last task passes */}
          <p
            role="status"
            data-challenge-status
            className="flex items-center gap-1 font-medium text-(--color-fd-success)"
          >
            {isDone && (
              <>
                <CircleCheckIcon aria-hidden className="size-4" />
                Done
              </>
            )}
          </p>
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1 rounded-sm text-fd-muted-foreground underline-offset-4 transition-colors hover:text-fd-foreground hover:underline focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:outline-none"
          >
            <RotateCcwIcon aria-hidden className="size-3.5" />
            Reset
          </button>
        </div>
      </div>
      <ChallengeContext.Provider value={value}>
        <React.Fragment key={attempt}>{children}</React.Fragment>
      </ChallengeContext.Provider>
    </div>
  );
}
