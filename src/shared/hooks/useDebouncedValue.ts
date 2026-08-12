import { useEffect, useState } from "react";

export const SEARCH_DEBOUNCE = 250;

/** Atrasa a propagação de um valor — usado nos campos de busca das listagens. */
export function useDebouncedValue<T>(value: T, delay: number = SEARCH_DEBOUNCE): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
