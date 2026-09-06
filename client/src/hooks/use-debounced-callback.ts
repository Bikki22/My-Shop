"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

export interface DebouncedCallback<Args extends unknown[]> {
  (...args: Args): void;
  /** Drops a pending call — for when the action is being taken right now. */
  cancel: () => void;
}

/**
 * Wraps a function so it runs once the calls stop coming for `delay` ms.
 *
 * This debounces the *action* rather than a value: the caller keeps its own
 * state updating on every keystroke (so typing is never held up) and only
 * the effect of typing — a navigation, a request — is coalesced. That is
 * what the catalogue's search box needs: one query per pause, not one per
 * letter of "headphones".
 *
 * The newest `callback` is read at fire time, so a closure captured a
 * moment ago never applies stale props.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay = 300,
): DebouncedCallback<Args> {
  const latest = useRef(callback);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    latest.current = callback;
  }, [callback]);

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // A call still in flight when the component unmounts would fire into a
  // gone tree.
  useEffect(() => cancel, [cancel]);

  return useMemo(() => {
    const debounced = ((...args: Args) => {
      cancel();
      timer.current = setTimeout(() => {
        timer.current = null;
        latest.current(...args);
      }, delay);
    }) as DebouncedCallback<Args>;

    debounced.cancel = cancel;
    return debounced;
  }, [cancel, delay]);
}
