/**
 * Valor em reais por extenso — "mil duzentos e trinta reais e cinquenta
 * centavos".
 *
 * Num recibo isso não é enfeite: o valor escrito é o que impede a alteração do
 * número depois de assinado, e é o que qualquer contador espera encontrar num
 * documento de quitação. Um recibo só com algarismos passa por rascunho.
 *
 * Cobre até bilhões, que é muito além do que uma nota de balcão alcança.
 */

const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const DEZ_A_DEZENOVE = ["dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

/** 0–999 por extenso. */
function ate999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";

  const c = Math.floor(n / 100);
  const resto = n % 100;

  const partes: string[] = [];

  if (c > 0) partes.push(CENTENAS[c]);

  if (resto >= 20) {
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
  } else if (resto >= 10) {
    partes.push(DEZ_A_DEZENOVE[resto - 10]);
  } else if (resto > 0) {
    partes.push(UNIDADES[resto]);
  }

  return partes.join(" e ");
}

/** Blocos de milhar, do maior para o menor. */
const ESCALAS: [number, string, string][] = [
  [1_000_000_000, "bilhão", "bilhões"],
  [1_000_000, "milhão", "milhões"],
  [1_000, "mil", "mil"],
];

function inteiroPorExtenso(n: number): string {
  if (n === 0) return "zero";

  const partes: string[] = [];
  let resto = n;

  for (const [valor, singular, plural] of ESCALAS) {
    const quantos = Math.floor(resto / valor);

    if (quantos > 0) {
      // "mil" não leva "um" na frente: 1.500 é "mil e quinhentos".
      const prefixo = valor === 1_000 && quantos === 1 ? "" : `${ate999(quantos)} `;
      partes.push(`${prefixo}${quantos === 1 ? singular : plural}`.trim());
      resto %= valor;
    }
  }

  if (resto > 0) partes.push(ate999(resto));

  /*
   * O "e" antes do último bloco só entra quando ele é pequeno ou redondo —
   * "mil e duzentos", mas "mil duzentos e trinta". É a regra que faz o texto
   * soar escrito por gente.
   */
  if (partes.length > 1) {
    const ultimo = partes[partes.length - 1];
    const ligaComE = resto > 0 && (resto < 100 || resto % 100 === 0);

    return `${partes.slice(0, -1).join(", ")}${ligaComE ? " e " : " "}${ultimo}`;
  }

  return partes[0] ?? "";
}

/** "R$ 1.230,50" → "mil duzentos e trinta reais e cinquenta centavos". */
export function valorPorExtenso(valor: number): string {
  const total = Math.round(Math.abs(Number(valor) || 0) * 100);

  const reais = Math.floor(total / 100);
  const centavos = total % 100;

  const partes: string[] = [];

  if (reais > 0) {
    const escrito = inteiroPorExtenso(reais);

    /* "um milhão DE reais", mas "um milhão e quinhentos mil reais": o "de" só
       entra quando o número termina na própria escala, sem resto. */
    const terminaEmEscala = /(milhão|milhões|bilhão|bilhões)$/.test(escrito);

    partes.push(`${escrito} ${terminaEmEscala ? "de " : ""}${reais === 1 ? "real" : "reais"}`);
  }

  if (centavos > 0) partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);

  if (partes.length === 0) return "zero real";

  return partes.join(" e ");
}
