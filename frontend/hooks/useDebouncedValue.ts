"use client";

import { useEffect, useState } from "react";

/**
 * Returns `value` but only after it has stopped changing for `delayMs`.
 * Use for search inputs so we don't fire an API call on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs: number = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}
