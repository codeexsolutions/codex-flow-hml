import { useEffect, useRef, useState, type RefObject } from "react";

export const ROW_HEIGHT = 63.3;
export const MIN_PER_PAGE = 5;
export const FALLBACK_PER_PAGE = 10;

type Options = {
  rowHeight?: number;
  minPerPage?: number;
  fallbackPerPage?: number;
};

/**
 * Calcula quantas linhas cabem no container e reage a mudanças de altura
 * (resize da janela, banner de erro aparecendo, etc). Evita scroll: o que não
 * couber vai para a próxima página.
 *
 * Antes era duplicado, idêntico, em Clientes e Estoque.
 */
export function useAutoPageSize<T extends HTMLElement = HTMLDivElement>({ rowHeight = ROW_HEIGHT, minPerPage = MIN_PER_PAGE, fallbackPerPage = FALLBACK_PER_PAGE }: Options = {}): {
  bodyRef: RefObject<T>;
  perPage: number;
} {
  const bodyRef = useRef<T>(null);
  const [perPage, setPerPage] = useState(fallbackPerPage);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    const calc = () => {
      const h = el.clientHeight;
      if (h <= 0) return;
      const rows = Math.max(minPerPage, Math.floor(h / rowHeight));
      setPerPage((prev) => (prev === rows ? prev : rows));
    };

    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rowHeight, minPerPage]);

  return { bodyRef, perPage };
}
