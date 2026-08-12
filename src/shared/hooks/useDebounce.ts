import { useCallback, useRef } from "react";

/**
 * Debounce para funções (callbacks).
 * Útil para salvar automaticamente ou disparar ações em resposta a mudanças rápidas.
 *
 * @example
 *   const saveDebounced = useDebounce((text: string) => api.save(text), 500);
 *   saveDebounced("novo valor"); // → executa api.save após 500ms de silêncio
 */
export function useDebounce<T extends (...args: never[]) => void>(fn: T, delay: number): T {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fn(...args), delay);
    },
    [fn, delay],
  ) as unknown as T;
}
