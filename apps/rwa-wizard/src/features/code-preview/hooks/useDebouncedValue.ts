import { useEffect, useState } from 'react';

/** Debounce a value for preview regen. INV-15: runs before `toPreviewConfig`. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebounced(value);
    }, delayMs);

    return () => {
      window.clearTimeout(handle);
    };
  }, [value, delayMs]);

  return debounced;
}
