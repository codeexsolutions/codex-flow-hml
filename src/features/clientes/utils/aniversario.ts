/**
 * Aniversário do cliente.
 *
 * A data vem como string pura "AAAA-MM-DD" e é lida assim, componente a
 * componente. `new Date("1990-03-01")` é meia-noite **UTC**: em Brasília isso
 * volta 28/02 e o aniversariante do dia 1º aparece no mês errado — o mesmo
 * erro de fuso que o resto do sistema já resolveu para as datas de venda.
 */

const partes = (iso?: string | null): { ano: number; mes: number; dia: number } | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((iso ?? "").trim());
  if (!m) return null;

  return { ano: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };
};

/** Dia do mês do aniversário, ou `null` quando não há data. */
export const diaAniversario = (iso?: string | null): number | null => partes(iso)?.dia ?? null;

/** Mês do aniversário (1–12). */
export const mesAniversario = (iso?: string | null): number | null => partes(iso)?.mes ?? null;

/** "12/03" — como o aniversário aparece nas listas. */
export const aniversarioBr = (iso?: string | null): string => {
  const p = partes(iso);
  if (!p) return "";

  return `${String(p.dia).padStart(2, "0")}/${String(p.mes).padStart(2, "0")}`;
};

export const ehAniversarioHoje = (iso?: string | null, hoje = new Date()): boolean => {
  const p = partes(iso);
  return Boolean(p && p.dia === hoje.getDate() && p.mes === hoje.getMonth() + 1);
};

export const ehAniversarianteDoMes = (iso?: string | null, hoje = new Date()): boolean => {
  const p = partes(iso);
  return Boolean(p && p.mes === hoje.getMonth() + 1);
};

/**
 * Dias até o próximo aniversário (0 = hoje). `null` sem data.
 *
 * Vira o próximo ano quando a data já passou — é o que a ficha do cliente
 * mostra o ano inteiro, não só no mês.
 */
export const diasAteAniversario = (iso?: string | null, hoje = new Date()): number | null => {
  const p = partes(iso);
  if (!p) return null;

  const base = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  let alvo = Date.UTC(hoje.getFullYear(), p.mes - 1, p.dia);

  if (alvo < base) alvo = Date.UTC(hoje.getFullYear() + 1, p.mes - 1, p.dia);

  return Math.round((alvo - base) / 86_400_000);
};

/** Idade em anos completos. `null` sem data. */
export const idadeEmAnos = (iso?: string | null, hoje = new Date()): number | null => {
  const p = partes(iso);
  if (!p) return null;

  let anos = hoje.getFullYear() - p.ano;
  const jaFez = hoje.getMonth() + 1 > p.mes || (hoje.getMonth() + 1 === p.mes && hoje.getDate() >= p.dia);

  if (!jaFez) anos -= 1;

  return anos >= 0 && anos < 130 ? anos : null;
};
