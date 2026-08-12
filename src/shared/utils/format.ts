export const EMPTY = "—";

export function onlyDigits(value?: string | number): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function formatDocument(value?: string): string {
  const d = onlyDigits(value);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return value || EMPTY;
}

/**
 * Formata quantidades numéricas (com separador de milhar).
 * NÃO use para telefone — para isso existe `maskPhone`, senão um telefone
 * vira "11.999.998.888".
 */
export function formatNumber(value: number | string): string {
  const number = Number(value);
  if (Number.isNaN(number)) return "0";
  return new Intl.NumberFormat("pt-BR").format(number);
}

export function getInitials(name?: string, fallback = "?"): string {
  return (
    (name ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || fallback
  );
}

export function toPercent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
