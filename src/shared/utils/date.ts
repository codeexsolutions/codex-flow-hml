import { EMPTY } from "./format";

/**
 * Datas do sistema são sempre lidas e exibidas no fuso de Brasília.
 *
 * Antes tudo passava por `new Date(valor).toLocaleDateString()`, o que produzia
 * dois erros de fuso:
 *
 * 1. `"2026-07-30"` (data pura) é interpretado pelo JS como meia-noite **UTC**;
 *    exibido em UTC-3 virava `29/07/2026` — a venda aparecia um dia antes.
 * 2. O restante era exibido no fuso do dispositivo. Um celular configurado fora
 *    do horário de Brasília mostrava outra hora (e às vezes outro dia) para a
 *    mesma venda.
 *
 * A regra agora é explícita: string ISO **sem** fuso vem do backend brasileiro e
 * é lida literalmente, sem conversão; valor **com** fuso (`Z` ou `±hh:mm`),
 * `Date` ou timestamp é um instante absoluto e é convertido para Brasília.
 */

const TIMEZONE = "America/Sao_Paulo";

type DateInput = Date | string | number | undefined | null;

/** Data/hora já resolvida no fuso de Brasília. */
type Parts = { year: number; month: number; day: number; hour: number; minute: number };

/** ISO sem indicação de fuso: `2026-07-30`, `2026-07-30T14:30`, `2026-07-30 14:30:00.123`. */
const NAIVE_ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?)?$/;

/** Um formatter só para toda a aplicação — criar um por célula de tabela é caro. */
let formatter: Intl.DateTimeFormat | null = null;

const tzFormatter = (): Intl.DateTimeFormat => {
  formatter ??= new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return formatter;
};

/** Componentes de um instante absoluto, olhados no fuso de Brasília. */
const partsFromInstant = (date: Date): Parts => {
  const found: Record<string, string> = {};
  for (const { type, value } of tzFormatter().formatToParts(date)) found[type] = value;
  return {
    year: Number(found.year),
    month: Number(found.month),
    day: Number(found.day),
    // Intl pode devolver "24" para meia-noite em `hour12: false`.
    hour: Number(found.hour) % 24,
    minute: Number(found.minute),
  };
};

const parse = (value: DateInput): Parts | null => {
  if (value === undefined || value === null || value === "") return null;

  if (typeof value === "string") {
    const iso = NAIVE_ISO.exec(value.trim());
    // Sem fuso na string: os números são a hora de Brasília, sem conversão.
    if (iso) {
      return {
        year: Number(iso[1]),
        month: Number(iso[2]),
        day: Number(iso[3]),
        hour: Number(iso[4] ?? 0),
        minute: Number(iso[5] ?? 0),
      };
    }
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : partsFromInstant(date);
};

const pad = (n: number): string => String(n).padStart(2, "0");

/**
 * `Date` cujos componentes **locais** são a data/hora de Brasília do valor.
 *
 * Serve para agrupar por dia/mês (`getMonth()`, `getFullYear()`) sem que o fuso
 * do dispositivo jogue um registro para o mês vizinho. Não use para ordenar
 * instantes — para isso compare os valores originais.
 */
export function toDate(value: DateInput): Date | null {
  const p = parse(value);
  return p ? new Date(p.year, p.month - 1, p.day, p.hour, p.minute) : null;
}

/** dd/mm/aaaa — ex.: 28/07/2026 */
export function formatDate(value: DateInput, fallback = EMPTY): string {
  const p = parse(value);
  return p ? `${pad(p.day)}/${pad(p.month)}/${p.year}` : fallback;
}

/** dd/mm/aa — usado em tabelas densas. */
export function formatDateShort(value: DateInput, fallback = "--"): string {
  const p = parse(value);
  return p ? `${pad(p.day)}/${pad(p.month)}/${pad(p.year % 100)}` : fallback;
}

/** dd/mm/aaaa - hh:mm */
export function formatDateTime(value: DateInput, fallback = EMPTY): string {
  const p = parse(value);
  return p ? `${pad(p.day)}/${pad(p.month)}/${p.year} - ${pad(p.hour)}:${pad(p.minute)}` : fallback;
}

/** hh:mm */
export function formatTime(value: DateInput, fallback = "--:--"): string {
  const p = parse(value);
  return p ? `${pad(p.hour)}:${pad(p.minute)}` : fallback;
}

export function isSameDay(value: DateInput, ref: DateInput = new Date()): boolean {
  const a = parse(value);
  const b = parse(ref);
  if (!a || !b) return false;
  return a.day === b.day && a.month === b.month && a.year === b.year;
}

export function isSameMonth(value: DateInput, ref: DateInput = new Date()): boolean {
  const a = parse(value);
  const b = parse(ref);
  if (!a || !b) return false;
  return a.month === b.month && a.year === b.year;
}

export const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"] as const;

export const MESES_EXTENSO = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
] as const;

/**
 * O dia como se fala: "terça-feira, 11 de agosto".
 *
 * `11/08/2026` obriga quem lê a traduzir, e o que a loja quer saber de um dia
 * é se ele foi uma terça ou um sábado — o movimento é diferente nos dois.
 * "Hoje" e "Ontem" vêm na frente porque são os dois dias que se olha toda
 * hora, e para eles o nome do dia da semana não acrescenta nada.
 *
 * O ano só aparece quando não é o corrente: escrevê-lo sempre gastaria a
 * largura do rótulo com a informação que menos muda.
 */
export function diaExtenso(dia: Date): string {
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);

  const mesmo = (a: Date, b: Date) => a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

  const diaEMes = `${dia.getDate()} de ${MESES_EXTENSO[dia.getMonth()]}`;

  if (mesmo(dia, hoje)) return `Hoje, ${diaEMes}`;
  if (mesmo(dia, ontem)) return `Ontem, ${diaEMes}`;

  const semana = dia.toLocaleDateString("pt-BR", { weekday: "long" });
  const ano = dia.getFullYear() === hoje.getFullYear() ? "" : ` de ${dia.getFullYear()}`;

  return `${semana}, ${diaEMes}${ano}`;
}

/**
 * Data como as tabelas escrevem: vazio vira "-", e não o travessão do `EMPTY`.
 * A diferença importa numa coluna estreita, onde "—" e uma data têm larguras
 * muito diferentes.
 */
export const brDate = (valor?: DateInput): string => (valor ? formatDate(valor, "-") : "-");
