import { MONTHS, toDate } from "@/shared/utils/date";

/**
 * Formatação das faturas — mora fora da tela porque o extrato, o herói e o PDF
 * escrevem a mesma competência e o mesmo prazo. Quando isso estava duplicado
 * dentro da página, "Ago/2026" numa parte convivia com "2026-08" na outra.
 */

/** Competência vem como "AAAA-MM" — na tela ninguém lê isso. */
export const competenciaBr = (competencia: string): string => {
  const [ano, mes] = (competencia ?? "").split("-");
  const rotulo = MONTHS[Number(mes) - 1];
  return rotulo ? `${rotulo}/${ano}` : competencia;
};

/** Nome da fatura quando o backend não mandou descrição. */
export const tituloFatura = (descricao: string | null, competencia: string): string => descricao || `Assinatura ${competenciaBr(competencia)}`;

export type Prazo = {
  /** "vence hoje", "em 5 dias", "há 3 dias" — o que o extrato mostra ao lado da data. */
  texto: string;
  /** Dias até o vencimento; negativo quando já passou. `null` sem data. */
  dias: number | null;
};

/**
 * Distância até o vencimento, em dias corridos.
 *
 * Num extrato a data sozinha não responde a pergunta que se faz olhando para
 * ela ("isso já venceu?"). O cálculo compara dia com dia, sem hora: uma fatura
 * que vence hoje às 23h não pode aparecer como "há 1 dia" só porque agora são
 * 8 da manhã.
 */
export const prazoAte = (iso?: string | null): Prazo => {
  const alvo = toDate(iso);
  if (!alvo) return { texto: "", dias: null };

  const hoje = new Date();
  const a = Date.UTC(alvo.getFullYear(), alvo.getMonth(), alvo.getDate());
  const b = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dias = Math.round((a - b) / 86_400_000);

  if (dias === 0) return { texto: "vence hoje", dias };
  if (dias === 1) return { texto: "amanhã", dias };
  if (dias === -1) return { texto: "ontem", dias };
  if (dias > 0) return { texto: `em ${dias} dias`, dias };
  return { texto: `há ${Math.abs(dias)} dias`, dias };
};
