import { z } from "zod";
import { onlyDigits } from "@/shared/utils/format";

/**
 * Campos zod reutilizáveis. Antes `optionalPhone`, `optionalUrl` e `cepField`
 * eram redeclarados em cada schema, com regras sutilmente diferentes entre si.
 */

/** Aceita vazio, fixo (10) ou celular (11). */
export const optionalPhone = z.string().refine((v) => {
  const d = onlyDigits(v);
  return d === "" || d.length === 10 || d.length === 11;
}, "Número inválido");

/** Aceita vazio ou http(s)://… */
export const optionalUrl = z
  .string()
  .trim()
  .refine((v) => v === "" || /^https?:\/\/.+/i.test(v), "URL inválida");

/** Aceita vazio ou 8 dígitos. */
export const optionalCep = z.string().refine((v) => {
  const d = onlyDigits(v);
  return d === "" || d.length === 8;
}, "CEP inválido");

/** Normaliza para dígitos puros; vazio vira `undefined`. */
export const optionalDigits = z
  .string()
  .trim()
  .optional()
  .transform((v) => {
    const d = onlyDigits(v);
    return d.length ? d : undefined;
  })
  .refine((v) => v === undefined || v.length >= 8, "Número inválido");

/** Aceita vazio ou e-mail válido; vazio vira `undefined`. */
export const optionalEmail = z
  .union([z.string().trim().email("E-mail inválido"), z.literal("")])
  .optional()
  .transform((v) => (v ? v : undefined));

export const requiredEmail = z.string().min(1, "E-mail obrigatório").email("E-mail inválido");
