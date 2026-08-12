/** Formata um valor em reais — ex.: 1234.5 → "R$ 1.234,50" */
export const formatCurrency = (currency: number): string => Number(currency).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Formata centavos inteiros — ex.: 123450 → "R$ 1.234,50" */
export const formatCurrencyFromCents = (cents: number): string => formatCurrency((Number(cents) || 0) / 100);

/**
 * Como as tabelas escrevem dinheiro: valor ausente vira R$ 0,00 em vez de
 * "R$ NaN". Três telas mantinham cada uma a sua versão desta linha.
 */
export const money = (valor?: number | null): string => formatCurrency(Number(valor) || 0);
